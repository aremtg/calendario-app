/*
 * Punto de entrada del frontend.
 * El archivo está organizado por responsabilidades: estado del calendario,
 * llamadas a la API, renderizado, modal de planes, notificaciones, backups,
 * catálogos y buscador.
 *
 * Los selectores que apuntan a elementos obligatorios se validan al usarlos.
 * Esto evita que un elemento opcional rompa todo el JavaScript de la página.
 */
const csrfMeta = document.querySelector("meta[name=csrf]");
const csrf = csrfMeta?.content ?? "";
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const todayISO = iso(new Date());

const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
let view = new Date();
view.setDate(1);
let selected = todayISO,
  plans = [],
  monthsWithPlans = [];

// Recordar mes y día al refrescar (solo "Este mes" te devuelve al actual)
const KEY = "calendario:estado";
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (
    s &&
    /^\d{4}-\d{2}$/.test(s.view) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.selected)
  ) {
    view = new Date(s.view + "-01T00:00");
    selected = s.selected;
  }
} catch {}
const saveState = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ view: ym(view), selected }));
  } catch {}
};

/**
 * Cliente HTTP único de la aplicación.
 * - GET cuando no hay datos.
 * - POST JSON cuando hay datos.
 * - Convierte respuestas no-JSON (por ejemplo, un error PHP) en un mensaje
 *   entendible en lugar de lanzar "Unexpected token < in JSON".
 */
