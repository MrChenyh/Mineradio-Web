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

function refreshNeteaseStatus() {
  setStatus('netease', 'warn', '正在检测网易云...', '读取 music.163.com Cookie');
  requestStatus('netease.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('netease', 'warn', '网易云状态读取失败', oldExtensionMessage(error ? error.message : response && response.error));
      return;
    }
    var status = response.status || {};
    if (status.loggedIn) {
      setStatus('netease', 'ok', '网易云网页登录态已检测到', (status.nickname || '已登录') + ' · 可用于搜索、歌词和播放探测');
    } else {
      setStatus('netease', 'warn', '未检测到网易云网页登录态', '请先在浏览器里登录 music.163.com');
    }
  });
}

function refreshQQStatus() {
  setStatus('qq', 'warn', '正在检测 QQ 音乐...', '读取 y.qq.com Cookie');
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
    if (status.loggedIn && status.playbackKeyReady) {
      setStatus('qq', 'ok', 'QQ 音乐网页登录态已检测到', (status.nickname || status.userId || '已登录') + tabInfo + ' · 可尝试 QQ-X 搜索和播放' + cookieNames);
    } else if (status.loggedIn) {
      setStatus('qq', 'warn', 'QQ 音乐账号已检测到', '播放授权 Cookie 不完整；保持 y.qq.com 打开并在网页内播放一首歌后刷新' + tabInfo + cookieNames);
    } else {
      setStatus('qq', 'warn', '未检测到 QQ 音乐网页登录态', '请打开并登录 y.qq.com；如果已登录，请确认扩展权限并让 QQ 音乐域名走国内直连' + tabInfo + cookieNames);
    }
  });
}

function refreshKugouStatus() {
  setStatus('kugou', 'warn', '正在检测酷狗...', '读取 kugou.com Cookie');
  requestStatus('kugou.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('kugou', 'warn', '酷狗状态读取失败', oldExtensionMessage(error ? error.message : response && response.error));
      return;
    }
    var status = response.status || {};
    if (status.loggedIn && status.hasToken) {
      setStatus('kugou', 'ok', '酷狗网页登录态已检测到', '可尝试 KG-X 搜索和播放');
    } else if (status.loggedIn) {
      setStatus('kugou', 'warn', '酷狗账号已检测到', '缺少播放 token，重新打开 kugou.com 登录页试试');
    } else {
      setStatus('kugou', 'warn', '未检测到酷狗网页登录态', '请先在浏览器里登录 www.kugou.com');
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
