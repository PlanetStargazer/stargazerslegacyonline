<?php
// The shared world clock and weather.
//
// The game clock is derived from real time: turn N began at epoch + N * TURN_MS. A new world starts
// at 08:00 on day 1 (the client adds the +8 hours offset exactly like the single-player game did).

require_once __DIR__ . '/lib.php';

function world_epoch(): int {
    $e = kv_get('epoch');
    if ($e === null) {
        $e = (string)now_ms();
        // INSERT OR IGNORE semantic: if two requests race, the first one wins
        db()->prepare('INSERT OR IGNORE INTO world(k, v) VALUES(?, ?)')->execute(['epoch', $e]);
        $e = kv_get('epoch') ?? $e;
    }
    return (int)$e;
}

function world_turn(?int $nowMs = null): int {
    $nowMs = $nowMs ?? now_ms();
    return max(0, (int)floor(($nowMs - world_epoch()) / TURN_MS));
}

// Same Markov chain as the old single-player weather, advanced once per game hour and seeded per turn so
// every request (and every player) sees the same sky.
function world_weather(int $turn): array {
    $raw = kv_get('weather');
    $w = $raw ? json_decode($raw, true) : null;
    if (!is_array($w) || !isset($w['turn'])) {
        $w = ['turn' => $turn, 'kind' => 'clear', 'left' => 0];
        kv_set('weather', json_encode($w));
    }
    if ($w['turn'] >= $turn) return ['kind' => $w['kind'], 'left' => (int)$w['left']];
    if ($turn - $w['turn'] > 400) { $w = ['turn' => $turn, 'kind' => 'clear', 'left' => 0]; }
    $kind = $w['kind']; $left = (int)$w['left'];
    for ($t = $w['turn'] + 1; $t <= $turn; $t++) {
        mt_srand($t * 7919 + 13);
        $r = mt_rand() / mt_getrandmax();
        if ($kind === 'clear') {
            if ($r < 0.035) {
                $storm = (mt_rand() / mt_getrandmax()) < 0.3;
                $kind = $storm ? 'storm' : 'rain';
                $left = $storm ? 3 + mt_rand(0, 5) : 4 + mt_rand(0, 9);
            }
        } elseif (--$left <= 0) {
            if ($kind === 'storm' && (mt_rand() / mt_getrandmax()) < 0.6) { $kind = 'rain'; $left = 2 + mt_rand(0, 3); }
            else { $kind = 'clear'; $left = 0; }
        }
    }
    kv_set('weather', json_encode(['turn' => $turn, 'kind' => $kind, 'left' => $left]));
    return ['kind' => $kind, 'left' => $left];
}

function world_info(): array {
    $now = now_ms();
    $turn = world_turn($now);
    return [
        'now' => $now,
        'epoch' => world_epoch(),
        'turnMs' => TURN_MS,
        'turn' => $turn,
        'weather' => world_weather($turn),
    ];
}
