'use strict';

function setStatus(provider, state, label, meta) {
  var box = document.getElementById(provider + '-status');
  if (!box) return;
  document.getElementById(provider + '-status-label').textContent = label;
  document.getElementById(provider + '-status-meta').textContent = meta;
  box.classList.toggle('ok', state === 'ok');
  box.classList.toggle('warn', state === 'warn');
}

function requestStatus(action, callback) {
  chrome.runtime.sendMessage({ action: action, payload: {} }, function (response) {
    callback(chrome.runtime.lastError, response);
  });
}

function refreshStatus() {
  setStatus('netease', 'warn', '正在检测网易云...', '读取 music.163.com Cookie');
  setStatus('kugou', 'warn', '正在检测酷狗...', '读取 kugou.com Cookie');
  requestStatus('netease.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('netease', 'warn', '网易云状态读取失败', error ? error.message : (response && response.error || '未知错误'));
      return;
    }
    var status = response.status || {};
    if (status.loggedIn) {
      setStatus('netease', 'ok', '网易云网页登录态已检测到', '刷新 Mineradio Web 后即可尝试扩展搜索');
    } else {
      setStatus('netease', 'warn', '未检测到网易云网页登录态', '请先在浏览器里登录 music.163.com');
    }
  });
  requestStatus('kugou.status', function (error, response) {
    if (error || !response || !response.ok) {
      setStatus('kugou', 'warn', '酷狗状态读取失败', error ? error.message : (response && response.error || '未知错误'));
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

document.getElementById('refresh').addEventListener('click', refreshStatus);
refreshStatus();
