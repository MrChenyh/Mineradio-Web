(function () {
  'use strict';

  var CHANNEL = 'mineradio-connector';

  function sendToPage(payload) {
    window.postMessage(Object.assign({ channel: CHANNEL, from: 'extension' }, payload || {}), '*');
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var data = event.data || {};
    if (!data || data.channel !== CHANNEL || data.from !== 'page') return;
    chrome.runtime.sendMessage({
      action: data.action,
      requestId: data.requestId,
      payload: data.payload || {}
    }, function (response) {
      if (chrome.runtime.lastError) {
        sendToPage({
          requestId: data.requestId,
          ok: false,
          error: chrome.runtime.lastError.message || 'Connector unavailable'
        });
        return;
      }
      sendToPage(Object.assign({ requestId: data.requestId }, response || { ok: false, error: 'Empty connector response' }));
    });
  });

  function announceReady() {
    sendToPage({
      type: 'ready',
      ok: true,
      version: chrome.runtime.getManifest().version
    });
  }

  announceReady();
  setTimeout(announceReady, 250);
  setTimeout(announceReady, 1000);
  setTimeout(announceReady, 2200);
  window.addEventListener('load', announceReady);
})();
