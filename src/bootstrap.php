<?php
declare(strict_types=1);
require __DIR__ . '/../vendor/autoload.php';
Dotenv\Dotenv::createImmutable(__DIR__ . '/..')->load();
date_default_timezone_set($_ENV['APP_TZ'] ?? 'America/Bogota');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));

function db(): PDO {
    static $pdo = null;
    return $pdo ??= new PDO(
        "mysql:host={$_ENV['DB_HOST']};dbname={$_ENV['DB_NAME']};charset=utf8mb4",
        $_ENV['DB_USER'], $_ENV['DB_PASS'] ?? '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
}
function e(mixed $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function require_admin(bool $json = false): array {
    $u = $_SESSION['user'] ?? null;
    if (!$u || ($u['role'] ?? '') !== 'admin') {
        if ($json) { http_response_code(401); exit(json_encode(['error' => 'No autorizado'])); }
        header('Location: login.php'); exit;
    }
    return $u;
}
