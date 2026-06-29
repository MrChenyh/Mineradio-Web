'use strict';

const NETEASE_ORIGIN = 'https://music.163.com';
const KUGOU_ORIGIN = 'https://www.kugou.com';
const KUGOU_MOBILE_ORIGIN = 'https://m.kugou.com';
const KUGOU_MOBILE_ALT_ORIGIN = 'https://m3ws.kugou.com';
const QQ_ORIGIN = 'https://y.qq.com';
const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg';
const KUGOU_SIGN_SECRET = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const NETEASE_DEFAULT_LEVEL = 'standard';
const NETEASE_AUDIO_RULE_ID = 163001;
const QQ_AUDIO_RULE_IDS = [163002, 163003];
const KUGOU_MOBILE_RULE_IDS = [163004, 163005];
const QQ_QUALITY_CANDIDATE_TEMPLATES = [
  { prefix: 'M800', ext: '.mp3', level: 'exhigh', label: 'QQ 320k' },
  { prefix: 'M500', ext: '.mp3', level: 'standard', label: 'QQ 128k' },
  { prefix: 'C400', ext: '.m4a', level: 'aac', label: 'QQ AAC' }
];
const NETEASE_HOME_PLAYLIST_LIMIT = 50;
const NETEASE_HOME_PLAYLIST_RENDER_LIMIT = 48;
const NETEASE_PLAYLIST_TRACK_LIMIT = 240;
const QQ_PLAYLIST_TRACK_LIMIT = 240;
const KUGOU_SHARED_PLAYLIST_TRACK_LIMIT = 500;
const KUGOU_PROBE_QUERIES = ['\u5468\u6770\u4f26 \u6674\u5929', '\u9648\u5955\u8fc5 \u5341\u5e74', 'Taylor Swift Love Story'];
const NETEASE_AUTH_STORE_KEY = 'mineradio.neteaseAuth.v1';
const QQ_AUTH_STORE_KEY = 'mineradio.qqAuth.v1';
const KUGOU_AUTH_STORE_KEY = 'mineradio.kugouAuth.v1';
const COOKIE_ATTRIBUTE_NAMES = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly']);
let kugouCapabilityCache = { key: '', checkedAt: 0, result: null };

function jsonResponse(requestId, data) {
  return Object.assign({ requestId, ok: true }, data || {});
}

function errorResponse(requestId, err) {
  const message = err && err.message ? err.message : String(err || 'Connector request failed');
  return { requestId, ok: false, error: message };
}

function installAudioHeaderRules() {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [NETEASE_AUDIO_RULE_ID].concat(QQ_AUDIO_RULE_IDS),
    addRules: [
      {
        id: NETEASE_AUDIO_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: NETEASE_ORIGIN + '/' },
            { header: 'Origin', operation: 'remove' }
          ]
        },
        condition: {
          urlFilter: '||music.126.net/',
          resourceTypes: ['media', 'xmlhttprequest']
        }
      },
      {
        id: QQ_AUDIO_RULE_IDS[0],
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: QQ_ORIGIN + '/' },
            { header: 'Origin', operation: 'remove' }
          ]
        },
        condition: {
          urlFilter: '||qqmusic.qq.com/',
          resourceTypes: ['media', 'xmlhttprequest']
        }
      },
      {
        id: QQ_AUDIO_RULE_IDS[1],
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: QQ_ORIGIN + '/' },
            { header: 'Origin', operation: 'remove' }
          ]
        },
        condition: {
          urlFilter: '||qqmusic.tc.qq.com/',
          resourceTypes: ['media', 'xmlhttprequest']
        }
      }
    ]
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Mineradio Connector] failed to install audio header rules', chrome.runtime.lastError.message);
    }
  });
}

function installKugouMobileHeaderRules() {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: KUGOU_MOBILE_RULE_IDS,
    addRules: [
      {
        id: KUGOU_MOBILE_RULE_IDS[0],
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'User-Agent', operation: 'set', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' },
            { header: 'Referer', operation: 'set', value: KUGOU_MOBILE_ORIGIN + '/' }
          ]
        },
        condition: {
          urlFilter: '||m.kugou.com/songlist/',
          resourceTypes: ['xmlhttprequest']
        }
      },
      {
        id: KUGOU_MOBILE_RULE_IDS[1],
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'User-Agent', operation: 'set', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' },
            { header: 'Referer', operation: 'set', value: KUGOU_MOBILE_ALT_ORIGIN + '/' }
          ]
        },
        condition: {
          urlFilter: '||m3ws.kugou.com/songlist/',
          resourceTypes: ['xmlhttprequest']
        }
      }
    ]
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Mineradio Connector] failed to install Kugou mobile header rules', chrome.runtime.lastError.message);
    }
  });
}

function neteaseHeaders(extra) {
  return Object.assign({
    Referer: NETEASE_ORIGIN + '/'
  }, extra || {});
}

function headersForUrl(url, extra) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch (err) {}
  if (host.includes('kugou.com')) return kugouHeaders(extra);
  if (host.includes('qq.com') || host.includes('qpic.cn') || host.includes('gtimg.cn') || host.includes('qlogo.cn')) return qqHeaders(extra);
  return neteaseHeaders(extra);
}

async function fetchText(url, options) {
  options = options || {};
  const optionHeaders = options.headers || {};
  const init = Object.assign({
    credentials: 'include',
    cache: 'no-store',
    referrer: options.referrer || NETEASE_ORIGIN + '/',
    headers: Object.assign(headersForUrl(url), optionHeaders)
  }, options || {});
  init.headers = Object.assign(headersForUrl(url), optionHeaders);
  const timeoutMs = Number(init.timeoutMs || 0) || 8000;
  delete init.timeoutMs;
  delete init.cookieObj;
  const fetched = await fetchTextWithTimeout(url, init, timeoutMs);
  const res = fetched.res;
  const text = fetched.text;
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 120));
  return text;
}

async function fetchJson(url, options) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid JSON from music.163.com');
  }
}

function neteaseAuthFieldPattern() {
  return /^(MUSIC_U|__csrf|NMTID|MUSIC_A|os|appver|channel|rememberLogin|_ntes_nuid|_ntes_nnid)$/i;
}

async function neteaseCookieObjectFromBrowser() {
  const urls = [NETEASE_ORIGIN + '/', 'http://music.163.com/', 'https://music.163.com/'];
  const entries = [];
  for (const url of urls) {
    try { entries.push(...await chrome.cookies.getAll({ url })); } catch (err) {}
  }
  const obj = {};
  entries.forEach(cookie => {
    if (!cookie || !cookie.name || !neteaseAuthFieldPattern().test(cookie.name)) return;
    obj[cookie.name] = cookie.value || '';
  });
  return obj;
}

async function readStoredNeteaseAuth() {
  const value = await storageLocalGet(NETEASE_AUTH_STORE_KEY);
  const item = value && value[NETEASE_AUTH_STORE_KEY] || null;
  return item && item.cookies ? item : null;
}

async function saveNeteaseAuthObject(cookieObj, source) {
  const cookies = sanitizeCookieObject(cookieObj, neteaseAuthFieldPattern());
  if (!Object.keys(cookies).length) return null;
  const item = { provider: 'netease', cookies, savedAt: Date.now(), source: source || 'browser' };
  await storageLocalSet({ [NETEASE_AUTH_STORE_KEY]: item });
  return item;
}

async function neteaseAuthObjectFromBrowser() {
  const browserObj = await promiseWithTimeout(neteaseCookieObjectFromBrowser(), 2200, {});
  const stored = await readStoredNeteaseAuth();
  const out = Object.assign({}, stored && stored.cookies || {}, browserObj || {});
  if (out.MUSIC_U || Object.keys(browserObj || {}).length) await saveNeteaseAuthObject(out, Object.keys(browserObj || {}).length ? 'browser' : 'cache');
  if (stored && stored.savedAt) out.__authCachedAt = stored.savedAt;
  out.__authCached = !!(stored && stored.cookies && Object.keys(stored.cookies).length);
  return out;
}

async function neteaseFetchJson(url, options) {
  const cookieObj = options && options.cookieObj || await neteaseAuthObjectFromBrowser();
  const cookieHeader = serializeCookieObject(cookieObj);
  const headers = cookieHeader ? { Cookie: cookieHeader } : {};
  return fetchJson(url, Object.assign({}, options || {}, { headers: Object.assign(headers, options && options.headers || {}) }));
}

async function neteaseSaveAuth(payload) {
  const cookieText = String(payload && (payload.cookie || payload.cookies || payload.text || payload.input) || '').trim();
  const cookieObj = cookieText ? parseCookieString(cookieText) : (payload && payload.cookies || {});
  const stored = await saveNeteaseAuthObject(cookieObj, 'manual');
  if (!stored) return { status: { provider: 'netease', loggedIn: false, error: 'missing_cookie' } };
  return { status: await neteaseStatus() };
}

async function neteaseClearAuth() {
  await storageLocalRemove(NETEASE_AUTH_STORE_KEY);
  return { ok: true };
}

function formBody(params) {
  return new URLSearchParams(params || {}).toString();
}

function normalizeNeteaseLevel(level) {
  const value = String(level || '').trim().toLowerCase();
  if (['standard', 'exhigh', 'lossless', 'hires', 'jyeffect', 'sky', 'jymaster'].includes(value)) return value;
  return NETEASE_DEFAULT_LEVEL;
}

function chromeTabsQuery(query) {
  return new Promise((resolve, reject) => {
    if (!chrome.tabs || !chrome.tabs.query) return resolve([]);
    chrome.tabs.query(query, tabs => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(tabs || []);
    });
  });
}

function chromeExecuteScript(options) {
  return new Promise((resolve, reject) => {
    if (!chrome.scripting || !chrome.scripting.executeScript) return resolve([]);
    chrome.scripting.executeScript(options, results => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(results || []);
    });
  });
}

function timeoutResult(label, fallback) {
  return Object.assign({ error: label + '_timeout' }, fallback || {});
}

function promiseWithTimeout(promise, ms, fallback) {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(typeof fallback === 'function' ? fallback() : fallback);
    }, ms);
    Promise.resolve(promise).then(value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }).catch(err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(typeof fallback === 'function' ? fallback(err) : fallback);
    });
  });
}

function storageLocalGet(keys) {
  return new Promise(resolve => {
    if (!chrome.storage || !chrome.storage.local) return resolve({});
    try {
      chrome.storage.local.get(keys, value => {
        if (chrome.runtime.lastError) return resolve({});
        resolve(value || {});
      });
    } catch (err) {
      resolve({});
    }
  });
}

function storageLocalSet(value) {
  return new Promise(resolve => {
    if (!chrome.storage || !chrome.storage.local) return resolve(false);
    try {
      chrome.storage.local.set(value || {}, () => resolve(!chrome.runtime.lastError));
    } catch (err) {
      resolve(false);
    }
  });
}

function storageLocalRemove(keys) {
  return new Promise(resolve => {
    if (!chrome.storage || !chrome.storage.local) return resolve(false);
    try {
      chrome.storage.local.remove(keys, () => resolve(!chrome.runtime.lastError));
    } catch (err) {
      resolve(false);
    }
  });
}

function sanitizeCookieObject(obj, fieldPattern) {
  const out = {};
  Object.keys(obj || {}).forEach(key => {
    if (!key || COOKIE_ATTRIBUTE_NAMES.has(String(key).toLowerCase())) return;
    if (fieldPattern && !fieldPattern.test(key)) return;
    const value = obj[key];
    if (value == null || String(value) === '') return;
    out[key] = String(value);
  });
  return out;
}

async function fetchTextWithTimeout(url, init, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 8000) : null;
  try {
    const res = await fetch(url, Object.assign({}, init || {}, controller ? { signal: controller.signal } : {}));
    const text = await res.text();
    return { res, text };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function uniqueTabsById(tabs) {
  const seen = new Set();
  return (tabs || []).filter(tab => {
    if (!tab || tab.id == null || seen.has(tab.id)) return false;
    seen.add(tab.id);
    return true;
  });
}

function tabUrlMatchesOrigin(tab, origin) {
  try {
    const target = new URL(origin);
    const url = new URL(String(tab && tab.url || ''));
    return url.protocol === target.protocol && (url.hostname === target.hostname || url.hostname.endsWith('.' + target.hostname));
  } catch (err) {
    return false;
  }
}

async function queryTabsForOrigins(origins) {
  const all = [];
  const list = Array.isArray(origins) ? origins : [origins];
  for (const origin of list) {
    try {
      all.push(...await chromeTabsQuery({ url: [origin + '/*'] }));
    } catch (err) {}
  }
  if (all.length) return uniqueTabsById(all);
  try {
    const tabs = await chromeTabsQuery({});
    return uniqueTabsById(tabs.filter(tab => list.some(origin => tabUrlMatchesOrigin(tab, origin))));
  } catch (err) {
    return [];
  }
}

async function neteaseFetchJsonInMusicTab(path, params, method) {
  try {
    const tabs = await promiseWithTimeout(chromeTabsQuery({ url: [NETEASE_ORIGIN + '/*', 'http://music.163.com/*'] }), 1800, []);
    const tab = tabs.find(item => item && item.id && !item.discarded) || tabs.find(item => item && item.id);
    if (!tab) return null;
    const results = await promiseWithTimeout(chromeExecuteScript({
      target: { tabId: tab.id },
      func: async function (requestPath, requestParams, requestMethod) {
        const url = new URL(requestPath, location.origin || 'https://music.163.com');
        const body = new URLSearchParams(requestParams || {});
        const init = {
          credentials: 'include',
          cache: 'no-store'
        };
        if (String(requestMethod || 'GET').toUpperCase() === 'POST') {
          init.method = 'POST';
          init.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
          init.body = body.toString();
        } else {
          url.search = body.toString();
        }
        const res = await fetch(url.toString(), init);
        const text = await res.text();
        try {
          return { ok: res.ok, status: res.status, json: JSON.parse(text) };
        } catch (err) {
          return { ok: false, status: res.status, error: text.slice(0, 200) };
        }
      },
      args: [path, params || {}, method || 'GET']
    }), 5500, []);
    const result = results && results[0] && results[0].result;
    if (result && result.ok && result.json) return result.json;
  } catch (err) {
    console.warn('[Mineradio Connector] music.163.com tab fetch failed', err);
  }
  return null;
}

async function neteaseFetchPlayerUrlV1(ids, level) {
  const params = {
    ids: '[' + ids.map(String).join(',') + ']',
    level: normalizeNeteaseLevel(level),
    encodeType: 'flac'
  };
  const tabData = await neteaseFetchJsonInMusicTab('/api/song/enhance/player/url/v1', params, 'POST');
  if (tabData) return tabData;
  return neteaseFetchJson(NETEASE_ORIGIN + '/api/song/enhance/player/url/v1', {
    method: 'POST',
    body: formBody(params),
    timeoutMs: 6500,
    headers: neteaseHeaders({
      Origin: NETEASE_ORIGIN,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    })
  });
}

async function neteaseFetchPlayerUrlLegacy(ids, br) {
  const params = new URLSearchParams({
    ids: '[' + ids.map(String).join(',') + ']',
    br: String(br || 128000)
  });
  return neteaseFetchJson(NETEASE_ORIGIN + '/api/song/enhance/player/url?' + params.toString(), { timeoutMs: 6500 });
}

function artistNames(list) {
  return (Array.isArray(list) ? list : [])
    .map(item => item && item.name)
    .filter(Boolean)
    .join(', ');
}

function coverUrl(song) {
  const album = song && (song.album || song.al) || {};
  const raw = album.picUrl || album.blurPicUrl || '';
  return raw || '';
}

function normalizeSong(song) {
  const album = song && (song.album || song.al) || {};
  const artists = song && (song.artists || song.ar) || [];
  return {
    provider: 'netease-extension',
    source: 'netease-extension',
    type: 'netease-extension',
    id: String(song.id || ''),
    name: song.name || '',
    artist: artistNames(artists),
    album: album.name || '',
    cover: coverUrl(song),
    duration: Math.round((Number(song.duration || song.dt) || 0) / 1000),
    fee: Number(song.fee || 0),
    playable: true,
    playbackChecked: false,
    playbackCode: 0,
    raw: {
      id: song.id,
      fee: song.fee,
      copyrightId: song.copyrightId,
      privilege: song.privilege || null
    }
  };
}

function ensureHttpsAudioUrl(url) {
  return String(url || '').replace(/^http:\/\//i, 'https://');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function randomHex(length) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

function md5Hex(value) {
  function rotateLeft(lValue, shiftBits) {
    return (lValue << shiftBits) | (lValue >>> (32 - shiftBits));
  }
  function addUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const result = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return result ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) return (result & 0x40000000) ? result ^ 0xc0000000 ^ lX8 ^ lY8 : result ^ 0x40000000 ^ lX8 ^ lY8;
    return result ^ lX8 ^ lY8;
  }
  function f(x, y, z) { return (x & y) | ((~x) & z); }
  function g(x, y, z) { return (x & z) | (y & (~z)); }
  function h(x, y, z) { return x ^ y ^ z; }
  function i(x, y, z) { return y ^ (x | (~z)); }
  function ff(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function gg(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function hh(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function ii(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function convertToWordArray(str) {
    const utf8 = unescape(encodeURIComponent(str));
    const wordArray = [];
    let byteCount = 0;
    while (byteCount < utf8.length) {
      wordArray[byteCount >> 2] |= utf8.charCodeAt(byteCount) << ((byteCount % 4) * 8);
      byteCount++;
    }
    wordArray[byteCount >> 2] |= 0x80 << ((byteCount % 4) * 8);
    wordArray[(((byteCount + 8) >> 6) + 1) * 16 - 2] = utf8.length * 8;
    return wordArray;
  }
  function wordToHex(value) {
    let out = '';
    for (let count = 0; count <= 3; count++) {
      out += ((value >>> (count * 8)) & 255).toString(16).padStart(2, '0');
    }
    return out;
  }
  const x = convertToWordArray(String(value || ''));
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  for (let k = 0; k < x.length; k += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;
    a = ff(a, b, c, d, x[k + 0], 7, 0xd76aa478);
    d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, x[k + 2], 17, 0x242070db);
    b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);
    a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
    c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);
    a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, x[k + 0], 11, 0xeaa127fa);
    c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, x[k + 6], 23, 0x4881d05);
    a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);
    a = ii(a, b, c, d, x[k + 0], 6, 0xf4292244);
    d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);
    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

