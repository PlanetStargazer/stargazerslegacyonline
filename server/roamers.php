<?php
// Roaming monsters on the overworld, run by the server so that every player sees the same ones.
//
// The terrain is generated identically in every browser, so the first client to connect uploads a one-bit-per-tile
// "can a monster stand here" map (do_roam_map). From then on the server spawns, moves and removes the monsters;
// clients only draw them (they come with every poll) and, when one catches a party, claim it (do_roam_claim)
// before the fight starts - so the same monster can never be fought twice.

require_once __DIR__ . '/social.php';

const ROAM_MAP_VER = '6';     // bump when the terrain generator changes where monsters may stand

function roam_map(): ?array {
    static $m = false;
    if ($m !== false) return $m;
    $raw = kv_get('roam_map');
    $bits = $raw === null ? false : base64_decode($raw, true);
    if ($bits === false || strlen($bits) !== intdiv(OW_WIDTH * OW_HEIGHT + 7, 8)) return $m = null;     // none yet, or one from a smaller world
    if ((kv_get('roam_ver') ?? '1') !== ROAM_MAP_VER) return $m = null;                                 // drawn for an older version of the terrain
    $lairs = json_decode((string)(kv_get('roam_lairs') ?? '[]'), true);
    return $m = ['bits' => $bits, 'maxTier' => (int)(kv_get('roam_maxtier') ?? 0), 'lairs' => is_array($lairs) ? $lairs : []];
}

function do_roam_map(): void {
    current_user();
    if (roam_map() !== null) out(['ok' => true, 'have' => true]);
    $b = json_body();
    if (in_int($b, 'w') !== OW_WIDTH || in_int($b, 'h') !== OW_HEIGHT) fail('Wrong map size.');
    $bits = (string)($b['bits'] ?? '');
    $raw = base64_decode($bits, true);
    if ($raw === false || strlen($raw) !== intdiv(OW_WIDTH * OW_HEIGHT + 7, 8)) fail('Bad map.');
    $pdo = db();
    $pdo->prepare('INSERT OR REPLACE INTO world(k, v) VALUES(?, ?)')->execute(['roam_map', $bits]);
    $pdo->prepare('INSERT OR REPLACE INTO world(k, v) VALUES(?, ?)')->execute(['roam_ver', ROAM_MAP_VER]);
    $lairs = [];
    foreach (array_slice(is_array($b['lairs'] ?? null) ? $b['lairs'] : [], 0, 600) as $l) if (is_array($l) && count($l) >= 2) $lairs[] = [(int)$l[0], (int)$l[1], (int)($l[2] ?? 0), (int)($l[3] ?? 0), (int)($l[4] ?? -1)];
    $pdo->prepare('INSERT OR REPLACE INTO world(k, v) VALUES(?, ?)')->execute(['roam_lairs', json_encode($lairs)]);
    $camps = [];                                  // abandoned camps: [x, y] each, looted ones are remembered by index
    foreach (array_slice(is_array($b['camps'] ?? null) ? $b['camps'] : [], 0, 400) as $c) if (is_array($c) && count($c) >= 2) $camps[] = [(int)$c[0], (int)$c[1]];
    $pdo->prepare('INSERT OR REPLACE INTO world(k, v) VALUES(?, ?)')->execute(['roam_camps', json_encode($camps)]);
    $pdo->prepare('INSERT OR REPLACE INTO world(k, v) VALUES(?, ?)')->execute(['roam_maxtier', (string)max(0, min(40, in_int($b, 'maxTier')))]);
    $pdo->exec('DELETE FROM roamers');          // monsters of an older map stand in the wrong places
    out(['ok' => true]);
}

function roam_walkable(array $map, int $x, int $y): bool {
    if ($y < 2 || $y >= OW_HEIGHT - 2) return false;
    $x = (($x % OW_WIDTH) + OW_WIDTH) % OW_WIDTH;
    $i = $y * OW_WIDTH + $x;
    return ((ord($map['bits'][$i >> 3] ?? "\0") >> ($i & 7)) & 1) === 1;
}

