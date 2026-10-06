'use strict';
const {defaults, validPercentages, parseAmount, allocate} = MoneyCalculator;
const categories = [
  {name:'Кредитка', icon:'💳', tint:'#e7ddfa'},
  {name:'Жизнь', icon:'🏠', tint:'#d8e7fc'},
  {name:'Резерв', icon:'🛡️', tint:'#d4eee4'},
  {name:'Свободные', icon:'☀️', tint:'#fae8c9'}
];
const storageKey = 'money-pwa.percentages.v1';
let percentages = [...defaults];
try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (validPercentages(saved)) percentages = saved; } catch (_) { /* Defaults also work when storage is unavailable. */ }
const income = document.querySelector('#income');
const results = document.querySelector('#results');
const fields = document.querySelector('#percentage-fields');
const status = document.querySelector('#settings-status');
categories.forEach((category, i) => {
  results.insertAdjacentHTML('beforeend', `<article class="glass card"><div class="card-top"><span class="symbol" style="--tint:${category.tint}" aria-hidden="true">${category.icon}</span><span class="percent" id="percent-${i}"></span></div><p class="card-label">${category.name}</p><p class="card-value" id="value-${i}"></p></article>`);
  fields.insertAdjacentHTML('beforeend', `<div class="setting-row"><label for="percentage-${i}">${category.name}</label><div class="setting-number"><input id="percentage-${i}" type="number" inputmode="numeric" min="0" max="100" step="1" required aria-describedby="settings-status"><span>%</span></div></div>`);
});
const inputs = categories.map((_, i) => document.querySelector(`#percentage-${i}`));
function fillSettings() { inputs.forEach((input, i) => { input.value = percentages[i]; }); }
function render() {
  const cents = parseAmount(income.value);
  document.querySelector('#income-error').textContent = cents === null ? 'Введи сумму от 0 до 1 000 000 000 ₽, максимум две цифры после запятой.' : '';
  income.setAttribute('aria-invalid', String(cents === null));
  const amounts = cents === null ? null : allocate(cents, percentages);
  categories.forEach((_, i) => {
    document.querySelector(`#percent-${i}`).textContent = `${percentages[i]}%`;
    document.querySelector(`#value-${i}`).textContent = amounts ? new Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB', minimumFractionDigits: amounts[i] % 100 ? 2 : 0, maximumFractionDigits:2}).format(amounts[i] / 100) : '—';
  });
}
function draft() { return inputs.map(input => input.value.trim() === '' ? NaN : Number(input.value)); }
function validateDraft() {
  const values = draft();
  const valid = validPercentages(values);
  status.classList.toggle('error', !valid);
  status.textContent = valid ? '100% — можно сохранить.' : values.every(v => Number.isInteger(v) && v >= 0 && v <= 100) ? `Сейчас ${values.reduce((a,b) => a+b,0)}%. Нужно 100%.` : 'В каждом поле нужно целое число от 0 до 100.';
  return valid;
}
function save(values) {
  percentages = [...values];
  let stored = true;
  try { localStorage.setItem(storageKey, JSON.stringify(percentages)); } catch (_) { stored = false; }
  fillSettings(); render();
  status.classList.toggle('error', !stored);
  status.textContent = stored ? 'Настройки сохранены на устройстве.' : 'Расчёт обновлён. Браузер не разрешил сохранение — после закрытия настройки могут сброситься.';
}
income.addEventListener('input', render);
inputs.forEach(input => input.addEventListener('input', validateDraft));
document.querySelector('#settings-toggle').addEventListener('click', event => {
  const section = document.querySelector('#settings');
  section.hidden = !section.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!section.hidden));
  if (!section.hidden) { fillSettings(); validateDraft(); }
});
document.querySelector('#settings-form').addEventListener('submit', event => { event.preventDefault(); if (validateDraft()) save(draft()); });
document.querySelector('#reset').addEventListener('click', () => save(defaults));
let installPrompt;
const installButton = document.querySelector('#install');
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; installButton.hidden = false; });
installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; installButton.hidden = true;
});
window.addEventListener('appinstalled', () => { installButton.hidden = true; document.querySelector('#install-help').hidden = true; });
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) document.querySelector('#install-help').hidden = true;
fillSettings(); render();
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').then(async registration => {
    await navigator.serviceWorker.ready;
    document.querySelector('#offline-status').textContent = 'Готово к работе офлайн. Данные только на устройстве.';
  }).catch(() => { document.querySelector('#offline-status').textContent = 'Данные только на устройстве. Офлайн-режим не включился: проверь запуск через localhost или HTTPS.'; });
} else { document.querySelector('#offline-status').textContent = 'Для офлайн-режима и установки открой через localhost или HTTPS.'; }