function kugouHeaders(extra) {
  return Object.assign({
    Referer: KUGOU_ORIGIN + '/',
    Origin: KUGOU_ORIGIN
  }, extra || {});
}

function kugouCookieUrl() {
  return KUGOU_ORIGIN + '/';
}

function kugouCookieUrls() {
  return [
    KUGOU_ORIGIN + '/',
    KUGOU_MOBILE_ORIGIN + '/',
    KUGOU_MOBILE_ALT_ORIGIN + '/',
    'https://wwwapi.kugou.com/',
    'https://complexsearch.kugou.com/'
  ];
}

async function kugouCookie(name) {
  for (const url of kugouCookieUrls()) {
    try {
      const cookie = await chrome.cookies.get({ url, name });
      if (cookie && cookie.value) return cookie.value;
    } catch (err) {}
  }
  return '';
}

function kugouCompoundCookieValue(raw, key) {
  const pairs = String(raw || '').split('&');
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    const name = index >= 0 ? pair.slice(0, index) : pair;
    if (name === key) return index >= 0 ? pair.slice(index + 1) : '';
  }
  return '';
}

function decodeKugouCookieValue(value) {
  try { return decodeURIComponent(String(value || '').replace(/\+/g, '%20')).trim(); }
  catch (err) { return String(value || '').trim(); }
}

function kugouAuthFieldPattern() {
  return /^(kg_mid|mid|kg_dfid|dfid|KuGoo|KugooID|UserName|NickName|Pic|token|KuGooToken|t|a_id|ct|userid|userId|uid|vip|vip_.*|vip[A-Z].*|svip|svip_.*|svip[A-Z].*|is_vip|isVIP|isvip|member|member_.*|member[A-Z].*|is_member|isMember|green_vip|greenVip|luxury_vip|luxuryVip|music_vip|musicVip|m_type|mType|pay_type|payType|roam_type|roamType)$/i;
}

function kugouKeyLooksVip(key) {
  return /vip|svip|member|green|luxury|music[_-]?pack|pay|roam|m_type|mtype|expire|endtime|end_time/i.test(String(key || ''));
}

function kugouVipContextField(key) {
  const safe = String(key || '').replace(/[^a-z0-9_]/ig, '_');
  if (!safe) return '';
  return 'vip_' + safe;
}

function parseKugouCompoundCookie(raw) {
  const out = {};
  String(raw || '').split('&').forEach(pair => {
    const index = pair.indexOf('=');
    const key = index >= 0 ? pair.slice(0, index) : pair;
    if (!key) return;
    out[key] = decodeKugouCookieValue(index >= 0 ? pair.slice(index + 1) : '');
  });
  return out;
}

function mergeKugouAuthFields(target, source) {
  target = target || {};
  source = source || {};
  if (source.KuGoo) Object.assign(source, parseKugouCompoundCookie(source.KuGoo));
  Object.keys(source).forEach(key => {
    if (!key || !kugouAuthFieldPattern().test(key)) return;
    const value = source[key];
    if (value == null || String(value) === '') return;
    const current = target[key];
    if (current == null || String(current) === '' || /token|^t$|vip|svip|userid|uid/i.test(key)) target[key] = decodeKugouCookieValue(value);
  });
  return target;
}

function extractKugouAuthFromObject(value, out, depth, vipContext) {
  out = out || {};
  if (!value || depth > 4) return out;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return out;
    if (text.indexOf('=') > 0 && /KugooID|UserName|token|KuGooToken|vip|svip|member|green|luxury|m_type/i.test(text)) {
      mergeKugouAuthFields(out, parseCookieString(text.replace(/&/g, ';')));
      mergeKugouAuthFields(out, parseKugouCompoundCookie(text));
    }
    if ((text[0] === '{' && text[text.length - 1] === '}') || (text[0] === '[' && text[text.length - 1] === ']')) {
      try { extractKugouAuthFromObject(JSON.parse(text), out, depth + 1, vipContext || kugouKeyLooksVip(text)); } catch (err) {}
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => extractKugouAuthFromObject(item, out, depth + 1, vipContext));
    return out;
  }
  if (typeof value === 'object') {
    const direct = {};
    Object.keys(value).forEach(key => {
      const next = value[key];
      const nextVipContext = !!vipContext || kugouKeyLooksVip(key);
      if (kugouAuthFieldPattern().test(key)) direct[key] = next;
      else if (vipContext && /^(type|level|status|state|flag|value|isopen|is_open|expire|expiretime|endtime|end_time|label|name)$/i.test(key)) direct[kugouVipContextField(key)] = next;
      if (nextVipContext || /user|uid|token|kugou|kg_|dfid|mid/i.test(key)) extractKugouAuthFromObject(next, out, depth + 1, nextVipContext);
      else if (depth < 2 && (typeof next === 'object' || Array.isArray(next))) extractKugouAuthFromObject(next, out, depth + 1, vipContext);
    });
    mergeKugouAuthFields(out, direct);
  }
  return out;
}

async function kugouCookieObjectFromBrowser() {
  const entries = [];
  for (const url of kugouCookieUrls()) {
    try { entries.push(...await chrome.cookies.getAll({ url })); } catch (err) {}
  }
  const obj = {};
  entries.forEach(cookie => {
    if (!cookie || !cookie.name) return;
    mergeKugouAuthFields(obj, { [cookie.name]: cookie.value || '' });
  });
  return obj;
}

async function kugouTabs() {
  return queryTabsForOrigins([KUGOU_ORIGIN, KUGOU_MOBILE_ORIGIN, KUGOU_MOBILE_ALT_ORIGIN]);
}

async function kugouAuthObjectFromTab() {
  try {
    const tabs = await promiseWithTimeout(kugouTabs(), 1800, []);
    const tab = (tabs || []).find(item => item && item.id && !item.discarded) || (tabs || []).find(item => item && item.id);
    if (!tab) return {};
    const results = await promiseWithTimeout(chromeExecuteScript({
      target: { tabId: tab.id },
      func: function () {
        var out = {};
        var fieldPattern = /^(kg_mid|mid|kg_dfid|dfid|KuGoo|KugooID|UserName|NickName|Pic|token|KuGooToken|t|a_id|ct|userid|userId|uid|vip|vip_.*|vip[A-Z].*|svip|svip_.*|svip[A-Z].*|is_vip|isVIP|isvip|member|member_.*|member[A-Z].*|is_member|isMember|green_vip|greenVip|luxury_vip|luxuryVip|music_vip|musicVip|m_type|mType|pay_type|payType|roam_type|roamType)$/i;
        function put(name, value) {
          if (!name || value == null || String(value) === '') return;
          if (fieldPattern.test(name) || /kugou|kg_|dfid|token|vip|svip|member|green|luxury|pay|roam|m_type|user|uid/i.test(name + ' ' + value)) out[name] = String(value);
        }
        String(document.cookie || '').split(';').forEach(function (part) {
          var index = part.indexOf('=');
          put(index >= 0 ? part.slice(0, index).trim() : part.trim(), index >= 0 ? part.slice(index + 1).trim() : '');
        });
        function scanStorage(store) {
          try {
            for (var i = 0; i < store.length; i++) {
              var key = store.key(i);
              var value = store.getItem(key);
              put(key, value);
            }
          } catch (err) {}
        }
        scanStorage(localStorage);
        scanStorage(sessionStorage);
        return out;
      }
    }), 2400, []);
    return extractKugouAuthFromObject(results && results[0] && results[0].result || {}, {}, 0);
  } catch (err) {
    return {};
  }
}

async function readStoredKugouAuth() {
  const value = await storageLocalGet(KUGOU_AUTH_STORE_KEY);
  const item = value && value[KUGOU_AUTH_STORE_KEY] || null;
  return item && item.cookies ? item : null;
}

async function saveKugouAuthObject(cookieObj, source) {
  const merged = mergeKugouAuthFields({}, extractKugouAuthFromObject(cookieObj || {}, {}, 0));
  const cookies = sanitizeCookieObject(merged, kugouAuthFieldPattern());
  const userId = cookies.userid || cookies.userId || cookies.uid || cookies.KugooID || cookies.UserName || '';
  if (!userId && !cookies.token && !cookies.KuGooToken && !cookies.t && !cookies.KuGoo) return null;
  const item = { provider: 'kugou', cookies, savedAt: Date.now(), source: source || 'browser' };
  await storageLocalSet({ [KUGOU_AUTH_STORE_KEY]: item });
  return item;
}

async function kugouAuthObjectFromBrowser() {
  const cookieObj = await promiseWithTimeout(kugouCookieObjectFromBrowser(), 2200, {});
  const tabObj = await promiseWithTimeout(kugouAuthObjectFromTab(), 2600, {});
  const stored = await readStoredKugouAuth();
  const merged = mergeKugouAuthFields(mergeKugouAuthFields({}, stored && stored.cookies || {}), cookieObj);
  mergeKugouAuthFields(merged, tabObj);
  const liveCount = Object.keys(cookieObj || {}).length + Object.keys(tabObj || {}).length;
  const hasUser = merged.userid || merged.userId || merged.uid || merged.KugooID || merged.UserName;
  const hasToken = merged.token || merged.KuGooToken || merged.t;
  if (hasUser || hasToken || liveCount) await saveKugouAuthObject(merged, liveCount ? 'browser' : 'cache');
  if (stored && stored.savedAt) merged.__authCachedAt = stored.savedAt;
  merged.__authCached = !!(stored && stored.cookies && Object.keys(stored.cookies).length);
  return merged;
}

async function kugouSaveAuth(payload) {
  const cookieText = String(payload && (payload.cookie || payload.cookies || payload.text || payload.input) || '').trim();
  const cookieObj = cookieText ? parseCookieString(cookieText) : (payload && payload.cookies || {});
  const stored = await saveKugouAuthObject(cookieObj, 'manual');
  if (!stored) return { status: { provider: 'kugou', loggedIn: false, error: 'missing_cookie' } };
  return { status: await kugouStatus() };
}

async function kugouClearAuth() {
  await storageLocalRemove(KUGOU_AUTH_STORE_KEY);
  kugouCapabilityCache = { key: '', checkedAt: 0, result: null };
  return { ok: true };
}

function normalizeKugouVip(ctx) {
  const vip = normalizeVipSignals(ctx || {}, 'VIP');
  const sources = [ctx || {}, ctx && ctx.rawAuth || {}];
  const explicitVip = firstPositiveNumberFrom(sources, [
    'vipType', 'vip_type', 'viptype', 'vipLevel', 'vip_level', 'viplevel',
    'm_type', 'mType', 'memberType', 'member_type', 'memberLevel', 'member_level',
    'musicVipType', 'music_vip_type', 'musicVipLevel', 'music_vip_level',
    'greenVip', 'green_vip', 'greenVipLevel', 'green_vip_level',
    'luxuryVip', 'luxury_vip', 'luxuryVipLevel', 'luxury_vip_level',
    'vip_type', 'vip_level', 'vip_typeid', 'vip_levelid',
    'vip_type_', 'vip_level_', 'vip_type_id', 'vip_level_id'
  ]);
  const truthyFlags = sources.some(obj => obj && Object.keys(obj).some(key => {
    if (!kugouKeyLooksVip(key) && !/is_vip|isvip|is_member|ismember/i.test(key)) return false;
    const value = obj[key];
    const text = String(value == null ? '' : value).trim().toLowerCase();
    return value === true || Number(value) > 0 || /^(true|yes|open|opened|vip|svip|member)$/.test(text);
  }));
  const now = Date.now();
  const hasFutureExpire = sources.some(obj => obj && Object.keys(obj).some(key => {
    if (!/expire|endtime|end_time|expiretime/i.test(key)) return false;
    const raw = Number(obj[key] || 0) || 0;
    if (!raw) return false;
    const ms = raw > 100000000000 ? raw : raw * 1000;
    return ms > now;
  }));
  const text = collectVipStringValues(sources, [], 0).join(' ').toLowerCase();
  const svipText = /svip|super\s*vip|luxury|black\s*vip|\u8c6a\u534e|\u9ed1\u94bb/.test(text);
  const isSvip = !!vip.isSvip || svipText || explicitVip >= 10;
  const isVip = isSvip || !!vip.isVip || explicitVip > 0 || truthyFlags || hasFutureExpire;
  if (isVip) {
    vip.vipType = Math.max(Number(vip.vipType || 0) || 0, explicitVip || 1);
    vip.vipLevel = isSvip ? 'svip' : 'vip';
    vip.isVip = true;
    vip.isSvip = isSvip;
    vip.vipUnknown = false;
    vip.vipLabel = isSvip ? 'SVIP' : 'VIP';
  } else if (vip.vipUnknown || sources.some(obj => obj && Object.keys(obj).some(kugouKeyLooksVip))) {
    vip.vipUnknown = true;
    vip.vipLabel = 'VIP_UNKNOWN';
  }
  return vip;
}

