(function(root) {
  'use strict';
  const MAX = 100000000000;
  const centsValid = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX;
  function validDebt(debt) {
    return Boolean(debt && typeof debt.id === 'string' && /^[a-zA-Z0-9-]{1,60}$/.test(debt.id) && typeof debt.name === 'string' && debt.name.trim().length > 0 && debt.name.length <= 40 && ['card','loan','mortgage','personal'].includes(debt.type) && centsValid(debt.balance) && Number.isFinite(debt.apr) && debt.apr >= 0 && debt.apr <= 1000 && (debt.type !== 'personal' || debt.apr === 0) && centsValid(debt.minimum) && centsValid(debt.payment) && debt.payment >= debt.minimum);
  }
  function payoff(balance,apr,payment) {
    if (!centsValid(balance) || !centsValid(payment) || !Number.isFinite(apr) || apr < 0 || apr > 1000) throw new Error('Invalid debt');
    if (!balance) return {months:0,interest:0,total:0};
    if (!payment || payment <= Math.round(balance * apr / 1200)) return {months:null,reason:'insufficient'};
    let remaining = balance, interest = 0, total = 0;
    for (let months = 1; months <= 1200; months++) {
      const charge = Math.round(remaining * apr / 1200);
      interest += charge;
      const paid = Math.min(payment,remaining+charge);
      total += paid; remaining += charge-paid;
      if (!remaining) return {months,interest,total};
    }
    return {months:null,reason:'long'};
  }
  function debtPlan(debts,monthlyIncome) {
    if (!Array.isArray(debts) || debts.length > 12 || !debts.every(validDebt) || !centsValid(monthlyIncome)) throw new Error('Invalid debt plan');
    const payment = debts.reduce((sum,debt)=>sum+(debt.balance ? debt.payment : 0),0);
    const minimum = debts.reduce((sum,debt)=>sum+(debt.balance ? debt.minimum : 0),0);
    return {payment,minimum,percent:monthlyIncome > 0 ? Math.ceil(payment/monthlyIncome*100) : null,minimumPercent:monthlyIncome > 0 ? Math.ceil(minimum/monthlyIncome*100) : null,estimates:debts.map(debt=>payoff(debt.balance,debt.apr,debt.payment))};
  }
  // Keep the requested share exact, distributing the remainder proportionally.
  function distributeShare(categories,targetId,share) {
    if (!Number.isInteger(share) || share < 0 || share > 100) throw new Error('Invalid share');
    const result = categories.map(category=>({...category}));
    const target = result.find(category=>category.id === targetId);
    if (!target) throw new Error('Missing debt category');
    target.enabled = share > 0; target.percent = share;
    const others = result.filter(category=>category.id !== targetId && category.enabled);
    if (!others.length && share !== 100) throw new Error('Enable another category');
    const weight = others.reduce((sum,category)=>sum+category.percent,0);
    const fractions = others.map(category=>({category,exact:(100-share)*(weight ? category.percent/weight : 1/others.length)}));
    let remaining = 100-share;
    fractions.forEach(item=>{item.category.percent=Math.floor(item.exact);remaining-=item.category.percent;});
    fractions.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact)));
    for (let i=0;i<remaining;i++) fractions[i].category.percent++;
    result.filter(category=>!category.enabled).forEach(category=>{category.percent=0;});
    return result;
  }
  root.MoneyFinance = {MAX,centsValid,validDebt,payoff,debtPlan,distributeShare};
})(globalThis);
