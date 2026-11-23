
'use strict';
function start() { view('wiz'); go(1); setTabActive('new'); }
function tab(t) { view(t); setTabActive(t); if (t === 'appts') renderAllAppts(); }

/* ====== بيانات احتياطية (تُستبدل ببيانات Supabase عند نجاح الاتصال) ====== */
let SUBJECTS = ['التربية الإسلامية','اللغة العربية','اللغة الإنجليزية','الرياضيات','الأحياء','الكيمياء','الفيزياء','التربية الفنية','الرياضة'];
let ROLES = ['مدير القناة','المشرف الأول','المشرف الثاني','المشرف'];
// الناشرون: الاسم + اليوزر (خانة التواصل) + المنصب اختيارياً. بدون role يُستخدم أول منصب في ROLES.
let PUBLISHERS = [
  { name: 'رضا محمد',      user: '@r_g7f' },
  { name: 'عبدالله صعيو', user: '@spki4', role: 'المشرف الأول' },
];
const SCHEDULE = {
  'الأحد':    ['التربية الإسلامية','اللغة العربية','الرياضيات','الفيزياء','اللغة الإنجليزية','الرياضة'],
  'الاثنين':  ['اللغة العربية','الرياضيات','الكيمياء','الأحياء','اللغة الإنجليزية','التربية الفنية'],
  'الثلاثاء': ['الرياضيات','اللغة الإنجليزية','التربية الإسلامية','اللغة العربية','الفيزياء','الكيمياء'],
  'الأربعاء': ['الأحياء','الفيزياء','اللغة العربية','الرياضيات','التربية الإسلامية','اللغة الإنجليزية'],
  'الخميس':   ['اللغة الإنجليزية','الكيمياء','الرياضيات','الرياضة','اللغة العربية','الأحياء'],
  'الجمعة':   ['لا يوجد','لا يوجد','لا يوجد','لا يوجد','لا يوجد','لا يوجد'],
  'السبت':    ['لا يوجد','لا يوجد','لا يوجد','لا يوجد','لا يوجد','لا يوجد']
};
/* ======================================= */

// إعدادات Supabase (المفتاح العام آمن في الصفحة، والحماية بسياسات RLS داخل القاعدة)
const SB_URL = 'https://wdaajhruagxdbpslmnml.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkYWFqaHJ1YWd4ZGJwc2xtbm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzU3OTMsImV4cCI6MjEwNzExMTc5M30.8bltsKy5W8gd0fAoVE1Ftdo1wTW-rBjHLcTlPwh7qtU';

const DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const TITLES = ['الزمان والتاريخ','جدول الدروس','الواجبات','الامتحانات','بيانات الناشر','المنشور جاهز'];
// العرض المرئي التقريبي للنص في تيليجرام (وحدة = عرض حرف ━)
const FRAME_EXTRA = 3;
function visualWidth(s) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '\u200F') continue;
    if ((c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F) || (c >= 0xFB50 && c <= 0xFEFF)) w += 0.5;
    else if (ch === ' ') w += 0.28;
    else if (/[A-Za-z0-9]/.test(ch)) w += 0.55;
    else if (ch === '━') w += 1;
    else if ('◇★☆✦'.includes(ch)) w += 0.9;
    else w += 0.4;
  }
  return w;
}
const DIV = '\u0001', RLM = '\u200F', NONE = { hw: '☆ لا يوجد واجبات ☆', ex: '☆ لا يوجد امتحانات ☆' };
const SEP = '='.repeat(10), ORD = ['أولاً','ثانياً','ثالثاً','رابعاً','خامساً','سادساً','سابعاً','ثامناً','تاسعاً','عاشراً'];
const $ = id => document.getElementById(id);
let cur = 1, editing = null, toastTimer;

// إنشاء عناصر DOM بأمان (بدون innerHTML)
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.flat().forEach(c => e.append(c));
  return e;
}
const ic = n => h('span', { class: 'material-icons-round', 'aria-hidden': 'true', text: n });
const opt = (v, t = v) => h('option', { value: v, text: t });
const fmt = d => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

// ---------- المظهر ----------
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  $('theme-btn').replaceChildren(ic(dark ? 'light_mode' : 'dark_mode'));
}
function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  applyTheme(dark);
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
}

