(function () {
  var DEFAULT_BRIDGE = 'http://127.0.0.1:37891';
  var ORIGIN_KEY = 'localStorage.mineradio.bridgeOrigin';
  var TOKEN_KEY = 'localStorage.mineradio.bridgeToken';
  var legacyOriginKey = 'mineradio.bridgeOrigin';
  var legacyTokenKey = 'mineradio.bridgeToken';

  function readStorage(key, fallbackKey) {
    try {
      return localStorage.getItem(key) || (fallbackKey ? localStorage.getItem(fallbackKey) : '') || '';
    } catch (_) { return ''; }
  }
  function writeStorage(key, value, fallbackKey) {
    try {
      if (value) localStorage.setItem(key, value);
      if (fallbackKey && value) localStorage.setItem(fallbackKey, value);
    } catch (_) {}
  }
  function normalizeBridgeOrigin(value) {
    value = String(value || '').trim();
    if (!value) return DEFAULT_BRIDGE;
    try {
      var u = new URL(value);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return DEFAULT_BRIDGE;
      if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return DEFAULT_BRIDGE;
      return u.origin;
    } catch (_) {
      return DEFAULT_BRIDGE;
    }
  }
  function queryParams() {
    try { return new URLSearchParams(location.search || ''); }
    catch (_) { return new URLSearchParams(); }
  }

  var params = queryParams();
  var bridgeOrigin = normalizeBridgeOrigin(params.get('bridge') || readStorage(ORIGIN_KEY, legacyOriginKey));
  var bridgeToken = String(params.get('token') || readStorage(TOKEN_KEY, legacyTokenKey) || '').trim();
  writeStorage(ORIGIN_KEY, bridgeOrigin, legacyOriginKey);
  if (bridgeToken) writeStorage(TOKEN_KEY, bridgeToken, legacyTokenKey);

  var state = {
    bridgeOrigin: bridgeOrigin,
    bridgeToken: bridgeToken,
    connected: false,
    authenticated: false,
    enterAllowed: false,
    checking: false,
    lastError: '',
    health: null,
  };

  function bridgeUrl(path) {
    var url = new URL(path, state.bridgeOrigin);
    return url.toString();
  }
  function pairUrl() {
    var url = new URL('/pair', state.bridgeOrigin);
    try { url.searchParams.set('return', location.href.split('#')[0]); } catch (_) {}
    return url.toString();
  }
  function escapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function withToken(path) {
    var url = new URL(path, state.bridgeOrigin);
    if (state.bridgeToken && !url.searchParams.has('token')) url.searchParams.set('token', state.bridgeToken);
    return url.toString();
  }
  function resolveApiUrl(url) {
    var raw = String(url || '');
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.charAt(0) === '/') return bridgeUrl(raw);
    return raw;
  }
  function authorizeFetch(url, opts) {
    opts = Object.assign({}, opts || {});
    var raw = String(url || '');
    var resolved = resolveApiUrl(raw);
    try {
      var u = new URL(resolved);
      var isBridge = u.origin === state.bridgeOrigin;
      if (isBridge && state.bridgeToken) {
        if (u.pathname === '/api/audio' || u.pathname === '/api/cover') {
          u.searchParams.set('token', state.bridgeToken);
          resolved = u.toString();
        } else {
          var headers = new Headers(opts.headers || {});
          headers.set('X-Mineradio-Token', state.bridgeToken);
          opts.headers = headers;
        }
      }
    } catch (_) {}
    return { url: resolved, opts: opts };
  }
  async function verifyBridgeAuth() {
    if (!state.bridgeToken) {
      state.authenticated = false;
      state.enterAllowed = false;
      return false;
    }
    try {
      var auth = authorizeFetch('/auth', { cache: 'no-store' });
      var res = await fetch(auth.url, auth.opts);
      if (!res.ok) {
        state.authenticated = false;
        state.enterAllowed = false;
        return false;
      }
      var json = await res.json().catch(function () { return null; });
      state.authenticated = !!(json && json.ok && json.authenticated);
      state.enterAllowed = state.authenticated;
      return state.authenticated;
    } catch (_) {
      state.authenticated = false;
      state.enterAllowed = false;
      return false;
    }
  }
  function notifyBridgeState() {
    try {
      window.dispatchEvent(new CustomEvent('mineradio-bridge-state', { detail: state }));
    } catch (_) {}
  }
  function setBodyState() {
    if (!document.body) return;
    document.body.classList.add('web-shell');
    document.body.classList.toggle('bridge-connected', !!state.connected);
    document.body.classList.toggle('bridge-missing', !state.connected);
  }
  function renderBridgeBanner() {
    if (!document.body) return;
    var existing = document.getElementById('bridge-status-banner');
    if (state.enterAllowed) {
      if (existing) existing.remove();
      setBodyState();
      renderBridgeControl();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'bridge-status-banner';
      var pairHref = pairUrl();
      existing.innerHTML = [
        '<div class="bridge-status-text">',
        '<strong>Bridge 未连接</strong>',
        '<span>当前 v1 先用源码运行 Bridge：在项目目录执行 <code>npm install</code> 和 <code>npm run bridge</code>，再点“配对”。在线音源需要 Bridge，本地音乐可直接播放。</span>',
        '</div>',
        '<div class="bridge-status-actions">',
        '<a href="bridge.html" target="_blank" rel="noreferrer">说明</a>',
        '<button type="button" data-bridge-check>重试</button>',
        '<a href="' + escapeAttr(pairHref) + '" target="_blank" rel="noreferrer">配对</a>',
        '</div>'
      ].join('');
      document.body.appendChild(existing);
      var retry = existing.querySelector('[data-bridge-check]');
      if (retry) retry.addEventListener('click', function () { checkBridge(true); });
    }
    setBodyState();
    renderBridgeControl();
  }
  function renderBridgeControl() {
    if (!document.body) return;
    var existing = document.getElementById('bridge-mini-control');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = 'bridge-mini-control';
    wrap.className = state.enterAllowed ? 'connected' : 'missing';
    var pairHref = pairUrl();
    wrap.innerHTML = [
      '<span class="bridge-mini-dot" aria-hidden="true"></span>',
      '<span class="bridge-mini-label">' + (state.enterAllowed ? 'Bridge 已配对 · 平台未必登录' : (state.connected ? 'Bridge 未配对' : 'Bridge 未连接')) + '</span>',
      '<a href="bridge.html" target="_blank" rel="noreferrer">说明</a>',
      '<button type="button" data-bridge-check>重试</button>',
      '<a href="' + escapeAttr(pairHref) + '" target="_blank" rel="noreferrer">' + (state.enterAllowed ? '重新配对' : '配对') + '</a>'
    ].join('');
    document.body.appendChild(wrap);
    var retry = wrap.querySelector('[data-bridge-check]');
    if (retry) retry.addEventListener('click', function () { checkBridge(true); });
  }
  function installStyles() {
    if (document.getElementById('mineradio-web-adapter-style')) return;
    var style = document.createElement('style');
    style.id = 'mineradio-web-adapter-style';
    style.textContent = [
      'body.web-shell #desktop-titlebar,body.web-shell #update-entry,body.web-shell #t-desktopLyrics,body.web-shell #t-desktopLyricsClickThrough,body.web-shell #t-desktopLyricsCinema,body.web-shell #t-desktopLyricsHighlight,body.web-shell #t-wallpaperMode{display:none!important}',
      'body.splash-active #bridge-status-banner,body.splash-active #bridge-mini-control{display:none!important}',
      'body.web-shell #bridge-status-banner{position:fixed;z-index:9999;left:50%;top:18px;transform:translateX(-50%);width:min(680px,calc(100vw - 28px));display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 14px;border:1px solid rgba(244,210,138,.25);border-radius:14px;background:rgba(8,10,14,.88);box-shadow:0 20px 60px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);color:rgba(255,255,255,.78);font:12px/1.45 var(--font-sans,system-ui,sans-serif)}',
      '#bridge-status-banner strong{display:block;color:#fff3c9;font-size:13px;margin-bottom:2px}',
      '#bridge-status-banner code{color:#9cffdf;font-family:var(--font-mono,monospace);font-size:11px}',
      '#bridge-status-banner .bridge-status-actions{display:flex;gap:8px;flex-shrink:0}',
      '#bridge-status-banner button,#bridge-status-banner a{height:34px;min-width:54px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:0 11px;font:inherit;cursor:pointer}',
      '#bridge-status-banner button:hover,#bridge-status-banner a:hover{background:rgba(244,210,138,.13);border-color:rgba(244,210,138,.38)}',
      'body.web-shell #bridge-mini-control{position:fixed;z-index:9998;right:18px;top:18px;display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.13);background:rgba(8,10,14,.72);box-shadow:0 14px 44px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);font:12px/1.2 var(--font-sans,system-ui,sans-serif);color:rgba(255,255,255,.76)}',
      '#bridge-mini-control .bridge-mini-dot{width:8px;height:8px;border-radius:50%;background:#ffce70;box-shadow:0 0 14px rgba(255,206,112,.72);flex:0 0 auto}',
      '#bridge-mini-control.connected .bridge-mini-dot{background:#8dffd6;box-shadow:0 0 14px rgba(141,255,214,.70)}',
      '#bridge-mini-control .bridge-mini-label{font-weight:760;color:#fff;white-space:nowrap}',
      '#bridge-mini-control button,#bridge-mini-control a{height:26px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.86);text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:0 8px;font:inherit;cursor:pointer;white-space:nowrap}',
      '#bridge-mini-control button:hover,#bridge-mini-control a:hover{background:rgba(139,231,201,.13);border-color:rgba(139,231,201,.36);color:#fff}',
      '@media (max-width:760px){body.web-shell #bridge-mini-control{top:auto;right:10px;bottom:10px;max-width:calc(100vw - 20px);overflow:auto}}',
      '@media (max-width:640px){body.web-shell #bridge-status-banner{align-items:flex-start;flex-direction:column;top:10px}.bridge-status-actions{width:100%}#bridge-status-banner button,#bridge-status-banner a{flex:1}}'
    ].join('\\n');
    document.head.appendChild(style);
  }
  async function checkBridge(manual) {
    if (state.checking) return state.connected;
    state.checking = true;
    notifyBridgeState();
    try {
      var res = await fetch(bridgeUrl('/health'), { cache: 'no-store' });
      var json = await res.json();
      state.connected = !!(json && json.ok);
      state.health = json || null;
      state.lastError = '';
      if (state.connected) {
        if (json.bridgeOrigin) {
          state.bridgeOrigin = normalizeBridgeOrigin(json.bridgeOrigin);
          writeStorage(ORIGIN_KEY, state.bridgeOrigin, legacyOriginKey);
        }
        await verifyBridgeAuth();
      } else {
        state.authenticated = false;
        state.enterAllowed = false;
      }
    } catch (e) {
      state.connected = false;
      state.authenticated = false;
      state.enterAllowed = false;
      state.health = null;
      state.lastError = e && e.message || 'Bridge unavailable';
    } finally {
      state.checking = false;
      renderBridgeBanner();
      notifyBridgeState();
    }
    if (manual && state.enterAllowed && typeof window.showToast === 'function') window.showToast('Bridge 已配对，平台账号需单独登录');
    return state.enterAllowed;
  }

  window.MineradioBridge = {
    state: state,
    resolveApiUrl: resolveApiUrl,
    authorizeFetch: authorizeFetch,
    proxyUrl: withToken,
    check: checkBridge,
    isConnected: function () { return !!state.connected; },
    isEnterAllowed: function () { return !!state.enterAllowed; },
    pairUrl: pairUrl,
  };

  installStyles();
  document.addEventListener('DOMContentLoaded', function () {
    installStyles();
    setBodyState();
    checkBridge(false);
  });
})(window);
