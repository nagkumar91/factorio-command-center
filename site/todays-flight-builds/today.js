/* Inline import strings keep copying available without network requests. */
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-copy]');if(!button)return;
 const text=button.closest('[data-build-id]').querySelector('textarea').value;
 const status=document.querySelector('#copy-status');
 try{await navigator.clipboard.writeText(text);status.textContent='Import copied.';}
 catch{const area=button.closest('[data-build-id]').querySelector('textarea');area.closest('details').open=true;area.focus();area.select();status.textContent='Select and copy the import string below.';}
});
