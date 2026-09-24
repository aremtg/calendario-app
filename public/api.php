<?php
require __DIR__ . '/../src/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
$user = require_admin(true);
$uid = $user['id'];
$pdo = db();
$action = $_GET['action'] ?? '';
$in = json_decode(file_get_contents('php://input'), true) ?? [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF'] ?? '')) {
    http_response_code(419); exit(json_encode(['error' => 'Token inválido']));
}
function fail(string $m): never { http_response_code(422); exit(json_encode(['error' => $m])); }
function fields(array $in): array {
    $title = trim($in['title'] ?? '');
    $d = DateTime::createFromFormat('Y-m-d', $in['plan_date'] ?? '');
    if ($title === '') fail('El título es obligatorio.');
    if (!$d || $d->format('Y-m-d') !== $in['plan_date']) fail('Fecha inválida.');
    $time = preg_match('/^\d{2}:\d{2}$/', $in['plan_time'] ?? '') ? $in['plan_time'] : null;
    return [mb_substr($title, 0, 160), trim($in['notes'] ?? '') ?: null, $in['plan_date'], $time,
            !empty($in['alarm_enabled']) ? 1 : 0, max(1, min(365, (int)($in['alarm_days'] ?? 30)))];
}

switch ($action) {
    case 'list': // planes de un mes
        $m = $_GET['month'] ?? date('Y-m');
        if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Mes inválido.');
        $st = $pdo->prepare('SELECT * FROM plans WHERE user_id=? AND plan_date BETWEEN ? AND LAST_DAY(?) ORDER BY plan_date, plan_time');
        $st->execute([$uid, "$m-01", "$m-01"]);
        echo json_encode($st->fetchAll()); break;

    case 'months': // meses que tienen al menos un plan
        $st = $pdo->prepare("SELECT DATE_FORMAT(plan_date,'%Y-%m') AS ym, COUNT(*) AS total, MIN(plan_date) AS first_date
            FROM plans WHERE user_id=? GROUP BY ym ORDER BY ym");
        $st->execute([$uid]);
        echo json_encode($st->fetchAll()); break;

    case 'due': // por vencer: alarma activa, no hechos, dentro del rango de días, o ya vencidos
        $today = date('Y-m-d');
        $st = $pdo->prepare('SELECT *, DATEDIFF(plan_date, ?) AS days_left FROM plans
            WHERE user_id=? AND is_done=0 AND alarm_enabled=1 AND DATEDIFF(plan_date, ?) <= alarm_days
            ORDER BY plan_date');
        $st->execute([$today, $uid, $today]);
        echo json_encode($st->fetchAll()); break;

    case 'create':
        $st = $pdo->prepare('INSERT INTO plans (user_id,title,notes,plan_date,plan_time,alarm_enabled,alarm_days) VALUES (?,?,?,?,?,?,?)');
        $st->execute([$uid, ...fields($in)]);
        echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]); break;

    case 'update':
        $st = $pdo->prepare('UPDATE plans SET title=?,notes=?,plan_date=?,plan_time=?,alarm_enabled=?,alarm_days=? WHERE id=? AND user_id=?');
        $st->execute([...fields($in), (int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'toggle':
        $st = $pdo->prepare('UPDATE plans SET is_done = 1 - is_done WHERE id=? AND user_id=?');
        $st->execute([(int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'delete':
        $st = $pdo->prepare('DELETE FROM plans WHERE id=? AND user_id=?');
        $st->execute([(int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    default: fail('Acción desconocida.');
}
