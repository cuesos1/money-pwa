(function(root) {
  'use strict';
  const {allocate,validPercentages} = root.MoneyCalculator;
  const dateValue = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split('-').map(Number);
    if (y < 1900 || y > 9999) return null;
    const date = new Date(y,m-1,d);
    return dateValue(date) === value ? date : null;
  }
  function periodBounds(period, now, from, to) {
    const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    let start, end = new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
    if (period === '7') start = new Date(today.getFullYear(),today.getMonth(),today.getDate()-6);
    else if (period === 'month') start = new Date(today.getFullYear(),today.getMonth(),1);
    else if (period === 'previous') { start = new Date(today.getFullYear(),today.getMonth()-1,1); end = new Date(today.getFullYear(),today.getMonth(),1); }
    else if (period === 'year') start = new Date(today.getFullYear(),0,1);
    else if (period === 'all') start = new Date(1900,0,1);
    else if (period === 'custom') { start = parseDate(from); const last = parseDate(to); if (!start || !last || start > last) return null; end = new Date(last.getFullYear(),last.getMonth(),last.getDate()+1); }
    else return null;
    return {start,end};
  }
  function validEntry(entry) {
    if (!Number.isSafeInteger(entry.cents) || entry.cents <= 0 || entry.cents > 100000000000 || !Number.isSafeInteger(entry.createdAt)) return false;
    if (entry.type === 'expense') return Number.isInteger(entry.category) && entry.category >= 0 && entry.category < 4 && typeof entry.note === 'string' && entry.note.length <= 120;
    return (entry.type === undefined || entry.type === 'income') && validPercentages(entry.percentages) && Array.isArray(entry.amounts) && JSON.stringify(entry.amounts) === JSON.stringify(allocate(entry.cents,entry.percentages));
  }
  function summarize(entries) {
    const income = [0,0,0,0], expenses = [0,0,0,0];
    for (const entry of entries) {
      if (entry.type === 'expense') expenses[entry.category] += entry.cents;
      else entry.amounts.forEach((amount,i) => { income[i] += amount; });
    }
    const totalIncome = income.reduce((a,b)=>a+b,0), totalExpenses = expenses.reduce((a,b)=>a+b,0);
    if (![...income,...expenses,totalIncome,totalExpenses].every(Number.isSafeInteger)) throw new Error('Total exceeds safe integer');
    return {income,expenses,totalIncome,totalExpenses,net:totalIncome-totalExpenses};
  }
  root.MoneyLedger = {dateValue,parseDate,periodBounds,validEntry,summarize};
})(globalThis);
