
'use strict';
let extras=null,goalId=null,backupCandidate=null,extrasBusy=false,overviewRevision=0;
const cloneExtras=()=>JSON.parse(JSON.stringify(extras));
async function persistExtras(next){extras=await MoneyStore.saveExtras(next);renderExtras();}
function renderExtras(){
 if(!extras)return;
 const quick=$('#quick-expenses');quick.replaceChildren();
 extras.templates.filter(item=>config.categories.some(category=>category.enabled && category.id===item.categoryId)).forEach(item=>{
  const button=el('button','quick-chip',item.name);button.type='button';button.addEventListener('click',()=>{expenseCategory=item.categoryId;$('#expense-open').click();$('#expense-note').value=item.name;$('#expense-amount').value='';$('#expense-date').value=today();$('#expense-amount').focus();});quick.append(button);
 });
 const list=$('#template-list');list.replaceChildren();
 extras.templates.forEach(item=>{const row=el('div','template-row'),text=el('span','',item.name),button=el('button','text-button','Убрать');button.type='button';button.setAttribute('aria-label','Убрать быстрый расход '+item.name);button.addEventListener('click',async()=>{button.disabled=true;try{const next=cloneExtras();next.templates=next.templates.filter(template=>template.id!==item.id);await persistExtras(next);}catch(error){$('#backup-status').textContent=errorText(error);button.disabled=false;}});row.append(text,button);list.append(row);});
 const goals=$('#goal-list');goals.replaceChildren();
 if(!extras.goals.length)goals.append(el('p','hint','Например, подушка на 100 000 ₽ или отпуск на 60 000 ₽.'));
 extras.goals.forEach(goal=>{
  const card=el('article','glass goal-card'),heading=el('div','section-heading'),edit=el('button','text-button','Изменить');edit.type='button';edit.setAttribute('aria-label','Изменить цель '+goal.name);edit.addEventListener('click',()=>openGoal(goal));heading.append(el('h3','',goal.name),edit);const bar=el('div','goal-track'),fill=el('div','goal-fill');fill.style.width=Math.min(100,goal.saved/goal.target*100)+'%';bar.append(fill);bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',goal.name);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(goal.target));bar.setAttribute('aria-valuenow',String(Math.min(goal.saved,goal.target)));
  card.append(heading,el('p','goal-amount',money(goal.saved)),el('p','hint','из '+money(goal.target)),bar);
  const remaining=Math.max(0,goal.target-goal.saved);let description=remaining?'Осталось '+money(remaining):'Цель достигнута.';
  if(goal.deadline && remaining){const deadline=parseDate(goal.deadline),now=new Date();if(dateValue(deadline)<today())description+=' Срок прошёл — можно выбрать новую дату.';else{const months=Math.max(1,(deadline.getFullYear()-now.getFullYear())*12+deadline.getMonth()-now.getMonth()+(deadline.getDate()>now.getDate()?1:0));description+=` До ${deadline.toLocaleDateString('ru-RU')}: примерно ${money(Math.ceil(remaining/months))} в месяц.`;}}
  card.append(el('p','hint',description));goals.append(card);
 });
}
$('#tab-goals').addEventListener('click',()=>{showTab(false);$('#plan-panel').hidden=true;$('#goals-panel').hidden=false;$('#tab-plan').setAttribute('aria-current','false');$('#tab-goals').setAttribute('aria-current','page');renderExtras();});
function openGoal(goal){goalId=goal?.id || null;$('#goal-name').value=goal?.name || '';$('#goal-target').value=goal?String(goal.target/100):'';$('#goal-saved').value=goal?String(goal.saved/100):'';$('#goal-deadline').value=goal?.deadline || '';$('#goal-status').textContent='';$('#goal-dialog').showModal();}
$('#goal-add').addEventListener('click',()=>{if(extras && extras.goals.length<20)openGoal(null);else $('#extras-status').textContent='Можно сохранить до 20 целей.';});
$('#goal-close').addEventListener('click',()=>$('#goal-dialog').close());
$('#goal-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!extras || extrasBusy)return;
 const goal={id:goalId || crypto.randomUUID(),name:$('#goal-name').value.trim(),target:parseAmount($('#goal-target').value),saved:parseAmount($('#goal-saved').value),deadline:$('#goal-deadline').value};
 const next=cloneExtras();if(goalId)next.goals=next.goals.map(item=>item.id===goalId?goal:item);else next.goals.push(goal);
 if(!MoneyExtras.validExtras(next)){$('#goal-status').textContent='Проверь название, положительную цель, накопленную сумму и дату.';return;}
 extrasBusy=true;const button=$('#goal-form button[type=submit]');button.disabled=true;
 try{await persistExtras(next);$('#goal-dialog').close();}catch(error){$('#goal-status').textContent=errorText(error);}finally{extrasBusy=false;button.disabled=false;}
});
$('#template-save').addEventListener('click',async()=>{
 if(!extras || extrasBusy)return;const name=$('#expense-note').value.trim();
 if(!name || name.length>40){$('#expense-status').textContent='Для шаблона напиши короткое название в поле «На что?» — до 40 символов.';return;}
 if(extras.templates.some(item=>item.name===name && item.categoryId===expenseCategory)){$('#expense-status').textContent='Такой быстрый расход уже есть.';return;}
 if(extras.templates.length>=20){$('#expense-status').textContent='Можно сохранить до 20 быстрых расходов. Убери ненужные в настройках → Данные.';return;}
 extrasBusy=true;
 try{const next=cloneExtras();next.templates.push({id:crypto.randomUUID(),name,categoryId:expenseCategory});await persistExtras(next);$('#expense-status').textContent='Шаблон сохранён. Расход ещё не записан.';}catch(error){$('#expense-status').textContent=errorText(error);}finally{extrasBusy=false;}
});
async function renderMonth(){
 if(!ready)return;const revision=++overviewRevision,now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1),previous=new Date(now.getFullYear(),now.getMonth()-1,1),lastPrevious=new Date(now.getFullYear(),now.getMonth(),0),previousEnd=new Date(previous.getFullYear(),previous.getMonth(),Math.min(now.getDate(),lastPrevious.getDate())+1);
 const [currentRaw,previousRaw]=await Promise.all([MoneyStore.entries(start.getTime(),end.getTime()),MoneyStore.entries(previous.getTime(),previousEnd.getTime())]);if(revision!==overviewRevision)return;
 const current=summarizeCategories(currentRaw.filter(validEntry),config.categories),before=summarizeCategories(previousRaw.filter(validEntry),config.categories),numbers=$('#month-numbers');numbers.replaceChildren();
 for(const [label,value] of [['Получено',current.totalIncome],['Потрачено',current.totalExpenses],['Разница',current.net]]){const item=el('div');item.append(el('span','hint',label),el('strong','',money(value)));numbers.append(item);}
 let text='Разница — доходы минус расходы, не баланс счёта. ';
 if(before.totalExpenses){const delta=current.totalExpenses-before.totalExpenses;text+=`Расходы ${delta>=0?'выше':'ниже'} на ${Math.round(Math.abs(delta)/before.totalExpenses*100)}% относительно тех же дней прошлого месяца.`;}else text+='За те же дни прошлого месяца расходы не записаны.';
 const growth=current.categories.map(category=>({...category,growth:category.expenses-(before.categories.find(item=>item.id===category.id)?.expenses || 0)})).filter(category=>category.growth>0).sort((a,b)=>b.growth-a.growth)[0];if(growth)text+=` Больше всего выросли: ${growth.name} (+${money(growth.growth)}).`;
 if(currentRaw.some(entry=>!validEntry(entry)) || previousRaw.some(entry=>!validEntry(entry)))text+=' Повреждённые записи не включены.';
 $('#month-comparison').textContent=text;
}
$('#tab-stats').addEventListener('click',()=>renderMonth().catch(error=>{$('#month-comparison').textContent=errorText(error);}));
window.addEventListener('potok-datachanged',()=>{setTimeout(()=>{renderMonth().catch(error=>{$('#month-comparison').textContent=errorText(error);});renderExtras();},0);});
function openRestore(welcome){backupCandidate=null;$('#restore-title').textContent=welcome?'Добро пожаловать в «Поток»':'Загрузить копию';$('#restore-summary').textContent=welcome?'Уже пользовался приложением? Загрузи сохранённый файл, и история с настройками вернётся. Можно начать без копии.':'Выбери сохранённый файл. Перед восстановлением покажем его содержимое.';$('#restore-status').textContent='';$('#restore-confirm').hidden=true;$('#welcome-load').hidden=false;$('#restore-cancel').textContent=welcome?'Начать без копии':'Отмена';$('#restore-dialog').showModal();}
$('#backup-load').addEventListener('click',()=>openRestore(false));
$('#welcome-load').addEventListener('click',()=>{$('#backup-file').value='';$('#backup-file').click();});
$('#restore-cancel').addEventListener('click',async()=>{try{if(extras && !extras.welcomed){const next=cloneExtras();next.welcomed=true;await persistExtras(next);}$('#restore-dialog').close();}catch(error){$('#restore-status').textContent=errorText(error);}});
$('#restore-dialog').addEventListener('cancel',event=>{event.preventDefault();$('#restore-cancel').click();});
$('#backup-save').addEventListener('click',async()=>{
 const button=$('#backup-save');button.disabled=true;
 try{const snapshot=await MoneyStore.backup();if(!MoneyExtras.validBackup(snapshot))throw new Error('В базе есть некорректные записи. Нельзя создать проверенную копию; данные не удалены.');const blob=new Blob([JSON.stringify(snapshot)],{type:'application/json'});if(blob.size>20*1024*1024)throw new Error('Копия превышает лимит 20 МБ. Данные не изменены.');const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='potok-'+today()+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#backup-status').textContent='Файл передан браузеру для сохранения. Проверь папку «Загрузки» или «Файлы».';}catch(error){$('#backup-status').textContent=errorText(error);}finally{button.disabled=false;}
});
$('#backup-file').addEventListener('change',async()=>{
 const file=$('#backup-file').files[0];if(!file)return;
 try{if(file.size>20*1024*1024)throw new Error('Файл слишком большой (максимум 20 МБ).');const value=JSON.parse(await file.text());if(!MoneyExtras.validBackup(value))throw new Error('Файл не является поддерживаемой копией «Потока».');backupCandidate=value;$('#restore-summary').textContent=`В файле: ${value.entries.length} записей, ${value.extras.goals.length} целей, ${value.config.debts.length} долгов. Восстановление заменит текущую историю и настройки целиком. Если они нужны, сначала сохрани их отдельной копией.`;$('#restore-confirm').hidden=false;$('#welcome-load').hidden=true;$('#restore-status').textContent='';}catch(error){backupCandidate=null;$('#restore-confirm').hidden=true;$('#restore-status').textContent=errorText(error);}
});
$('#restore-confirm').addEventListener('click',async()=>{
 if(!backupCandidate)return;const button=$('#restore-confirm');button.disabled=true;
 try{await MoneyStore.restore(backupCandidate);location.reload();}catch(error){$('#restore-status').textContent=errorText(error);button.disabled=false;}
});
window.addEventListener('potok-ready',async()=>{
 try{extras=await MoneyStore.getExtras();renderExtras();await renderMonth();if(!extras.welcomed){const snapshot=await MoneyStore.backup();if(!snapshot.entries.length && !extras.goals.length && !config.debts.length)openRestore(true);else{const next=cloneExtras();next.welcomed=true;await persistExtras(next);}}}catch(error){$('#extras-status').textContent=errorText(error);}
});
document.addEventListener('visibilitychange',async()=>{if(document.hidden || !ready)return;try{extras=await MoneyStore.getExtras();renderExtras();await renderMonth();}catch(error){$('#extras-status').textContent=errorText(error);}});
