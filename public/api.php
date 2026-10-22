<?php
// Stargazer's Legacy Online - API entry point.  POST /api.php?a=<action>   (JSON in, JSON out)

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');

$serverDir = is_dir(__DIR__ . '/server') ? __DIR__ . '/server' : __DIR__ . '/../server';        // a ZIP install keeps server/ beside this file; the repository keeps it one level up
require_once $serverDir . '/accounts.php';
require_once $serverDir . '/poll.php';
require_once $serverDir . '/admin.php';

set_exception_handler(function (Throwable $e) {
    error_log('SGL error: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Server error. Please try again.']);
});

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST only.', 405);

$action = (string)($_GET['a'] ?? '');
switch ($action) {
    case 'status':          do_status(); break;
    case 'register':        do_register(); break;
    case 'login':           do_login(); break;
    case 'resume':          do_resume(); break;
    case 'logout':          do_logout(); break;
    case 'save':            do_save(); break;
    case 'chars':           do_chars(); break;
    case 'char_create':     do_char_create(); break;
    case 'char_select':     do_char_select(); break;
    case 'char_delete':     do_char_delete(); break;
    case 'admin_login':     do_admin_login(); break;
    case 'admin_logout':    do_admin_logout(); break;
    case 'admin_overview':  do_admin_overview(); break;
    case 'admin_users':     do_admin_users(); break;
    case 'admin_user_update': do_admin_user_update(); break;
    case 'admin_user_delete': do_admin_user_delete(); break;
    case 'admin_kick':      do_admin_kick(); break;
    case 'admin_chars':     do_admin_chars(); break;
    case 'admin_char_inspect': do_admin_char_inspect(); break;
    case 'admin_char_home': do_admin_char_home(); break;
    case 'admin_char_delete': do_admin_char_delete(); break;
    case 'admin_ban':       do_admin_ban(); break;
    case 'admin_char_rename': do_admin_char_rename(); break;
    case 'admin_char_gm':   do_admin_char_gm(); break;
    case 'admin_weather':   do_admin_weather(); break;
    case 'admin_purge_bags': do_admin_purge_bags(); break;
    case 'admin_world_reset': do_admin_world_reset(); break;
    case 'admin_maintenance': do_admin_maintenance(); break;
    case 'poll':            do_poll(); break;
    case 'friend':          do_friend(); break;
    case 'roam_map':        do_roam_map(); break;
    case 'roam_claim':      do_roam_claim(); break;
    case 'camp_loot':       do_camp_loot(); break;
    case 'bag_drop':        do_bag_drop(); break;
    case 'bag_take':        do_bag_take(); break;
    case 'gm':              do_gm(); break;
    case 'chat':            do_chat(); break;
    case 'group':           do_group(); break;
    case 'assist':          do_assist(); break;
    case 'battle_start':    do_battle_start(); break;
    case 'battle_join':     do_battle_join(); break;
    case 'battle_intent':   do_battle_intent(); break;
    case 'battle_snapshot': do_battle_snapshot(); break;
    case 'battle_leave':    do_battle_leave(); break;
    default:                fail('Unknown action.', 404);
}
