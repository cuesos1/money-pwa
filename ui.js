(function(root) {
  'use strict';
  function icon(name) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    const nodes=PotokIcons[name] || PotokIcons.wallet;
    for(const [tag,attributes] of nodes){const shape=document.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))shape.setAttribute(key,value);svg.append(shape);}
    return svg;
  }
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
