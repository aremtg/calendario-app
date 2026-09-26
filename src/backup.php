<?php
declare(strict_types=1);

define('BACKUPS_DIR', __DIR__ . '/../storage/backups');
define('MAX_BACKUPS', 5);

function backups_ensure_dir(): void
{
    if (!is_dir(BACKUPS_DIR))
        mkdir(BACKUPS_DIR, 0775, true);
}

function backups_safe_name(string $name): bool
{
    return (bool) preg_match('/^backup_\d{8}_\d{6}\.sql$/', $name);
}

function backups_list(): array
{
    backups_ensure_dir();
    $files = glob(BACKUPS_DIR . '/backup_*.sql') ?: [];
    usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
    return array_map(fn($p) => [
        'file' => basename($p),
        'size' => filesize($p),
        'created_at' => date('Y-m-d H:i:s', filemtime($p)),
    ], $files);
}

function backups_rotate(): void
{
    $files = glob(BACKUPS_DIR . '/backup_*.sql') ?: [];
    usort($files, fn($a, $b) => filemtime($a) <=> filemtime($b)); // más antiguo primero
    while (count($files) >= MAX_BACKUPS)
        unlink(array_shift($files));
}

function backups_create(PDO $pdo): array
{
    backups_ensure_dir();
    backups_rotate();

    $lines = ['-- Copia de seguridad · Calendario', '-- Generado: ' . date('Y-m-d H:i:s'), '', '-- Tabla: users'];

    foreach ($pdo->query('SELECT * FROM users') as $u) {
        $vals = [
            (int) $u['id'],
            $pdo->quote($u['name']),
            $pdo->quote($u['email']),
            $pdo->quote($u['password_hash']),
            $pdo->quote($u['role']),
            $pdo->quote($u['created_at'])
        ];
        $lines[] = 'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (' . implode(', ', $vals) . ');';
    }

    $lines[] = '';
    $lines[] = '-- Tabla: plans';
    foreach ($pdo->query('SELECT * FROM plans') as $p) {
        $vals = [
            (int) $p['id'],
            (int) $p['user_id'],
            $pdo->quote($p['title']),
            $p['notes'] === null ? 'NULL' : $pdo->quote($p['notes']),
            $pdo->quote($p['plan_date']),
            $p['plan_time'] === null ? 'NULL' : $pdo->quote($p['plan_time']),
            (int) $p['is_done'],
            (int) $p['alarm_enabled'],
            (int) $p['alarm_days'],
            $pdo->quote($p['created_at'])
        ];
        $lines[] = 'INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, is_done, alarm_enabled, alarm_days, created_at) VALUES (' . implode(', ', $vals) . ');';
    }

    $name = 'backup_' . date('Ymd_His') . '.sql';
    file_put_contents(BACKUPS_DIR . '/' . $name, implode("\n", $lines) . "\n");
    return ['file' => $name, 'size' => filesize(BACKUPS_DIR . '/' . $name), 'created_at' => date('Y-m-d H:i:s')];
}

function backups_delete(string $name): void
{
    if (!backups_safe_name($name))
        throw new RuntimeException('Nombre de archivo inválido.');
    $path = BACKUPS_DIR . '/' . $name;
    if (is_file($path))
        unlink($path);
}

/** Lee los INSERT INTO plans del .sql y los reinserta uno por uno, como si se hiciera a mano. */
function backups_restore(PDO $pdo, string $name, int $uid): int
{
    if (!backups_safe_name($name))
        throw new RuntimeException('Nombre de archivo inválido.');
    $path = BACKUPS_DIR . '/' . $name;
    if (!is_file($path))
        throw new RuntimeException('La copia ya no existe.');

    preg_match_all('/^INSERT INTO plans \([^)]*\) VALUES \((.*)\);$/mi', file_get_contents($path), $m);

    $insert = $pdo->prepare('INSERT INTO plans (user_id, title, notes, plan_date, plan_time, is_done, alarm_enabled, alarm_days, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)');

    $count = 0;
    $pdo->beginTransaction();
    try {
        foreach ($m[1] as $tuple) {
            $f = backups_split_values($tuple);
            if (count($f) < 10)
                continue;
            $insert->execute([$uid, $f[2], $f[3], $f[4], $f[5], (int) $f[6], (int) $f[7], (int) $f[8], $f[9]]);
            $count++;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return $count;
}

/** Separa los valores de un VALUES(...) respetando comillas y escapes. */
function backups_split_values(string $tuple): array
{
    $out = [];
    $cur = '';
    $inStr = false;
    $len = strlen($tuple);
    for ($i = 0; $i < $len; $i++) {
        $ch = $tuple[$i];
        if ($inStr) {
            if ($ch === '\\' && $i + 1 < $len) {
                $cur .= $tuple[++$i];
                continue;
            }
            if ($ch === "'") {
                $inStr = false;
                continue;
            }
            $cur .= $ch;
        } else {
            if ($ch === "'") {
                $inStr = true;
                continue;
            }
            if ($ch === ',') {
                $out[] = backups_cast(trim($cur));
                $cur = '';
                continue;
            }
            $cur .= $ch;
        }
    }
    $out[] = backups_cast(trim($cur));
    return $out;
}
function backups_cast(string $v): ?string
{
    return strtoupper($v) === 'NULL' ? null : $v;
}