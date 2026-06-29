'use strict';

var TEXT = {
  caption: '\u9ed8\u8ba4\u53ea\u770b\u8fde\u63a5\u72b6\u6001\uff0c\u70b9\u4e00\u884c\u518d\u770b\u8be6\u60c5',
  retryTip: '\u5df2\u767b\u5f55\u4f46\u8fd8\u6ca1\u53d8\u7eff\uff0c\u5148\u5728\u7f51\u9875\u64ad\u4e00\u9996\u6b4c\u518d\u70b9\u5237\u65b0',
  refresh: '\u5237\u65b0\u72b6\u6001',
  refreshing: '\u68c0\u6d4b\u4e2d...',
  openPlayer: '\u6253\u5f00 Web \u64ad\u653e\u5668',
  hideDetail: '\u6536\u8d77',
  noAccount: '\u672a\u663e\u793a\u8d26\u53f7\u540d\u79f0',
  noExtraDetail: '\u6682\u65e0\u989d\u5916\u4fe1\u606f',
  providers: {
    netease: '\u7f51\u6613\u4e91',
    qq: 'QQ \u97f3\u4e50',
    kugou: '\u9177\u72d7'
  },
  providerLinks: {
    netease: '\u6253\u5f00\u7f51\u6613\u4e91',
    qq: '\u6253\u5f00 QQ \u97f3\u4e50',
    kugou: '\u6253\u5f00\u9177\u72d7'
  },
  providerHrefs: {
    netease: 'https://music.163.com/',
    qq: 'https://y.qq.com/',
    kugou: 'https://www.kugou.com/'
  },
  states: {
    loading: '\u68c0\u6d4b\u4e2d',
    connected: '\u5df2\u8fde\u63a5',
    playable: '\u53ef\u64ad\u653e',
    partial: '\u5f85\u8865\u5168',
    limited: '\u5df2\u767b\u5f55\u4f46\u53d7\u9650',
    importOnly: '\u4ec5\u5bfc\u5165',
    disconnected: '\u672a\u8fde\u63a5',
    failed: '\u8bfb\u53d6\u5931\u8d25',
    unknownVip: 'VIP \u672a\u786e\u8ba4'
  }
};

var PROVIDERS = ['netease', 'qq', 'kugou'];
var providerViews = {};
var activeProvider = '';
var refreshPending = 0;

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  var el = byId(id);
  if (el) el.textContent = value || '';
}

function setRefreshBusy(busy) {
  var button = byId('refresh');
  if (!button) return;
  button.disabled = !!busy;
  button.textContent = busy ? TEXT.refreshing : TEXT.refresh;
}

function beginRefresh() {
  refreshPending += 1;
  setRefreshBusy(true);
}

function endRefresh() {
  refreshPending = Math.max(0, refreshPending - 1);
  setRefreshBusy(refreshPending > 0);
}

function requestStatus(action, callback) {
  chrome.runtime.sendMessage({ action: action, payload: {} }, function (response) {
    callback(chrome.runtime.lastError, response);
  });
}

function oldExtensionMessage(message) {
  if (/unknown connector action/i.test(message || '')) {
    return '\u6269\u5c55\u540e\u53f0\u8fd8\u662f\u65e7\u7248\uff0c\u8bf7\u5728\u6269\u5c55\u9875\u91cd\u65b0\u52a0\u8f7d';
  }
  return message || '\u672a\u77e5\u9519\u8bef';
}

function lineJoin(lines) {
  return (lines || []).filter(Boolean);
}

function formatAge(ms) {
  ms = Number(ms || 0);
  if (!ms || ms < 0) return '';
  if (ms < 60000) return '\u521a\u521a';
  if (ms < 3600000) return Math.max(1, Math.round(ms / 60000)) + '\u5206\u949f';
  if (ms < 86400000) return Math.max(1, Math.round(ms / 3600000)) + '\u5c0f\u65f6';
  return Math.max(1, Math.round(ms / 86400000)) + '\u5929';
}