async function api(action, data) {
  const opt = data
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF": csrf },
        body: JSON.stringify(data),
      }
    : {};

  const response = await fetch(`api.php?action=${action}`, opt);
  const text = await response.text();

  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `El servidor respondió con un formato inesperado (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(json.error || `Error del servidor (HTTP ${response.status}).`);
  }

  return json;
}

async function load() {
  const [list, months] = await Promise.all([
    api(`list&month=${ym(view)}`),
    api("months"),
  ]);
  plans = list;
  monthsWithPlans = months;
  renderCalendar();
  renderDay();
  renderMonths();
  // Las notificaciones no deben impedir que el calendario termine de cargar.
  loadDue().catch((err) => console.error("No se pudieron cargar los avisos:", err));
}

function renderMonths() {
  const cur = ym(view);
  $("#monthChips").innerHTML = monthsWithPlans.length
    ? monthsWithPlans
        .map((m) => {
          const [y, mo] = m.ym.split("-");
          const label = new Date(+y, +mo - 1, 1).toLocaleDateString("es", {
            month: "short",
            year: "numeric",
          });
          const active = m.ym === cur;
          return `<button data-month="${m.ym}" data-first="${m.first_date}" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize text-left ${active ? "bg-[#ff0000] text-white" : "bg-[#F9FAFB] hover:bg-slate-200"}">
      ${label}<span class="ml-1.5 rounded-full px-1.5 ${active ? "bg-white/25" : "bg-amber-200"}">${m.total}</span></button>`;
        })
        .join("")
    : '<p class="text-xs text-slate-400">Aún no hay planes.</p>';
}

function renderCalendar() {
  $("#monthTitle").textContent = view.toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });
  const offset = (view.getDay() + 6) % 7; // semana inicia lunes
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  let html = "<span></span>".repeat(offset);
  for (let d = 1; d <= days; d++) {
    const date = `${view.getFullYear()}-${pad(view.getMonth() + 1)}-${pad(d)}`;
    const dayPlans = plans.filter((p) => p.plan_date === date);
    const pending = dayPlans.filter((p) => !+p.is_done).length,
      done = dayPlans.length - pending;
    const isSel = date === selected,
      isToday = date === todayISO;
    const isHit = searchHighlight?.dates.has(date);
    html += `<button data-date="${date}" class="aspect-square rounded-2xl flex flex-col items-center justify-center text-sm font-semibold transition
  ${isHit ? "bg-[#FEF2F2] text-[#ff0000] ring-1 ring-[#FECACA] shadow-sm" : isSel ? "bg-[#ff0000] text-white shadow-sm" : "hover:bg-[#F9FAFB]"}
  ${isToday && !isSel && !isHit ? "ring-2 ring-amber-400" : ""}">
      ${d}<span class="flex gap-0.5 mt-1 h-1.5">
      ${pending ? `<i class="h-1.5 w-1.5 rounded-full bg-amber-400"></i>` : ""}${done ? `<i class="h-1.5 w-1.5 rounded-full bg-emerald-500"></i>` : ""}</span></button>`;
  }
  $("#grid").innerHTML = html;
  saveState();
  updateExportLinks();
}

// ---------- Lista de planes del día (con resaltado de búsqueda) ----------
function renderDay() {
  const d = new Date(selected + "T00:00");
  $("#dayTitle").textContent = d.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const list = plans.filter((p) => p.plan_date === selected);

  $("#dayList").innerHTML = list.length
    ? list
        .map((p) => {
          // Esta variable extra es la razón por la que hace falta "return {}" en vez de una sola línea de plantilla.
          const isHitCard = searchHighlight?.planIds.has(String(p.id));
          const hora = p.plan_time
            ? p.plan_time.slice(0, 5) +
              (p.plan_time_end ? ` – ${p.plan_time_end.slice(0, 5)}` : "")
            : "Todo el día";

          return `
    <li class="rounded-2xl border p-4 ${isHitCard ? "bg-[#FEF2F2] border-[#FECACA] text-[#1F2937]" : +p.is_done ? "bg-slate-50 border-slate-200" : "border-slate-200"}">
      <div class="flex items-start gap-3">
        <button data-act="toggle" data-id="${p.id}" class="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 ${+p.is_done ? "bg-emerald-500 border-emerald-500 text-white" : isHitCard ? "border-[#ff0000]" : "border-slate-300"} text-xs" aria-label="Marcar como hecho">${+p.is_done ? "✓" : ""}</button>
        <div class="min-w-0 flex-1">
          <p class="font-semibold ${!isHitCard && +p.is_done ? "line-through text-slate-400" : ""}">${esc(p.title)}</p>
          <p class="text-xs ${isHitCard ? "text-[#6B7280]" : "text-slate-500"}">${hora}${+p.alarm_enabled ? ` · Alarma ${p.alarm_days} días antes` : ""}</p>
          ${p.curso_nombre ? `<p class="text-xs mt-2 ${isHitCard ? "text-[#6B7280]" : "text-slate-500"}"><strong>Curso:</strong> ${esc(p.curso_nombre)}</p>` : ""}
          ${p.instructor_nombre ? `<p class="text-xs ${isHitCard ? "text-[#6B7280]" : "text-slate-500"}"><strong>Instructor:</strong> ${esc(p.instructor_nombre)}</p>` : ""}
          ${p.lugar_nombre ? `<p class="text-xs ${isHitCard ? "text-[#6B7280]" : "text-slate-500"}"><strong>Lugar:</strong> ${esc(p.lugar_nombre)}</p>` : ""}
          ${p.notes ? `<p class="text-sm mt-1 ${isHitCard ? "text-[#4B5563]" : "text-slate-600"}">${esc(p.notes)}</p>` : ""}
        </div>
      </div>
      <div class="mt-3 flex gap-2 justify-end text-xs font-semibold">
        <button data-act="view" data-id="${p.id}" class="rounded-full px-3 py-1 ${isHitCard ? "hover:bg-red-100" : "hover:bg-slate-100"}">Ver plan</button>
        <button data-act="edit" data-id="${p.id}" class="rounded-full px-3 py-1 ${isHitCard ? "hover:bg-red-100" : "hover:bg-slate-100"}">Editar</button>
        <button data-act="delete" data-id="${p.id}" class="rounded-full px-3 py-1 ${isHitCard ? "text-[#ff0000] hover:bg-red-100" : "text-red-600 hover:bg-red-50"}">Eliminar</button>
      </div>
    </li>`;
        })
        .join("")
    : '<li class="text-sm text-slate-500 py-6 text-center">No hay planes este día. Agrega el primero.</li>';
}

let notified = false;
async function loadDue() {
  const due = await api("due");
  const badge = $("#bellBadge");
  badge.textContent = due.length > 9 ? "9+" : due.length;
  badge.classList.toggle("hidden", !due.length);

  $("#dueList").innerHTML = due.length
    ? due
        .map((p) => {
          const n = +p.days_left;
          const [label, tone] =
            n < 0
              ? [`Venció hace ${-n} día(s)`, "text-red-600"]
              : n === 0
                ? ["Vence hoy", "text-amber-600"]
                : n === 1
                  ? ["Vence mañana", "text-amber-600"]
                  : [`Vence en ${n} días`, "text-slate-500"];
          return `<li><button data-goto="${p.plan_date}" class="w-full px-4 py-3 text-left hover:bg-[#F9FAFB]">
      <p class="text-sm font-semibold">${esc(p.title)}</p>
      <p class="text-xs ${tone}">${label} · ${p.plan_date}</p></button></li>`;
        })
        .join("")
    : '<li class="px-4 py-8 text-center text-sm text-slate-500">Estás al día. No hay avisos pendientes.</li>';

  if (
    due.length &&
    !notified &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    notified = true;
    new Notification("Planes por vencer", {
      body: `Tienes ${due.length} aviso(s) pendientes.`,
    });
  }
}

// ---------- Modal de plan (crear / editar) ----------
const modal = $("#modal"),
  form = $("#form");

function openForm(p) {
  form.reset();
  $("#formError").classList.add("hidden");
  $("#formTitle").textContent = p ? "Editar plan" : "Nuevo plan";

  form.id.value = p?.id ?? "";
  form.title.value = p?.title ?? "";

  // Fecha: se asume del día seleccionado y queda oculta hasta que el usuario pida cambiarla.
  const dateVal = p?.plan_date ?? selected;
  form.plan_date.value = dateVal;
  form.plan_date_visible.value = dateVal;
  form.plan_date_visible.classList.add("hidden");
  $("#formDateLabel").textContent = new Date(
    dateVal + "T00:00",
  ).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  form.plan_time.value = p?.plan_time?.slice(0, 5) ?? "";
  form.plan_time_end.value = p?.plan_time_end?.slice(0, 5) ?? "";
  form.lugar_id.value = p?.lugar_id ?? "";
  form.instructor_id.value = p?.instructor_id ?? "";
  form.curso_id.value = p?.curso_id ?? "";
  form.notes.value = p?.notes ?? "";
  form.alarm_enabled.checked = p ? !!+p.alarm_enabled : true;
  form.alarm_days.value = p?.alarm_days ?? 30;

  updateDuration();
  modal.classList.remove("hidden");
  form.title.focus();
}
const closeForm = () => modal.classList.add("hidden");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  delete data.plan_date_visible; // solo era un campo auxiliar para mostrar el selector
  data.alarm_enabled = form.alarm_enabled.checked;
  try {
    await api(data.id ? "update" : "create", data);
    selected = data.plan_date;
    view = new Date(selected + "T00:00");
    view.setDate(1);
    closeForm();
    load();
  } catch (err) {
    const el = $("#formError");
    el.textContent = err.message;
    el.classList.remove("hidden");
  }
});

$("#btnAdd").onclick = () => openForm();
$("#btnCancel").onclick = closeForm;
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeForm();
});
$("#prev").onclick = () => {
  view.setMonth(view.getMonth() - 1);
  load();
};
$("#next").onclick = () => {
  view.setMonth(view.getMonth() + 1);
  load();
};
$("#grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-date]");
  if (!b) return;
  selected = b.dataset.date;
  renderCalendar();
  renderDay();
});
let viewedPlan = null;
const viewPlanModal = $("#viewPlanModal");
const closeViewPlan = () => {
  viewedPlan = null;
  viewPlanModal.classList.add("hidden");
};
function showPlan(p) {
  if (!p) return;
  viewedPlan = p;
  $("#viewPlanTitle").textContent = p.title || "Plan";
  const date = p.plan_date ? new Date(p.plan_date + "T00:00") : null;
  const dateLabel = date ? date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—";
  const hora = p.plan_time ? p.plan_time.slice(0,5) + (p.plan_time_end ? ` – ${p.plan_time_end.slice(0,5)}` : "") : "Todo el día";
  const status = +p.is_done ? "Completado" : "Pendiente";
  $("#viewPlanContent").innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="rounded-2xl bg-[#F9FAFB] p-3"><p class="text-xs text-slate-500">Fecha</p><p class="font-semibold capitalize">${esc(dateLabel)}</p></div>
      <div class="rounded-2xl bg-[#F9FAFB] p-3"><p class="text-xs text-slate-500">Horario</p><p class="font-semibold">${esc(hora)}</p></div>
      <div class="rounded-2xl bg-[#F9FAFB] p-3"><p class="text-xs text-slate-500">Curso</p><p class="font-semibold">${esc(p.curso_nombre || "Sin curso")}</p></div>
      <div class="rounded-2xl bg-[#F9FAFB] p-3"><p class="text-xs text-slate-500">Instructor</p><p class="font-semibold">${esc(p.instructor_nombre || "Sin instructor")}</p></div>
      <div class="rounded-2xl bg-[#F9FAFB] p-3"><p class="text-xs text-slate-500">Lugar</p><p class="font-semibold">${esc(p.lugar_nombre || "Sin lugar")}</p></div>
      <div class="rounded-2xl bg-[#F9FAFB] p-3"><p class="text-xs text-slate-500">Estado</p><p class="font-semibold">${status}</p></div>
    </div>
    ${p.notes ? `<div class="rounded-2xl border border-slate-200 p-4"><p class="text-xs text-slate-500">Descripción</p><p class="mt-1 whitespace-pre-wrap text-sm">${esc(p.notes)}</p></div>` : ""}
    ${+p.alarm_enabled ? `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><strong>Alarma:</strong> ${esc(p.alarm_days)} días antes</div>` : ""}`;
  viewPlanModal.classList.remove("hidden");
}
$("#closeViewPlan").addEventListener("click", closeViewPlan);
$("#viewPlanCancel").addEventListener("click", closeViewPlan);
viewPlanModal.addEventListener("click", (e) => { if (e.target === viewPlanModal) closeViewPlan(); });
$("#viewPlanEdit").addEventListener("click", () => { if (viewedPlan) { const p = viewedPlan; closeViewPlan(); openForm(p); } });
$("#viewPlanDelete").addEventListener("click", async () => {
  if (!viewedPlan || !confirm("¿Eliminar este plan?")) return;
  try {
    await api("delete", { id: viewedPlan.id });
    closeViewPlan();
    await load();
  } catch (err) { alert(err.message); }
});

$("#dayList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const id = +b.dataset.id,
    p = plans.find((x) => +x.id === id);
  if (b.dataset.act === "view") {
    if (p) showPlan(p);
    return;
  }
  if (b.dataset.act === "edit") {
    if (p) openForm(p);
    return;
  }
  if (b.dataset.act === "delete" && !confirm("¿Eliminar este plan?")) return;

  try {
    await api(b.dataset.act, { id });
    await load();
  } catch (err) {
    console.error("No se pudo actualizar el plan:", err);
    alert(err.message);
  }
});
$("#btnNotif").onclick = async () => {
  if ("Notification" in window) {
    await Notification.requestPermission();
    loadDue();
  }
};

// ---------- Campana de notificaciones ----------
const bellPanel = $("#bellPanel"),
  bellBtn = $("#bellBtn");
const setBell = (open) => {
  bellPanel.classList.toggle("hidden", !open);
  bellBtn.setAttribute("aria-expanded", open);
};
bellBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setBell(bellPanel.classList.contains("hidden"));
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#bellPanel")) setBell(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setBell(false);
});

