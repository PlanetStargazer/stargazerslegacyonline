<?php
// Presence, chat, groups and the per-player event queue.

require_once __DIR__ . '/world.php';

const MODES_OK = ['OVERWORLD', 'TOWN', 'DUNGEON', 'COMBAT'];

function ow_dist(int $x1, int $y1, int $x2, int $y2): int {
    $dx = abs($x1 - $x2);
    $dx = min($dx, OW_WIDTH - $dx);
    return max($dx, abs($y1 - $y2));   // Chebyshev: a "range" is a square around the player
}

function push_event(int $uid, string $kind, array $payload): void {
    db()->prepare('INSERT INTO events(user_id, ts, kind, payload) VALUES(?,?,?,?)')
        ->execute([$uid, time(), $kind, json_encode($payload, JSON_UNESCAPED_UNICODE)]);
}

function sys_chat(?int $toId, string $text, ?int $groupId = null): void {
    db()->prepare('INSERT INTO chat(ts, ch, from_id, from_name, to_id, group_id, text) VALUES(?,?,?,?,?,?,?)')
        ->execute([time(), 'system', 0, '', $toId, $groupId, $text]);
}

function update_presence(array $u, array $p): void {
    $mode = in_array($p['mode'] ?? '', MODES_OK, true) ? $p['mode'] : 'OVERWORLD';
    $heroes = '';
    if (isset($p['heroes']) && is_array($p['heroes'])) {
        $list = [];
        foreach (array_slice($p['heroes'], 0, 4) as $h) {
            if (!is_array($h)) continue;
            $list[] = ['n' => in_str($h, 'n', 20), 'c' => in_str($h, 'c', 12), 'l' => in_int($h, 'l', 1), 'hp' => in_int($h, 'hp'), 'm' => in_int($h, 'm', 1)];
        }
        $heroes = json_encode($list, JSON_UNESCAPED_UNICODE);
    }
    $lk = '';
    if (isset($p['look']) && is_array($p['look'])) {
        $L = $p['look'];
        $hair = in_str($L, 'hair', 7);
        $lk = json_encode([
            'g' => (($L['g'] ?? '') === 'F') ? 'F' : 'M',
            'hair' => preg_match('/^#[0-9a-fA-F]{6}$/', $hair) ? $hair : '#6b4226',
            'beard' => in_array($L['beard'] ?? '', ['none', 'stubble', 'mustache', 'goatee', 'short', 'full', 'long'], true) ? $L['beard'] : 'none',
            'hs' => in_array($L['hs'] ?? '', HAIR_STYLES_OK, true) ? $L['hs'] : (($L['g'] ?? '') === 'F' ? 'long' : 'short'),
            'hh' => !empty($L['hh']), 'ps' => !empty($L['ps']), 'toad' => !empty($L['toad']), 'nw' => !empty($L['nw']), 'hd' => max(-1, min(20, in_int($L, 'hd', -1))), 'wv' => max(0, min(6, in_int($L, 'wv'))), 'av' => max(0, min(6, in_int($L, 'av'))), 'nc' => !empty($L['nc']), 'kw' => !empty($L['kw']), 'w' => max(0, min(20, in_int($L, 'w'))), 'a' => max(0, min(5, in_int($L, 'a'))),
            'gm' => !empty($u['gmOn']), 'wr' => max(0, min(2, in_int($L, 'wr'))), 'ar' => max(0, min(2, in_int($L, 'ar'))),
        ]);
    }
    $row = [
        $u['id'], $u['pname'], $mode, in_str($p, 'scene', 80), in_str($p, 'loc', 80),
        in_int($p, 'x'), in_int($p, 'y'), in_str($p, 'cls', 12), in_str($p, 'race', 12), max(1, min(20, in_int($p, 'lvl', 1))),
        in_int($p, 'ship') ? 1 : 0, in_int($p, 'rest') ? 1 : 0,
        in_int($p, 'battle') ?: null, max(0, in_int($p, 'hp')), max(0, in_int($p, 'mhp')), $heroes, time(), $lk, max(0, min(86400, in_int($p, 'idle'))),
        trim(in_str($p, 'sname', 24)), max(0, in_int($p, 'aboard')), max(0, min(20, in_int($p, 'los', 5))),
        preg_match('/^[dcp]:[a-z]+:\d$/', (string)($p['pet'] ?? '')) ? (string)$p['pet'] : '',
    ];
    db()->prepare('INSERT INTO presence(user_id,name,mode,scene,loc,x,y,cls,race,lvl,ship,rest,battle_id,hp,mhp,heroes,updated,look,idle,sname,aboard,los,pet)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, mode=excluded.mode, scene=excluded.scene, loc=excluded.loc,
                     x=excluded.x, y=excluded.y, cls=excluded.cls, race=excluded.race, lvl=excluded.lvl, ship=excluded.ship, rest=excluded.rest,
                     battle_id=excluded.battle_id, hp=excluded.hp, mhp=excluded.mhp, heroes=excluded.heroes, updated=excluded.updated, look=excluded.look, idle=excluded.idle, sname=excluded.sname, aboard=excluded.aboard, los=excluded.los, pet=excluded.pet')
        ->execute($row);
    db()->prepare('UPDATE users SET last_seen = ? WHERE id = ?')->execute([time(), $u['id']]);
}

function my_group_id(int $uid): ?int {
    $st = db()->prepare('SELECT group_id FROM group_members WHERE user_id = ?');
    $st->execute([$uid]);
    $g = $st->fetchColumn();
    return $g === false ? null : (int)$g;
}

function group_member_ids(int $gid): array {
    $st = db()->prepare('SELECT user_id FROM group_members WHERE group_id = ? ORDER BY joined, user_id');
    $st->execute([$gid]);
    return array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
}

function player_row_public(array $r): array {
    return [
        'id' => (int)$r['user_id'], 'name' => $r['name'], 'cls' => $r['cls'], 'race' => $r['race'], 'lvl' => (int)$r['lvl'],
        'mode' => $r['mode'], 'scene' => $r['scene'], 'loc' => $r['loc'], 'x' => (int)$r['x'], 'y' => (int)$r['y'],
        'ship' => (int)$r['ship'], 'sname' => (string)($r['sname'] ?? ''), 'aboard' => (int)($r['aboard'] ?? 0), 'pet' => (string)($r['pet'] ?? ''), 'rest' => (int)$r['rest'], 'battle' => $r['battle_id'] ? (int)$r['battle_id'] : null,
        'hp' => (int)$r['hp'], 'mhp' => (int)$r['mhp'], 'afk' => (int)($r['idle'] ?? 0) >= AFK_AFTER,
        'look' => !empty($r['look']) ? json_decode($r['look'], true) : null,
    ];
}

// ---------------------------------------------------------------- poll sections
function section_players(array $u, array $pos): array {
    $cut = time() - ONLINE_TTL;
    $st = db()->prepare('SELECT * FROM presence WHERE updated >= ? AND user_id <> ? ORDER BY name LIMIT 300');
    $st->execute([$cut, $u['id']]);
    $rows = $st->fetchAll();
    $gid = my_group_id($u['id']);
    $gmap = [];
    $online = [];
    $near = [];
    $myScene = in_str($pos, 'scene', 80);
    $mx = in_int($pos, 'x'); $my = in_int($pos, 'y');
    $gst = db()->query('SELECT user_id, group_id FROM group_members');
    foreach ($gst->fetchAll() as $g) $gmap[(int)$g['user_id']] = (int)$g['group_id'];
    foreach ($rows as $r) {
        $pub = player_row_public($r);
        $pub['grp'] = $gmap[$pub['id']] ?? null;
        $online[] = ['id' => $pub['id'], 'name' => $pub['name'], 'cls' => $pub['cls'], 'lvl' => $pub['lvl'], 'mode' => $pub['mode'],
                     'loc' => $pub['loc'], 'afk' => $pub['afk'], 'grp' => $pub['grp'], 'mine' => ($gid !== null && $pub['grp'] === $gid)];
        if ($r['scene'] !== $myScene) continue;
        if ($r['mode'] === 'OVERWORLD' || ($r['mode'] === 'COMBAT' && $r['scene'] === 'OW')) {
            if (ow_dist($mx, $my, (int)$r['x'], (int)$r['y']) > MAP_VIEW_RANGE) continue;
        }
        $near[] = $pub;
    }
    return ['online' => $online, 'near' => $near];
}

function section_chat(array $u, array $pos, int $since): array {
    $pdo = db();
    if ($since <= 0) {
        $max = (int)$pdo->query('SELECT COALESCE(MAX(id),0) FROM chat')->fetchColumn();
        $since = max(0, $max - 120);
    }
    $gid = my_group_id($u['id']);
    $scene = in_str($pos, 'scene', 80);
    $st = $pdo->prepare("SELECT * FROM chat WHERE id > :since AND (
            ch = 'world'
            OR (ch = 'local' AND scene = :scene)
            OR (ch = 'group' AND group_id = :gid AND :gid IS NOT NULL)
            OR (ch = 'whisper' AND (to_id = :me OR from_id = :me))
            OR (ch = 'system' AND (to_id IS NULL OR to_id = :me) AND (group_id IS NULL OR group_id = :gid))
        ) ORDER BY id LIMIT 80");
    $st->bindValue(':since', $since, PDO::PARAM_INT);
    $st->bindValue(':scene', $scene);
    $st->bindValue(':gid', $gid, $gid === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $st->bindValue(':me', $u['id'], PDO::PARAM_INT);
    $st->execute();
    $mx = in_int($pos, 'x'); $my = in_int($pos, 'y');
    $res = [];
    foreach ($st->fetchAll() as $r) {
        // "local" chat on the overworld only carries across 30 tiles
        if ($r['ch'] === 'local' && $scene === 'OW' && ow_dist($mx, $my, (int)$r['x'], (int)$r['y']) > 30 && (int)$r['from_id'] !== $u['id']) { $res[] = ['id' => (int)$r['id'], 'skip' => true]; continue; }
        $res[] = ['id' => (int)$r['id'], 'ts' => (int)$r['ts'], 'ch' => $r['ch'], 'from' => $r['from_name'], 'fromId' => (int)$r['from_id'],
                  'to' => $r['to_name'], 'text' => $r['text']];
    }
    return $res;
}

function section_events(array $u, int $since): array {
    $pdo = db();
    if ($since > 0) $pdo->prepare('DELETE FROM events WHERE user_id = ? AND id <= ?')->execute([$u['id'], $since]);
    $pdo->prepare('DELETE FROM events WHERE ts < ?')->execute([time() - 600]);
    $st = $pdo->prepare('SELECT id, kind, payload FROM events WHERE user_id = ? AND id > ? ORDER BY id LIMIT 40');
    $st->execute([$u['id'], $since]);
    $out = [];
    foreach ($st->fetchAll() as $r) $out[] = ['id' => (int)$r['id'], 'kind' => $r['kind'], 'data' => json_decode($r['payload'], true)];
    return $out;
}

function section_group(array $u): ?array {
    $gid = my_group_id($u['id']);
    $pdo = db();
    if ($gid === null) return null;
    $g = $pdo->prepare('SELECT * FROM groups WHERE id = ?');
    $g->execute([$gid]);
    $grp = $g->fetch();
    if (!$grp) { $pdo->prepare('DELETE FROM group_members WHERE group_id = ?')->execute([$gid]); return null; }
    $ids = group_member_ids($gid);
    $members = [];
    $cut = time() - ONLINE_TTL;
    foreach ($ids as $mid) {
        $st = $pdo->prepare('SELECT p.*, u.name AS uname FROM users u LEFT JOIN presence p ON p.user_id = u.id WHERE u.id = ?');
        $st->execute([$mid]);
        $r = $st->fetch();
        if (!$r) continue;
        $on = $r['updated'] !== null && (int)$r['updated'] >= $cut;
        $members[] = [
            'id' => $mid, 'name' => ($on && $r['name'] !== null && $r['name'] !== '') ? $r['name'] : $r['uname'], 'online' => $on,
            'cls' => $r['cls'], 'race' => $r['race'] ?? 'Human', 'look' => !empty($r['look']) ? json_decode($r['look'], true) : null, 'lvl' => (int)($r['lvl'] ?? 1), 'afk' => $on && (int)($r['idle'] ?? 0) >= AFK_AFTER, 'mode' => $on ? $r['mode'] : null, 'loc' => $on ? $r['loc'] : null,
            'x' => (int)($r['x'] ?? 0), 'y' => (int)($r['y'] ?? 0), 'scene' => $on ? $r['scene'] : null,
            'hp' => (int)($r['hp'] ?? 0), 'mhp' => (int)($r['mhp'] ?? 0),
            'heroes' => $on && $r['heroes'] ? json_decode($r['heroes'], true) : [],
            'battle' => $on && $r['battle_id'] ? (int)$r['battle_id'] : null,
        ];
    }
    return ['id' => $gid, 'leader' => (int)$grp['leader_id'], 'members' => $members];
}

function section_invites(array $u): array {
    $pdo = db();
    $pdo->prepare('DELETE FROM invites WHERE ts < ?')->execute([time() - 180]);
    $st = $pdo->prepare('SELECT id, from_name, group_id FROM invites WHERE to_id = ? ORDER BY id');
    $st->execute([$u['id']]);
    return array_map(fn($r) => ['id' => (int)$r['id'], 'from' => $r['from_name'], 'group' => (int)$r['group_id']], $st->fetchAll());
}

// a player by the name of the character they are playing (shown to everybody) or by account name
function find_player(string $name, bool $onlineOnly): ?array {
    $st = db()->prepare('SELECT u.id, u.name AS uname, COALESCE(p.name, u.name) AS shown, (p.updated >= :cut) AS online
        FROM users u LEFT JOIN presence p ON p.user_id = u.id
        WHERE (p.updated >= :cut AND lower(p.name) = lower(:n)) OR lower(u.name) = lower(:n)
        ORDER BY (p.updated >= :cut AND lower(p.name) = lower(:n)) DESC LIMIT 1');
    $st->execute([':cut' => time() - ONLINE_TTL, ':n' => $name]);
    $r = $st->fetch();
    if (!$r || ($onlineOnly && !(int)$r['online'])) return null;
    if (!(int)$r['online']) $r['shown'] = $r['uname'];
    return $r;
}

// ---------------------------------------------------------------- actions
function do_chat(): void {
    $u = current_user();
    $b = json_body();
    $text = trim(in_str($b, 'text', MAX_CHAT_LEN));
    if ($text === '') fail('Empty message.');
    $pdo = db();
    // crude flood control: 6 messages per 5 seconds
    $st = $pdo->prepare('SELECT COUNT(*) FROM chat WHERE from_id = ? AND ts >= ?');
    $st->execute([$u['id'], time() - 5]);
    if ((int)$st->fetchColumn() >= 6) fail('Slow down a little!', 429);
    $ch = in_str($b, 'ch', 10);
    $pr = $pdo->prepare('SELECT scene, x, y FROM presence WHERE user_id = ?');
    $pr->execute([$u['id']]);
    $p = $pr->fetch() ?: ['scene' => '', 'x' => 0, 'y' => 0];
    $toId = null; $toName = null; $gid = null;
    if ($ch === 'whisper') {
        $name = trim(in_str($b, 'to', 40));
        $tu = find_player($name, false);
        if (!$tu) fail("No player called \"$name\".");
        $toId = (int)$tu['id']; $toName = $tu['shown'];
    } elseif ($ch === 'group') {
        $gid = my_group_id($u['id']);
        if ($gid === null) fail('You are not in a group.');
    } elseif ($ch !== 'local') {
        $ch = 'world';
    }
    $pdo->prepare('INSERT INTO chat(ts, ch, from_id, from_name, to_id, to_name, group_id, scene, x, y, text) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([time(), $ch, $u['id'], $u['pname'], $toId, $toName, $gid, $p['scene'], $p['x'], $p['y'], $text]);
    // keep the table small
    if (random_int(1, 40) === 1) $pdo->exec('DELETE FROM chat WHERE id < (SELECT MAX(id) FROM chat) - 1500');
    out(['ok' => true]);
}

function leave_group(int $uid): void {
    $pdo = db();
    $gid = my_group_id($uid);
    if ($gid === null) return;
    $pdo->prepare('DELETE FROM group_members WHERE user_id = ?')->execute([$uid]);
    $ids = group_member_ids($gid);
    if (count($ids) <= 1) {
        // a group of one is no group
        $pdo->prepare('DELETE FROM group_members WHERE group_id = ?')->execute([$gid]);
        $pdo->prepare('DELETE FROM groups WHERE id = ?')->execute([$gid]);
        $pdo->prepare('DELETE FROM invites WHERE group_id = ?')->execute([$gid]);
        foreach ($ids as $i) push_event($i, 'group', ['msg' => 'The group has disbanded.']);
        return;
    }
    $g = $pdo->prepare('SELECT leader_id FROM groups WHERE id = ?');
    $g->execute([$gid]);
    if ((int)$g->fetchColumn() === $uid) $pdo->prepare('UPDATE groups SET leader_id = ? WHERE id = ?')->execute([$ids[0], $gid]);
}

function do_group(): void {
    $u = current_user();
    $b = json_body();
    $act = in_str($b, 'act', 12);
    $pdo = db();
    if ($act === 'invite') {
        $name = trim(in_str($b, 'name', 40));
        $tu = find_player($name, true);
        if (!$tu) fail("\"$name\" is not online.");
        if ((int)$tu['id'] === $u['id']) fail('You cannot invite yourself.');
        if (my_group_id((int)$tu['id']) !== null) fail($tu['shown'] . ' is already in a group.');
        $gid = my_group_id($u['id']);
        if ($gid === null) {
            $pdo->prepare('INSERT INTO groups(leader_id, created) VALUES(?,?)')->execute([$u['id'], time()]);
            $gid = (int)$pdo->lastInsertId();
            $pdo->prepare('INSERT INTO group_members(user_id, group_id, joined) VALUES(?,?,?)')->execute([$u['id'], $gid, time()]);
        }
        if (count(group_member_ids($gid)) >= GROUP_MAX_PLAYERS) fail('A group holds at most ' . GROUP_MAX_PLAYERS . ' players.');
        $d = $pdo->prepare('SELECT 1 FROM invites WHERE to_id = ? AND group_id = ?');
        $d->execute([$tu['id'], $gid]);
        if (!$d->fetch()) {
            $pdo->prepare('INSERT INTO invites(from_id, from_name, to_id, group_id, ts) VALUES(?,?,?,?,?)')
                ->execute([$u['id'], $u['pname'], $tu['id'], $gid, time()]);
        }
        out(['ok' => true, 'msg' => 'Invitation sent to ' . $tu['shown'] . '.']);
    } elseif ($act === 'reply') {
        $id = in_int($b, 'id');
        $accept = !empty($b['accept']);
        $st = $pdo->prepare('SELECT * FROM invites WHERE id = ? AND to_id = ?');
        $st->execute([$id, $u['id']]);
        $inv = $st->fetch();
        if (!$inv) fail('That invitation has expired.');
        $pdo->prepare('DELETE FROM invites WHERE id = ?')->execute([$id]);
        if (!$accept) { push_event((int)$inv['from_id'], 'group', ['msg' => $u['pname'] . ' declined your invitation.']); out(['ok' => true]); }
        $gid = (int)$inv['group_id'];
        $ex = $pdo->prepare('SELECT 1 FROM groups WHERE id = ?');
        $ex->execute([$gid]);
        if (!$ex->fetch()) fail('That group no longer exists.');
        if (my_group_id($u['id']) !== null) fail('Leave your current group first.');
        if (count(group_member_ids($gid)) >= GROUP_MAX_PLAYERS) fail('That group is full.');
        $pdo->prepare('INSERT INTO group_members(user_id, group_id, joined) VALUES(?,?,?)')->execute([$u['id'], $gid, time()]);
        foreach (group_member_ids($gid) as $mid) if ($mid !== $u['id']) push_event($mid, 'group', ['msg' => $u['pname'] . ' joined the group.']);
        out(['ok' => true, 'msg' => 'You joined the group.']);
    } elseif ($act === 'leave') {
        leave_group($u['id']);
        out(['ok' => true, 'msg' => 'You left the group.']);
    } elseif ($act === 'kick') {
        $gid = my_group_id($u['id']);
        if ($gid === null) fail('You are not in a group.');
        $g = $pdo->prepare('SELECT leader_id FROM groups WHERE id = ?');
        $g->execute([$gid]);
        if ((int)$g->fetchColumn() !== $u['id']) fail('Only the group leader can remove players.');
        $tid = in_int($b, 'id');
        if ($tid === $u['id'] || my_group_id($tid) !== $gid) fail('That player is not in your group.');
        leave_group($tid);
        push_event($tid, 'group', ['msg' => 'You were removed from the group.']);
        out(['ok' => true]);
    }
    fail('Unknown group action.');
}

// field magic: a healer/bard outside battle helps a group member who stands nearby
function do_assist(): void {
    $u = current_user();
    $b = json_body();
    $tid = in_int($b, 'to');
    $gid = my_group_id($u['id']);
    if ($gid === null || my_group_id($tid) !== $gid) fail('That player is not in your group.');
    $kind = in_str($b, 'kind', 12);
    if (!in_array($kind, ['heal', 'cure', 'revive', 'song', 'food'], true)) fail('Unknown assist.');
    $data = ['from' => $u['pname'], 'kind' => $kind, 'amount' => max(0, min(500, in_int($b, 'amount'))), 'text' => in_str($b, 'text', 120), 'hero' => max(0, min(3, in_int($b, 'hero', -1)))];
    $data['pct'] = max(0, min(100, in_int($b, 'pct')));
    push_event($tid, 'assist', $data);
    out(['ok' => true]);
}

// ---------------------------------------------------------------- game masters
// /gm switches GM mode on and off, /teleport <character> jumps next to a character. Only characters with the GM flag
// (set on the administrator page) may use them; everybody else is told the command does not exist.
function do_gm(): void {
    $u = current_user();
    $cid = require_char($u);
    if (empty($u['gm'])) fail('Unknown command. Try /help.', 403);
    $b = json_body();
    $cmd = in_str($b, 'cmd', 12);
    $pdo = db();
    if ($cmd === 'toggle') {
        $on = empty($u['gmOn']);
        $pdo->prepare('UPDATE characters SET gm_on = ? WHERE id = ?')->execute([$on ? 1 : 0, $cid]);
        $st = $pdo->prepare('SELECT name FROM characters WHERE id = ?');
        $st->execute([$cid]);
        $pdo->prepare('UPDATE presence SET name = ? WHERE user_id = ?')->execute([($on ? GM_PREFIX : '') . $st->fetchColumn(), $u['id']]);
        out(['ok' => true, 'gmOn' => $on, 'msg' => $on ? 'GM mode is ON: thou art invulnerable and appearest as a GM.' : 'GM mode is OFF.']);
    }
    if ($cmd === 'teleport') {
        if (empty($u['gmOn'])) fail('Switch GM mode on with /gm first.');
        $name = trim(in_str($b, 'name', 40));
        if ($name === '') fail('Usage: /teleport character_name');
        $st = $pdo->prepare('SELECT user_id, name, mode, scene, loc, x, y, ship FROM presence
            WHERE updated >= :cut AND user_id <> :me AND scene <> \'\' AND (lower(name) = lower(:n) OR lower(name) = lower(:g))');
        $st->execute([':cut' => time() - ONLINE_TTL, ':me' => $u['id'], ':n' => $name, ':g' => GM_PREFIX . $name]);
        $t = $st->fetch();
        if (!$t) fail("No character called \"$name\" is online.");
        out(['ok' => true, 'target' => ['name' => $t['name'], 'scene' => $t['scene'], 'x' => (int)$t['x'], 'y' => (int)$t['y'], 'ship' => (int)$t['ship'] > 0]]);
    }
    fail('Unknown command. Try /help.');
}
