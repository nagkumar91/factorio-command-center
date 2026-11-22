/* Shared offline navigation for generated flight workshops and Command Center. */
(function () {
  const title = 'Long game flight plans and strategies';
  const plans = [
    {id:'today',href:'index.html?collection=today#blueprints',label:"Today's flight builds",detail:'All nine imports from the 16–17 November session, with the full library filters.',icon:'blueprint-book'},
    {id:'today-overview',href:'todays-flight-builds/index.html',label:'Today · import overview',detail:'Materials, outputs, footprints, guides and exact native evidence for nine imports.',icon:'blueprint'},
    {id:'essentials',href:'essentials/index.html',label:'Essentials · four builds',detail:'Green-circuit supplier, building-essentials mall, smaller robot workshop and six-pack science, with a pairing table and one book.',icon:'electronic-circuit'},
    {id:'space-launch',href:'space-launch/index.html',label:'Space launch · six builds',detail:'Concrete and rocket-fuel suppliers, the launch kit, rocket supplies, a white-science platform in Nauvis orbit and its landing-pad receiver, step by step with one book.',icon:'rocket-silo'},
    {id:'electric-smelter',href:'electric-smelter-pass-through/index.html',label:'Electric smelter · pass-through',detail:'24 electric furnaces, 900 iron or copper plates per minute out south; unused ore runs on east into the next copy, two copies per red belt.',icon:'electric-furnace'},
    {id:'advanced-circuits',href:'advanced-circuits/index.html',label:'Advanced circuits · supplier',detail:'187.5 advanced circuits per minute from copper plates, iron plates and plastic bars in 66 × 14 tiles, out east on one red belt.',icon:'advanced-circuit'},
    {id:'processing-units',href:'processing-units/index.html',label:'Processing units · supplier',detail:'27 processing units per minute from copper plates, iron plates, plastic bars and sulfuric acid in 31 × 28 tiles, out east on one red belt.',icon:'processing-unit'},
    {id:'plastic-bars',href:'plastic-bars/index.html',label:'Plastic bars · supplier, three sizes',detail:'Plastic bars from coal on a belt and petroleum gas in a pipe: 240, 600 or 1,200 per minute from 8 × 7 up to 17 × 12 tiles, out east on one red belt, with a table of which size each blueprint needs.',icon:'plastic-bar'},
    {id:'oil-products',href:'oil-products/index.html',label:'Oil products · supplier',detail:'Petroleum gas 7,140, sulfuric acid 500, lubricant 150 and sulfur 15 per minute from crude oil, water and iron plates in 43 × 15 tiles, with light oil on request out of the north edge.',icon:'oil-refinery'},
    {id:'production-science-small',href:'production-science-small/index.html',label:'Production science · small',detail:'12.9 production science packs per minute (two science machines) from steel plates, stone bricks, stone, iron plates and green and red circuits in 14 × 18 tiles, out east on one red belt.',icon:'production-science-pack'},
    {id:'robot-logistics-workshop',href:'robot-logistics-workshop/index.html',label:'Robot logistics workshop',detail:'Robots, roboports, passive providers and storage chests from plates and operating fluids.',icon:'construction-robot'},
    {id:'inserter-workshop',href:'inserter-workshop/index.html',label:'Inserter workshop · four arms',detail:'Normal, long-handed, fast and bulk inserters with internally manufactured circuits and gears.',icon:'bulk-inserter'},
    {id:'belt-workshop',href:'belt-workshop/index.html',label:'Belt workshop · six products',detail:'Red and yellow transport belts, undergrounds and splitters on demand from iron and copper plates in 22 × 16 tiles; six chests, each stopping at one stack.',icon:'fast-transport-belt'},
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
