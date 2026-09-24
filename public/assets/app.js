const csrf = document.querySelector('meta[name=csrf]').content;
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = iso(new Date());

const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
let view = new Date(); view.setDate(1);
let selected = todayISO, plans = [], monthsWithPlans = [];

// Recordar mes y día al refrescar (solo "Este mes" te devuelve al actual)
const KEY = 'calendario:estado';
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (s && /^\d{4}-\d{2}$/.test(s.view) && /^\d{4}-\d{2}-\d{2}$/.test(s.selected)) {
    view = new Date(s.view + '-01T00:00'); selected = s.selected;
  }
} catch {}
const saveState = () => { try { localStorage.setItem(KEY, JSON.stringify({ view: ym(view), selected })); } catch {} };

async function api(action, data) {
  const opt = data ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify(data) } : {};
  const r = await fetch(`api.php?action=${action}`, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Error');
  return j;
}

async function load() {
  const [list, months] = await Promise.all([api(`list&month=${ym(view)}`), api('months')]);
  plans = list; monthsWithPlans = months;
  renderCalendar(); renderDay(); renderMonths(); loadDue();
}

function renderMonths() {
  const cur = ym(view);
  $('#monthChips').innerHTML = monthsWithPlans.length ? monthsWithPlans.map((m) => {
    const [y, mo] = m.ym.split('-');
    const label = new Date(+y, +mo - 1, 1).toLocaleDateString('es', { month: 'short', year: 'numeric' });
    const active = m.ym === cur;
    return `<button data-month="${m.ym}" data-first="${m.first_date}" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize text-left ${active ? 'bg-[#14453D] text-white' : 'bg-[#EEF2EE] hover:bg-slate-200'}">
      ${label}<span class="ml-1.5 rounded-full px-1.5 ${active ? 'bg-white/25' : 'bg-amber-200'}">${m.total}</span></button>`;
  }).join('') : '<p class="text-xs text-slate-400">Aún no hay planes.</p>';
}

function renderCalendar() {
  $('#monthTitle').textContent = view.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  const offset = (view.getDay() + 6) % 7; // semana inicia lunes
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  let html = '<span></span>'.repeat(offset);
  for (let d = 1; d <= days; d++) {
    const date = `${view.getFullYear()}-${pad(view.getMonth() + 1)}-${pad(d)}`;
    const dayPlans = plans.filter((p) => p.plan_date === date);
    const pending = dayPlans.filter((p) => !+p.is_done).length, done = dayPlans.length - pending;
    const isSel = date === selected, isToday = date === todayISO;
    html += `<button data-date="${date}" class="aspect-square rounded-2xl flex flex-col items-center justify-center text-sm font-semibold transition
      ${isSel ? 'bg-[#14453D] text-white shadow-md' : 'hover:bg-[#EEF2EE]'} ${isToday && !isSel ? 'ring-2 ring-amber-400' : ''}">
      ${d}<span class="flex gap-0.5 mt-1 h-1.5">
      ${pending ? `<i class="h-1.5 w-1.5 rounded-full bg-amber-400"></i>` : ''}${done ? `<i class="h-1.5 w-1.5 rounded-full bg-emerald-500"></i>` : ''}</span></button>`;
  }
  $('#grid').innerHTML = html;
  saveState();
}

function renderDay() {
  const d = new Date(selected + 'T00:00');
  $('#dayTitle').textContent = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const list = plans.filter((p) => p.plan_date === selected);
  $('#dayList').innerHTML = list.length ? list.map((p) => `
    <li class="rounded-2xl border border-slate-200 p-4 ${+p.is_done ? 'bg-slate-50' : ''}">
      <div class="flex items-start gap-3">
        <button data-act="toggle" data-id="${p.id}" class="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 ${+p.is_done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'} text-xs" aria-label="Marcar como hecho">${+p.is_done ? '✓' : ''}</button>
        <div class="min-w-0 flex-1">
          <p class="font-semibold ${+p.is_done ? 'line-through text-slate-400' : ''}">${esc(p.title)}</p>
          <p class="text-xs text-slate-500">${p.plan_time ? p.plan_time.slice(0, 5) : 'Todo el día'}${+p.alarm_enabled ? ` · Alarma ${p.alarm_days} días antes` : ''}</p>
          ${p.notes ? `<p class="text-sm text-slate-600 mt-1">${esc(p.notes)}</p>` : ''}
        </div>
      </div>
      <div class="mt-3 flex gap-2 justify-end text-xs font-semibold">
        <button data-act="edit" data-id="${p.id}" class="rounded-full px-3 py-1 hover:bg-slate-100">Editar</button>
        <button data-act="delete" data-id="${p.id}" class="rounded-full px-3 py-1 text-red-600 hover:bg-red-50">Eliminar</button>
      </div>
    </li>`).join('') : '<li class="text-sm text-slate-500 py-6 text-center">No hay planes este día. Agrega el primero.</li>';
}

