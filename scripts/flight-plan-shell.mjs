import '../site/flight-plans.js';
export function renderFlightPlanPage(html,{page,rootPrefix='../'}={}) {
  const title=(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'Flight workshop').replace(/(?:\s*·\s*Factorio Command Center)+\s*$/i,'').trim();
  const content=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if(!content) throw new Error('Flight page must contain main');
  const originalStyles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('');
  const scripts=[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]).join('');
  const p=rootPrefix;
  const tiers=[['fully-integrated','1 · Integrated six-pack'],['hybrid','2 · Hybrid six-pack'],['compact','3 · Compact six-pack'],['supplies','Supply factories'],['compare','Compare tiers']];
  const contextual=page==='six-pack'||page==='six-pack-full'
    ? tiers.map(([id,label])=>`<a class="nav-link subtle" href="${page==='six-pack-full'?'../index.html':''}#${id}">${label}</a>`).join('')
    : [...new Map([...((html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/i)||[])[1]||'').matchAll(/<a\b[^>]*href="(#[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>[m[1],`<a class="nav-link subtle" href="${m[1]}">${m[2]}</a>`])).values()].join('');
  const sections=contextual?`<nav class="flight-context" aria-label="Workshop sections"><div class="sidebar-divider"></div><div class="sidebar-section-title">IN THIS WORKSHOP</div>${contextual}</nav>`:'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#171a1c"><title>${title} · Factorio Command Center</title>${originalStyles}<link rel="stylesheet" href="${p}styles.css"><link rel="stylesheet" href="${p}flight-plans.css"></head><body class="flight-workshop"><a class="skip-link" href="#main">Skip to content</a><aside class="sidebar" id="flight-sidebar" aria-label="Workshop navigation"><a class="flight-brand" href="${p}index.html"><img src="${p}assets/icons/assembling-machine-3.png" alt=""><span>FACTORIO<small>COMMAND CENTER</small></span></a><a class="nav-link" href="${p}index.html">← Command library</a><div class="sidebar-divider"></div>${globalThis.FlightPlans.links(p,page==='six-pack-full'?'six-pack':page)}${sections}<div class="sidebar-bottom"><div class="local-state"><span class="status-dot"></span> FLIGHT SAVE</div><p>Blueprints, evidence and build guides.</p></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" data-flight-menu aria-expanded="false" aria-controls="flight-sidebar" aria-label="Toggle navigation">☰</button><a href="${p}index.html">Command Center</a><span class="breadcrumb-slash">/</span><strong>${title}</strong></div></header><main id="main" tabindex="-1"><p class="flight-category-heading">${globalThis.FlightPlans.title}</p>${content}</main></div><script src="${p}flight-plans.js"></script>${scripts}</body></html>`;
}