async function kugouContext() {
  const auth = await kugouAuthObjectFromBrowser();
  const kgMid = auth.kg_mid || '';
  const mid = auth.mid || '';
  const kgDfid = auth.kg_dfid || '';
  const dfid = auth.dfid || '';
  const kugoo = auth.KuGoo || '';
  const compound = parseKugouCompoundCookie(kugoo);
  const kugooId = auth.KugooID || auth.userid || auth.userId || auth.uid || '';
  const userName = auth.UserName || '';
  const token = auth.token || '';
  const kuToken = auth.KuGooToken || auth.t || '';
  const vipType = auth.vip_type || auth.viptype || auth.vipType || 0;
  const compoundUserId = compound.KugooID || compound.UserName || kugouCompoundCookieValue(kugoo, 'KugooID') || kugouCompoundCookieValue(kugoo, 'UserName');
  const compoundToken = compound.t || kugouCompoundCookieValue(kugoo, 't');
  const resolvedMid = kgMid || mid || randomHex(32);
  const userId = compoundUserId || kugooId || userName || '0';
  return {
    mid: resolvedMid,
    uuid: resolvedMid,
    dfid: kgDfid || dfid || '',
    userid: userId,
    username: decodeKugouCookieValue(compound.NickName || compound.UserName || auth.NickName || userName || ''),
    avatar: decodeKugouCookieValue(compound.Pic || auth.Pic || ''),
    token: compoundToken || token || kuToken || '',
    vipType: Number(vipType || 0) || 0,
    rawAuth: auth,
    authCached: !!auth.__authCached,
    authCachedAt: Number(auth.__authCachedAt || 0) || 0,
    cacheAgeMs: auth.__authCachedAt ? Date.now() - Number(auth.__authCachedAt || 0) : 0,
    loggedIn: !!(userId && userId !== '0')
  };
}

function kugouSignedParams(params) {
  const signed = Object.assign({}, params);
  const raw = KUGOU_SIGN_SECRET + Object.keys(signed)
    .filter(key => key !== 'signature')
    .sort()
    .map(key => key + '=' + signed[key])
    .join('') + KUGOU_SIGN_SECRET;
  signed.signature = md5Hex(raw);
  return signed;
}

async function kugouFetchJson(url, options) {
  const text = await fetchText(url, Object.assign({
    credentials: 'include',
    referrer: KUGOU_ORIGIN + '/',
    headers: kugouHeaders()
  }, options || {}));
  const jsonText = text.trim().replace(/^callback\d*\(/, '').replace(/\)$/, '');
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error('Invalid JSON from kugou.com');
  }
}

function firstPositiveNumberFrom(objects, keys) {
  for (const obj of objects || []) {
    if (!obj || typeof obj !== 'object') continue;
    for (const key of keys || []) {
      const value = Number(obj[key] || 0) || 0;
      if (value > 0) return value;
    }
  }
  return 0;
}

function collectVipStringValues(value, out, depth) {
  out = out || [];
  depth = depth || 0;
  if (!value || depth > 2) return out;
  if (typeof value === 'string') {
    if (/vip|svip|浼氬憳|榛戣兌|璞崕|缁块捇/i.test(value)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectVipStringValues(item, out, depth + 1));
    return out;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(key => {
      if (/vip|member|level|label|type/i.test(key)) collectVipStringValues(value[key], out, depth + 1);
    });
  }
  return out;
}

function scanVipSignals(value, depth, state) {
  state = state || { number: 0, hasVip: false, hasSvip: false, hasSignal: false };
  if (value == null || depth > 5) return state;
  if (typeof value === 'number') {
    if (value > 0) {
      state.number = Math.max(state.number || 0, value);
      state.hasVip = true;
      state.hasSignal = true;
    }
    return state;
  }
  if (typeof value === 'boolean') {
    if (value) {
      state.hasVip = true;
      state.hasSignal = true;
    }
    return state;
  }
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (!text) return state;
    if (/^(true|yes|vip|svip)$/.test(text)) {
      state.hasVip = true;
      state.hasSignal = true;
    }
    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric > 0 && /^(\d+|\d+\.\d+)$/.test(text)) {
      state.number = Math.max(state.number || 0, numeric);
      state.hasVip = true;
      state.hasSignal = true;
    }
    if (/svip|super\s*vip|luxury|black\s*vip/i.test(text)) {
      state.hasVip = true;
      state.hasSvip = true;
      state.hasSignal = true;
    } else if (/vip|member|green\s*diamond|music\s*pack/i.test(text)) {
      state.hasVip = true;
      state.hasSignal = true;
    }
    return state;
  }
  if (Array.isArray(value)) {
    value.forEach(item => scanVipSignals(item, depth + 1, state));
    return state;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(key => {
      const lower = String(key || '').toLowerCase();
      const next = value[key];
      const keyLooksVip = /vip|svip|member|green|luxury|pay|level|type|isopen|is_open|expire|endtime/.test(lower);
      if (keyLooksVip) {
        state.hasSignal = true;
        if (/svip|super|luxury|black/.test(lower)) scanVipSignals({ svip: next }, depth + 1, state);
        else scanVipSignals(next, depth + 1, state);
      } else if (depth < 2 && (typeof next === 'object' || Array.isArray(next))) {
        scanVipSignals(next, depth + 1, state);
      }
    });
  }
  return state;
}

function normalizeVipSignals(value, fallbackLabel) {
  const signals = scanVipSignals(value, 0);
  const vipType = Number(signals.number || 0) || 0;
  const isSvip = !!signals.hasSvip || vipType >= 10;
  const isVip = isSvip || !!signals.hasVip || vipType > 0;
  const vipLevel = isSvip ? 'svip' : (isVip ? 'vip' : 'none');
  return {
    vipType,
    vipLevel,
    isVip,
    isSvip,
    vipUnknown: !isVip && !!signals.hasSignal,
    vipLabel: isSvip ? 'SVIP' : (isVip ? (fallbackLabel || 'VIP') : (signals.hasSignal ? 'VIP_UNKNOWN' : 'NO_VIP'))
  };
}

function normalizeNeteaseVip(profile, account, extra) {
  profile = profile || {};
  account = account || {};
  extra = extra || {};
  const vipInfo = profile.vipInfo || profile.vipinfo || account.vipInfo || account.vipinfo || extra.vipInfo || extra.vipinfo || {};
  const objects = [account, profile, vipInfo, extra];
  const vipType = firstPositiveNumberFrom(objects, [
    'vipType', 'vip_type', 'viptype', 'musicVipType', 'music_vip_type',
    'musicVipLevel', 'music_vip_level', 'redVipLevel', 'red_vip_level',
    'blackVipLevel', 'black_vip_level', 'luxuryVipLevel', 'luxury_vip_level',
    'svipType', 'svip_type'
  ]);
  const text = collectVipStringValues({ account, profile, vipInfo, extra }, [], 0).join(' ').toLowerCase();
  const svipFlag = objects.some(obj => obj && (
    obj.isSvip === true || obj.is_svip === true || obj.svip === true ||
    Number(obj.isSvip || obj.is_svip || obj.svip || obj.svipType || obj.svip_type || 0) > 0
  )) || /svip|supervip|super_vip|blackvip|black_vip|榛戣兌svip|瓒呯骇浼氬憳/.test(text);
  const vipFlag = objects.some(obj => obj && (
    obj.isVip === true || obj.is_vip === true || obj.vip === true ||
    Number(obj.isVip || obj.is_vip || obj.vip || obj.vipFlag || obj.vipflag || 0) > 0
  )) || /vip|榛戣兌|浼氬憳/.test(text);
  const isSvip = svipFlag || vipType >= 10;
  const isVip = isSvip || vipFlag || vipType > 0;
  const vipLevel = isSvip ? 'svip' : (isVip ? 'vip' : 'none');
  return {
    vipType,
    vipLevel,
    isVip,
    isSvip,
    vipLabel: vipLevel === 'svip' ? 'SVIP' : (vipLevel === 'vip' ? 'VIP' : '鏃燰IP')
  };
}

function normalizeNeteaseLoginInfo(profile, account, extra) {
  profile = profile || {};
  account = account || {};
  extra = extra || {};
  const userId = profile.userId || profile.user_id || profile.id || account.userId || account.id || '';
  const vip = normalizeNeteaseVip(profile, account, extra);
  return Object.assign({
    provider: 'netease',
    loggedIn: !!(userId || userId === 0),
    userId,
    nickname: profile.nickname || profile.userName || profile.name || '',
    avatar: profile.avatarUrl || profile.avatar || ''
  }, vip);
}

async function neteaseStatus() {
  const cookieObj = await promiseWithTimeout(neteaseAuthObjectFromBrowser(), 2600, {});
  const musicU = cookieObj.MUSIC_U || '';
  const csrf = cookieObj.__csrf || '';
  let profile = null;
  let account = null;
  let body = null;
  if (musicU) {
    try {
      const data = await neteaseFetchJson(NETEASE_ORIGIN + '/api/nuser/account/get?t=' + Date.now(), { cookieObj, timeoutMs: 4200 });
      body = data || null;
      profile = data && (data.profile || data.data && data.data.profile) || null;
      account = data && (data.account || data.data && data.data.account) || null;
    } catch (err) {
      console.warn('[Mineradio Connector] NetEase profile failed', err);
    }
  }
  const info = normalizeNeteaseLoginInfo(profile, account, body);
  return Object.assign({}, info, {
    provider: 'netease',
    loggedIn: !!musicU,
    hasCookie: !!Object.keys(cookieObj || {}).filter(key => key.indexOf('__auth') !== 0).length,
    hasCsrf: !!csrf,
    authCached: !!cookieObj.__authCached,
    authCachedAt: Number(cookieObj.__authCachedAt || 0) || 0,
    cacheAgeMs: cookieObj.__authCachedAt ? Date.now() - Number(cookieObj.__authCachedAt || 0) : 0,
    nickname: info.nickname || '',
    userId: info.userId || '',
    avatar: info.avatar || ''
  });
}

function normalizeNeteasePlaylist(pl, tag) {
  pl = pl || {};
  const creator = pl.creator || pl.user || {};
  const id = pl.id || pl.resourceId || pl.creativeId;
  return {
    provider: 'netease-extension',
    source: 'netease-extension',
    type: 'playlist',
    id: id ? String(id) : '',
    name: pl.name || pl.title || '',
    cover: pl.picUrl || pl.coverImgUrl || pl.coverUrl || pl.uiElement && pl.uiElement.image && pl.uiElement.image.imageUrl || '',
    trackCount: pl.trackCount || pl.songCount || pl.programCount || 0,
    playCount: pl.playCount || pl.playcount || 0,
    creator: creator.nickname || creator.name || '',
    tag: tag || pl.alg || ''
  };
}

async function neteaseHome() {
  const status = await neteaseStatus();
  if (!status.loggedIn) {
    return { loggedIn: false, user: null, dailySongs: [], playlists: [], podcasts: [], mode: 'starter', updatedAt: Date.now() };
  }
  const tasks = await Promise.allSettled([
    neteaseFetchJson(NETEASE_ORIGIN + '/api/v3/discovery/recommend/songs?t=' + Date.now()),
    neteaseFetchJson(NETEASE_ORIGIN + '/api/v1/discovery/recommend/resource?t=' + Date.now()),
    status.userId ? neteaseFetchJson(NETEASE_ORIGIN + '/api/user/playlist?' + new URLSearchParams({ uid: status.userId, limit: String(NETEASE_HOME_PLAYLIST_LIMIT), offset: '0', t: Date.now().toString() }).toString()) : Promise.resolve({ playlist: [] })
  ]);
  const dailyBody = tasks[0].status === 'fulfilled' ? tasks[0].value || {} : {};
  const dailyRaw = dailyBody.data && (dailyBody.data.dailySongs || dailyBody.data.recommend) || dailyBody.recommend || [];
  let dailySongs = (Array.isArray(dailyRaw) ? dailyRaw : []).map(normalizeSong).filter(song => song.id && song.name).slice(0, 12);
  dailySongs = await enrichNeteaseSongs(dailySongs);
  dailySongs = dailySongs.filter(song => song.playable !== false);
  const recommendBody = tasks[1].status === 'fulfilled' ? tasks[1].value || {} : {};
  const recommendPlaylists = (recommendBody.recommend || recommendBody.data || []).map(item => normalizeNeteasePlaylist(item, 'playlist')).filter(item => item.id && item.name);
  const userBody = tasks[2].status === 'fulfilled' ? tasks[2].value || {} : {};
  const userPlaylists = (userBody.playlist || userBody.data || []).map(item => normalizeNeteasePlaylist(item, 'playlist')).filter(item => item.id && item.name);
  const seen = new Set();
  const playlists = userPlaylists.concat(recommendPlaylists).filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, NETEASE_HOME_PLAYLIST_RENDER_LIMIT);
  return {
    loggedIn: true,
    user: { provider: 'netease', userId: status.userId || '', nickname: status.nickname || '', avatar: status.avatar || '' },
    dailySongs,
    playlists,
    podcasts: [],
    mode: 'connector',
    updatedAt: Date.now()
  };
}

async function neteasePlaylistTracks(payload) {
  const id = String(payload && payload.id || '').trim();
  if (!id) throw new Error('Missing playlist id');
  const data = await neteaseFetchJson(NETEASE_ORIGIN + '/api/v6/playlist/detail?' + new URLSearchParams({ id, n: '1000', s: '8', t: Date.now().toString() }).toString());
  const playlist = data && data.playlist || {};
  let tracks = (playlist.tracks || []).map(normalizeSong).filter(song => song.id && song.name).slice(0, NETEASE_PLAYLIST_TRACK_LIMIT);
  tracks = await enrichNeteaseSongs(tracks);
  return { provider: 'netease-extension', playlist: normalizeNeteasePlaylist(playlist, 'playlist'), tracks };
}

