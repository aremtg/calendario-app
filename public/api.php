<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/backup.php';
header('Content-Type: application/json; charset=utf-8');
$user = require_admin(true);
$uid = $user['id'];
$pdo = db();
$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$in = $rawInput !== '' ? (json_decode($rawInput, true) ?: []) : [];

/*
 * Las operaciones que modifican datos deben incluir el token CSRF.
 * Las consultas GET (por ejemplo, listar planes) no necesitan cuerpo JSON.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF'] ?? '')) {
    http_response_code(419);
    exit(json_encode(['error' => 'Token inválido']));
}

function fail(string $m, int $status = 422): never
{
    http_response_code($status);
    exit(json_encode(['error' => $m], JSON_UNESCAPED_UNICODE));
}

function valid_time(?string $time): bool
{
    if (!is_string($time) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
        return false;
    }

    [$hour, $minute] = array_map('intval', explode(':', $time));
    return $hour >= 0 && $hour <= 23 && $minute >= 0 && $minute <= 59;
}

/**
 * Normaliza y valida los datos de un plan antes de enviarlos a MySQL.
 * También devuelve los IDs de catálogo como enteros para evitar valores ambiguos.
 */
function fields(array $in): array
{
    $title = trim((string)($in['title'] ?? ''));
    $date = (string)($in['plan_date'] ?? '');
    $d = DateTime::createFromFormat('!Y-m-d', $date);

    if ($title === '') fail('El título es obligatorio.');
    if (!$d || $d->format('Y-m-d') !== $date) fail('Fecha inválida.');

    $time = (string)($in['plan_time'] ?? '');
    if (!valid_time($time)) fail('La hora de inicio no es válida.');

    $rawEnd = trim((string)($in['plan_time_end'] ?? ''));
    $timeEnd = $rawEnd === '' ? null : $rawEnd;
    if ($timeEnd !== null && !valid_time($timeEnd)) {
        fail('La hora de fin no es válida.');
    }

    if ($timeEnd !== null && $timeEnd === $time) {
        // La misma hora puede ser válida para una actividad de 24 horas,
        // pero aquí se conserva como dato explícito sin intentar corregirlo.
    }

    return [
        mb_substr($title, 0, 160),
        trim((string)($in['notes'] ?? '')) ?: null,
        $date,
        $time,
        $timeEnd,
        !empty($in['alarm_enabled']) ? 1 : 0,
        max(1, min(365, (int)($in['alarm_days'] ?? 30))),
        !empty($in['lugar_id']) ? (int)$in['lugar_id'] : null,
        !empty($in['instructor_id']) ? (int)$in['instructor_id'] : null,
        !empty($in['curso_id']) ? (int)$in['curso_id'] : null,
    ];
}

/**
 * Comprueba que un registro de catálogo realmente pertenece al usuario actual.
 * Evita asociar un plan con datos de otro administrador.
 */
