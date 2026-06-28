'use strict';

const NETEASE_ORIGIN = 'https://music.163.com';
const KUGOU_ORIGIN = 'https://www.kugou.com';
const KUGOU_SIGN_SECRET = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';

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
  options = options || {};
  const res = await fetch(url, Object.assign({
    credentials: 'include',
    cache: 'no-store',
    referrer: options.referrer || NETEASE_ORIGIN + '/',
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
    const params = new URLSearchParams({
      ids: JSON.stringify(ids),
      br: '128000'
    });
    const data = await fetchJson(NETEASE_ORIGIN + '/api/song/enhance/player/url?' + params.toString());
    ((data && data.data) || []).forEach(item => out.set(Number(item.id), item));
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
    if (action === 'netease.search') return jsonResponse(requestId, await neteaseSearch(payload));
    if (action === 'netease.lyric') return jsonResponse(requestId, await neteaseLyric(payload));
    if (action === 'netease.songUrl') return jsonResponse(requestId, await neteaseSongUrl(payload));
    if (action === 'kugou.status') return jsonResponse(requestId, { status: await kugouStatus() });
    if (action === 'kugou.search') return jsonResponse(requestId, await kugouSearch(payload));
    if (action === 'kugou.lyric') return jsonResponse(requestId, await kugouLyric(payload));
    if (action === 'kugou.songUrl') return jsonResponse(requestId, await kugouSongUrl(payload));
    throw new Error('Unknown connector action: ' + action);
  })().then(sendResponse).catch(function (err) {
    console.warn('[Mineradio Connector]', action, err);
    sendResponse(errorResponse(requestId, err));
  });
  return true;
});