$("#dueList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-goto]");
  if (!b) return;
  selected = b.dataset.goto;
  view = new Date(selected + "T00:00");
  view.setDate(1);
  setBell(false);
  load();
});

$("#btnToday").onclick = () => {
  view = new Date();
  view.setDate(1);
  selected = iso(new Date());
  load();
};

$("#monthChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-month]");
  if (!b) return;
  view = new Date(b.dataset.month + "-01T00:00");
  selected = b.dataset.first;
  load();
});

// ---------- Copias de seguridad ----------
const backupsOverlay = $("#backupsOverlay"),
  backupsDrawer = $("#backupsDrawer");
const openBackups = () => {
  setBell(false);
  backupsOverlay.classList.remove("hidden");
  requestAnimationFrame(() =>
    backupsDrawer.classList.remove("translate-x-full"),
  );
  loadBackups();
};
const closeBackups = () => {
  backupsDrawer.classList.add("translate-x-full");
  setTimeout(() => backupsOverlay.classList.add("hidden"), 300);
};
$("#settingsBtn").onclick = openBackups;
$("#closeBackups").onclick = closeBackups;
$("#backupsBackdrop").onclick = closeBackups;

let moreIcon = "";
async function ensureIcons() {
  if (moreIcon) return;
  const svg = await (await fetch("assets/icons/more-vertical.svg")).text();
  moreIcon = svg.replace("<svg ", '<svg class="h-[18px] w-[18px]" ');
}
const fmtSize = (b) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