async function neteaseSearch(payload) {
  const q = String(payload && payload.q || '').trim();
  const limit = Math.max(1, Math.min(30, Number(payload && payload.limit) || 12));
  if (!q) return { songs: [] };
  const url = NETEASE_ORIGIN + '/api/search/get/web?' + new URLSearchParams({
    s: q,
    type: '1',
    limit: String(limit),
    offset: '0'
  }).toString();
  const data = await neteaseFetchJson(url);
  let songs = ((data.result && data.result.songs) || []).map(normalizeSong).filter(song => song.id && song.name);
  songs = await enrichNeteaseSongs(songs);
  return { songs };
}

async function enrichNeteaseSongs(songs) {
  if (!songs.length) return songs;
  const ids = songs.map(song => Number(song.id)).filter(Boolean);
  const detailMap = await neteaseSongDetails(ids);
  songs.forEach(song => {
    const detail = detailMap.get(Number(song.id));
    if (!detail) return;
    const album = detail.album || detail.al || {};
    const artists = detail.artists || detail.ar || [];
    song.cover = album.picUrl || album.blurPicUrl || song.cover || '';
    song.album = album.name || song.album || '';
    song.artist = artistNames(artists) || song.artist || '';
    song.duration = Math.round((Number(detail.duration || detail.dt) || song.duration * 1000 || 0) / 1000);
  });
  const playability = await neteaseBatchSongUrls(ids);
  songs.forEach(song => {
    const item = playability.get(Number(song.id));
    if (!item) return;
    song.playbackChecked = true;
    song.playbackCode = item.code || 0;
    song.playable = true;
    song.previewOnly = false;
    if (item.url && Number(item.code || 0) === 200) song.probedAudioUrl = ensureHttpsAudioUrl(item.url);
    else song.playbackProbeFailed = true;
  });
  return songs;
}

async function neteaseSongDetails(ids) {
  const out = new Map();
  if (!ids.length) return out;
  try {
    const data = await neteaseFetchJson(NETEASE_ORIGIN + '/api/song/detail?ids=' + encodeURIComponent(JSON.stringify(ids)));
    ((data && data.songs) || []).forEach(song => out.set(Number(song.id), song));
  } catch (err) {
    console.warn('[Mineradio Connector] detail enrich failed', err);
  }
  return out;
}

async function neteaseBatchSongUrls(ids) {
  const out = new Map();
  if (!ids.length) return out;
  try {
    let data = await neteaseFetchPlayerUrlV1(ids, NETEASE_DEFAULT_LEVEL);
    let items = (data && data.data) || [];
    items.forEach(item => out.set(Number(item.id), item));
    const missingIds = ids.filter(id => {
      const item = out.get(Number(id));
      return !item || !item.url;
    });
    if (missingIds.length) {
      data = await neteaseFetchPlayerUrlLegacy(missingIds, 128000);
      items = (data && data.data) || [];
      items.forEach(item => out.set(Number(item.id), item));
    }
  } catch (err) {
    console.warn('[Mineradio Connector] playability probe failed', err);
  }
  return out;
}

async function neteaseLyric(payload) {
  const id = String(payload && payload.id || '').trim();
  if (!id) throw new Error('Missing song id');
  const url = NETEASE_ORIGIN + '/api/song/lyric?' + new URLSearchParams({
    id,
    lv: '1',
    kv: '1',
    tv: '-1'
  }).toString();
  const data = await neteaseFetchJson(url);
  return {
    lyric: data && data.lrc && data.lrc.lyric || '',
    tlyric: data && data.tlyric && data.tlyric.lyric || ''
  };
}

async function neteaseSongUrl(payload) {
  const id = String(payload && payload.id || '').trim();
  const br = String(payload && payload.br || 128000);
  const level = normalizeNeteaseLevel(payload && payload.level);
  if (!id) throw new Error('Missing song id');
  let data = await neteaseFetchPlayerUrlV1([id], level);
  let item = data && data.data && data.data[0] || {};
  if (!item.url) {
    data = await neteaseFetchPlayerUrlLegacy([id], br);
    item = data && data.data && data.data[0] || {};
  }
  const url = ensureHttpsAudioUrl(item.url || '');
  return {
    provider: 'netease-extension',
    url,
    level: item.level || 'standard',
    quality: item.level || 'standard',
    code: item.code || 0,
    br: item.br || 0,
    fee: item.fee,
    trial: !!item.freeTrialInfo,
    playable: !!url && Number(item.code || 0) === 200,
    reason: url ? '' : 'url_unavailable',
    message: url ? '' : 'audio_url_unavailable'
  };
}

function kugouCoverUrl(raw) {
  raw = String(raw || '');
  if (!raw) return '';
  return ensureHttpsAudioUrl(raw.replace('{size}', '480'));
}

function normalizeKugouSong(song) {
  song = song || {};
  const id = song.EMixSongID || song.MixSongID || song.Audioid || song.ID || song.FileHash || '';
  const cover = kugouCoverUrl(song.Image || song.AlbumImage || (song.trans_param && song.trans_param.union_cover) || '');
  return {
    provider: 'kugou-extension',
    source: 'kugou-extension',
    type: 'kugou-extension',
    id: String(id || ''),
    mid: String(song.EMixSongID || ''),
    hash: song.FileHash || '',
    albumId: String(song.AlbumID || ''),
    name: stripHtml(song.SongName || song.OriSongName || ''),
    artist: stripHtml(song.SingerName || (Array.isArray(song.Singers) ? song.Singers.map(item => item && item.name).filter(Boolean).join(', ') : '')),
    album: stripHtml(song.AlbumName || ''),
    cover,
    duration: Number(song.Duration || 0) || 0,
    fee: Number(song.PayType || 0) ? 1 : 0,
    playable: true,
    playbackChecked: false,
    playbackCode: 0,
    raw: {
      id: song.ID,
      mixSongId: song.MixSongID,
      eMixSongId: song.EMixSongID,
      fileHash: song.FileHash,
      albumId: song.AlbumID,
      privilege: song.Privilege,
      payType: song.PayType,
      failProcess: song.FailProcess
    }
  };
}

function parseKugouShareInput(value) {
  const raw = String(value || '').trim();
  const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
  const urlText = urlMatch ? urlMatch[0].replace(/[锛屻€傘€佲€溾€濃€樷€欙級)\]]+$/g, '') : raw;
  let parsed = null;
  try { parsed = new URL(urlText); } catch (err) {}
  const source = parsed ? parsed.toString() : raw;
  const gcidMatch = source.match(/gcid_([a-z0-9]+)/i) || source.match(/[?&](?:src_cid|global_collection_id)=([a-z0-9]+)/i);
  const uid = parsed ? (parsed.searchParams.get('uid') || '') : ((raw.match(/[?&]uid=(\d+)/) || [])[1] || '');
  const cover = parsed ? (parsed.searchParams.get('cover') || '') : '';
  const titleMatch = raw.match(/姝屽崟[銆?]([^銆?]+)[銆?]/);
  return {
    url: urlText,
    gcid: gcidMatch ? gcidMatch[1] : '',
    uid,
    cover,
    title: titleMatch ? titleMatch[1] : ''
  };
}

function kugouMobileSonglistUrl(info) {
  const gcid = String(info && info.gcid || '').replace(/^gcid_/i, '');
  if (!gcid) return '';
  const url = new URL('/songlist/gcid_' + gcid + '/', KUGOU_MOBILE_ORIGIN);
  url.searchParams.set('iszlist', '1');
  url.searchParams.set('src_cid', gcid);
  if (info && info.uid) url.searchParams.set('uid', info.uid);
  if (info && info.cover) url.searchParams.set('cover', info.cover);
  url.searchParams.set('chl', 'weibo');
  return url.toString();
}

function extractWindowOutputJson(html) {
  const marker = 'window.$output';
  const markerIndex = String(html || '').indexOf(marker);
  if (markerIndex < 0) return null;
  const equalsIndex = html.indexOf('=', markerIndex);
  if (equalsIndex < 0) return null;
  let index = equalsIndex + 1;
  while (/\s/.test(html[index] || '')) index++;
  if (html[index] !== '{') return null;
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = index; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(index, i + 1);
    }
  }
  return null;
}

function normalizeKugouSharedSong(song) {
  song = song || {};
  const nameText = stripHtml(song.name || song.songname || song.fileName || song.filename || '');
  let artist = '';
  let title = nameText;
  const splitIndex = nameText.indexOf(' - ');
  if (splitIndex > 0) {
    artist = nameText.slice(0, splitIndex).trim();
    title = nameText.slice(splitIndex + 3).trim();
  }
  if (!artist && Array.isArray(song.singerinfo)) artist = song.singerinfo.map(item => item && item.name).filter(Boolean).join(', ');
  if (!artist) artist = song.singerName || song.author_name || '';
  const cover = kugouCoverUrl(song.cover || song.imgUrl || song.Image || (song.trans_param && song.trans_param.union_cover) || '');
  const id = song.mixsongid || song.add_mixsongid || song.EMixSongID || song.MixSongID || song.audio_id || song.hash || '';
  return {
    provider: 'kugou-extension',
    source: 'kugou-extension',
    type: 'kugou-extension',
    id: String(id || ''),
    mid: String(song.mixsongid || song.add_mixsongid || song.EMixSongID || song.MixSongID || ''),
    hash: song.hash || song.FileHash || '',
    albumId: String(song.album_id || song.AlbumID || song.req_albumid || ''),
    name: title || nameText,
    artist: stripHtml(artist),
    album: stripHtml(song.remark || song.albumName || song.AlbumName || song.albuminfo && song.albuminfo.name || ''),
    cover,
    duration: Math.round((Number(song.timelen || song.timeLength || 0) || 0) / 1000),
    fee: Number(song.feetype || song.pay_type || 0) ? 1 : 0,
    playable: true,
    playbackChecked: false,
    playbackCode: 0,
    raw: {
      hash: song.hash || '',
      mixSongId: song.mixsongid || song.add_mixsongid || '',
      albumId: song.album_id || '',
      privilege: song.privilege,
      payType: song.pay_type || song.feetype
    }
  };
}

function normalizeKugouSharedPlaylist(data, fallbackInfo) {
  const info = data && data.info || {};
  const listInfo = info.listinfo || {};
  const rawSongs = Array.isArray(info.songs) ? info.songs : [];
  const tracks = rawSongs
    .slice(0, KUGOU_SHARED_PLAYLIST_TRACK_LIMIT)
    .map(normalizeKugouSharedSong)
    .filter(song => song.id && song.name);
  const cover = kugouCoverUrl(listInfo.pic || fallbackInfo.cover || '');
  const trackCount = Number(listInfo.count || info.count || tracks.length) || tracks.length;
  const loadedCount = tracks.length;
  const partial = trackCount > loadedCount;
  const partialReason = partial ? 'kugou_h5_limited' : '';
  return {
    provider: 'kugou-extension',
    playlist: {
      provider: 'kugou-extension',
      source: 'kugou-extension',
      type: 'playlist',
      id: 'kugou:gcid_' + String(fallbackInfo.gcid || ''),
      name: listInfo.name || fallbackInfo.title || '閰风嫍鍒嗕韩姝屽崟',
      cover,
      trackCount,
      loadedCount,
      partial,
      partialReason,
      playCount: Number(listInfo.heat || 0) || 0,
      creator: listInfo.list_create_username || fallbackInfo.uid || '',
      tag: '閰风嫍鍒嗕韩'
    },
    tracks,
    trackCount,
    loadedCount,
    partial,
    partialReason
  };
}

async function kugouSharedPlaylist(payload) {
  const info = parseKugouShareInput(payload && (payload.url || payload.text || payload.q || payload.input));
  if (!info.gcid) throw new Error('Missing Kugou shared playlist id');
  const mobileUrl = kugouMobileSonglistUrl(info);
  const text = await fetchText(mobileUrl, {
    credentials: 'include',
    referrer: KUGOU_MOBILE_ORIGIN + '/',
    headers: kugouHeaders({
      Referer: KUGOU_MOBILE_ORIGIN + '/',
      Origin: KUGOU_MOBILE_ORIGIN,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
    })
  });
  const jsonText = extractWindowOutputJson(text);
  if (!jsonText) throw new Error('Kugou shared playlist returned no playlist data');
  let data = null;
  try { data = JSON.parse(jsonText); }
  catch (err) { throw new Error('Kugou shared playlist parse failed'); }
  const result = normalizeKugouSharedPlaylist(data, info);
  if (!result.tracks.length) throw new Error('Kugou shared playlist has no readable tracks');
  return result;
}



function parseCookieString(raw) {
  const out = {};
  String(raw || '').split(';').forEach(part => {
    const index = part.indexOf('=');
    const key = (index >= 0 ? part.slice(0, index) : part).trim();
    if (!key) return;
    out[key] = index >= 0 ? part.slice(index + 1).trim() : '';
  });
  return out;
}

function serializeCookieObject(obj) {
  return Object.keys(obj || {})
    .filter(key => key && !COOKIE_ATTRIBUTE_NAMES.has(String(key).toLowerCase()) && key.indexOf('__auth') !== 0)
    .filter(key => obj[key] != null && String(obj[key]) !== '')
    .map(key => key + '=' + String(obj[key]))
    .join('; ');
}

function normalizeQQUin(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || digits;
}

function qqCookieUin(obj) {
  obj = obj || {};
  const raw = Number(obj.login_type) === 2
    ? (obj.wxuin || obj.uin || obj.p_uin || obj.luin || obj.pt2gguin || obj.o_cookie)
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || obj.luin || obj.pt2gguin || obj.o_cookie);
  return normalizeQQUin(raw);
}

function qqCookieOpenId(obj) {
  obj = obj || {};
  return obj.openid || obj.psrf_qqopenid || obj.wxopenid || obj.qqmusic_openid || '';
}

function qqAuthFieldPattern() {
  return /^(uin|qqmusic_uin|wxuin|p_uin|luin|pt2gguin|o_cookie|openid|wxopenid|psrf_qqopenid|qqmusic_openid|qm_keyst|qqmusic_key|music_key|psrf_musickey|p_skey|p_lskey|skey|wxskey|psrf_qqaccess_token|psrf_qqrefresh_token|wxrefresh_token|tmeLoginKey|access_token|psrf_access_token|login_type|tmeLoginType|ptnick.*)$/i;
}

function mergeQQAuthFields(target, source) {
  target = target || {};
  Object.keys(source || {}).forEach(key => {
    if (!key || !qqAuthFieldPattern().test(key)) return;
    if (source[key] == null || String(source[key]) === '') return;
    if (target[key] == null || String(target[key]) === '' || /key|token|skey|openid/i.test(key)) target[key] = String(source[key]);
  });
  return target;
}

async function readStoredQQAuth() {
  const value = await storageLocalGet(QQ_AUTH_STORE_KEY);
  const item = value && value[QQ_AUTH_STORE_KEY] || null;
  return item && item.cookies ? item : null;
}

async function saveQQAuthObject(cookieObj, source) {
  const cookies = sanitizeCookieObject(cookieObj, qqAuthFieldPattern());
  if (!Object.keys(cookies).length) return null;
  const item = { provider: 'qq', cookies, savedAt: Date.now(), source: source || 'browser' };
  await storageLocalSet({ [QQ_AUTH_STORE_KEY]: item });
  return item;
}

