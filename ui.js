(function(root) {
  'use strict';
  const paths={wallet:'M4 5h14v3M4 5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16V8H4m16 4h-6v4h6',home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3m-4 9 3 3 5-6',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3',bag:'M5 7h14l2 14H3L5 7m3 0V5a4 4 0 0 1 8 0v2',heart:'M12 20S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12',plane:'m3 11 8 2 2 8 3-6 5-12-12 5-6 3',book:'M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1',sliders:'M4 7h16M4 17h16M8 4v6m8 4v6',close:'m6 6 12 12M6 18 18 6',arrow:'M5 12h14m-6-6 6 6-6 6',minus:'M5 12h14',chevron:'m6 9 6 6 6-6',check:'m5 12 4 4 10-10',moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',sun:'M12 3V1m0 22v-2M3 12H1m22 0h-2M5 5 3 3m18 18-2-2M5 19l-2 2M21 3l-2 2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'};
  function icon(name) {const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name] || paths.wallet);svg.append(path);return svg;}
  function el(tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function hydrate() {document.querySelectorAll('[data-icon]').forEach(node=>node.replaceChildren(icon(node.dataset.icon)));}
  const pickerDialog=document.querySelector('#picker-dialog');
  function picker(container,label,options,value,onChange) {
    const wrapper=el('div','custom-picker'),caption=el('span','picker-label',label),button=el('button','picker-button');
    button.type='button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',label);
    function update(next) {value=next;button.replaceChildren(el('span','',options.find(option=>option.value===value)?.label || 'Выбери'),icon('chevron'));}
    update(value);
    button.addEventListener('click',()=>{
      document.querySelector('#picker-title').textContent=label;
      const list=document.querySelector('#picker-options');list.replaceChildren();list.setAttribute('aria-label',label);
      options.forEach(option=>{const item=el('button','picker-option',option.label);item.type='button';item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===value));if(option.value===value)item.append(icon('check'));item.addEventListener('click',()=>{update(option.value);pickerDialog.close();onChange(option.value);});list.append(item);});
      button.setAttribute('aria-expanded','true');pickerDialog.showModal();
      pickerDialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');},{once:true});
      (list.querySelector('[aria-selected=true]') || list.firstElementChild)?.focus();
    });
    wrapper.append(caption,button);container.replaceChildren(wrapper);
    return {set:update,button};
  }
  pickerDialog.addEventListener('keydown',event=>{
    const items=[...pickerDialog.querySelectorAll('.picker-option')],index=items.indexOf(document.activeElement);
    if(!items.length || !['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='ArrowDown'?(index+1)%items.length:(index-1+items.length)%items.length;items[next].focus();
  });
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)dialog.close();}));
  root.MoneyUI={icon,el,picker,hydrate};hydrate();
})(globalThis);