// signed horizontal distance on the wrapping map
function roam_dx(int $a, int $b): int {
    $d = ($b - $a) % OW_WIDTH;
    if ($d > OW_WIDTH / 2) $d -= OW_WIDTH;
    elseif ($d < -OW_WIDTH / 2) $d += OW_WIDTH;
    return $d;
}
function roam_dist(int $x1, int $y1, int $x2, int $y2): int { return abs(roam_dx($x1, $x2)) + abs($y2 - $y1); }

// Chance to meet stronger monsters grows with the hero's level (same curve the single-player game used).
function roam_pick_tier(int $lvl, int $maxTier): int {
    $c = ($lvl - 1) / 2;
    $tt = $c + (mt_rand() / mt_getrandmax() + mt_rand() / mt_getrandmax() - 1) * 1.3;
    return max(0, min($maxTier, (int)round($tt)));
}

// Advances the monsters by the real time that has passed (at most a few steps, so a quiet server does not stampede).
// kinds: 0 = a wandering monster, 1 = harmless wildlife, 2 = a monster of a lair (ruins and dungeon entrances; `lair` indexes the list the client uploaded)
// Newcomers appear only just outside what the adventurer can see (their reported sight radius), never in view of anybody.
function roam_tick(): void {
    $map = roam_map();
    if (!$map) return;
    $now = now_ms();
    $last = (int)(kv_get('roam_last') ?? 0);
    if ($last <= 0 || $now - $last > ROAM_TICK_MS * 8) { $steps = 1; $newLast = $now; }
    else { $steps = min(5, intdiv($now - $last, ROAM_TICK_MS)); $newLast = $last + $steps * ROAM_TICK_MS; }
    if ($steps < 1) return;
    kv_set('roam_last', (string)$newLast);

    $pdo = db();
    $st = $pdo->prepare("SELECT user_id, x, y, lvl, COALESCE(los, 5) AS los FROM presence WHERE updated >= ? AND mode = 'OVERWORLD' AND battle_id IS NULL AND ship = 0 AND rest = 0");
    $st->execute([time() - ONLINE_TTL]);
    $targets = $st->fetchAll();
    $roamers = [];
    foreach ($pdo->query('SELECT id, x, y, tier, COALESCE(kind, 0) AS kind, COALESCE(lair, -1) AS lair FROM roamers')->fetchAll() as $r) {
        $roamers[(int)$r['id']] = ['x' => (int)$r['x'], 'y' => (int)$r['y'], 'tier' => (int)$r['tier'], 'kind' => (int)$r['kind'], 'lair' => (int)$r['lair']];
    }
    // everybody who is online keeps the monsters near them alive, even while fighting or visiting a town - the monsters only
    // chase and spawn for those walking the overworld
    $on = $pdo->prepare('SELECT x, y FROM presence WHERE updated >= ?');
    $on->execute([time() - ONLINE_TTL]);
    $online = $on->fetchAll();
    if (!$online) { if ($roamers) $pdo->exec('DELETE FROM roamers'); return; }
    if (!$targets) {
        $gone = [];
        foreach ($roamers as $id => $r) {
            $keep = false;
            foreach ($online as $o) if (roam_dist($r['x'], $r['y'], (int)$o['x'], (int)$o['y']) <= ROAM_KEEP_RANGE) { $keep = true; break; }
            if (!$keep) $gone[] = (int)$id;
        }
        if ($gone) $pdo->exec('DELETE FROM roamers WHERE id IN (' . implode(',', $gone) . ')');
        return;
    }

    $nearest = function (int $x, int $y) use ($targets): array {
        $best = null; $bd = PHP_INT_MAX;
        foreach ($targets as $t) { $d = roam_dist($x, $y, (int)$t['x'], (int)$t['y']); if ($d < $bd) { $bd = $d; $best = $t; } }
        return [$best, $bd];
    };
    // somebody could see this tile right now (their reported sight radius, plus a margin)
    $seen = function (int $x, int $y) use ($targets): bool {
        foreach ($targets as $t) if (roam_dist($x, $y, (int)$t['x'], (int)$t['y']) <= (int)$t['los'] + 1) return true;
        return false;
    };
    $changed = []; $removed = []; $added = [];
    $occupied = [];
    foreach ($roamers as $id => $r) {
        $d = PHP_INT_MAX;
        foreach ($online as $o) $d = min($d, roam_dist($r['x'], $r['y'], (int)$o['x'], (int)$o['y']));
        if ($d > ROAM_KEEP_RANGE) { unset($roamers[$id]); $removed[] = $id; continue; }
        $occupied[$r['x'] . ',' . $r['y']] = true;
    }
    $rnd = fn(int $pct): bool => mt_rand(1, 100) <= $pct;
    $lairs = $map['lairs'];
    // after dark the monsters are bolder: they notice the party from further away, close in faster and are more numerous
    $hour = (world_turn() + 8) % 24;
    $night = $hour >= 20 || $hour <= 4;
    $chaseRange = $night ? (int)(ROAM_CHASE_RANGE * 1.4) : ROAM_CHASE_RANGE;
    $movePct = $night ? min(95, ROAM_MOVE_PCT + 25) : ROAM_MOVE_PCT;
    $perPlayer = $night ? ROAM_PER_PLAYER + 2 : ROAM_PER_PLAYER;
    $spawnPct = $night ? ROAM_SPAWN_PCT + 14 : ROAM_SPAWN_PCT;

    for ($s = 0; $s < $steps; $s++) {
        foreach ($roamers as $id => &$r) {
            [$t, $d] = $nearest($r['x'], $r['y']);
            $moves = [];
            if ($r['kind'] === 1) {                                    // wildlife grazes about and never hunts
                if ($rnd(14)) $moves = [[mt_rand(-1, 1), mt_rand(-1, 1)]];
            } elseif ($d <= $chaseRange) {
                if (!$rnd($movePct)) continue;
                $sx = roam_dx($r['x'], (int)$t['x']) <=> 0; $sy = ((int)$t['y'] - $r['y']) <=> 0;
                $moves = [[$sx, $sy], [$sx, 0], [0, $sy]];
            } elseif ($rnd(10)) {
                $moves = [[mt_rand(-1, 1), mt_rand(-1, 1)]];
            }
            foreach ($moves as [$mx, $my]) {
                if (!$mx && !$my) continue;
                $nx = (($r['x'] + $mx) % OW_WIDTH + OW_WIDTH) % OW_WIDTH; $ny = $r['y'] + $my;
                if (!roam_walkable($map, $nx, $ny) || isset($occupied[$nx . ',' . $ny])) continue;
                unset($occupied[$r['x'] . ',' . $r['y']]);
                $r['x'] = $nx; $r['y'] = $ny; $occupied[$nx . ',' . $ny] = true;
                $changed[$id] = true;
                break;
            }
        }
        unset($r);
        // a point just outside everybody's sight, between $lo and $hi tiles from $t
        $place = function (array $t, int $lo, int $hi) use ($map, &$occupied, $seen): ?array {
            for ($try = 0; $try < 30; $try++) {
                $ang = mt_rand() / mt_getrandmax() * M_PI * 2; $dist = $lo + mt_rand() / mt_getrandmax() * max(0, $hi - $lo);
                $nx = (((int)round($t['x'] + cos($ang) * $dist)) % OW_WIDTH + OW_WIDTH) % OW_WIDTH; $ny = (int)round($t['y'] + sin($ang) * $dist);
                if (!roam_walkable($map, $nx, $ny) || isset($occupied[$nx . ',' . $ny]) || $seen($nx, $ny)) continue;
                return [$nx, $ny];
            }
            return null;
        };
        $all = function () use (&$roamers, &$added) { return array_merge($roamers, $added); };
        foreach ($targets as $t) {
            if (count($roamers) + count($added) >= 220) break;
            $los = max(1, min(12, (int)$t['los']));
            $monstersNear = 0; $faunaNear = 0;
            foreach ($all() as $r) {
                $d = roam_dist($r['x'], $r['y'], (int)$t['x'], (int)$t['y']);
                if ($r['kind'] === 1) { if ($d <= 10) $faunaNear++; }
                elseif ($d <= 38) $monstersNear++;
            }
            // at least one monster in the neighbourhood of every adventurer: appears at once, just beyond the edge of sight
            if ($monstersNear < $perPlayer && ($monstersNear === 0 || $rnd($spawnPct))) {
                $p = $place($t, $los + 1, $los + 7);
                if ($p) {
                    $added[] = ['x' => $p[0], 'y' => $p[1], 'tier' => roam_pick_tier(max(1, (int)$t['lvl']), $map['maxTier']), 'kind' => 0, 'lair' => -1];
                    $occupied[$p[0] . ',' . $p[1]] = true;
                }
            }
            // always a few harmless creatures about: two or three within ten tiles
            if ($faunaNear < 3 && $rnd($faunaNear < 2 ? 70 : 30)) {
                $p = $place($t, $los + 1, max($los + 3, 10));
                if ($p) {
                    $added[] = ['x' => $p[0], 'y' => $p[1], 'tier' => 0, 'kind' => 1, 'lair' => -1];
                    $occupied[$p[0] . ',' . $p[1]] = true;
                }
            }
        }
        // ruins and dungeon entrances spawn monsters of their own while an adventurer is close (but not in sight of the lair)
        foreach ($lairs as $li => $lair) {
            if (count($roamers) + count($added) >= 220) break;
            [$t, $d] = $nearest((int)$lair[0], (int)$lair[1]);
            if (!$t || $d > 34 || $d <= (int)$t['los'] + 1) continue;
            $n = 0;
            foreach ($all() as $r) if ($r['kind'] === 2 && $r['lair'] === $li) $n++;
            $camp = (int)($lair[2] ?? 0) === 2;                                  // an encampment breeds a lot more of its kind, and always the same kind
            if ($n >= ($camp ? 5 : 2) || !$rnd($camp ? 16 : 6)) continue;
            $reach = $camp ? 5 : 4;
            for ($try = 0; $try < 12; $try++) {
                $nx = (((int)$lair[0] + mt_rand(-$reach, $reach)) % OW_WIDTH + OW_WIDTH) % OW_WIDTH; $ny = (int)$lair[1] + mt_rand(-$reach, $reach);
                if (!roam_walkable($map, $nx, $ny) || isset($occupied[$nx . ',' . $ny]) || $seen($nx, $ny)) continue;
                $tier = roam_pick_tier(max(1, (int)$t['lvl']), $map['maxTier']);
                if ((int)($lair[2] ?? 0) === 1) $tier = min($map['maxTier'], $tier + 1);          // dungeon mouths breed the nastier kind
                if ($camp) $tier = max(0, min($map['maxTier'], (int)($lair[3] ?? 0)));
                $added[] = ['x' => $nx, 'y' => $ny, 'tier' => $tier, 'kind' => 2, 'lair' => (int)$li];
                $occupied[$nx . ',' . $ny] = true;
                break;
            }
        }
    }
    if ($removed) $pdo->exec('DELETE FROM roamers WHERE id IN (' . implode(',', array_map('intval', $removed)) . ')');
    $up = $pdo->prepare('UPDATE roamers SET x = ?, y = ? WHERE id = ?');
    foreach (array_keys($changed) as $id) $up->execute([$roamers[$id]['x'], $roamers[$id]['y'], $id]);
    $ins = $pdo->prepare('INSERT INTO roamers(x, y, tier, created, kind, lair) VALUES(?,?,?,?,?,?)');
    foreach ($added as $a) $ins->execute([$a['x'], $a['y'], $a['tier'], time(), $a['kind'], $a['lair']]);
}