// ---------- التنقل ----------
function view(v) {
  document.body.dataset.v = v;
  document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id === 'view-' + v));
  setTabActive(v === 'wiz' ? 'new' : v);
  window.scrollTo(0, 0);
}
function go(n) { cur = n; render(); window.scrollTo(0, 0); }
function render() {
  document.querySelectorAll('.step').forEach((s, i) => s.classList.toggle('on', i + 1 === cur));
  $('p-title').textContent = TITLES[cur - 1];
  $('p-count').textContent = cur < 6 ? `الخطوة ${cur} من 5` : 'اكتملت الخطوات';
  $('prog').replaceChildren(...[1, 2, 3, 4, 5].map(i => h('i', { class: i <= cur ? 'on' : '' })));
  const prev = $('b-prev'), next = $('b-next');
  prev.replaceChildren(ic(cur === 1 ? 'home' : cur === 6 ? 'restart_alt' : 'arrow_forward'), cur === 1 ? 'الرئيسية' : cur === 6 ? 'منشور جديد' : 'السابق');
  prev.onclick = () => cur === 1 ? view('home') : cur === 6 ? location.reload() : go(cur - 1);
  if (cur < 5) { next.replaceChildren('التالي', ic('arrow_back')); next.onclick = () => go(cur + 1); }
  else if (cur === 5) { next.replaceChildren(ic('auto_awesome'), 'توليد المنشور'); next.onclick = generate; }
  else { next.replaceChildren(ic('content_copy'), 'نسخ المنشور'); next.onclick = copyResult; }
}
function toast(msg, icon = 'check_circle') {
  const t = $('toast');
  t.replaceChildren(ic(icon), msg);
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

// ---------- التاريخ ----------
let curDate = new Date();
const sameDay = (a, b) => a.toDateString() === b.toDateString();
function setDateObj(d) {
  curDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  $('d-day').textContent = DAYS[curDate.getDay()];
  $('d-full').textContent = `${curDate.getDate()} ${MONTHS[curDate.getMonth()]} ${curDate.getFullYear()}`;
  $('g-date').value = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, '0')}-${String(curDate.getDate()).padStart(2, '0')}`;
  document.querySelectorAll('.chip').forEach(c => {
    const t = new Date(); t.setDate(t.getDate() + +c.dataset.off);
    c.classList.toggle('on', sameDay(t, curDate));
  });
  loadSchedule();
  renderDayNote();
}
function shiftDay(n) { const d = new Date(curDate); d.setDate(d.getDate() + n); setDateObj(d); }
function setDate(off) { const d = new Date(); d.setDate(d.getDate() + off); setDateObj(d); }
function pickDate() { const i = $('g-date'); try { i.showPicker(); } catch { i.click(); } }
function datePicked() {
  const v = $('g-date').value;
  if (v) { const [y, m, d] = v.split('-').map(Number); setDateObj(new Date(y, m - 1, d)); }
}

// ---------- قاعدة البيانات (Supabase) ----------
let dbSchedule = {}, adminPw = '';
async function sb(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error('db ' + r.status);
  return r.json();
}
function applyData(d) {
  if (d.subjects && d.subjects.length) SUBJECTS = d.subjects.map(x => x.name);
  if (d.roles && d.roles.length) ROLES = d.roles.map(x => x.name);
  if (d.supervisors && d.supervisors.length)
    PUBLISHERS = d.supervisors.map(x => ({ name: x.name, user: x.username, role: x.role ? x.role.name : '' }));
  dbSchedule = {};
  (d.schedule || []).forEach(r => { dbSchedule[r.day_index] = [r.l1, r.l2, r.l3, r.l4, r.l5, r.l6]; });
  if (d.appointments) appts = d.appointments;
  renderHomeAppts();
  if (typeof renderDayNote === 'function') renderDayNote();
}
function fromCache() {
  try {
    const c = localStorage.getItem('wj_cache');
    if (!c) return false;
    applyData(JSON.parse(c));
    return true;
  } catch { return false; }
}
function netNote(show, text) {
  const n = $('netnote');
  if (!n) return;
  n.hidden = !show;
  if (text) $('netnote-text').textContent = text;
}
function cacheAgeText() {
  const t = +(localStorage.getItem('wj_cache_at') || 0);
  if (!t) return '';
  const d = new Date(t);
  return ` (آخر تحديث: ${d.toLocaleDateString('ar')} ${d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })})`;
}
async function loadData() {
  if (!navigator.onLine) {
    const ok = fromCache();
    netNote(true, 'لا يوجد اتصال، تُعرض البيانات المحفوظة' + cacheAgeText());
    return ok;
  }
  try {
    const [schedule, subjects, roles, supervisors, appointments] = await Promise.all([
      sb('schedule?select=*&order=day_index'), sb('subjects?select=name&order=id'),
      sb('roles?select=name&order=id'), sb('supervisors?select=name,username,role:roles(name)&order=id'),
      sb('appointments?select=id,title,appt_date,created_at&order=created_at.desc')]);
    const d = { schedule, subjects, roles, supervisors, appointments };
    applyData(d);
    try {
      localStorage.setItem('wj_cache', JSON.stringify(d));
      localStorage.setItem('wj_cache_at', String(Date.now()));
    } catch {}
    netNote(false);
    return true;
  } catch {
    const ok = fromCache();
    netNote(true, 'تعذّر تحديث البيانات، تُعرض البيانات المحفوظة' + cacheAgeText());
    return ok;
  }
}

// ---------- وضع المدير ----------
function openAdmin() {
  $('admin-pw').value = ''; $('admin-msg').textContent = '';
  $('admin-bg').classList.add('on');
  setTimeout(() => $('admin-pw').focus(), 50);
}
async function adminLogin() {
  const pw = $('admin-pw').value;
  if (!pw) return;
  const btn = $('admin-go'); btn.disabled = true; $('admin-msg').textContent = '';
  try {
    const r = await sb('rpc/check_admin', { pw });
    if (r === 'ok') { adminPw = pw; setAdmin(true); closeAdmin(); toast('تم تفعيل وضع المدير'); }
    else $('admin-msg').textContent = r === 'locked' ? 'محاولات كثيرة، حاول بعد 5 دقائق'
      : r === 'none' ? 'لم تُضبط كلمة مرور المدير بعد' : 'كلمة المرور غير صحيحة';
  } catch (e) { $('admin-msg').textContent = 'تعذّر الاتصال بقاعدة البيانات (' + e.message + ')'; }
  btn.disabled = false;
}
function setAdmin(on) {
  document.body.classList.toggle('admin', on);
  if (!on) { adminPw = ''; closeMgr(); }
  refreshSave();
}
function exitAdmin() { setAdmin(false); toast('تم الخروج من وضع المدير'); }

// ---------- الدروس ----------
const norm = v => (v || '').trim().slice(0, 100) || 'لا يوجد';
function currentLessons() {
  const i = curDate.getDay();
  return dbSchedule[i] || SCHEDULE[DAYS[i]] || [];
}
function lessonValues() { return [1, 2, 3, 4, 5, 6].map(i => $('ul-' + i).value); }
function refreshSave() {
  const btn = $('save-sched');
  if (!btn) return;
  const base = currentLessons(), now = lessonValues();
  btn.disabled = !now.some((v, i) => norm(v) !== norm(base[i]));
  $('save-label').textContent = `حفظ جدول يوم ${DAYS[curDate.getDay()]}`;
}
function loadSchedule() {
  const L = currentLessons();
  $('u-lessons').replaceChildren(...[1, 2, 3, 4, 5, 6].map(i => {
    const inp = h('input', { type: 'text', id: 'ul-' + i, readonly: '', 'aria-label': 'الدرس ' + i });
    inp.value = L[i - 1] || 'لا يوجد';
    inp.addEventListener('click', () => { if (inp.hasAttribute('readonly')) openSheet('ul-' + i, [...SUBJECTS, 'لا يوجد'], 'اختر المادة'); });
    inp.addEventListener('blur', () => inp.setAttribute('readonly', ''));
    inp.addEventListener('input', refreshSave);
    const pen = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'كتابة يدوية', onclick: () => {
      inp.removeAttribute('readonly'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
    } }, ic('edit'));
    return h('div', { class: 'period' }, h('span', { class: 'num', text: i }), inp, pen);
  }));
  refreshSave();
}
async function saveSchedule() {
  const idx = curDate.getDay(), vals = lessonValues().map(norm), btn = $('save-sched');
  btn.disabled = true;
  try {
    const r = await sb('rpc/save_schedule', { pw: adminPw, day_idx: idx, lessons: vals });
    if (r === 'saved') { dbSchedule[idx] = vals; toast(`تم حفظ جدول يوم ${DAYS[idx]} في قاعدة البيانات`); loadSchedule(); }
    else if (r === 'wrong') { toast('كلمة المرور لم تعد صحيحة', 'error'); exitAdmin(); }
    else if (r === 'locked') { toast('محاولات كثيرة، حاول بعد 5 دقائق', 'error'); refreshSave(); }
    else { toast('تعذّر الحفظ', 'error'); refreshSave(); }
  } catch { toast('تعذّر الاتصال، لم يُحفظ شيء', 'error'); refreshSave(); }
}
function pickPublisher(name) {
  const p = PUBLISHERS.find(x => x.name === name);
  if (!p) return;
  $('u-contact').value = p.user;
  $('u-role').value = p.role || ROLES[0];
}

// ---------- الواجبات والامتحانات ----------
function checkEmpty(t) { $(t + '-empty').style.display = $(t + '-list').children.length ? 'none' : 'flex'; }
function addBox(type) {
  const box = h('div', { class: 'entry' },
    h('div', { class: 'entry-head' },
      h('select', { class: type + '-title', 'aria-label': 'المادة' }, SUBJECTS.map(s => opt(s))),
      h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'حذف', onclick: () => { box.remove(); checkEmpty(type); } }, ic('delete'))),
    h('input', { type: 'text', class: type + '-type', 'aria-label': 'النوع', placeholder: type === 'hw' ? 'النوع، مثل: تحضير' : 'النوع، مثل: اختبار قصير' }),
    h('textarea', { class: type + '-desc', 'aria-label': 'التفاصيل', placeholder: 'التفاصيل' }));
  $(type + '-list').append(box);
  checkEmpty(type);
}
function collect(type) {
  const rows = [...document.querySelectorAll('#' + type + '-list .entry')];
  const multi = rows.length > 1;
  const items = rows.map((b, i) => {
    const tag = b.querySelector('.' + type + '-title').value.trim().replace(/\s+/g, '_');
    const ty = b.querySelector('.' + type + '-type').value.trim();
    const d = b.querySelector('.' + type + '-desc').value.trim();
    const head = type === 'hw'
      ? `${multi ? (i + 1) + '. ' : '• '}#${tag}${ty ? ' || ' + ty : ''} :`
      : `★ ${multi ? (ORD[i] || (i + 1)) + ' ★ ' : ''}#${tag}${ty ? ' ★ ' + ty : ''} :`;
    return d ? head + '\n' + d : head;
  });
  if (!items.length) return NONE[type];
  return items.join(type === 'hw' ? `\n\n${SEP}\n` : `\n${SEP}\n`);
}

