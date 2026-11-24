/**
 * dashboard/public/js/core/sseShare.js
 * One real /api/events stream per page. Browsers allow ~6 HTTP/1.1 connections per host for ALL tabs, and every
 * EventSource holds one forever: app.js, the Runner slice (each visit) and the Mobile view each opened their own,
 * so 3 tabs used all 6 and a 3rd tab could not even call /api/health. This classic script (loaded before app.js)
 * hands every `new EventSource('/api/events')` a lightweight proxy fed by one shared real stream, and re-emits
 * each parsed event on window as CustomEvent "qa-studio:sse" ({detail: event}) for modules that only listen.
 * Other URLs and browsers without EventSource are untouched. Strict ceiling <= 150 lines.
 */
(function(win) {
  const Native = win && win.EventSource;
  if (!Native || Native.__shared) return;
  const shared = new Map(); // key -> { source, proxies:Set, bound:Set(types) }
  const LIVE = ['message', 'open', 'error'];

  function entryFor(key, url, init) {
    let entry = shared.get(key);
    if (entry) return entry;
    entry = { source: new Native(url, init), proxies: new Set(), bound: new Set() };
    shared.set(key, entry);
    bind(entry, 'message');
    bind(entry, 'open');
    bind(entry, 'error');
    return entry;
  }

  function bind(entry, type) {
    if (entry.bound.has(type)) return;
    entry.bound.add(type);
    entry.source.addEventListener(type, (event) => {
      if (type === 'message') {
        try { win.dispatchEvent(new CustomEvent('qa-studio:sse', { detail: JSON.parse(event.data) })); } catch (_) { /* not JSON: log lines etc. */ }
      }
      entry.proxies.forEach((proxy) => proxy.__deliver(type, event));
    });
  }

  function SharedEventSource(url, init) {
    const href = new URL(String(url), win.location.href);
    if (href.pathname !== '/api/events' || href.origin !== win.location.origin) return new Native(url, init);
    const key = `${href.href}|${Boolean(init && init.withCredentials)}`;
    const entry = entryFor(key, url, init);
    const listeners = new Map();
    const proxy = Object.create(Native.prototype);
    Object.defineProperties(proxy, {
      url: { value: entry.source.url }, withCredentials: { value: entry.source.withCredentials },
      readyState: { get: () => (proxy.__closed ? 2 : entry.source.readyState) },
    });
    // own data properties: assigning would otherwise hit the NATIVE accessors of the prototype (Illegal invocation)
    ['onmessage', 'onopen', 'onerror'].forEach((name) => Object.defineProperty(proxy, name, { value: null, writable: true, enumerable: true, configurable: true }));
    Object.defineProperty(proxy, '__closed', { value: false, writable: true });
    proxy.__deliver = (type, event) => {
      if (proxy.__closed) return;
      const handler = proxy[`on${type}`];
      if (typeof handler === 'function') handler.call(proxy, event);
      (listeners.get(type) || []).forEach((fn) => { if (typeof fn === 'function') fn.call(proxy, event); else if (fn && fn.handleEvent) fn.handleEvent(event); });
    };
    proxy.addEventListener = (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      if (!LIVE.includes(type)) bind(entry, type);
    };
    proxy.removeEventListener = (type, fn) => { if (listeners.has(type)) listeners.get(type).delete(fn); };
    proxy.close = () => {
      if (proxy.__closed) return;
      proxy.__closed = true;
      entry.proxies.delete(proxy);
      if (!entry.proxies.size) { entry.source.close(); shared.delete(key); }
    };
    entry.proxies.add(proxy);
    return proxy;
  }

  SharedEventSource.prototype = Native.prototype;
  ['CONNECTING', 'OPEN', 'CLOSED'].forEach((name) => { SharedEventSource[name] = Native[name]; });
  SharedEventSource.__shared = true;
  win.EventSource = SharedEventSource;
})(typeof window === 'undefined' ? undefined : window);
