<?php
// Registration, login and character saves.

require_once __DIR__ . '/world.php';

const RACES_OK = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Automaton'];
const CLASSES_OK = ['Fighter', 'Paladin', 'Ranger', 'Rogue', 'Cleric', 'Wizard', 'Bard', 'Tinker'];
const MAX_LEVEL = 20;

// Anybody may ask whether the realm is open (the title screen does, before offering the login).
function do_status(): void { out(['ok' => true, 'maintenance' => maintenance_on(), 'left' => maintenance_left()]); }
function refuse_in_maintenance(): void { if (maintenance_on()) fail('The realm is closed for maintenance.', 503, ['maintenance' => true]); }

function do_register(): void {
    refuse_in_maintenance();
    $b = json_body();
    $name = trim(in_str($b, 'name', 40));
    $pass = in_str($b, 'password', 200);
    if (!preg_match(NAME_RE, $name)) fail('Account names are 3-16 letters, digits, "_" or "-".');
    if (strlen($pass) < 6) fail('The password needs at least 6 characters.');
    $pdo = db();
    // sign-up flood guard: at most REG_PER_HOUR new accounts per hour in total (no addresses are recorded)
    $pdo->prepare('DELETE FROM reg_times WHERE ts < ?')->execute([time() - 3600]);
    if ((int)$pdo->query('SELECT COUNT(*) FROM reg_times')->fetchColumn() >= REG_PER_HOUR) fail('Too many new accounts were created recently. Try again later.', 429);
    $st = $pdo->prepare('SELECT 1 FROM users WHERE name = ?');
    $st->execute([$name]);
    if ($st->fetch()) fail('That name is already taken.');
    $pdo->prepare('INSERT INTO reg_times(ts) VALUES(?)')->execute([time()]);
    $pdo->prepare('INSERT INTO users(name, pass_hash, created, last_seen) VALUES(?,?,?,?)')
        ->execute([$name, password_hash($pass, PASSWORD_DEFAULT), time(), time()]);
    $uid = (int)$pdo->lastInsertId();
    login_response($uid, $name);
}

function do_login(): void {
    refuse_in_maintenance();
    $b = json_body();
    $name = trim(in_str($b, 'name', 40));
    $pass = in_str($b, 'password', 200);
    $st = db()->prepare('SELECT id, name, pass_hash, banned FROM users WHERE name = ?');
    $st->execute([$name]);
    $u = $st->fetch();
    if (!$u || !password_verify($pass, $u['pass_hash'])) {
        usleep(250000);   // slow down password guessing
        fail('Unknown account or wrong password.', 403);
    }
    if ((int)$u['banned']) fail('This account has been banned.', 403, ['banned' => true]);
    login_response((int)$u['id'], $u['name']);
}

function login_response(int $uid, string $name): void {
    leave_any_battle($uid);
    $token = new_session($uid);
    db()->prepare('UPDATE users SET last_seen = ? WHERE id = ?')->execute([time(), $uid]);
    out(['ok' => true, 'token' => $token, 'me' => ['id' => $uid, 'name' => $name], 'chars' => char_list($uid), 'max' => MAX_CHARACTERS, 'world' => world_info()]);
}

// Reloading the page keeps playing the character that was active; the selection screen follows a fresh login.
function do_resume(): void {
    $u = current_user();
    leave_any_battle($u['id']);
    $active = null;
    if ($u['char']) {
        $d = load_char_data((int)$u['char'], $u['id']);
        if ($d) $active = ['id' => (int)$u['char'], 'save' => $d];
    }
    out(['ok' => true, 'me' => ['id' => $u['id'], 'name' => $u['name']], 'chars' => char_list($u['id']), 'max' => MAX_CHARACTERS, 'active' => $active, 'world' => world_info()]);
}

function do_logout(): void {
    $u = current_user(false);
    if ($u) {
        $pdo = db();
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$u['id']]);
        $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$u['id']]);
    }
    out(['ok' => true]);
}