// ---------- توليد المنشور ونسخه ----------
function generate() {
  const day = DAYS[curDate.getDay()];
  const date = `${curDate.getDate()} / ${MONTHS[curDate.getMonth()]} ( ${curDate.getMonth() + 1} ) / ${curDate.getFullYear()} م`;
  const lessons = [1, 2, 3, 4, 5, 6].map(i => `${i}. ${$('ul-' + i).value}`).join('\n');
  const contact = $('u-contact').value.trim();
  const text = [
    '#واجبات_باچر', DIV,
    `يوم : ${day}`, `بـ تاريخ : ${date}`, DIV,
    '#جدول_الدروس', lessons, DIV,
    '#الواجبات', collect('hw'), DIV,
    '#الإمتحانات', collect('ex'), DIV,
    '#واجبات_باچر || #قسم_الإعلام',
    `بـ واسطة : ${$('u-pub').value.trim()} || ${$('u-role').value}`,
    ...(contact ? [`للتواصل : ${contact}`] : [])
  ].join('\n');
  // علامة RTL غير مرئية في بداية كل سطر لإجبار الاتجاه من اليمين لليسار في تيليجرام
  // كل الفواصل بشكل الإطار، وطولها = أطول سطر نصي مرئياً + 3
  let lines = text.split('\n');
  const widths = lines.filter(l => l !== DIV).map(visualWidth);
  const bar = '━'.repeat(Math.round(Math.max(...widths)) + FRAME_EXTRA);
  const frame = '◇' + bar + '◇';
  lines = lines.map(l => (l === DIV ? frame : l));
  const at = lines.indexOf('#واجبات_باچر');
  lines.splice(at, lines[at + 1] === frame ? 2 : 1, frame, '   ✦ #واجبات_باچر ✦', frame);
  lines.push(frame);
  $('result').textContent = lines.map(l => RLM + l).join('\n');
  go(6);
}
async function copyResultBase() {
  const t = $('result').textContent;
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; }
  catch {
    const ta = h('textarea'); ta.value = t; document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast(ok ? 'تم نسخ المنشور' : 'تعذّر النسخ، انسخ النص يدوياً');
}

