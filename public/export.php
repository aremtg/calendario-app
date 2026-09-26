<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;

$user = require_admin();
$pdo = db();
$type = $_GET['type'] ?? 'month';
$meses = [1=>'enero',2=>'febrero',3=>'marzo',4=>'abril',5=>'mayo',6=>'junio',
    7=>'julio',8=>'agosto',9=>'septiembre',10=>'octubre',11=>'noviembre',12=>'diciembre'];
$diasSemana = [1=>'Lunes',2=>'Martes',3=>'Miércoles',4=>'Jueves',5=>'Viernes',6=>'Sábado',7=>'Domingo'];

if ($type === 'year') {
    $year = $_GET['year'] ?? date('Y');
    if (!preg_match('/^\d{4}$/', $year)) { http_response_code(422); exit('Año inválido.'); }
    $st = $pdo->prepare('SELECT * FROM plans WHERE user_id=? AND YEAR(plan_date)=? ORDER BY plan_date, plan_time');
    $st->execute([$user['id'], $year]);
    $filename = "planes_$year";
    $titulo = "Planes del año $year";
} else {
    $month = $_GET['month'] ?? date('Y-m');
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) { http_response_code(422); exit('Mes inválido.'); }
    $st = $pdo->prepare('SELECT * FROM plans WHERE user_id=? AND plan_date BETWEEN ? AND LAST_DAY(?) ORDER BY plan_date, plan_time');
    $st->execute([$user['id'], "$month-01", "$month-01"]);
    [$y, $m] = explode('-', $month);
    $filename = "planes_$month";
    $titulo = 'Planes de ' . $meses[(int)$m] . ' de ' . $y;
}
$plans = $st->fetchAll();

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Planes');

$sheet->setCellValue('A1', $titulo);
$sheet->mergeCells('A1:H1');
$sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

$headers = ['Fecha', 'Día', 'Hora', 'Título', 'Notas', 'Estado', 'Alarma', 'Días de aviso'];
$sheet->fromArray($headers, null, 'A3');
$sheet->getStyle('A3:H3')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
$sheet->getStyle('A3:H3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('217346');

$row = 4;
$hoy = new DateTime('today');
foreach ($plans as $p) {
    $fecha = new DateTime($p['plan_date']);
    $sheet->setCellValue("A$row", $fecha->format('d/m/Y'));
    $sheet->setCellValue("B$row", $diasSemana[(int)$fecha->format('N')]);
    $sheet->setCellValue("C$row", $p['plan_time'] ? substr($p['plan_time'], 0, 5) : 'Todo el día');
    $sheet->setCellValue("D$row", $p['title']);
    $sheet->setCellValue("E$row", $p['notes'] ?? '');
    $sheet->setCellValue("F$row", $p['is_done'] ? 'Hecho' : 'Pendiente');
    $sheet->setCellValue("G$row", $p['alarm_enabled'] ? 'Activa' : 'Inactiva');
    $sheet->setCellValue("H$row", $p['alarm_enabled'] ? $p['alarm_days'] : '');

    if ($p['is_done']) {
        $sheet->getStyle("A$row:H$row")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E7F5EE');
    } elseif (!$p['is_done'] && $fecha < $hoy) {
        $sheet->getStyle("A$row:H$row")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('FDEDED');
    }
    $row++;
}

if (empty($plans)) {
    $sheet->setCellValue('A4', 'No hay planes registrados para este período.');
    $sheet->mergeCells('A4:H4');
    $row = 5;
}

foreach (range('A', 'H') as $col) $sheet->getColumnDimension($col)->setAutoSize(true);
$sheet->setAutoFilter('A3:H' . max(3, $row - 1));
$sheet->freezePane('A4');

$name = $filename . '_' . date('Ymd_His') . '.xlsx';
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Cache-Control: max-age=0');
(new Xlsx($spreadsheet))->save('php://output');
exit;