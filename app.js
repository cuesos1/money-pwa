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
async function renderWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(),now.getMonth(),now.getDate()-6);
  const end = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const entries = await changeHistory('readonly', store => store.index('createdAt').getAll(IDBKeyRange.bound(start.getTime(),end.getTime(),false,true)));
  const valid = entries.filter(entry => Number.isSafeInteger(entry.cents) && entry.cents > 0 && entry.cents <= 100000000000 && Number.isSafeInteger(entry.createdAt) && validPercentages(entry.percentages) && Array.isArray(entry.amounts) && JSON.stringify(entry.amounts) === JSON.stringify(allocate(entry.cents,entry.percentages)));
  const days = Array.from({length:7},(_,i) => new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  const totals = days.map(day => valid.filter(entry => localDay(entry.createdAt) === localDay(day)).reduce((sum,entry) => sum+entry.cents,0));
  const total = totals.reduce((a,b) => a+b,0);
  const breakdown = categories.map((_,i) => valid.reduce((sum,entry) => sum+entry.amounts[i],0));
  document.querySelector('#week-range').textContent = `${start.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} — ${now.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} · включая сегодня`;
  document.querySelector('#week-total').textContent = money(total);
  const chart = document.querySelector('#week-chart');
  chart.replaceChildren();
  chart.setAttribute('aria-label', days.map((day,i) => `${day.toLocaleDateString('ru-RU')}: ${money(totals[i])}`).join('; '));
  const maximum = Math.max(...totals,1);
  days.forEach((day,i) => {
    const column = document.createElement('div');
    column.className = 'day-column' + (i === 6 ? ' today' : '');
    column.title = `${day.toLocaleDateString('ru-RU')}: ${money(totals[i])}`;
    column.innerHTML = `<div class="bar-track"><div class="day-bar ${totals[i] ? '' : 'empty'}" style="--height:${totals[i]/maximum*100}%"></div></div><div class="day-label">${day.toLocaleDateString('ru-RU',{weekday:'short'})}</div>`;
    chart.append(column);
  });
  document.querySelector('#week-breakdown').innerHTML = categories.map((category,i) => `<div><p class="breakdown-label">${category.name}</p><p class="breakdown-value">${money(breakdown[i])}</p></div>`).join('');
  document.querySelector('#week-count').textContent = valid.length ? `Записей: ${valid.length}. Распределение на момент записи.` : 'Пока нет записей. Запиши первый доход выше.';
  const history = document.querySelector('#history'); history.replaceChildren();
  valid.sort((a,b) => b.createdAt-a.createdAt || b.id-a.id).forEach(entry => {
    const li = document.createElement('li');
    const description = document.createElement('div');
    const amount = document.createElement('strong'); amount.className = 'history-amount'; amount.textContent = money(entry.cents);
    const date = document.createElement('span'); date.className = 'history-date'; date.textContent = new Date(entry.createdAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    description.append(amount,date);
    const button = document.createElement('button'); button.className = 'delete-entry'; button.textContent = '×'; button.setAttribute('aria-label',`Удалить запись ${money(entry.cents)} от ${date.textContent}`);
    button.addEventListener('click', async () => {
      if (!window.confirm(`Удалить запись ${money(entry.cents)}?`)) return;
      button.disabled = true;
      try { await changeHistory('readwrite',store => store.delete(entry.id)); await renderWeek(); }
      catch (_) { button.disabled = false; recordStatus.textContent = 'Не удалось удалить запись. Попробуй ещё раз.'; }
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
    await changeHistory('readwrite',store => store.add({cents,createdAt:Date.now(),percentages:[...percentages],amounts:allocate(cents,percentages)}));
    saved = true;
    income.value = ''; render();
    recordStatus.textContent = `${money(cents)} записано только на устройстве.`;
    await renderWeek();
  } catch (_) { recordStatus.textContent = saved ? 'Доход записан, но статистика не обновилась. Перезапусти приложение.' : 'Не удалось сохранить доход. Проверь доступное место и разрешение браузера на хранение данных.'; }
  finally { recording = false; updateRecordButton(); }
});
openHistory().then(async db => {
  historyDB = db;
  db.onversionchange = () => { db.close(); historyDB = null; updateRecordButton(); recordStatus.textContent = 'Хранилище обновляется. Перезапусти приложение.'; };
  await renderWeek(); updateRecordButton();
}).catch(() => { recordStatus.textContent = 'Хранилище истории недоступно. Расчёт работает, но доходы записать нельзя.'; });
document.addEventListener('visibilitychange', () => { if (!document.hidden && historyDB) renderWeek().catch(() => { recordStatus.textContent = 'Не удалось обновить статистику.'; }); });
