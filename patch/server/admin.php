<?php
// Administrator backend: accounts, characters, world reset.
//
// The administrator signs in on /admin.html with ONE password that is not tied to a player account. Set it with
//     php server/admin-cli.php passwd            (asks for it)
// or by starting the server with the environment variable SGL_ADMIN_PASSWORD.

require_once __DIR__ . '/accounts.php';
require_once __DIR__ . '/social.php';
require_once __DIR__ . '/battle.php';

const ADMIN_TTL = 8 * 3600;

function admin_password_is_set(): bool { return getenv('SGL_ADMIN_PASSWORD') || kv_get('admin_hash') !== null; }

function admin_verify(string $pw): bool {
    $env = getenv('SGL_ADMIN_PASSWORD');
    if ($env !== false && $env !== '' && hash_equals($env, $pw)) return true;
    $h = kv_get('admin_hash');
    return $h !== null && password_verify($pw, $h);
}

function admin_require(): void {
    $tok = $_SERVER['HTTP_X_SGL_ADMIN'] ?? '';
    if (!is_string($tok) || strlen($tok) < 20 || strlen($tok) > 100) fail('Administrator login required.', 401, ['admin' => true]);
    $pdo = db();
    $pdo->prepare('DELETE FROM admin_sessions WHERE exp < ?')->execute([time()]);
    $st = $pdo->prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ?');
    $st->execute([hash('sha256', $tok)]);
    if (!$st->fetch()) fail('Administrator session expired.', 401, ['admin' => true]);
}

function do_admin_login(): void {
    if (!admin_password_is_set()) fail('No administrator password is set yet. Run:  php server/admin-cli.php passwd', 403);
    $pw = in_str(json_body(), 'password', 300);
    if (!admin_verify($pw)) { usleep(600000); fail('Wrong administrator password.', 403); }
    $tok = bin2hex(random_bytes(24));
    db()->prepare('INSERT INTO admin_sessions(token_hash, exp) VALUES(?,?)')->execute([hash('sha256', $tok), time() + ADMIN_TTL]);
    out(['ok' => true, 'token' => $tok]);
}

function do_admin_logout(): void {
    $tok = $_SERVER['HTTP_X_SGL_ADMIN'] ?? '';
    if (is_string($tok) && $tok !== '') db()->prepare('DELETE FROM admin_sessions WHERE token_hash = ?')->execute([hash('sha256', $tok)]);
    out(['ok' => true]);
}

function do_admin_overview(): void {
    admin_require();
    $pdo = db();
    $n = fn(string $sql, array $a = []) => (function () use ($pdo, $sql, $a) { $s = $pdo->prepare($sql); $s->execute($a); return (int)$s->fetchColumn(); })();
    $w = world_info();
    out(['ok' => true,
        'accounts' => $n('SELECT COUNT(*) FROM users'), 'characters' => $n('SELECT COUNT(*) FROM characters'),
        'online' => $n('SELECT COUNT(*) FROM presence WHERE updated >= ?', [time() - ONLINE_TTL]),
        'battles' => $n("SELECT COUNT(*) FROM battles WHERE status = 'active'"), 'groups' => $n('SELECT COUNT(*) FROM groups'),
        'turn' => $w['turn'], 'turnMs' => $w['turnMs'], 'epoch' => $w['epoch'], 'weather' => $w['weather']['kind'],
        'day' => intdiv($w['turn'] + 8, 24) + 1, 'hour' => ($w['turn'] + 8) % 24,
        'spawned' => admin_spawn_stats(),
        'dbBytes' => @filesize(DB_PATH) ?: 0, 'maintenance' => maintenance_on(), 'maintLeft' => maintenance_left(),
    ]);
}

