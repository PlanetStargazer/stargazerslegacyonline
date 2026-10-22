<?php
// Shared helpers: database, JSON I/O, authentication.

require_once __DIR__ . '/config.php';

// mbstring is normally present; these fallbacks keep the server working without it
if (!function_exists('mb_substr')) { function mb_substr(string $s, int $start, ?int $len = null): string { return $len === null ? (string)substr($s, $start) : (string)substr($s, $start, $len); } }
if (!function_exists('mb_strlen')) { function mb_strlen(string $s): int { return strlen($s); } }

function now_ms(): int { return (int)floor(microtime(true) * 1000); }

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = dirname(DB_PATH);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $fresh = !file_exists(DB_PATH);
    $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA busy_timeout=8000');
    $pdo->exec('PRAGMA synchronous=NORMAL');
    $pdo->exec('PRAGMA foreign_keys=OFF');
    init_schema($pdo);
    return $pdo;
}

const GM_PREFIX = '[GM] ';

function init_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        pass_hash TEXT NOT NULL,
        created INTEGER NOT NULL,
        last_seen INTEGER NOT NULL DEFAULT 0)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS sessions(
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        exp INTEGER NOT NULL)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS saves(
        user_id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        updated INTEGER NOT NULL)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS presence(
        user_id INTEGER PRIMARY KEY,
        name TEXT, mode TEXT, scene TEXT, loc TEXT, x INTEGER, y INTEGER,
        cls TEXT, race TEXT, lvl INTEGER, ship INTEGER DEFAULT 0, rest INTEGER DEFAULT 0,
        battle_id INTEGER, hp INTEGER DEFAULT 0, mhp INTEGER DEFAULT 0, heroes TEXT,
        updated INTEGER NOT NULL DEFAULT 0)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, ch TEXT, from_id INTEGER, from_name TEXT, to_id INTEGER, to_name TEXT,
        group_id INTEGER, scene TEXT, x INTEGER, y INTEGER, text TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS groups(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leader_id INTEGER, created INTEGER)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS group_members(
        user_id INTEGER PRIMARY KEY,
        group_id INTEGER NOT NULL,
        joined INTEGER)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS gm_group ON group_members(group_id)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS invites(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER, from_name TEXT, to_id INTEGER, group_id INTEGER, ts INTEGER)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, ts INTEGER, kind TEXT, payload TEXT)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS ev_user ON events(user_id, id)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS battles(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_id INTEGER, host_name TEXT, mode TEXT, scene TEXT, loc TEXT, x INTEGER, y INTEGER,
        label TEXT, shape TEXT, foes INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active', created INTEGER, updated INTEGER,
        seq INTEGER DEFAULT 0, snapshot TEXT, result TEXT)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS battles_status ON battles(status)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS battle_players(
        battle_id INTEGER, user_id INTEGER, name TEXT, joined INTEGER, seen INTEGER, left_at INTEGER,
        PRIMARY KEY(battle_id, user_id))");
    $pdo->exec("CREATE TABLE IF NOT EXISTS intents(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        battle_id INTEGER, user_id INTEGER, ts INTEGER, kind TEXT, payload TEXT)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS intents_battle ON intents(battle_id, id)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS world(k TEXT PRIMARY KEY, v TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS friends(
        user_id INTEGER NOT NULL, friend_id INTEGER NOT NULL, created INTEGER,
        PRIMARY KEY(user_id, friend_id))");
    $pdo->exec("CREATE TABLE IF NOT EXISTS roamers(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        x INTEGER NOT NULL, y INTEGER NOT NULL, tier INTEGER NOT NULL, created INTEGER)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS lootbags(
        id INTEGER PRIMARY KEY AUTOINCREMENT, x INTEGER NOT NULL, y INTEGER NOT NULL, items TEXT NOT NULL, created INTEGER NOT NULL)");
    $rc = array_column($pdo->query('PRAGMA table_info(roamers)')->fetchAll(), 'name');
    if (!in_array('kind', $rc, true)) $pdo->exec('ALTER TABLE roamers ADD COLUMN kind INTEGER DEFAULT 0');
    if (!in_array('lair', $rc, true)) $pdo->exec('ALTER TABLE roamers ADD COLUMN lair INTEGER DEFAULT -1');
    $pdo->exec("DROP TABLE IF EXISTS reg_log");   // older versions stored addresses here; nothing identifying is kept any more
    $pdo->exec("CREATE TABLE IF NOT EXISTS reg_times(ts INTEGER)");
    // characters: up to MAX_CHARACTERS per account; `look` is a small JSON used for the selection screen
    $pdo->exec("CREATE TABLE IF NOT EXISTS characters(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT, race TEXT, cls TEXT, lvl INTEGER DEFAULT 1, look TEXT,
        data TEXT NOT NULL,
        created INTEGER NOT NULL, updated INTEGER NOT NULL)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS chars_user ON characters(user_id)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY, exp INTEGER NOT NULL)");
    $ucols = array_column($pdo->query('PRAGMA table_info(users)')->fetchAll(), 'name');
    if (!in_array('banned', $ucols, true)) $pdo->exec('ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0');
    $ccols = array_column($pdo->query('PRAGMA table_info(characters)')->fetchAll(), 'name');
    if (!in_array('gm', $ccols, true)) $pdo->exec('ALTER TABLE characters ADD COLUMN gm INTEGER NOT NULL DEFAULT 0');         // may use the GM commands
    if (!in_array('gm_on', $ccols, true)) $pdo->exec('ALTER TABLE characters ADD COLUMN gm_on INTEGER NOT NULL DEFAULT 0');   // GM mode switched on with /gm
    $scols = array_column($pdo->query('PRAGMA table_info(sessions)')->fetchAll(), 'name');
    if (!in_array('char_id', $scols, true)) $pdo->exec('ALTER TABLE sessions ADD COLUMN char_id INTEGER');
    // one-time migration of the old one-save-per-account table into characters (never again: once the old saves are
    // copied they are removed, otherwise deleting all of an account's heroes would bring the old one back)
    if (!$pdo->query("SELECT 1 FROM world WHERE k = 'saves_migrated'")->fetchColumn()) {
        $old = $pdo->query("SELECT user_id, data, updated FROM saves WHERE user_id NOT IN (SELECT user_id FROM characters)")->fetchAll();
        foreach ($old as $o) {
            $d = json_decode($o['data'], true);
            if (!is_array($d) || empty($d['party'][0])) continue;
            $d['party'] = [$d['party'][0]];
            insert_character($pdo, (int)$o['user_id'], $d, (int)$o['updated']);
        }
        $pdo->exec('DELETE FROM saves');
        $pdo->exec("INSERT OR IGNORE INTO world(k, v) VALUES('saves_migrated', '1')");
    }
    // upgrade older databases: how a player's hero looks (gender, hair, gear) is shown to others
    $cols = array_column($pdo->query('PRAGMA table_info(presence)')->fetchAll(), 'name');
    if (!in_array('look', $cols, true)) $pdo->exec('ALTER TABLE presence ADD COLUMN look TEXT');
    if (!in_array('idle', $cols, true)) $pdo->exec('ALTER TABLE presence ADD COLUMN idle INTEGER DEFAULT 0');
    if (!in_array('pet', $cols, true)) $pdo->exec('ALTER TABLE presence ADD COLUMN pet TEXT');
    if (!in_array('los', $cols, true)) $pdo->exec('ALTER TABLE presence ADD COLUMN los INTEGER DEFAULT 5');
    if (!in_array('sname', $cols, true)) $pdo->exec('ALTER TABLE presence ADD COLUMN sname TEXT');
    if (!in_array('aboard', $cols, true)) $pdo->exec('ALTER TABLE presence ADD COLUMN aboard INTEGER DEFAULT 0');
}