// ---------- إدارة البيانات (للمدير) ----------
const MGR = {
  pubs:  { label: 'ناشر', save: 'admin_save_supervisor', del: 'admin_delete_supervisor' },
  roles: { label: 'منصب', save: 'admin_save_role',       del: 'admin_delete_role' },
  subs:  { label: 'مادة', save: 'admin_save_subject',    del: 'admin_delete_subject' }
};
let mgrTab = 'pubs', mgrData = { pubs: [], roles: [], subs: [] };
async function mgrFetch() {
  const [pubs, roles, subs] = await Promise.all([
    sb('supervisors?select=id,name,username,role_id,role:roles(name)&order=id'),
    sb('roles?select=id,name&order=id'), sb('subjects?select=id,name&order=id')]);
  mgrData = { pubs, roles, subs };
}
async function openMgr() {
  $('mgr-bg').classList.add('on');
  try { await mgrFetch(); } catch { toast('تعذّر تحميل البيانات', 'error'); }
  renderMgr();
}
function mgrSwitch(t) { mgrTab = t; renderMgr(); }
function renderMgr() {
  document.querySelectorAll('.mgr-tab').forEach(b => b.classList.toggle('on', b.dataset.t === mgrTab));
  $('mgr-add').style.display = '';
  $('mgr-add-label').textContent = 'إضافة ' + MGR[mgrTab].label;
  $('mgr-hint').textContent = mgrTab === 'subs' ? 'تغيير اسم مادة لا يغيّر الجداول المحفوظة سابقاً، عدّلها من وضع المدير.' : '';
  const rows = mgrData[mgrTab];
  $('mgr-body').replaceChildren(...(rows.length ? rows.map(mgrRow) : [h('div', { class: 'empty', text: 'لا توجد عناصر بعد' })]));
}
function mgrRow(r) {
  const sub = mgrTab === 'pubs' ? [r.username, r.role ? r.role.name : ''].filter(Boolean).join(' • ') : '';
  return h('div', { class: 'mrow' },
    h('div', { class: 'mtext' }, h('b', { text: r.name }), sub ? h('small', { text: sub }) : ''),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'تعديل', onclick: () => mgrForm(r) }, ic('edit')),
    h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'حذف', onclick: () => mgrDelete(r) }, ic('delete')));
}
function mgrForm(r) {
  const isPub = mgrTab === 'pubs';
  const field = (label, el) => h('div', { class: 'field' }, h('label', { text: label }), el);
  const name = h('input', { type: 'text', id: 'm-name', maxlength: '60', 'aria-label': 'الاسم' });
  name.value = r ? r.name : '';
  const kids = [h('b', { text: (r ? 'تعديل ' : 'إضافة ') + MGR[mgrTab].label, style: 'display:block;margin-bottom:12px' }), field('الاسم', name)];
  if (isPub) {
    const user = h('input', { type: 'text', id: 'm-user', dir: 'ltr', placeholder: '@username', maxlength: '40', 'aria-label': 'اليوزر' });
    user.value = r ? r.username : '';
    const role = h('select', { id: 'm-role', 'aria-label': 'المنصب' },
      h('option', { value: '', text: 'بدون منصب' }), mgrData.roles.map(x => h('option', { value: x.id, text: x.name })));
    role.value = r && r.role_id ? String(r.role_id) : '';
    kids.push(field('اليوزر (تيليجرام)', user), field('المنصب', role));
  }
  kids.push(h('div', { style: 'display:flex;gap:10px' },
    h('button', { class: 'btn pri', type: 'button', style: 'flex:1', onclick: () => mgrSave(r) }, ic('check'), 'حفظ'),
    h('button', { class: 'btn ghost', type: 'button', onclick: () => renderMgr() }, 'إلغاء')));
  $('mgr-body').replaceChildren(...kids);
  $('mgr-add').style.display = 'none';
  $('mgr-hint').textContent = '';
  name.focus();
}
function mgrSave(r) {
  const body = { pw: adminPw, p_id: r ? r.id : null, p_name: $('m-name').value };
  if (mgrTab === 'pubs') {
    body.p_username = $('m-user').value;
    body.p_role_id = $('m-role').value ? +$('m-role').value : null;
  }
  return mgrCall(MGR[mgrTab].save, body, 'saved', 'تم الحفظ');
}
function mgrDelete(r) {
  if (!confirm(`حذف "${r.name}"؟`)) return;
  return mgrCall(MGR[mgrTab].del, { pw: adminPw, p_id: r.id }, 'deleted', 'تم الحذف');
}
async function mgrCall(fn, body, okStatus, okMsg) {
  try {
    const res = await sb('rpc/' + fn, body);
    if (res === okStatus) {
      toast(okMsg);
      await mgrFetch(); renderMgr();
      await loadData(); fillRoles(); defaultPublisher();
    } else if (res === 'wrong') { toast('كلمة المرور لم تعد صحيحة', 'error'); exitAdmin(); }
    else toast(res === 'duplicate' ? 'هذا الاسم موجود مسبقاً' : res === 'locked' ? 'محاولات كثيرة، حاول بعد 5 دقائق' : 'بيانات غير صالحة', 'error');
  } catch (e) { toast('تعذّر الحفظ (' + e.message + ')', 'error'); }
}

