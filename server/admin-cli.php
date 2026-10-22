<?php
// Command-line helper for the administrator:
//   php server/admin-cli.php passwd [password]   set (or change) the administrator password
//   php server/admin-cli.php status              show counts
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/world.php';

$cmd = $argv[1] ?? '';
if ($cmd === 'passwd') {
    $pw = $argv[2] ?? '';
    if ($pw === '') {
        fwrite(STDERR, 'New administrator password (min. 8 characters): ');
        if (function_exists('shell_exec') && stripos(PHP_OS, 'WIN') !== 0) shell_exec('stty -echo 2>/dev/null');
        $pw = trim((string)fgets(STDIN));
        if (function_exists('shell_exec') && stripos(PHP_OS, 'WIN') !== 0) shell_exec('stty echo 2>/dev/null');
        fwrite(STDERR, "\n");
    }
    if (strlen($pw) < 8) { fwrite(STDERR, "Too short (8 characters minimum).\n"); exit(1); }
    kv_set('admin_hash', password_hash($pw, PASSWORD_DEFAULT));
    echo "Administrator password set. Sign in at /admin.html\n";
} elseif ($cmd === 'status') {
    $pdo = db();
    $c = fn($t) => (int)$pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
    echo 'accounts: ' . $c('users') . ', characters: ' . $c('characters') . ', admin password: ' . (kv_get('admin_hash') !== null || getenv('SGL_ADMIN_PASSWORD') ? 'set' : 'NOT SET') . "\n";
} else {
    echo "usage: php server/admin-cli.php passwd [password] | status\n";
    exit(1);
}