function do_admin_maintenance(): void {
    admin_require();
    $b = json_body();
    $on = !empty($b['on']);
    $was = maintenance_on();
    kv_set('maintenance', $on ? '1' : '0');
    if ($on && !$was) kv_set('maintenance_at', (string)(time() + 30));       // a 30 second warning for everybody online
    out(['ok' => true, 'maintenance' => $on, 'msg' => $on ? ($was ? 'Maintenance mode is already on.' : 'Maintenance mode is ON: players have been warned and are logged out in 30 seconds; nobody new can log in.') : 'Maintenance mode is OFF: the realm is open again.']);
}

function do_admin_users(): void {
    admin_require();
    $q = '%' . str_replace(['%', '_'], ['\\%', '\\_'], in_str(json_body(), 'q', 40)) . '%';
    $st = db()->prepare("SELECT u.id, u.name, u.banned, u.created, u.last_seen,
            (SELECT COUNT(*) FROM characters c WHERE c.user_id = u.id) AS chars,
            (SELECT COUNT(*) FROM presence p WHERE p.user_id = u.id AND p.updated >= :cut) AS online
        FROM users u WHERE u.name LIKE :q ESCAPE '\\' ORDER BY u.id LIMIT 500");
    $st->execute([':q' => $q, ':cut' => time() - ONLINE_TTL]);
    out(['ok' => true, 'users' => array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'created' => (int)$r['created'],
        'lastSeen' => (int)$r['last_seen'], 'banned' => (int)$r['banned'] > 0, 'chars' => (int)$r['chars'], 'online' => (int)$r['online'] > 0], $st->fetchAll())]);
}

function do_admin_user_update(): void {
    admin_require();
    $b = json_body();
    $id = in_int($b, 'id');
    $pdo = db();
    $st = $pdo->prepare('SELECT id, name FROM users WHERE id = ?');
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) fail('No such account.', 404);
    $msgs = [];
    $name = trim(in_str($b, 'name', 40));
    if ($name !== '' && $name !== $u['name']) {
        if (!preg_match(NAME_RE, $name)) fail('Account names are 3-16 letters, digits, "_" or "-".');
        $dup = $pdo->prepare('SELECT id FROM users WHERE name = ? AND id <> ?');
        $dup->execute([$name, $id]);
        if ($dup->fetch()) fail('That name is already taken.');
        $pdo->prepare('UPDATE users SET name = ? WHERE id = ?')->execute([$name, $id]);
        $pdo->prepare('UPDATE presence SET name = ? WHERE user_id = ?')->execute([$name, $id]);
        $msgs[] = "renamed to $name";
    }
    $pass = in_str($b, 'password', 200);
    if ($pass !== '') {
        if (strlen($pass) < 6) fail('The password needs at least 6 characters.');
        $pdo->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $id]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);   // signs them out everywhere
        $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$id]);
        $msgs[] = 'password changed (the player was signed out)';
    }
    out(['ok' => true, 'msg' => $msgs ? ucfirst(implode(', ', $msgs)) . '.' : 'Nothing changed.']);
}

function do_admin_kick(): void {
    admin_require();
    $id = in_int(json_body(), 'id');
    $pdo = db();
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$id]);
    out(['ok' => true, 'msg' => 'Player signed out.']);
}

function do_admin_user_delete(): void {
    admin_require();
    $id = in_int(json_body(), 'id');
    $pdo = db();
    leave_group($id);
    foreach (['characters', 'sessions', 'presence', 'saves', 'events', 'invites'] as $t) {
        $col = $t === 'invites' ? 'to_id' : 'user_id';
        $pdo->prepare("DELETE FROM $t WHERE $col = ?")->execute([$id]);
    }
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    out(['ok' => true, 'msg' => 'Account and all its characters deleted.']);
}

