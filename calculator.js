/* Pure calculations, shared by the app and the verification script. */
(function (root) {
  'use strict';
  const defaults = [35, 40, 10, 15];
  function validPercentages(values) {
    return Array.isArray(values) && values.length === 4 && values.every(v => Number.isInteger(v) && v >= 0 && v <= 100) && values.reduce((a, b) => a + b, 0) === 100;
  }
  function parseAmount(raw) {
    const text = raw.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    if (!text) return 0;
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
    const [whole, decimal = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents <= 100000000000 ? cents : null;
  }
  function allocate(cents, percentages) {
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000000 || !validPercentages(percentages)) throw new Error('Invalid allocation');
    const products = percentages.map(p => cents * p);
    const amounts = products.map(p => Math.floor(p / 100));
    const order = products.map((p, index) => ({index, remainder: p % 100})).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    const remaining = cents - amounts.reduce((a, b) => a + b, 0);
    for (let i = 0; i < remaining; i++) amounts[order[i].index]++;
    return amounts;
  }
  root.MoneyCalculator = {defaults, validPercentages, parseAmount, allocate};
})(globalThis);