// the monsters this player can see on the map
function section_roamers(array $pos): array {
    $x = in_int($pos, 'x'); $y = in_int($pos, 'y');
    $out = [];
    foreach (db()->query('SELECT id, x, y, tier, COALESCE(kind, 0) AS kind, COALESCE(lair, -1) AS lair FROM roamers')->fetchAll() as $r) {
        if (roam_dist($x, $y, (int)$r['x'], (int)$r['y']) <= MAP_VIEW_RANGE) $out[] = ['id' => (int)$r['id'], 'x' => (int)$r['x'], 'y' => (int)$r['y'], 'tier' => (int)$r['tier'], 'kind' => (int)$r['kind'], 'lair' => (int)$r['lair']];
    }
    return $out;
}

// A party that runs into a monster claims it; only one claim can succeed, and the monster is gone for everybody.
function do_roam_claim(): void {
    $u = current_user();
    require_char($u);
    $id = in_int(json_body(), 'id');
    $pdo = db();
    $st = $pdo->prepare('SELECT x, y, tier FROM roamers WHERE id = ?');
    $st->execute([$id]);
    $r = $st->fetch();
    if (!$r) out(['ok' => true, 'claimed' => false]);
    $p = $pdo->prepare('SELECT x, y FROM presence WHERE user_id = ?');
    $p->execute([$u['id']]);
    $me = $p->fetch();
    if (!$me || roam_dist((int)$me['x'], (int)$me['y'], (int)$r['x'], (int)$r['y']) > 10) out(['ok' => true, 'claimed' => false]);
    $del = $pdo->prepare('DELETE FROM roamers WHERE id = ?');
    $del->execute([$id]);
    out(['ok' => true, 'claimed' => $del->rowCount() === 1, 'tier' => (int)$r['tier']]);
}