// ---------------------------------------------------------------- JSON in / out
function json_body(): array {
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return $body = [];
    if (strlen($raw) > MAX_SAVE_BYTES + 100000) fail('Request too large.', 413);
    $d = json_decode($raw, true);
    return $body = (is_array($d) ? $d : []);
}

function out(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(string $msg, int $code = 400, array $extra = []): void {
    out(array_merge(['ok' => false, 'error' => $msg], $extra), $code);
}

function in_str(array $a, string $k, int $max = 200): string {
    $v = isset($a[$k]) && (is_string($a[$k]) || is_numeric($a[$k])) ? (string)$a[$k] : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
}

function in_int(array $a, string $k, int $def = 0): int {
    return isset($a[$k]) && is_numeric($a[$k]) ? (int)$a[$k] : $def;
}

// ---------------------------------------------------------------- authentication
const NAME_RE = '/^[A-Za-z0-9_-]{3,16}$/';

function new_session(int $uid): string {
    $pdo = db();
    $token = bin2hex(random_bytes(24));
    // one login per account: a new login replaces the old session (prevents the same party being played twice)
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$uid]);
    $pdo->prepare('INSERT INTO sessions(token_hash, user_id, exp) VALUES(?,?,?)')
        ->execute([hash('sha256', $token), $uid, time() + SESSION_TTL]);
    return $token;
}