async function loadBackups() {
  await ensureIcons();
  const list = await api("backups_list");
  $("#backupsList").innerHTML = list.length
    ? list
        .map(
          (b) => `
    <li class="relative rounded-xl border border-slate-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold">${esc(b.file)}</p>
          <p class="text-xs text-slate-500">${b.created_at} · ${fmtSize(b.size)}</p>
        </div>
        <button data-menu="${esc(b.file)}" class="shrink-0 grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100" aria-label="Más opciones">${moreIcon}</button>
      </div>
      <div data-menu-panel="${esc(b.file)}" class="hidden absolute right-3 top-12 z-10 w-56 rounded-xl bg-white shadow-xl ring-1 ring-black/5 py-1 text-sm">
        <button data-act="restore" data-file="${esc(b.file)}" class="w-full px-4 py-2 text-left hover:bg-[#F9FAFB]">Restablecer esta copia</button>
        <button data-act="drive" data-file="${esc(b.file)}" class="w-full px-4 py-2 text-left hover:bg-[#F9FAFB]">Guardar en Google Drive</button>
        <button data-act="delete" data-file="${esc(b.file)}" class="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50">Eliminar</button>
      </div>
    </li>`,
        )
        .join("")
    : '<li class="text-sm text-slate-500 py-6 text-center">Aún no hay copias de seguridad.</li>';
}