async function qqSaveAuth(payload) {
  const cookieText = String(payload && (payload.cookie || payload.cookies || payload.text || payload.input) || '').trim();
  const cookieObj = cookieText ? parseCookieString(cookieText) : (payload && payload.cookies || {});
  const stored = await saveQQAuthObject(cookieObj, 'manual');
  if (!stored) return { status: { provider: 'qq', loggedIn: false, error: 'missing_cookie' } };
  return { status: await qqStatus() };
}

async function qqClearAuth() {
  await storageLocalRemove(QQ_AUTH_STORE_KEY);
  return { ok: true };
}

function qqCookieMusicKey(obj) {
  obj = obj || {};
  return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.psrf_musickey || obj.p_skey || obj.p_lskey || obj.skey ||
    obj.psrf_qqaccess_token || obj.psrf_qqrefresh_token || obj.wxrefresh_token || obj.wxskey ||
    obj.tmeLoginKey || obj.access_token || obj.psrf_access_token || '';
}

function qqCookiePlaybackKey(obj) {
  obj = obj || {};
  return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.psrf_musickey || obj.wxskey || obj.p_skey || obj.p_lskey || '';
}

function qqCookieLoginReady(obj) {
  obj = obj || {};
  if (!qqCookieUin(obj) && !qqCookieOpenId(obj)) return false;
  return !!(qqCookieMusicKey(obj) || obj.uin || obj.p_uin || obj.qqmusic_uin || obj.wxuin ||
    obj.luin || obj.pt2gguin || obj.o_cookie || obj.openid || obj.wxopenid || obj.psrf_qqopenid || obj.login_type || obj.tmeLoginType);
}

function qqTabProbeLooksLoggedIn(probe) {
  if (!probe || probe.error) return false;
  return !!(probe.hasLoginText ||
    (Array.isArray(probe.cookieNames) && probe.cookieNames.length) ||
    (Array.isArray(probe.storageKeys) && probe.storageKeys.length));
}

function qqTabInfoLooksLoggedIn(tab) {
  if (!tab) return false;
  const title = String(tab.title || '');
  const url = String(tab.url || '');
  return /鎴戠殑闊充箰|鎴戝枩娆涓汉涓婚〉|宸茬櫥褰晐璐﹀彿|profile|like\/song|profile\/create|profile\/buy|profile\/focus/i.test(title + ' ' + url);
}

async function qqMusicTabs() {
  return queryTabsForOrigins([QQ_ORIGIN, 'https://i.y.qq.com']);
}

function qqBestMusicTab(tabs) {
  const list = Array.isArray(tabs) ? tabs : [];
  const usableTabs = list.filter(item => item && item.id && !item.discarded);
  return usableTabs.find(qqTabInfoLooksLoggedIn) || list.find(qqTabInfoLooksLoggedIn) || usableTabs[0] || list.find(item => item && item.id) || null;
}

async function qqVisibleTabSession() {
  try {
    const tabs = await promiseWithTimeout(qqMusicTabs(), 1800, []);
    const tab = qqBestMusicTab(tabs);
    return {
      ready: !!(tabs || []).length,
      loggedIn: qqTabInfoLooksLoggedIn(tab),
      title: tab && tab.title || '',
      url: tab && tab.url || '',
      tabCount: (tabs || []).length
    };
  } catch (err) {
    return { ready: false, loggedIn: false, error: err && err.message || String(err) };
  }
}

function mergeQQTabProbeStatus(profile, probe) {
  profile = profile || {};
  const tabLoggedIn = qqTabProbeLooksLoggedIn(probe);
  profile.tabLoggedIn = tabLoggedIn;
  if (probe && probe.playbackKeyReady) profile.playbackKeyReady = true;
  if (probe && probe.openIdReady) profile.openIdReady = true;
  if (tabLoggedIn && !profile.loggedIn) {
    profile.loggedIn = true;
    profile.partialLogin = true;
    profile.stale = true;
    profile.nickname = profile.nickname || 'QQ Music';
  }
  return profile;
}

function mergeQQVisibleTabStatus(profile, tabSession) {
  profile = profile || {};
  tabSession = tabSession || {};
  profile.musicTabReady = !!tabSession.ready;
  profile.visibleTabLoggedIn = !!tabSession.loggedIn;
  profile.visibleTabTitle = tabSession.title || '';
  profile.visibleTabUrl = tabSession.url || '';
  profile.visibleTabCount = tabSession.tabCount || 0;
  if (tabSession.loggedIn && !profile.loggedIn) {
    profile.loggedIn = true;
    profile.partialLogin = true;
    profile.stale = true;
    profile.nickname = profile.nickname || 'QQ Music';
  }
  return profile;
}

async function qqMusicTabReady() {
  try {
    const tabs = await promiseWithTimeout(qqMusicTabs(), 1800, []);
    return tabs.some(item => item && item.id && !item.discarded);
  } catch (err) {
    return false;
  }
}

async function qqTabLoginProbe() {
  try {
    const tabs = await promiseWithTimeout(qqMusicTabs(), 1800, []);
    const tab = qqBestMusicTab(tabs);
    if (!tab) return null;
    const results = await promiseWithTimeout(chromeExecuteScript({
      target: { tabId: tab.id },
      func: function () {
        var cookieNames = String(document.cookie || '').split(';').map(function (part) {
          return part.split('=')[0].trim();
        }).filter(Boolean);
        var text = '';
        try { text = document.body ? document.body.innerText.slice(0, 800) : ''; } catch (err) {}
        var title = '';
        try { title = document.title || ''; } catch (err) {}
        var storageKeys = [];
        try {
          for (var i = 0; i < localStorage.length; i++) storageKeys.push(localStorage.key(i));
        } catch (err) {}
        var playbackKeyPattern = /qm_keyst|qqmusic_key|music_key|psrf_musickey|p_skey|p_lskey|wxskey|access_token|refresh_token/i;
        var openIdPattern = /openid|wxopenid|psrf_qqopenid/i;
        var authCookieNames = cookieNames.filter(function (name) { return playbackKeyPattern.test(name); });
        var authStorageKeys = storageKeys.filter(function (name) { return playbackKeyPattern.test(name); });
        return {
          href: location.href,
          title: title,
          cookieNames: cookieNames.filter(function (name) { return /uin|skey|qqmusic|qm_|token|login|openid|wx|ptnick|psrf/i.test(name); }).slice(0, 24),
          hasLoginText: /閫€鍑簗涓汉涓婚〉|鎴戠殑闊充箰|鎴戝枩娆宸茬櫥褰晐璐﹀彿|profile|like\/song/i.test(text + ' ' + title + ' ' + location.href),
          storageKeys: storageKeys.filter(function (name) { return /uin|skey|qqmusic|token|login|user|profile|openid|psrf/i.test(name); }).slice(0, 24),
          playbackKeyReady: !!(authCookieNames.length || authStorageKeys.length),
          openIdReady: cookieNames.some(function (name) { return openIdPattern.test(name); }) || storageKeys.some(function (name) { return openIdPattern.test(name); })
        };
      }
    }), 2200, [{ result: { error: 'qq_tab_probe_timeout', href: tab.url || '', title: tab.title || '' } }]);
    return results && results[0] && results[0].result || null;
  } catch (err) {
    return { error: err && err.message || String(err) };
  }
}

function qqCookieDiagnosticNames(obj) {
  return Object.keys(obj || {})
    .filter(name => /uin|skey|qqmusic|qm_|token|login|openid|wx|ptnick|psrf/i.test(name))
    .slice(0, 18);
}

function decodeQQCookieValue(value) {
  try { return decodeURIComponent(String(value || '').replace(/\+/g, '%20')).trim(); }
  catch (err) { return String(value || '').trim(); }
}

function qqCookieNickname(obj, uin) {
  obj = obj || {};
  uin = normalizeQQUin(uin || qqCookieUin(obj));
  const padded = uin ? '0' + uin : '';
  const keys = [uin && ('ptnick_' + uin), padded && ('ptnick_' + padded), 'ptnick', 'nick', 'nickname', 'qq_nickname'].filter(Boolean);
  for (const key of keys) {
    if (obj[key]) {
      const nick = decodeQQCookieValue(obj[key]);
      if (nick) return nick;
    }
  }
  const ptnickKey = Object.keys(obj).find(key => /^ptnick_/i.test(key) && obj[key]);
  return ptnickKey ? decodeQQCookieValue(obj[ptnickKey]) : '';
}

function qqCookieAvatar(obj, uin) {
  obj = obj || {};
  const direct = obj.qqmusic_avatar || obj.avatar || obj.avatarUrl || obj.headpic || obj.headurl || '';
  if (direct) return decodeQQCookieValue(direct);
  const candidates = [obj.o_cookie, obj.p_uin, obj.uin, obj.luin, obj.pt2gguin, uin || qqCookieUin(obj)];
  for (const candidate of candidates) {
    const avatarUin = normalizeQQUin(candidate);
    if (avatarUin && avatarUin.length >= 5 && avatarUin.length <= 11) {
      return 'https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(avatarUin) + '&s=100';
    }
  }
  return '';
}

async function qqCookieObjectFromBrowser() {
  const urls = [
    QQ_ORIGIN + '/',
    'https://y.qq.com/n/ryqq/profile',
    'https://u.y.qq.com/',
    'https://c.y.qq.com/',
    'https://i.y.qq.com/',
    'https://qq.com/',
    'https://graph.qq.com/',
    'https://ptlogin2.qq.com/',
    'https://ssl.ptlogin2.qq.com/'
  ];
  const entries = [];
  for (const url of urls) {
    try {
      const cookies = await chrome.cookies.getAll({ url });
      entries.push(...cookies);
    } catch (err) {}
  }
  const obj = {};
  entries.forEach(cookie => {
    if (!cookie || !cookie.name) return;
    if (obj[cookie.name] == null || /qqmusic|qm_|uin|skey|token|ptnick|openid|psrf|wx/i.test(cookie.name)) obj[cookie.name] = cookie.value || '';
  });
  if (Number(obj.login_type) === 2 && obj.wxuin && !obj.uin) obj.uin = obj.wxuin;
  if (!obj.uin && (obj.qqmusic_uin || obj.p_uin || obj.luin || obj.pt2gguin || obj.o_cookie)) {
    obj.uin = obj.qqmusic_uin || obj.p_uin || obj.luin || obj.pt2gguin || obj.o_cookie;
  }
  if (obj.uin) obj.uin = normalizeQQUin(obj.uin);
  return obj;
}

async function qqAuthObjectFromMusicTab() {
  try {
    const tabs = await promiseWithTimeout(qqMusicTabs(), 1800, []);
    const tab = qqBestMusicTab(tabs);
    if (!tab) return {};
    const results = await promiseWithTimeout(chromeExecuteScript({
      target: { tabId: tab.id },
      func: function () {
        var out = {};
        var authPattern = /^(uin|qqmusic_uin|wxuin|p_uin|luin|pt2gguin|o_cookie|openid|wxopenid|psrf_qqopenid|qqmusic_openid|qm_keyst|qqmusic_key|music_key|psrf_musickey|p_skey|p_lskey|skey|wxskey|psrf_qqaccess_token|psrf_qqrefresh_token|wxrefresh_token|tmeLoginKey|access_token|psrf_access_token|login_type|tmeLoginType|ptnick.*)$/i;
        String(document.cookie || '').split(';').forEach(function (part) {
          var index = part.indexOf('=');
          var name = index >= 0 ? part.slice(0, index).trim() : part.trim();
          var value = index >= 0 ? part.slice(index + 1).trim() : '';
          if (name && authPattern.test(name) && value) out[name] = value;
        });
        function scanStorage(store) {
          try {
            for (var i = 0; i < store.length; i++) {
              var key = store.key(i);
              if (!key || !authPattern.test(key)) continue;
              var value = store.getItem(key);
              if (value) out[key] = value;
            }
          } catch (err) {}
        }
        scanStorage(localStorage);
        scanStorage(sessionStorage);
        return out;
      }
    }), 2200, []);
    return results && results[0] && results[0].result || {};
  } catch (err) {
    return {};
  }
}

async function qqAuthObjectFromBrowser() {
  const cookieObj = await promiseWithTimeout(qqCookieObjectFromBrowser(), 2200, {});
  const tabObj = await promiseWithTimeout(qqAuthObjectFromMusicTab(), 2600, {});
  const stored = await readStoredQQAuth();
  const merged = mergeQQAuthFields(mergeQQAuthFields({}, stored && stored.cookies || {}), cookieObj);
  mergeQQAuthFields(merged, tabObj);
  const liveCount = Object.keys(cookieObj || {}).length + Object.keys(tabObj || {}).length;
  if (qqCookieLoginReady(merged) || liveCount) await saveQQAuthObject(merged, liveCount ? 'browser' : 'cache');
  if (stored && stored.savedAt) merged.__authCachedAt = stored.savedAt;
  merged.__authCached = !!(stored && stored.cookies && Object.keys(stored.cookies).length);
  return merged;
}

function qqHeaders(extra) {
  return Object.assign({
    Referer: QQ_ORIGIN + '/',
    Origin: QQ_ORIGIN
  }, extra || {});
}

async function qqFetchText(url, options) {
  options = options || {};
  const cookieObj = options.cookieObj || await qqAuthObjectFromBrowser();
  const cookieHeader = serializeCookieObject(cookieObj);
  const headers = qqHeaders(Object.assign({}, options.headers || {}, cookieHeader ? { Cookie: cookieHeader } : {}));
  const init = Object.assign({
    credentials: 'include',
    cache: 'no-store',
    referrer: options.referrer || QQ_ORIGIN + '/',
    headers
  }, options, { headers });
  delete init.cookieObj;
  delete init.timeoutMs;
  const fetched = await fetchTextWithTimeout(url, init, options.timeoutMs || 8000);
  const res = fetched.res;
  const body = fetched.text;
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + body.slice(0, 120));
  return body;
}

function parseJsonLoose(raw, source) {
  const clean = String(raw || '').trim().replace(/^callback\d*\(/, '').replace(/\)$/, '');
  try { return JSON.parse(clean); }
  catch (err) { throw new Error('Invalid JSON from ' + source); }
}

async function qqFetchJsonInMusicTab(targetUrl, requestOptions) {
  try {
    const tabs = await promiseWithTimeout(qqMusicTabs(), 1800, []);
    const tab = qqBestMusicTab(tabs);
    if (!tab) return null;
    const results = await promiseWithTimeout(chromeExecuteScript({
      target: { tabId: tab.id },
      func: async function (url, options) {
        const init = Object.assign({
          credentials: 'include',
          cache: 'no-store'
        }, options || {});
        const res = await fetch(url, init);
        const text = await res.text();
        return { ok: res.ok, status: res.status, text: text };
      },
      args: [targetUrl, requestOptions || {}]
    }), 5500, []);
    const result = results && results[0] && results[0].result;
    if (result && result.ok && result.text) return parseJsonLoose(result.text, 'QQ Music tab');
  } catch (err) {
    console.warn('[Mineradio Connector] y.qq.com tab fetch failed', err);
  }
  return null;
}