let notified = false;
async function loadDue() {
  const due = await api('due');
  const badge = $('#bellBadge');
  badge.textContent = due.length > 9 ? '9+' : due.length;
  badge.classList.toggle('hidden', !due.length);

  $('#dueList').innerHTML = due.length ? due.map((p) => {
    const n = +p.days_left;
    const [label, tone] =
      n < 0 ? [`Venció hace ${-n} día(s)`, 'text-red-600'] :
      n === 0 ? ['Vence hoy', 'text-amber-600'] :
      n === 1 ? ['Vence mañana', 'text-amber-600'] :
      [`Vence en ${n} días`, 'text-slate-500'];
    return `<li><button data-goto="${p.plan_date}" class="w-full px-4 py-3 text-left hover:bg-[#EEF2EE]">
      <p class="text-sm font-semibold">${esc(p.title)}</p>
      <p class="text-xs ${tone}">${label} · ${p.plan_date}</p></button></li>`;
  }).join('') : '<li class="px-4 py-8 text-center text-sm text-slate-500">Estás al día. No hay avisos pendientes.</li>';

  if (due.length && !notified && 'Notification' in window && Notification.permission === 'granted') {
    notified = true;
    new Notification('Planes por vencer', { body: `Tienes ${due.length} aviso(s) pendientes.` });
  }
}

// Modal
const modal = $('#modal'), form = $('#form');
function openForm(p) {
  form.reset(); $('#formError').classList.add('hidden');
  $('#formTitle').textContent = p ? 'Editar plan' : 'Nuevo plan';
  form.id.value = p?.id ?? ''; form.title.value = p?.title ?? '';
  form.plan_date.value = p?.plan_date ?? selected; form.plan_time.value = p?.plan_time?.slice(0, 5) ?? '';
  form.notes.value = p?.notes ?? ''; form.alarm_enabled.checked = p ? !!+p.alarm_enabled : true;
  form.alarm_days.value = p?.alarm_days ?? 30;
  modal.classList.remove('hidden'); form.title.focus();
}
const closeForm = () => modal.classList.add('hidden');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.alarm_enabled = form.alarm_enabled.checked;
  try {
    await api(data.id ? 'update' : 'create', data);
    selected = data.plan_date; view = new Date(selected + 'T00:00'); view.setDate(1);
    closeForm(); load();
  } catch (err) { const el = $('#formError'); el.textContent = err.message; el.classList.remove('hidden'); }
});

$('#btnAdd').onclick = () => openForm();
$('#btnCancel').onclick = closeForm;
modal.addEventListener('click', (e) => { if (e.target === modal) closeForm(); });
$('#prev').onclick = () => { view.setMonth(view.getMonth() - 1); load(); };
$('#next').onclick = () => { view.setMonth(view.getMonth() + 1); load(); };
$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-date]'); if (!b) return;
  selected = b.dataset.date; renderCalendar(); renderDay();
});
$('#dayList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = +b.dataset.id, p = plans.find((x) => +x.id === id);
  if (b.dataset.act === 'edit') return openForm(p);
  if (b.dataset.act === 'delete' && !confirm('¿Eliminar este plan?')) return;
  await api(b.dataset.act, { id }); load();
});
$('#btnNotif').onclick = async () => {
  if ('Notification' in window) { await Notification.requestPermission(); loadDue(); }
};

// Campana: abrir/cerrar panel
const bellPanel = $('#bellPanel'), bellBtn = $('#bellBtn');
const setBell = (open) => { bellPanel.classList.toggle('hidden', !open); bellBtn.setAttribute('aria-expanded', open); };
bellBtn.addEventListener('click', (e) => { e.stopPropagation(); setBell(bellPanel.classList.contains('hidden')); });
document.addEventListener('click', (e) => { if (!e.target.closest('#bellPanel')) setBell(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setBell(false); });

// Clic en un aviso: te lleva a ese día en el calendario
$('#dueList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goto]'); if (!b) return;
  selected = b.dataset.goto; view = new Date(selected + 'T00:00'); view.setDate(1);
  setBell(false); load();
});

// Botón "Este mes": vuelve al mes y día actuales
$('#btnToday').onclick = () => {
  view = new Date(); view.setDate(1); selected = iso(new Date()); load();
};

// Botones de meses con planes: saltan a ese mes y al primer día con plan
$('#monthChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-month]'); if (!b) return;
  view = new Date(b.dataset.month + '-01T00:00'); selected = b.dataset.first; load();
});

load();
