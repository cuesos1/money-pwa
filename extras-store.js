(function(root){
 'use strict';
 const defaultExtras=()=>({key:'extras',revision:0,welcomed:false,goals:[],templates:[{id:'food',name:'Продукты',categoryId:'life'},{id:'transport',name:'Транспорт',categoryId:'life'},{id:'cafe',name:'Кафе',categoryId:'free'},{id:'housing',name:'Жильё',categoryId:'life'}]});
 const validId=id=>typeof id==='string' && /^[a-zA-Z0-9-]{1,60}$/.test(id);
 function validExtras(value){return Boolean(value && value.key==='extras' && Number.isSafeInteger(value.revision) && value.revision>=0 && typeof value.welcomed==='boolean' && Array.isArray(value.goals) && value.goals.length<=20 && value.goals.every(goal=>goal && validId(goal.id) && typeof goal.name==='string' && goal.name.trim() && goal.name.length<=40 && MoneyFinance.centsValid(goal.target) && goal.target>0 && MoneyFinance.centsValid(goal.saved) && (goal.autoCategoryId===undefined || goal.autoCategoryId==='' || validId(goal.autoCategoryId)) && (typeof goal.deadline==='string' && (goal.deadline==='' || MoneyLedger.parseDate(goal.deadline)))) && new Set(value.goals.map(goal=>goal.id)).size===value.goals.length && new Set(value.goals.filter(goal=>goal.autoCategoryId).map(goal=>goal.autoCategoryId)).size===value.goals.filter(goal=>goal.autoCategoryId).length && Array.isArray(value.templates) && value.templates.length<=20 && value.templates.every(item=>item && validId(item.id) && validId(item.categoryId) && typeof item.name==='string' && item.name.trim() && item.name.length<=40) && new Set(value.templates.map(item=>item.id)).size===value.templates.length);}
 function validBackup(value){return Boolean(value && value.format==='potok-backup' && value.version===1 && MoneyStore.validConfig(value.config) && validExtras(value.extras) && Array.isArray(value.entries) && value.entries.length<=100000 && value.entries.every(entry=>MoneyLedger.validEntry(entry) && Number.isSafeInteger(entry.id) && entry.id>0) && new Set(value.entries.map(entry=>entry.id)).size===value.entries.length);}
 function goalProgress(goal,entries){
  let automatic=0;
  for(const entry of entries)if(MoneyLedger.validEntry(entry) && entry.type==='income' && entry.schema===2)for(const allocation of entry.allocations)if(allocation.goalId===goal.id)automatic+=allocation.cents;
  const total=goal.saved+automatic;if(!Number.isSafeInteger(total))throw new Error('Сумма цели слишком велика для точного расчёта.');return {automatic,total};
 }
 function frequentExpenses(entries,categories){
  const active=new Set(categories.filter(category=>category.enabled).map(category=>category.id)),groups=new Map();
  for(const raw of entries){if(!MoneyLedger.validEntry(raw) || raw.type!=='expense')continue;const entry=MoneyLedger.normalize(raw),note=entry.note.trim();if(!note || !active.has(entry.categoryId))continue;const key=JSON.stringify([entry.categoryId,note.toLocaleLowerCase('ru-RU').replace(/\s+/g,' ')]),previous=groups.get(key);if(!previous)groups.set(key,{note,categoryId:entry.categoryId,cents:entry.cents,count:1,createdAt:entry.createdAt,id:entry.id || 0});else{previous.count++;if(entry.createdAt>previous.createdAt || (entry.createdAt===previous.createdAt && (entry.id || 0)>previous.id)){Object.assign(previous,{note,cents:entry.cents,createdAt:entry.createdAt,id:entry.id || 0});}}}
  return [...groups.values()].filter(item=>item.count>=2).sort((a,b)=>b.count-a.count || b.createdAt-a.createdAt || b.id-a.id).slice(0,6);
 }
 root.MoneyExtras={defaultExtras,validExtras,validBackup,goalProgress,frequentExpenses};
})(globalThis);