// ---------- المواعيد ----------
let appts = [], editingAppt = null;
const apptDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStart = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const fmtAppt = s => apptDay(s).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function openApptForm(id) {
  editingAppt = id ?? null;
  const a = id ? appts.find(x => x.id === id) : null;
  $('appt-form-title').textContent = a ? 'تعديل الموعد' : 'إضافة موعد';
  $('ap-save').textContent = a ? 'حفظ التعديل' : 'إضافة';
  $('ap-title').value = a ? a.title : '';
  $('ap-date').value = a ? a.appt_date : '';
  $('ap-err').textContent = '';
  $('appt-form-bg').classList.add('on');
  setTimeout(() => $('ap-title').focus(), 200);
}
async function apiAppt(fn, body, okMsg) {
  try {
    const r = await sb('rpc/' + fn, { pw: adminPw, ...body });
    if (r === 'saved' || r === 'deleted') { toast(okMsg); await loadAppts(); return true; }
    if (r === 'wrong' || r === 'none') { toast('كلمة المرور لم تعد صحيحة', 'error'); exitAdmin(); }
    else if (r === 'locked') toast('محاولات كثيرة، حاول بعد 5 دقائق', 'error');
    else toast('بيانات غير صالحة', 'error');
  } catch (e) { toast('تعذّر الاتصال (' + e.message + ')', 'error'); }
  return false;
}
async function saveAppt() {
  const title = $('ap-title').value.trim(), date = $('ap-date').value;
  if (!title) { $('ap-err').textContent = 'اكتب عنوان الموعد'; return; }
  if (!date) { $('ap-err').textContent = 'اختر تاريخ الموعد'; return; }
  const ok = await apiAppt('admin_save_appointment', { p_id: editingAppt, p_title: title, p_date: date },
    editingAppt ? 'تم حفظ التعديل' : 'تمت إضافة الموعد');
  if (ok) closeApptForm();
}
async function deleteAppt(id) {
  if (!confirm('حذف هذا الموعد؟')) return;
  await apiAppt('admin_delete_appointment', { p_id: id }, 'تم الحذف');
}
async function loadAppts() {
  const rows = await sb('appointments?select=id,title,appt_date,created_at&order=created_at.desc');
  appts = rows || [];
  renderHomeAppts();
  if (document.getElementById('view-appts').classList.contains('on')) renderAllAppts();
  renderDayNote();
  try { const c = JSON.parse(localStorage.getItem('wj_cache') || 'null'); if (c) { c.appointments = appts; localStorage.setItem('wj_cache', JSON.stringify(c)); } } catch {}
  return rows;
}
// تأثير الضغط على الأزرار الأساسية
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn.pri.big'); if (!b) return;
  const r = b.getBoundingClientRect(), sz = Math.max(r.width, r.height), d = document.createElement('span');
  d.className = 'ripple';
  d.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - r.left - sz / 2}px;top:${e.clientY - r.top - sz / 2}px`;
  b.append(d); setTimeout(() => d.remove(), 650);
});

new MutationObserver(() => document.body.classList.toggle('lock', !!document.querySelector('.drawer-bg.on')))
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn.pri.big'); if (!b) return;
  const r = b.getBoundingClientRect(), sz = Math.max(r.width, r.height), d = document.createElement('span');
  d.className = 'ripple';
  d.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - r.left - sz / 2}px;top:${e.clientY - r.top - sz / 2}px`;
  b.append(d); setTimeout(() => d.remove(), 650);
});


