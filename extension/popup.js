'use strict';

function setStatus(provider, state, label, meta) {
  var box = document.getElementById(provider + '-status');
  if (!box) return;
  document.getElementById(provider + '-status-label').textContent = label;
  document.getElementById(provider + '-status-meta').textContent = meta || '';
  box.classList.toggle('ok', state === 'ok');
  box.classList.toggle('warn', state === 'warn');
}

function requestStatus(action, callback) {
  chrome.runtime.sendMessage({ action: action, payload: {} }, function (response) {
    callback(chrome.runtime.lastError, response);
  });
}

function oldExtensionMessage(message) {
  if (/unknown connector action/i.test(message || '')) {
    return '扩展后台仍是旧版，请在 edge://extensions 或 chrome://extensions 点击“重新加载”。';
  }
  return message || '未知错误';
}

function vipText(status) {
  status = status || {};
  if (status.vipUnknown || status.vipLabel === 'VIP_UNKNOWN') return ' 路 VIP 未确认';
  if (status.vipLabel && status.vipLabel !== '无VIP') return ' · ' + status.vipLabel;
  if (status.isSvip) return ' · SVIP';
  if (status.isVip || Number(status.vipType || 0) > 0) return ' · VIP';
  return '';
}

function refreshNeteaseStatus() {
  setStatus('netease', 'warn', '正在检测网易云...', '读取 music.163.com Cookie / 扩展缓存');
  requestStatus('netease.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('netease', 'warn', '网易云状态读取失败', oldExtensionMessage(error ? error.message : response && response.error));
      return;
    }
    var status = response.status || {};
    if (status.loggedIn) {
      setStatus('netease', 'ok', '网易云会话已保存', (status.nickname || status.userId || '已登录') + vipText(status) + (status.authCached ? ' · 缓存可用' : '') + ' · 可用于搜索、歌单和播放探测');
    } else {
      setStatus('netease', 'warn', '未检测到网易云会话', '在网页登录或在 Mineradio Web 中导入 Cookie 后会保存到扩展');
    }
  });
}

function refreshQQStatus() {
  setStatus('qq', 'warn', '正在检测 QQ 音乐...', '读取 y.qq.com Cookie / 扩展缓存');
  requestStatus('qq.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('qq', 'warn', 'QQ 音乐状态读取失败', oldExtensionMessage(error ? error.message : response && response.error));
      return;
    }
    var status = response.status || {};
    var cookieNames = Array.isArray(status.loginCookieNames) && status.loginCookieNames.length
      ? ' · Cookie: ' + status.loginCookieNames.join(', ')
      : ' · Cookie: ' + (status.cookieCount || 0);
    var tabInfo = status.musicTabReady
      ? ' · 标签页: ' + (status.visibleTabCount || 1)
      : ' · 未找到 y.qq.com 标签页';
    var cacheInfo = status.authCached ? ' · 已保存会话' : '';
    if (status.loggedIn && status.playbackKeyReady) {
      var authHint = status.authCached ? '播放授权已缓存' : (status.cookieCount > 1 ? 'Cookie 播放授权已检测到' : '页面播放授权已检测到');
      setStatus('qq', 'ok', 'QQ 音乐会话已保存', (status.nickname || status.userId || '已登录') + vipText(status) + cacheInfo + tabInfo + ' · ' + authHint + ' · 可尝试 QQ-X 搜索和播放' + cookieNames);
    } else if (status.loggedIn) {
      setStatus('qq', 'warn', 'QQ 音乐账号已保存', '账号可用于歌单；播放授权还不完整。打开 y.qq.com 播放一首歌后刷新即可补全' + cacheInfo + tabInfo + cookieNames);
    } else {
      setStatus('qq', 'warn', '未检测到 QQ 音乐会话', '请在 y.qq.com 登录，或在 Mineradio Web 中导入 QQ Cookie' + tabInfo + cookieNames);
    }
  });
}

function refreshKugouStatus() {
  setStatus('kugou', 'warn', '正在检测酷狗...', '读取 kugou.com Cookie 并做播放探测');
  requestStatus('kugou.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('kugou', 'warn', '酷狗状态读取失败', oldExtensionMessage(error ? error.message : response && response.error));
      return;
    }
    var status = response.status || {};
    if (status.playbackReady) {
      setStatus('kugou', 'ok', '酷狗播放能力已验证', (status.userId || '已登录') + vipText(status) + ' · KG-X 搜索和播放可用');
    } else if (status.loggedIn) {
      setStatus('kugou', 'warn', '酷狗账号已检测到但播放不可用', '不会作为优先播放源；仍可导入酷狗分享歌单。原因: ' + (status.playbackProbeMessage || '未拿到可播放地址'));
    } else {
      setStatus('kugou', 'warn', '酷狗仅外链导入可用', '未验证账号播放能力；可继续粘贴酷狗分享歌单导入');
    }
  });
}

function refreshStatus() {
  refreshNeteaseStatus();
  refreshQQStatus();
  refreshKugouStatus();
}

document.getElementById('refresh').addEventListener('click', refreshStatus);
refreshStatus();
