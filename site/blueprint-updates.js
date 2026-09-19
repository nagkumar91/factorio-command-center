(() => {
  'use strict';

  const INDEX_URLS = ['data/transport-workshops/index.json', 'data/science-factories/index.json', 'data/early-game/index.json', 'data/power-workshops/index.json'];
  const POLL_MS = 30_000;
  const HEX = /^[a-f0-9]{16,}$/i;

  let started = false;
  let polling = false;
  let applyRecords;
  let pending = new Map();
  const cache = new Map();

  function offline() {
    return location.protocol === 'file:' || typeof globalThis.fetch !== 'function';
  }

  function validEntry(entry) {
    return entry && typeof entry.id === 'string' && entry.id &&
      typeof entry.revision === 'string' && HEX.test(entry.revision) &&
      typeof entry.url === 'string' && entry.url;
  }

  function readManifest(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.blueprints)) return [];
    const entries = new Map();
    for (const entry of data.blueprints) {
      if (validEntry(entry)) entries.set(entry.id, entry);
    }
    return [...entries.values()];
  }

  function sameOrigin(url) {
    try { return new URL(url, document.baseURI).origin === location.origin; }
    catch { return false; }
  }

  function validRecord(record, id) {
    const analysis = record?.analysis;
    return record && typeof record === 'object' && record.id === id &&
      typeof record.name === 'string' && record.name &&
      typeof record.code === 'string' && record.code &&
      Array.isArray(record.entries) && Array.isArray(record.excluded) &&
      Array.isArray(record.icons) && Array.isArray(record.sources) &&
      Number.isFinite(record.entityCount) &&
      analysis && typeof analysis === 'object' &&
      typeof analysis.kind === 'string' &&
      Array.isArray(analysis.inputs) && Array.isArray(analysis.outputs) &&
      Array.isArray(analysis.internal) && Array.isArray(analysis.seeds) &&
      Array.isArray(analysis.recipes) && Array.isArray(analysis.missing) &&
      Array.isArray(analysis.serviceInputs) && Array.isArray(analysis.serviceOutputs) &&
      Array.isArray(analysis.notes);
  }

  function addStyles() {
    if (document.getElementById('blueprint-updates-style')) return;
    const style = document.createElement('style');
    style.id = 'blueprint-updates-style';
    style.textContent = `
      #blueprint-updates-action {
        position: fixed;
        z-index: 90;
        top: 67px;
        right: 20px;
        border: 1px solid #8f7548;
        border-radius: 999px;
        padding: 8px 13px;
        background: #3b3427;
        color: #f0d59a;
        box-shadow: 0 6px 24px #0007;
        font: 11px Lato, sans-serif;
        cursor: pointer;
      }
      #blueprint-updates-action:hover,
      #blueprint-updates-action:focus-visible { background: #51432c; color: #ffe6aa; }
      #blueprint-updates-action[hidden] { display: none; }
      @media (max-width: 640px) {
        #blueprint-updates-action { top: 65px; right: 12px; left: 12px; width: auto; }
      }
    `;
    document.head.append(style);
  }

  function updateAction() {
    const button = document.getElementById('blueprint-updates-action');
    if (!button) return;
    const count = pending.size;
    button.hidden = !count;
    button.textContent = count === 1 ? 'Blueprint update available' : `Blueprint updates available (${count})`;
    button.setAttribute('aria-label', count === 1 ? 'Apply one blueprint update' : `Apply ${count} blueprint updates`);
  }

  function installAction() {
    addStyles();
    let button = document.getElementById('blueprint-updates-action');
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'blueprint-updates-action';
    button.hidden = true;
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', async () => {
      if (!pending.size || button.disabled) return;
      const records = [...pending.entries()];
      button.disabled = true;
      try {
        await applyRecords(records.map(([, record]) => record));
        for (const [id, record] of records) {
          if (pending.get(id) === record) pending.delete(id);
          const current = cache.get(id);
          if (current?.record === record) current.applied = true;
        }
      } catch {
        // Keep the action available if the host could not merge the records.
      } finally {
        button.disabled = false;
        updateAction();
      }
    });
    document.body.append(button);
    return button;
  }

  async function json(url, cache = 'no-store') {
    const response = await fetch(url, { cache, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Blueprint update request failed: ${response.status}`);
    return response.json();
  }

  async function fetchRecords(entries) {
    const results = await Promise.allSettled(entries.map(async entry => {
      const url = new URL(entry.url, document.baseURI);
      if (!sameOrigin(url.href)) throw new Error('Blueprint update URL is outside this site');
      const record = await json(url.href, 'force-cache');
      if (!validRecord(record, entry.id)) throw new Error('Invalid blueprint update record');
      return { entry, record };
    }));
    return results.filter(result => result.status === 'fulfilled').map(result => result.value);
  }

  async function poll(initial = false) {
    if (polling || offline()) return;
    polling = true;
    try {
      const indexes = await Promise.allSettled(INDEX_URLS.map(url => json(new URL(url, document.baseURI).href, 'no-store')));
      const manifest = indexes.flatMap(result => result.status === 'fulfilled' ? readManifest(result.value) : []);
      const changed = manifest.filter(entry => cache.get(entry.id)?.revision !== entry.revision);
      if (!changed.length) return;
      const fetched = await fetchRecords(changed);
      if (!fetched.length) return;
      if (initial) {
        await applyRecords(fetched.map(({ record }) => record));
        for (const { entry, record } of fetched) cache.set(entry.id, { revision: entry.revision, record, applied: true });
      } else {
        for (const { entry, record } of fetched) {
          cache.set(entry.id, { revision: entry.revision, record, applied: false });
          pending.set(entry.id, record);
        }
        updateAction();
      }
    } catch {
      // Offline copies and transient publish failures keep their bundled data.
    } finally {
      polling = false;
    }
  }

  function start(options = {}) {
    if (started || offline() || typeof options.applyRecords !== 'function') return;
    started = true;
    applyRecords = options.applyRecords;
    for (const record of options.blueprints || []) {
      if (typeof record.publicationRevision === 'string' && HEX.test(record.publicationRevision)) {
        cache.set(record.id, {revision: record.publicationRevision, record, applied: true});
      }
    }
    installAction();
    void poll(true);
    setInterval(() => void poll(false), POLL_MS);
    window.addEventListener('focus', () => void poll(false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void poll(false);
    });
  }

  globalThis.FactorioBlueprintUpdates = { start };
})();