// ---------------------------------------------------------------- loot bags
// When a bag is full the rest of the spoils are left in a bag on the ground; anybody who walks up to it may take what they can carry.
const BAG_KINDS = ['potion', 'ration', 'meat', 'leather', 'w', 'a', 'h', 'magic'];
function clean_bag_item($it): ?array {
    if (!is_array($it) || !in_array($it['t'] ?? '', BAG_KINDS, true)) return null;
    $o = ['t' => $it['t']];
    if (in_array($o['t'], ['potion', 'ration', 'meat', 'leather'], true)) { $o['n'] = max(1, min(99, (int)($it['n'] ?? 1))); if ($o['t'] === 'potion') $o['id'] = preg_match('/^(h[123]|m[123]|anti|recall)$/', (string)($it['id'] ?? '')) ? $it['id'] : 'h1'; return $o; }
    if (in_array($o['t'], ['w', 'a', 'h'], true)) { $o['i'] = max(0, min(30, (int)($it['i'] ?? 0))); return $o; }
    $m = is_array($it['m'] ?? null) ? $it['m'] : null;
    if (!$m || !in_array($m['k'] ?? '', ['w', 'a', 'h'], true)) return null;
    $o['m'] = ['k' => $m['k'], 'b' => max(0, min(30, (int)($m['b'] ?? 0))), 'p' => max(1, min(5, (int)($m['p'] ?? 1))),
               'pre' => isset($m['pre']) && is_string($m['pre']) ? substr($m['pre'], 0, 20) : null, 'suf' => isset($m['suf']) && is_string($m['suf']) ? substr($m['suf'], 0, 20) : null,
               'u' => substr((string)($m['u'] ?? ('b' . mt_rand())), 0, 24)];
    return $o;
}
function do_bag_drop(): void {
    $u = current_user();
    require_char($u);
    $b = json_body();
    $items = [];
    foreach (array_slice(is_array($b['items'] ?? null) ? $b['items'] : [], 0, 24) as $it) { $c = clean_bag_item($it); if ($c) $items[] = $c; }
    if (!$items) out(['ok' => true]);
    $x = in_int($b, 'x'); $y = in_int($b, 'y');
    $pdo = db();
    // the bag lands where the adventurer stands (a second bag on the same tile is merged into the first)
    $st = $pdo->prepare('SELECT id, items FROM lootbags WHERE x = ? AND y = ?');
    $st->execute([$x, $y]);
    $old = $st->fetch();
    if ($old) {
        $merged = array_slice(array_merge(json_decode($old['items'], true) ?: [], $items), 0, 40);
        $pdo->prepare('UPDATE lootbags SET items = ?, created = ? WHERE id = ?')->execute([json_encode($merged), time(), $old['id']]);
    } else {
        $pdo->prepare('INSERT INTO lootbags(x, y, items, created) VALUES(?,?,?,?)')->execute([$x, $y, json_encode($items), time()]);
    }
    out(['ok' => true]);
}
// take some of a bag's items (by index); the server hands out only what is still there, deleting the bag when it is empty
function do_bag_take(): void {
    $u = current_user();
    require_char($u);
    $b = json_body();
    $id = in_int($b, 'id');
    $want = array_map('intval', is_array($b['idx'] ?? null) ? array_slice($b['idx'], 0, 40) : []);
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    $st = $pdo->prepare('SELECT x, y, items FROM lootbags WHERE id = ?');
    $st->execute([$id]);
    $bag = $st->fetch();
    if (!$bag) { $pdo->exec('COMMIT'); out(['ok' => true, 'gone' => true, 'taken' => []]); }
    $p = $pdo->prepare('SELECT x, y FROM presence WHERE user_id = ?');
    $p->execute([$u['id']]);
    $me = $p->fetch();
    if (!$me || roam_dist((int)$me['x'], (int)$me['y'], (int)$bag['x'], (int)$bag['y']) > 3) { $pdo->exec('COMMIT'); fail('Thou art too far from the bag.'); }
    $items = json_decode($bag['items'], true) ?: [];
    $taken = []; $rest = [];
    foreach ($items as $i => $it) { if (in_array($i, $want, true)) $taken[] = $it; else $rest[] = $it; }
    if ($rest) $pdo->prepare('UPDATE lootbags SET items = ? WHERE id = ?')->execute([json_encode($rest), $id]);
    else $pdo->prepare('DELETE FROM lootbags WHERE id = ?')->execute([$id]);
    $pdo->exec('COMMIT');
    out(['ok' => true, 'taken' => $taken, 'left' => count($rest)]);
}
function section_lootbags(array $pos): array {
    $x = in_int($pos, 'x'); $y = in_int($pos, 'y');
    $out = [];
    foreach (db()->query('SELECT id, x, y, items FROM lootbags')->fetchAll() as $r) {
        if (roam_dist($x, $y, (int)$r['x'], (int)$r['y']) <= MAP_VIEW_RANGE) $out[] = ['id' => (int)$r['id'], 'x' => (int)$r['x'], 'y' => (int)$r['y'], 'items' => json_decode($r['items'], true) ?: []];
    }
    return $out;
}


