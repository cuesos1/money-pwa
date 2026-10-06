const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./calculator.js');
const {parseAmount, allocate, validPercentages, defaults} = globalThis.MoneyCalculator;
assert.equal(parseAmount('17 350,50'), 1735050);
assert.equal(parseAmount(''), 0);
assert.equal(parseAmount('0,01'), 1);
assert.equal(parseAmount('1000000000'), 100000000000);
for (const invalid of ['-1','1.234','1e3','abc','1,2,3','1000000000.01']) assert.equal(parseAmount(invalid), null);
for (const invalid of [[35,40,10,14],[35.5,39.5,10,15],[-1,41,10,50],[100,0,0],null]) assert.equal(validPercentages(invalid), false);
assert.deepEqual(allocate(1735000, defaults), [607250,694000,173500,260250]);
assert.deepEqual(allocate(1, [25,25,25,25]), [1,0,0,0]);
assert.deepEqual(allocate(100, [0,100,0,0]), [0,100,0,0]);
for (const percentages of [defaults,[25,25,25,25],[0,0,0,100],[1,2,3,94]]) {
  for (let cents = 0; cents < 10000; cents++) {
    const values = allocate(cents, percentages);
    assert.equal(values.reduce((a,b) => a+b,0), cents);
    values.forEach((v,i) => { assert.ok(Number.isInteger(v) && v >= 0); assert.ok(Math.abs(v-cents*percentages[i]/100) < 1); });
  }
  assert.equal(allocate(100000000000, percentages).reduce((a,b) => a+b,0), 100000000000);
}
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.webmanifest'),'utf8'));
for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(__dirname,icon.src)));
const worker = fs.readFileSync(path.join(__dirname,'sw.js'),'utf8');
const assets = worker.match(/const ASSETS = (\[.*\]);/)[1];
for (const asset of JSON.parse(assets.replace(/'/g,'"'))) assert.ok(fs.existsSync(path.join(__dirname,asset)));
console.log('PASS: input, validation, 40,000 allocations, limits, manifest and offline assets.');
require('./ledger.js');
const {periodBounds,parseDate,validEntry,summarize} = globalThis.MoneyLedger;
const now = new Date(2026,9,7,15);
assert.equal(parseDate('2026-02-30'),null);
assert.equal(parseDate('2024-02-29').getDate(),29);
assert.equal(periodBounds('7',now).start.getDate(),1);
assert.equal(periodBounds('month',now).start.getMonth(),9);
assert.equal(periodBounds('previous',new Date(2026,0,3)).start.getFullYear(),2025);
assert.equal(periodBounds('previous',new Date(2026,0,3)).start.getMonth(),11);
assert.equal(periodBounds('year',now).start.getMonth(),0);
assert.equal(periodBounds('custom',now,'2026-10-08','2026-10-07'),null);
assert.equal(periodBounds('custom',now,'2026-10-01','2026-10-07').end.getDate(),8);
const legacy = {cents:100000,createdAt:now.getTime(),percentages:defaults,amounts:allocate(100000,defaults)};
const expense = {type:'expense',cents:50000,category:1,note:'Продукты',createdAt:now.getTime()};
assert.ok(validEntry(legacy)); assert.ok(validEntry(expense));
assert.equal(validEntry({...expense,category:4}),false);
assert.equal(validEntry({...legacy,type:'unknown'}),false);
const totals = summarize([legacy,expense]);
assert.equal(totals.totalIncome,100000); assert.equal(totals.totalExpenses,50000);
assert.equal(totals.net,50000); assert.equal(totals.income[1]-totals.expenses[1],-10000);
console.log('PASS: calendar periods, leap days, legacy history, expenses and negative category remainder.');
