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
