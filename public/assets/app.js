const csrf = document.querySelector("meta[name=csrf]").content;
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

async function api(action, data) {
  const opt = data
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF": csrf },
        body: JSON.stringify(data),
      }
    : {};
  const r = await fetch(`api.php?action=${action}`, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Error");
  return j;
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
  loadDue();
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
          return `<button data-month="${m.ym}" data-first="${m.first_date}" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize text-left ${active ? "bg-[#14453D] text-white" : "bg-[#EEF2EE] hover:bg-slate-200"}">
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
  ${isHit ? "bg-[#00E676] text-white shadow-md" : isSel ? "bg-[#14453D] text-white shadow-md" : "hover:bg-[#EEF2EE]"}
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
          const isHitCard = searchHighlight?.planIds.has(p.id);
          const hora = p.plan_time
            ? p.plan_time.slice(0, 5) +
              (p.plan_time_end ? ` – ${p.plan_time_end.slice(0, 5)}` : "")
            : "Todo el día";

          return `
    <li class="rounded-2xl border p-4 ${isHitCard ? "bg-[#00E676] border-[#00E676] text-white" : +p.is_done ? "bg-slate-50 border-slate-200" : "border-slate-200"}">
      <div class="flex items-start gap-3">
        <button data-act="toggle" data-id="${p.id}" class="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 ${+p.is_done ? "bg-emerald-500 border-emerald-500 text-white" : isHitCard ? "border-white" : "border-slate-300"} text-xs" aria-label="Marcar como hecho">${+p.is_done ? "✓" : ""}</button>
        <div class="min-w-0 flex-1">
          <p class="font-semibold ${!isHitCard && +p.is_done ? "line-through text-slate-400" : ""}">${esc(p.title)}</p>
          <p class="text-xs ${isHitCard ? "text-white/85" : "text-slate-500"}">${hora}${+p.alarm_enabled ? ` · Alarma ${p.alarm_days} días antes` : ""}</p>
          ${p.notes ? `<p class="text-sm mt-1 ${isHitCard ? "text-white/90" : "text-slate-600"}">${esc(p.notes)}</p>` : ""}
        </div>
      </div>
      <div class="mt-3 flex gap-2 justify-end text-xs font-semibold">
        <button data-act="edit" data-id="${p.id}" class="rounded-full px-3 py-1 ${isHitCard ? "hover:bg-black/10" : "hover:bg-slate-100"}">Editar</button>
        <button data-act="delete" data-id="${p.id}" class="rounded-full px-3 py-1 ${isHitCard ? "text-white hover:bg-black/10" : "text-red-600 hover:bg-red-50"}">Eliminar</button>
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
          return `<li><button data-goto="${p.plan_date}" class="w-full px-4 py-3 text-left hover:bg-[#EEF2EE]">
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
$("#dayList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const id = +b.dataset.id,
    p = plans.find((x) => +x.id === id);
  if (b.dataset.act === "edit") return openForm(p);
  if (b.dataset.act === "delete" && !confirm("¿Eliminar este plan?")) return;
  await api(b.dataset.act, { id });
  load();
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
        <button data-act="restore" data-file="${esc(b.file)}" class="w-full px-4 py-2 text-left hover:bg-[#EEF2EE]">Restablecer esta copia</button>
        <button data-act="drive" data-file="${esc(b.file)}" class="w-full px-4 py-2 text-left hover:bg-[#EEF2EE]">Guardar en Google Drive</button>
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

  if (act === "delete") {
    if (!confirm(`¿Eliminar la copia ${file}?`)) return;
    await api("backups_delete", { file });
    loadBackups();
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
    load();
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
    logLine(
      "Archivo listo. Conecta tu cuenta de Drive para subirlo automáticamente.",
    );
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

$("#btnCreateBackup").onclick = async () => {
  const btn = $("#btnCreateBackup");
  btn.disabled = true;
  $("#backupLog").innerHTML = "";
  try {
    logLine("Preparando usuarios y planes…");
    logLine("Generando archivo .sql…");
    const r = await api("backups_create", {});
    logLine(`Copia creada: ${r.backup.file}`);
    loadBackups();
  } catch (err) {
    logLine(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
};

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

function renderCatalogList(container, items, kind) {
  container.innerHTML = items.length
    ? items
        .map(
          (i) => `
    <li class="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <div><p class="font-semibold">${esc(i.nombre)}</p>
        ${i.direccion ? `<p class="text-xs text-slate-500">${esc(i.direccion)}</p>` : ""}
        ${i.cargo ? `<p class="text-xs text-slate-500">${esc(i.cargo)}</p>` : ""}</div>
      <button data-kind="${kind}" data-id="${i.id}" class="text-red-600 hover:bg-red-50 rounded-full p-1.5">${trashIconSvg}</button>
    </li>`,
        )
        .join("")
    : '<li class="text-xs text-slate-400 text-center py-4">Aún no hay registros.</li>';
}

async function refreshCatalogTab(kind) {
  const map = {
    lugares: "#listLugares",
    instructores: "#listInstructores",
    cursos: "#listCursos",
  };
  await loadCatalogs();
  renderCatalogList($(map[kind]), catalogs[kind], kind);
}

["Lugar", "Instructor", "Curso"].forEach((name) => {
  const kind = name.toLowerCase() + (name === "Curso" ? "s" : "es");
  $(`#form${name}`)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = Object.fromEntries(new FormData(f));
    await api(`${kind}&sub=create`, data);
    f.reset();
    refreshCatalogTab(kind);
  });
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-kind]");
  if (!b) return;
  if (!confirm("¿Eliminar este registro?")) return;
  await api(`${b.dataset.kind}&sub=delete`, { id: b.dataset.id });
  refreshCatalogTab(b.dataset.kind);
});

// Pestañas del panel de ajustes
document.querySelectorAll(".drawer-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".drawer-tab")
      .forEach((t) => t.classList.remove("bg-[#14453D]", "text-white"));
    tab.classList.add("bg-[#14453D]", "text-white");
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

// ---------- Buscador global con resaltado ----------
let searchHighlight = null; // { dates: Set, planIds: Set }
let searchTimeout;
$("#searchInput")?.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  searchTimeout = setTimeout(() => runSearch(q), 350);
});

async function runSearch(q) {
  if (!q) {
    searchHighlight = null;
    renderCalendar();
    renderDay();
    return;
  }
  const results = await api("search", { title: q });
  if (!results.length) {
    searchHighlight = { dates: new Set(), planIds: new Set() };
    renderCalendar();
    renderDay();
    return;
  }
  searchHighlight = {
    dates: new Set(results.map((r) => r.plan_date)),
    planIds: new Set(results.map((r) => r.id)),
  };
  const first = results[0];
  view = new Date(first.plan_date + "T00:00");
  view.setDate(1);
  selected = first.plan_date;
  load();
}

loadCatalogs();
load();