// ---------------------------------------------------------------- abandoned camps
// A camp can be searched once; the first adventurer to reach it takes the loot (rolled on the client) and it is gone for everybody
// until CAMP_RESPAWN seconds have passed.
const CAMP_RESPAWN = 3 * 86400;
// looted camps are remembered by their coordinates ("x,y" => time of looting)
function camps_looted(): array {
    $raw = json_decode((string)(kv_get('camps_looted') ?? '{}'), true);
    $out = [];
    foreach (is_array($raw) ? $raw : [] as $k => $t) if (is_string($k) && strpos($k, ',') !== false && time() - (int)$t < CAMP_RESPAWN) $out[$k] = (int)$t;
    return $out;
}
function section_camps(): array {
    $out = [];
    foreach (array_keys(camps_looted()) as $k) { [$x, $y] = array_map('intval', explode(',', $k)); $out[] = [$x, $y]; }
    return $out;
}
function do_camp_loot(): void {
    $u = current_user();
    require_char($u);
    $b = json_body();
    $cx = in_int($b, 'x'); $cy = in_int($b, 'y');
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    $camps = json_decode((string)(kv_get('roam_camps') ?? '[]'), true);
    $has = function (array $list) use ($cx, $cy): bool { foreach ($list as $c) if (is_array($c) && (int)$c[0] === $cx && (int)$c[1] === $cy) return true; return false; };
    if (!is_array($camps) || !$has($camps)) {            // the server's list is missing or out of date: the camps come from the world seed, so take the client's
        $mine = [];
        foreach (array_slice(is_array($b['camps'] ?? null) ? $b['camps'] : [], 0, 400) as $c) if (is_array($c) && count($c) >= 2) $mine[] = [(int)$c[0], (int)$c[1]];
        if (!$has($mine)) { $pdo->exec('COMMIT'); fail('there is no camp there.'); }
        kv_set('roam_camps', json_encode($mine));
    }
    $p = $pdo->prepare('SELECT x, y FROM presence WHERE user_id = ?');
    $p->execute([$u['id']]);
    $me = $p->fetch();
    if (!$me || roam_dist((int)$me['x'], (int)$me['y'], $cx, $cy) > 5) { $pdo->exec('COMMIT'); fail('thou art too far from the camp.'); }
    $done = camps_looted();
    $key = $cx . ',' . $cy;
    if (isset($done[$key])) { $pdo->exec('COMMIT'); out(['ok' => true, 'claimed' => false]); }
    $done[$key] = time();
    kv_set('camps_looted', json_encode($done));
    $pdo->exec('COMMIT');
    out(['ok' => true, 'claimed' => true]);
}