// ---------- تحسينات تجربة الاستخدام ----------
async function copyResult() {
  await copyResultBase();
  const nb = $('b-next');
  const prev = nb.textContent;
  nb.replaceChildren(ic('check'), 'تم النسخ');
  nb.classList.add('ok');
  setTimeout(() => { nb.classList.remove('ok'); nb.replaceChildren(prev); }, 2200);
};


// =====  =====
function closeBg(bg) {
  if (!bg) return;
  if (bg.id === 'upd-modal') $('upd-bar').hidden = false;
  bg.classList.remove('on');
  bg.querySelectorAll('input,textarea').forEach(i => { i.value = ''; });
  bg.querySelectorAll('.form-err').forEach(e => { e.textContent = ''; });
}
function closeApptForm() { closeBg($('appt-form-bg')); }
function closeMgr() { closeBg($('mgr-bg')); }
function closeAdmin() { closeBg($('admin-bg')); }
function closeSheet() { closeBg($('drawer-bg')); }
function openList(title, items, current, onPick) {
  openedAt = Date.now();
  $('drawer-title').textContent = title;
  $('opts').replaceChildren(...items.map(it => h('button', {
    class: 'opt' + (String(it.value) === String(current) ? ' sel' : ''), type: 'button', text: it.label,
    onclick: () => { closeBg($('drawer-bg')); onPick(it.value); }
  })));
  $('drawer-bg').classList.add('on');
}
function openSheet(id, list, title, onPick) {
  const cur = $(id).value;
  openList(title, list.map(x => typeof x === 'string' ? { value: x, label: x } : x), cur, v => {
    $(id).value = v; $(id).dispatchEvent(new Event('input', { bubbles: true })); if (onPick) onPick(v);
  });
};
// كل قائمة اختيار تفتح نافذة في المنتصف
let openedAt = 0;
document.addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('select')) e.preventDefault();
}, true);
document.addEventListener('click', e => {
  const sel = e.target.closest && e.target.closest('select');
  if (!sel || sel.disabled) return;
  e.preventDefault();
  openList(sel.getAttribute('aria-label') || 'اختر', [...sel.options].map(o => ({ value: o.value, label: o.text })), sel.value, v => {
    sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}, true);

// نافذة الموعد عند الضغط عليه

// شريط التنقل: مؤشر متحرك للتبويب النشط
function moveInd(t) {
  const btn = document.querySelector(`.tab[data-tab="${t}"]`), ind = $('tab-ind');
  if (!btn || !ind) return;
  ind.style.left = btn.offsetLeft + 'px';
  ind.style.width = btn.offsetWidth + 'px';
}
function setTabActive(t) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  moveInd(t);
}

// كل نافذة: زر X أعلى اليمين، وزر إغلاق سفلي، والإغلاق عند الضغط خارجها
document.querySelectorAll('.drawer-bg').forEach(bg => {
  const d = bg.querySelector('.drawer'); if (!d) return;
  d.tabIndex = -1;
  if (!d.querySelector('[aria-label="إغلاق"]')) {
    d.prepend(h('button', { class: 'x-close', type: 'button', 'aria-label': 'إغلاق', onclick: () => closeBg(bg) }, ic('close')));
  }
  if (bg.id !== 'upd-modal' && !d.querySelector('.drawer-foot')) {
    d.append(h('div', { class: 'drawer-foot' }, h('button', { class: 'btn ghost', type: 'button', text: 'إغلاق', onclick: () => closeBg(bg) })));
  }
  bg.addEventListener('click', e => { if (e.target === bg && Date.now() - openedAt > 400) closeBg(bg); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.drawer-bg.on').forEach(closeBg); });


// ===== المواعيد =====
const isAdminMode = () => document.body.classList.contains('admin');
function sortAppts(list) {
  const t = todayStart();
  return [...list].sort((a, b) => {
    const pa = apptDay(a.appt_date) < t, pb = apptDay(b.appt_date) < t;
    if (pa !== pb) return pa ? 1 : -1;               // القادمة أولاً، ثم المنتهية
    return pa ? b.appt_date.localeCompare(a.appt_date) : a.appt_date.localeCompare(b.appt_date);
  });
}
function apptCard(a, i) {
  const past = apptDay(a.appt_date) < todayStart();
  const kids = [
    h('div', { class: 'appt-main' }, h('h3', { text: a.title }), h('p', { class: 'appt-date' }, ic('event'), fmtAppt(a.appt_date))),
    h('span', { class: 'pill' + (past ? '' : ' soon'), text: past ? 'منتهي' : 'قادم' })
  ];
  if (isAdminMode()) kids.push(h('div', { class: 'appt-acts' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'تعديل', onclick: e => { e.stopPropagation(); openApptForm(a.id); } }, ic('edit')),
    h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'حذف', onclick: e => { e.stopPropagation(); deleteAppt(a.id); } }, ic('delete'))));
  const li = h('li', { class: 'appt tap' + (past ? ' past' : '') }, ...kids);
  li.style.setProperty('--i', String(i));
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.addEventListener('click', () => openApptView(a.id));
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openApptView(a.id); } });
  return li;
};
function renderHomeAppts() {
  const recent = sortAppts(appts.slice(0, 5));          // آخر 5 مضافة، مرتبة من الأقرب للأبعد
  $('appt-list').replaceChildren(...(recent.length ? recent.map(apptCard) : [h('li', { class: 'appt-empty' },
    ic('event_available'), h('span', { text: 'لا توجد مواعيد بعد' }),
    h('small', { style: 'color:var(--muted)', text: isAdminMode() ? 'اضغط إضافة لإنشاء أول موعد' : 'ستظهر المواعيد هنا عند إضافتها' }))]));
};
function renderAllAppts() {
  const sorted = sortAppts(appts);
  $('all-appt-list').replaceChildren(...(sorted.length ? sorted.map(apptCard) : [h('li', { class: 'appt-empty', text: 'لا توجد مواعيد بعد' })]));
};
let lastAdminMode = isAdminMode();
new MutationObserver(() => {
  const now = isAdminMode();
  if (now === lastAdminMode) return;
  lastAdminMode = now;
  renderHomeAppts();
  if (document.getElementById('view-appts').classList.contains('on')) renderAllAppts();
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
function openApptView(id) {
  const a = appts.find(x => x.id === id); if (!a) return;
  const past = apptDay(a.appt_date) < todayStart();
  $('av-title').textContent = a.title;
  $('av-date').textContent = fmtAppt(a.appt_date);
  $('av-pill').textContent = past ? 'منتهي' : 'قادم';
  $('av-pill').className = 'pill' + (past ? '' : ' soon');
  const box = $('av-admin');
  box.replaceChildren();
  if (isAdminMode()) box.append(
    h('button', { class: 'btn ghost', type: 'button', onclick: () => { closeBg($('appt-view-bg')); openApptForm(id); } }, ic('edit'), 'تعديل'),
    h('button', { class: 'btn danger', type: 'button', onclick: () => { closeBg($('appt-view-bg')); deleteAppt(id); } }, ic('delete'), 'حذف'));
  box.hidden = !isAdminMode();
  $('appt-view-bg').classList.add('on');
};
function renderDayNote() {
  const v = $('g-date').value;
  const list = sortAppts(appts.filter(a => a.appt_date === v));
  ['day-note', 'day-note-2', 'day-note-6'].forEach(id => {
    const box = $(id); if (!box) return;
    if (!list.length) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    box.replaceChildren(
      h('p', { class: 'dn-title', text: list.length === 1 ? 'يوجد موعد في هذا اليوم' : `يوجد ${list.length} مواعيد في هذا اليوم` }),
      ...list.map(a => {
        const past = apptDay(a.appt_date) < todayStart();
        return h('div', { class: 'dn-item' }, ic('event'), h('span', { text: a.title }),
          h('span', { class: 'pill' + (past ? '' : ' soon'), text: past ? 'منتهي' : 'قادم' }));
      }));
  });
};

// ---------- التشغيل ----------
function fillRoles() { $('u-role').replaceChildren(...ROLES.map(r => opt(r))); }
function defaultPublisher() {
  if (!PUBLISHERS[0]) return;
  $('u-pub').value = PUBLISHERS[0].name;
  pickPublisher(PUBLISHERS[0].name);
}
(async function boot() {
  setTimeout(() => setTabActive('home'), 0);
  let saved = null; try { saved = localStorage.getItem('theme'); } catch {}
  applyTheme(saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  if (document.fonts) document.fonts.load('22px "Material Icons Round"', 'menu_book')
    .then(f => { if (f.length) document.documentElement.classList.add('icons'); }).catch(() => {});

  const pub = $('u-pub');
  pub.addEventListener('click', () => { if (pub.hasAttribute('readonly')) openSheet('u-pub', PUBLISHERS.map(p => p.name), 'اختر الناشر', pickPublisher); });
  pub.addEventListener('blur', () => pub.setAttribute('readonly', ''));
  $('pub-pen').addEventListener('click', () => {
    pub.removeAttribute('readonly'); pub.focus(); pub.setSelectionRange(pub.value.length, pub.value.length);
  });

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('home-next').textContent = fmt(tomorrow);
  fromCache();
  fillRoles(); defaultPublisher();
  setDate(1);
  checkEmpty('hw'); checkEmpty('ex');

  const ok = await loadData();
  fillRoles(); defaultPublisher(); loadSchedule();
  if (!ok) toast('لا توجد بيانات محفوظة بعد، تحقق من الاتصال', 'error');
})();


'use strict';
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install-btn').hidden = false; });
$('install-btn').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null; $('install-btn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('install-btn').hidden = true; });
window.addEventListener('online', async () => {
  await loadData(); fillRoles();
  if (cur === 2) refreshSave();
});


(function () {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      window.wjReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) showUpd();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpd();
        });
      });
    }).catch(() => {});
  });
})();
function showUpd() { $('upd-modal').classList.add('on'); }
function applyUpd() {
  const w = window.wjReg && window.wjReg.waiting;
  if (w) w.postMessage('SKIP_WAITING'); else location.reload();
}


// ===== التركيز داخل النوافذ (QA-02) =====
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const visibleFocusable = bg => [...bg.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
let focusReturn = null;
document.querySelectorAll('.drawer-bg').forEach(bg => {
  new MutationObserver(muts => muts.forEach(m => {
    const wasOpen = (m.oldValue || '').split(/\s+/).includes('on');
    const isOpen = bg.classList.contains('on');
    if (isOpen && !wasOpen) {
      focusReturn = document.activeElement;
      const first = visibleFocusable(bg)[0];
      (first || bg.querySelector('.drawer')).focus();
    } else if (!isOpen && wasOpen && focusReturn && document.contains(focusReturn)) {
      focusReturn.focus();
    }
  })).observe(bg, { attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const bg = document.querySelector('.drawer-bg.on'); if (!bg) return;
  const f = visibleFocusable(bg); if (!f.length) return;
  const first = f[0], last = f[f.length - 1], cur = document.activeElement;
  if (e.shiftKey && (cur === first || !bg.contains(cur))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (cur === last || !bg.contains(cur))) { e.preventDefault(); first.focus(); }
});
