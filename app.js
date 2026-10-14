(function () {
  'use strict';
  const KEY = 'kab-khatam-v1';
  const $ = (s) => document.querySelector(s);
  const DAY = 86400000;

  const PRESETS = [
    { name: 'Driving licence', cat: 'Document', repeat: '' },
    { name: 'Passport', cat: 'Document', repeat: '' },
    { name: 'Car insurance', cat: 'Vehicle', repeat: 'yearly' },
    { name: 'Bike insurance', cat: 'Vehicle', repeat: 'yearly' },
    { name: 'PUC certificate', cat: 'Vehicle', repeat: '' },
    { name: 'Health insurance', cat: 'Insurance', repeat: 'yearly' },
    { name: 'Gas cylinder test', cat: 'Gas cylinder', repeat: '' },
    { name: 'Medicine', cat: 'Medicine', repeat: '' },
    { name: 'Phone warranty', cat: 'Warranty', repeat: '' },
    { name: 'OTT subscription', cat: 'Subscription', repeat: 'monthly' },
    { name: 'Water purifier filter', cat: 'Home', repeat: '' },
    { name: 'Fire extinguisher refill', cat: 'Home', repeat: 'yearly' }
  ];

  let items = load();
  let filter = 'all';
  let editing = null;
  let renewing = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { toast('Could not save — storage is full or blocked'); } }

  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const daysLeft = (s) => Math.round((parse(s) - today()) / DAY);
  const fmt = (s) => parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function bucket(n) { return n < 0 ? 'expired' : n <= 7 ? 'week' : n <= 30 ? 'month' : 'later'; }

  function label(n) {
    if (n < 0) return { big: Math.abs(n), small: Math.abs(n) === 1 ? 'day ago' : 'days ago' };
    if (n === 0) return { big: 'Today', small: 'expires today' };
    if (n === 1) return { big: '1', small: 'day left' };
    if (n > 730) return { big: Math.round(n / 365), small: 'years left' };
    if (n > 90) return { big: Math.round(n / 30.4), small: 'months left' };
    return { big: n, small: 'days left' };
  }

  function render() {
    const sorted = [...items].sort((a, b) => a.expiry.localeCompare(b.expiry));
    const counts = { all: items.length, expired: 0, week: 0, month: 0, later: 0 };
    sorted.forEach((it) => counts[bucket(daysLeft(it.expiry))]++);
    for (const k in counts) $('#n-' + k).textContent = counts[k];

    const list = $('#list');
    const shown = sorted.filter((it) => filter === 'all' || bucket(daysLeft(it.expiry)) === filter);
    list.innerHTML = shown.map((it) => {
      const n = daysLeft(it.expiry); const b = bucket(n); const l = label(n);
      return '<article class="item ' + b + '" data-id="' + it.id + '">' +
        '<div class="count"><b>' + l.big + '</b><span>' + l.small + '</span></div>' +
        '<div class="body"><h3>' + esc(it.name) + '</h3>' +
        '<p class="meta">' + esc(it.cat) + (it.repeat ? ' · renews ' + (it.repeat === 'yearly' ? 'yearly' : 'monthly') : '') + '</p>' +
        (it.note ? '<p class="nt">' + esc(it.note) + '</p>' : '') +
        '<div class="row-actions">' +
        '<button type="button" data-act="renew">Renewed</button>' +
        '<a href="' + gcal(it) + '" target="_blank" rel="noopener">Google Calendar</a>' +
        '<button type="button" data-act="ics">Phone calendar</button>' +
        '<button type="button" data-act="edit">Edit</button>' +
        '<button type="button" data-act="del" class="del">Delete</button></div></div>' +
        '<div class="stamp" aria-label="Expiry date ' + fmt(it.expiry) + '"><small>' + (n < 0 ? 'Expired' : 'Expires') + '</small>' + fmt(it.expiry) + '</div>' +
        '</article>';
    }).join('') || (items.length ? '<p class="none">Nothing in this group. 🎉</p>' : '');
    $('#empty').hidden = items.length > 0;
    document.querySelector('.tools').hidden = items.length === 0;
  }

  // ---------- calendar ----------
  const ymd = (s) => s.replace(/-/g, '');
  const nextDay = (s) => { const d = parse(s); d.setDate(d.getDate() + 1); return iso(d); };
  function gcal(it) {
    const p = new URLSearchParams({ action: 'TEMPLATE', text: '⚠ ' + it.name + ' expires', dates: ymd(it.expiry) + '/' + ymd(nextDay(it.expiry)), details: (it.note ? it.note + '\n\n' : '') + 'Added from Kab Khatam' });
    if (it.repeat) p.set('recur', 'RRULE:FREQ=' + it.repeat.toUpperCase());
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c); }
  function fold(line) { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); } out.push(line); return out.join('\r\n'); }
  function ics(list) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kab Khatam//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Kab Khatam'];
    for (const it of list) {
      L.push('BEGIN:VEVENT', 'UID:' + it.id + '@kab-khatam', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ymd(it.expiry), 'DTEND;VALUE=DATE:' + ymd(nextDay(it.expiry)),
        'SUMMARY:' + icsEsc('⚠ ' + it.name + ' expires'), 'DESCRIPTION:' + icsEsc((it.note ? it.note + '\n' : '') + 'Type: ' + it.cat));
      if (it.repeat) L.push('RRULE:FREQ=' + it.repeat.toUpperCase());
      for (const r of (it.remind || [7, 1])) {
        // alarm at 9:00 local time, r days before the all-day event
        const trig = r <= 1 ? '-PT15H' : '-P' + (r - 1) + 'DT15H';
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.name + ' expires in ' + r + (r === 1 ? ' day' : ' days')), 'TRIGGER:' + trig, 'END:VALARM');
      }
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.name + ' expires today'), 'TRIGGER:PT9H', 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function save(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- dialog ----------
  const dlg = $('#dlg'), f = $('#item-form');
  $('#presets').innerHTML = PRESETS.map((p, i) => '<button type="button" data-p="' + i + '">' + esc(p.name) + '</button>').join('');
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = PRESETS[+b.dataset.p];
    f.name.value = p.name; f.cat.value = p.cat; f.repeat.value = p.repeat; toggleLpg(); f.expiry.focus();
  });
  function openAdd(it) {
    editing = it ? it.id : null;
    f.reset();
    $('#dlg-h').textContent = it ? 'Edit expiry' : 'Add an expiry';
    $('#presets').hidden = !!it;
    if (it) {
      f.name.value = it.name; f.cat.value = it.cat; f.expiry.value = it.expiry; f.repeat.value = it.repeat || ''; f.note.value = it.note || '';
      f.querySelectorAll('[name=r]').forEach((c) => { c.checked = (it.remind || []).includes(+c.value); });
    }
    toggleLpg();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(() => (it ? f.expiry : f.name).focus(), 30);
  }
  function toggleLpg() { $('#lpg').hidden = f.cat.value !== 'Gas cylinder'; }
  f.cat.addEventListener('change', toggleLpg);
  f.lpgCode.addEventListener('input', () => {
    const m = f.lpgCode.value.trim().toUpperCase().match(/^([ABCD])\s*[-/ ]?\s*(\d{2})$/);
    if (!m) { $('#lpg-out').textContent = 'Type the code, like D-26. A = Jan–Mar, B = Apr–Jun, C = Jul–Sep, D = Oct–Dec; the number is the year.'; return; }
    const q = 'ABCD'.indexOf(m[1]); const y = 2000 + +m[2];
    const end = new Date(y, q * 3 + 3, 0);
    f.expiry.value = iso(end);
    if (!f.name.value) f.name.value = 'Gas cylinder test';
    $('#lpg-out').textContent = m[1] + '-' + m[2] + ' means the safety test is due by ' + end.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) + '. Refuse a cylinder that is past this date.';
  });
  $('#cancel').addEventListener('click', () => dlg.close());
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!f.name.value.trim() || !f.expiry.value) { toast('Add a name and a date'); return; }
    const data = {
      name: f.name.value.trim(), cat: f.cat.value, expiry: f.expiry.value, repeat: f.repeat.value, note: f.note.value.trim(),
      remind: [...f.querySelectorAll('[name=r]:checked')].map((c) => +c.value)
    };
    if (editing) Object.assign(items.find((x) => x.id === editing), data);
    else items.push({ id: uid(), created: iso(today()), ...data });
    persist(); render(); dlg.close();
    toast(editing ? 'Updated' : 'Saved — ' + label(daysLeft(data.expiry)).big + ' ' + label(daysLeft(data.expiry)).small);
  });

  const rdlg = $('#renew-dlg'), rf = $('#renew-form');
  $('#renew-cancel').addEventListener('click', () => rdlg.close());
  rf.addEventListener('submit', (e) => {
    e.preventDefault();
    const it = items.find((x) => x.id === renewing); if (!it || !rf.date.value) return;
    it.expiry = rf.date.value; persist(); render(); rdlg.close(); toast('Updated to ' + fmt(it.expiry));
  });

  $('#list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.item').dataset.id; const it = items.find((x) => x.id === id); if (!it) return;
    const act = b.dataset.act;
    if (act === 'edit') openAdd(it);
    if (act === 'del') { if (confirm('Delete "' + it.name + '"?')) { items = items.filter((x) => x.id !== id); persist(); render(); toast('Deleted'); } }
    if (act === 'ics') save(it.name.replace(/[^\w]+/g, '-').toLowerCase() + '.ics', ics([it]), 'text/calendar');
    if (act === 'renew') {
      if (it.repeat) {
        const d = parse(it.expiry);
        do { if (it.repeat === 'yearly') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1); } while (d < today());
        it.expiry = iso(d); persist(); render(); toast('Renewed — next expiry ' + fmt(it.expiry));
      } else {
        renewing = id; rf.reset();
        const d = parse(it.expiry); d.setFullYear(d.getFullYear() + 1); rf.date.value = iso(d);
        if (typeof rdlg.showModal === 'function') rdlg.showModal(); else rdlg.setAttribute('open', '');
      }
    }
  });

  document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.f;
    document.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  $('#add-btn').addEventListener('click', () => openAdd());
  document.querySelector('[data-open-add]').addEventListener('click', () => openAdd());
  $('#ics-all').addEventListener('click', () => { if (!items.length) return; save('kab-khatam-reminders.ics', ics(items), 'text/calendar'); toast('Open the file to add all reminders to your calendar'); });
  $('#export').addEventListener('click', () => save('kab-khatam-backup-' + iso(today()) + '.json', JSON.stringify({ app: 'kab-khatam', version: 1, items }, null, 2), 'application/json'));
  $('#import').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(incoming)) throw new Error('bad');
      const ids = new Set(items.map((x) => x.id)); let added = 0;
      incoming.forEach((x) => { if (x && x.name && /^\d{4}-\d{2}-\d{2}$/.test(x.expiry) && !ids.has(x.id)) { items.push({ remind: [7, 1], cat: 'Other', ...x, id: x.id || uid() }); added++; } });
      persist(); render(); toast('Restored ' + added + ' items');
    } catch (err) { toast('That file is not a Kab Khatam backup'); }
    e.target.value = '';
  });
  $('#sample').addEventListener('click', () => {
    const t = today(); const add = (n) => { const d = new Date(t); d.setDate(d.getDate() + n); return iso(d); };
    const q = Math.floor(t.getMonth() / 3); const lpgEnd = new Date(t.getFullYear() + 1, q * 3 + 3, 0);
    items = [
      { name: 'PUC certificate — Activa', cat: 'Vehicle', expiry: add(-3), repeat: '', note: 'Petrol pump near the bus stand does it in 5 minutes' },
      { name: 'Netflix', cat: 'Subscription', expiry: add(5), repeat: 'monthly', note: '₹199 from HDFC card' },
      { name: 'Car insurance — RJ27 CA 4512', cat: 'Vehicle', expiry: add(12), repeat: 'yearly', note: 'Policy no. in the glovebox file' },
      { name: 'Cough syrup (Benadryl)', cat: 'Medicine', expiry: add(21), repeat: '', note: 'Medicine box, kitchen shelf' },
      { name: 'Phone warranty', cat: 'Warranty', expiry: add(46), repeat: '', note: 'Bill is in Gmail' },
      { name: 'Gas cylinder test', cat: 'Gas cylinder', expiry: iso(lpgEnd), repeat: '', note: 'Code on cylinder: ' + 'ABCD'[q] + '-' + String(lpgEnd.getFullYear()).slice(2) },
      { name: 'Passport — Ronak', cat: 'Document', expiry: add(250), repeat: '', note: 'Renew 9 months before any foreign trip' },
      { name: 'Driving licence', cat: 'Document', expiry: add(1460), repeat: '', note: '' }
    ].map((x) => ({ id: uid(), created: iso(t), remind: [30, 7, 1], ...x }));
    persist(); render(); toast('Sample data loaded — delete anything you like');
  });

  // ---------- open-app alerts ----------
  $('#notify').addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('This browser does not support alerts — use the calendar instead'); return; }
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Alerts on — you will be reminded each time you open the app' : 'Alerts are blocked in your browser settings');
    if (p === 'granted') alertDue(true);
  });
  function alertDue(force) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const key = KEY + '-alerted'; let last = '';
    try { last = localStorage.getItem(key) || ''; } catch (e) {}
    if (!force && last === iso(today())) return;
    const due = items.filter((it) => { const n = daysLeft(it.expiry); return n < 0 || (it.remind || []).some((r) => n <= r); });
    if (!due.length) return;
    const body = due.slice(0, 4).map((it) => { const n = daysLeft(it.expiry); return it.name + ': ' + (n < 0 ? 'expired' : n === 0 ? 'today' : n + ' days'); }).join('\n');
    try { new Notification('Kab Khatam — ' + due.length + ' due soon', { body, icon: 'icons/icon-192.png' }); } catch (e) {}
    try { localStorage.setItem(key, iso(today())); } catch (e) {}
  }

  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600); }

  render();
  alertDue(false);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
