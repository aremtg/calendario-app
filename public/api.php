<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/backup.php';
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
    if (!preg_match('/^\d{2}:\d{2}$/', $in['plan_time'] ?? '')) fail('La hora de inicio es obligatoria.');
    $timeEnd = preg_match('/^\d{2}:\d{2}$/', $in['plan_time_end'] ?? '') ? $in['plan_time_end'] : null;
    return [
        mb_substr($title, 0, 160),
        trim($in['notes'] ?? '') ?: null,
        $in['plan_date'],
        $in['plan_time'],
        $timeEnd,
        !empty($in['alarm_enabled']) ? 1 : 0,
        max(1, min(365, (int)($in['alarm_days'] ?? 30))),
        !empty($in['lugar_id']) ? (int)$in['lugar_id'] : null,
        !empty($in['instructor_id']) ? (int)$in['instructor_id'] : null,
        !empty($in['curso_id']) ? (int)$in['curso_id'] : null,
    ];
}

/** CRUD genérico para lugares / instructores / cursos, todos con la misma forma. */
function catalog_case(PDO $pdo, string $table, array $cols, int $uid, string $sub, array $in): void {
    switch ($sub) {
        case 'list':
            $st = $pdo->prepare("SELECT * FROM $table WHERE user_id=? ORDER BY nombre");
            $st->execute([$uid]);
            echo json_encode($st->fetchAll()); break;
        case 'create':
            $vals = array_map(fn($c) => trim($in[$c] ?? '') ?: null, $cols);
            if (empty($vals[0])) fail('El nombre es obligatorio.');
            $ph = implode(',', array_fill(0, count($cols) + 1, '?'));
            $st = $pdo->prepare("INSERT INTO $table (user_id, " . implode(',', $cols) . ") VALUES ($ph)");
            $st->execute([$uid, ...$vals]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]); break;
        case 'update':
            $vals = array_map(fn($c) => trim($in[$c] ?? '') ?: null, $cols);
            if (empty($vals[0])) fail('El nombre es obligatorio.');
            $set = implode(',', array_map(fn($c) => "$c=?", $cols));
            $st = $pdo->prepare("UPDATE $table SET $set WHERE id=? AND user_id=?");
            $st->execute([...$vals, (int)$in['id'], $uid]);
            echo json_encode(['ok' => true]); break;
        case 'delete':
            $st = $pdo->prepare("DELETE FROM $table WHERE id=? AND user_id=?");
            $st->execute([(int)$in['id'], $uid]);
            echo json_encode(['ok' => true]); break;
        default: fail('Acción desconocida.');
    }
}

switch ($action) {
    case 'list':
        $m = $_GET['month'] ?? date('Y-m');
        if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Mes inválido.');
        $st = $pdo->prepare('SELECT * FROM plans WHERE user_id=? AND plan_date BETWEEN ? AND LAST_DAY(?) ORDER BY plan_date, plan_time');
        $st->execute([$uid, "$m-01", "$m-01"]);
        echo json_encode($st->fetchAll()); break;

    case 'months':
        $st = $pdo->prepare("SELECT DATE_FORMAT(plan_date,'%Y-%m') AS ym, COUNT(*) AS total, MIN(plan_date) AS first_date
            FROM plans WHERE user_id=? GROUP BY ym ORDER BY ym");
        $st->execute([$uid]);
        echo json_encode($st->fetchAll()); break;

    case 'due':
        $today = date('Y-m-d');
        $st = $pdo->prepare('SELECT *, DATEDIFF(plan_date, ?) AS days_left FROM plans
            WHERE user_id=? AND is_done=0 AND alarm_enabled=1 AND DATEDIFF(plan_date, ?) <= alarm_days
            ORDER BY plan_date');
        $st->execute([$today, $uid, $today]);
        echo json_encode($st->fetchAll()); break;

    case 'search':
        $where = ['user_id = ?']; $params = [$uid];
        if (!empty($in['instructor_id'])) { $where[] = 'instructor_id = ?'; $params[] = (int)$in['instructor_id']; }
        if (!empty($in['curso_id'])) { $where[] = 'curso_id = ?'; $params[] = (int)$in['curso_id']; }
        if (!empty($in['title'])) { $where[] = 'title LIKE ?'; $params[] = '%' . $in['title'] . '%'; }
        if (!empty($in['date_from'])) { $where[] = 'plan_date >= ?'; $params[] = $in['date_from']; }
        if (!empty($in['date_to'])) { $where[] = 'plan_date <= ?'; $params[] = $in['date_to']; }
        $sql = 'SELECT * FROM plans WHERE ' . implode(' AND ', $where) . ' ORDER BY plan_date, plan_time';
        $st = $pdo->prepare($sql); $st->execute($params);
        echo json_encode($st->fetchAll()); break;

    case 'create':
        $st = $pdo->prepare('INSERT INTO plans (user_id,title,notes,plan_date,plan_time,plan_time_end,alarm_enabled,alarm_days,lugar_id,instructor_id,curso_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $f = fields($in);
        $st->execute([$uid, $f[0], $f[1], $f[2], $f[3], $f[4], $f[5], $f[6], $f[7], $f[8], $f[9]]);
        echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]); break;

    case 'update':
        $f = fields($in);
        $st = $pdo->prepare('UPDATE plans SET title=?,notes=?,plan_date=?,plan_time=?,plan_time_end=?,alarm_enabled=?,alarm_days=?,lugar_id=?,instructor_id=?,curso_id=? WHERE id=? AND user_id=?');
        $st->execute([$f[0], $f[1], $f[2], $f[3], $f[4], $f[5], $f[6], $f[7], $f[8], $f[9], (int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'toggle':
        $st = $pdo->prepare('UPDATE plans SET is_done = 1 - is_done WHERE id=? AND user_id=?');
        $st->execute([(int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'delete':
        $st = $pdo->prepare('DELETE FROM plans WHERE id=? AND user_id=?');
        $st->execute([(int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'lugares': catalog_case($pdo, 'lugares', ['nombre', 'direccion'], $uid, $in['sub'] ?? $_GET['sub'] ?? '', $in); break;
    case 'instructores': catalog_case($pdo, 'instructores', ['nombre', 'cargo'], $uid, $in['sub'] ?? $_GET['sub'] ?? '', $in); break;
    case 'cursos': catalog_case($pdo, 'cursos', ['nombre'], $uid, $in['sub'] ?? $_GET['sub'] ?? '', $in); break;

    case 'backups_list':
        echo json_encode(backups_list()); break;
    case 'backups_create':
        try { echo json_encode(['ok' => true, 'backup' => backups_create($pdo)]); }
        catch (Throwable $e) { fail('No se pudo crear la copia: ' . $e->getMessage()); }
        break;
    case 'backups_delete':
        try { backups_delete($in['file'] ?? ''); echo json_encode(['ok' => true]); }
        catch (Throwable $e) { fail($e->getMessage()); }
        break;
    case 'backups_restore':
        try { $n = backups_restore($pdo, $in['file'] ?? '', $uid); echo json_encode(['ok' => true, 'restored' => $n]); }
        catch (Throwable $e) { fail($e->getMessage()); }
        break;
    case 'backups_download':
        $name = $_GET['file'] ?? '';
        if (!backups_safe_name($name)) fail('Nombre inválido.');
        $path = BACKUPS_DIR . '/' . $name;
        if (!is_file($path)) fail('La copia ya no existe.');
        echo json_encode(['file' => $name, 'content' => base64_encode(file_get_contents($path))]);
        break;

    default: fail('Acción desconocida.');
}