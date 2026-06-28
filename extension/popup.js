'use strict';

function setStatus(ok, label, meta) {
  var box = document.getElementById('status');
  document.getElementById('status-label').textContent = label;
  document.getElementById('status-meta').textContent = meta;
  box.classList.toggle('ok', !!ok);
}

function refreshStatus() {
  setStatus(false, '正在检测...', '读取 music.163.com Cookie');
  chrome.runtime.sendMessage({ action: 'netease.status', payload: {} }, function (response) {
    if (chrome.runtime.lastError || !response || !response.ok) {
      setStatus(false, '扩展后台未响应', chrome.runtime.lastError ? chrome.runtime.lastError.message : (response && response.error || '未知错误'));
      return;
    }
    var status = response.status || {};
    if (status.loggedIn) {
      setStatus(true, '网易云网页登录态已检测到', '刷新 Mineradio Web 后即可尝试扩展搜索');
    } else {
      setStatus(false, '未检测到网易云网页登录态', '请先在浏览器里登录 music.163.com');
    }
  });
}

document.getElementById('refresh').addEventListener('click', refreshStatus);
refreshStatus();
