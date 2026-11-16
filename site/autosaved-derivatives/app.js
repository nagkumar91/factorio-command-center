(() => {
  'use strict';
  const data = globalThis.AutosavedDerivatives;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const rate = value => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const names = values => values.length ? values.map(escape).join(', ') : 'None recorded';
  const results = document.querySelector('#results');
  const toast = message => {
    const node = document.querySelector('#toast');
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2400);
  };
  if (!data || !Array.isArray(data.entries)) {
    results.innerHTML = '<p class="empty">The local redesign index could not be loaded.</p>';
    return;
  }
  document.querySelector('#progress-count').textContent = `${data.integratedValidatedCount} / ${data.recipeBearingSourceCount}`;
  document.querySelector('#progress-caption').textContent = `${data.nativeValidatedCount} native-tested · ${data.integratedValidatedCount} with labeled inputs · ${data.inputDisplayRevisionCount} need label revisions`;
  document.querySelector('#result-count').textContent = `${data.entries.length} blueprint${data.entries.length === 1 ? '' : 's'}`;
  results.innerHTML = data.entries.map(entry => `
    <article class="redesign-card" data-source-id="${escape(entry.id)}">
      <div class="redesign-art"><img src="${escape(entry.previewFile)}" alt="Blueprint layout preview for ${escape(entry.name)}" loading="lazy"></div>
      <div class="redesign-content">
        <div class="redesign-title"><h3>${escape(entry.name)}</h3><span class="status-pill ${entry.inputDisplayRevisionRequired ? 'revision-required' : ''}">${entry.inputDisplayRevisionRequired ? 'Input labels pending' : entry.sourceMatchedComparison ? 'Native paired · no modules' : 'Native measured · no modules'}</span></div>
        <p class="redesign-meta">${escape(entry.category)} · ${escape(entry.section)} · ${escape(entry.runtimeVersion)} · ${entry.warmupMinutes} min warmup + ${entry.measuredMinutes} min measured</p>
        ${entry.inputDisplayRevisionRequired ? `<p class="evidence-note">Native test passed for this version; input display labels are missing for ${names(entry.missingInputDisplays)}. A labeled revision and exact-hash retest are pending.</p>` : ''}
        <div class="redesign-spec">
          <section><h4>Outside inputs</h4><p>${names(entry.inputs)}</p></section>
          <section><h4>Recipe products</h4><p>${names(entry.outputs)}</p></section>
        </div>
        ${entry.ports?.length ? `<section class="physical-ports"><h4>Physical port map</h4><ul>${entry.ports.map(port => `<li><strong>${escape(port.role)}</strong> · ${escape(port.material)} · ${escape(port.side)} side at (${rate(port.position.x)}, ${rate(port.position.y)})${port.connectionPosition ? ` · connect at (${rate(port.connectionPosition.x)}, ${rate(port.connectionPosition.y)})` : ''}${port.lanes ? ` · ${escape(port.lanes)}` : ''}</li>`).join('')}</ul></section>` : ''}
        <ul class="rate-list">${entry.products.map(product => `<li><span>${escape(product.item)}${Number.isFinite(product.sourceToCandidateRateRatio) ? ` · ${rate(product.sourceToCandidateRateRatio * 100)}% of source` : ' · candidate-only measurement'}</span><strong>${rate(product.candidateItemsPerMinute)}/min</strong></li>`).join('')}</ul>
        <p class="card-footprint">Footprint: ${entry.sourceAreaTiles} → ${entry.candidateAreaTiles} tiles (${entry.areaDeltaTiles} tiles). Source had ${entry.sourceModuleRequests} module requests; candidate has 0.</p>
        ${entry.sourceFixtureNote ? `<p class="evidence-note">Comparison limit: ${escape(entry.sourceFixtureNote)}</p>` : ''}
        <div class="card-actions"><a class="primary" href="${escape(entry.blueprintFile)}" download>Download blueprint</a><button type="button" data-copy="${escape(entry.id)}">Copy blueprint string</button><a href="${escape(entry.evidenceFile)}" target="_blank" rel="noreferrer">Native report</a><a href="${escape(entry.sourceUrl)}" target="_blank" rel="noreferrer">Original source</a></div>
        ${entry.evidenceLinks?.length ? `<details class="evidence-links"><summary>Source, candidate, route and lane evidence</summary><ul>${entry.evidenceLinks.map(link => `<li><a href="${escape(link.file)}" target="_blank" rel="noreferrer">${escape(link.label)}</a></li>`).join('')}</ul></details>` : ''}
        <details class="hash-details"><summary>Source and candidate hashes</summary><code>Source · ${escape(entry.sourceBlueprintSha256)}</code><code>Candidate · ${escape(entry.candidateBlueprintSha256)}</code></details>
      </div>
    </article>`).join('');
  results.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    try {
      const entry = data.entries.find(item => item.id === button.dataset.copy);
      if (!entry) throw new Error('missing blueprint');
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(entry.blueprintCode);
      else {
        const input = document.createElement('textarea');
        input.value = entry.blueprintCode;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('clipboard unavailable');
      }
      toast('Blueprint string copied');
    } catch {
      toast('Use Download blueprint to save the offline string');
    }
  });
})();