async function qqMusicRequest(payload, opts) {
  opts = opts || {};
  const cookieObj = opts.cookieObj || await qqAuthObjectFromBrowser();
  const body = JSON.stringify(payload || {});
  if (opts.preferTab !== false) {
    const tabData = await qqFetchJsonInMusicTab(QQ_MUSICU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body
    });
    if (tabData) return tabData;
  }
  const raw = await qqFetchText(QQ_MUSICU_URL, {
    method: 'POST',
    cookieObj,
    timeoutMs: opts.timeoutMs || 8000,
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body
  });
  return parseJsonLoose(raw, 'QQ Music');
}

function normalizeQQVip(body, cookieObj, profileBody) {
  const blocks = [cookieObj || {}, profileBody || {}, body || {}];
  if (body && body.vip) blocks.push(body.vip.data || body.vip);
  if (body && body.data) blocks.push(body.data.vipInfo || body.data.vipinfo || body.data);
  const vip = normalizeVipSignals(blocks, 'QQ VIP');
  if (!vip.isVip && (body || profileBody || Object.keys(cookieObj || {}).some(key => /vip|green|luxury/i.test(key)))) vip.vipUnknown = true;
  if (vip.vipUnknown && vip.vipLabel === '无 VIP') vip.vipLabel = 'VIP 未确认';
  return vip;
}

async function qqVipProbe(cookieObj, uin) {
  if (!uin) return null;
  try {
    const body = await promiseWithTimeout(qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      vip: {
        module: 'music.pay_center.UserInfoVipServer',
        method: 'GetVipInfo',
        param: { uin: String(uin) }
      }
    }, { cookieObj, timeoutMs: 4200 }), 4800, null);
    return body ? normalizeQQVip(body, cookieObj, null) : null;
  } catch (err) {
    return null;
  }
}

async function qqGetJSON(targetUrl, params, opts) {
  opts = opts || {};
  const url = new URL(targetUrl);
  Object.keys(params || {}).forEach(key => {
    if (params[key] != null) url.searchParams.set(key, String(params[key]));
  });
  const raw = await qqFetchText(url.toString(), opts);
  return parseJsonLoose(raw, 'QQ Music');
}

function normalizeQQProfile(body, cookieObj) {
  cookieObj = cookieObj || {};
  const uin = qqCookieUin(cookieObj);
  const openId = qqCookieOpenId(cookieObj);
  const data = body && (body.data || body.profile || body.creator || body.result) || {};
  const creator = data.creator || data.user || data.profile || data || {};
  const vipInfo = data.vipInfo || data.vipinfo || data.vip || creator.vipInfo || creator.vipinfo || {};
  const profileNick = creator.nick || creator.nickname || creator.name || creator.hostname || creator.title || '';
  const profileAvatar = creator.headpic || creator.headurl || creator.avatar || creator.avatarUrl || creator.logo || creator.image || '';
  const nick = profileNick || qqCookieNickname(cookieObj, uin) || '';
  const avatar = profileAvatar || qqCookieAvatar(cookieObj, uin);
  let vipType = Number(
    cookieObj.vipType || cookieObj.vip_type ||
    data.vipType || data.vip_type || data.viptype || data.music_vip_level || data.green_vip_level || data.luxury_vip_level ||
    creator.vipType || creator.vip_type || creator.music_vip_level || creator.green_vip_level || creator.luxury_vip_level ||
    vipInfo.vipType || vipInfo.vip_type || vipInfo.music_vip_level || vipInfo.green_vip_level || vipInfo.luxury_vip_level || 0
  ) || 0;
  if (!vipType) {
    const vipFlag = data.isVip || data.is_vip || data.vipFlag || data.vipflag || creator.isVip || creator.is_vip || vipInfo.isVip || vipInfo.is_vip || vipInfo.vipFlag;
    if (vipFlag === true || Number(vipFlag) > 0 || String(vipFlag || '').toLowerCase() === 'true') vipType = 1;
  }
  const scannedVip = normalizeQQVip(null, cookieObj, body);
  vipType = Math.max(vipType, Number(scannedVip.vipType || 0) || 0);
  const isVip = vipType > 0 || !!scannedVip.isVip;
  const isSvip = !!scannedVip.isSvip || vipType >= 10;
  const vipLevel = isSvip ? 'svip' : (isVip ? 'vip' : 'none');
  const vipUnknown = !isVip && !!scannedVip.vipUnknown;
  return {
    provider: 'qq',
    loggedIn: qqCookieLoginReady(cookieObj),
    userId: uin,
    nickname: nick || (uin ? ('QQ ' + uin) : 'QQ Music'),
    avatar,
    vipType,
    vipLevel,
    isVip,
    isSvip,
    vipUnknown,
    vipLabel: isSvip ? 'SVIP' : (isVip ? 'QQ VIP' : (vipUnknown ? 'VIP_UNKNOWN' : 'NO_VIP')),
    hasCookie: !!Object.keys(cookieObj).length,
    loginCookieNames: qqCookieDiagnosticNames(cookieObj),
    playbackKeyReady: !!qqCookiePlaybackKey(cookieObj),
    openIdReady: !!openId,
    authCached: !!cookieObj.__authCached,
    authCachedAt: Number(cookieObj.__authCachedAt || 0) || 0,
    cacheAgeMs: cookieObj.__authCachedAt ? Date.now() - Number(cookieObj.__authCachedAt || 0) : 0
  };
}

async function enrichQQStatusVip(profile, cookieObj) {
  profile = profile || {};
  const vip = await qqVipProbe(cookieObj || {}, profile.userId || qqCookieUin(cookieObj || {}));
  if (!vip) {
    if (!profile.isVip && !profile.vipUnknown) {
      profile.vipUnknown = !!profile.loggedIn;
      if (profile.vipUnknown) profile.vipLabel = 'VIP_UNKNOWN';
    }
    return profile;
  }
  profile.vipType = Math.max(Number(profile.vipType || 0) || 0, Number(vip.vipType || 0) || 0);
  profile.isSvip = !!profile.isSvip || !!vip.isSvip || profile.vipType >= 10;
  profile.isVip = !!profile.isVip || !!vip.isVip || profile.vipType > 0 || profile.isSvip;
  profile.vipLevel = profile.isSvip ? 'svip' : (profile.isVip ? 'vip' : 'none');
  profile.vipUnknown = !profile.isVip && !!vip.vipUnknown;
  profile.vipLabel = profile.isSvip ? 'SVIP' : (profile.isVip ? 'QQ VIP' : (profile.vipUnknown ? 'VIP_UNKNOWN' : 'NO_VIP'));
  return profile;
}

async function qqStatus() {
  const cookieObj = await promiseWithTimeout(qqAuthObjectFromBrowser(), 3000, {});
  const tabSession = await promiseWithTimeout(qqVisibleTabSession(), 2200, { ready: false, loggedIn: false, error: 'qq_visible_tabs_timeout' });
  const tabReady = tabSession.ready || await promiseWithTimeout(qqMusicTabReady(), 1800, false);
  const tabProbe = await promiseWithTimeout(qqTabLoginProbe(), 2800, { error: 'qq_tab_probe_timeout' });
  const fallback = mergeQQVisibleTabStatus(mergeQQTabProbeStatus(normalizeQQProfile(null, cookieObj), tabProbe), tabSession);
  fallback.musicTabReady = tabReady;
  fallback.cookieCount = Object.keys(cookieObj || {}).length;
  fallback.tabProbe = tabProbe;
  fallback.tabSession = tabSession;
  fallback.connectorVersion = chrome.runtime.getManifest().version;
  fallback.note = fallback.playbackKeyReady ? '' : 'QQ Web now often hides playback tokens from cookies; signed page requests are required for reliable playback.';
  if (!fallback.loggedIn) return fallback;
  await enrichQQStatusVip(fallback, cookieObj);
  if (!fallback.userId) return Object.assign({}, fallback, { profileUnavailable: true, profileError: 'missing_uin' });
  try {
    const body = await promiseWithTimeout(qqGetJSON('https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg', {
      cid: '205360838',
      userid: fallback.userId,
      reqfrom: '1',
      g_tk: '5381',
      loginUin: fallback.userId,
      hostUin: '0',
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: '0',
      platform: 'yqq.json',
      needNewCode: '0'
    }, { cookieObj, timeoutMs: 3000 }), 3500, null);
    if (!body) return Object.assign({}, fallback, { profileUnavailable: true, profileError: 'profile_timeout' });
    const profile = await enrichQQStatusVip(mergeQQVisibleTabStatus(mergeQQTabProbeStatus(normalizeQQProfile(body, cookieObj), tabProbe), tabSession), cookieObj);
    return Object.assign(profile, {
      musicTabReady: tabReady,
      cookieCount: fallback.cookieCount,
      tabProbe,
      tabSession,
      connectorVersion: fallback.connectorVersion,
      note: fallback.note
    });
  } catch (err) {
    return Object.assign({}, fallback, { profileUnavailable: true, profileError: err && err.message || String(err) });
  }
}

function normalizeQQQualityPreference(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (['exhigh', 'high', '320', '320k', 'hq', 'hires', 'lossless', 'flac'].includes(raw)) return 'exhigh';
  if (['aac', 'm4a'].includes(raw)) return 'aac';
  return 'standard';
}

function qqQualityCandidatesFrom(target) {
  const normalized = normalizeQQQualityPreference(target);
  let start = QQ_QUALITY_CANDIDATE_TEMPLATES.findIndex(item => item.level === normalized);
  if (start < 0) start = 1;
  return QQ_QUALITY_CANDIDATE_TEMPLATES.slice(start);
}

function qqAlbumCover(albumMid, size) {
  if (!albumMid) return '';
  const px = size || 300;
  return 'https://y.qq.com/music/photo_new/T002R' + px + 'x' + px + 'M000' + albumMid + '.jpg?max_age=2592000';
}

function mapQQArtists(raw) {
  return (Array.isArray(raw) ? raw : []).map(item => ({
    id: item && item.id,
    mid: item && item.mid,
    name: item && (item.name || item.title) || ''
  })).filter(item => item.name);
}

function mapQQSmartSong(item) {
  item = item || {};
  const mid = item.mid || item.songmid || item.id || '';
  return {
    provider: 'qq-extension',
    source: 'qq-extension',
    type: 'qq-extension',
    id: mid,
    qqId: item.id || item.docid || '',
    mid,
    songmid: mid,
    name: item.name || item.title || '',
    artist: item.singer || '',
    artists: item.singer ? [{ name: item.singer }] : [],
    album: '',
    cover: '',
    duration: 0,
    fee: 0,
    playable: false
  };
}

function mapQQTrack(track, fallback) {
  track = track || {};
  fallback = fallback || {};
  const album = track.album || {};
  const artists = mapQQArtists(track.singer || track.singers || []);
  const mid = track.mid || track.songmid || fallback.mid || fallback.songmid || '';
  const albumMid = album.mid || album.pmid || track.albummid || fallback.albumMid || '';
  return {
    provider: 'qq-extension',
    source: 'qq-extension',
    type: 'qq-extension',
    id: mid,
    qqId: track.id || track.songid || fallback.qqId || fallback.id || '',
    mid,
    songmid: mid,
    mediaMid: track.file && track.file.media_mid || track.strMediaMid || track.media_mid || fallback.mediaMid || '',
    name: track.name || track.title || track.songname || fallback.name || '',
    artist: artists.map(item => item.name).join(' / ') || fallback.artist || '',
    artists: artists.length ? artists : (fallback.artists || []),
    artistId: artists[0] && (artists[0].id || artists[0].mid),
    artistMid: artists[0] && artists[0].mid,
    album: album.name || album.title || track.albumname || fallback.album || '',
    albumMid,
    cover: qqAlbumCover(albumMid, 300) || fallback.cover || '',
    duration: Number(track.interval || fallback.duration || 0) || 0,
    fee: track.pay && Number(track.pay.pay_play) ? 1 : 0,
    playable: false
  };
}

function isQQFavoritePlaylist(pl) {
  const name = String(pl && pl.name || '').trim();
  return /鎴戝枩娆鎴戠殑鍠滄|鍠滄鐨勯煶涔恷liked/i.test(name);
}

function isQzoneBackgroundPlaylist(pl) {
  const text = String((pl && pl.name || '') + ' ' + (pl && pl.creator || '')).toLowerCase();
  return /qzone|绌洪棿|鑳屾櫙闊充箰/.test(text);
}

function mapQQPlaylist(pl, kind) {
  pl = pl || {};
  const id = pl.dissid || pl.tid || pl.dirid || pl.id || pl.diss_id;
  return {
    provider: 'qq',
    source: 'qq-extension',
    type: 'playlist',
    id: id ? String(id) : '',
    name: pl.diss_name || pl.name || pl.title || '',
    cover: pl.diss_cover || pl.logo || pl.picurl || pl.cover || '',
    trackCount: Number(pl.song_cnt || pl.songnum || pl.total_song_num || pl.song_count || 0) || 0,
    playCount: Number(pl.listen_num || pl.visitnum || pl.play_count || 0) || 0,
    creator: pl.hostname || pl.nick || pl.creator || 'QQ Music',
    subscribed: kind === 'collect',
    specialType: 0
  };
}

function mapQQPlaylistTrack(raw) {
  raw = raw || {};
  const track = raw.songid || raw.songmid || raw.mid || raw.name ? raw : (raw.track_info || raw.songInfo || raw.songinfo || raw.song || {});
  return mapQQTrack(track, {
    id: raw.id || raw.songid || '',
    qqId: raw.id || raw.songid || '',
    mid: raw.mid || raw.songmid || '',
    songmid: raw.mid || raw.songmid || '',
    mediaMid: raw.strMediaMid || raw.media_mid || '',
    name: raw.songname || raw.name || '',
    artist: raw.singername || '',
    album: raw.albumname || '',
    albumMid: raw.albummid || '',
    duration: raw.interval || 0
  });
}

function parseNeteasePlaylistId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(/(?:^|[^a-z0-9])(?:playlist:)?(\d{5,})(?:\D|$)/i);
  if (/^\d{5,}$/.test(raw)) return raw;
  const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
  const target = urlMatch ? urlMatch[0].replace(/[锛屻€傘€佲€溾€濃€樷€欙級)\]]+$/g, '') : raw;
  try {
    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase();
    if (!/music\.163\.com$|\.music\.163\.com$/.test(host)) return direct ? direct[1] : '';
    const id = parsed.searchParams.get('id') || '';
    if (/^\d{5,}$/.test(id)) return id;
    const hashId = (parsed.hash.match(/[?&]id=(\d{5,})/i) || [])[1] || '';
    if (hashId) return hashId;
    const pathHit = parsed.pathname.match(/(?:playlist|my\/m\/music\/playlist)\D+(\d{5,})/i);
    if (pathHit) return pathHit[1];
  } catch (err) {}
  return direct ? direct[1] : '';
}

