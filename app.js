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
