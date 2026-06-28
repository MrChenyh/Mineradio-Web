'use strict';

const NETEASE_ORIGIN = 'https://music.163.com';
const KUGOU_ORIGIN = 'https://www.kugou.com';
const QQ_ORIGIN = 'https://y.qq.com';
const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg';
const KUGOU_SIGN_SECRET = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const NETEASE_DEFAULT_LEVEL = 'standard';
const NETEASE_AUDIO_RULE_ID = 163001;
const QQ_AUDIO_RULE_IDS = [163002, 163003];
const QQ_QUALITY_CANDIDATE_TEMPLATES = [
  { prefix: 'M800', ext: '.mp3', level: 'exhigh', label: 'QQ 320k' },
  { prefix: 'M500', ext: '.mp3', level: 'standard', label: 'QQ 128k' },
  { prefix: 'C400', ext: '.m4a', level: 'aac', label: 'QQ AAC' }
];
const NETEASE_HOME_PLAYLIST_LIMIT = 50;
const NETEASE_HOME_PLAYLIST_RENDER_LIMIT = 48;
const NETEASE_PLAYLIST_TRACK_LIMIT = 240;

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
  const res = await fetch(url, Object.assign({
    credentials: 'include',
    cache: 'no-store',
    referrer: options.referrer || NETEASE_ORIGIN + '/',
    headers: headersForUrl(url)
  }, options || {}));
  const text = await res.text();
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

