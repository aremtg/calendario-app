<?php
require __DIR__ . '/../src/bootstrap.php';
$user = require_admin();
?><!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="csrf" content="<?= e($_SESSION['csrf']) ?>">
  <title>Calendario</title>
  <link rel="stylesheet" href="assets/app.css">
  <style>
    body {
      font-family: 'Bricolage Grotesque', system-ui, sans-serif
    }
  </style>
</head>

<body class="min-h-screen flex flex-col bg-[#EEF2EE] text-[#16211F]">
  <header class="px-4 pt-6 flex flex-wrap items-center justify-between gap-y-3">
    <h1 class="text-3xl font-extrabold text-[#14453D]">Calendario</h1>
    <div class="relative hidden md:block flex-1 max-w-xs mx-6">
      <input id="searchInput" type="text" placeholder="Buscar curso, instructor, fecha…"
        class="w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14453D]">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><?= icon('search', 'h-4 w-4') ?></span>
    </div>
    <div class="flex items-center gap-2 sm:gap-3 text-sm">

      <div class="relative">
        <button id="settingsBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Configuración"
          class="grid h-11 w-11 place-items-center rounded-full bg-white text-[#14453D] shadow hover:shadow-md transition">
          <?= icon('settings', 'h-5 w-5') ?>
        </button>
      </div>
      <div class="relative">
        <button id="bellBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Notificaciones"
          class="relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#14453D] shadow hover:shadow-md transition">

          <!-- Ícono bell de Lucide -->
          <?= icon('bell', 'h-[22px] w-[22px]') ?>
          <span id="bellBadge"
            class="hidden absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-amber-400 text-center text-[11px] font-bold leading-5 text-[#16211F]"></span>
        </button>

        <div id="bellPanel"
          class="hidden absolute right-0 z-40 mt-3 w-80 sm:w-96 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 class="font-extrabold">Notificaciones</h2>
            <button id="btnNotif" type="button" class="text-xs font-semibold text-[#14453D] hover:underline">Activar
              avisos del navegador</button>
          </div>
          <ul id="dueList" class="divide-y divide-slate-100"></ul>
        </div>
      </div>
      <span class="hidden sm:inline text-slate-500"><?= e($user['name']) ?></span>
      <a href="logout.php" class="rounded-full bg-[#14453D] text-white px-4 py-1.5">Salir</a>
    </div>
  </header>

  <main class="max-w-6xl w-full flex-1 mx-auto px-4 py-6 space-y-5">


    <div class="grid lg:grid-cols-[1fr_380px] gap-5">
      <section class="bg-white rounded-3xl shadow-lg p-5 sm:p-7">
        <div class="flex justify-end mb-3">
          <button id="btnToday" type="button"
            class="rounded-full border border-[#14453D]/30 px-3 py-1 text-xs font-semibold text-[#14453D] hover:bg-[#EEF2EE]">Este
            mes</button>
        </div>
        <div class="flex flex-wrap justify-end gap-2 mb-4">
          <a id="exportYear" href="#"
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-105 transition"
            style="background: linear-gradient(135deg, #217346 0%, #217346 50%, #C0392B 50%, #C0392B 100%);">
            <?= icon('download', 'h-[15px] w-[15px]') ?>
            Exportar año <span id="exportYearLabel"></span>
          </a>
          <a id="exportMonth" href="#"
            class="inline-flex items-center gap-2 rounded-full bg-[#217346] px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-105 transition">
            <?= icon('download', 'h-[15px] w-[15px]') ?>
            Exportar este mes
          </a>
        </div>
        <div class="flex flex-col sm:flex-row gap-5">
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between mb-5">
              <button id="prev" class="h-10 w-10 rounded-full hover:bg-slate-100 text-xl"
                aria-label="Mes anterior">‹</button>
              <h2 id="monthTitle" class="text-2xl font-extrabold capitalize"></h2>
              <button id="next" class="h-10 w-10 rounded-full hover:bg-slate-100 text-xl"
                aria-label="Mes siguiente">›</button>
            </div>
            <div class="grid grid-cols-7 text-center text-sm font-semibold text-slate-400 mb-2">
              <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
            </div>
            <div id="grid" class="grid grid-cols-7 gap-1.5"></div>
          </div>
          <div class="order-first sm:order-last sm:w-40 shrink-0">
            <p class="text-xs font-semibold text-slate-400 mb-2">Meses con planes</p>
            <div id="monthChips"
              class="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto sm:max-h-[26rem] pb-1">
            </div>
          </div>
        </div>
      </section>

      <aside class="bg-white rounded-3xl shadow-lg p-5 sm:p-7 h-fit">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-slate-500">Planes del día</p>
            <h3 id="dayTitle" class="text-xl font-extrabold capitalize"></h3>
          </div>
          <button id="btnAdd"
            class="rounded-full bg-[#14453D] text-white text-sm font-semibold px-4 py-2 hover:bg-[#0f352f]">Agregar
            plan</button>
        </div>
        <ul id="dayList" class="mt-5 space-y-3 max-h-[55vh] overflow-y-auto pr-1"></ul>
      </aside>
    </div>
  </main>

  <footer class="footer-aura mt-8 w-full text-[#EEF2EE]">
    <div
      class="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-sm sm:flex-row sm:text-left sm:gap-3 sm:py-7">
      <p class="flex items-center gap-2 font-semibold">
        Creado por Tatiana Guzman
        <?= icon('heart', 'h-4 w-4 text-amber-300') ?>
      </p>
      <p class="text-[#EEF2EE]/70">Calendario de planes · <?= date('Y') ?></p>
    </div>
  </footer>

  <div id="modal" class="hidden fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
    <form id="form" class="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 id="formTitle" class="text-xl font-extrabold"></h3>
      <input type="hidden" name="id">
      <input type="hidden" name="plan_date">
      <input type="hidden" name="curso_id">

      <div class="flex items-center justify-between rounded-xl bg-[#EEF2EE] px-4 py-2.5 text-sm">
        <span class="flex items-center gap-2 font-semibold text-[#14453D]">
          <?= icon('calendar-days', 'h-4 w-4') ?>
          <span id="formDateLabel"></span>
        </span>
        <button type="button" id="btnChangeDate" class="text-xs font-semibold text-[#14453D] underline">Cambiar
          día</button>
      </div>
      <input name="plan_date_visible" type="date" class="hidden w-full rounded-xl border border-slate-200 px-3 py-2.5">

      <label class="block text-sm font-semibold">Título o curso
        <input name="title" list="cursosList" required maxlength="160" autocomplete="off"
          class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#14453D]">
        <datalist id="cursosList"></datalist>
      </label>

      <div class="grid grid-cols-2 gap-3 items-start">
        <label class="block text-sm font-semibold">Hora inicio *
          <input name="plan_time" type="time" required
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"></label>
        <label class="block text-sm font-semibold">Hora fin
          <input name="plan_time_end" type="time"
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"></label>
      </div>
      <p id="durationLabel" class="text-xs font-semibold text-[#14453D]"></p>

      <div class="grid grid-cols-2 gap-3">
        <label class="block text-sm font-semibold">Lugar
          <select name="lugar_id" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white">
            <option value="">— Sin lugar —</option>
          </select></label>
        <label class="block text-sm font-semibold">Instructor
          <select name="instructor_id" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white">
            <option value="">— Sin instructor —</option>
          </select></label>
      </div>

      <label class="block text-sm font-semibold">Descripción
        <textarea name="notes" rows="3"
          class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5"></textarea></label>

      <div class="rounded-xl bg-amber-50 p-3 flex items-center gap-3 text-sm">
        <input id="alarm" name="alarm_enabled" type="checkbox" class="h-4 w-4 accent-[#14453D]">
        <label for="alarm" class="font-semibold">Alarma: avisar</label>
        <input name="alarm_days" type="number" min="1" max="365" value="30"
          class="w-16 rounded-lg border border-slate-200 px-2 py-1">
        <span>días antes</span>
      </div>
      <p id="formError" class="hidden text-sm text-red-700"></p>
      <div class="flex justify-end gap-2">
        <button type="button" id="btnCancel" class="rounded-full px-4 py-2 hover:bg-slate-100">Cancelar</button>
        <button class="rounded-full bg-[#14453D] text-white font-semibold px-5 py-2">Guardar plan</button>
      </div>
    </form>
  </div>

  <div id="backupsOverlay" class="hidden fixed inset-0 z-50">
    <div id="backupsBackdrop" class="absolute inset-0 bg-black/40"></div>
    <aside id="backupsDrawer"
      class="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col translate-x-full transition-transform duration-300">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 id="drawerTitle" class="text-lg font-extrabold">Copias de seguridad</h2>
        <button id="closeBackups" type="button" aria-label="Cerrar"
          class="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100">
          <?= icon('x', 'h-[18px] w-[18px]') ?>
        </button>
      </div>
      <div class="flex gap-1 px-5 pt-3 text-xs font-semibold">
        <button data-tab="backups" class="drawer-tab rounded-full px-3 py-1.5 bg-[#14453D] text-white">Copias</button>
        <button data-tab="lugares" class="drawer-tab rounded-full px-3 py-1.5 hover:bg-slate-100">Lugares</button>
        <button data-tab="instructores"
          class="drawer-tab rounded-full px-3 py-1.5 hover:bg-slate-100">Instructores</button>
        <button data-tab="cursos" class="drawer-tab rounded-full px-3 py-1.5 hover:bg-slate-100">Cursos</button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <div id="tabBackups">
          <p class="text-xs text-slate-400 mb-3">Se guardan como máximo 5 copias. Al llegar al límite, la más antigua se
            borra sola.</p>
          <ul id="backupsList" class="space-y-2"></ul>
          <div id="backupLogWrap" class="hidden mt-4 rounded-xl bg-[#EEF2EE] p-3">
            <p class="text-xs font-semibold text-[#14453D] mb-1">Progreso</p>
            <ul id="backupLog" class="space-y-1 text-xs text-slate-600"></ul>
          </div>
        </div>

        <div id="tabLugares" class="hidden space-y-2">
          <form id="formLugar" class="flex gap-2 mb-3">
            <input name="nombre" placeholder="Nombre" required
              class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input name="direccion" placeholder="Dirección"
              class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <button class="rounded-lg bg-[#14453D] text-white px-3"><?= icon('plus', 'h-4 w-4') ?></button>
          </form>
          <ul id="listLugares" class="space-y-2"></ul>
        </div>

        <div id="tabInstructores" class="hidden space-y-2">
          <form id="formInstructor" class="flex gap-2 mb-3">
            <input name="nombre" placeholder="Nombre" required
              class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input name="cargo" placeholder="Cargo" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <button class="rounded-lg bg-[#14453D] text-white px-3"><?= icon('plus', 'h-4 w-4') ?></button>
          </form>
          <ul id="listInstructores" class="space-y-2"></ul>
        </div>

        <div id="tabCursos" class="hidden space-y-2">
          <form id="formCurso" class="flex gap-2 mb-3">
            <input name="nombre" placeholder="Nombre del curso" required
              class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <button class="rounded-lg bg-[#14453D] text-white px-3"><?= icon('plus', 'h-4 w-4') ?></button>
          </form>
          <ul id="listCursos" class="space-y-2"></ul>
        </div>
      </div>
    </aside>
  </div>

  <script src="assets/app.js"></script>
</body>

</html>