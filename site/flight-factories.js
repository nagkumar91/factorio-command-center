(function () {
  'use strict';
  const M = globalThis.FlightFactories;
  const {esc, localPath, sourceUrl, products, evidence, downloadable, formatRate: rate} = M;
  const $ = selector => document.querySelector(selector);
  let data;
  try { data = M.normalize(globalThis.FLIGHT_FACTORIES); }
  catch (error) { $('#results').innerHTML = `<p class="empty data-error" role="alert">${esc(error.message)} Reload the local flight data and try again.</p>`; $('#profile-line').textContent = 'Flight data could not be loaded.'; return; }
  const items = new Map([...data.materials, ...data.items].map(item => [item.id, item]));
  const factories = new Map(data.factories.map(factory => [factory.id, factory]));
  const coverage = M.coverage(data);
  const state = {view: 'factories', query: '', variant: 'all', status: 'all', limit: 30};
  const name = id => items.get(id)?.name || String(id || '').replaceAll('-', ' ');
  const units = type => type === 'fluid' ? 'fluid/min' : 'items/min';
  const typeOf = input => input.type || items.get(input.id)?.type;
  const localFile = location.protocol === 'file:';
  const bookAction = localFile ? 'Open verified blueprint book' : 'Download verified blueprint book';
  const bookAttributes = localFile ? 'target="_blank" rel="noopener"' : 'download';
  const bookHelp = localFile ? '<p>Opens blueprint text in a new tab. Copy the full string into Factorio’s Import string dialog.</p>' : '';
  function icon(id) {
    const path = localPath(items.get(id)?.icon);
    return path ? `<img class="item-icon" src="${esc(path)}" alt="" loading="lazy">` : `<span class="item-icon icon-fallback" aria-hidden="true">${esc(name(id).slice(0, 1).toUpperCase() || '◇')}</span>`;
  }
  const badge = factory => { const e = evidence(factory, data.profile); return `<span class="evidence ${e.id}">${esc(e.label)}</span>`; };
  const boundary = factory => M.variants[factory.variant] || 'Unspecified inputs';
  const link = factory => '#factory=' + encodeURIComponent(factory.id);
  const panelText = text => String(text || '').replace(/\[(?:item|fluid|virtual-signal)=([^\]]+)\]/g, (_, id) => name(id));
  function flow(factory) {
    return `<div class="plan-flow" aria-hidden="true"><div class="flow-inputs">${factory.inputs.slice(0, 3).map(input => icon(input.id)).join('')}${factory.inputs.length > 3 ? `<small>+${factory.inputs.length - 3}</small>` : ''}</div><span class="flow-arrow">→</span><span class="flow-machine">⚙</span><span class="flow-arrow">→</span><span class="flow-output">${icon(products(factory)[0])}</span></div>`;
  }
  function summary() {
    $('#profile-line').textContent = [data.profile.name || 'Modded flight profile', data.profile.factorioVersion ? `Factorio ${data.profile.factorioVersion}` : '', `${M.array(data.profile.mods).length} mods listed`].filter(Boolean).join(' · ');
    const book = data.profile.book;
    if (localPath(book?.path) && M.sha(book?.sha256) && Number.isInteger(book?.count) && book.count > 0) {
      $('#book-download').hidden = false;
      $('#book-download').innerHTML = `<a class="button" href="${esc(localPath(book.path))}" ${bookAttributes}>${bookAction} <span aria-hidden="true">${localFile ? '↗' : '↓'}</span></a><p>${book.count.toLocaleString('en-US')} layouts with passing native evidence · grouped by input boundary</p>${bookHelp}`;
    }
    $('#summary').innerHTML = `<div><strong>${coverage.planned}<small> / ${coverage.total}</small></strong><span>Products with calculated plans</span></div><div><strong>${coverage.downloadable}</strong><span>Products with downloadable blueprints</span></div><div class="tested"><strong>${coverage.tested}</strong><span>Products native tested · SHA matched</span></div><div><strong>${coverage.total - coverage.planned}</strong><span>Products still needing a plan</span></div>`;
  }
  function card(factory) {
    const preview = localPath(factory.blueprint?.preview), output = products(factory)[0];
    return `<article class="factory-card" data-factory="${esc(factory.id)}"><div class="card-art">${preview ? `<img src="${esc(preview)}" alt="Saved layout for ${esc(factory.name)}" loading="lazy">` : flow(factory)}<span class="art-label">${preview ? 'SAVED BLUEPRINT · SCHEMATIC' : downloadable(factory) ? 'CALCULATED FLOW · BLUEPRINT AVAILABLE' : 'CALCULATED FLOW · NO SAVED LAYOUT'}</span></div><div class="card-content"><div class="card-meta"><span class="variant">${esc(boundary(factory))}</span></div><div><h3>${esc(factory.name)}</h3><p class="product-id">${esc(products(factory).join(' · '))}</p></div>${badge(factory)}<p class="card-target">Calculated target <strong>${rate(factory.outputPerMinute)} ${units(items.get(output)?.type)}</strong></p><p class="card-inputs"><b>Feed:</b> ${factory.inputs.length ? factory.inputs.slice(0, 4).map(i => esc(name(i.id))).join(' · ') + (factory.inputs.length > 4 ? ` +${factory.inputs.length - 4} more` : '') : esc(factory.reason || 'See plan assumptions')}</p><div class="card-actions"><a class="button" href="${esc(link(factory))}" aria-label="Inspect ${esc(factory.name)} · ${esc(boundary(factory))}">Inspect factory <span aria-hidden="true">→</span></a><span class="download-note">${downloadable(factory) ? 'Blueprint available' : evidence(factory, data.profile).id === 'native-failed' ? 'Download withheld' : 'No blueprint file'}</span></div></div></article>`;
  }
  function coverageRow(row, builds) {
    const tested = builds.some(f => evidence(f, data.profile).id === 'native-tested');
    const available = builds.some(downloadable);
    const failed = builds.filter(f => evidence(f, data.profile).id === 'native-failed').length;
    const label = tested ? 'Native tested · SHA matched' : available ? 'Blueprint available · not native tested' : failed ? 'Native test failed · download withheld' : builds.length ? 'Calculated plan only' : 'No matching plan';
    const reason = (builds.length ? [...new Set(builds.map(boundary))].join(' · ') : row.reason || 'This product has no published plan for the selected filters.') + (failed ? ` · ${failed} variant${failed === 1 ? '' : 's'} failed native testing` : '');
    return `<article class="coverage-row" data-product="${esc(row.id)}"><div class="coverage-product">${icon(row.id)}<div><h3>${esc(row.name)}</h3><small>${esc(row.id)} · ${esc(row.type)}${row.group ? ' · ' + esc(row.group) : ''}</small></div></div><div class="coverage-state"><strong>${label}</strong><p>${esc(reason)}</p></div><div class="coverage-builds">${builds.map(factory => `<a href="${esc(link(factory))}" aria-label="Inspect ${esc(row.name)} · ${esc(boundary(factory))}">${esc(boundary(factory))}</a>`).join('')}</div></article>`;
  }
  function render() {
    $('#catalogue').hidden = state.view === 'profile'; $('#profile').hidden = state.view !== 'profile';
    document.querySelectorAll('[data-view]').forEach(a => { if (a.dataset.view === state.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (state.view === 'profile') return renderProfile();
    const isCoverage = state.view === 'coverage';
    $('#catalogue-title').textContent = isCoverage ? 'Every recipe product, accounted for' : 'Choose your next factory';
    $('#view-description').textContent = isCoverage ? 'Find planned products, blueprint downloads, and the remaining gaps.' : 'Calculated plans and native evidence stay separate.';
    let rows;
    if (isCoverage) {
      rows = coverage.rows.filter(row => M.matches([row.id, row.name, row.group, row.type].join(' '), state.query)).map(row => ({row, builds: row.builds.filter(f => (state.variant === 'all' || f.variant === state.variant))}));
      rows = rows.filter(({builds}) => state.status === 'all' || (state.status === 'unavailable' ? builds.length === 0 : builds.some(f => state.status === 'downloadable' ? downloadable(f) : evidence(f, data.profile).id === state.status)));
    } else rows = M.filterFactories(data, state);
    $('#result-count').textContent = `${rows.length.toLocaleString('en-US')} ${isCoverage ? 'products' : 'factory variants'} · ${Math.min(rows.length, state.limit)} shown`;
    $('#results').className = isCoverage ? 'coverage-list' : 'factory-grid';
    if (!rows.length) {
      $('#results').className = '';
      const pending = data.items.length === 0 && data.factories.length === 0;
      $('#results').innerHTML = `<div class="empty"><h3>${pending ? 'The flight catalogue is awaiting its data' : 'No matching ' + (isCoverage ? 'products' : 'factory variants')}</h3><p>${pending ? 'Your modded recipes, factory plans, and evidence will appear here when the local publication is ready.' : 'Try another product or input boundary, or clear the filters to browse everything.'}</p>${!pending ? '<button class="button secondary" data-action="clear">Clear filters</button>' : ''}</div>`;
    } else $('#results').innerHTML = rows.slice(0, state.limit).map(value => isCoverage ? coverageRow(value.row, value.builds) : card(value)).join('');
    $('#load-more').hidden = rows.length <= state.limit;
    $('#load-more').textContent = `Show ${Math.min(30, rows.length - state.limit)} more`;
  }
  function renderProfile() {
    const p = data.profile, map = p.map || {}, mapPath = localPath(map.path), preview = localPath(map.preview);
    $('#profile').innerHTML = `<div class="section-heading"><div><h2 id="profile-title">Your map &amp; mod profile</h2><p>Factory calculations belong to this published recipe snapshot.</p></div></div><div class="profile-grid"><section class="panel"><p class="eyebrow">FLIGHT WORLD</p><h2>${esc(map.name || p.name || 'Modded flight profile')}</h2><p>${esc(map.description || 'The map download will appear here when the flight world has been prepared.')}</p>${map.seed != null ? `<p>Map seed: <strong>${esc(map.seed)}</strong></p>` : ''}${localPath(map.evidencePath) ? `<p><a href="${esc(localPath(map.evidencePath))}" target="_blank" rel="noreferrer">Loaded-save verification</a></p>` : ''}${mapPath ? `<a class="button" href="${esc(mapPath)}" download>Download flight map</a>` : ''}${localPath(p.book?.path) ? `<p><a class="button secondary" href="${esc(localPath(p.book.path))}" ${bookAttributes}>${bookAction} · ${esc(p.book.count)} layouts</a></p>${bookHelp}` : ''}${preview ? `<img class="profile-preview" src="${esc(preview)}" alt="Flight map preview">` : ''}${M.array(p.notes).length ? `<ul class="notes">${p.notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}</section><section class="panel"><p class="eyebrow">RECIPE SNAPSHOT</p><h2>${esc(p.factorioVersion ? 'Factorio ' + p.factorioVersion : 'Version awaiting publication')}</h2><p>${M.array(p.mods).length} mods listed in this profile.</p>${data.generatedAt ? `<p>Published snapshot: ${esc(data.generatedAt)}</p>` : ''}${p.prototypeSha256 ? `<details><summary>Prototype SHA-256</summary><p class="hash">${esc(p.prototypeSha256)}</p></details>` : ''}<ul class="mod-list">${M.array(p.mods).map(mod => `<li>${esc(mod.title || mod.name)} ${mod.version ? `<small>${esc(mod.version)}</small>` : ''}</li>`).join('')}</ul><p class="detail-note">Raw variants expand upstream recipes to basic resource inputs. Intermediate variants take prepared parts. Mixed variants combine resource inputs and prepared parts.</p></section></div>`;
  }
  function schematic(factory) {
    const entities = M.array(factory.blueprint?.entities).filter(e => Number.isFinite(e.position?.x) && Number.isFinite(e.position?.y));
    if (!entities.length) return '';
    const points = entities.map(entity => {
      const size = entity.size || [1, 1];
      let w = Array.isArray(size[0]) ? size[1][0] - size[0][0] : size[0], h = Array.isArray(size[0]) ? size[1][1] - size[0][1] : size[1];
      if (!(w > 0) || !(h > 0)) w = h = 1;
      if ([4, 12].includes(entity.direction)) [w, h] = [h, w];
      if (entity.name === 'display-panel') w = h = 1;
      return {...entity, w, h, left: entity.position.x - w / 2, top: entity.position.y - h / 2};
    });
    const minX = Math.min(...points.map(p => p.left)) - 2, minY = Math.min(...points.map(p => p.top)) - 2;
    const width = Math.max(...points.map(p => p.left + p.w)) - minX + 2, height = Math.max(...points.map(p => p.top + p.h)) - minY + 2;
    let displayIndex = 0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Saved blueprint positions with input display panels"><title>Saved blueprint geometry; panel labels are listed below.</title>${points.map(p => {
      const panel = p.name === 'display-panel', signal = localPath(items.get(p.icon?.name)?.icon);
      const colour = /pipe|pump|tank/.test(p.name) ? '#76bacc' : /assembling|furnace|chemical|refinery/.test(p.name) ? '#dfad62' : '#869d91';
      return `<g${panel ? ` data-display-entity="${esc(p.entity_number)}"` : ''}><title>${esc(panel ? `${p.text || ''} · ${name(p.icon?.name)}` : p.name)}</title><rect x="${p.left}" y="${p.top}" width="${p.w}" height="${p.h}" rx=".08" class="${panel ? 'display-symbol' : 'schematic-shape'}" ${panel ? '' : `fill="${colour}"`}/>${panel ? signal ? `<image href="${esc(signal)}" x="${p.position.x - .4}" y="${p.position.y - .4}" width=".8" height=".8"/>` : `<text class="schematic-label" x="${p.position.x}" y="${p.position.y + .25}">${esc(name(p.icon?.name).slice(0, 1) || 'D')}</text>` : ''}${panel ? `<circle cx="${p.position.x + .8}" cy="${p.position.y - .5}" r=".45" fill="#345b6c"/><text class="schematic-label" x="${p.position.x + .8}" y="${p.position.y - .25}">${++displayIndex}</text>` : ''}</g>`;
    }).join('')}</svg>`;
  }
  function measuredOutputs(factory) {
    const measured = M.measurement(factory, data.profile);
    if (!measured) return '';
    const randomRows = measured.rows.filter(row => M.randomYieldEvidence(row));
    const results = measured.rows.map(row => {
      const random = M.randomYieldEvidence(row), interval = random?.interval;
      return `<tr data-measured-output="${esc(row.id)}"><th scope="row">${icon(row.id)} ${esc(name(row.id))}${random ? '<span class="random-yield-note">Random-yield sample</span>' : ''}</th><td>${rate(row.collected)}</td><td><strong>${rate(row.perMinute)}</strong><small>${units(row.type)}</small>${interval ? `<span class="rate-interval"><span>${rate(interval.confidence * 100)}% interval</span>${rate(interval.lowerPerMinute)}–${rate(interval.upperPerMinute)}</span>` : ''}</td></tr>`;
    }).join('');
    const randomDetails = randomRows.length ? `<p class="random-interpretation">Random-yield rates are sampled estimates. Confidence intervals estimate the mean collected rate; they do not guarantee each minute’s output.</p><details class="stochastic-tests"><summary>Random-yield evidence &amp; assumptions</summary><ul>${randomRows.map(row => {
      const {interval, stability} = M.randomYieldEvidence(row);
      return `<li><b>${esc(name(row.id))}</b>${interval ? `<p>${rate(interval.confidence * 100)}% confidence interval for mean collected output: ${rate(interval.lowerPerMinute)}–${rate(interval.upperPerMinute)} ${units(row.type)}.${interval.method ? ' Method: ' + esc(interval.method) + '.' : ''}</p>${interval.assumption ? `<p class="ci-assumption">${esc(interval.assumption)}</p>` : ''}` : ''}${stability ? `<p>${esc(stability.interpretation || (stability.accepted ? 'Variation is consistent with stationary random output; this does not prove stationarity.' : 'The stationarity check did not pass.'))}<br>Test level: ${rate(stability.alpha * 100)}%; p = ${esc(stability.pValue.toPrecision(3))}.</p>${M.array(stability.assumptions).length ? `<ul>${stability.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}` : ''}</li>`;
    }).join('')}</ul></details>` : '';
    return `<section class="measured-output" aria-labelledby="measured-title"><h3 id="measured-title">Measured native output</h3><p>${rate(measured.minutes)} minutes measured${measured.warmupMinutes !== null ? ` after ${rate(measured.warmupMinutes)} minutes of warmup` : ''}. ${measured.throughputPassed ? randomRows.length ? 'Native rate checks passed; random-yield rates are sampled estimates.' : 'Steady production check passed.' : 'Observed collection during this run.'}</p><table class="measured-rates"><thead><tr><th scope="col">Output</th><th scope="col">Collected</th><th scope="col">Measured rate</th></tr></thead><tbody>${results}</tbody></table>${randomDetails}<p class="measurement-basis">${esc(measured.rateBasis || 'Physical output collected from the saved blueprint during the native test; calculated targets are shown separately.')}</p></section>`;
  }
  function showDetails(id) {
    const factory = factories.get(id); if (!factory) return;
    const e = evidence(factory, data.profile), output = products(factory)[0], preview = localPath(factory.blueprint?.preview), blueprintPath = downloadable(factory) ? localPath(factory.blueprint?.path) : '', planPath = localPath(factory.planPath);
    const panels = new Map(M.array(factory.blueprint?.entities).filter(p => p.name === 'display-panel').map(p => [p.entity_number, p]));
    const geometry = preview ? '' : schematic(factory), source = factory.source || {}, sourceLink = sourceUrl(source.url);
    const notes = [...factory.notes, ...M.array(factory.assumptions), ...M.array(factory.warnings)];
    const dialog = $('#factory-detail');
    dialog.innerHTML = `<div class="detail-head"><div><span class="variant">${esc(boundary(factory))}</span><h2 id="detail-title">${esc(factory.name)}</h2>${badge(factory)}</div><button data-action="close" aria-label="Close factory details">Close ×</button></div><div class="detail-body"><div class="detail-evidence ${e.id}">${esc(e.detail)}${e.id === 'native-tested' ? `<br><a href="${esc(localPath(factory.validation.reportPath))}" target="_blank" rel="noopener">Read matching native production report ↗</a>` : e.id === 'native-failed' ? `${localPath(factory.validation.reportPath) ? `<br><a href="${esc(localPath(factory.validation.reportPath))}" target="_blank" rel="noopener">Read failed native production report ↗</a>` : ''}<ul>${M.array(factory.validation.failures).map(failure => `<li>${esc(failure)}</li>`).join('')}</ul>` : ''}${localPath(factory.source?.diagnosticsPath) ? `<br><a href="${esc(localPath(factory.source.diagnosticsPath))}" target="_blank" rel="noopener">Evidence history ↗</a>` : ''}</div><figure class="preview">${preview ? `<img src="${esc(preview)}" alt="${esc(factory.name)}: blueprint schematic with display panels at its labeled inputs">` : geometry || flow(factory)}<figcaption>${preview || geometry ? 'Saved blueprint layout · Match each display-panel icon and label to the feed listed below.' : 'Calculated recipe flow · A physical layout has not been published.'}${preview ? `<a href="${esc(preview)}" target="_blank" rel="noopener">Open full-size preview ↗</a>` : ''}</figcaption></figure><div class="detail-target">${icon(output)}<div><small>Calculated output target · ${esc(name(output))}</small><strong>${rate(factory.outputPerMinute)} ${units(items.get(output)?.type)}</strong></div></div>${measuredOutputs(factory)}<p class="detail-note">Rates and machine counts below are calculated recipe requirements. Native production evidence, when present, applies to the exact saved blueprint; it does not turn these targets into measured throughput.</p><div class="detail-grid"><section><h3>Labeled inputs</h3><p class="detail-note input-basis">Feeds below support the calculated target of <strong>${rate(factory.outputPerMinute)} ${units(items.get(output)?.type)} of ${esc(name(output))}</strong>. They are not measured consumption at the native test rate. Match each display panel to its belt, chest, or pipe.</p><table class="input-rates"><thead><tr><th scope="col">Material &amp; display panel</th><th scope="col">Calculated feed</th></tr></thead><tbody>${factory.inputs.map(input => {
      const panel = panels.get(input.displayEntity), label = panelText(panel?.text || input.label), displayIndex = [...panels.keys()].indexOf(input.displayEntity) + 1;
      return `<tr data-input="${esc(input.id)}"${Number.isInteger(input.displayEntity) ? ` data-display-entity="${input.displayEntity}"` : ''}><td><span class="input-name">${icon(input.id)}${esc(name(input.id))}</span><span class="input-label ${label ? '' : 'missing'}">${label ? esc(label) : 'Display label not published'}${displayIndex ? ` · Display ${displayIndex}` : ''}</span></td><td>${rate(input.perMinute)}<small>${units(typeOf(input))}</small></td></tr>`;
    }).join('') || '<tr><td colspan="2">No external feeds listed. Check the plan assumptions.</td></tr>'}</tbody></table></section><section><h3>Recipe &amp; machine balance</h3><table class="machine-balance"><thead><tr><th scope="col">Recipe / machine</th><th scope="col">Machines</th></tr></thead><tbody>${factory.steps.map(step => `<tr><td>${esc(step.recipe)}<small>${esc(name(step.machine))}${Number.isFinite(step.utilization) ? ` · ${rate(step.utilization * 100)}% utilization` : ''}</small></td><td>${rate(step.count)}</td></tr>`).join('') || '<tr><td colspan="2">Machine balance not published.</td></tr>'}</tbody></table>${factory.reason ? `<p class="detail-note">${esc(factory.reason)}</p>` : ''}${notes.length ? `<h3>Setup &amp; assumptions</h3><ul class="notes">${notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}</section></div>${factory.blueprint?.sha256 ? `<details><summary>Blueprint SHA-256</summary><p class="hash">${esc(factory.blueprint.sha256)}</p></details>` : ''}<div class="detail-footer">${blueprintPath ? `<a class="button" href="${esc(blueprintPath)}" download>Download blueprint (.txt)</a>` : `<p class="detail-note">${e.id === 'native-failed' ? 'Blueprint download withheld after a failed native production test.' : 'No downloadable blueprint has been published for this variant.'}</p>`}${planPath ? `<a class="button secondary" href="${esc(planPath)}" download>Download calculated plan (.json)</a>` : ''}</div><p class="source">Source: ${sourceLink ? `<a href="${esc(sourceLink)}" target="_blank" rel="noopener">${esc(source.name || 'Original source')}</a>` : esc(source.name || 'Attribution awaiting publication')}${source.author ? ` · ${esc(source.author)}` : ''}</p></div>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function navigate() {
    const hash = location.hash.slice(1);
    if (hash.startsWith('factory=')) {
      try { const id = decodeURIComponent(hash.slice(8)); if (factories.has(id)) { showDetails(id); return; } } catch { /* Ignore an invalid link. */ }
    }
    if ($('#factory-detail').open) $('#factory-detail').close();
    state.view = ['coverage', 'profile'].includes(hash) ? hash : 'factories'; state.limit = 30; render();
  }
  function clearFilters() {
    state.query = ''; state.variant = 'all'; state.status = 'all'; state.limit = 30;
    $('#flight-search').value = ''; $('#flight-variant').value = 'all'; $('#flight-evidence').value = 'all'; render(); $('#flight-search').focus();
  }
  $('#flight-search').addEventListener('input', event => { state.query = event.target.value; state.limit = 30; render(); });
  $('#flight-variant').addEventListener('change', event => { state.variant = event.target.value; state.limit = 30; render(); });
  $('#flight-evidence').addEventListener('change', event => { state.status = event.target.value; state.limit = 30; render(); });
  $('#load-more').addEventListener('click', () => { state.limit += 30; render(); });
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') $('#factory-detail').close();
    if (action === 'clear') clearFilters();
  });
  $('#factory-detail').addEventListener('close', () => { if (location.hash.startsWith('#factory=')) history.replaceState(null, '', '#' + state.view); });
  window.addEventListener('hashchange', navigate);
  summary(); render(); navigate();
})();
