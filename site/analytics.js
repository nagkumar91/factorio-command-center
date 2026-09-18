(() => {
  'use strict';
  const config = globalThis.FactorioAnalyticsConfig || {};
  const routes = new Set(['commands', 'crates', 'blueprints', 'coverage', 'production', 'files', 'setup']);
  const events = new Set(['page_view', 'blueprint_open', 'blueprint_copy', 'construction_crate', 'command_view', 'command_copy', 'crate_generate', 'crate_pack', 'production_plan', 'product_view', 'plan_export', 'loadout_export', 'source_download', 'search_used']);
  const fields = new Set(['command-search', 'item-search', 'blueprint-search', 'coverage-search', 'file-search', 'production-item']);
  const data = globalThis.FactorioData || {};
  const sources = new Set([...(data.library?.files || []).map(f => f.url), ...[...(data.library?.blueprints || []), ...(data.community?.blueprints || []), ...(data.atlas?.blueprints || [])].flatMap(b => b.sources || []), ...(data.atlas?.sources || []).map(s => 'sources/collections/' + s.id + '.txt'), 'sources/Autosaved/AllBlueprints.txt']);
  const keys = { preference: 'factorio-analytics-opt-out', visitor: 'factorio-analytics-visitor', session: 'factorio-analytics-session' };
  const read = (storage, key) => { try { return globalThis[storage].getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { if (value === null) globalThis[storage].removeItem(key); else globalThis[storage].setItem(key, value); } catch {} };
  const parse = value => { try { return JSON.parse(value); } catch { return null; } };
  const uuid = () => [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
  const route = () => routes.has(location.hash.slice(1)) ? location.hash.slice(1) : 'commands';
  const supported = ['https:', 'http:'].includes(location.protocol) && config.origins?.includes(location.origin) && Boolean(config.endpoint) && Boolean(globalThis.crypto?.getRandomValues);
  let optedOut = read('localStorage', keys.preference) === '1';
  let visitor, session, queue = [], timer, lastPage = '', lastPageAt = 0;
  const searches = new Set();
  const device = innerWidth < 600 ? 'mobile' : innerWidth < 1000 ? 'tablet' : 'desktop';
  let referrer = '';
  try { const url = new URL(document.referrer); if (url.origin !== location.origin) referrer = url.hostname; } catch {}
  function status() {
    const privacySignal = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    return { enabled: Boolean(supported && !privacySignal && !optedOut), supported: Boolean(supported), privacySignal, optedOut };
  }
  function identity() {
    const now = Date.now();
    visitor ||= parse(read('localStorage', keys.visitor));
    if (!visitor || !/^[a-f0-9]{32}$/.test(visitor.id) || !(visitor.expires > now)) {
      visitor = { id: uuid(), expires: now + 30 * 86400000 };
      write('localStorage', keys.visitor, JSON.stringify(visitor));
    }
    session ||= parse(read('sessionStorage', keys.session));
    if (!session || !/^[a-f0-9]{32}$/.test(session.id) || !(session.last > now - 30 * 60000)) session = { id: uuid() };
    session.last = now;
    write('sessionStorage', keys.session, JSON.stringify(session));
    return { visitor: visitor.id, session: session.id };
  }
  function track(event, target = '') {
    if (!status().enabled || !events.has(event) || typeof target !== 'string') return;
    try {
      const ids = identity();
      queue.push({ ...ids, event: { id: uuid(), event, route: route(), target } });
      if (queue.length > 100) queue.shift();
      if (!timer) timer = setTimeout(flush, 1000);
    } catch { /* Analytics must never interrupt the toolkit. */ }
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!status().enabled) { queue = []; return; }
    // Keep each batch within one visitor/session, including after an idle timeout.
    while (queue.length) {
      const first = queue.shift(), batch = [first.event];
      while (queue.length && batch.length < 20 && queue[0].visitor === first.visitor && queue[0].session === first.session) batch.push(queue.shift().event);
      const payload = JSON.stringify({ version: 1, visitor: first.visitor, session: first.session, device, referrer, events: batch });
      try {
        const result = fetch(config.endpoint, { method: 'POST', mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain' }, body: payload, keepalive: true });
        result.catch(() => {});
      } catch {}
    }
  }
  function pageView() {
    if (document.visibilityState === 'hidden' || document.prerendering || !status().enabled) return;
    const next = route(), now = Date.now();
    if (lastPage === next && now - lastPageAt < 1000) return;
    lastPage = next; lastPageAt = now; track('page_view');
  }
  function setEnabled(enabled) {
    optedOut = !enabled;
    write('localStorage', keys.preference, optedOut ? '1' : null);
    if (optedOut) {
      queue = []; visitor = session = null; clearTimeout(timer); timer = null;
      write('localStorage', keys.visitor, null); write('sessionStorage', keys.session, null);
    } else pageView();
    return status();
  }
  globalThis.FactorioAnalytics = { track, flush, status, setEnabled };
  addEventListener('storage', event => { if (event.key === keys.preference || event.key === null) { optedOut = read('localStorage', keys.preference) === '1'; if (optedOut) { queue = []; visitor = session = null; } } });
  addEventListener('hashchange', pageView);
  addEventListener('pagehide', flush);
  addEventListener('pageshow', event => { if (event.persisted) pageView(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  if (document.prerendering) document.addEventListener('prerenderingchange', pageView, { once: true });
  document.addEventListener('DOMContentLoaded', () => {
    if (document.visibilityState === 'hidden') document.addEventListener('visibilitychange', pageView, { once: true });
    else pageView();
  }, { once: true });
  document.addEventListener('input', event => {
    const id = event.target.id;
    // Only the field name is recorded, once per field per visit. Never its text.
    if (fields.has(id) && event.target.value?.trim() && !searches.has(id)) { searches.add(id); track('search_used', id); }
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    const url = link?.getAttribute('href');
    if (url?.startsWith('sources/') && sources.has(url) && !url.includes('?') && !url.includes('#')) track('source_download', url);
  });
})();
