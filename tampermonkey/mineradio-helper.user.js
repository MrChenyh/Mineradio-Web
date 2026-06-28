// ==UserScript==
// @name         Mineradio Helper
// @namespace    https://mrchenyh.github.io/Mineradio-Web/
// @version      0.1.0
// @description  Add quick Mineradio Web entry points on common music sites.
// @author       Mineradio Web
// @match        https://music.163.com/*
// @match        http://music.163.com/*
// @match        https://y.qq.com/*
// @match        https://www.kugou.com/*
// @match        https://mrchenyh.github.io/Mineradio-Web/*
// @match        http://127.0.0.1/*
// @match        http://localhost/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var PLAYER_URL = 'https://mrchenyh.github.io/Mineradio-Web/';
  var BUTTON_ID = 'mineradio-tm-helper';

  function cleanTitle(text) {
    return String(text || '')
      .replace(/ - (网易云音乐|QQ音乐|酷狗音乐|Mineradio).*$/i, '')
      .replace(/_高清MV.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function currentQuery() {
    var selectors = [
      '[data-testid="track-title"]',
      '.song_name',
      '.data__name_txt',
      '.audioName',
      'h1',
      'title'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var node = document.querySelector(selectors[i]);
      var text = node && cleanTitle(node.textContent || node.innerText || '');
      if (text && text.length > 1) return text;
    }
    return cleanTitle(document.title);
  }

  function openMineradio() {
    var query = currentQuery();
    var url = PLAYER_URL + (query ? ('?q=' + encodeURIComponent(query)) : '');
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: true, insert: true });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    var button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = location.hostname.indexOf('mrchenyh.github.io') >= 0 ? '刷新搜索' : 'Mineradio';
    button.title = '打开 Mineradio Web，并用当前页面标题搜索';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (location.hostname.indexOf('mrchenyh.github.io') >= 0 || /^127\.0\.0\.1$|^localhost$/i.test(location.hostname)) {
        var input = document.getElementById('search-input');
        if (input && input.value.trim()) {
          var keyboardEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
          input.dispatchEvent(keyboardEvent);
        }
      } else {
        openMineradio();
      }
    });
    var style = document.createElement('style');
    style.textContent = [
      '#' + BUTTON_ID + '{position:fixed;right:18px;bottom:18px;z-index:2147483647;height:38px;padding:0 14px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(15,17,22,.82);color:#f7f7f2;font:700 13px/38px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.34);backdrop-filter:blur(14px);cursor:pointer;}',
      '#' + BUTTON_ID + ':hover{background:rgba(31,36,44,.92);transform:translateY(-1px);}'
    ].join('');
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(button);
  }

  ensureButton();
})();
