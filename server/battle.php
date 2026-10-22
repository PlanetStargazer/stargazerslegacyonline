<?php
// Shared battles.
//
// The tactical combat rules run in the browser of the battle's HOST (the player who was ambushed). The server is the
// referee between browsers: it stores the host's latest snapshot of the battlefield, relays the other players'
// action requests ("intents") to the host, picks a new host if the old one disappears, and tells the overland map
// where fights are going on so other players can see them and join.

require_once __DIR__ . '/social.php';

const SNAP_MAX = 450000;

function battle_row(int $id): ?array {
    $st = db()->prepare('SELECT * FROM battles WHERE id = ?');
    $st->execute([$id]);
    $r = $st->fetch();
    return $r ?: null;
}

function battle_active_players(int $bid): array {
    $st = db()->prepare('SELECT * FROM battle_players WHERE battle_id = ? AND left_at IS NULL ORDER BY joined');
    $st->execute([$bid]);
    return $st->fetchAll();
}

// somebody is still polling for this battle (a crashed host leaves a zombie behind otherwise)
function battle_alive(int $bid): bool {
    foreach (battle_active_players($bid) as $a) if (time() - (int)$a['seen'] <= HOST_TIMEOUT * 2) return true;
    return false;
}

function in_active_battle(int $uid): ?int {
    $st = db()->prepare("SELECT b.id FROM battle_players p JOIN battles b ON b.id = p.battle_id
                          WHERE p.user_id = ? AND p.left_at IS NULL AND b.status = 'active' LIMIT 1");
    $st->execute([$uid]);
    $r = $st->fetchColumn();
    return $r === false ? null : (int)$r;
}

function do_battle_start(): void {
    $u = current_user();
    $b = json_body();
    $pdo = db();
    if (($old = in_active_battle($u['id'])) !== null) {
        // a stale battle of a client that crashed: close it
        end_battle($old, ['outcome' => 'abandoned']);
    }
    $mode = in_str($b, 'mode', 10) === 'DUNGEON' ? 'DUNGEON' : 'OVERWORLD';
    $snap = $b['snapshot'] ?? null;
    $json = is_array($snap) ? json_encode($snap, JSON_UNESCAPED_UNICODE) : null;
    if ($json === null || strlen($json) > SNAP_MAX) fail('Bad snapshot.');
    $scene = in_str($b, 'scene', 80);
    $x = in_int($b, 'x'); $y = in_int($b, 'y');
    $pdo->prepare("INSERT INTO battles(host_id, host_name, mode, scene, loc, x, y, label, shape, foes, status, created, updated, seq, snapshot)
                   VALUES(?,?,?,?,?,?,?,?,?,?, 'active', ?, ?, 1, ?)")
        ->execute([$u['id'], $u['pname'], $mode, $scene, in_str($b, 'loc', 80), $x, $y, in_str($b, 'label', 80), in_str($b, 'shape', 12),
                   max(1, min(9, in_int($b, 'foes', 1))), time(), time(), $json]);
    $bid = (int)$pdo->lastInsertId();
    $pdo->prepare('INSERT INTO battle_players(battle_id, user_id, name, joined, seen) VALUES(?,?,?,?,?)')->execute([$bid, $u['id'], $u['pname'], time(), time()]);
    $pdo->prepare('UPDATE presence SET battle_id = ? WHERE user_id = ?')->execute([$bid, $u['id']]);

    // group members in range join automatically
    $gid = my_group_id($u['id']);
    $called = [];
    if ($gid !== null) {
        foreach (group_member_ids($gid) as $mid) {
            if ($mid === $u['id']) continue;
            $st = $pdo->prepare('SELECT * FROM presence WHERE user_id = ? AND updated >= ?');
            $st->execute([$mid, time() - ONLINE_TTL]);
            $p = $st->fetch();
            if (!$p || $p['scene'] !== $scene || $p['battle_id'] || (int)$p['rest']) continue;
            if ($p['mode'] !== $mode && !($mode === 'OVERWORLD' && $p['mode'] === 'OVERWORLD')) continue;
            if ($scene === 'OW' && ow_dist($x, $y, (int)$p['x'], (int)$p['y']) > GROUP_JOIN_RANGE) continue;
            if ($scene !== 'OW' && ow_dist($x, $y, (int)$p['x'], (int)$p['y']) > GROUP_JOIN_RANGE) continue;
            push_event($mid, 'battle_join', ['battle' => $bid, 'host' => $u['pname'], 'auto' => true]);
            $called[] = $mid;
        }
    }
    out(['ok' => true, 'id' => $bid, 'called' => $called]);
}

function do_battle_join(): void {
    $u = current_user();
    $b = json_body();
    $bid = in_int($b, 'id');
    $pdo = db();
    $bt = battle_row($bid);
    if (!$bt || $bt['status'] !== 'active' || !battle_alive($bid)) fail('That battle is already over.');
    if (in_active_battle($u['id']) !== null && in_active_battle($u['id']) !== $bid) fail('You are already fighting.');
    $pr = $pdo->prepare('SELECT * FROM presence WHERE user_id = ?');
    $pr->execute([$u['id']]);
    $p = $pr->fetch();
    if (!$p || $p['scene'] !== $bt['scene']) fail('You are too far from that battle.');
    if ($bt['scene'] === 'OW' && ow_dist((int)$bt['x'], (int)$bt['y'], (int)$p['x'], (int)$p['y']) > max(GROUP_JOIN_RANGE, 12)) fail('You are too far from that battle.');
    $act = battle_active_players($bid);
    $already = false;
    foreach ($act as $a) if ((int)$a['user_id'] === $u['id']) $already = true;
    if (!$already) {
        $ever = $pdo->prepare('SELECT left_at FROM battle_players WHERE battle_id = ? AND user_id = ?');
        $ever->execute([$bid, $u['id']]);
        if ($ever->fetch()) fail('You already left that battle.');
        if (count($act) >= BATTLE_MAX_PLAYERS) fail('That battle is full.');
        $pdo->prepare('INSERT INTO battle_players(battle_id, user_id, name, joined, seen) VALUES(?,?,?,?,?)')->execute([$bid, $u['id'], $u['pname'], time(), time()]);
    }
    $party = $b['party'] ?? null;
    if (!is_array($party) || count($party) < 1 || count($party) > 4) fail('Bad party.');
    $why = party_matches_save($u['id'], $party);
    if ($why !== '') fail($why);
    $json = json_encode($party, JSON_UNESCAPED_UNICODE);
    if (strlen($json) > 60000) fail('Party too large.');
    $pdo->prepare("INSERT INTO intents(battle_id, user_id, ts, kind, payload) VALUES(?,?,?,?,?)")
        ->execute([$bid, $u['id'], time(), 'join', json_encode(['name' => $u['pname'], 'party' => $party], JSON_UNESCAPED_UNICODE)]);
    $pdo->prepare('UPDATE presence SET battle_id = ? WHERE user_id = ?')->execute([$bid, $u['id']]);
    $pdo->prepare('UPDATE battles SET updated = ? WHERE id = ?')->execute([time(), $bid]);
    out(['ok' => true, 'id' => $bid]);
}

// The host's browser simulates the joiner's heroes, so they must be the heroes saved on the account (give or take
// the progress made since the last save).
function party_matches_save(int $uid, array $party): string {
    $st = db()->prepare('SELECT char_id FROM sessions WHERE user_id = ?');
    $st->execute([$uid]);
    $cid = $st->fetchColumn();
    $save = $cid ? load_char_data((int)$cid, $uid) : null;
    if (!$save || empty($save['party'])) return 'Create thy party first.';
    foreach ($party as $i => $h) {
        $o = $save['party'][$i] ?? null;
        if (!is_array($h) || !is_array($o)) return 'Thy party does not match thy saved champions.';
        if (($h['cls'] ?? '') !== ($o['cls'] ?? '') || ($h['race'] ?? '') !== ($o['race'] ?? '')) return 'Thy party does not match thy saved champions.';
        if (($h['lvl'] ?? 99) > ($o['lvl'] ?? 1) + 2) return 'Thy party does not match thy saved champions.';
        if (($h['maxHp'] ?? 9999) > ($o['maxHp'] ?? 1) * 1.35 + 25) return 'Thy party does not match thy saved champions.';
        foreach (['str', 'dex', 'int', 'wis'] as $k) if (($h[$k] ?? 99) > ($o[$k] ?? 1) + 3) return 'Thy party does not match thy saved champions.';
        if (!is_string($h['name'] ?? null) || mb_strlen($h['name']) > 20) return 'Bad hero name.';
    }
    return '';
}

function do_battle_intent(): void {
    $u = current_user();
    $b = json_body();
    $bid = in_int($b, 'id');
    $bt = battle_row($bid);
    if (!$bt || $bt['status'] !== 'active') fail('That battle is over.');
    $mine = false;
    foreach (battle_active_players($bid) as $a) if ((int)$a['user_id'] === $u['id']) $mine = true;
    if (!$mine) fail('You are not in that battle.');
    $pend = db()->prepare('SELECT COUNT(*) FROM intents WHERE battle_id = ?');
    $pend->execute([$bid]);
    if ((int)$pend->fetchColumn() > 40) fail('Too many pending actions.', 429);
    $kind = in_str($b, 'kind', 10);
    if (!in_array($kind, ['move', 'atk', 'tatk', 'cast', 'potion', 'flee', 'pass', 'song', 'leave'], true)) fail('Unknown action.');
    $payload = json_encode($b['payload'] ?? new stdClass(), JSON_UNESCAPED_UNICODE);
    if (strlen($payload) > 4000) fail('Bad action.');
    $payload = json_encode(['turn' => in_int($b, 'turn'), 'p' => json_decode($payload, true)]);
    db()->prepare('INSERT INTO intents(battle_id, user_id, ts, kind, payload) VALUES(?,?,?,?,?)')->execute([$bid, $u['id'], time(), $kind, $payload]);
    out(['ok' => true]);
}

function end_battle(int $bid, ?array $result): void {
    $pdo = db();
    $pdo->prepare("UPDATE battles SET status = 'ended', updated = ?, result = ? WHERE id = ?")
        ->execute([time(), $result ? json_encode($result, JSON_UNESCAPED_UNICODE) : null, $bid]);
    $pdo->prepare('UPDATE presence SET battle_id = NULL WHERE battle_id = ?')->execute([$bid]);
}

function do_battle_snapshot(): void {
    $u = current_user();
    $b = json_body();
    $bid = in_int($b, 'id');
    $bt = battle_row($bid);
    if (!$bt) fail('Unknown battle.');
    if ($bt['status'] !== 'active') out(['ok' => true, 'ended' => true]);
    if ((int)$bt['host_id'] !== $u['id']) fail('You are not the host of this battle.', 409, ['notHost' => true]);
    $snap = $b['snapshot'] ?? null;
    $json = is_array($snap) ? json_encode($snap, JSON_UNESCAPED_UNICODE) : null;
    if ($json === null || strlen($json) > SNAP_MAX) fail('Bad snapshot.');
    $seq = (int)$bt['seq'] + 1;
    $foes = isset($b['foes']) ? max(0, min(9, in_int($b, 'foes'))) : (int)$bt['foes'];
    db()->prepare('UPDATE battles SET snapshot = ?, seq = ?, updated = ?, foes = ? WHERE id = ?')->execute([$json, $seq, time(), $foes, $bid]);
    if (!empty($b['ended'])) {
        $res = is_array($b['result'] ?? null) ? $b['result'] : ['outcome' => 'escape'];
        end_battle($bid, $res);
    }
    out(['ok' => true, 'seq' => $seq]);
}

// takes a player out of a battle: their seat is freed, the host role passes on, an empty battle ends
function leave_battle(int $uid, int $bid): void {
    $bt = battle_row($bid);
    $pdo = db();
    $pdo->prepare('UPDATE presence SET battle_id = NULL WHERE user_id = ?')->execute([$uid]);
    if (!$bt) return;
    $pdo->prepare('UPDATE battle_players SET left_at = ? WHERE battle_id = ? AND user_id = ? AND left_at IS NULL')->execute([time(), $bid, $uid]);
    if ($bt['status'] === 'active') {
        $rest = battle_active_players($bid);
        if (!$rest) { end_battle($bid, ['outcome' => 'escape']); }
        elseif ((int)$bt['host_id'] === $uid) {
            $best = null;
            foreach ($rest as $r) if ($best === null || (int)$r['seen'] > (int)$best['seen']) $best = $r;
            $pdo->prepare('UPDATE battles SET host_id = ?, host_name = ?, updated = ? WHERE id = ?')->execute([$best['user_id'], $best['name'], time(), $bid]);
        }
    }
}
// a fresh page load / login never continues a fight: the player walks away from it
function leave_any_battle(int $uid): void {
    $bid = in_active_battle($uid);
    if ($bid !== null) leave_battle($uid, $bid);
}

function do_battle_leave(): void {
    $u = current_user();
    $bid = in_int(json_body(), 'id');
    leave_battle($u['id'], $bid);
    out(['ok' => true]);
}

// ---------------------------------------------------------------- poll sections
function check_host(array $bt): array {
    $pdo = db();
    $bid = (int)$bt['id'];
    $act = battle_active_players($bid);
    $hostSeen = 0;
    foreach ($act as $a) if ((int)$a['user_id'] === (int)$bt['host_id']) $hostSeen = (int)$a['seen'];
    if (time() - $hostSeen <= HOST_TIMEOUT) return $bt;
    $best = null;
    foreach ($act as $a) {
        if ((int)$a['user_id'] === (int)$bt['host_id']) continue;
        if (time() - (int)$a['seen'] > HOST_TIMEOUT) continue;
        if ($best === null || (int)$a['seen'] > (int)$best['seen']) $best = $a;
    }
    if ($best) {
        $pdo->prepare('UPDATE battles SET host_id = ?, host_name = ?, updated = ? WHERE id = ?')->execute([$best['user_id'], $best['name'], time(), $bid]);
        $bt['host_id'] = $best['user_id']; $bt['host_name'] = $best['name'];
    }
    return $bt;
}

function section_battle(array $u, ?array $req): ?array {
    if (!$req || empty($req['id'])) return null;
    $bid = (int)$req['id'];
    $pdo = db();
    $bt = battle_row($bid);
    if (!$bt) return ['id' => $bid, 'status' => 'gone'];
    $pdo->prepare('UPDATE battle_players SET seen = ? WHERE battle_id = ? AND user_id = ?')->execute([time(), $bid, $u['id']]);
    if ($bt['status'] === 'active') $bt = check_host($bt);
    $seq = (int)($req['seq'] ?? 0);
    $res = ['id' => $bid, 'status' => $bt['status'], 'host' => (int)$bt['host_id'], 'hostName' => $bt['host_name'], 'seq' => (int)$bt['seq']];
    if ((int)$bt['seq'] > $seq) $res['snapshot'] = json_decode($bt['snapshot'], true);
    if ($bt['status'] !== 'active') $res['result'] = $bt['result'] ? json_decode($bt['result'], true) : null;
    $pl = [];
    $st = $pdo->prepare('SELECT user_id, name, left_at, seen FROM battle_players WHERE battle_id = ?');
    $st->execute([$bid]);
    foreach ($st->fetchAll() as $r) $pl[] = ['id' => (int)$r['user_id'], 'name' => $r['name'], 'left' => $r['left_at'] !== null, 'idle' => time() - (int)$r['seen']];
    $res['players'] = $pl;
    if ((int)$bt['host_id'] === $u['id'] && $bt['status'] === 'active') {
        $iseq = (int)($req['iseq'] ?? 0);
        if ($iseq > 0) $pdo->prepare('DELETE FROM intents WHERE battle_id = ? AND id <= ?')->execute([$bid, $iseq]);
        $st = $pdo->prepare('SELECT id, user_id, kind, payload FROM intents WHERE battle_id = ? AND id > ? ORDER BY id LIMIT 60');
        $st->execute([$bid, $iseq]);
        $in = [];
        foreach ($st->fetchAll() as $r) {
            $pl = json_decode($r['payload'], true) ?: [];
            $in[] = ['id' => (int)$r['id'], 'user' => (int)$r['user_id'], 'kind' => $r['kind'], 'turn' => $pl['turn'] ?? 0, 'p' => $pl['p'] ?? $pl];
        }
        $res['intents'] = $in;
    }
    return $res;
}

function section_battles(array $u, array $pos): array {
    $scene = in_str($pos, 'scene', 80);
    $st = db()->prepare("SELECT * FROM battles WHERE status = 'active' AND scene = ?");
    $st->execute([$scene]);
    $mx = in_int($pos, 'x'); $my = in_int($pos, 'y');
    $gid = my_group_id($u['id']);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        if ($scene === 'OW' && ow_dist($mx, $my, (int)$r['x'], (int)$r['y']) > MAP_VIEW_RANGE) continue;
        if (!battle_alive((int)$r['id'])) { end_battle((int)$r['id'], ['outcome' => 'abandoned']); continue; }
        $act = battle_active_players((int)$r['id']);
        $grp = false;
        if ($gid !== null) foreach ($act as $a) if (my_group_id((int)$a['user_id']) === $gid) $grp = true;
        $out[] = ['id' => (int)$r['id'], 'host' => $r['host_name'], 'hostId' => (int)$r['host_id'], 'x' => (int)$r['x'], 'y' => (int)$r['y'],
                  'label' => $r['label'], 'shape' => $r['shape'], 'foes' => (int)$r['foes'], 'n' => count($act),
                  'full' => count($act) >= BATTLE_MAX_PLAYERS, 'group' => $grp,
                  'names' => array_map(fn($a) => $a['name'], $act)];
    }
    return $out;
}

function cleanup_battles(): void {
    $pdo = db();
    $rows = $pdo->query("SELECT id, updated FROM battles WHERE status = 'active' AND updated < " . (time() - BATTLE_ABANDON))->fetchAll();
    foreach ($rows as $r) {
        $alive = false;
        foreach (battle_active_players((int)$r['id']) as $a) if (time() - (int)$a['seen'] <= HOST_TIMEOUT * 2) $alive = true;
        if (!$alive) end_battle((int)$r['id'], ['outcome' => 'abandoned']);
    }
    $old = $pdo->query("SELECT id FROM battles WHERE status = 'ended' AND updated < " . (time() - 600))->fetchAll(PDO::FETCH_COLUMN);
    foreach ($old as $id) {
        $pdo->prepare('DELETE FROM intents WHERE battle_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM battle_players WHERE battle_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM battles WHERE id = ?')->execute([$id]);
    }
}