function char_list(int $uid): array {
    $st = db()->prepare('SELECT id, name, race, cls, lvl, look, updated FROM characters WHERE user_id = ? ORDER BY id');
    $st->execute([$uid]);
    return array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'race' => $r['race'], 'cls' => $r['cls'], 'lvl' => (int)$r['lvl'],
                                'look' => $r['look'] ? json_decode($r['look'], true) : null, 'updated' => (int)$r['updated']], $st->fetchAll());
}

function load_char_data(int $cid, ?int $uid = null): ?array {
    $st = db()->prepare('SELECT data, user_id FROM characters WHERE id = ?');
    $st->execute([$cid]);
    $r = $st->fetch();
    if (!$r || ($uid !== null && (int)$r['user_id'] !== $uid)) return null;
    $d = json_decode($r['data'], true);
    return is_array($d) ? $d : null;
}

function do_chars(): void {
    $u = current_user();
    out(['ok' => true, 'chars' => char_list($u['id']), 'max' => MAX_CHARACTERS]);
}

function do_char_create(): void {
    $u = current_user();
    $b = json_body();
    $d = $b['data'] ?? null;
    if (!is_array($d)) fail('Nothing to create.');
    $pdo = db();
    $cnt = $pdo->prepare('SELECT COUNT(*) FROM characters WHERE user_id = ?');
    $cnt->execute([$u['id']]);
    if ((int)$cnt->fetchColumn() >= MAX_CHARACTERS) fail('An account holds at most ' . MAX_CHARACTERS . ' characters.');
    $err = validate_save($d, null);
    if ($err !== '') fail($err);
    if (strlen(json_encode($d)) > MAX_SAVE_BYTES) fail('Save too large.', 413);
    $pdo->exec('BEGIN IMMEDIATE');
    // a repeated request (double click, retried POST, second tab) must not create the same hero twice
    [$n, $r, $c] = char_summary_fields($d);
    $dup = $pdo->prepare('SELECT id FROM characters WHERE user_id = ? AND name = ? AND race = ? AND cls = ? AND lvl = 1 AND created >= ?');
    $dup->execute([$u['id'], $n, $r, $c, time() - 120]);
    $id = (int)$dup->fetchColumn();
    if (!$id) $id = insert_character($pdo, $u['id'], $d);
    $pdo->prepare('UPDATE sessions SET char_id = ? WHERE user_id = ?')->execute([$id, $u['id']]);
    $pdo->exec('COMMIT');
    out(['ok' => true, 'id' => $id, 'chars' => char_list($u['id'])]);
}

// id 0 = back to the selection screen
function do_char_select(): void {
    $u = current_user();
    $b = json_body();
    $id = in_int($b, 'id');
    $pdo = db();
    if ($id === 0) {
        if (in_active_battle($u['id']) !== null) fail('Leave the battle first.');
        $pdo->prepare('UPDATE sessions SET char_id = NULL WHERE user_id = ?')->execute([$u['id']]);
        $pdo->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$u['id']]);
        out(['ok' => true, 'chars' => char_list($u['id'])]);
    }
    $d = load_char_data($id, $u['id']);
    if (!$d) fail('No such character.', 404);
    leave_any_battle($u['id']);
    $pdo->prepare('UPDATE sessions SET char_id = ? WHERE user_id = ?')->execute([$id, $u['id']]);
    out(['ok' => true, 'id' => $id, 'save' => $d]);
}

function delete_character(int $cid): void {
    $pdo = db();
    $pdo->prepare('DELETE FROM characters WHERE id = ?')->execute([$cid]);
    // whoever was playing it is sent back to the selection screen on the next poll
    $pdo->prepare('UPDATE sessions SET char_id = NULL WHERE char_id = ?')->execute([$cid]);
}

function do_char_delete(): void {
    $u = current_user();
    $id = in_int(json_body(), 'id');
    if (!load_char_data($id, $u['id'])) fail('No such character.', 404);
    if ($u['char'] === $id && in_active_battle($u['id']) !== null) fail('Leave the battle first.');
    delete_character($id);
    if ($u['char'] === $id) db()->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$u['id']]);
    out(['ok' => true, 'chars' => char_list($u['id'])]);
}