function safeTrim(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function decodeLegacyUnicode(value) {
  var text = safeTrim(value);
  if (!text) return '';
  if (!/%u[0-9a-fA-F]{4}/.test(text) && !/%[0-9a-fA-F]{2}/.test(text)) return text;
  try {
    return unescape(text);
  } catch (err) {
    return text;
  }
}

function looksUnreadable(value) {
  var text = safeTrim(value);
  if (!text) return true;
  if (/%u[0-9a-fA-F]{4}/.test(text) || /%[0-9a-fA-F]{2}/.test(text)) return true;
  if (/^[0-9_\-]{6,}$/.test(text)) return true;
  if (/^(qq\s*)?[0-9]{5,}$/i.test(text)) return true;
  if (/^[A-Za-z0-9+/=_-]{18,}$/.test(text)) return true;
  return false;
}

function sanitizeAccountName(value) {
  var decoded = decodeLegacyUnicode(value);
  var text = safeTrim(decoded);
  if (!text) return '';
  if (looksUnreadable(text)) return '';
  return text.length > 26 ? text.slice(0, 26) : text;
}

function vipLabel(status) {
  status = status || {};
  var raw = safeTrim(status.vipLabel || '');
  if (raw === 'VIP_UNKNOWN' || status.vipUnknown) return TEXT.states.unknownVip;
  if (!raw || raw === 'NO_VIP' || raw === '\u65e0 VIP' || raw === '\u65e0VIP') return '';
  var upper = raw.toUpperCase();
  if (upper.indexOf('SVIP') >= 0) return 'SVIP';
  if (upper.indexOf('VIP') >= 0) {
    if (raw === 'QQ VIP') return 'VIP';
    return raw.length <= 10 ? raw : 'VIP';
  }
  if (/\u9ed1\u80f6|\u7eff\u94bb|\u8c6a\u534e|\u97f3\u4e50\u5305/.test(raw)) return raw;
  if (status.isSvip) return 'SVIP';
  if (status.isVip || Number(status.vipType || 0) > 0) return 'VIP';
  return '';
}

function compactBadgeText(value) {
  var text = safeTrim(value);
  if (!text || text === TEXT.states.unknownVip) return '';
  var upper = text.toUpperCase();
  if (upper.indexOf('SVIP') >= 0) return 'SVIP';
  if (upper.indexOf('VIP') >= 0) return 'VIP';
  return '';
}

function playbackProbeText(value) {
  var text = safeTrim(value);
  if (!text) return '';
  if (text === 'url_unavailable' || text === 'audio_url_unavailable' || text === 'kugou_audio_url_unavailable') return '\u672a\u62ff\u5230 Web \u53ef\u76f4\u63a5\u64ad\u653e\u7684\u97f3\u9891\u5730\u5740';
  if (text === 'login_or_token_missing') return '\u767b\u5f55\u51ed\u636e\u8fd8\u4e0d\u5b8c\u6574';
  if (text === 'kugou_probe_timeout') return '\u9177\u72d7\u64ad\u653e\u68c0\u67e5\u8d85\u65f6';
  if (text === 'kugou_search_empty') return '\u6d4b\u8bd5\u641c\u7d22\u6ca1\u6709\u8fd4\u56de\u53ef\u68c0\u67e5\u6b4c\u66f2';
  if (text === 'kugou_probe_no_song') return '\u6ca1\u6709\u53ef\u68c0\u67e5\u6b4c\u66f2';
  var code = text.match(/^kugou_playback_code_(.+)$/);
  if (code) return '\u9177\u72d7\u64ad\u653e\u63a5\u53e3\u8fd4\u56de\u4ee3\u7801 ' + code[1];
  if (/Invalid JSON from kugou\.com/i.test(text)) return '\u9177\u72d7\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38';
  return text;
}

function cacheLine(status) {
  status = status || {};
  if (!status.authCached) return '';
  var age = formatAge(status.cacheAgeMs);
  return '\u5df2\u4fdd\u5b58\u4f1a\u8bdd' + (age ? '\uff08' + age + '\uff09' : '');
}

function summarizeStatus(provider, status) {
  if (provider === 'netease') {
    if (status.loggedIn) {
      return {
        tone: 'success',
        stateText: TEXT.states.connected,
        badge: vipLabel(status),
        title: '\u5df2\u8bfb\u53d6\u5230\u767b\u5f55\u4f1a\u8bdd',
        description: '\u53ef\u7528\u4e8e\u6b4c\u5355\u3001\u641c\u7d22\u548c\u5c01\u9762\u8bfb\u53d6',
        account: sanitizeAccountName(status.nickname),
        details: lineJoin([
          cacheLine(status),
          status.userId ? '\u8d26\u53f7 ID\uff1a' + status.userId : '',
          vipLabel(status) ? '\u8d26\u53f7\u7c7b\u578b\uff1a' + vipLabel(status) : ''
        ]),
        tip: ''
      };
    }
    return {
      tone: 'danger',
      stateText: TEXT.states.disconnected,
      badge: '',
      title: '\u8fd8\u6ca1\u8fde\u4e0a\u7f51\u6613\u4e91',
      description: '\u767b\u5f55 music.163.com \u540e\u518d\u5237\u65b0',
      account: '',
      details: lineJoin([
        cacheLine(status),
        '\u5f53\u524d\u672a\u627e\u5230\u53ef\u7528 Cookie \u4f1a\u8bdd'
      ]),
      tip: ''
    };
  }

  if (provider === 'qq') {
    if (status.loggedIn && status.playbackKeyReady) {
      return {
        tone: 'success',
        stateText: TEXT.states.playable,
        badge: vipLabel(status),
        title: '\u5df2\u8fde\u63a5\u4e14\u64ad\u653e\u6388\u6743\u53ef\u7528',
        description: '\u53ef\u4f18\u5148\u7528\u4e8e QQ \u6b4c\u5355\u3001\u641c\u7d22\u548c\u64ad\u653e',
        account: sanitizeAccountName(status.nickname),
        details: lineJoin([
          cacheLine(status),
          status.visibleTabCount ? '\u68c0\u6d4b\u5230 QQ \u9875\u9762\uff1a' + Number(status.visibleTabCount) + ' \u4e2a' : '',
          Array.isArray(status.loginCookieNames) && status.loginCookieNames.length ? '\u5df2\u62ff\u5230\u64ad\u653e Cookie' : '',
          vipLabel(status) ? '\u8d26\u53f7\u7c7b\u578b\uff1a' + vipLabel(status) : ''
        ]),
        tip: ''
      };
    }
    if (status.loggedIn) {
      return {
        tone: 'warning',
        stateText: TEXT.states.partial,
        badge: vipLabel(status),
        title: '\u767b\u5f55\u72b6\u6001\u5df2\u4fdd\u5b58',
        description: '\u8fd8\u5dee\u4e00\u6b65\u64ad\u653e\u6388\u6743',
        account: sanitizeAccountName(status.nickname),
        details: lineJoin([
          cacheLine(status),
          status.visibleTabCount ? '\u68c0\u6d4b\u5230 QQ \u9875\u9762\uff1a' + Number(status.visibleTabCount) + ' \u4e2a' : '\u76ee\u524d\u672a\u68c0\u6d4b\u5230 y.qq.com \u6253\u5f00\u9875\u9762',
          Array.isArray(status.loginCookieNames) && status.loginCookieNames.length ? '\u5df2\u6355\u83b7 Cookie\uff1a' + status.loginCookieNames.length + ' \u9879' : '\u5f53\u524d Cookie \u4e0d\u5b8c\u6574',
          vipLabel(status) ? '\u8d26\u53f7\u7c7b\u578b\uff1a' + vipLabel(status) : ''
        ]),
        tip: '\u5148\u5728 QQ \u97f3\u4e50\u7f51\u9875\u64ad\u4e00\u9996\u6b4c\uff0c\u7136\u540e\u518d\u70b9\u5237\u65b0\u72b6\u6001'
      };
    }
    return {
      tone: 'danger',
      stateText: TEXT.states.disconnected,
      badge: '',
      title: '\u8fd8\u6ca1\u8fde\u4e0a QQ \u97f3\u4e50',
      description: '\u767b\u5f55 y.qq.com \u540e\u53ef\u8bfb\u53d6\u6b4c\u5355\u548c\u64ad\u653e\u94fe\u63a5',
      account: '',
      details: lineJoin([
        cacheLine(status),
        status.visibleTabCount ? '\u68c0\u6d4b\u5230 QQ \u9875\u9762\uff1a' + Number(status.visibleTabCount) + ' \u4e2a' : '\u76ee\u524d\u672a\u68c0\u6d4b\u5230 y.qq.com \u9875\u9762'
      ]),
      tip: '\u767b\u5f55\u540e\u82e5\u8fd8\u662f\u9ec4\u706f\uff0c\u5148\u64ad\u4e00\u9996\u6b4c\u518d\u5237\u65b0'
    };
  }

  if (status.playbackReady) {
    return {
      tone: 'success',
      stateText: TEXT.states.playable,
      badge: vipLabel(status),
      title: '\u5df2\u767b\u5f55\u4e14\u64ad\u653e\u6d4b\u901a',
      description: '\u9177\u72d7\u53ef\u53c2\u4e0e\u641c\u7d22\u64ad\u653e\u6392\u5e8f',
      account: sanitizeAccountName(status.nickname || status.userId),
      details: lineJoin([
        cacheLine(status),
        vipLabel(status) ? '\u8d26\u53f7\u7c7b\u578b\uff1a' + vipLabel(status) : '',
        status.playbackProbeMessage ? '\u64ad\u653e\u68c0\u67e5\uff1a' + playbackProbeText(status.playbackProbeMessage) : '\u64ad\u653e\u68c0\u67e5\u5df2\u901a\u8fc7'
      ]),
      tip: ''
    };
  }
  if (status.loggedIn) {
    var kugouObserved = !!status.webPlaybackObserved;
    return {
      tone: 'warning',
      stateText: TEXT.states.limited,
      badge: vipLabel(status),
      title: kugouObserved ? '\u9177\u72d7\u7f51\u9875\u64ad\u653e\u5df2\u68c0\u6d4b\u5230' : '\u767b\u5f55\u72b6\u6001\u5df2\u8bfb\u5230',
      description: kugouObserved ? 'Mineradio \u8fd8\u6ca1\u62ff\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u5730\u5740' : '\u76ee\u524d\u8fd8\u4e0d\u5efa\u8bae\u4f5c\u4e3a\u9996\u9009\u53ef\u64ad\u6e90',
      account: sanitizeAccountName(status.nickname || status.userId),
      details: lineJoin([
        cacheLine(status),
        vipLabel(status) ? '\u8d26\u53f7\u7c7b\u578b\uff1a' + vipLabel(status) : '',
        kugouObserved ? '\u5b98\u7f51\u64ad\u653e\uff1a\u5df2\u68c0\u6d4b\u5230' : '',
        status.playbackProbeMessage ? '\u64ad\u653e\u68c0\u67e5\uff1a' + playbackProbeText(status.playbackProbeMessage) : '\u64ad\u653e\u68c0\u67e5\u672a\u901a\u8fc7'
      ]),
      tip: kugouObserved ? '\u5df2\u8bc1\u660e\u5b98\u7f51\u4f1a\u8bdd\u53ef\u7528\uff0c\u4f46\u9177\u72d7\u63a5\u53e3\u6682\u672a\u8fd4\u56de Web \u76f4\u64ad\u94fe\u63a5' : '\u5982\u679c\u521a\u767b\u5f55\u8fc7\uff0c\u5148\u5728\u9177\u72d7\u7f51\u9875\u64ad\u4e00\u9996\u6b4c\u518d\u8bd5'
    };
  }
  return {
    tone: 'danger',
    stateText: TEXT.states.importOnly,
    badge: '',
    title: '\u5f53\u524d\u53ea\u9002\u5408\u5bfc\u5165\u5206\u4eab\u6b4c\u5355',
    description: '\u6ca1\u6709\u786e\u8ba4\u5230\u53ef\u7528\u7684\u9177\u72d7\u64ad\u653e\u4f1a\u8bdd',
    account: '',
    details: lineJoin([
      cacheLine(status),
      status.playbackProbeMessage ? '\u64ad\u653e\u68c0\u67e5\uff1a' + playbackProbeText(status.playbackProbeMessage) : '\u76ee\u524d\u53ea\u4fdd\u5b58\u5916\u94fe\u5bfc\u5165\u80fd\u529b'
    ]),
    tip: '\u767b\u5f55\u540e\u64ad\u4e00\u9996\u6b4c\uff0c\u80fd\u66f4\u5feb\u8865\u9f50\u64ad\u653e\u6388\u6743'
  };
}

function failureView(provider, message) {
  return {
    provider: provider,
    tone: 'danger',
    stateText: TEXT.states.failed,
    badge: '',
    title: '\u72b6\u6001\u8bfb\u53d6\u5931\u8d25',
    description: oldExtensionMessage(message),
    account: '',
    details: [oldExtensionMessage(message)],
    tip: '\u5982\u679c\u521a\u91cd\u65b0\u52a0\u8f7d\u8fc7\u6269\u5c55\uff0c\u518d\u5237\u65b0\u4e00\u6b21\u8bd5\u8bd5'
  };
}

function buildView(provider, status) {
  var base = summarizeStatus(provider, status || {});
  base.provider = provider;
  return base;
}

function applyTone(el, tone) {
  if (!el) return;
  el.classList.remove('loading', 'success', 'warning', 'danger');
  el.classList.add(tone || 'loading');
}

function setRowView(provider, view) {
  providerViews[provider] = view;
  setText('name-' + provider, TEXT.providers[provider]);
  setText('state-' + provider, view.stateText);

  var badge = byId('badge-' + provider);
  if (badge) {
    var badgeText = compactBadgeText(view.badge);
    badge.hidden = !badgeText;
    badge.textContent = badgeText;
  }

  applyTone(byId('dot-' + provider), view.tone);
  applyTone(byId('state-' + provider), view.tone);
}

function showDetail(provider) {
  var view = providerViews[provider];
  if (!view) return;

  activeProvider = provider;
  PROVIDERS.forEach(function (name) {
    var row = byId('row-' + name);
    if (row) row.classList.toggle('active', name === provider);
  });

  var panel = byId('detail-panel');
  if (panel) panel.hidden = false;

  applyTone(byId('detail-dot'), view.tone);
  setText('detail-title', TEXT.providers[provider]);
  setText('detail-status', view.stateText);
  setText('detail-account', view.account ? ('\u8d26\u53f7\uff1a' + view.account) : '');
  setText('detail-description', view.title + (view.description ? '\uff0c' + view.description : ''));
  setText('detail-tip', view.tip || '');

  var list = byId('detail-list');
  if (list) {
    list.textContent = '';
    var items = view.details && view.details.length ? view.details : [TEXT.noExtraDetail];
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'detail-item';
      div.textContent = item;
      list.appendChild(div);
    });
  }

  var link = byId('open-provider');
  if (link) {
    link.href = TEXT.providerHrefs[provider];
    link.textContent = TEXT.providerLinks[provider];
  }
}