async function neteaseFetchJsonInMusicTab(path, params, method) {
  try {
    const tabs = await chromeTabsQuery({ url: [NETEASE_ORIGIN + '/*', 'http://music.163.com/*'] });
    const tab = tabs.find(item => item && item.id && !item.discarded) || tabs.find(item => item && item.id);
    if (!tab) return null;
    const results = await chromeExecuteScript({
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
    });
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
  return fetchJson(NETEASE_ORIGIN + '/api/song/enhance/player/url/v1', {
    method: 'POST',
    body: formBody(params),
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
  return fetchJson(NETEASE_ORIGIN + '/api/song/enhance/player/url?' + params.toString());
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

async function kugouCookie(name) {
  const cookie = await chrome.cookies.get({ url: kugouCookieUrl(), name });
  return cookie && cookie.value || '';
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

async function kugouContext() {
  const [kgMid, mid, kgDfid, dfid, kugoo, kugooId, userName, token, kuToken, vipType] = await Promise.all([
    kugouCookie('kg_mid'),
    kugouCookie('mid'),
    kugouCookie('kg_dfid'),
    kugouCookie('dfid'),
    kugouCookie('KuGoo'),
    kugouCookie('KugooID'),
    kugouCookie('UserName'),
    kugouCookie('token'),
    kugouCookie('KuGooToken'),
    kugouCookie('vip_type')
  ]);
  const compoundUserId = kugouCompoundCookieValue(kugoo, 'KugooID') || kugouCompoundCookieValue(kugoo, 'UserName');
  const compoundToken = kugouCompoundCookieValue(kugoo, 't');
  const resolvedMid = kgMid || mid || randomHex(32);
  return {
    mid: resolvedMid,
    uuid: resolvedMid,
    dfid: kgDfid || dfid || '',
    userid: compoundUserId || kugooId || userName || '0',
    token: compoundToken || token || kuToken || '',
    vipType: Number(vipType || 0) || 0,
    loggedIn: !!((compoundUserId || kugooId || userName) && (compoundUserId || kugooId || userName) !== '0')
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

async function neteaseStatus() {
  const musicU = await chrome.cookies.get({ url: NETEASE_ORIGIN + '/', name: 'MUSIC_U' });
  const csrf = await chrome.cookies.get({ url: NETEASE_ORIGIN + '/', name: '__csrf' });
  let profile = null;
  if (musicU && musicU.value) {
    try {
      const data = await fetchJson(NETEASE_ORIGIN + '/api/nuser/account/get?t=' + Date.now());
      profile = data && (data.profile || data.account || data.data && data.data.profile) || null;
    } catch (err) {
      console.warn('[Mineradio Connector] NetEase profile failed', err);
    }
  }
  return {
    provider: 'netease',
    loggedIn: !!(musicU && musicU.value),
    hasCsrf: !!(csrf && csrf.value),
    nickname: profile && (profile.nickname || profile.userName || profile.name) || '',
    userId: profile && (profile.userId || profile.id) || '',
    avatar: profile && (profile.avatarUrl || profile.avatar) || ''
  };
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
    fetchJson(NETEASE_ORIGIN + '/api/v3/discovery/recommend/songs?t=' + Date.now()),
    fetchJson(NETEASE_ORIGIN + '/api/v1/discovery/recommend/resource?t=' + Date.now()),
    status.userId ? fetchJson(NETEASE_ORIGIN + '/api/user/playlist?' + new URLSearchParams({ uid: status.userId, limit: String(NETEASE_HOME_PLAYLIST_LIMIT), offset: '0', t: Date.now().toString() }).toString()) : Promise.resolve({ playlist: [] })
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
  const data = await fetchJson(NETEASE_ORIGIN + '/api/v6/playlist/detail?' + new URLSearchParams({ id, n: '1000', s: '8', t: Date.now().toString() }).toString());
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
  const data = await fetchJson(url);
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
    song.playable = !!item.url && Number(item.code || 0) === 200;
    song.previewOnly = false;
    if (item.url) song.probedAudioUrl = ensureHttpsAudioUrl(item.url);
  });
  return songs;
}

async function neteaseSongDetails(ids) {
  const out = new Map();
  if (!ids.length) return out;
  try {
    const data = await fetchJson(NETEASE_ORIGIN + '/api/song/detail?ids=' + encodeURIComponent(JSON.stringify(ids)));
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
  const data = await fetchJson(url);
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
    message: url ? '' : '网易云未返回可播放地址，可能需要登录、会员或受版权限制'
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

function qqCookieMusicKey(obj) {
  obj = obj || {};
  return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.p_skey || obj.p_lskey || obj.skey ||
    obj.psrf_qqaccess_token || obj.psrf_qqrefresh_token || obj.wxrefresh_token || obj.wxskey ||
    obj.tmeLoginKey || obj.access_token || '';
}

function qqCookiePlaybackKey(obj) {
  obj = obj || {};
  return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.wxskey || '';
}

function qqCookieLoginReady(obj) {
  obj = obj || {};
  if (!qqCookieUin(obj)) return false;
  return !!(qqCookieMusicKey(obj) || obj.uin || obj.p_uin || obj.qqmusic_uin || obj.wxuin ||
    obj.luin || obj.pt2gguin || obj.o_cookie || obj.openid || obj.login_type || obj.tmeLoginType);
}

async function qqMusicTabReady() {
  try {
    const tabs = await chromeTabsQuery({ url: [QQ_ORIGIN + '/*'] });
    return tabs.some(item => item && item.id && !item.discarded);
  } catch (err) {
    return false;
  }
}

function qqCookieDiagnosticNames(obj) {
  return Object.keys(obj || {})
    .filter(name => /uin|skey|qqmusic|qm_|token|login|openid|wx|ptnick/i.test(name))
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
    if (obj[cookie.name] == null || /qqmusic|qm_|uin|skey|token|ptnick/i.test(cookie.name)) obj[cookie.name] = cookie.value || '';
  });
  if (Number(obj.login_type) === 2 && obj.wxuin && !obj.uin) obj.uin = obj.wxuin;
  if (!obj.uin && (obj.qqmusic_uin || obj.p_uin || obj.luin || obj.pt2gguin || obj.o_cookie)) {
    obj.uin = obj.qqmusic_uin || obj.p_uin || obj.luin || obj.pt2gguin || obj.o_cookie;
  }
  if (obj.uin) obj.uin = normalizeQQUin(obj.uin);
  return obj;
}

function qqHeaders(extra) {
  return Object.assign({
    Referer: QQ_ORIGIN + '/',
    Origin: QQ_ORIGIN
  }, extra || {});
}

async function qqFetchText(url, options) {
  options = options || {};
  const cookieObj = options.cookieObj || await qqCookieObjectFromBrowser();
  const cookieHeader = serializeCookieObject(cookieObj);
  const headers = qqHeaders(Object.assign({}, options.headers || {}, cookieHeader ? { Cookie: cookieHeader } : {}));
  const res = await fetch(url, Object.assign({
    credentials: 'include',
    cache: 'no-store',
    referrer: options.referrer || QQ_ORIGIN + '/',
    headers
  }, options, { headers }));
  const body = await res.text();
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
    const tabs = await chromeTabsQuery({ url: [QQ_ORIGIN + '/*'] });
    const tab = tabs.find(item => item && item.id && !item.discarded) || tabs.find(item => item && item.id);
    if (!tab) return null;
    const results = await chromeExecuteScript({
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
    });
    const result = results && results[0] && results[0].result;
    if (result && result.ok && result.text) return parseJsonLoose(result.text, 'QQ Music tab');
  } catch (err) {
    console.warn('[Mineradio Connector] y.qq.com tab fetch failed', err);
  }
  return null;
}

async function qqMusicRequest(payload, opts) {
  opts = opts || {};
  const cookieObj = opts.cookieObj || await qqCookieObjectFromBrowser();
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
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body
  });
  return parseJsonLoose(raw, 'QQ Music');
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
  const data = body && (body.data || body.profile || body.creator || body.result) || {};
  const creator = data.creator || data.user || data.profile || data || {};
  const profileNick = creator.nick || creator.nickname || creator.name || creator.hostname || creator.title || '';
  const profileAvatar = creator.headpic || creator.headurl || creator.avatar || creator.avatarUrl || creator.logo || creator.image || '';
  const nick = profileNick || qqCookieNickname(cookieObj, uin) || '';
  const avatar = profileAvatar || qqCookieAvatar(cookieObj, uin);
  return {
    provider: 'qq',
    loggedIn: qqCookieLoginReady(cookieObj),
    userId: uin,
    nickname: nick || (uin ? ('QQ ' + uin) : 'QQ Music'),
    avatar,
    hasCookie: !!Object.keys(cookieObj).length,
    loginCookieNames: qqCookieDiagnosticNames(cookieObj),
    playbackKeyReady: !!qqCookiePlaybackKey(cookieObj)
  };
}

async function qqStatus() {
  const cookieObj = await qqCookieObjectFromBrowser();
  const tabReady = await qqMusicTabReady();
  const fallback = normalizeQQProfile(null, cookieObj);
  fallback.musicTabReady = tabReady;
  fallback.cookieCount = Object.keys(cookieObj || {}).length;
  if (!fallback.loggedIn) return fallback;
  try {
    const body = await qqGetJSON('https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg', {
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
    }, { cookieObj });
    return Object.assign(normalizeQQProfile(body, cookieObj), {
      musicTabReady: tabReady,
      cookieCount: fallback.cookieCount
    });
  } catch (err) {
    return Object.assign({}, fallback, { profileUnavailable: true });
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

async function qqSongDetail(mid, fallback) {
  if (!mid) return fallback;
  const json = await qqMusicRequest({
    comm: { ct: 24, cv: 0 },
    songinfo: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail_yqq',
      param: { song_mid: mid }
    }
  }, { cookieObj: {} });
  const data = json && json.songinfo && json.songinfo.data;
  return mapQQTrack(data && data.track_info, fallback);
}

async function qqSongUrl(payload) {
  const song = payload || {};
  const songmid = String(song.mid || song.songmid || song.id || '').trim();
  if (!songmid) return { provider: 'qq-extension', url: '', playable: false, reason: 'missing_mid', message: 'Missing QQ songmid' };
  const cookieObj = await qqCookieObjectFromBrowser();
  const uin = qqCookieUin(cookieObj) || '0';
  const musicKey = qqCookieMusicKey(cookieObj);
  const playbackKey = qqCookiePlaybackKey(cookieObj);
  const authKey = playbackKey;
  const loggedIn = qqCookieLoginReady(cookieObj);
  const mediaIds = [];
  const mediaMid = String(song.mediaMid || song.media_mid || '').trim();
  if (mediaMid) mediaIds.push(mediaMid);
  if (!mediaIds.includes(songmid)) mediaIds.push(songmid);
  const candidates = mediaIds.flatMap(mediaId => qqQualityCandidatesFrom(song.quality || song.level).map(item => Object.assign({}, item, { mediaId, filename: item.prefix + mediaId + item.ext })));
  const filenames = candidates.map(item => item.filename);
  const guid = String(10000000 + Math.floor(Math.random() * 90000000));
  const param = {
    guid,
    songmid: filenames.length ? filenames.map(() => songmid) : [songmid],
    songtype: filenames.length ? filenames.map(() => 0) : [0],
    uin,
    loginflag: 1,
    platform: '20'
  };
  if (filenames.length) param.filename = filenames;
  const comm = { uin, format: 'json', ct: authKey ? 19 : 24, cv: 0 };
  if (authKey) comm.authst = authKey;
  const json = await qqMusicRequest({
    comm,
    req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param }
  }, { cookieObj });
  const data = json && json.req_0 && json.req_0.data || {};
  const infos = Array.isArray(data.midurlinfo) ? data.midurlinfo : [];
  const info = infos.find(item => item && item.purl) || infos[0] || {};
  if (info.purl) {
    const sip = data.sip && data.sip[0] || 'https://ws.stream.qqmusic.qq.com/';
    const fileMeta = candidates.find(item => item.filename === info.filename) || {};
    return {
      provider: 'qq-extension',
      url: ensureHttpsAudioUrl(sip + info.purl),
      trial: false,
      playable: true,
      level: fileMeta.level || 'standard',
      quality: fileMeta.label || 'QQ Music',
      filename: info.filename || ''
    };
  }
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
    reason: !loggedIn ? 'login_required' : (!playbackKey ? 'playback_key_missing' : 'url_unavailable'),
    message,
    qqCode: code
  };
}

async function enrichQQSongs(songs) {
  const checked = [];
  for (const song of songs.slice(0, 12)) {
    try {
      const playback = await qqSongUrl(song);
      song.playbackChecked = true;
      song.playable = !!playback.url;
      song.playbackCode = playback.qqCode || 0;
      if (playback.url) song.probedAudioUrl = playback.url;
      if (playback.message) song.playbackMessage = playback.message;
      checked.push(song);
    } catch (err) {
      song.playbackChecked = true;
      song.playable = false;
      song.playbackMessage = err && err.message || 'QQ Music did not return a playable URL';
    }
  }
  return checked.filter(song => song.playable !== false);
}

async function qqSearch(payload) {
  const q = String(payload && payload.q || '').trim();
  const limit = Math.max(1, Math.min(20, Number(payload && payload.limit) || 8));
  if (!q) return { songs: [] };
  const base = await qqSmartboxSearch(q, limit);
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
  return {
    provider: 'kugou',
    loggedIn: ctx.loggedIn,
    hasToken: !!ctx.token,
    userId: ctx.userid === '0' ? '' : ctx.userid,
    vipType: ctx.vipType
  };
}

async function kugouSearch(payload) {
  const q = String(payload && payload.q || '').trim();
  const limit = Math.max(1, Math.min(20, Number(payload && payload.limit) || 8));
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
  songs = await enrichKugouSongs(songs);
  return { songs };
}

async function enrichKugouSongs(songs) {
  const checked = [];
  for (const song of songs.slice(0, 12)) {
    try {
      const playback = await kugouSongUrl(song);
      song.playbackChecked = true;
      song.playable = !!playback.url;
      song.playbackCode = playback.code || 0;
      if (playback.url) song.probedAudioUrl = playback.url;
      if (playback.cover) song.cover = song.cover || playback.cover;
      if (playback.lyric) song.lyric = playback.lyric;
      checked.push(song);
    } catch (err) {
      song.playbackChecked = true;
      song.playable = false;
      song.playbackCode = 0;
      song.playbackMessage = err && err.message || '酷狗未返回可播放地址';
    }
  }
  return checked.filter(song => song.playable !== false);
}

async function kugouSongUrl(payload) {
  const song = payload || {};
  const encodeAlbumAudioId = String(song.mid || song.id || song.encode_album_audio_id || song.EMixSongID || '').trim();
  if (!encodeAlbumAudioId) throw new Error('Missing Kugou song id');
  const ctx = await kugouContext();
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
  const url = 'https://wwwapi.kugou.com/play/songinfo?' + new URLSearchParams(params).toString();
  const data = await kugouFetchJson(url);
  const body = data && (data.data || data) || {};
  const audioUrl = ensureHttpsAudioUrl(body.play_url || body.backup_url && body.backup_url[0] || body.play_backup_url && body.play_backup_url[0] || '');
  return {
    provider: 'kugou-extension',
    url: audioUrl,
    level: body.bit_rate ? String(body.bit_rate) : 'standard',
    quality: '酷狗扩展',
    code: data && (data.status || data.error_code || data.err_code) || 0,
    trial: false,
    playable: !!audioUrl,
    cover: kugouCoverUrl(body.img || body.album_img || ''),
    lyric: body.lyrics || body.lyric || '',
    reason: audioUrl ? '' : 'url_unavailable',
    message: audioUrl ? '' : ((data && (data.error_msg || data.msg)) || '酷狗没有返回可播放地址，可能需要网页登录或受版权限制')
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
    if (action === 'netease.home') return jsonResponse(requestId, await neteaseHome(payload));
    if (action === 'netease.playlistTracks') return jsonResponse(requestId, await neteasePlaylistTracks(payload));
    if (action === 'netease.search') return jsonResponse(requestId, await neteaseSearch(payload));
    if (action === 'netease.lyric') return jsonResponse(requestId, await neteaseLyric(payload));
    if (action === 'netease.songUrl') return jsonResponse(requestId, await neteaseSongUrl(payload));
    if (action === 'kugou.status') return jsonResponse(requestId, { status: await kugouStatus() });
    if (action === 'kugou.search') return jsonResponse(requestId, await kugouSearch(payload));
    if (action === 'kugou.lyric') return jsonResponse(requestId, await kugouLyric(payload));
    if (action === 'kugou.songUrl') return jsonResponse(requestId, await kugouSongUrl(payload));
    if (action === 'qq.status') return jsonResponse(requestId, { status: await qqStatus() });
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