// A light plausibility check. The browser runs the rules, so this does not make cheating impossible - it just
// keeps the stored data well-formed and rejects the crudest edits (class swaps, huge level jumps...).
function validate_save(array $d, ?array $old): string {
    if (!isset($d['party']) || !is_array($d['party']) || count($d['party']) !== 1) return 'Each player controls exactly one champion.';
    foreach ($d['party'] as $i => $h) {
        if (!is_array($h)) return 'Bad hero.';
        if (!in_array($h['race'] ?? '', RACES_OK, true) || !in_array($h['cls'] ?? '', CLASSES_OK, true)) return 'Unknown race or class.';
        $lvl = $h['lvl'] ?? 0;
        if (!is_int($lvl) && !is_float($lvl)) return 'Bad level.';
        if ($lvl < 1 || $lvl > MAX_LEVEL) return 'Level out of range.';
        if (!ALLOW_DEBUG) {
            if (!empty($h['debug'])) return 'Playtest heroes are disabled on this server.';
            if (!$old && $lvl > 1) return 'New heroes start at level 1.';
        }
        foreach (['hp', 'maxHp', 'mp', 'maxMp', 'str', 'dex', 'int', 'wis', 'xp'] as $k) {
            if (!isset($h[$k]) || !is_numeric($h[$k]) || $h[$k] < -1000 || $h[$k] > 100000) return "Bad $k.";
        }
        if (isset($h['gender']) && !in_array($h['gender'], ['M', 'F'], true)) return 'Bad gender.';
        if (isset($h['hair']) && !preg_match('/^#[0-9a-fA-F]{6}$/', (string)$h['hair'])) return 'Bad hair colour.';
        if (isset($h['hairStyle']) && !in_array($h['hairStyle'], HAIR_STYLES_OK, true)) return 'Bad hairstyle.';
        if (isset($h['beard']) && !in_array($h['beard'], ['none', 'stubble', 'mustache', 'goatee', 'short', 'full', 'long'], true)) return 'Bad beard.';
        if (!is_string($h['name'] ?? null) || mb_strlen($h['name']) > 20 || preg_match('/[<>&"\'`\\\\]/u', $h['name'])) return 'Bad hero name.';
        if ($old && isset($old['party'][$i]) && is_array($old['party'][$i])) {
            $o = $old['party'][$i];
            if (($o['cls'] ?? '') !== $h['cls'] || ($o['race'] ?? '') !== $h['race']) return 'A hero cannot change race or class.';
            if (($h['lvl'] - ($o['lvl'] ?? 1)) > 4) return 'Level jump too large.';
        }
    }
    if (isset($d['gold']) && (!is_numeric($d['gold']) || $d['gold'] < 0 || $d['gold'] > 50000000)) return 'Bad gold.';
    if (isset($d['inventory']['potions']) && (!is_numeric($d['inventory']['potions']) || $d['inventory']['potions'] < 0 || $d['inventory']['potions'] > 9999)) return 'Bad potions.';
    return '';
}

function do_save(): void {
    $GLOBALS['SGL_ALLOW_IN_MAINT'] = true;       // a last save is still welcome while the doors close
    $u = current_user();
    $cid = require_char($u);
    $b = json_body();
    $d = $b['data'] ?? null;
    if (!is_array($d)) fail('Nothing to save.');
    $old = load_char_data($cid, $u['id']);
    $err = validate_save($d, $old);
    if ($err !== '') fail($err);
    $json = json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > MAX_SAVE_BYTES) fail('Save too large.', 413);
    [$n, $r, $c, $l, $look] = char_summary_fields($d);
    db()->prepare('UPDATE characters SET data = ?, name = ?, race = ?, cls = ?, lvl = ?, look = ?, updated = ? WHERE id = ?')
        ->execute([$json, $n, $r, $c, $l, $look, time(), $cid]);
    out(['ok' => true, 'saved' => time()]);
}
