/* Shared offline navigation for generated flight workshops and Command Center. */
(function () {
  const title = 'Long game flight plans and strategies';
  const plans = [
    {id:'six-pack',href:'flight-science-sided/index.html#compact',label:'Six-pack science',detail:'Three input tiers: compact, hybrid and fully integrated.',icon:'production-science-pack'},
    {id:'starter-science',href:'flight-science/index.html',label:'Starter science · compact',detail:'Red, green and blue, with an optional military science variant.',icon:'chemical-science-pack'},
    {id:'forest',href:'flight-forest/index.html',label:'Forest management',detail:'Autonomous replanting, renewable seeds and pollution sizing.',icon:'agricultural-tower'},
    {id:'robots',href:'flight-robots/index.html',label:'Robot workshop',detail:'Construction robots, logistic robots and roboports.',icon:'construction-robot'}
  ];
  const links = (prefix='',page='') => `<div class="sidebar-section-title flight-category">${title}</div>${plans.map(p=>`<a class="nav-link subtle ${page===p.id?'active':''}" ${page===p.id?'aria-current="page"':''} href="${prefix+p.href}"><img class="flight-nav-icon" src="${prefix}assets/icons/${p.icon}.png" alt=""><span>${p.label}</span></a>`).join('')}`;
  const cards = (prefix='') => `<section class="flight-plan-section" aria-labelledby="flight-plan-heading"><div class="eyebrow">YOUR FLIGHT SAVE</div><h2 id="flight-plan-heading">${title}</h2><p class="flight-muted">Modded flight-save workshops. Choose your production stage or plan your forest.</p><div class="flight-plan-grid">${plans.map(p=>`<a class="flight-plan-card" href="${prefix+p.href}"><img src="${prefix}assets/icons/${p.icon}.png" alt=""><div><h3>${p.label}</h3><p>${p.detail}</p><span>Open workshop →</span></div></a>`).join('')}</div></section>`;
  globalThis.FlightPlans = {title,plans,links,cards};
  if (typeof document==='undefined') return;
  document.addEventListener('click', e=>{
    const anchor=e.target.closest('.flight-context a');
    if(anchor){const b=document.querySelector('[data-flight-menu]');if(b?.getAttribute('aria-expanded')==='true'){b.setAttribute('aria-expanded','false');document.querySelector('#flight-sidebar').classList.remove('open');}}
    const toggle=e.target.closest('[data-flight-menu]');
    if(toggle){const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));document.querySelector('#flight-sidebar').classList.toggle('open',open);}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const b=document.querySelector('[data-flight-menu]');if(b?.getAttribute('aria-expanded')==='true'){b.click();b.focus({preventScroll:true});}}});
})();
