<?php
// The friends list: a private list of other players, shown with their character, level and where they are.
// It is one-way (like a contact list): the other player is not asked and does not see who lists them.

require_once __DIR__ . '/social.php';

const FRIENDS_MAX = 60;

function do_friend(): void {
    $u = current_user();
    $b = json_body();
    $act = in_str($b, 'act', 10);
    $pdo = db();
    if ($act === 'add') {
        $name = trim(in_str($b, 'name', 40));
        if ($name === '') fail('Whose name?');
        $f = find_player($name, false);
        if (!$f) {            // a character that is not online: look it up among the stored characters
            $st = $pdo->prepare('SELECT u.id, u.name AS uname, c.name AS shown FROM characters c JOIN users u ON u.id = c.user_id WHERE lower(c.name) = lower(?) ORDER BY c.updated DESC LIMIT 1');
            $st->execute([$name]);
            $f = $st->fetch() ?: null;
        }
        if (!$f) fail("No player or character called \"$name\".");
        if ((int)$f['id'] === $u['id']) fail('That is thee.');
        $n = $pdo->prepare('SELECT COUNT(*) FROM friends WHERE user_id = ?');
        $n->execute([$u['id']]);
        if ((int)$n->fetchColumn() >= FRIENDS_MAX) fail('The friends list is full (' . FRIENDS_MAX . ').');
        $pdo->prepare('INSERT OR IGNORE INTO friends(user_id, friend_id, created) VALUES(?,?,?)')->execute([$u['id'], $f['id'], time()]);
        out(['ok' => true, 'msg' => $f['shown'] . ' is now on thy friends list.']);
    } elseif ($act === 'remove') {
        $id = in_int($b, 'id');
        if ($id === 0) {      // by name
            $f = find_player(trim(in_str($b, 'name', 40)), false);
            $id = $f ? (int)$f['id'] : 0;
        }
        $pdo->prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')->execute([$u['id'], $id]);
        out(['ok' => true, 'msg' => 'Removed from thy friends list.']);
    }
    fail('Unknown friends action.');
}

// every poll: the friends, online ones first
function section_friends(array $u): array {
    $st = db()->prepare("SELECT f.friend_id AS id, usr.name AS uname, p.name AS pname, p.cls, p.lvl, p.mode, p.loc, p.idle, p.battle_id,
            (p.updated >= :cut) AS online,
            (SELECT c.name FROM characters c WHERE c.user_id = f.friend_id ORDER BY c.updated DESC LIMIT 1) AS lastchar,
            (SELECT c.cls FROM characters c WHERE c.user_id = f.friend_id ORDER BY c.updated DESC LIMIT 1) AS lastcls,
            (SELECT c.lvl FROM characters c WHERE c.user_id = f.friend_id ORDER BY c.updated DESC LIMIT 1) AS lastlvl
        FROM friends f JOIN users usr ON usr.id = f.friend_id LEFT JOIN presence p ON p.user_id = f.friend_id
        WHERE f.user_id = :me ORDER BY online DESC, usr.name LIMIT " . FRIENDS_MAX);
    $st->execute([':cut' => time() - ONLINE_TTL, ':me' => $u['id']]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $on = (int)$r['online'] === 1;
        $out[] = [
            'id' => (int)$r['id'], 'online' => $on,
            'name' => $on && $r['pname'] ? $r['pname'] : ($r['lastchar'] ?: $r['uname']),
            'cls' => $on ? $r['cls'] : $r['lastcls'], 'lvl' => (int)($on ? $r['lvl'] : $r['lastlvl']),
            'mode' => $on ? $r['mode'] : null, 'loc' => $on ? $r['loc'] : null,
            'afk' => $on && (int)($r['idle'] ?? 0) >= AFK_AFTER, 'battle' => $on && $r['battle_id'] ? true : false,
        ];
    }
    return $out;
}