function validate_catalog_owner(PDO $pdo, string $table, ?int $id, int $uid, string $label): ?int
{
    if ($id === null || $id <= 0) return null;

    $st = $pdo->prepare("SELECT id FROM $table WHERE id=? AND user_id=?");
    $st->execute([$id, $uid]);

    if (!$st->fetchColumn()) {
        fail("$label no válido.");
    }

    return $id;
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
            if ($table === 'cursos') {
                $dup = $pdo->prepare('SELECT id FROM cursos WHERE user_id=? AND LOWER(TRIM(nombre))=LOWER(TRIM(?)) LIMIT 1');
                $dup->execute([$uid, $vals[0]]);
                if ($dup->fetchColumn()) fail('Ya existe un curso con ese nombre. Puedes usar un nombre diferente, por ejemplo KL y KL2.');
            }
            if ($table === 'instructores' && !empty($in['cedula'])) {
                $dup = $pdo->prepare('SELECT id FROM instructores WHERE user_id=? AND cedula=? LIMIT 1');
                $dup->execute([$uid, trim($in['cedula'])]);
                if ($dup->fetchColumn()) fail('La cédula ya está registrada para otro instructor.');
            }
            $ph = implode(',', array_fill(0, count($cols) + 1, '?'));
            $st = $pdo->prepare("INSERT INTO $table (user_id, " . implode(',', $cols) . ") VALUES ($ph)");
            $st->execute([$uid, ...$vals]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]); break;
        case 'update':
            $vals = array_map(fn($c) => trim($in[$c] ?? '') ?: null, $cols);
            if (empty($vals[0])) fail('El nombre es obligatorio.');
            $id = (int)($in['id'] ?? 0);
            if ($id <= 0) fail('Registro inválido.');
            if ($table === 'cursos') {
                $dup = $pdo->prepare('SELECT id FROM cursos WHERE user_id=? AND LOWER(TRIM(nombre))=LOWER(TRIM(?)) AND id<>? LIMIT 1');
                $dup->execute([$uid, $vals[0], $id]);
                if ($dup->fetchColumn()) fail('Ya existe otro curso con ese nombre.');
            }
            if ($table === 'instructores' && !empty($in['cedula'])) {
                $dup = $pdo->prepare('SELECT id FROM instructores WHERE user_id=? AND cedula=? AND id<>? LIMIT 1');
                $dup->execute([$uid, trim($in['cedula']), $id]);
                if ($dup->fetchColumn()) fail('La cédula ya está registrada para otro instructor.');
            }
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
        $st = $pdo->prepare('SELECT p.*, l.nombre AS lugar_nombre, l.direccion AS lugar_direccion, i.nombre AS instructor_nombre, i.cargo AS instructor_cargo, c.nombre AS curso_nombre
            FROM plans p
            LEFT JOIN lugares l ON l.id = p.lugar_id AND l.user_id = p.user_id
            LEFT JOIN instructores i ON i.id = p.instructor_id AND i.user_id = p.user_id
            LEFT JOIN cursos c ON c.id = p.curso_id AND c.user_id = p.user_id
            WHERE p.user_id=? AND p.plan_date BETWEEN ? AND LAST_DAY(?)
            ORDER BY p.plan_date, p.plan_time');
        $st->execute([$uid, "$m-01", "$m-01"]);
        echo json_encode($st->fetchAll()); break;

    case 'months':
        $st = $pdo->prepare("SELECT DATE_FORMAT(plan_date,'%Y-%m') AS ym, COUNT(*) AS total, MIN(plan_date) AS first_date
            FROM plans WHERE user_id=? GROUP BY ym ORDER BY ym");
        $st->execute([$uid]);
        echo json_encode($st->fetchAll()); break;

    case 'due':
        $today = date('Y-m-d');
        $st = $pdo->prepare('SELECT p.*, DATEDIFF(p.plan_date, ?) AS days_left, l.nombre AS lugar_nombre, i.nombre AS instructor_nombre, c.nombre AS curso_nombre
            FROM plans p
            LEFT JOIN lugares l ON l.id = p.lugar_id AND l.user_id = p.user_id
            LEFT JOIN instructores i ON i.id = p.instructor_id AND i.user_id = p.user_id
            LEFT JOIN cursos c ON c.id = p.curso_id AND c.user_id = p.user_id
            WHERE p.user_id=? AND p.is_done=0 AND p.alarm_enabled=1 AND DATEDIFF(p.plan_date, ?) <= p.alarm_days
            ORDER BY p.plan_date');
        $st->execute([$today, $uid, $today]);
        echo json_encode($st->fetchAll()); break;

    case 'search':
        /*
         * El buscador visible promete buscar curso, instructor y fecha.
         * Por eso se consultan también los nombres de los catálogos y se
         * permite una fecha escrita como AAAA-MM-DD.
         */
        $where = ['p.user_id = ?'];
        $params = [$uid];

        if (!empty($in['instructor_id'])) {
            $where[] = 'p.instructor_id = ?';
            $params[] = (int)$in['instructor_id'];
        }
        if (!empty($in['curso_id'])) {
            $where[] = 'p.curso_id = ?';
            $params[] = (int)$in['curso_id'];
        }
        if (!empty($in['title'])) {
            $q = trim((string)$in['title']);
            $where[] = '(p.title LIKE ? OR p.notes LIKE ? OR i.nombre LIKE ? OR c.nombre LIKE ? OR p.plan_date LIKE ?)';
            $like = '%' . $q . '%';
            array_push($params, $like, $like, $like, $like, $like);
        }
        if (!empty($in['date_from'])) {
            $where[] = 'p.plan_date >= ?';
            $params[] = $in['date_from'];
        }
        if (!empty($in['date_to'])) {
            $where[] = 'p.plan_date <= ?';
            $params[] = $in['date_to'];
        }

        $sql = 'SELECT p.*
                FROM plans p
                LEFT JOIN instructores i ON i.id = p.instructor_id AND i.user_id = p.user_id
                LEFT JOIN cursos c ON c.id = p.curso_id AND c.user_id = p.user_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY p.plan_date, p.plan_time';

        $st = $pdo->prepare($sql);
        $st->execute($params);
        echo json_encode($st->fetchAll(), JSON_UNESCAPED_UNICODE);
        break;

    case 'create':
        $f = fields($in);
        $f[7] = validate_catalog_owner($pdo, 'lugares', $f[7], $uid, 'Lugar');
        $f[8] = validate_catalog_owner($pdo, 'instructores', $f[8], $uid, 'Instructor');
        $f[9] = validate_catalog_owner($pdo, 'cursos', $f[9], $uid, 'Curso');

        $st = $pdo->prepare('INSERT INTO plans
            (user_id,title,notes,plan_date,plan_time,plan_time_end,alarm_enabled,alarm_days,lugar_id,instructor_id,curso_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $st->execute([$uid, $f[0], $f[1], $f[2], $f[3], $f[4], $f[5], $f[6], $f[7], $f[8], $f[9]]);
        echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
        break;

    case 'update':
        $id = (int)($in['id'] ?? 0);
        if ($id <= 0) fail('Plan inválido.');

        $f = fields($in);
        $f[7] = validate_catalog_owner($pdo, 'lugares', $f[7], $uid, 'Lugar');
        $f[8] = validate_catalog_owner($pdo, 'instructores', $f[8], $uid, 'Instructor');
        $f[9] = validate_catalog_owner($pdo, 'cursos', $f[9], $uid, 'Curso');

        $st = $pdo->prepare('UPDATE plans SET title=?,notes=?,plan_date=?,plan_time=?,plan_time_end=?,alarm_enabled=?,alarm_days=?,lugar_id=?,instructor_id=?,curso_id=?
            WHERE id=? AND user_id=?');
        $st->execute([$f[0], $f[1], $f[2], $f[3], $f[4], $f[5], $f[6], $f[7], $f[8], $f[9], $id, $uid]);

        if ($st->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM plans WHERE id=? AND user_id=?');
            $check->execute([$id, $uid]);
            if (!$check->fetchColumn()) fail('El plan no existe.');
        }

        echo json_encode(['ok' => true]);
        break;

    case 'toggle':
        $st = $pdo->prepare('UPDATE plans SET is_done = 1 - is_done WHERE id=? AND user_id=?');
        $st->execute([(int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'delete':
        $st = $pdo->prepare('DELETE FROM plans WHERE id=? AND user_id=?');
        $st->execute([(int)$in['id'], $uid]);
        echo json_encode(['ok' => true]); break;

    case 'lugares': catalog_case($pdo, 'lugares', ['nombre', 'direccion'], $uid, $in['sub'] ?? $_GET['sub'] ?? '', $in); break;
    case 'instructores': catalog_case($pdo, 'instructores', ['nombre', 'cedula', 'cargo'], $uid, $in['sub'] ?? $_GET['sub'] ?? '', $in); break;
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