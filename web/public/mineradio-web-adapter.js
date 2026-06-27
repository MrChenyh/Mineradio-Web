(function () {
  var state = {
    bridgeOrigin: '',
    bridgeToken: '',
    connected: false,
    authenticated: false,
    enterAllowed: true,
    localOnly: true,
    checking: false,
    lastError: '',
    health: { ok: true, mode: 'local-first' },
  };

  function notifyState() {
    try {
      window.dispatchEvent(new CustomEvent('mineradio-bridge-state', { detail: state }));
    } catch (_) {}
  }

  function authorizeFetch(url, opts) {
    return { url: url, opts: opts || {} };
  }

  function proxyUrl(path) {
    var raw = String(path || '');
    if (raw.indexOf('/api/audio?') === 0 || raw.indexOf('/api/cover?') === 0) {
      try {
        var u = new URL(raw, location.origin);
        return u.searchParams.get('url') || raw;
      } catch (_) {}
    }
    return raw;
  }

  async function check() {
    state.connected = false;
    state.authenticated = false;
    state.enterAllowed = true;
    state.localOnly = true;
    state.checking = false;
    notifyState();
    return false;
  }

  window.MineradioBridge = {
    state: state,
    resolveApiUrl: function (url) { return url; },
    authorizeFetch: authorizeFetch,
    proxyUrl: proxyUrl,
    check: check,
    isConnected: function () { return false; },
    isEnterAllowed: function () { return true; },
    pairUrl: function () { return ''; },
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body) {
      document.body.classList.add('web-shell', 'local-first-shell', 'bridge-enter-allowed');
      document.body.classList.remove('bridge-missing', 'bridge-connected');
    }
    notifyState();
  });
})(window);