function logLine(msg) {
  const wrap = $("#backupLogWrap"),
    ul = $("#backupLog");
  wrap.classList.remove("hidden");
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString("es")} — ${msg}`;
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

$("#backupsList").addEventListener("click", async (e) => {
  const menuBtn = e.target.closest("[data-menu]");
  if (menuBtn) {
    const panel = document.querySelector(
      `[data-menu-panel="${CSS.escape(menuBtn.dataset.menu)}"]`,
    );
    if (!panel) return;
    const open = panel.classList.contains("hidden");
    document
      .querySelectorAll("[data-menu-panel]")
      .forEach((p) => p.classList.add("hidden"));
    panel.classList.toggle("hidden", !open);
    return;
  }
  const actBtn = e.target.closest("[data-act]");
  if (!actBtn) return;
  const { act, file } = actBtn.dataset;
  document
    .querySelectorAll("[data-menu-panel]")
    .forEach((p) => p.classList.add("hidden"));

  try {
    if (act === "delete") {
      if (!confirm(`¿Eliminar la copia ${file}?`)) return;
      await api("backups_delete", { file });
      await loadBackups();
      return;
    }

    if (act === "restore") {
      if (
        !confirm(
          `¿Restablecer los planes de ${file}? Se agregarán como planes nuevos.`,
        )
      )
        return;

      logLine(`Restableciendo ${file}…`);
      const r = await api("backups_restore", { file });
      logLine(`${r.restored} plan(es) restablecidos.`);
      await load();
      return;
    }

    if (act === "drive") {
      logLine(`Preparando ${file} para Google Drive…`);
      const r = await api(`backups_download&file=${encodeURIComponent(file)}`);
      const blob = new Blob(
        [Uint8Array.from(atob(r.content), (c) => c.charCodeAt(0))],
        { type: "application/sql" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = r.file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      logLine(
        "Archivo listo. Conecta tu cuenta de Drive para subirlo automáticamente.",
      );
    }
  } catch (err) {
    logLine(`Error: ${err.message}`);
  }
});

document.addEventListener("click", (e) => {
  if (
    !e.target.closest("[data-menu]") &&
    !e.target.closest("[data-menu-panel]")
  )
    document
      .querySelectorAll("[data-menu-panel]")
      .forEach((p) => p.classList.add("hidden"));
});

/*
 * El botón existe en la versión actual de index.php, pero el guard evita
 * que una vista antigua o personalizada vuelva a detener todo app.js.
 */
$("#btnCreateBackup")?.addEventListener("click", async () => {
  const btn = $("#btnCreateBackup");
  if (!btn) return;

  btn.disabled = true;
  const log = $("#backupLog");
  if (log) log.innerHTML = "";

  try {
    logLine("Preparando usuarios y planes…");
    logLine("Generando archivo .sql…");
    const r = await api("backups_create", {});
    logLine(`Copia creada: ${r.backup.file}`);
    await loadBackups();
  } catch (err) {
    logLine(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

function updateExportLinks() {
  $("#exportYear").href = `export.php?type=year&year=${view.getFullYear()}`;
  $("#exportYearLabel").textContent = view.getFullYear();
  $("#exportMonth").href = `export.php?type=month&month=${ym(view)}`;
}

// ---------- Catálogos (lugares, instructores, cursos) ----------
let catalogs = { lugares: [], instructores: [], cursos: [] };

async function loadCatalogs() {
  const [lugares, instructores, cursos] = await Promise.all([
    api("lugares&sub=list"),
    api("instructores&sub=list"),
    api("cursos&sub=list"),
  ]);
  catalogs = { lugares, instructores, cursos };
  fillCatalogSelects();
}

function fillCatalogSelects() {
  const optHtml = (items) =>
    items
      .map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`)
      .join("");
  // conservamos el valor elegido en el modal antes de reescribir las opciones
  const curLugar = form.lugar_id.value,
    curInstructor = form.instructor_id.value;
  form.lugar_id.innerHTML =
    '<option value="">— Sin lugar —</option>' + optHtml(catalogs.lugares);
  form.instructor_id.innerHTML =
    '<option value="">— Sin instructor —</option>' +
    optHtml(catalogs.instructores);
  form.lugar_id.value = curLugar;
  form.instructor_id.value = curInstructor;
  $("#cursosList").innerHTML = catalogs.cursos
    .map((c) => `<option value="${esc(c.nombre)}" data-id="${c.id}">`)
    .join("");
}

const trashIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const editIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

function renderCatalogList(container, items, kind) {
  container.innerHTML = items.length
    ? items.map(i => {
        const extra = kind === "lugares" ? i.direccion : kind === "instructores" ? [i.cedula ? `C.C. ${i.cedula}` : "", i.cargo || ""].filter(Boolean).join(" · ") : null;
        return `<li class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <div class="min-w-0"><p class="font-semibold truncate">${esc(i.nombre)}</p>
            ${extra ? `<p class="text-xs text-slate-500 truncate">${esc(extra)}</p>` : ""}</div>
          <div class="flex shrink-0 gap-1">
            <button type="button" data-catalog-action="edit" data-kind="${kind}" data-id="${i.id}" class="text-[#ff0000] hover:bg-[#F9FAFB] rounded-full p-1.5" title="Editar">${editIconSvg}</button>
            <button type="button" data-catalog-action="delete" data-kind="${kind}" data-id="${i.id}" class="text-red-600 hover:bg-red-50 rounded-full p-1.5" title="Eliminar">${trashIconSvg}</button>
          </div>
        </li>`;
      }).join("")
    : '<li class="text-xs text-slate-400 text-center py-4">Aún no hay registros.</li>';
}

async function refreshCatalogTab(kind) {
  const map = { lugares: "#listLugares", instructores: "#listInstructores", cursos: "#listCursos" };
  await loadCatalogs();
  renderCatalogList($(map[kind]), catalogs[kind], kind);
}

["Lugar", "Instructor", "Curso"].forEach((name) => {
  const kind = name.toLowerCase() + (name === "Curso" ? "s" : "es");
  $(`#form${name}`)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = Object.fromEntries(new FormData(f));
    try {
      await api(`${kind}&sub=create`, data);
      f.reset();
      await refreshCatalogTab(kind);
    } catch (err) {
      console.error(`No se pudo crear ${kind}:`, err);
      alert(err.message);
    }
  });
});

const catalogEditModal = $("#catalogEditModal");
const catalogEditForm = $("#catalogEditForm");
const closeCatalogEdit = () => catalogEditModal.classList.add("hidden");

function openCatalogEdit(kind, id) {
  const item = catalogs[kind]?.find(x => +x.id === +id);
  if (!item) return;
  catalogEditForm.reset();
  catalogEditForm.id.value = item.id;
  catalogEditForm.kind.value = kind;
  catalogEditForm.nombre.value = item.nombre || "";
  const extraWrap = $("#catalogEditExtraWrap");
  const extraInput = catalogEditForm.extra;
  const oldCedula = catalogEditForm.querySelector('[name="cedula"]');
  if (oldCedula) oldCedula.remove();
  if (kind === "lugares") {
    extraWrap.classList.remove("hidden");
    $("#catalogEditExtraLabel").textContent = "Dirección";
    extraInput.name = "direccion";
    extraInput.value = item.direccion || "";
  } else if (kind === "instructores") {
    extraWrap.classList.remove("hidden");
    $("#catalogEditExtraLabel").textContent = "Cédula / Cargo";
    extraInput.name = "cargo";
    extraInput.value = item.cargo || "";
    extraInput.placeholder = "Cargo";
    let cedula = catalogEditForm.querySelector('[name="cedula"]');
    if (!cedula) {
      cedula = document.createElement("input");
      cedula.name = "cedula";
      cedula.inputMode = "numeric";
      cedula.className = extraInput.className;
      cedula.placeholder = "Cédula (opcional)";
      extraWrap.insertBefore(cedula, extraInput);
    }
    cedula.value = item.cedula || "";
  } else {
    extraWrap.classList.add("hidden");
    extraInput.name = "extra";
    extraInput.value = "";
  }
  $("#catalogEditTitle").textContent = `Editar ${kind === "lugares" ? "lugar" : kind === "instructores" ? "instructor" : "curso"}`;
  $("#catalogEditError").classList.add("hidden");
  catalogEditModal.classList.remove("hidden");
  catalogEditForm.nombre.focus();
}

catalogEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const kind = catalogEditForm.kind.value;
  const data = Object.fromEntries(new FormData(catalogEditForm));
  delete data.kind;
  delete data.extra;
  try {
    await api(`${kind}&sub=update`, data);
    closeCatalogEdit();
    await refreshCatalogTab(kind);
    // Los planes mantienen el mismo ID del catálogo. Al volver a cargarlos,
    // muestran automáticamente el nuevo nombre/dato editado en todos ellos.
    await load();
  } catch (err) {
    $("#catalogEditError").textContent = err.message;
    $("#catalogEditError").classList.remove("hidden");
  }
});

$("#catalogEditClose").addEventListener("click", closeCatalogEdit);
$("#catalogEditCancel").addEventListener("click", closeCatalogEdit);
catalogEditModal.addEventListener("click", (e) => { if (e.target === catalogEditModal) closeCatalogEdit(); });

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-catalog-action]");
  if (!b) return;
  const kind = b.dataset.kind;
  const id = b.dataset.id;
  if (b.dataset.catalogAction === "edit") {
    openCatalogEdit(kind, id);
    return;
  }
  if (b.dataset.catalogAction === "delete") {
    const item = catalogs[kind]?.find(x => +x.id === +id);
    if (!item || !confirm(`¿Eliminar "${item.nombre}"?\n\nSi ya está usado en planes, esos planes quedarán sin ${kind === "lugares" ? "lugar" : kind === "instructores" ? "instructor" : "curso"}.`)) return;
    try {
      await api(`${kind}&sub=delete`, { id });
      await refreshCatalogTab(kind);
      await load();
    } catch (err) {
      console.error("No se pudo eliminar el registro:", err);
      alert(err.message);
    }
  }
});

// Pestañas del panel de ajustes
document.querySelectorAll(".drawer-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".drawer-tab")
      .forEach((t) => t.classList.remove("bg-[#ff0000]", "text-white"));
    tab.classList.add("bg-[#ff0000]", "text-white");
    ["Backups", "Lugares", "Instructores", "Cursos"].forEach((s) =>
      $(`#tab${s}`).classList.add("hidden"),
    );
    const map = {
      backups: "Backups",
      lugares: "Lugares",
      instructores: "Instructores",
      cursos: "Cursos",
    };
    $(`#tab${map[tab.dataset.tab]}`).classList.remove("hidden");
    $("#drawerTitle").textContent = tab.textContent;
    if (tab.dataset.tab !== "backups") refreshCatalogTab(tab.dataset.tab);
  });
});