// the few fields of a save that the character-selection screen needs
function char_summary_fields(array $d): array {
    $h = $d['party'][0] ?? [];
    $rar = fn($m) => is_array($m) ? ((!empty($m['pre']) && !empty($m['suf'])) ? 2 : 1) : 0;
    $look = [
        'g' => (($h['gender'] ?? '') === 'F') ? 'F' : 'M',
        'hair' => (isset($h['hair']) && preg_match('/^#[0-9a-fA-F]{6}$/', (string)$h['hair'])) ? $h['hair'] : '#6b4226',
        'beard' => $h['beard'] ?? 'none', 'hs' => in_array($h['hairStyle'] ?? '', HAIR_STYLES_OK, true) ? $h['hairStyle'] : (($h['gender'] ?? '') === 'F' ? 'long' : 'short'), 'hh' => !empty($h['hideHelm']), 'ps' => !empty($h['poisoned']), 'nw' => (($h['weaponIdx'] ?? 0) < 0 && !is_array($h['wMag'] ?? null)), 'nc' => (($h['armorIdx'] ?? 0) < 0 && !is_array($h['aMag'] ?? null)), 'kw' => true,
        'w' => (int)(is_array($h['wMag'] ?? null) ? ($h['wMag']['b'] ?? 0) : max(0, (int)($h['weaponIdx'] ?? 0))),
        'a' => (int)(is_array($h['aMag'] ?? null) ? ($h['aMag']['b'] ?? 0) : max(0, (int)($h['armorIdx'] ?? 0))),
        'sh' => (int)(is_array($h['sMag'] ?? null) ? ($h['sMag']['b'] ?? -1) : (int)($h['shieldIdx'] ?? -1)),
        'wr' => $rar($h['wMag'] ?? null), 'ar' => $rar($h['aMag'] ?? null), 'sr' => $rar($h['sMag'] ?? null),
        'hd' => is_array($h['cosH'] ?? null) ? (int)($h['cosH']['b'] ?? -1) : (is_array($h['hMag'] ?? null) ? (int)($h['hMag']['b'] ?? -1) : (int)($h['headIdx'] ?? -1)),
    ];
    // the tailor's looks (visuals only) replace what is drawn
    foreach ([['cosW', 'w', 'w', 'wv', 'wr', 'nw'], ['cosA', 'a', 'a', 'av', 'ar', 'nc'], ['cosH', 'h', 'hd', null, null, null], ['cosS', 's', 'sh', 'sv', 'sr', null]] as [$ck, $kk, $lk, $vk, $rk, $nk]) {
        if (preg_match('/^' . $kk . ':(\d{1,2}):([0-6]):([0-2])$/', (string)($h[$ck] ?? ''), $mm)) {
            $look[$lk] = (int)$mm[1];
            if ($vk) { $look[$vk] = (int)$mm[2]; $look[$rk] = (int)$mm[3]; if ($nk) $look[$nk] = false; }
        }
    }
    return [mb_substr((string)($h['name'] ?? 'Hero'), 0, 20), (string)($h['race'] ?? 'Human'), (string)($h['cls'] ?? 'Fighter'), (int)($h['lvl'] ?? 1), json_encode($look)];
}