// ---------------------------------------------------------------- for the administrator: what is spawned right now
const SPAWN_MONSTER_NAMES = [0 => 'Orc Raider', 1 => 'Skeleton', 2 => 'Dark Archer', 3 => 'Gargoyle', 4 => 'Phantom Lich', 5 => 'Crimson Wyrm', 6 => 'Mimic', 7 => 'Ghost',
    8 => 'Giant Rat', 9 => 'Kobold', 10 => 'Giant Bat', 11 => 'Goblin', 12 => 'Giant Snake', 13 => 'Wolf', 14 => 'Headless'];
const SPAWN_TIER_NAMES = ['Rats, kobolds, bats', 'Goblins, snakes, wolves', 'Orc raiders, skeletons', 'Headless, dark archers', 'Gargoyles', 'Phantom liches', 'Crimson wyrms'];
function admin_spawn_stats(): array {
    $pdo = db();
    $lairs = json_decode((string)(kv_get('roam_lairs') ?? '[]'), true);
    $lairs = is_array($lairs) ? $lairs : [];
    $wander = []; $wild = 0; $groups = ['ruins' => [], 'dungeon entrances' => [], 'encampments' => []]; $campsAlive = [];
    $tier = fn(int $t): string => 'Tier ' . $t . ' - ' . (SPAWN_TIER_NAMES[$t] ?? '?');
    $add = function (array &$a, string $k, int $n) { $a[$k] = ($a[$k] ?? 0) + $n; };
    $total = 0;
    foreach ($pdo->query('SELECT COALESCE(kind, 0) AS k, COALESCE(lair, -1) AS lair, tier, COUNT(*) AS n FROM roamers GROUP BY k, lair, tier')->fetchAll() as $r) {
        $n = (int)$r['n']; $total += $n; $k = (int)$r['k']; $t = (int)$r['tier'];
        if ($k === 1) { $wild += $n; continue; }
        if ($k === 0) { $add($wander, $tier($t), $n); continue; }
        $L = $lairs[(int)$r['lair']] ?? null; $type = $L ? (int)$L[2] : 0;
        if ($type === 2) {
            $sp = isset($L[4]) && (int)$L[4] >= 0 ? (SPAWN_MONSTER_NAMES[(int)$L[4]] ?? 'monster') : $tier($t);
            $add($groups['encampments'], $sp, $n); $campsAlive[(int)$r['lair']] = true;
        } elseif ($type === 1) $add($groups['dungeon entrances'], $tier($t), $n);
        else $add($groups['ruins'], $tier($t), $n);
    }
    $byType = [0 => 0, 1 => 0, 2 => 0];
    foreach ($lairs as $L) $byType[(int)($L[2] ?? 0)] = ($byType[(int)($L[2] ?? 0)] ?? 0) + 1;
    $camps = json_decode((string)(kv_get('roam_camps') ?? '[]'), true);
    $fmt = fn(array $a) => array_map(fn($k, $v) => [$k, $v], array_keys($a), array_values($a));
    return [
        'total' => $total, 'wildlife' => $wild, 'wandering' => $fmt($wander),
        'ruins' => $fmt($groups['ruins']), 'dungeons' => $fmt($groups['dungeon entrances']), 'encampments' => $fmt($groups['encampments']),
        'lairs' => ['ruins' => $byType[0], 'dungeons' => $byType[1], 'encampments' => $byType[2], 'encampmentsActive' => count($campsAlive)],
        'lootBags' => (int)$pdo->query('SELECT COUNT(*) FROM lootbags')->fetchColumn(),
        'campsTotal' => is_array($camps) ? count($camps) : 0, 'campsLooted' => count(camps_looted()),
    ];
}
