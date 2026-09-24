<?php
require __DIR__ . '/../src/bootstrap.php';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['csrf'], $_POST['csrf'] ?? '')) { $error = 'Sesión inválida, recarga la página.'; }
    else {
        $st = db()->prepare('SELECT * FROM users WHERE email = ? AND role = "admin"');
        $st->execute([trim($_POST['email'] ?? '')]);
        $u = $st->fetch();
        if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            $_SESSION['user'] = ['id' => (int)$u['id'], 'name' => $u['name'], 'role' => $u['role']];
            header('Location: index.php'); exit;
        }
        $error = 'Correo o contraseña incorrectos.';
    }
}
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ingresar · Calendario</title>
<link rel="stylesheet" href="assets/app.css">
<style>body{font-family:'Bricolage Grotesque',system-ui,sans-serif}</style></head>
<body class="min-h-screen bg-[#EEF2EE] grid place-items-center p-4 text-[#16211F]">
<form method="post" class="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-5">
  <div><h1 class="text-3xl font-extrabold text-[#14453D]">Calendario</h1>
  <p class="text-sm text-slate-500 mt-1">Ingresa como administrador para ver tus planes.</p></div>
  <?php if ($error): ?><p class="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3"><?= e($error) ?></p><?php endif; ?>
  <input type="hidden" name="csrf" value="<?= e($_SESSION['csrf']) ?>">
  <label class="block text-sm font-semibold">Correo
    <input name="email" type="email" required class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#14453D]"></label>
  <label class="block text-sm font-semibold">Contraseña
    <input name="password" type="password" required class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#14453D]"></label>
  <button class="w-full rounded-xl bg-[#14453D] text-white font-semibold py-3 hover:bg-[#0f352f]">Entrar</button>
</form></body></html>
