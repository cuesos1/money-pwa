
'use strict';
const $ = selector=>document.querySelector(selector);
const {el,icon,picker} = MoneyUI;
const {parseAmount,allocate} = MoneyCalculator;
const {dateValue,parseDate,periodBounds,validEntry,normalize,summarizeCategories} = MoneyLedger;
const money=cents=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
let config=MoneyStore.defaultConfig(),ready=false,recording=false,savingExpense=false,draft=null,period='7',expenseCategory='',statsRevision=0;
const themeQuery=matchMedia('(prefers-color-scheme: dark)');
const today=()=>dateValue(new Date());
const copy=value=>JSON.parse(JSON.stringify(value));
const errorText=error=>error?.message || 'Не удалось сохранить данные. Попробуй ещё раз.';
function selectedTimestamp(value) {const date=parseDate(value);if(!date || value>today())return null;return value===today()?Date.now():new Date(date.getFullYear(),date.getMonth(),date.getDate(),12).getTime();}
function applyAppearance(settings) {
  const dark=settings.theme==='dark' || (settings.theme==='system' && themeQuery.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.accent=settings.accent;
  document.title=settings.name;$('#app-name').textContent=settings.name;
  document.querySelector('meta[name="theme-color"]').content=dark?'#0b1224':'#e8eef8';
  for(const [key,classname] of [['hints','no-hints'],['details','no-details'],['chart','no-chart'],['motion','no-motion']])document.body.classList.toggle(classname,!settings[key]);
}
themeQuery.addEventListener('change',()=>applyAppearance(draft || config));
function renderCalculator() {
  const cents=parseAmount($('#income').value),active=config.categories.filter(category=>category.enabled);
  $('#income-error').textContent=cents===null?'Сумма от 0 до 1 000 000 000 ₽, до двух цифр после запятой.':'';
  $('#income').setAttribute('aria-invalid',String(cents===null));
  const amounts=cents===null?null:allocate(cents,active.map(category=>category.percent));
  const results=$('#results');results.replaceChildren();
  active.forEach((category,i)=>{const card=el('article','glass card');card.dataset.tone=category.icon;const top=el('div','card-top'),symbol=el('span','symbol');symbol.append(icon(category.icon));top.append(symbol,el('span','percent',`${category.percent}%`));card.append(top,el('p','card-label',category.name),el('p','card-value',amounts?money(amounts[i]):'—'));results.append(card);});
  updateButtons();
}
function updateButtons() {const cents=parseAmount($('#income').value);$('#record-income').disabled=!ready || recording || cents===null || cents<=0;$('#record-expense').disabled=!ready || savingExpense;$('#settings-toggle').disabled=!ready;}
$('#income').addEventListener('input',renderCalculator);
for(const id of ['income-date','expense-date']) {$('#'+id).value=today();$('#'+id).max=today();$('#'+id).min='1900-01-01';}
$('#period-start').value=dateValue(new Date(new Date().getFullYear(),new Date().getMonth(),1));$('#period-end').value=today();
function showTab(stats) {$('#plan-panel').hidden=stats;$('#stats-panel').hidden=!stats;$('#tab-plan').setAttribute('aria-current',stats?'false':'page');$('#tab-stats').setAttribute('aria-current',stats?'page':'false');if(stats)refreshStats();}
$('#tab-plan').addEventListener('click',()=>showTab(false));$('#tab-stats').addEventListener('click',()=>showTab(true));
picker($('#period-picker'),'Период',[{value:'7',label:'За 7 дней'},{value:'month',label:'Этот месяц'},{value:'previous',label:'Прошлый месяц'},{value:'year',label:'Этот год'},{value:'all',label:'Всё время'},{value:'custom',label:'Свои даты'}],period,value=>{period=value;$('#custom-dates').hidden=value!=='custom';refreshStats();});
for(const id of ['period-start','period-end'])$('#'+id).addEventListener('change',refreshStats);
function refreshStats() {if(ready)renderStats().catch(error=>{$('#period-error').textContent=errorText(error);});}
async function renderStats() {
  const revision=++statsRevision,now=new Date(),bounds=periodBounds(period,now,$('#period-start').value,$('#period-end').value);
  if(!bounds) {$('#period-error').textContent='Выбери корректные даты: начало не позже конца.';for(const id of ['week-total','expense-total','net-total'])$('#'+id).textContent='—';for(const id of ['week-chart','week-breakdown','history'])$('#'+id).replaceChildren();$('#week-count').textContent='Выбери период.';$('#week-range').textContent='';return;}
  $('#period-error').textContent='';
  const raw=await MoneyStore.entries(bounds.start.getTime(),bounds.end.getTime());if(revision!==statsRevision)return;
  const entries=raw.filter(validEntry).map(normalize),totals=summarizeCategories(entries,config.categories);
  $('#week-total').textContent=money(totals.totalIncome);$('#expense-total').textContent=money(totals.totalExpenses);$('#net-total').textContent=money(totals.net);
  let start=bounds.start;
  if(period==='all'){const first=entries.reduce((first,entry)=>Math.min(first,entry.createdAt),now.getTime()),date=new Date(first);start=new Date(date.getFullYear(),date.getMonth(),date.getDate());}
  const end=bounds.end,last=new Date(end.getFullYear(),end.getMonth(),end.getDate()-1),formatDate=date=>date.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
  $('#week-range').textContent=`${period==='all'?'Всё время · ':''}${formatDate(start)} — ${formatDate(last)}`;
  const span=Math.round((Date.UTC(last.getFullYear(),last.getMonth(),last.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000)+1,bucketSize=Math.max(1,Math.ceil(span/12)),buckets=[];
  for(let offset=0;offset<span;offset+=bucketSize)buckets.push({begin:new Date(start.getFullYear(),start.getMonth(),start.getDate()+offset),finish:new Date(start.getFullYear(),start.getMonth(),start.getDate()+Math.min(offset+bucketSize,span)),cents:0});
  for(const entry of entries)if(entry.type==='income'){const bucket=buckets.find(bucket=>entry.createdAt>=bucket.begin.getTime() && entry.createdAt<bucket.finish.getTime());if(bucket)bucket.cents+=entry.cents;}
  const chart=$('#week-chart');chart.replaceChildren();chart.setAttribute('aria-label',buckets.map(bucket=>`${formatDate(bucket.begin)} — ${formatDate(new Date(bucket.finish.getFullYear(),bucket.finish.getMonth(),bucket.finish.getDate()-1))}: ${money(bucket.cents)}`).join('; '));
  const max=Math.max(...buckets.map(bucket=>bucket.cents),1);
  for(const bucket of buckets){const column=el('div','day-column'),track=el('div','bar-track'),bar=el('div','day-bar'+(bucket.cents?'':' empty'));bar.style.setProperty('--height',`${bucket.cents/max*100}%`);track.append(bar);column.title=`${formatDate(bucket.begin)}: ${money(bucket.cents)}`;column.append(track,el('div','day-label',bucket.begin.toLocaleDateString('ru-RU',period==='7'?{weekday:'short'}:{day:'numeric',month:'numeric'})));chart.append(column);}
  const breakdown=$('#week-breakdown');breakdown.replaceChildren();
  totals.categories.filter(category=>category.income || category.expenses || config.categories.some(current=>current.id===category.id && current.enabled)).forEach(category=>{const card=el('div','breakdown');card.append(el('p','breakdown-label',category.name),el('p','breakdown-value',money(category.income-category.expenses)),el('p','breakdown-detail',`Выделено ${money(category.income)} · потрачено ${money(category.expenses)}`));breakdown.append(card);});
  $('#week-count').textContent=entries.length?`Записей: ${entries.length}. Остатки за выбранный период.`:'За этот период записей нет.';
  const history=$('#history');history.replaceChildren();
  entries.sort((a,b)=>b.createdAt-a.createdAt || b.id-a.id).forEach(entry=>{
    const expense=entry.type==='expense',li=el('li'),head=el('div','entry-head'),description=el('div');description.append(el('strong','history-amount',`${expense?'−':'+'}${money(entry.cents)}`),el('span','history-date',formatDate(new Date(entry.createdAt))),el('span','history-note',expense?`${entry.categoryName}${entry.note?' · '+entry.note:''}`:'Доход'));
    head.append(description);const actions=el('div','entry-actions'),edit=el('button','', 'Изменить дату'),remove=el('button','delete-entry','Удалить');edit.type=remove.type='button';edit.setAttribute('aria-label',`Изменить дату ${expense?'расхода':'дохода'} ${money(entry.cents)}`);remove.setAttribute('aria-label',`Удалить ${expense?'расход':'доход'} ${money(entry.cents)}`);edit.addEventListener('click',()=>entryAction(entry,'date'));remove.addEventListener('click',()=>entryAction(entry,'delete'));actions.append(edit,remove);li.append(head,actions);history.append(li);
  });
  if(raw.length!==entries.length)$('#period-error').textContent='Некоторые записи повреждены и не включены в итоги. Исходные данные не удалены.';
}
let currentAction=null;
function entryAction(entry,mode) {currentAction={entry,mode};$('#action-title').textContent=mode==='date'?'Дата записи':'Удалить запись?';$('#action-description').textContent=`${entry.type==='expense'?'Расход':'Доход'} · ${money(entry.cents)}`;$('#edit-date-row').hidden=mode!=='date';$('#edit-date').value=dateValue(new Date(entry.createdAt));$('#edit-date').max=today();$('#edit-date').min='1900-01-01';$('#action-error').textContent='';$('#action-confirm').disabled=false;$('#action-confirm').textContent=mode==='date'?'Сохранить дату':'Удалить';$('#action-dialog').showModal();}
$('#action-confirm').addEventListener('click',async()=>{
  if(!currentAction)return;const {entry,mode}=currentAction,button=$('#action-confirm');button.disabled=true;
  try {if(mode==='delete')await MoneyStore.remove(entry.id);else{const timestamp=selectedTimestamp($('#edit-date').value);if(timestamp===null)throw new Error('Выбери дату не позже сегодня.');await MoneyStore.editDate(entry.id,timestamp);}$('#action-dialog').close();refreshStats();}
  catch(error){$('#action-error').textContent=errorText(error);}finally{button.disabled=false;}
});
$('#record-income').addEventListener('click',async()=>{
  const cents=parseAmount($('#income').value),createdAt=selectedTimestamp($('#income-date').value);
  if(!ready || recording || cents===null || cents<=0)return;
  if(createdAt===null){$('#record-status').textContent='Выбери дату дохода не позже сегодня.';return;}
  recording=true;updateButtons();
  try{await MoneyStore.addIncome(cents,createdAt,config.revision);$('#income').value='';$('#income-date').value=today();$('#record-status').textContent=`${money(cents)} записано. Дата: ${new Date(createdAt).toLocaleDateString('ru-RU')}.`;renderCalculator();refreshStats();}
  catch(error){$('#record-status').textContent=errorText(error);}finally{recording=false;updateButtons();}
});
$('#expense-open').addEventListener('click',()=>{
  const categories=config.categories.filter(category=>category.enabled);if(!categories.some(category=>category.id===expenseCategory))expenseCategory=categories.find(category=>category.id==='life')?.id || categories[0].id;
  picker($('#expense-category-picker'),'Категория',categories.map(category=>({value:category.id,label:category.name})),expenseCategory,value=>{expenseCategory=value;});$('#expense-date').max=today();$('#expense-status').textContent='';$('#expense-dialog').showModal();
});
$('#expense-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!ready || savingExpense)return;
  const cents=parseAmount($('#expense-amount').value),createdAt=selectedTimestamp($('#expense-date').value),note=$('#expense-note').value.trim();
  if(cents===null || cents<=0 || createdAt===null || note.length>120){$('#expense-status').textContent='Проверь положительную сумму и дату не позже сегодня.';return;}
  savingExpense=true;updateButtons();
  try{await MoneyStore.addExpense(cents,createdAt,expenseCategory,note,config.revision);$('#expense-amount').value='';$('#expense-note').value='';$('#expense-date').value=today();$('#expense-dialog').close();$('#record-status').textContent=`Расход ${money(cents)} записан.`;refreshStats();}
  catch(error){$('#expense-status').textContent=errorText(error);}finally{savingExpense=false;updateButtons();}
});
// Settings use a draft; closing without Save restores the saved appearance.
const iconNames={wallet:'Кошелёк',home:'Дом',shield:'Щит',spark:'Искра',bag:'Покупки',heart:'Сердце',plane:'Путешествия',book:'Учёба'};
function settingsSection(name){document.querySelectorAll('[data-settings-section]').forEach(section=>{section.hidden=section.dataset.settingsSection!==name;});document.querySelectorAll('#settings-tabs button').forEach(button=>button.setAttribute('aria-current',button.dataset.section===name?'page':'false'));}
$('#settings-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-section]');if(button)settingsSection(button.dataset.section);});
$('#settings-toggle').addEventListener('click',async()=>{
  try{config=await MoneyStore.getConfig();renderCalculator();refreshStats();draft=copy(config);renderSettings();settingsSection('appearance');$('#settings-status').textContent='';$('#settings').showModal();}
  catch(error){$('#record-status').textContent=errorText(error);}
});
$('#settings').addEventListener('close',()=>{draft=null;applyAppearance(config);});
function draftChanged(){if(!draft)return;$('#apply-debt-share').hidden=true;$('#debt-result').replaceChildren();$('#settings-status').textContent='Изменения ещё не сохранены.';}
function renderSettings(){
  $('#setting-name').value=draft.name;
  picker($('#theme-picker'),'Тема',[{value:'system',label:'Как на устройстве'},{value:'light',label:'Светлая'},{value:'dark',label:'Тёмная'}],draft.theme,value=>{draft.theme=value;applyAppearance(draft);draftChanged();});
  const colors=$('#accent-options');colors.replaceChildren();
  for(const [value,label,color] of [['jade','Шалфей','#40cbaa'],['blue','Туман','#5e9ef5'],['sand','Песок','#e7ae54'],['plum','Слива','#af85ea']]){const button=el('button','color-option');button.type='button';button.style.setProperty('--color',color);button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(draft.accent===value));button.addEventListener('click',()=>{draft.accent=value;applyAppearance(draft);colors.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));draftChanged();});colors.append(button);}
  const toggles=$('#view-toggles');toggles.replaceChildren();
  for(const [key,label] of [['details','Подробные суммы по категориям'],['hints','Подсказки и пояснения'],['chart','График доходов'],['motion','Плавные анимации']]){const row=el('label','switch-row'),input=el('input');input.type='checkbox';input.checked=draft[key];input.setAttribute('role','switch');input.addEventListener('change',()=>{draft[key]=input.checked;applyAppearance(draft);draftChanged();});row.append(el('span','',label),input);toggles.append(row);}
  renderCategoryEditors();renderDebtSettings();
}
$('#setting-name').addEventListener('input',()=>{if(draft){draft.name=$('#setting-name').value;applyAppearance(draft);draftChanged();}});
function categoryTotal(){const total=draft.categories.filter(category=>category.enabled).reduce((sum,category)=>sum+category.percent,0);$('#category-total').textContent=Number.isFinite(total)?`${total}% из 100%`:'Введи целые проценты.';$('#category-total').classList.toggle('error',total!==100);}
function renderCategoryEditors(){
  const container=$('#percentage-fields');container.replaceChildren();
  draft.categories.forEach(category=>{
    const card=el('div','category-editor'),top=el('div','editor-top'),nameLabel=el('label','','Название'),name=el('input'),percentLabel=el('label','','Доля, %'),percent=el('input');name.value=category.name;name.maxLength=30;percent.type='number';percent.min='0';percent.max='100';percent.step='1';percent.value=category.percent;percent.disabled=!category.enabled;nameLabel.append(name);percentLabel.append(percent);top.append(nameLabel,percentLabel);
    name.addEventListener('input',()=>{category.name=name.value;draftChanged();});percent.addEventListener('input',()=>{category.percent=percent.value.trim()===''?NaN:Number(percent.value);categoryTotal();draftChanged();});
    const iconContainer=el('div');picker(iconContainer,'Значок',MoneyStore.icons.map(value=>({value,label:iconNames[value]})),category.icon,value=>{category.icon=value;draftChanged();});
    const row=el('label','switch-row'),enabled=el('input');enabled.type='checkbox';enabled.checked=category.enabled;enabled.setAttribute('role','switch');row.append(el('span','','Использовать'),enabled);enabled.addEventListener('change',()=>{category.enabled=enabled.checked;if(!enabled.checked)category.percent=0;renderCategoryEditors();draftChanged();});card.append(top,iconContainer,row);container.append(card);
  });categoryTotal();$('#add-category').disabled=draft.categories.length>=12;
}
$('#add-category').addEventListener('click',()=>{if(draft.categories.length>=12)return;draft.categories.push({id:crypto.randomUUID(),name:'Новая категория',icon:'bag',enabled:true,percent:0});renderCategoryEditors();draftChanged();});
$('#reset').addEventListener('click',()=>{const defaults=MoneyStore.defaultCategories();draft.categories=draft.categories.map(category=>{const original=defaults.find(item=>item.id===category.id);return original?{...category,enabled:true,percent:original.percent}:{...category,enabled:false,percent:0};});for(const original of defaults)if(!draft.categories.some(category=>category.id===original.id))draft.categories.push(original);renderCategoryEditors();draftChanged();});
const debtTypes=[{value:'card',label:'Кредитка'},{value:'loan',label:'Кредит'},{value:'mortgage',label:'Ипотека'},{value:'personal',label:'Долг без процентов'}];
function debtVisibility(){const enabled=$('#debt-enabled').checked;draft.debtEnabled=enabled;$('#debt-content').hidden=!enabled;$('#no-debt-content').hidden=enabled;}
function renderDebtSettings(){
  $('#debt-enabled').checked=draft.debtEnabled;debtVisibility();$('#monthly-income').value=draft.monthlyIncome?String(draft.monthlyIncome/100):'';
  renderDebtCategoryPicker();renderDebts();$('#debt-result').replaceChildren();$('#apply-debt-share').hidden=true;
}
function renderDebtCategoryPicker(){picker($('#debt-category-picker'),'Категория для платежей',draft.categories.map(category=>({value:category.id,label:category.name})),draft.debtCategory,value=>{draft.debtCategory=value;draftChanged();});}
$('#debt-enabled').addEventListener('change',()=>{debtVisibility();draftChanged();});
$('#monthly-income').addEventListener('input',()=>{draft.monthlyIncome=parseAmount($('#monthly-income').value);draftChanged();});
function renderDebts(){
  const list=$('#debt-list');list.replaceChildren();
  draft.debts.forEach(debt=>{
    const card=el('div','debt-editor'),nameLabel=el('label','','Название'),name=el('input');name.value=debt.name;name.maxLength=40;nameLabel.append(name);name.addEventListener('input',()=>{debt.name=name.value;draftChanged();});card.append(nameLabel);
    const typeContainer=el('div');picker(typeContainer,'Тип',debtTypes,debt.type,value=>{debt.type=value;if(value==='personal')debt.apr=0;renderDebts();draftChanged();});card.append(typeContainer);
    for(const [key,label] of [['balance','Остаток долга, ₽'],['apr','Годовая ставка, %'],['minimum','Минимальный платёж в месяц, ₽'],['payment','Плановый платёж в месяц, ₽']]){
      const row=el('label','',label),input=el('input');input.inputMode='decimal';input.value=Number.isFinite(debt[key])?String(key==='apr'?debt[key]:debt[key]/100):'';input.disabled=key==='apr' && debt.type==='personal';row.append(input);input.addEventListener('input',()=>{const value=key==='apr'?(input.value.trim()===''?NaN:Number(input.value.replace(',','.'))):parseAmount(input.value);debt[key]=value;draftChanged();});card.append(row);
    }
    const remove=el('button','text-button remove-debt','Убрать из плана');remove.type='button';remove.addEventListener('click',()=>{draft.debts=draft.debts.filter(item=>item.id!==debt.id);renderDebts();draftChanged();});card.append(remove);list.append(card);
  });$('#add-debt').disabled=draft.debts.length>=12;
}
$('#add-debt').addEventListener('click',()=>{if(draft.debts.length>=12)return;draft.debts.push({id:crypto.randomUUID(),name:'Новый долг',type:'loan',balance:0,apr:0,minimum:0,payment:0});renderDebts();draftChanged();});
let proposedShare=null;
$('#calculate-debts').addEventListener('click',()=>{
  const result=$('#debt-result');result.replaceChildren();$('#apply-debt-share').hidden=true;proposedShare=null;
  try{
    if(!draft.debts.length)throw new Error('Добавь долг или выбери сценарий без задолженностей.');
    if(!draft.debts.every(MoneyFinance.validDebt))throw new Error('Проверь суммы и ставку. Плановый платёж должен быть не меньше минимального.');
    if(!MoneyFinance.centsValid(draft.monthlyIncome) || draft.monthlyIncome<=0)throw new Error('Укажи ожидаемый месячный доход.');
    const plan=MoneyFinance.debtPlan(draft.debts,draft.monthlyIncome);
    result.append(el('strong','',`Платежи: ${money(plan.payment)} в месяц · ${plan.percent}% дохода`),el('p','',`Минимумы: ${money(plan.minimum)} · ${plan.minimumPercent}% дохода.`));
    plan.estimates.forEach((estimate,i)=>{const block=el('div','debt-estimate');block.append(el('strong','',draft.debts[i].name));if(estimate.months===null)block.append(el('p','',estimate.reason==='insufficient'?'Долг не погашается: платёж не покрывает проценты или равен нулю.':'Срок больше 100 лет. Увеличь платёж.'));else{const now=new Date(),finish=new Date(now.getFullYear(),now.getMonth()+estimate.months,1);block.append(el('p','',estimate.months===0?'Погашен.':`Около ${estimate.months} мес. · ${finish.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}`),el('p','',`Проценты: ${money(estimate.interest)} · всего: ${money(estimate.total)}`));}result.append(block);});
    if(plan.percent>100)result.append(el('p','error','Платежи превышают ожидаемый доход. Применить такую долю нельзя.'));
    else if(plan.estimates.some(estimate=>estimate.months===null))result.append(el('p','error','Перед применением увеличь платежи, которые не погашают долг.'));
    else{proposedShare=plan.percent;$('#apply-debt-share').hidden=false;}
  }catch(error){result.append(el('p','error',errorText(error)));}
});
$('#apply-debt-share').addEventListener('click',()=>{
  try{if(proposedShare===null)return;draft.categories=MoneyFinance.distributeShare(draft.categories,draft.debtCategory,proposedShare);renderCategoryEditors();$('#settings-status').textContent=`На долги ${proposedShare}%. Остальные доли пересчитаны пропорционально. Нажми «Сохранить настройки».`;$('#apply-debt-share').hidden=true;}
  catch(error){$('#settings-status').textContent=errorText(error);}
});
$('#no-debt-preset').addEventListener('click',()=>{try{draft.categories=MoneyFinance.distributeShare(draft.categories,draft.debtCategory,0);renderCategoryEditors();$('#settings-status').textContent='Категория долгов отключена, её доля распределена. Нажми «Сохранить настройки».';}catch(error){$('#settings-status').textContent=errorText(error);}});
$('#settings-tabs').addEventListener('click',event=>{if(event.target.closest('[data-section="debts"]') && draft)renderDebtCategoryPicker();});
$('#settings-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!draft)return;
  const button=$('#settings-form button[type="submit"]');button.disabled=true;
  try{if(!MoneyStore.validConfig(draft))throw new Error('Проверь названия, целые проценты (в сумме 100%) и параметры долгов.');config=await MoneyStore.saveConfig(draft,config.revision);draft=null;$('#settings').close();applyAppearance(config);renderCalculator();refreshStats();$('#record-status').textContent='Настройки сохранены на устройстве.';}
  catch(error){$('#settings-status').textContent=errorText(error);}finally{button.disabled=false;}
});
window.addEventListener('storageclosed',()=>{ready=false;updateButtons();$('#record-status').textContent='Хранилище обновляется. Закрой приложение и открой снова.';});
document.addEventListener('visibilitychange',async()=>{if(document.hidden || !ready || draft)return;try{config=await MoneyStore.getConfig();applyAppearance(config);renderCalculator();refreshStats();$('#income-date').max=$('#expense-date').max=today();}catch(error){$('#record-status').textContent=errorText(error);}});
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install').hidden=false;});
$('#install').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});
window.addEventListener('appinstalled',()=>{$('#install').hidden=true;$('#install-help').hidden=true;});
if(matchMedia('(display-mode: standalone)').matches || navigator.standalone)$('#install-help').hidden=true;
applyAppearance(config);renderCalculator();
function finishSplash(){$('#splash').classList.add('done');setTimeout(()=>{$('#splash').hidden=true;},350);}
setTimeout(finishSplash,2500);
(async()=>{try{await MoneyStore.open();config=await MoneyStore.getConfig();ready=true;applyAppearance(config);renderCalculator();await renderStats();}catch(error){$('#record-status').textContent=errorText(error);updateButtons();}finally{finishSplash();}})();
if('serviceWorker' in navigator && isSecureContext){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('#offline-status').textContent='Готово офлайн · всё хранится на устройстве';}).catch(()=>{$('#offline-status').textContent='Офлайн-кеш недоступен. Проверь HTTPS или localhost.';});}else $('#offline-status').textContent='Для установки и офлайн-режима нужен HTTPS или localhost.';