// Theme and income history stay in this browser; no network requests carry them.
const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let themePreference = null;
try { const saved = localStorage.getItem('money-pwa.theme.v1'); if (['light','dark'].includes(saved)) themePreference = saved; } catch (_) {}
function applyTheme() {
  const dark = (themePreference || (themeQuery.matches ? 'dark' : 'light')) === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0e1421' : '#edf1f8';
  const button = document.querySelector('#theme-toggle');
  button.textContent = dark ? '☀' : '☾';
  button.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  button.setAttribute('aria-pressed', String(dark));
}
applyTheme();
themeQuery.addEventListener('change', () => { if (!themePreference) applyTheme(); });
document.querySelector('#theme-toggle').addEventListener('click', () => {
  themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  try { localStorage.setItem('money-pwa.theme.v1', themePreference); } catch (_) {
    document.querySelector('#record-status').textContent = 'Тема изменена, но браузер не разрешил сохранить выбор.';
  }
});
const recordButton = document.querySelector('#record-income');
const recordStatus = document.querySelector('#record-status');
const money = cents => new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',minimumFractionDigits:cents % 100 ? 2 : 0,maximumFractionDigits:2}).format(cents/100);
let historyDB = null;
let recording = false;
function updateRecordButton() { const cents = parseAmount(income.value); recordButton.disabled = !historyDB || recording || cents === null || cents <= 0; }
income.addEventListener('input', updateRecordButton);
function openHistory() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('money-pwa.history',1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('entries',{keyPath:'id',autoIncrement:true});
      store.createIndex('createdAt','createdAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage blocked'));
  });
}
function changeHistory(mode, operation) {
  return new Promise((resolve,reject) => {
    const transaction = historyDB.transaction('entries',mode);
    const request = operation(transaction.objectStore('entries'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('Storage transaction aborted'));
    transaction.onerror = () => {}; // onabort reports failure; never report a failed write as saved.
  });
}
function localDay(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
let statisticsRevision = 0;
async function renderWeek() {
  const revision = ++statisticsRevision;
  const now = new Date();
  const period = document.querySelector('#period').value;
  const bounds = MoneyLedger.periodBounds(period,now,document.querySelector('#period-start').value,document.querySelector('#period-end').value);
  const error = document.querySelector('#period-error');
  if (!bounds) { error.textContent = 'Выбери корректные даты: начало не позже конца.'; document.querySelector('#week-total').textContent = '—'; document.querySelector('#expense-total').textContent = '—'; document.querySelector('#net-total').textContent = '—'; document.querySelector('#week-chart').replaceChildren(); document.querySelector('#week-breakdown').replaceChildren(); document.querySelector('#history').replaceChildren(); document.querySelector('#week-count').textContent = 'Выбери период для просмотра записей.'; document.querySelector('#week-range').textContent = ''; return; }
  error.textContent = '';
  const {start,end} = bounds;
  const entries = await changeHistory('readonly',store => store.index('createdAt').getAll(IDBKeyRange.bound(start.getTime(),end.getTime(),false,true)));
  if (revision !== statisticsRevision) return;
  const valid = entries.filter(MoneyLedger.validEntry);
  const totals = MoneyLedger.summarize(valid);
  document.querySelector('#week-total').textContent = money(totals.totalIncome);
  document.querySelector('#expense-total').textContent = money(totals.totalExpenses);
  document.querySelector('#net-total').textContent = money(totals.net);
  let chartStart = start;
  if (period === 'all') {
    const first = valid.length ? valid.reduce((first,entry)=>Math.min(first,entry.createdAt),Infinity) : now.getTime();
    const date = new Date(first); chartStart = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  }
  const last = new Date(end.getFullYear(),end.getMonth(),end.getDate()-1);
  const formatDate = date => date.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
  document.querySelector('#week-range').textContent = `${period === 'all' ? 'Всё время · ' : ''}${formatDate(chartStart)} — ${formatDate(last)} · доходы`;
  // Use calendar-day buckets, at most twelve bars even for multi-year history.
  const span = Math.round((Date.UTC(last.getFullYear(),last.getMonth(),last.getDate())-Date.UTC(chartStart.getFullYear(),chartStart.getMonth(),chartStart.getDate()))/86400000)+1;
  const bucketSize = Math.max(1,Math.ceil(span/12));
  const buckets = [];
  for (let offset=0;offset<span;offset+=bucketSize) {
    const begin = new Date(chartStart.getFullYear(),chartStart.getMonth(),chartStart.getDate()+offset);
    const finish = new Date(chartStart.getFullYear(),chartStart.getMonth(),chartStart.getDate()+Math.min(offset+bucketSize,span));
    buckets.push({begin,finish,cents:0});
  }
  for (const entry of valid) if (entry.type !== 'expense') {
    const bucket = buckets.find(bucket => entry.createdAt >= bucket.begin.getTime() && entry.createdAt < bucket.finish.getTime());
    if (bucket) bucket.cents += entry.cents;
  }
  const chart = document.querySelector('#week-chart'); chart.replaceChildren();
  chart.setAttribute('aria-label',buckets.map(bucket=>`${formatDate(bucket.begin)}: ${money(bucket.cents)}`).join('; '));
  const maximum = Math.max(...buckets.map(bucket=>bucket.cents),1);
  for (const bucket of buckets) {
    const column = document.createElement('div'); column.className = 'day-column';
    column.title = `${formatDate(bucket.begin)} — ${formatDate(new Date(bucket.finish.getFullYear(),bucket.finish.getMonth(),bucket.finish.getDate()-1))}: ${money(bucket.cents)}`;
    column.innerHTML = `<div class="bar-track"><div class="day-bar ${bucket.cents ? '' : 'empty'}" style="--height:${bucket.cents/maximum*100}%"></div></div><div class="day-label">${period === '7' ? bucket.begin.toLocaleDateString('ru-RU',{weekday:'short'}) : bucket.begin.toLocaleDateString('ru-RU',{day:'numeric',month:'numeric'})}</div>`;
    chart.append(column);
  }
  document.querySelector('#week-breakdown').innerHTML = categories.map((category,i)=>`<div><p class="breakdown-label">${category.name}</p><p class="breakdown-value">${money(totals.income[i]-totals.expenses[i])}</p><p class="breakdown-detail">Выделено ${money(totals.income[i])}<br>Потрачено ${money(totals.expenses[i])}</p></div>`).join('');
  document.querySelector('#week-count').textContent = valid.length ? `Записей: ${valid.length}. Остатки по категориям за период.` : 'Нет записей за этот период.';
  const history = document.querySelector('#history'); history.replaceChildren();
  valid.sort((a,b)=>b.createdAt-a.createdAt || b.id-a.id).forEach(entry=>{
    const expense = entry.type === 'expense';
    const li = document.createElement('li');
    const description = document.createElement('div');
    const amount = document.createElement('strong'); amount.className = 'history-amount'; amount.textContent = `${expense ? '−' : '+'}${money(entry.cents)}`;
    const date = document.createElement('span'); date.className = 'history-date'; date.textContent = new Date(entry.createdAt).toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const note = document.createElement('span'); note.className = 'history-note'; note.textContent = expense ? `${categories[entry.category].name}${entry.note ? ' · '+entry.note : ''}` : 'Доход';
    description.append(amount,date,note);
    const button = document.createElement('button'); button.className = 'delete-entry'; button.textContent = '×'; button.setAttribute('aria-label',`Удалить ${expense ? 'расход' : 'доход'} ${money(entry.cents)} от ${date.textContent}`);
    button.addEventListener('click',async()=>{
      if (!window.confirm(`Удалить ${expense ? 'расход' : 'доход'} ${money(entry.cents)}?`)) return;
      button.disabled = true;
      try { await changeHistory('readwrite',store=>store.delete(entry.id)); await renderWeek(); }
      catch (_) { button.disabled = false; recordStatus.textContent = 'Не удалось удалить запись или обновить статистику. Перезапусти приложение.'; }
    });
    li.append(description,button); history.append(li);
  });
  if (valid.length !== entries.length) recordStatus.textContent = 'Некоторые записи повреждены и не включены в статистику.';
}
recordButton.addEventListener('click',async () => {
  const cents = parseAmount(income.value);
  if (!historyDB || recording || cents === null || cents <= 0) return;
  recording = true; updateRecordButton();
  let saved = false;
  try {
    await changeHistory('readwrite',store => store.add({type:'income',cents,createdAt:Date.now(),percentages:[...percentages],amounts:allocate(cents,percentages)}));
    saved = true;
    income.value = ''; render();
    recordStatus.textContent = `${money(cents)} записано только на устройстве.`;
    await renderWeek();
  } catch (_) { recordStatus.textContent = saved ? 'Доход записан, но статистика не обновилась. Перезапусти приложение.' : 'Не удалось сохранить доход. Проверь доступное место и разрешение браузера на хранение данных.'; }
  finally { recording = false; updateRecordButton(); }
});
openHistory().then(async db => {
  historyDB = db;
  db.onversionchange = () => { db.close(); historyDB = null; updateRecordButton(); document.querySelector('#record-expense').disabled = true; recordStatus.textContent = 'Хранилище обновляется. Перезапусти приложение.'; };
  await renderWeek(); updateRecordButton(); document.querySelector('#record-expense').disabled = false;
}).catch(() => { recordStatus.textContent = 'Хранилище истории недоступно. Расчёт работает, но доходы записать нельзя.'; });
document.addEventListener('visibilitychange', () => { if (!document.hidden && historyDB) renderWeek().catch(() => { recordStatus.textContent = 'Не удалось обновить статистику.'; }); });

const {dateValue,parseDate} = MoneyLedger;
const todayValue = () => dateValue(new Date());
document.querySelector('#expense-date').value = todayValue();
document.querySelector('#expense-date').max = todayValue();
document.querySelector('#period-start').value = dateValue(new Date(new Date().getFullYear(),new Date().getMonth(),1));
document.querySelector('#period-end').value = todayValue();
function refreshStatistics() {
  if (historyDB) renderWeek().catch(()=>{ document.querySelector('#period-error').textContent = 'Не удалось загрузить статистику.'; });
}
document.querySelector('#period').addEventListener('change',()=>{
  document.querySelector('#custom-dates').hidden = document.querySelector('#period').value !== 'custom';
  refreshStatistics();
});
for (const id of ['period-start','period-end']) document.querySelector('#'+id).addEventListener('change',refreshStatistics);
let savingExpense = false;
document.querySelector('#expense-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const status = document.querySelector('#expense-status');
  const cents = parseAmount(document.querySelector('#expense-amount').value);
  const category = Number(document.querySelector('#expense-category').value);
  const note = document.querySelector('#expense-note').value.trim();
  const date = parseDate(document.querySelector('#expense-date').value);
  if (cents === null || cents <= 0 || !date || dateValue(date) > todayValue() || note.length > 120 || !Number.isInteger(category) || category < 0 || category > 3) {
    status.textContent = 'Введи положительную сумму, категорию и дату не позже сегодня.'; return;
  }
  if (!historyDB || savingExpense) return;
  savingExpense = true;
  const button = document.querySelector('#record-expense'); button.disabled = true;
  const createdAt = dateValue(date) === todayValue() ? Date.now() : new Date(date.getFullYear(),date.getMonth(),date.getDate(),12).getTime();
  let saved = false;
  try {
    await changeHistory('readwrite',store=>store.add({type:'expense',cents,category,note,createdAt})); saved = true;
    document.querySelector('#expense-amount').value = ''; document.querySelector('#expense-note').value = '';
    status.textContent = `${money(cents)} · ${categories[category].name} — расход записан на устройстве.`;
    await renderWeek();
  } catch (_) { status.textContent = saved ? 'Расход записан, но статистика не обновилась. Перезапусти приложение.' : 'Не удалось сохранить расход. Проверь доступное место и настройки браузера.'; }
  finally { savingExpense = false; button.disabled = !historyDB; }
});
