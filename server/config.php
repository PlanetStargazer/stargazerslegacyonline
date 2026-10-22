<?php
// Stargazer's Legacy Online - server configuration.
// Every value can be overridden with an environment variable of the same name (SGL_...).

// Optional settings file for hosts where environment variables cannot be set: copy config.local.php.example to config.local.php and edit it.
if (is_file(__DIR__ . '/config.local.php')) require __DIR__ . '/config.local.php';

function cfg(string $key, $default) {
    $v = getenv('SGL_' . $key);
    if ($v === false || $v === '') return $default;
    return is_int($default) ? (int)$v : $v;
}

// SQLite database file (keep it OUTSIDE the web root; the default is server/data/).
define('DB_PATH', cfg('DB_PATH', __DIR__ . '/data/sgl.sqlite'));

// One "turn" is one in-game hour. 120 000 ms (2 min) per hour => a game day lasts 48 real minutes.
define('TURN_MS', cfg('TURN_MS', 120000));

// How long (seconds) a player counts as online after the last request.
define('ONLINE_TTL', cfg('ONLINE_TTL', 25));

// Session lifetime in seconds (30 days).
define('SESSION_TTL', cfg('SESSION_TTL', 60 * 60 * 24 * 30));

// Overworld geometry (must match the client): the map wraps horizontally.
define('OW_WIDTH', 2400);
define('OW_HEIGHT', 1200);

// A battle that is "in range" for automatic group joining / for seeing the mock battle on the map.
define('GROUP_JOIN_RANGE', cfg('GROUP_JOIN_RANGE', 10));
define('MAP_VIEW_RANGE', cfg('MAP_VIEW_RANGE', 40));

// Most players that can fight in one battle, and in one group.
define('BATTLE_MAX_PLAYERS', cfg('BATTLE_MAX_PLAYERS', 4));
define('GROUP_MAX_PLAYERS', cfg('GROUP_MAX_PLAYERS', 4));

// A battle host that has not polled for this long (seconds) is replaced by another participant.
define('HOST_TIMEOUT', cfg('HOST_TIMEOUT', 12));
// A battle with nobody polling for this long is closed.
define('BATTLE_ABANDON', cfg('BATTLE_ABANDON', 90));

// Playtest switch: lets accounts save heroes above level 1 on their first save (the old "Stargazer" debug party).
define('ALLOW_DEBUG', cfg('ALLOW_DEBUG', 0) ? true : false);

// New accounts allowed per hour in total (flood guard; no IP addresses are stored).
define('REG_PER_HOUR', cfg('REG_PER_HOUR', 30));

// A player who has not touched the game for this many seconds is shown as AFK (the browser logs them out after 5 minutes).
define('AFK_AFTER', cfg('AFK_AFTER', 120));

// Roaming monsters on the overworld live on the server so that every player sees the same ones.
define('ROAM_TICK_MS', cfg('ROAM_TICK_MS', 1000));        // how often they act
define('ROAM_MOVE_PCT', cfg('ROAM_MOVE_PCT', 60));        // chance per tick that a monster steps towards its prey
define('ROAM_PER_PLAYER', cfg('ROAM_PER_PLAYER', 4));     // roamers kept around each adventurer
define('ROAM_SPAWN_PCT', cfg('ROAM_SPAWN_PCT', 18));      // chance per tick of a new one near an adventurer
define('ROAM_CHASE_RANGE', 30);
define('ROAM_KEEP_RANGE', 40);

const HAIR_STYLES_OK = ['short', 'long', 'bob', 'ponytail', 'bun', 'braids', 'curly', 'mohawk', 'buzz', 'bald'];

// Characters one account may keep.
define('MAX_CHARACTERS', cfg('MAX_CHARACTERS', 6));

define('MAX_SAVE_BYTES', 600000);
define('MAX_CHAT_LEN', 240);
