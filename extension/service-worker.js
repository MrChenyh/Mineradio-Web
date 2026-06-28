'use strict';

const NETEASE_ORIGIN = 'https://music.163.com';

function jsonResponse(requestId, data) {
  return Object.assign({ requestId, ok: true }, data || {});
}

function errorResponse(requestId, err) {
  const message = err && err.message ? err.message : String(err || 'Connector request failed');
  return { requestId, ok: false, error: message };
}

function neteaseHeaders(extra) {
  return Object.assign({
    Referer: NETEASE_ORIGIN + '/'
  }, extra || {});
}

async function fetchText(url, options) {
  const res = await fetch(url, Object.assign({
    credentials: 'include',
    cache: 'no-store',
    referrer: NETEASE_ORIGIN + '/',
    headers: neteaseHeaders()
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

function artistNames(list) {
  return (Array.isArray(list) ? list : [])
    .map(item => item && item.name)
    .filter(Boolean)
    .join(', ');
}

function coverUrl(song) {
  const album = song && (song.album || song.al) || {};
  const raw = album.picUrl || (album.picId ? ('https://p1.music.126.net/' + album.picId + '.jpg') : '');
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

async function neteaseStatus() {
  const musicU = await chrome.cookies.get({ url: NETEASE_ORIGIN + '/', name: 'MUSIC_U' });
  const csrf = await chrome.cookies.get({ url: NETEASE_ORIGIN + '/', name: '__csrf' });
  return {
    provider: 'netease',
    loggedIn: !!(musicU && musicU.value),
    hasCsrf: !!(csrf && csrf.value),
    nickname: '',
    userId: ''
  };
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
  const songs = ((data.result && data.result.songs) || []).map(normalizeSong).filter(song => song.id && song.name);
  return { songs };
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
  if (!id) throw new Error('Missing song id');
  const params = new URLSearchParams({
    id,
    ids: '[' + id + ']',
    br
  });
  const data = await fetchJson(NETEASE_ORIGIN + '/api/song/enhance/player/url?' + params.toString());
  const item = data && data.data && data.data[0] || {};
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

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  const requestId = message && message.requestId;
  const action = message && message.action;
  const payload = message && message.payload || {};
  (async function () {
    if (action === 'ping') return jsonResponse(requestId, { version: chrome.runtime.getManifest().version });
    if (action === 'netease.status') return jsonResponse(requestId, { status: await neteaseStatus() });
    if (action === 'netease.search') return jsonResponse(requestId, await neteaseSearch(payload));
    if (action === 'netease.lyric') return jsonResponse(requestId, await neteaseLyric(payload));
    if (action === 'netease.songUrl') return jsonResponse(requestId, await neteaseSongUrl(payload));
    throw new Error('Unknown connector action: ' + action);
  })().then(sendResponse).catch(function (err) {
    console.warn('[Mineradio Connector]', action, err);
    sendResponse(errorResponse(requestId, err));
  });
  return true;
});
