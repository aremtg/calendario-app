<?php
require __DIR__ . '/../src/bootstrap.php';
$user = require_admin();
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf" content="<?= e($_SESSION['csrf']) ?>">
<title>Calendario</title>
<link rel="stylesheet" href="assets/app.css">
<style>body{font-family:'Bricolage Grotesque',system-ui,sans-serif}</style></head>
<body class="min-h-screen flex flex-col bg-[#EEF2EE] text-[#16211F]">
<header class=" px-4 pt-6 flex items-center justify-between">
  <h1 class="text-3xl font-extrabold text-[#14453D]">Calendario</h1>
  <div class="flex items-center gap-3 text-sm">
    <div class="relative">
  <button id="bellBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Notificaciones"
    class="relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#14453D] shadow hover:shadow-md transition">
    <!-- Ícono bell de Lucide -->
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
    </svg>
    <span id="bellBadge" class="hidden absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-amber-400 text-center text-[11px] font-bold leading-5 text-[#16211F]"></span>
  </button>

  <div id="bellPanel" class="hidden absolute right-0 z-40 mt-3 w-80 sm:w-96 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
    <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <h2 class="font-extrabold">Notificaciones</h2>
      <button id="btnNotif" type="button" class="text-xs font-semibold text-[#14453D] hover:underline">Activar avisos del navegador</button>
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
    <button id="btnToday" type="button" class="rounded-full border border-[#14453D]/30 px-3 py-1 text-xs font-semibold text-[#14453D] hover:bg-[#EEF2EE]">Este mes</button>
  </div>
  <div class="flex flex-col sm:flex-row gap-5">
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between mb-5">
        <button id="prev" class="h-10 w-10 rounded-full hover:bg-slate-100 text-xl" aria-label="Mes anterior">‹</button>
        <h2 id="monthTitle" class="text-2xl font-extrabold capitalize"></h2>
        <button id="next" class="h-10 w-10 rounded-full hover:bg-slate-100 text-xl" aria-label="Mes siguiente">›</button>
      </div>
      <div class="grid grid-cols-7 text-center text-sm font-semibold text-slate-400 mb-2">
        <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
      </div>
      <div id="grid" class="grid grid-cols-7 gap-1.5"></div>
    </div>
    <div class="order-first sm:order-last sm:w-40 shrink-0">
      <p class="text-xs font-semibold text-slate-400 mb-2">Meses con planes</p>
      <div id="monthChips" class="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto sm:max-h-[26rem] pb-1"></div>
    </div>
  </div>
</section>

    <aside class="bg-white rounded-3xl shadow-lg p-5 sm:p-7 h-fit">
      <div class="flex items-start justify-between gap-3">
        <div><p class="text-sm text-slate-500">Planes del día</p>
        <h3 id="dayTitle" class="text-xl font-extrabold capitalize"></h3></div>
        <button id="btnAdd" class="rounded-full bg-[#14453D] text-white text-sm font-semibold px-4 py-2 hover:bg-[#0f352f]">Agregar plan</button>
      </div>
      <ul id="dayList" class="mt-5 space-y-3 max-h-[55vh] overflow-y-auto pr-1"></ul>
    </aside>
  </div>
</main>

<footer class="footer-aura mt-8 text-[#EEF2EE]">
  <div class="relative z-10 mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-7 text-sm sm:flex-row">
    <p class="flex items-center gap-2 font-semibold">
      Creado por Tatiana Guzman
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-300" aria-hidden="true">
        <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>
      </svg>
    </p>
    <p class="text-[#EEF2EE]/70">Calendario de planes · <?= date('Y') ?></p>
  </div>
</footer>

<div id="modal" class="hidden fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
  <form id="form" class="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
    <h3 id="formTitle" class="text-xl font-extrabold"></h3>
    <input type="hidden" name="id">
    <label class="block text-sm font-semibold">Título
      <input name="title" required maxlength="160" class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#14453D]"></label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-semibold">Fecha
        <input name="plan_date" type="date" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"></label>
      <label class="block text-sm font-semibold">Hora
        <input name="plan_time" type="time" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"></label>
    </div>
    <label class="block text-sm font-semibold">Notas
      <textarea name="notes" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5"></textarea></label>
    <div class="rounded-xl bg-amber-50 p-3 flex items-center gap-3 text-sm">
      <input id="alarm" name="alarm_enabled" type="checkbox" class="h-4 w-4 accent-[#14453D]">
      <label for="alarm" class="font-semibold">Alarma: avisar</label>
      <input name="alarm_days" type="number" min="1" max="365" value="30" class="w-16 rounded-lg border border-slate-200 px-2 py-1">
      <span>días antes</span>
    </div>
    <p id="formError" class="hidden text-sm text-red-700"></p>
    <div class="flex justify-end gap-2">
      <button type="button" id="btnCancel" class="rounded-full px-4 py-2 hover:bg-slate-100">Cancelar</button>
      <button class="rounded-full bg-[#14453D] text-white font-semibold px-5 py-2">Guardar plan</button>
    </div>
  </form>
</div>
<script src="assets/app.js"></script>
</body></html>
