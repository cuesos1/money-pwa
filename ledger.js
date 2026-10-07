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
    if (!entry || !Number.isSafeInteger(entry.cents) || entry.cents <= 0 || entry.cents > 100000000000 || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < new Date(1900,0,1).getTime() || !Number.isFinite(new Date(entry.createdAt).getTime())) return false;
    if (entry.schema === 2) {
      const validId = id=>typeof id==='string' && /^[a-zA-Z0-9-]{1,60}$/.test(id);
      const validName = name=>typeof name==='string' && name.trim().length > 0 && name.length <= 30;
      if (entry.type==='expense') return validId(entry.categoryId) && validName(entry.categoryName) && typeof entry.note==='string' && entry.note.length<=120;
      if (entry.type!=='income' || !Array.isArray(entry.allocations) || !entry.allocations.every(item=>item && validId(item.categoryId) && validName(item.name)) || new Set(entry.allocations.map(item=>item.categoryId)).size!==entry.allocations.length) return false;
      const percentages=entry.allocations.map(item=>item.percent);
      return validPercentages(percentages) && JSON.stringify(entry.allocations.map(item=>item.cents))===JSON.stringify(allocate(entry.cents,percentages));
    }
    if (entry.type === 'expense') return Number.isInteger(entry.category) && entry.category >= 0 && entry.category < 4 && typeof entry.note === 'string' && entry.note.length <= 120;
    return (entry.type === undefined || entry.type === 'income') && validPercentages(entry.percentages) && entry.percentages.length===4 && Array.isArray(entry.amounts) && JSON.stringify(entry.amounts) === JSON.stringify(allocate(entry.cents,entry.percentages));
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
  const legacyIds=['debt','life','reserve','free'],legacyNames=['Кредитка','Жизнь','Резерв','Свободные'];
  function normalize(entry) {
    if (entry.schema===2) return entry;
    if (entry.type==='expense') return {...entry,categoryId:legacyIds[entry.category],categoryName:legacyNames[entry.category]};
    return {...entry,type:'income',allocations:entry.amounts.map((cents,i)=>({categoryId:legacyIds[i],name:legacyNames[i],percent:entry.percentages[i],cents}))};
  }
  function summarizeCategories(entries,categories) {
    const map=new Map(categories.map(category=>[category.id,{id:category.id,name:category.name,icon:category.icon,income:0,expenses:0}]));
    let totalIncome=0,totalExpenses=0;
    const get=(id,name,icon)=>{if(!map.has(id)) map.set(id,{id,name,icon,income:0,expenses:0});return map.get(id);};
    for(const raw of entries) {
      const entry=normalize(raw);
      if(entry.type==='expense') {get(entry.categoryId,entry.categoryName,entry.icon).expenses+=entry.cents;totalExpenses+=entry.cents;}
      else {entry.allocations.forEach(item=>{get(item.categoryId,item.name,item.icon).income+=item.cents;});totalIncome+=entry.cents;}
    }
    if (![totalIncome,totalExpenses,...[...map.values()].flatMap(item=>[item.income,item.expenses])].every(Number.isSafeInteger)) throw new Error('Сумма записей слишком велика для точного расчёта.');
    return {totalIncome,totalExpenses,net:totalIncome-totalExpenses,categories:[...map.values()]};
  }
  root.MoneyLedger = {dateValue,parseDate,periodBounds,validEntry,summarize,normalize,summarizeCategories};
})(globalThis);