function hideDetail() {
  activeProvider = '';
  var panel = byId('detail-panel');
  if (panel) panel.hidden = true;
  PROVIDERS.forEach(function (name) {
    var row = byId('row-' + name);
    if (row) row.classList.remove('active');
  });
}

function bindRows() {
  PROVIDERS.forEach(function (provider) {
    var row = byId('row-' + provider);
    if (!row) return;
    row.addEventListener('click', function () {
      if (activeProvider === provider) {
        hideDetail();
      } else {
        showDetail(provider);
      }
    });
  });
}

function initStaticText() {
  var manifest = chrome.runtime.getManifest();
  setText('version-badge', 'v' + ((manifest && manifest.version) || ''));
  setText('caption-text', TEXT.caption);
  setText('retry-tip-text', TEXT.retryTip);
  setText('refresh', TEXT.refresh);
  setText('open-player', TEXT.openPlayer);
  setText('hide-detail', TEXT.hideDetail);
  PROVIDERS.forEach(function (provider) {
    setText('name-' + provider, TEXT.providers[provider]);
    setText('state-' + provider, TEXT.states.loading);
  });
}

function refreshProvider(provider, action) {
  beginRefresh();
  setRowView(provider, {
    provider: provider,
    tone: 'loading',
    stateText: TEXT.states.loading,
    badge: '',
    title: TEXT.states.loading,
    description: '',
    account: '',
    details: []
  });

  requestStatus(action, function (error, response) {
    var view;
    if (error || !response || !response.ok) {
      view = failureView(provider, error ? error.message : response && response.error);
    } else {
      view = buildView(provider, response.status || {});
    }
    setRowView(provider, view);
    if (activeProvider === provider) showDetail(provider);
    endRefresh();
  });
}

function refreshStatus() {
  refreshPending = 0;
  setRefreshBusy(false);
  refreshProvider('netease', 'netease.status');
  refreshProvider('qq', 'qq.status');
  refreshProvider('kugou', 'kugou.status');
}

function initPopup() {
  initStaticText();
  bindRows();
  byId('refresh').addEventListener('click', refreshStatus);
  byId('hide-detail').addEventListener('click', hideDetail);
  refreshStatus();
}

initPopup();
