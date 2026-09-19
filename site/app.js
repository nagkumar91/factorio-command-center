(() => {
'use strict';
const { PRESETS, MAX_CHESTS, CHEST_HELP, normalizeEntries, planCrates, crateSlots, generateCrateCommand, generateGiveCommand } = globalThis.FactorioPacker;

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const track = (event, target) => globalThis.FactorioAnalytics?.track(event, target);
const number = value => Number(value).toLocaleString('en-US');
const symbols = {
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  box: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 5.8l9 5"/>',
  blueprint: '<path d="M6 3h13v18H6a3 3 0 0 1 0-6h13M6 3a3 3 0 0 0-3 3v12M9 7h6M9 11h3"/>',
  file: '<path d="M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9L12 3Z"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'
};
const svg = (name, cls = '') => `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.grid}</svg>`;
let catalog, library, itemMap, explorer;
let openBlueprint;
let toastTimer;
const state = { page: 'commands', query: '', category: 'All', history: false, favoritesOnly: false, itemQuery: '', itemGroup: 'All', chest: 'passive-provider-chest', quality: 'normal', rows: [], cratePage: 0, blueprintQuery: '', fileQuery: '', fileType: 'All', favorites: [], saved: [], menu: false };
const routes = ['commands', 'crates', 'blueprints', 'coverage', 'production', 'files', 'setup'];
const nav = [['commands', 'grid', 'Command library'], ['crates', 'box', 'Crate builder'], ['blueprints', 'blueprint', 'Blueprint library'], ['coverage', 'check', 'Every craftable item'], ['production', 'arrow', 'Production planner'], ['files', 'file', 'Source files'], ['setup', 'settings', 'Game setup']];
const image = (id, cls = '', alt = '') => { const item = itemMap.get(id); return `<img class="game-icon ${cls}" src="${esc(item?.icon || 'assets/icons/constant-combinator.png')}" alt="${esc(alt)}" loading="lazy" width="48" height="48">`; };
const empty = (title, description, action = '') => `<div class="empty-state">${svg('search')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
function notify(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
function persist() {
  try { localStorage.setItem('factorio-center-v1', JSON.stringify({ rows: state.rows, chest: state.chest, quality: state.quality, favorites: state.favorites, saved: state.saved })); }
  catch { notify('Browser storage is full or unavailable. Export your loadout to keep it.'); }
}
function hydrate() {
  try {
    const data = JSON.parse(localStorage.getItem('factorio-center-v1') || '{}');
    if (data.rows) state.rows = normalizeEntries(data.rows, catalog);
    if (catalog.chests.some(c => c.id === data.chest)) state.chest = data.chest;
    if (catalog.qualities.some(q => q.id === data.quality)) state.quality = data.quality;
    if (Array.isArray(data.favorites)) state.favorites = data.favorites.filter(s => typeof s === 'string');
    if (Array.isArray(data.saved)) state.saved = data.saved.filter(s => typeof s.name === 'string' && Array.isArray(s.rows));
  } catch { notify('A saved loadout could not be read. Starting with an empty crate.'); }
}
function queryWords(query) {
  return query.toLowerCase().replace(/\bbots?\b/g, 'robot').replace(/\bred chips?\b/g, 'advanced circuit').replace(/\bgreen chips?\b/g, 'electronic circuit').replace(/\bblue chips?\b/g, 'processing unit').split(/[^a-z0-9]+/).filter(w => w && !['i', 'me', 'a', 'an', 'the', 'please', 'need', 'want', 'to', 'some'].includes(w));
}
function matches(text, query) { const haystack = text.toLowerCase().replace(/[-_]/g, ' '); return queryWords(query).every(w => haystack.includes(w) || (w.endsWith('s') && haystack.includes(w.slice(0, -1)))); }
async function copy(text, message = 'Copied. Paste into the Factorio console.') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    // Some browsers restrict the Clipboard API for local files. Try their
    // user-initiated copy support before offering selected text to copy by hand.
    const previousFocus = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('aria-label', 'Text to copy');
    field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    ($('#modal').open ? $('#modal') : document.body).append(field);
    field.focus();
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    field.remove();
    previousFocus?.focus({ preventScroll: true });
    if (!copied) {
      showModal('Copy this text', `<p>Press Ctrl+C or ⌘C to copy the selected text.</p><textarea class="code-output" readonly id="fallback-copy">${esc(text)}</textarea>`);
      $('#fallback-copy').focus();
      $('#fallback-copy').select();
      return false;
    }
  }
  notify(message);
  return true;
}
function download(name, data, type = 'application/json') { if (name === 'factorio-production-plan.json') track('plan_export'); if (name === 'factorio-loadout.json') track('loadout_export'); const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showModal(title, body) { const modal = $('#modal'); modal.setAttribute('aria-labelledby', 'dialog-title'); modal.innerHTML = `<div class="modal-head"><div><span class="eyebrow">FACTORIO COMMAND CENTER</span><h2 id="dialog-title">${esc(title)}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${svg('close')}</button></div><div class="modal-body">${body}</div>`; if (!modal.open) modal.showModal(); }
function qualityOptions(selected) { return catalog.qualities.map(q => `<option value="${esc(q.id)}" ${selected === q.id ? 'selected' : ''}>${esc(q.name)}</option>`).join(''); }
function searchField(id, placeholder, value) { return `<div class="search-field">${svg('search')}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" aria-label="${esc(placeholder)}" autocomplete="off"><kbd>/</kbd></div>`; }
function heading(kicker, title, subtitle, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`; }

function renderShell() {
  $('#app').innerHTML = `<aside class="sidebar ${state.menu ? 'open' : ''}"><a href="#commands" class="brand"><div class="brand-icon">${image('assembling-machine-3')}</div><div><strong>FACTORIO</strong><span>COMMAND CENTER</span></div></a><div class="workspace-label">PERSONAL WORKSPACE <span>01</span></div><nav aria-label="Main navigation">${nav.map(([id, icon, label]) => `<a href="#${id}" class="nav-link ${state.page === id ? 'active' : ''}" ${state.page === id ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span>${id === 'crates' && state.rows.length ? `<b class="nav-count">${state.rows.length}</b>` : ''}${id === 'commands' ? `<span class="nav-count">${library.commands.filter(c => c.category !== 'History').length}</span>` : ''}</a>`).join('')}</nav>${state.page === 'blueprints' ? `<div id="blueprint-input-menu">${explorer?.boundaryMenu?.() || ''}</div>` : ''}<div class="sidebar-divider"></div><div class="sidebar-section-title">QUICK ACCESS</div><button class="nav-link subtle" data-action="favorites">${svg('star')}<span>Saved commands</span><span class="nav-count">${state.favorites.length}</span></button><button class="nav-link subtle" data-action="help">${svg('code')}<span>How to use commands</span></button><div class="sidebar-bottom"><div class="local-state"><span class="status-dot"></span> LOCAL WORKSPACE</div><p>Your factory. Your rules.</p><div class="version-stamp">${image('space-platform-starter-pack')}<div>Space Age<span>Factorio ${esc(catalog.version)}</span></div></div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="menu" aria-label="Open navigation">${svg('menu')}</button><span>Workspace</span><span class="breadcrumb-slash">/</span><strong>${nav.find(n => n[0] === state.page)[2]}</strong></div><div class="topbar-right"><span class="game-version"><span class="status-dot"></span> ${esc(catalog.version)} <span class="desktop-only">· Space Age</span></span><button class="engineer-badge" data-action="help" aria-label="Using the command center">N</button></div></header><main id="main" tabindex="-1"></main><footer class="footer"><span>Built for the factory that never stops.</span><span>Game icons © Wube Software <span class="footer-dot">·</span> Personal local toolkit <span class="footer-dot">·</span> <button class="text-button" data-action="analytics-settings">Usage analytics</button></span></footer></div>`;
  renderPage();
}
function renderPage() {
  const active = document.activeElement;
  const focus = active?.id;
  const selection = active?.selectionStart;
  $('#main').innerHTML = ({ commands: commandsPage, crates: cratesPage, blueprints: blueprintsPage, production: () => explorer.productionPage(), coverage: () => explorer.coveragePage(), files: filesPage, setup: setupPage }[state.page])();
  const crateLink = $('.nav-link[href="#crates"]');
  const oldBadge = crateLink?.querySelector('.nav-count');
  if (oldBadge) oldBadge.remove();
  if (crateLink && state.rows.length) crateLink.insertAdjacentHTML('beforeend', `<b class="nav-count">${state.rows.length}</b>`);
  const savedBadge = $('[data-action="favorites"] .nav-count');
  if (savedBadge) savedBadge.textContent = state.favorites.length;
  if (focus) { const next = document.getElementById(focus); if (next) { next.focus({ preventScroll: true }); if (selection != null) try { next.setSelectionRange(selection, selection); } catch {} } }
  const inputMenu = document.querySelector('#blueprint-input-menu');
  if (inputMenu && explorer) inputMenu.innerHTML = explorer.boundaryMenu();
}
function commandCard(c) {
  return `<article class="command-card"><div class="card-top"><div class="item-icon-well">${image(c.icon)}</div><span class="tag ${c.category === 'History' ? 'tag-warning' : ''}">${esc(c.category)}</span><button class="icon-button star-button ${state.favorites.includes(c.id) ? 'is-saved' : ''}" data-action="favorite" data-id="${esc(c.id)}" aria-label="${state.favorites.includes(c.id) ? 'Unsave' : 'Save'} ${esc(c.title)}" aria-pressed="${state.favorites.includes(c.id)}">${svg('star')}</button></div><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="card-code" aria-hidden="true"><span>/c</span> ${esc(c.code.replace(/^\/c\s*/, '').slice(0, 80))}</div><div class="card-bottom"><span>${c.category === 'History' ? '<i class="warning-dot"></i> Original · unverified' : '<i class="small-dot"></i> Factorio 2.0'}</span><button class="text-button" data-action="command" data-id="${esc(c.id)}">${c.category === 'History' ? 'Review original' : 'View command'} ${svg('arrow')}</button></div></article>`;
}
function commandsPage() {
  const categories = ['All', 'Supply kits', 'Research', 'Player', 'World', 'Setup'];
  const filtered = library.commands.filter(c => (state.history || c.category !== 'History') && (state.category === 'All' || c.category === state.category) && (!state.favoritesOnly || state.favorites.includes(c.id)) && matches(`${c.title} ${c.description} ${c.category} ${c.code} ${c.tags?.join(' ')}`, state.query));
  return `${heading('YOUR FACTORY, ON DEMAND', 'Command library', 'Less searching. More building. Your commands, blueprints, and supplies in one place.', `<button class="button secondary" data-action="give">${svg('plus')} Give an item</button>`)}<section class="hero"><div class="hero-grid"></div><div class="hero-copy"><div class="eyebrow"><span class="small-dot"></span> READY FOR YOUR NEXT BUILD</div><h2>Pack a crate.<br>Let the robots take it from here.</h2><p>Choose your supplies. Pick a quality. Get one command<br class="desktop-only"> for as many logistics chests as your factory needs.</p><a class="button primary" href="#crates">Open crate builder ${svg('arrow')}</a></div><div class="hero-illustration" aria-hidden="true"><div class="orbital orbit-1"></div><div class="orbital orbit-2"></div><span class="hero-float float-1">${image('iron-plate')}</span><span class="hero-float float-2">${image('advanced-circuit')}</span><span class="hero-float float-3">${image('transport-belt')}</span><span class="hero-float float-4">${image('construction-robot')}</span><div class="hero-crate">${image('passive-provider-chest')}</div><div class="hero-label"><span class="status-dot"></span> ROBOT READY</div></div></section><div class="library-stats"><div><strong>${library.commands.filter(c => c.category !== 'History').length}</strong><span>ready-to-use commands</span></div><span class="stat-separator"></span><div><strong>${catalog.items.length}</strong><span>items from your game</span></div><span class="stat-separator"></span><div><strong>${library.blueprints.length}</strong><span>blueprints & books</span></div><a href="#files">Explore ${library.files.length} source files ${svg('arrow')}</a></div><section class="library-section"><div class="section-heading"><h2>${state.favoritesOnly ? 'Saved commands' : 'Find your next command'}</h2><button class="text-button muted" data-action="help">${svg('info')} Console guide</button></div><div class="library-search-row">${searchField('command-search', 'Search commands, items, or a task…', state.query)}<button class="button secondary compact" data-action="research">${image('automation-science-pack')} Research a technology</button></div><div class="filter-row"><div class="chips">${categories.map(c => `<button class="chip ${state.category === c ? 'selected' : ''}" data-action="category" data-id="${esc(c)}">${c}</button>`).join('')}${state.favoritesOnly ? '<button class="chip selected" data-action="clear-favorites">★ Saved ×</button>' : ''}</div><label class="checkbox-label"><input id="show-history" type="checkbox" ${state.history ? 'checked' : ''}> Include command history</label></div><div class="results-heading"><span>${filtered.length} ${filtered.length === 1 ? 'command' : 'commands'}</span><span>FROM YOUR WORKSPACE</span></div><div class="command-grid">${filtered.map(commandCard).join('')}</div>${!filtered.length ? empty('No commands found', 'Try “solar”, “robots”, or “research”. You can also include your original command history.', '<button class="button secondary" data-action="clear-command-search">Clear filters</button>') : ''}</section><div class="console-note">${svg('info')} <span>Paste commands into the in-game console with <kbd>~</kbd>. Using <code>/c</code> disables achievements for that save.</span></div>`;
}

function cratesPage() {
  const groups = ['All', 'Logistics', 'Production', 'Materials', 'Science', 'Combat', 'Space', 'Tools'];
  const filtered = catalog.items.filter(i => (state.itemGroup === 'All' || i.group === state.itemGroup) && matches(i.name + ' ' + i.id + ' ' + i.group, state.itemQuery));
  const manifest = renderManifest();
  return `${heading('BUILD YOUR LOADOUT', 'Crate builder', 'Fill logistics chests with exactly what you need. Every item accounted for.', '<button class="button secondary" data-action="saved-loadouts">'+svg('star')+' Saved loadouts</button>')}<div class="builder-layout"><section class="item-browser"><div class="section-heading"><h2>Start with a supply kit</h2><span class="muted small">Adds to your loadout</span></div><div class="preset-grid">${PRESETS.map(p => `<button class="preset-card" data-action="preset" data-id="${p.id}" title="${esc(p.description)}">${image(p.icon)}<span>${p.name}</span>${svg('plus')}</button>`).join('')}</div><div class="section-heading item-heading"><h2>Choose your items</h2><span class="small muted">Click an item to add one stack</span></div>${searchField('item-search', 'Search all '+catalog.items.length+' items…', state.itemQuery)}<div class="chips item-chips">${groups.map(g => `<button class="chip ${state.itemGroup === g ? 'selected' : ''}" data-action="item-group" data-id="${g}">${g}</button>`).join('')}</div><div class="catalog-toolbar"><span>${filtered.length} items</span><label>Quality for new items <select id="new-quality">${qualityOptions(state.quality)}</select></label><button class="text-button" data-action="add-visible">Add all ${state.itemQuery || state.itemGroup !== 'All' ? 'results' : 'items'} ${svg('plus')}</button></div><div class="item-grid">${filtered.map(i => { const selected = state.rows.filter(r => r.id === i.id).reduce((n, r) => n + Number(r.count), 0); return `<button class="item-tile ${selected ? 'has-item' : ''}" data-action="add-item" data-id="${esc(i.id)}" aria-label="Add one stack of ${esc(i.name)}" title="${esc(i.name)} · ${i.stack} per stack${i.spoilable ? ' · Can spoil' : ''}">${selected ? `<span class="selected-count">${number(selected)}</span>` : '<span class="tile-plus">+</span>'}${image(i.id)}<span class="item-name">${esc(i.name)}</span><span class="stack-size">${i.stack} / stack${i.spoilable ? ' · spoils' : ''}</span></button>`; }).join('')}</div>${!filtered.length ? empty('No matching items', 'Search by game name or prototype ID. Fluids need tanks; available filled barrels appear here.') : ''}<div class="small subdued catalog-footnote">Original icons and stack sizes from your installed game. Fluids belong in tanks; filled barrels can go in crates.</div></section><aside class="manifest" aria-label="Your loadout">${manifest}</aside></div>`;
}
function renderManifest() {
  let plan, error = '';
  try { plan = planCrates(state.rows, catalog, state.chest); if (plan.chests > MAX_CHESTS) error = `Split this into batches of ${MAX_CHESTS} chests or fewer.`; } catch (e) { error = e.message; }
  const chest = catalog.chests.find(c => c.id === state.chest);
  const page = Math.max(0, Math.min(state.cratePage, (plan?.chests || 1) - 1));
  const slots = plan ? crateSlots(plan, catalog, page) : [];
  return `<div class="manifest-header"><div><span class="eyebrow">PACKING MANIFEST</span><h2>Your loadout <span class="tag">${state.rows.length}</span></h2></div><button class="icon-button" data-action="clear-crate" aria-label="Clear loadout" ${state.rows.length ? '' : 'disabled'}>${svg('trash')}</button></div><div class="chest-selector"><label for="chest-type">Destination chest</label><div class="chest-select-line">${image(state.chest)}<select id="chest-type">${catalog.chests.map(c => `<option value="${c.id}" ${state.chest === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><p class="chest-help ${['requester-chest', 'steel-chest'].includes(state.chest) ? 'amber-text' : ''}">${esc(CHEST_HELP[state.chest])}</p></div><div class="manifest-items">${state.rows.length ? state.rows.map((r, i) => `<div class="manifest-row">${image(r.id)}<div class="manifest-item-name"><strong>${esc(itemMap.get(r.id)?.name || r.id)}</strong><select aria-label="Quality for ${esc(itemMap.get(r.id)?.name)}" data-row-quality="${i}">${qualityOptions(r.quality)}</select></div><input class="quantity-input" id="quantity-${i}" type="number" min="1" max="1000000" step="1" value="${esc(r.count)}" data-quantity="${i}" aria-label="Amount of ${esc(itemMap.get(r.id)?.name)}"><button class="icon-button remove-row" data-action="remove-item" data-id="${i}" aria-label="Remove ${esc(itemMap.get(r.id)?.name)}">${svg('close')}</button></div>`).join('') : `<div class="empty-crate">${image('passive-provider-chest')}<h3>A blank canvas. In a chest.</h3><p>Add items or choose a supply kit<br>to start packing.</p></div>`}</div><div class="crate-preview"><div class="preview-label"><span>${svg('box')} ${plan?.chests ? `Chest ${page + 1} of ${plan.chests}` : 'Chest preview'}</span><span>${chest.slots} slots · normal chest</span></div><div class="inventory-grid">${Array.from({ length: chest.slots }, (_, i) => { const slot = slots[i]; return `<div class="inventory-slot" ${slot ? `title="${esc(itemMap.get(slot.id).name)} × ${slot.count} · ${slot.quality}"` : ''}>${slot ? image(slot.id) + `<span>${slot.count}</span>` + (slot.quality !== 'normal' ? `<i class="quality-dot quality-${slot.quality}"></i>` : '') : ''}</div>`; }).join('')}</div>${(plan?.chests || 0) > 1 ? `<div class="preview-pages"><button class="text-button" data-action="crate-prev" ${page === 0 ? 'disabled' : ''}>← Previous</button><span>${page + 1} / ${plan.chests}</span><button class="text-button" data-action="crate-next" ${page + 1 >= plan.chests ? 'disabled' : ''}>Next →</button></div>` : ''}</div><div class="manifest-summary"><div><span>Total items</span><strong>${number(plan?.count || 0)}</strong></div><div><span>Slots used</span><strong>${number(plan?.slots || 0)} <small>/ ${number(plan?.capacity || chest.slots)}</small></strong></div><div class="total-chests"><span>Chests to spawn</span><strong>${plan?.chests || 0} <span class="status-dot"></span></strong></div></div>${error ? `<div class="validation-error" role="alert">${esc(error)}</div>` : ''}<div class="manifest-actions"><button class="button primary full" data-action="generate" ${!state.rows.length || error ? 'disabled' : ''}>${svg('code')} Generate command ${svg('arrow')}</button><div class="manifest-secondary"><button class="text-button" data-action="save-loadout" ${!state.rows.length || error ? 'disabled' : ''}>${svg('star')} Save</button><button class="text-button" data-action="export-loadout" ${!state.rows.length || error ? 'disabled' : ''}>${svg('download')} Export</button><button class="text-button" data-action="import-loadout">${svg('plus')} Import</button></div><input type="file" id="import-file" accept=".json,application/json" hidden><p class="manifest-note">Spawns near you. Automatic overflow.<br>${state.chest === 'steel-chest' ? 'Collect the materials by hand.' : 'Connect to a powered roboport network.'}</p></div>`;
}

function blueprintsPage() { return explorer.blueprintsPage(); }
function filesPage() {
  const filtered = library.files.filter(f => (state.fileType === 'All' || f.category === state.fileType) && matches(f.path + ' ' + f.category, state.fileQuery));
  return `${heading('THE ORIGINALS, ALL TOGETHER', 'Source files', 'Command notes, build scripts, blueprint exports, and the starter mod.')}<div class="file-controls">${searchField('file-search', 'Find a source file…', state.fileQuery)}<select id="file-type" aria-label="File category">${['All', 'Blueprints', 'Scripts', 'Notes', 'Starter mod', 'Other'].map(c => `<option ${state.fileType === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>${library.errors.length ? `<div class="notice amber-notice">${svg('info')}<div><strong>${library.errors.length} source file could not be decoded.</strong><p>${library.errors.map(e => esc(e.file) + ': ' + esc(e.message)).join('<br>')}</p></div></div>` : ''}<div class="file-table-wrap"><table class="file-table"><thead><tr><th>FILE NAME</th><th>CATEGORY</th><th>SIZE</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${filtered.map(f => `<tr><td><span class="file-glyph">${svg(f.category === 'Blueprints' ? 'blueprint' : f.category === 'Scripts' ? 'code' : 'file')}</span><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.path)}</a></td><td><span class="tag">${esc(f.category)}</span></td><td>${f.size < 1024 ? f.size + ' B' : (f.size / 1024).toFixed(1) + ' KB'}</td><td><a href="${esc(f.url)}" download class="icon-button" aria-label="Download ${esc(f.name)}">${svg('download')}</a></td></tr>`).join('')}</tbody></table></div>${!filtered.length ? empty('No files found', 'Try a filename, folder, or file extension.') : ''}<div class="results-heading">${filtered.length} files · Original files are preserved in your workspace</div>`;
}
function setupPage() {
  return `${heading('A FACTORY ON YOUR TERMS', 'Game setup', 'Your installed game, starter supplies, and the small details that keep things running.')}<section class="setup-card"><div class="setup-card-icon">${image('steel-chest')}</div><div><div class="eyebrow">STARTER INITIALIZER · 0.2.6</div><h2>Supplies when you ask for them.</h2><p>Automatic starter supplies are disabled by default. The update also turns them off in existing saves when loaded for the first time after upgrading.</p><div class="notice green-notice">${svg('check')}<span>Manual grants stay available with <code>/starter_init_grant</code>.</span></div><p class="small muted">Restart Factorio and load your save to apply the installed update. Existing supplies remain in the world.</p><div class="setup-actions"><button class="button primary" data-action="manual-grant">${svg('copy')} Copy manual grant</button><button class="button secondary" data-action="command" data-id="stop-starter">Disable in current session</button></div></div></section><div class="setup-grid"><section class="panel"><div class="section-heading"><h2>Installed content</h2><span class="tag">${esc(catalog.version)}</span></div><p class="muted">Configuration captured from your local game.</p><div class="mod-list">${catalog.mods.map(m => `<div><span>${esc(({ base: 'Factorio base game', 'space-age': 'Space Age', quality: 'Quality', 'elevated-rails': 'Elevated rails', starter_initializer: 'Starter Initializer', EverythingOnNauvis: 'Everything on Nauvis', 'visible-planets': 'Visible Planets', 'aai-containers': 'AAI Containers' })[m.name] || m.name)}</span><span class="mod-status ${m.enabled ? 'enabled' : ''}">${m.enabled ? 'Enabled' : 'Disabled'}</span></div>`).join('')}</div></section><section class="panel"><h2>Choosing a robot chest</h2><p class="muted">A chest must be inside the orange logistics area of a powered roboport network.</p><div class="chest-guide">${catalog.chests.map(c => `<div>${image(c.id)}<span><strong>${esc(c.name)}</strong><p>${esc(CHEST_HELP[c.id])}</p></span></div>`).join('')}</div></section></div><section class="panel console-guide"><h2>From website to factory</h2><div class="guide-steps"><div><span>01</span><h3>Build your command</h3><p>Choose a command, customize an item, or pack a loadout.</p></div><div><span>02</span><h3>Open the console</h3><p>Press <kbd>~</kbd> or your configured console key while in a game.</p></div><div><span>03</span><h3>Paste and run</h3><p>Paste the single-line command. Factorio may ask you to repeat it the first time.</p></div></div><p class="small amber-text">Commands beginning with /c disable achievements for that save. The site only generates text; commands run when you paste them in-game.</p></section>`;
}

function commandDialog(c) { track('command_view'); showModal(c.title, `<p>${esc(c.description)}</p>${c.issues?.length ? `<div class="notice amber-notice"><div><strong>Original command — review before running</strong><ul>${c.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></div>` : ''}${c.category === 'History' && !c.issues.length ? '<p class="amber-text">This is an unverified original from your notes.</p>' : ''}<label class="field-label" for="command-output">CONSOLE COMMAND</label><textarea id="command-output" class="code-output" readonly spellcheck="false">${esc(c.code)}</textarea><div class="dialog-actions"><a href="${esc(c.url)}" target="_blank" rel="noopener" class="source-link">${esc(c.source)}</a><button class="button primary" data-action="copy-output">${svg('copy')} Copy command</button></div><p class="small muted">Open the console with ~. /c disables achievements for this save.</p>`); }
function generateDialog(rows = state.rows, chest = state.chest, title = 'Your loadout is ready.', blueprintId = '') {
  try {
    const plan = planCrates(rows, catalog, chest);
    const code = generateCrateCommand(rows, catalog, chest);
    if (!code) return;
    showModal(title, `<div class="generated-summary">${image(chest)}<div><strong>${number(plan.count)} items. ${plan.chests} ${plan.chests === 1 ? 'chest' : 'chests'}.</strong><span>${plan.rows.length} item / quality pairs · ${esc(plan.chest.name)}</span></div><span class="generated-check">${svg('check')}</span></div><p>${esc(CHEST_HELP[chest])} Chests are placed on clear ground near your player.</p><label class="field-label" for="command-output">ONE COMMAND. THE WHOLE LOADOUT.</label><textarea id="command-output" class="code-output" readonly spellcheck="false">${esc(code)}</textarea><div class="dialog-actions"><span class="small muted">${number(code.length)} characters · Factorio 2.0</span><button class="button primary" data-action="copy-output">${svg('copy')} Copy command</button></div><p class="small muted">Paste into the in-game console. /c disables achievements for this save. Chests report placement or insertion failures without silently discarding items.</p>`);
    track(blueprintId ? 'construction_crate' : 'crate_generate', blueprintId);
  } catch (e) { notify(e.message); }
}
function blueprintDialog(b) { openBlueprint = b; explorer.blueprintDialog(b); }
function applyBlueprintRecords(records) {
  const merged = new Map(library.blueprints.map(blueprint => [blueprint.id, blueprint]));
  for (const record of records || []) {
    if (record && typeof record.id === 'string' && record.id) merged.set(record.id, record);
  }
  library.blueprints = [...merged.values()];
  const atlas = globalThis.FactorioData?.atlas;
  if (atlas?.blueprints) {
    const tested = new Map(atlas.blueprints.map(blueprint => [blueprint.id, blueprint]));
    for (const record of records || []) {
      if (record && typeof record.id === 'string' && record.id) tested.set(record.id, record);
    }
    atlas.blueprints = [...tested.values()];
  }
  explorer?.refreshBlueprints?.();
  renderPage();
}
function addRows(rows) { try { state.rows = normalizeEntries([...state.rows, ...rows], catalog); state.cratePage = 0; persist(); renderPage(); return true; } catch (e) { notify(e.message); return false; } }
function toolDialog(kind) {
  const research = kind === 'research';
  const options = research ? catalog.technologies : catalog.items;
  showModal(research ? 'Research a technology' : 'Give yourself an item', `<p>${research ? 'Research the chosen technology and, optionally, all its prerequisites.' : 'Send any available item directly to your inventory. The command reports how many fit.'}</p><label class="field-label" for="tool-item">${research ? 'TECHNOLOGY' : 'ITEM'}</label><input class="text-input" id="tool-item" list="tool-options" placeholder="Search by name or prototype ID…" autocomplete="off"><datalist id="tool-options">${options.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</datalist>${research ? '<label class="checkbox-label tool-checkbox"><input id="tool-prereqs" type="checkbox" checked> Include prerequisites</label>' : `<div class="tool-fields"><label>Amount<input class="text-input" id="tool-count" type="number" min="1" max="1000000" step="1" value="100"></label><label>Quality<select id="tool-quality">${qualityOptions('normal')}</select></label></div>`}<button class="button primary full" data-action="build-tool" data-id="${kind}">${svg('code')} Generate command</button><div id="tool-result" aria-live="polite"></div>`);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (await explorer.handleClick(action, id)) {
    if (action === 'blueprint-boundary' && state.menu) { state.menu = false; renderShell(); }
    return;
  }
  const command = library?.commands.find(c => c.id === id);
  const latestBlueprint = library?.blueprints.find(b => b.id === id);
  const blueprint = openBlueprint?.id === id && ['copy-blueprint', 'crate-blueprint', 'pack-blueprint', 'confirm-pack-blueprint'].includes(action) ? openBlueprint : latestBlueprint;
  if (action === 'close-modal') $('#modal').close();
  else if (action === 'menu') { state.menu = !state.menu; $('.sidebar').classList.toggle('open', state.menu); }
  else if (action === 'command') commandDialog(command);
  else if (action === 'copy-output') { if (await copy($('#command-output').value)) track('command_copy'); }
  else if (action === 'favorite') { state.favorites = state.favorites.includes(id) ? state.favorites.filter(f => f !== id) : [...state.favorites, id]; persist(); renderPage(); }
  else if (action === 'favorites') { state.favoritesOnly = true; state.history = true; state.category = 'All'; state.query = ''; location.hash = 'commands'; if (state.page === 'commands') renderPage(); }
  else if (action === 'clear-favorites') { state.favoritesOnly = false; renderPage(); }
  else if (action === 'category') { state.category = id; renderPage(); }
  else if (action === 'clear-command-search') { Object.assign(state, { query: '', category: 'All', favoritesOnly: false }); renderPage(); }
  else if (action === 'help') { showModal('From command to factory', `<div class="help-steps"><p><b>1.</b> Find a command or use the crate builder to prepare your supplies.</p><p><b>2.</b> Copy it and open Factorio’s console with <kbd>~</kbd>.</p><p><b>3.</b> Paste and press Enter. Factorio may ask you to run it a second time to confirm.</p></div><div class="notice amber-notice">${svg('info')}<span>Using /c disables achievements for that save. Multiplayer console commands require admin permissions.</span></div><p>Place supply chests inside the orange logistics area of a powered roboport. Construction robots use the items to build nearby ghosts.</p><p class="small muted">Commands and loadouts are generated locally. This website does not connect to or run commands in your game.</p>`); }
  else if (action === 'give' || action === 'research') toolDialog(action);
  else if (action === 'build-tool') {
    try {
      const value = $('#tool-item').value.trim();
      const data = id === 'research' ? catalog.technologies : catalog.items;
      const selected = data.find(i => i.id === value || i.name.toLowerCase() === value.toLowerCase());
      if (!selected) throw new Error('Choose an available '+(id === 'research' ? 'technology' : 'item')+' from the list.');
      const code = id === 'research' ? `/c local t=game.player.force.technologies[${JSON.stringify(selected.id)}]; if t then ${$('#tool-prereqs').checked ? 't.research_recursive()' : 't.researched=true'} else game.player.print("Technology unavailable.") end` : generateGiveCommand(selected.id, Number($('#tool-count').value), $('#tool-quality').value);
      $('#tool-result').innerHTML = `<textarea id="command-output" class="code-output tool-output" readonly>${esc(code)}</textarea><button class="button primary full" data-action="copy-output">${svg('copy')} Copy command</button><p class="small muted">/c disables achievements for this save.</p>`;
    } catch (e) { $('#tool-result').innerHTML = `<p class="validation-error" role="alert">${esc(e.message)}</p>`; }
  }
  else if (action === 'item-group') { state.itemGroup = id; renderPage(); }
  else if (action === 'add-item') { addRows([{ id, count: itemMap.get(id).stack, quality: state.quality }]); }
  else if (action === 'add-visible') { const visible = catalog.items.filter(i => (state.itemGroup === 'All' || i.group === state.itemGroup) && matches(i.name+' '+i.id+' '+i.group, state.itemQuery)); addRows(visible.map(i => ({ id: i.id, count: i.stack, quality: state.quality }))); notify(`Added one stack of ${visible.length} items.`); }
  else if (action === 'preset') { const preset = PRESETS.find(p => p.id === id); addRows(preset.entries.map(([id, count]) => ({ id, count, quality: state.quality }))); notify(preset.name + ' added to your loadout.'); }
  else if (action === 'remove-item') { state.rows.splice(Number(id), 1); persist(); renderPage(); }
  else if (action === 'clear-crate') { state.rows = []; state.cratePage = 0; persist(); renderPage(); }
  else if (action === 'crate-prev' || action === 'crate-next') { state.cratePage += action === 'crate-next' ? 1 : -1; renderPage(); }
  else if (action === 'generate') generateDialog();
  else if (action === 'export-loadout') download('factorio-loadout.json', JSON.stringify({ version: 1, chest: state.chest, rows: normalizeEntries(state.rows, catalog) }, null, 2));
  else if (action === 'import-loadout') $('#import-file').click();
  else if (action === 'save-loadout') showModal('Save this loadout', `<p>Keep this selection in this browser for your next build.</p><label class="field-label" for="loadout-name">LOADOUT NAME</label><input id="loadout-name" class="text-input" maxlength="80" placeholder="e.g. Northern outpost"><button class="button primary full" data-action="confirm-save">${svg('star')} Save loadout</button>`);
  else if (action === 'confirm-save') { const name = $('#loadout-name').value.trim(); if (!name) { $('#loadout-name').focus(); return; } try { state.saved.push({ id: crypto.randomUUID(), name, rows: normalizeEntries(state.rows, catalog), chest: state.chest }); persist(); $('#modal').close(); notify('Loadout saved in this browser.'); } catch (e) { notify(e.message); } }
  else if (action === 'saved-loadouts') savedDialog();
  else if (action === 'load-saved') { const saved = state.saved.find(s => s.id === id); try { const rows = normalizeEntries(saved.rows, catalog); state.rows = rows; state.chest = catalog.chests.some(c => c.id === saved.chest) ? saved.chest : 'passive-provider-chest'; state.cratePage = 0; persist(); $('#modal').close(); renderPage(); notify('Loadout restored.'); } catch (e) { notify(e.message); } }
  else if (action === 'delete-saved') { state.saved = state.saved.filter(s => s.id !== id); persist(); savedDialog(); }
  else if (action === 'blueprint-details') blueprintDialog(blueprint);
  else if (action === 'copy-blueprint') { if (await copy(blueprint.code, 'Blueprint string copied. Paste it into Factorio’s blueprint import dialog.')) track('blueprint_copy', blueprint.id); }
  else if (action === 'crate-blueprint' && blueprint && !blueprint.isBook && !blueprint.excluded.length) generateDialog(blueprint.entries, blueprint.starter ? 'steel-chest' : 'passive-provider-chest', 'Construction crate · ' + blueprint.name, blueprint.id);
  else if (action === 'pack-blueprint') { if (blueprint.isBook || blueprint.excluded.length) { showModal('Review blueprint materials', `<p>${esc(blueprint.name)}</p>${blueprint.isBook ? `<p>This book contains ${blueprint.blueprintCount} blueprints. All of their materials will be added, including alternative designs.</p>` : ''}${blueprint.excluded.length ? `<p class="amber-text">Excluded from the loadout: ${blueprint.excluded.map(esc).join(', ')}. These types have no available placement item in your game.</p>` : ''}<p>Requested modules and item qualities are included. Existing loadout items are kept.</p><button class="button primary full" data-action="confirm-pack-blueprint" data-id="${blueprint.id}">Add ${number(blueprint.entries.reduce((n,r)=>n+r.count,0))} items to loadout ${svg('arrow')}</button>`); } else packBlueprint(blueprint); }
  else if (action === 'confirm-pack-blueprint') packBlueprint(blueprint);
  else if (action === 'manual-grant') { if (await copy('/starter_init_grant')) track('command_copy'); }
  else if (action === 'analytics-settings') analyticsDialog();
  else if (action === 'analytics-toggle') { globalThis.FactorioAnalytics?.setEnabled(!globalThis.FactorioAnalytics.status().enabled); analyticsDialog(); }
});
function analyticsDialog() {
  const status = globalThis.FactorioAnalytics?.status() || {};
  const message = !status.supported ? 'Usage analytics is off for this local or offline copy.' : status.privacySignal ? 'Usage analytics is off because your browser requests privacy.' : status.enabled ? 'Usage analytics is on for this browser.' : 'Usage analytics is off for this browser.';
  showModal('Usage analytics', `<p>Usage counts help improve the blueprint library. On the public site, the owner can see visits, pages viewed, blueprint opens and copies, crate generation, and planner actions.</p><p>Only a random browser ID, a session ID, the page, action, selected public blueprint or item, screen-size category, and referring website’s domain are sent to the owner’s Pi. Your browser ID resets after 30 days; event records expire after 90 days.</p><p>Search text, commands, crate contents, names, and full referring URLs are not collected. IP addresses are not stored by the analytics service. Saved loadouts stay in your browser. Counts are approximate and cannot identify who visited.</p><p role="status"><strong>${message}</strong></p>${status.supported && !status.privacySignal ? `<button class="button secondary" data-action="analytics-toggle">${status.enabled ? 'Turn off' : 'Turn on'} usage analytics</button>` : ''}<p class="small muted">Your choice applies to this browser on this site. Do Not Track and Global Privacy Control are respected. Offline copies never send analytics.</p>`);
}
function savedDialog() { showModal('Saved loadouts', state.saved.length ? `<p>Loading a saved loadout replaces the current selection.</p><div class="saved-list">${state.saved.map(s => `<div><span><strong>${esc(s.name)}</strong><small>${s.rows.length} item / quality pairs</small></span><button class="button secondary compact" data-action="load-saved" data-id="${esc(s.id)}">Load</button><button class="icon-button" data-action="delete-saved" data-id="${esc(s.id)}" aria-label="Delete ${esc(s.name)}">${svg('trash')}</button></div>`).join('')}</div>` : empty('No saved loadouts yet', 'Add some items, then choose Save in the packing manifest.')); }
function packBlueprint(blueprint) { if (!addRows(blueprint.entries)) return; if (blueprint.starter) { state.chest = 'steel-chest'; persist(); } track('crate_pack', 'blueprint'); $('#modal').close(); location.hash = 'crates'; if (state.page === 'crates') renderPage(); notify('Blueprint materials added, with original qualities.'); }

document.addEventListener('input', event => {
  const field = event.target;
  if (explorer.handleInput(field)) return;
  const mapping = { 'command-search': 'query', 'item-search': 'itemQuery', 'blueprint-search': 'blueprintQuery', 'file-search': 'fileQuery' };
  if (mapping[field.id]) { state[mapping[field.id]] = field.value; renderPage(); }
  else if (field.dataset.quantity != null) { state.rows[Number(field.dataset.quantity)].count = field.value === '' ? '' : Number(field.value); persist(); renderPage(); }
});
document.addEventListener('change', async event => {
  const field = event.target;
  if (explorer.handleChange(field)) return;
  if (field.id === 'show-history') state.history = field.checked;
  else if (field.id === 'file-type') state.fileType = field.value;
  else if (field.id === 'new-quality') { state.quality = field.value; persist(); }
  else if (field.id === 'chest-type') { state.chest = field.value; state.cratePage = 0; persist(); }
  else if (field.dataset.rowQuality != null) { const previous = state.rows.map(r => ({ ...r })); state.rows[Number(field.dataset.rowQuality)].quality = field.value; try { state.rows = normalizeEntries(state.rows, catalog); persist(); } catch (e) { state.rows = previous; notify(e.message); } }
  else if (field.id === 'import-file' && field.files[0]) {
    try { const file = field.files[0]; if (file.size > 1024 * 1024) throw new Error('Loadout files must be smaller than 1 MB.'); const data = JSON.parse(await file.text()); const rows = normalizeEntries(data.rows, catalog); if (!catalog.chests.some(c => c.id === data.chest)) throw new Error('Unsupported chest in this loadout.'); state.rows = rows; state.chest = data.chest; state.cratePage = 0; persist(); notify('Loadout imported.'); } catch (e) { notify('Import failed: ' + e.message); }
  } else return;
  renderPage();
});
window.addEventListener('hashchange', () => { state.page = routes.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'commands'; state.menu = false; renderShell(); window.scrollTo({ top: 0 }); });
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !$('#modal').open) { const input = $('#main input[type="search"]'); if (input) { event.preventDefault(); input.focus(); } } });
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const r = $('#modal').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('#modal').close(); } });
$('#modal').addEventListener('close', () => { openBlueprint = undefined; explorer?.clearDisplayedBlueprint?.(); });

try {
  ({ catalog, library } = globalThis.FactorioData || {});
  if (!catalog || !library) throw new Error('The local data files are missing.');
  const { community, production, atlas } = globalThis.FactorioData;
  if (!community || !production) throw new Error('The blueprint and recipe data files are missing.');
  library.blueprints = [...library.blueprints.map(b => ({ ...b, collection: 'Local', category: 'Local builds', analysis: community.local[b.id] || { kind: 'Unanalyzed', inputs: [], outputs: [], internal: [], seeds: [], recipes: [], missing: [], serviceInputs: [], serviceOutputs: [], notes: ['This local blueprint was added after the production index. Refresh the blueprint index to see its recipes.'] } })), ...community.blueprints, ...atlas.blueprints];
  itemMap = new Map([...catalog.items, ...catalog.fluids, ...atlas.coverage.items.filter(i => i.internal)].map(i => [i.id, i]));
  explorer = globalThis.FactorioExplorer.create({ catalog, library, community, production, atlas, esc, image, svg, number, heading, searchField, empty, showModal, notify, addRows, renderPage, download, onBlueprintSelected: record => { openBlueprint = record; } });
  hydrate();
  state.page = routes.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'commands';
  renderShell();
  globalThis.FactorioBlueprintUpdates?.start({ applyRecords: applyBlueprintRecords, blueprints: library.blueprints });
} catch (error) { $('#app').innerHTML = `<div class="loading"><h1>The library could not be loaded.</h1><p>${esc(error.message)}</p><p>Keep the website folder together, including its data, assets, and scripts, then reopen <code>index.html</code>.</p><button class="button primary" onclick="location.reload()">Try again</button></div>`; }

})();