function parseQQPlaylistId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{5,}$/.test(raw)) return raw;
  const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
  const target = urlMatch ? urlMatch[0].replace(/[锛屻€傘€佲€溾€濃€樷€欙級)\]]+$/g, '') : raw;
  try {
    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase();
    if (!/(^|\.)qq\.com$/.test(host)) return '';
    const queryId = parsed.searchParams.get('id') || parsed.searchParams.get('disstid') || parsed.searchParams.get('tid') || parsed.searchParams.get('dirid') || '';
    if (/^\d{5,}$/.test(queryId)) return queryId;
    const pathHit = parsed.pathname.match(/(?:playlist|playsquare|taoge|albumDetail)\/(\d{5,})/i) || parsed.pathname.match(/\/(\d{5,})(?:\.html)?$/i);
    if (pathHit) return pathHit[1];
  } catch (err) {}
  const textHit = raw.match(/(?:disstid|tid|playlist)[:=\/\s]+(\d{5,})/i);
  return textHit ? textHit[1] : '';
}

async function neteaseSharedPlaylist(payload) {
  const id = parseNeteasePlaylistId(payload && (payload.id || payload.url || payload.text || payload.q || payload.input));
  if (!id) throw new Error('Missing NetEase playlist id');
  return neteasePlaylistTracks({ id });
}

async function qqPlaylists() {
  const cookieObj = await promiseWithTimeout(qqAuthObjectFromBrowser(), 3000, {});
  const info = mergeQQVisibleTabStatus(mergeQQTabProbeStatus(normalizeQQProfile(null, cookieObj), await promiseWithTimeout(qqTabLoginProbe(), 2400, null)), await promiseWithTimeout(qqVisibleTabSession(), 1600, {}));
  const uin = info.userId || qqCookieUin(cookieObj);
  if (!info.loggedIn || !uin) return { loggedIn: false, provider: 'qq', playlists: [] };
  const baseParams = {
    g_tk: '5381',
    loginUin: uin,
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '0'
  };
  const createdReq = qqGetJSON('https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss', Object.assign({}, baseParams, {
    hostUin: '0',
    hostuin: uin,
    sin: '0',
    size: '200'
  }), { cookieObj, timeoutMs: 6500, headers: { Referer: 'https://y.qq.com/portal/profile.html' } });
  const collectReq = qqGetJSON('https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', {
    ct: '20',
    cid: '205360956',
    userid: uin,
    reqtype: '3',
    sin: '0',
    ein: '80'
  }, { cookieObj, timeoutMs: 6500, headers: { Referer: 'https://y.qq.com/portal/profile.html' } });
  const results = await Promise.allSettled([createdReq, collectReq]);
  const createdBody = results[0].status === 'fulfilled' ? results[0].value || {} : {};
  const collectBody = results[1].status === 'fulfilled' ? results[1].value || {} : {};
  const created = createdBody.data && Array.isArray(createdBody.data.disslist) ? createdBody.data.disslist.map(pl => mapQQPlaylist(pl, 'created')) : [];
  const collected = collectBody.data && Array.isArray(collectBody.data.cdlist) ? collectBody.data.cdlist.map(pl => mapQQPlaylist(pl, 'collect')) : [];
  const seen = new Set();
  const playlists = created.concat(collected).filter(pl => {
    if (!pl.id || !pl.name || seen.has(pl.id)) return false;
    if (isQzoneBackgroundPlaylist(pl)) return false;
    seen.add(pl.id);
    return true;
  }).sort((a, b) => Number(isQQFavoritePlaylist(b)) - Number(isQQFavoritePlaylist(a)));
  return { loggedIn: true, provider: 'qq', userId: uin, playlists };
}

async function qqPlaylistTracks(payload) {
  const id = parseQQPlaylistId(payload && (payload.id || payload.disstid || payload.url || payload.text || payload.q || payload.input));
  if (!id) throw new Error('Missing QQ playlist id');
  const cookieObj = await promiseWithTimeout(qqAuthObjectFromBrowser(), 3000, {});
  const uin = qqCookieUin(cookieObj) || '0';
  const result = await qqGetJSON('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
    type: '1',
    utf8: '1',
    disstid: id,
    loginUin: uin,
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '0'
  }, { cookieObj, timeoutMs: 8500, headers: { Referer: 'https://y.qq.com/n/yqq/playlist' } });
  const detail = result && result.cdlist && result.cdlist[0] || {};
  const rawTracks = Array.isArray(detail.songlist) ? detail.songlist : [];
  const tracks = rawTracks.slice(0, QQ_PLAYLIST_TRACK_LIMIT).map(mapQQPlaylistTrack).filter(song => song.name && (song.mid || song.id)).map(song => Object.assign(song, {
    playable: true,
    playbackChecked: false,
    playbackProbeDeferred: true
  }));
  return {
    loggedIn: true,
    provider: 'qq-extension',
    playlist: {
      provider: 'qq',
      source: 'qq-extension',
      type: 'playlist',
      id,
      name: detail.dissname || detail.diss_name || detail.name || 'QQ Music Playlist',
      cover: detail.logo || detail.diss_cover || '',
      trackCount: Number(detail.total_song_num || detail.songnum || tracks.length) || tracks.length,
      playCount: Number(detail.visitnum || detail.listen_num || 0) || 0,
      creator: detail.nickname || detail.nick || detail.hostname || 'QQ Music'
    },
    tracks
  };
}

async function qqSharedPlaylist(payload) {
  return qqPlaylistTracks(payload);
}

async function qqSmartboxSearch(keywords, limit) {
  const data = await qqGetJSON(QQ_SMARTBOX_URL, {
    format: 'json',
    key: keywords,
    g_tk: '5381',
    loginUin: '0',
    hostUin: '0',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '0'
  }, { cookieObj: {} });
  const items = data && data.data && data.data.song && data.data.song.itemlist;
  return (Array.isArray(items) ? items : []).slice(0, Math.max(1, Math.min(limit || 8, 12))).map(mapQQSmartSong);
}

async function qqMusicuSearch(keywords, limit) {
  const size = Math.max(1, Math.min(limit || 10, 20));
  const json = await promiseWithTimeout(qqMusicRequest({
    comm: { ct: 24, cv: 0 },
    req_0: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: {
        remoteplace: 'txt.yqq.song',
        searchid: String(Date.now()).slice(-10) + String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
        search_type: 0,
        query: keywords,
        page_num: 1,
        num_per_page: size
      }
    }
  }, { cookieObj: {}, timeoutMs: 6500 }), 7200, null);
  const list = json && json.req_0 && json.req_0.data && json.req_0.data.body && json.req_0.data.body.song && json.req_0.data.body.song.list;
  return (Array.isArray(list) ? list : []).slice(0, size).map(item => mapQQTrack(item, {}));
}

async function qqSongDetail(mid, fallback) {
  if (!mid) return fallback;
  const json = await promiseWithTimeout(qqMusicRequest({
    comm: { ct: 24, cv: 0 },
    songinfo: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail_yqq',
      param: { song_mid: mid }
    }
  }, { cookieObj: {}, timeoutMs: 6000 }), 6500, null);
  if (!json) return fallback;
  const data = json && json.songinfo && json.songinfo.data;
  return mapQQTrack(data && data.track_info, fallback);
}

function qqBuildVkeyRequest(songmid, candidates, cookieObj, opts) {
  opts = opts || {};
  const filenames = candidates.map(item => item.filename);
  const uin = opts.uin || qqCookieUin(cookieObj) || '0';
  const guid = opts.guid || String(10000000 + Math.floor(Math.random() * 90000000));
  const param = {
    guid,
    songmid: filenames.length ? filenames.map(() => songmid) : [songmid],
    songtype: filenames.length ? filenames.map(() => 0) : [0],
    uin,
    loginflag: 1,
    platform: opts.platform || '20'
  };
  if (filenames.length) param.filename = filenames;
  const authKey = opts.authKey || '';
  const comm = {
    uin,
    format: 'json',
    ct: opts.ct || (authKey ? 19 : 24),
    cv: opts.cv || 0
  };
  if (authKey) comm.authst = authKey;
  return {
    comm,
    req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param }
  };
}

function qqResolveVkeyResponse(json, candidates) {
  const data = json && json.req_0 && json.req_0.data || {};
  const infos = Array.isArray(data.midurlinfo) ? data.midurlinfo : [];
  const info = infos.find(item => item && item.purl) || infos[0] || {};
  if (!info.purl) return { data, info, playback: null };
  const sip = data.sip && data.sip[0] || 'https://ws.stream.qqmusic.qq.com/';
  const fileMeta = candidates.find(item => item.filename === info.filename) || {};
  return {
    data,
    info,
    playback: {
      provider: 'qq-extension',
      url: ensureHttpsAudioUrl(sip + info.purl),
      trial: false,
      playable: true,
      level: fileMeta.level || 'standard',
      quality: fileMeta.label || 'QQ Music',
      filename: info.filename || ''
    }
  };
}

async function qqSongUrl(payload) {
  const song = payload || {};
  const songmid = String(song.mid || song.songmid || song.id || '').trim();
  if (!songmid) return { provider: 'qq-extension', url: '', playable: false, reason: 'missing_mid', message: 'Missing QQ songmid' };
  const cookieObj = await promiseWithTimeout(qqAuthObjectFromBrowser(), 3000, {});
  const uin = qqCookieUin(cookieObj) || '0';
  const playbackKey = qqCookiePlaybackKey(cookieObj);
  const cookieLoggedIn = qqCookieLoginReady(cookieObj);
  const tabProbe = cookieLoggedIn ? null : await promiseWithTimeout(qqTabLoginProbe(), 2600, { error: 'qq_tab_probe_timeout' });
  const loggedIn = cookieLoggedIn || qqTabProbeLooksLoggedIn(tabProbe);
  const mediaIds = [];
  const mediaMid = String(song.mediaMid || song.media_mid || '').trim();
  if (mediaMid) mediaIds.push(mediaMid);
  if (!mediaIds.includes(songmid)) mediaIds.push(songmid);
  const candidates = mediaIds.flatMap(mediaId => qqQualityCandidatesFrom(song.quality || song.level).map(item => Object.assign({}, item, { mediaId, filename: item.prefix + mediaId + item.ext })));
  const attempts = [
    { platform: '20', authKey: playbackKey, ct: playbackKey ? 19 : 24 },
    { platform: '20', authKey: '', ct: 24 },
    { platform: 'yqq.json', authKey: playbackKey, ct: playbackKey ? 19 : 24 },
    { platform: 'h5', authKey: '', ct: 24 }
  ];
  let lastInfo = {};
  for (const attempt of attempts) {
    try {
      const json = await promiseWithTimeout(qqMusicRequest(qqBuildVkeyRequest(songmid, candidates, cookieObj, Object.assign({ uin }, attempt)), {
        cookieObj,
        timeoutMs: 6500
      }), 7200, null);
      const resolved = qqResolveVkeyResponse(json, candidates);
      lastInfo = resolved.info || lastInfo;
      if (resolved.playback) return resolved.playback;
    } catch (err) {
      lastInfo = Object.assign({}, lastInfo, { errmsg: err && err.message || String(err) });
    }
  }
  const info = lastInfo || {};
  const code = info.result || info.code || info.errtype || 0;
  const message = info.msg || info.tips || info.errmsg ||
    (!loggedIn ? 'QQ Music login is missing or this track needs permission'
      : (!playbackKey ? 'QQ Music playback cookie is incomplete; play one song on y.qq.com and refresh the connector' : 'QQ Music did not return a playable URL'));
  return {
    provider: 'qq-extension',
    url: '',
    playable: false,
    loggedIn,
    playbackKeyReady: !!(uin && playbackKey),
    tabLoggedIn: qqTabProbeLooksLoggedIn(tabProbe),
    reason: !loggedIn ? 'login_required' : (!playbackKey ? 'playback_key_missing' : 'url_unavailable'),
    message,
    qqCode: code
  };
}

async function enrichQQSongs(songs) {
  return (songs || []).slice(0, 12).map(song => Object.assign(song, {
    playable: true,
    playbackChecked: false,
    playbackProbeDeferred: true
  }));
}

async function qqSearch(payload) {
  const q = String(payload && payload.q || '').trim();
  const limit = Math.max(1, Math.min(20, Number(payload && payload.limit) || 8));
  if (!q) return { songs: [] };
  const batches = await Promise.allSettled([
    qqMusicuSearch(q, limit),
    qqSmartboxSearch(q, limit)
  ]);
  const base = [];
  batches.forEach(item => {
    if (item.status === 'fulfilled') base.push(...(item.value || []));
  });
  const detailed = [];
  for (const item of base) {
    try { detailed.push(await qqSongDetail(item.mid, item)); }
    catch (err) { detailed.push(item); }
  }
  const seen = new Set();
  const songs = detailed.filter(song => {
    const key = song && (song.mid || song.id || (song.name + '|' + song.artist));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return !!(song && song.name);
  });
  return { songs: await enrichQQSongs(songs) };
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function decodeUtf8Binary(binary) {
  try {
    const bytes = new Uint8Array(Array.from(binary || '').map(ch => ch.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    return binary || '';
  }
}

function decodeQQLyricText(value) {
  let raw = decodeHtmlEntities(String(value || '').trim());
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, '');
  const looksBase64 = compact.length >= 8 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
  if (looksBase64 && !/^\s*\[/.test(raw)) {
    try {
      const decoded = decodeUtf8Binary(atob(compact)).replace(/^\uFEFF/, '');
      if (decoded && (decoded.includes('[') || /[\u4e00-\u9fff]/.test(decoded))) raw = decoded;
    } catch (err) {}
  }
  return decodeHtmlEntities(raw).replace(/\r\n/g, '\n').trim();
}

async function qqLyric(payload) {
  const song = payload || {};
  const songMID = String(song.mid || song.songmid || song.id || '').trim();
  const songID = String(song.qqId || song.qqid || '').replace(/\D/g, '');
  if (!songMID && !songID) return { provider: 'qq-extension', lyric: '' };
  try {
    const param = {};
    if (songMID) param.songMID = songMID;
    if (songID) param.songID = Number(songID);
    const json = await qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      lyric: { module: 'music.musichallSong.PlayLyricInfo', method: 'GetPlayLyricInfo', param }
    });
    const data = json && json.lyric && json.lyric.data;
    const lyric = decodeQQLyricText(data && (data.lyric || data.qrc));
    const tlyric = decodeQQLyricText(data && data.trans);
    if (lyric) return { provider: 'qq-extension', lyric, tlyric };
  } catch (err) {}
  try {
    const body = await qqGetJSON('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      songmid: songMID,
      songtype: '0',
      format: 'json',
      nobase64: '1',
      g_tk: '5381',
      loginUin: '0',
      hostUin: '0',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: '0',
      platform: 'yqq.json',
      needNewCode: '0'
    }, { headers: { Referer: QQ_ORIGIN + '/portal/player.html' } });
    return { provider: 'qq-extension', lyric: decodeQQLyricText(body && body.lyric), tlyric: decodeQQLyricText(body && (body.trans || body.tlyric)) };
  } catch (err) {
    return { provider: 'qq-extension', lyric: '' };
  }
}

