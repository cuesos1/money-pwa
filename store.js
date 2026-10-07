(function(root) {
  'use strict';
  const legacyIds = ['debt','life','reserve','free'];
  const icons = ['wallet','home','shield','spark','bag','heart','plane','book'];
  const defaultCategories = () => ['Долги','Жизнь','Резерв','Свободные'].map((name,i)=>({id:legacyIds[i],name,icon:icons[i],percent:MoneyCalculator.defaults[i],enabled:true}));
  function defaultConfig() {
    let percentages = MoneyCalculator.defaults, theme = 'system';
    try {
      const saved = JSON.parse(localStorage.getItem('money-pwa.percentages.v1'));
      if (MoneyCalculator.validPercentages(saved) && saved.length === 4) percentages = saved;
      const savedTheme = localStorage.getItem('money-pwa.theme.v1');
      if (['light','dark'].includes(savedTheme)) theme = savedTheme;
    } catch (_) {}
    return {key:'config',revision:0,name:'Поток',theme,accent:'jade',details:true,hints:true,chart:true,motion:true,categories:defaultCategories().map((category,i)=>({...category,percent:percentages[i]})),debtEnabled:true,debtCategory:'debt',monthlyIncome:0,debts:[]};
  }
  function validConfig(config) {
    if (!config || config.key !== 'config' || !Number.isInteger(config.revision) || config.revision < 0 || typeof config.name !== 'string' || !config.name.trim() || config.name.length > 24 || !['system','light','dark'].includes(config.theme) || !['jade','blue','sand','plum'].includes(config.accent) || !['details','hints','chart','motion','debtEnabled'].every(key=>typeof config[key]==='boolean') || !MoneyFinance.centsValid(config.monthlyIncome)) return false;
    const categories = config.categories;
    if (!Array.isArray(categories) || categories.length < 1 || categories.length > 12 || !categories.every(category=>category && typeof category.id === 'string' && /^[a-zA-Z0-9-]{1,60}$/.test(category.id) && typeof category.name === 'string' && category.name.trim().length > 0 && category.name.length <= 30 && icons.includes(category.icon) && typeof category.enabled === 'boolean' && Number.isInteger(category.percent) && category.percent >= 0 && category.percent <= 100 && (category.enabled || category.percent===0)) || new Set(categories.map(category=>category.id)).size !== categories.length) return false;
    if (!MoneyCalculator.validPercentages(categories.filter(category=>category.enabled).map(category=>category.percent))) return false;
    return categories.some(category=>category.id === config.debtCategory) && Array.isArray(config.debts) && config.debts.length <= 12 && config.debts.every(MoneyFinance.validDebt) && new Set(config.debts.map(debt=>debt.id)).size === config.debts.length;
  }
  let db;
  function open() {
    return new Promise((resolve,reject)=>{
      let rejected = false;
      const request = indexedDB.open('money-pwa.history',2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('entries')) {
          const store = database.createObjectStore('entries',{keyPath:'id',autoIncrement:true});store.createIndex('createdAt','createdAt');
        }
        if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings',{keyPath:'key'}).add(defaultConfig());
      };
      request.onsuccess = () => { if (rejected) {request.result.close();return;} db=request.result;db.onversionchange=()=>{db.close();db=null;root.dispatchEvent(new Event('storageclosed'));};resolve(); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { rejected=true;reject(new Error('Закрой другие вкладки приложения и открой снова.')); };
    });
  }
  function transact(stores,mode,action) {
    if (!db) return Promise.reject(new Error('Локальное хранилище недоступно.'));
    return new Promise((resolve,reject)=>{
      const transaction = db.transaction(stores,mode);let result, failure;
      const abort = error=>{failure=error;transaction.abort();};
      try { action(transaction,value=>{result=value;},abort); } catch(error) {abort(error);}
      transaction.oncomplete=()=>resolve(result);
      transaction.onabort=()=>reject(failure || transaction.error || new Error('Не удалось сохранить данные.'));
      transaction.onerror=()=>{};
    });
  }
  const getConfig = () => transact(['settings'],'readonly',(tx,done,abort)=>{const request=tx.objectStore('settings').get('config');request.onsuccess=()=>{if (!validConfig(request.result)) {abort(new Error('Настройки повреждены. История сохранена; не очищай данные сайта.'));return;}done(request.result);};});
  const saveConfig = (config,revision) => transact(['settings'],'readwrite',(tx,done,abort)=>{
    if (!validConfig(config)) {abort(new Error('Проверь настройки и сумму процентов.'));return;}
    const store=tx.objectStore('settings'),request=store.get('config');
    request.onsuccess=()=>{
      if (request.result.revision!==revision) {abort(new Error('Настройки изменены в другой вкладке. Закрой меню и открой снова.'));return;}
      const next={...config,revision:revision+1};store.put(next);done(next);
    };
  });
  function addIncome(cents,createdAt,expectedRevision) {
    return transact(['entries','settings'],'readwrite',(tx,done,abort)=>{
      const request=tx.objectStore('settings').get('config');
      request.onsuccess=()=>{
        const config=request.result;
        if (!validConfig(config) || config.revision!==expectedRevision) {abort(new Error('Настройки изменились. Обнови приложение перед записью.'));return;}
        const categories=config.categories.filter(category=>category.enabled);
        const amounts=MoneyCalculator.allocate(cents,categories.map(category=>category.percent));
        const entry={type:'income',schema:2,cents,createdAt,allocations:categories.map((category,i)=>({categoryId:category.id,name:category.name,icon:category.icon,percent:category.percent,cents:amounts[i]}))};
        if (!MoneyLedger.validEntry(entry)) {abort(new Error('Некорректный доход.'));return;}
        const write=tx.objectStore('entries').add(entry);write.onsuccess=()=>done(write.result);
      };
    });
  }
  function addExpense(cents,createdAt,categoryId,note,expectedRevision) {
    return transact(['entries','settings'],'readwrite',(tx,done,abort)=>{
      const request=tx.objectStore('settings').get('config');request.onsuccess=()=>{
        const config=request.result;if (!validConfig(config)) {abort(new Error('Настройки повреждены.'));return;}
        const category=config.categories.find(category=>category.id===categoryId && category.enabled);
        if (!category || config.revision!==expectedRevision) {abort(new Error('Категории изменились. Обнови приложение.'));return;}
        const entry={schema:2,type:'expense',cents,createdAt,categoryId,categoryName:category.name,icon:category.icon,note};
        if (!MoneyLedger.validEntry(entry)) {abort(new Error('Некорректный расход.'));return;}
        const write=tx.objectStore('entries').add(entry);write.onsuccess=()=>done(write.result);
      };
    });
  }
  const entries = (start,end) => transact(['entries'],'readonly',(tx,done)=>{const request=tx.objectStore('entries').index('createdAt').getAll(IDBKeyRange.bound(start,end,false,true));request.onsuccess=()=>done(request.result);});
  const remove = id => transact(['entries'],'readwrite',tx=>tx.objectStore('entries').delete(id));
  const editDate = (id,createdAt) => transact(['entries'],'readwrite',(tx,done,abort)=>{
    const store=tx.objectStore('entries'),request=store.get(id);request.onsuccess=()=>{
      if (!request.result) {abort(new Error('Запись уже удалена.'));return;}
      const entry={...request.result,createdAt};if (!MoneyLedger.validEntry(entry)) {abort(new Error('Некорректная дата.'));return;}store.put(entry);
    };
  });
  root.MoneyStore={defaultCategories,defaultConfig,validConfig,icons,legacyIds,open,getConfig,saveConfig,addIncome,addExpense,entries,remove,editDate};
})(globalThis);
