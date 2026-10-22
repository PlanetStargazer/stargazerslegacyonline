<?php
// The one request every client sends every second or two: "here is where I am - what is new?"

require_once __DIR__ . '/battle.php';
require_once __DIR__ . '/roamers.php';
require_once __DIR__ . '/friends.php';

function do_poll(): void {
    $u = current_user();
    $b = json_body();
    // the character may have been removed (administrator) or the world reset: back to the selection screen
    require_char($u);
    $pos = is_array($b['pos'] ?? null) ? $b['pos'] : [];
    $pdo = db();

    $pdo->exec('BEGIN IMMEDIATE');
    try {
        update_presence($u, $pos);
        roam_tick();
        $world = world_info();
        $players = section_players($u, $pos);
        $battle = section_battle($u, is_array($b['battle'] ?? null) ? $b['battle'] : null);
        $battles = section_battles($u, $pos);
        $chat = section_chat($u, $pos, in_int($b, 'chat'));
        $events = section_events($u, in_int($b, 'ev'));
        $roamers = section_roamers($pos);
        $bags = section_lootbags($pos);
        $camps = section_camps();
        if (random_int(1, 40) === 1) $pdo->prepare('DELETE FROM lootbags WHERE created < ?')->execute([time() - 3600]);
        $friends = section_friends($u);
        $group = section_group($u);
        $invites = section_invites($u);
        if (random_int(1, 25) === 1) cleanup_battles();
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->exec('ROLLBACK');
        throw $e;
    }

    out([
        'ok' => true,
        'now' => $world['now'], 'turn' => $world['turn'], 'epoch' => $world['epoch'], 'turnMs' => $world['turnMs'],
        'weather' => $world['weather'],
        'me' => $u,
        'near' => $players['near'], 'online' => $players['online'],
        'battles' => $battles, 'battle' => $battle,
        'roamers' => $roamers, 'bags' => $bags, 'camps' => $camps, 'friends' => $friends, 'needMap' => roam_map() === null,
        'chat' => $chat, 'events' => $events, 'group' => $group, 'invites' => $invites,
        'maintLeft' => maintenance_left(),
    ]);
}