function insert_character(PDO $pdo, int $uid, array $data, ?int $created = null): int {
    [$n, $r, $c, $l, $look] = char_summary_fields($data);
    $pdo->prepare('INSERT INTO characters(user_id, name, race, cls, lvl, look, data, created, updated) VALUES(?,?,?,?,?,?,?,?,?)')
        ->execute([$uid, $n, $r, $c, $l, $look, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $created ?? time(), time()]);
    return (int)$pdo->lastInsertId();
}

function current_user(bool $required = true): ?array {
    $tok = $_SERVER['HTTP_X_SGL_TOKEN'] ?? '';
    if (!is_string($tok) || strlen($tok) < 20 || strlen($tok) > 100) {
        if ($required) fail('Not logged in.', 401, ['auth' => true]);
        return null;
    }
    if ($required && maintenance_closed() && empty($GLOBALS['SGL_ALLOW_IN_MAINT'])) fail('The realm is closed for maintenance.', 503, ['maintenance' => true]);
    $pdo = db();
    $st = $pdo->prepare('SELECT u.id, u.name, s.exp, s.char_id, u.banned, c.name AS cname, c.gm, c.gm_on FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN characters c ON c.id = s.char_id AND c.user_id = u.id WHERE s.token_hash = ?');
    $st->execute([hash('sha256', $tok)]);
    $u = $st->fetch();
    if (!$u || (int)$u['exp'] < time()) {
        if ($required) fail('Session expired or opened elsewhere. Please log in again.', 401, ['auth' => true]);
        return null;
    }
    if ((int)$u['banned']) {
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$u['id']]);
        $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$u['id']]);
        if ($required) fail('This account has been banned.', 401, ['auth' => true, 'banned' => true]);
        return null;
    }
    // name = the account; pname = what other players see (the name of the character being played)
    $pname = ($u['cname'] !== null && $u['cname'] !== '') ? $u['cname'] : $u['name'];
    $gm = (int)($u['gm'] ?? 0) > 0;
    $gmOn = $gm && (int)($u['gm_on'] ?? 0) > 0;
    if ($gmOn) $pname = GM_PREFIX . $pname;     // in GM mode everybody sees [GM] before the name
    return ['id' => (int)$u['id'], 'name' => $u['name'], 'pname' => $pname, 'char' => $u['char_id'] !== null ? (int)$u['char_id'] : null, 'gm' => $gm, 'gmOn' => $gmOn];
}

// the character this session is playing (must belong to the account and still exist)
function require_char(array $u): int {
    $cid = $u['char'] ?? null;
    if ($cid) {
        $st = db()->prepare('SELECT 1 FROM characters WHERE id = ? AND user_id = ?');
        $st->execute([$cid, $u['id']]);
        if ($st->fetch()) return (int)$cid;
    }
    fail('Pick a character first.', 409, ['needChar' => true]);
}

// Maintenance mode (set on the administrator page): nobody can log in, and sessions already open are turned away at the next request.
// The administrator switches it on with a 30 second warning: from then on nobody new can log in, and when the countdown ends
// every open session is turned away.
function maintenance_on(): bool { return kv_get('maintenance') === '1'; }
function maintenance_closed(): bool { return maintenance_on() && time() >= (int)(kv_get('maintenance_at') ?? 0); }
function maintenance_left(): ?int { return (maintenance_on() && !maintenance_closed()) ? max(0, (int)(kv_get('maintenance_at') ?? 0) - time()) : null; }

function kv_get(string $k): ?string {
    $st = db()->prepare('SELECT v FROM world WHERE k = ?');
    $st->execute([$k]);
    $r = $st->fetchColumn();
    return $r === false ? null : (string)$r;
}

function kv_set(string $k, string $v): void {
    db()->prepare('INSERT INTO world(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$k, $v]);
}
