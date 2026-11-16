/* Shared offline navigation for generated flight workshops and Command Center. */
(function () {
  const title = 'Long game flight plans and strategies';
  const plans = [
    {id:'five-science',href:'five-science/index.html',label:'Five-pack science + labs',detail:'Adds purple production science, internal rail production and substations.',icon:'production-science-pack'},
    {id:'rgby-science',href:'rgby-science/index.html',label:'Four-pack science + labs',detail:'Red, green, blue and yellow from plates, with connected research labs.',icon:'utility-science-pack'},
    {id:'expansion',href:'compact-expansion-workshop/index.html',label:'Compact expansion workshop',detail:'Blue inserters, red transport and electric furnaces from plates, bricks and plastic.',icon:'electric-furnace'},
    {id:'catalogue',href:'index.html?collection=flight-plans#blueprints',label:'All flight blueprints',detail:'Search workshops by operating inputs, finished outputs and purpose.',icon:'blueprint-book'},
    {id:'early-loops',href:'early-controlled-loops/index.html',label:'Early controlled loops',detail:'Compact solid-fuel feeder, red/green science, belts, machines and poles.',icon:'logistic-science-pack'},
    {id:'optimized',href:'index.html?collection=optimized#blueprints',label:'Autosaved · optimized v2',detail:'Module-free revisions with exact native evidence and passive-provider outputs.',icon:'assembling-machine-2'},
    {id:'six-pack',href:'flight-science-sided/index.html#compact',label:'Six-pack science',detail:'Three input tiers: compact, hybrid and fully integrated.',icon:'production-science-pack'},
    {id:'starter-science',href:'flight-science/index.html',label:'Starter science · compact',detail:'Red, green and blue, with an optional military science variant.',icon:'chemical-science-pack'},
    {id:'forest',href:'flight-forest/index.html',label:'Forest management',detail:'Autonomous replanting, renewable seeds and pollution sizing.',icon:'agricultural-tower'},
    {id:'robots',href:'flight-robots/index.html',label:'Robot workshop',detail:'Construction robots, logistic robots and roboports.',icon:'construction-robot'},
    {id:'space-science',href:'flight-space-science/index.html',label:'Space science from orbit',detail:'Launch a platform, make white science, and request it on Nauvis.',icon:'space-science-pack'}
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