async function kugouStatus() {
  const ctx = await kugouContext();
  const probe = await promiseWithTimeout(kugouPlaybackCapabilityProbe(ctx), 6500, {
    playbackReady: false,
    playbackProbeFailed: true,
    playbackProbeMessage: 'kugou_probe_timeout'
  });
  const vip = normalizeKugouVip(Object.assign({}, ctx.rawAuth || {}, ctx));
  const vipType = Number(vip.vipType || 0) || 0;
  return {
    provider: 'kugou',
    loggedIn: ctx.loggedIn,
    hasToken: !!ctx.token,
    userId: ctx.userid === '0' ? '' : ctx.userid,
    nickname: ctx.username || '',
    avatar: ctx.avatar || '',
    vipType,
    vipLevel: vip.vipLevel,
    isVip: !!vip.isVip,
    isSvip: !!vip.isSvip,
    vipUnknown: !!vip.vipUnknown,
    authCached: !!ctx.authCached,
    authCachedAt: Number(ctx.authCachedAt || 0) || 0,
    cacheAgeMs: Number(ctx.cacheAgeMs || 0) || 0,
    vipLabel: vip.vipLabel,
    playbackReady: !!(probe && probe.playbackReady),
    webPlaybackObserved: !!(probe && probe.webPlaybackObserved),
    playbackProbeFailed: !!(probe && probe.playbackProbeFailed),
    playbackProbeMessage: probe && probe.playbackProbeMessage || '',
    capabilityLabel: probe && probe.playbackReady
      ? 'playback'
      : ((probe && probe.webPlaybackObserved) ? 'site_playback_only' : (ctx.loggedIn ? 'login_only' : 'shared_playlist_only'))
  };
}

async function kugouObservePlaybackFromTab() {
  try {
    const tabs = await promiseWithTimeout(kugouTabs(), 1800, []);
    const tab = (tabs || []).find(item => item && item.id && !item.discarded) || (tabs || []).find(item => item && item.id);
    if (!tab || !tab.id) return { observed: false };
    const results = await promiseWithTimeout(chromeExecuteScript({
      target: { tabId: tab.id },
      func: function () {
        function readText(selector) {
          var el = document.querySelector(selector);
          return el && el.textContent ? String(el.textContent).trim() : '';
        }
        var audio = Array.from(document.querySelectorAll('audio')).find(function (node) {
          return node && !node.paused && !node.ended && node.currentTime > 0;
        });
        return {
          observed: !!audio,
          currentSrc: audio && audio.currentSrc ? String(audio.currentSrc) : '',
          title: readText('.play-songname') || readText('[data-testid="song-name"]') || document.title || '',
          artist: readText('.play-author') || readText('.song-author') || ''
        };
      }
    }), 2200, []);
    return results && results[0] && results[0].result || { observed: false };
  } catch (err) {
    return { observed: false };
  }
}

function kugouProbeMessageFromSong(song) {
  if (!song) return 'kugou_probe_no_song';
  if (song.playbackMessage) return String(song.playbackMessage);
  if (song.playbackCode) return 'kugou_playback_code_' + String(song.playbackCode);
  return 'url_unavailable';
}

async function kugouPlaybackCapabilityProbe(ctx) {
  ctx = ctx || await kugouContext();
  const playbackFromTab = await kugouObservePlaybackFromTab();
  const cacheKey = [
    ctx.userid || '0',
    ctx.token ? 'token' : 'anon',
    ctx.vipType || 0,
    playbackFromTab && playbackFromTab.observed ? 'tab' : 'notab'
  ].join('|');
  if (kugouCapabilityCache.key === cacheKey && kugouCapabilityCache.result && Date.now() - kugouCapabilityCache.checkedAt < 5 * 60 * 1000) {
    return kugouCapabilityCache.result;
  }
  if (!ctx.loggedIn || !ctx.token) {
    const result = {
      playbackReady: false,
      webPlaybackObserved: !!(playbackFromTab && playbackFromTab.observed),
      playbackProbeFailed: true,
      playbackProbeMessage: 'login_or_token_missing'
    };
    kugouCapabilityCache = { key: cacheKey, checkedAt: Date.now(), result };
    return result;
  }
  try {
    let playable = null;
    let probeMessage = '';
    let checkedSongs = 0;
    for (const query of KUGOU_PROBE_QUERIES) {
      const search = await kugouSearch({ q: query, limit: 5, probe: true });
      const songs = Array.isArray(search && search.songs) ? search.songs : [];
      checkedSongs += songs.length;
      playable = songs.find(song => song && song.probedAudioUrl && song.playable !== false);
      if (playable) break;
      const firstChecked = songs.find(song => song && song.playbackChecked);
      if (!probeMessage && firstChecked) probeMessage = kugouProbeMessageFromSong(firstChecked);
    }
    const result = playable
      ? {
          playbackReady: true,
          webPlaybackObserved: !!(playbackFromTab && playbackFromTab.observed),
          playbackProbeFailed: false,
          playbackProbeMessage: '',
          probeSong: playable.name || '',
          probeArtist: playable.artist || ''
        }
      : {
          playbackReady: false,
          webPlaybackObserved: !!(playbackFromTab && playbackFromTab.observed),
          playbackProbeFailed: true,
          playbackProbeMessage: probeMessage || (checkedSongs ? 'url_unavailable' : 'kugou_search_empty')
        };
    kugouCapabilityCache = { key: cacheKey, checkedAt: Date.now(), result };
    return result;
  } catch (err) {
    const result = {
      playbackReady: false,
      webPlaybackObserved: !!(playbackFromTab && playbackFromTab.observed),
      playbackProbeFailed: true,
      playbackProbeMessage: err && err.message || String(err)
    };
    kugouCapabilityCache = { key: cacheKey, checkedAt: Date.now(), result };
    return result;
  }
}

async function kugouSearch(payload) {
  const q = String(payload && payload.q || '').trim();
  const limit = Math.max(1, Math.min(20, Number(payload && payload.limit) || 8));
  const probe = !!(payload && payload.probe);
  if (!q) return { songs: [] };
  const ctx = await kugouContext();
  const now = Date.now();
  const params = kugouSignedParams({
    callback: 'callback123',
    srcappid: '2919',
    clientver: '1000',
    clienttime: String(now),
    mid: ctx.mid,
    uuid: ctx.uuid,
    dfid: ctx.dfid,
    keyword: q,
    page: '1',
    pagesize: String(limit),
    bitrate: '0',
    isfuzzy: '0',
    inputtype: '0',
    platform: 'WebFilter',
    userid: ctx.userid,
    iscorrection: '1',
    privilege_filter: '0',
    filter: '10',
    token: ctx.token,
    appid: '1014'
  });
  const url = 'https://complexsearch.kugou.com/v2/search/song?' + new URLSearchParams(params).toString();
  const data = await kugouFetchJson(url);
  let songs = (((data || {}).data || {}).lists || []).map(normalizeKugouSong).filter(song => song.id && song.name);
  songs = await enrichKugouSongs(songs, { probe });
  return { songs };
}

async function enrichKugouSongs(songs, options) {
  options = options || {};
  const probeLimit = options.probe ? 5 : 12;
  const checked = [];
  for (const song of songs.slice(0, probeLimit)) {
    try {
      const playback = await kugouSongUrl(song);
      song.playbackChecked = true;
      song.playable = !!playback.url;
      song.playbackCode = playback.code || 0;
      if (playback.url) song.probedAudioUrl = playback.url;
      else song.playbackProbeFailed = true;
      if (playback.message) song.playbackMessage = playback.message;
      if (playback.cover) song.cover = song.cover || playback.cover;
      if (playback.lyric) song.lyric = playback.lyric;
      checked.push(song);
    } catch (err) {
      song.playbackChecked = true;
      song.playable = false;
      song.playbackCode = 0;
      song.playbackProbeFailed = true;
      song.playbackMessage = err && err.message || 'kugou_audio_url_unavailable';
      checked.push(song);
    }
  }
  return checked;
}

async function kugouSongUrlLegacy(song, ctx) {
  const hash = String(song && (song.hash || song.FileHash || song.raw && song.raw.fileHash) || '').trim();
  const albumId = String(song && (song.albumId || song.AlbumID || song.raw && song.raw.albumId) || '').trim();
  if (!hash) return null;
  const params = new URLSearchParams({
    r: 'play/getdata',
    hash: hash,
    album_id: albumId || '0',
    dfid: String(ctx && ctx.dfid || ''),
    mid: String(ctx && ctx.mid || ''),
    platid: '4',
    _: String(Date.now())
  });
  const url = KUGOU_ORIGIN + '/yy/index.php?' + params.toString();
  const data = await kugouFetchJson(url, {
    referrer: KUGOU_ORIGIN + '/',
    headers: kugouHeaders({ Referer: KUGOU_ORIGIN + '/' })
  });
  const body = data && (data.data || data) || {};
  const audioUrl = ensureHttpsAudioUrl(body.play_url || body.play_backup_url || body.src || '');
  return {
    url: audioUrl,
    cover: kugouCoverUrl(body.img || body.album_img || ''),
    lyric: body.lyrics || body.lyric || '',
    message: audioUrl ? '' : ((data && (data.error_msg || data.msg)) || 'audio_url_unavailable')
  };
}

async function kugouSongUrl(payload) {
  const song = payload || {};
  const encodeAlbumAudioId = String(song.mid || song.id || song.encode_album_audio_id || song.EMixSongID || '').trim();
  const ctx = await kugouContext();
  if (!encodeAlbumAudioId && !(song.hash || song.FileHash || song.raw && song.raw.fileHash)) throw new Error('Missing Kugou song id');
  const params = kugouSignedParams({
    srcappid: '2919',
    clientver: '20000',
    clienttime: String(Date.now()),
    mid: ctx.mid,
    uuid: ctx.uuid,
    dfid: ctx.dfid,
    appid: '1014',
    platid: '4',
    encode_album_audio_id: encodeAlbumAudioId,
    token: ctx.token,
    userid: ctx.userid
  });
  let data = null;
  let body = {};
  let audioUrl = '';
  let message = '';
  if (encodeAlbumAudioId) {
    const url = 'https://wwwapi.kugou.com/play/songinfo?' + new URLSearchParams(params).toString();
    data = await kugouFetchJson(url);
    body = data && (data.data || data) || {};
    audioUrl = ensureHttpsAudioUrl(body.play_url || body.backup_url && body.backup_url[0] || body.play_backup_url && body.play_backup_url[0] || '');
    message = audioUrl ? '' : ((data && (data.error_msg || data.msg)) || 'audio_url_unavailable');
  }
  if (!audioUrl) {
    try {
      const legacy = await kugouSongUrlLegacy(song, ctx);
      if (legacy && legacy.url) {
        audioUrl = legacy.url;
        body = Object.assign({}, body, {
          img: legacy.cover || body.img,
          lyrics: legacy.lyric || body.lyrics
        });
        message = '';
      } else if (!message && legacy && legacy.message) {
        message = legacy.message;
      }
    } catch (legacyErr) {
      if (!message) message = legacyErr && legacyErr.message || 'audio_url_unavailable';
    }
  }
  return {
    provider: 'kugou-extension',
    url: audioUrl,
    level: body.bit_rate ? String(body.bit_rate) : 'standard',
    quality: 'kugou-extension',
    code: data && (data.status || data.error_code || data.err_code) || 0,
    trial: false,
    playable: !!audioUrl,
    cover: kugouCoverUrl(body.img || body.album_img || ''),
    lyric: body.lyrics || body.lyric || '',
    reason: audioUrl ? '' : 'url_unavailable',
    message: audioUrl ? '' : (message || 'audio_url_unavailable')
  };
}

async function kugouLyric(payload) {
  const song = payload || {};
  if (song.lyric) return { lyric: song.lyric };
  const name = String(song.name || '').trim();
  if (!name) return { lyric: '' };
  try {
    const url = 'https://fxsong.kugou.com/fxmusic/pcad/lrcV1?' + new URLSearchParams({
      jsonCallBack: '',
      songName: name
    }).toString();
    const text = await fetchText(url, {
      credentials: 'include',
      referrer: KUGOU_ORIGIN + '/',
      headers: kugouHeaders()
    });
    const match = text.match(/"lyrics"\s*:\s*"([^"]*)"/);
    return { lyric: match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '' };
  } catch (err) {
    return { lyric: '' };
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  const requestId = message && message.requestId;
  const action = message && message.action;
  const payload = message && message.payload || {};
  (async function () {
    if (action === 'ping') return jsonResponse(requestId, { version: chrome.runtime.getManifest().version });
    if (action === 'netease.status') return jsonResponse(requestId, { status: await neteaseStatus() });
    if (action === 'netease.saveAuth') return jsonResponse(requestId, await neteaseSaveAuth(payload));
    if (action === 'netease.clearAuth') return jsonResponse(requestId, await neteaseClearAuth());
    if (action === 'netease.home') return jsonResponse(requestId, await neteaseHome(payload));
    if (action === 'netease.playlistTracks') return jsonResponse(requestId, await neteasePlaylistTracks(payload));
    if (action === 'netease.sharedPlaylist') return jsonResponse(requestId, await neteaseSharedPlaylist(payload));
    if (action === 'netease.search') return jsonResponse(requestId, await neteaseSearch(payload));
    if (action === 'netease.lyric') return jsonResponse(requestId, await neteaseLyric(payload));
    if (action === 'netease.songUrl') return jsonResponse(requestId, await neteaseSongUrl(payload));
    if (action === 'kugou.status') return jsonResponse(requestId, { status: await kugouStatus() });
    if (action === 'kugou.saveAuth') return jsonResponse(requestId, await kugouSaveAuth(payload));
    if (action === 'kugou.clearAuth') return jsonResponse(requestId, await kugouClearAuth());
    if (action === 'kugou.search') return jsonResponse(requestId, await kugouSearch(payload));
    if (action === 'kugou.sharedPlaylist') return jsonResponse(requestId, await kugouSharedPlaylist(payload));
    if (action === 'kugou.lyric') return jsonResponse(requestId, await kugouLyric(payload));
    if (action === 'kugou.songUrl') return jsonResponse(requestId, await kugouSongUrl(payload));
    if (action === 'qq.status') return jsonResponse(requestId, { status: await qqStatus() });
    if (action === 'qq.saveAuth') return jsonResponse(requestId, await qqSaveAuth(payload));
    if (action === 'qq.clearAuth') return jsonResponse(requestId, await qqClearAuth());
    if (action === 'qq.playlists') return jsonResponse(requestId, await qqPlaylists(payload));
    if (action === 'qq.playlistTracks') return jsonResponse(requestId, await qqPlaylistTracks(payload));
    if (action === 'qq.sharedPlaylist') return jsonResponse(requestId, await qqSharedPlaylist(payload));
    if (action === 'qq.search') return jsonResponse(requestId, await qqSearch(payload));
    if (action === 'qq.lyric') return jsonResponse(requestId, await qqLyric(payload));
    if (action === 'qq.songUrl') return jsonResponse(requestId, await qqSongUrl(payload));
    throw new Error('Unknown connector action: ' + action);
  })().then(sendResponse).catch(function (err) {
    console.warn('[Mineradio Connector]', action, err);
    sendResponse(errorResponse(requestId, err));
  });
  return true;
});

installAudioHeaderRules();
installKugouMobileHeaderRules();