// ---------- Duración en vivo (Hora inicio / Hora fin) ----------
function updateDuration() {
  const start = form.plan_time.value,
    end = form.plan_time_end.value;
  const label = $("#durationLabel");
  if (!start) {
    label.textContent = "";
    return;
  }
  if (!end) {
    label.textContent = "= No se sabe la hora fin";
    return;
  }
  const [sh, sm] = start.split(":").map(Number),
    [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // cruza medianoche
  label.textContent = `= ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}min`;
}
form.plan_time.addEventListener("input", updateDuration);
form.plan_time_end.addEventListener("input", updateDuration);

// ---------- Fecha oculta / visible en el modal ----------
$("#btnChangeDate").onclick = () => {
  const willShow = form.plan_date_visible.classList.contains("hidden");
  form.plan_date_visible.classList.toggle("hidden", !willShow);
  if (willShow) form.plan_date_visible.value = form.plan_date.value;
};
form.plan_date_visible.addEventListener("change", () => {
  form.plan_date.value = form.plan_date_visible.value;
  $("#formDateLabel").textContent = new Date(
    form.plan_date.value + "T00:00",
  ).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
});

// ---------- Autocompletar curso_id cuando el título coincide con un curso ----------
form.title.addEventListener("input", () => {
  const match = catalogs.cursos.find(
    (c) => c.nombre.toLowerCase() === form.title.value.toLowerCase(),
  );
  form.curso_id.value = match ? match.id : "";
});

// ---------- Buscador global con resaltado y navegación ----------
let searchHighlight = null; // { dates: Set, planIds: Set }
let searchResults = [];
let searchCurrentIndex = -1;
let searchTimeout;
let searchRequestId = 0;

const searchInput = $("#searchInput");
const searchNavigator = $("#searchNavigator");
const searchCount = $("#searchCount");
const searchPrev = $("#searchPrev");
const searchNext = $("#searchNext");
const searchClear = $("#searchClear");

function updateSearchNavigator() {
  if (!searchInput || !searchNavigator) return;

  const total = searchResults.length;
  if (!searchInput.value.trim()) {
    searchNavigator.classList.add("hidden");
    return;
  }

  searchNavigator.classList.remove("hidden");

  if (!total) {
    searchCount.textContent = "0 coincidencias";
    searchPrev.disabled = true;
    searchNext.disabled = true;
    return;
  }

  searchCount.textContent = `${searchCurrentIndex + 1} de ${total} coincidencia${total === 1 ? "" : "s"}`;
  searchPrev.disabled = total <= 1;
  searchNext.disabled = total <= 1;
}

async function goToSearchResult(index) {
  if (!searchResults.length) return;

  searchCurrentIndex = (index + searchResults.length) % searchResults.length;
  const result = searchResults[searchCurrentIndex];

  view = new Date(result.plan_date + "T00:00");
  view.setDate(1);
  selected = result.plan_date;

  updateSearchNavigator();
  await load();

  // Lleva la vista hasta el plan encontrado cuando está visible en la lista del día.
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-act="view"][data-id="${CSS.escape(String(result.id))}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function updateSearchClearButton() {
  if (!searchInput || !searchClear) return;
  const hasText = searchInput.value.length > 0;
  searchClear.classList.toggle("hidden", !hasText);
  searchClear.classList.toggle("flex", hasText);
}

searchInput?.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  updateSearchClearButton();
  const q = e.target.value.trim();
  searchTimeout = setTimeout(() => runSearch(q), 250);
});

searchClear?.addEventListener("click", () => {
  clearTimeout(searchTimeout);
  if (!searchInput) return;
  searchInput.value = "";
  updateSearchClearButton();
  runSearch("");
  searchInput.focus();
});

searchPrev?.addEventListener("click", () => {
  if (searchResults.length) goToSearchResult(searchCurrentIndex - 1);
});

searchNext?.addEventListener("click", () => {
  if (searchResults.length) goToSearchResult(searchCurrentIndex + 1);
});

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && searchResults.length) {
    e.preventDefault();
    goToSearchResult(searchCurrentIndex + 1);
  } else if (e.key === "Escape") {
    e.preventDefault();
    searchInput.value = "";
    updateSearchClearButton();
    runSearch("");
  }
});

async function runSearch(q) {
  const requestId = ++searchRequestId;

  if (!q) {
    searchResults = [];
    searchCurrentIndex = -1;
    searchHighlight = null;
    updateSearchNavigator();
    renderCalendar();
    renderDay();
    return;
  }

  try {
    const results = await api("search", { title: q });

    // Si el usuario ya escribió otra búsqueda, descartamos esta respuesta.
    if (requestId !== searchRequestId) return;

    searchResults = results;
    searchCurrentIndex = results.length ? 0 : -1;
    searchHighlight = {
      dates: new Set(results.map((r) => r.plan_date)),
      planIds: new Set(results.map((r) => String(r.id))),
    };

    updateSearchNavigator();

    if (!results.length) {
      renderCalendar();
      renderDay();
      return;
    }

    await goToSearchResult(0);
  } catch (err) {
    if (requestId === searchRequestId) {
      searchResults = [];
      searchCurrentIndex = -1;
      updateSearchNavigator();
      console.error("Error en la búsqueda:", err);
    }
  }
}

updateSearchClearButton();

/*
 * Inicialización controlada.
 * Si falla un catálogo, el calendario todavía puede arrancar; y si falla el
 * calendario, el error queda registrado con contexto para poder diagnosticarlo.
 */
async function init() {
  const results = await Promise.allSettled([loadCatalogs(), load()]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const area = index === 0 ? "catálogos" : "calendario";
      console.error(`No se pudieron cargar ${area}:`, result.reason);
    }
  });
}

init();