function do_admin_chars(): void {
    admin_require();
    $b = json_body();
    $uid = in_int($b, 'user');
    $sql = 'SELECT c.id, c.user_id, u.name AS account, c.name, c.race, c.cls, c.lvl, c.updated, c.created, c.gm, json_extract(c.data, \'$.gold\') AS gold
            FROM characters c JOIN users u ON u.id = c.user_id' . ($uid ? ' WHERE c.user_id = ?' : '') . ' ORDER BY u.name, c.id LIMIT 1000';
    $st = db()->prepare($sql);
    $st->execute($uid ? [$uid] : []);
    out(['ok' => true, 'chars' => array_map(fn($r) => ['id' => (int)$r['id'], 'userId' => (int)$r['user_id'], 'account' => $r['account'], 'name' => $r['name'],
        'race' => $r['race'], 'cls' => $r['cls'], 'lvl' => (int)$r['lvl'], 'gold' => (int)$r['gold'], 'gm' => (int)$r['gm'] > 0, 'updated' => (int)$r['updated'], 'created' => (int)$r['created']], $st->fetchAll())]);
}

function do_admin_char_inspect(): void {
    admin_require();
    $id = in_int(json_body(), 'id');
    $pdo = db();
    $st = $pdo->prepare('SELECT c.id, c.user_id, u.name AS account, u.banned, u.last_seen, u.created AS user_created,
                                c.name, c.race, c.cls, c.lvl, c.look, c.data, c.created, c.updated, c.gm, c.gm_on
                         FROM characters c
                         JOIN users u ON u.id = c.user_id
                         WHERE c.id = ?');
    $st->execute([$id]);
    $c = $st->fetch(PDO::FETCH_ASSOC);
    if (!$c) fail('No such character.', 404);

    $data = json_decode($c['data'] ?? '', true);
    if (!is_array($data)) $data = [];

    $look = !empty($c['look']) ? json_decode($c['look'], true) : null;

    $pst = $pdo->prepare('SELECT * FROM presence WHERE user_id = ?');
    $pst->execute([(int)$c['user_id']]);
    $p = $pst->fetch(PDO::FETCH_ASSOC);

    $isOnline = false;
    $presenceInfo = null;
    if ($p && (int)$p['updated'] >= time() - ONLINE_TTL) {
        $isOnline = true;
        $presenceInfo = [
            'mode' => $p['mode'],
            'scene' => $p['scene'],
            'loc' => $p['loc'],
            'x' => (int)$p['x'],
            'y' => (int)$p['y'],
            'hp' => (int)$p['hp'],
            'mhp' => (int)$p['mhp'],
            'rest' => (int)$p['rest'] > 0,
            'ship' => (int)$p['ship'] > 0,
            'aboard' => (int)$p['aboard'] > 0,
            'battleId' => $p['battle_id'] ? (int)$p['battle_id'] : null,
            'idle' => (int)$p['idle'] > 0,
            'pet' => $p['pet'],
            'updated' => (int)$p['updated'],
        ];
    }

    out([
        'ok' => true,
        'char' => [
            'id' => (int)$c['id'],
            'userId' => (int)$c['user_id'],
            'account' => $c['account'],
            'accountBanned' => (int)$c['banned'] > 0,
            'lastSeen' => (int)$c['last_seen'],
            'userCreated' => (int)$c['user_created'],
            'name' => $c['name'],
            'race' => $c['race'],
            'cls' => $c['cls'],
            'lvl' => (int)$c['lvl'],
            'gm' => (int)$c['gm'] > 0,
            'gmOn' => (int)$c['gm_on'] > 0,
            'created' => (int)$c['created'],
            'updated' => (int)$c['updated'],
            'online' => $isOnline,
            'presence' => $presenceInfo,
            'look' => $look,
            'data' => $data,
        ],
    ]);
}

function do_admin_char_home(): void {
    admin_require();
    $id = in_int(json_body(), 'id');
    $pdo = db();
    $st = $pdo->prepare('SELECT user_id, name, data FROM characters WHERE id = ?');
    $st->execute([$id]);
    $c = $st->fetch(PDO::FETCH_ASSOC);
    if (!$c) fail('No such character.', 404);
    $d = json_decode($c['data'] ?? '', true);
    if (!is_array($d)) fail('Character save data is corrupt.');
    $uid = (int)$c['user_id'];
    leave_any_battle($uid);
    $d['mode'] = 'OVERWORLD';
    $d['ox'] = 1250;
    $d['oy'] = 266;
    $d['ww'] = OW_WIDTH;
    $d['inShip'] = false;
    $d['expRL'] = [];
    $pdo->prepare('UPDATE characters SET data = ? WHERE id = ?')->execute([json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
    $pdo->prepare('UPDATE sessions SET char_id = NULL WHERE char_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$uid]);
    out(['ok' => true, 'msg' => "Character {$c['name']} sent to Castle Stargazer gates."]);
}

function do_admin_char_delete(): void {
    admin_require();
    $id = in_int(json_body(), 'id');
    $st = db()->prepare('SELECT name FROM characters WHERE id = ?');
    $st->execute([$id]);
    $n = $st->fetchColumn();
    if ($n === false) fail('No such character.', 404);
    delete_character($id);
    out(['ok' => true, 'msg' => "Character $n deleted."]);
}

// Wipes the shared world. Always: clock back to day 1 08:00, clear sky, no chat/groups/battles/invites/presence, and every
// player is sent back to the character-selection screen. Optionally the characters themselves are sent home or deleted.
function do_admin_world_reset(): void {
    admin_require();
    $b = json_body();
    if (in_str($b, 'confirm', 20) !== 'RESET') fail('Type RESET to confirm.');
    $chars = in_str($b, 'chars', 10);          // keep | home | delete
    $accounts = !empty($b['accounts']);
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        foreach (['chat', 'groups', 'group_members', 'invites', 'events', 'battles', 'battle_players', 'intents', 'presence', 'roamers'] as $t) $pdo->exec("DELETE FROM $t");
        kv_set('epoch', (string)now_ms());
        $pdo->exec("DELETE FROM world WHERE k = 'roam_last'");
        $pdo->exec("DELETE FROM world WHERE k = 'weather'");
        $pdo->exec("DELETE FROM world WHERE k = 'camps_looted'");
        $touched = 0;
        if ($accounts) {
            foreach (['characters', 'saves', 'sessions', 'users', 'reg_times'] as $t) $pdo->exec("DELETE FROM $t");
        } elseif ($chars === 'delete') {
            $pdo->exec('DELETE FROM characters');
            $pdo->exec('UPDATE sessions SET char_id = NULL');
        } else {
            $pdo->exec('UPDATE sessions SET char_id = NULL');
            if ($chars === 'home') {
                foreach ($pdo->query('SELECT id, data FROM characters')->fetchAll() as $r) {
                    $d = json_decode($r['data'], true);
                    if (!is_array($d)) continue;
                    $d['mode'] = 'OVERWORLD'; $d['ox'] = 1250; $d['oy'] = 266; $d['ww'] = OW_WIDTH; $d['inShip'] = false; $d['expRL'] = [];
                    $pdo->prepare('UPDATE characters SET data = ? WHERE id = ?')->execute([json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $r['id']]);
                    $touched++;
                }
            }
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->exec('ROLLBACK');
        throw $e;
    }
    out(['ok' => true, 'msg' => 'The world has been reset.' . ($accounts ? ' All accounts were deleted.' : ($chars === 'delete' ? ' All characters were deleted.' : ($chars === 'home' ? " $touched characters were sent home." : '')))]);
}

// Banned accounts cannot log in; banning also signs the player out at once.
function do_admin_ban(): void {
    admin_require();
    $b = json_body();
    $id = in_int($b, 'id');
    $ban = !empty($b['ban']);
    $pdo = db();
    $st = $pdo->prepare('SELECT name FROM users WHERE id = ?');
    $st->execute([$id]);
    $n = $st->fetchColumn();
    if ($n === false) fail('No such account.', 404);
    $pdo->prepare('UPDATE users SET banned = ? WHERE id = ?')->execute([$ban ? 1 : 0, $id]);
    if ($ban) {
        leave_any_battle($id);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$id]);
    }
    out(['ok' => true, 'msg' => $ban ? "Account $n banned and signed out." : "Account $n unbanned."]);
}

// Renames a character (stored both in the characters table and inside its save). Whoever is playing it is sent back to the
// selection screen, otherwise the client's next save would restore the old name.
function do_admin_char_rename(): void {
    admin_require();
    $b = json_body();
    $id = in_int($b, 'id');
    $name = trim(in_str($b, 'name', 60));
    if ($name === '' || mb_strlen($name) > 20 || preg_match('/[<>&"\'`\\\\]/u', $name)) fail('Character names are 1-20 characters without < > & " \' ` \\.');
    $pdo = db();
    $st = $pdo->prepare('SELECT user_id, name, data FROM characters WHERE id = ?');
    $st->execute([$id]);
    $c = $st->fetch();
    if (!$c) fail('No such character.', 404);
    $d = json_decode($c['data'], true);
    if (!is_array($d) || !isset($d['party'][0]) || !is_array($d['party'][0])) fail('That character\'s save is damaged.');
    $uid = (int)$c['user_id'];
    leave_any_battle($uid);
    $d['party'][0]['name'] = $name;
    $pdo->prepare('UPDATE characters SET name = ?, data = ? WHERE id = ?')->execute([$name, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
    $pdo->prepare('UPDATE sessions SET char_id = NULL WHERE char_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$uid]);
    out(['ok' => true, 'msg' => "Character {$c['name']} renamed to $name."]);
}

function do_admin_purge_bags(): void {
    admin_require();
    $pdo = db();
    $n = (int)$pdo->query('SELECT COUNT(*) FROM lootbags')->fetchColumn();
    $pdo->exec('DELETE FROM lootbags');
    out(['ok' => true, 'msg' => "Purged $n loot bag" . ($n === 1 ? '' : 's') . '.']);
}

// Gives or takes the GM flag of a character. Taking it also switches GM mode off.
function do_admin_char_gm(): void {
    admin_require();
    $b = json_body();
    $id = in_int($b, 'id');
    $gm = !empty($b['gm']);
    $pdo = db();
    $st = $pdo->prepare('SELECT name, user_id FROM characters WHERE id = ?');
    $st->execute([$id]);
    $c = $st->fetch();
    if (!$c) fail('No such character.', 404);
    $pdo->prepare('UPDATE characters SET gm = ?, gm_on = 0 WHERE id = ?')->execute([$gm ? 1 : 0, $id]);
    $pdo->prepare('UPDATE presence SET name = ? WHERE user_id = ?')->execute([$c['name'], (int)$c['user_id']]);
    out(['ok' => true, 'msg' => $gm ? "{$c['name']} is now a Gamemaster (they switch GM mode with /gm)." : "{$c['name']} is no longer a Gamemaster."]);
}

// Sets the weather right now. Rain and storms last `hours` game hours, then the normal weather chain carries on from there.
function do_admin_weather(): void {
    admin_require();
    $b = json_body();
    $kind = in_str($b, 'kind', 10);
    if (!in_array($kind, ['clear', 'rain', 'storm'], true)) fail('Unknown weather.');
    $hours = $kind === 'clear' ? 0 : max(1, min(48, in_int($b, 'hours', 6)));
    world_weather(world_turn());          // bring the stored weather up to the current hour first
    kv_set('weather', json_encode(['turn' => world_turn(), 'kind' => $kind, 'left' => $hours]));
    out(['ok' => true, 'weather' => $kind, 'msg' => $kind === 'clear' ? 'The sky is clear.' : ucfirst($kind) . " for $hours game hour" . ($hours === 1 ? '' : 's') . '.']);
}
