/* Shared, dependency-free catalogue rules. Classic scripts also work over file://. */
(function (root) {
  'use strict';
  const variants = {raw: 'Raw materials', mixed: 'Mixed inputs', intermediate: 'Intermediate parts'};
  const array = value => Array.isArray(value) ? value : [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
  const variant = value => value === 'intermediary' ? 'intermediate' : value;
  function localPath(value) {
    if (typeof value !== 'string' || !value || /[\\\u0000-\u0020?#:]/.test(value) || value.startsWith('/')) return '';
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { return ''; }
    if (/[\\\u0000-\u0020?#:]/.test(decoded) || decoded.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) return '';
    return value;
  }
  function sourceUrl(value) {
    if (localPath(value)) return value;
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  function products(factory) {
    return [...new Set([factory.product, ...array(factory.products).map(p => typeof p === 'string' ? p : p?.id)].filter(p => typeof p === 'string' && p))];
  }
  function downloadable(factory) { return factory.validation?.status !== 'native-failed' && Boolean(localPath(factory.blueprint?.path)); }
  function evidence(factory, profile = {}) {
    const blueprint = factory.blueprint || {}, validation = factory.validation || {};
    if (validation.status === 'native-failed') return {id: 'native-failed', label: 'Native test failed · download withheld', detail: 'This saved layout failed its native production test. Its blueprint download is withheld; calculated recipe targets are retained for inspection.'};
    const requested = validation.status === 'native-tested';
    const hashMatches = sha(blueprint.sha256) && sha(validation.blueprintSha256) && blueprint.sha256.toLowerCase() === validation.blueprintSha256.toLowerCase();
    const profileMatches = !profile.prototypeSha256 || validation.prototypeSha256 === profile.prototypeSha256;
    if (requested && validation.passed === true && hashMatches && profileMatches && downloadable(factory) && localPath(validation.reportPath)) {
      return {id: 'native-tested', label: 'Native tested · SHA matched', detail: 'A passing native production report matches this blueprint' + (profile.prototypeSha256 ? ' and the published mod profile.' : '.')};
    }
    if (requested) return {id: 'unverified', label: 'Native evidence unverified', detail: 'The report, passing result, blueprint SHA-256, or mod profile does not match. This build is not counted as native tested.'};
    if (factory.status === 'unavailable' || factory.status === 'blocked') return {id: 'unavailable', label: 'Plan unavailable', detail: factory.reason || 'No supported production plan is available for this variant.'};
    return {id: 'calculated', label: 'Calculated · not native tested', detail: 'Recipe ratios and machine counts are calculated. In-game production and transport throughput have not been verified.'};
  }
  function normalize(data) {
    if (!data || data.schemaVersion !== 1) throw new Error('This flight catalogue needs schema version 1.');
    const profile = data.profile || {};
    const items = array(data.items).filter(i => i && typeof i.id === 'string').map(i => ({...i, name: i.name || i.id, type: i.type || 'item'}));
    const materials = array(data.materials).filter(i => i && typeof i.id === 'string').map(i => ({...i, name: i.name || i.id, type: i.type || 'item'}));
    const factories = array(data.factories).filter(f => f && typeof f.id === 'string').map(f => ({...f, name: f.name || f.id, variant: variant(f.variant), inputs: array(f.inputs), steps: array(f.steps), notes: array(f.notes)}));
    return {schemaVersion: 1, profile, items, materials, factories, generatedAt: data.generatedAt};
  }
  function coverage(data) {
    const links = new Map(data.items.map(item => [item.id, []]));
    for (const factory of data.factories) {
      if (['unavailable', 'blocked'].includes(factory.status)) continue;
      for (const id of products(factory)) if (links.has(id)) links.get(id).push(factory);
    }
    const rows = data.items.map(item => {
      const builds = links.get(item.id);
      return {...item, builds, downloadable: builds.some(downloadable), tested: builds.some(f => evidence(f, data.profile).id === 'native-tested')};
    });
    return {rows, total: rows.length, planned: rows.filter(r => r.builds.length).length, downloadable: rows.filter(r => r.downloadable).length, tested: rows.filter(r => r.tested).length};
  }
  function matches(text, query) {
    const haystack = String(text).toLowerCase().replaceAll('-', ' ');
    return String(query).trim().toLowerCase().replaceAll('-', ' ').split(/\s+/).every(word => haystack.includes(word));
  }
  function filterFactories(data, {query = '', variant: boundary = 'all', status = 'all'} = {}) {
    const items = new Map([...array(data.materials), ...data.items].map(i => [i.id, i]));
    return data.factories.filter(factory => {
      const state = evidence(factory, data.profile).id;
      return (boundary === 'all' || factory.variant === boundary) &&
        (status === 'all' || (status === 'downloadable' ? downloadable(factory) : status === state)) &&
        matches([factory.id, factory.name, factory.variant, ...products(factory).flatMap(id => [id, items.get(id)?.name]), ...factory.inputs.flatMap(i => [i.id, i.label, items.get(i.id)?.name])].join(' '), query);
    });
  }
  function formatRate(value) {
    if (!Number.isFinite(value) || value < 0) return '—';
    return value > 0 && value < .01 ? '<0.01' : new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(value);
  }
  function measurement(factory, profile) {
    if (evidence(factory, profile).id !== 'native-tested') return null;
    const v = factory.validation;
    const minutes = v.measuredMinutes ?? (v.measurementTicks / 3600);
    const warmupMinutes = v.warmupMinutes ?? (v.warmupTicks / 3600);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    const outputs = Array.isArray(v.outputs) ? v.outputs : Object.entries(v.outputs || {}).map(([key, row]) => {
      const separator = key.indexOf(':');
      return {...row, type: key.slice(0, separator), id: key.slice(separator + 1)};
    });
    const rows = outputs.filter(row => typeof row.id === 'string' && row.id && ['item', 'fluid'].includes(row.type) &&
      Number.isFinite(row.collected) && row.collected >= 0 && Number.isFinite(row.perMinute) && row.perMinute >= 0 &&
      Math.abs(row.collected / minutes - row.perMinute) <= Math.max(1e-8, row.perMinute * 1e-8));
    if (!rows.length) return null;
    return {minutes, warmupMinutes: Number.isFinite(warmupMinutes) && warmupMinutes >= 0 ? warmupMinutes : null, rows, rateBasis: v.rateBasis, throughputPassed: v.throughputPassed === true};
  }
  function randomYieldEvidence(row) {
    if (row.stabilityMethod !== 'conditional-poisson') return null;
    const ci = row.rateConfidenceInterval, test = row.stabilityTest;
    const interval = ci && Number.isFinite(ci.confidence) && ci.confidence > 0 && ci.confidence < 1 &&
      Number.isFinite(ci.lowerPerMinute) && ci.lowerPerMinute >= 0 && Number.isFinite(ci.upperPerMinute) && ci.upperPerMinute >= ci.lowerPerMinute ? ci : null;
    const stability = test && Number.isFinite(test.alpha) && test.alpha > 0 && test.alpha < 1 &&
      Number.isFinite(test.pValue) && test.pValue >= 0 && test.pValue <= 1 && typeof test.accepted === 'boolean' ? test : null;
    return {interval, stability};
  }
  root.FlightFactories = {variants, array, esc, sha, variant, localPath, sourceUrl, products, downloadable, evidence, normalize, coverage, matches, filterFactories, formatRate, measurement, randomYieldEvidence};
})(globalThis);
