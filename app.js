(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var noop = function () {};

  /* ---------- storage ---------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('rm_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem('rm_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- MAX bridge (безопасно, если открыто не в Max) ---------- */
  var WA = window.WebApp || null;
  try { if (WA && typeof WA.ready === 'function') WA.ready(); } catch (e) {}
  function haptic() {
    try {
      var h = WA && WA.HapticFeedback;
      var r = h && h.impactOccurred && h.impactOccurred('light');
      if (r && r.catch) r.catch(noop);
    } catch (e) {}
  }
  var onBack = function () { closeOverlay(); };
  function bridgeBack(show) {
    try {
      var b = WA && WA.BackButton;
      if (!b) return;
      if (show) { b.onClick(onBack); b.show(); } else { b.offClick(onBack); b.hide(); }
    } catch (e) {}
  }

  /* ---------- данные ---------- */
  // Сначала российское зеркало каталога, затем официальные узлы Radio Browser.
  // Если один узел недоступен из сети пользователя, radioApi автоматически пробует следующий.
  var HOSTS = [
    'https://api.muzloo.ru',
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://fi1.api.radio-browser.info',
    'https://at1.api.radio-browser.info'
  ];
  var hostIdx = 0;

  // Жанры (genres.js). Для станций без тегов жанр задан вручную по названию потока/формату сети;
  // где формат достоверно определить нельзя — «ДРУГИЕ».
  var GN = window.RM_GENRES;

  // Отбор зарубежных станций: ПОРЯДКОВЫЕ НОМЕРА (с 1) в исходном списке по популярности для страны —
  // это тот же запрос и тот же фильтр (https, без HLS, без повторов по названию), что показывал
  // прежний выбор стран. Это не ID станций. Остальные страны в каталог не входят.
  var FOREIGN_PICKS = {
    GB: [6, 10, 12, 14, 26, 39, 52],
    US: [3, 5, 9, 10, 12, 16, 17, 36, 43, 60, 61, 64, 67]
  };
  var FOREIGN_CACHE_KEY = 'foreign_v1';

  // Избранные прямые потоки российских радиосетей.
  // Источники: официальные потоки вещателей и опубликованные прямые адреса.
  var FEATURED_STATIONS = [
    // Зайцев.FM
    { id: 'featured-zaycev-pop', n: 'ЗАЙЦЕВ.FM · POP', u: 'https://abs.zaycev.fm/pop256k', b: 256, c: 'MP3' },
    { id: 'featured-zaycev-club', n: 'ЗАЙЦЕВ.FM · CLUB', u: 'https://abs.zaycev.fm/club256k', b: 256, c: 'MP3' },
    { id: 'featured-zaycev-disco', n: 'ЗАЙЦЕВ.FM · DISCO', u: 'https://abs.zaycev.fm/disco256k', b: 256, c: 'MP3' },
    { id: 'featured-zaycev-rock', n: 'ЗАЙЦЕВ.FM · NEW ROCK', u: 'https://abs.zaycev.fm/rock256k', b: 256, c: 'MP3' },
    { id: 'featured-zaycev-rus', n: 'ЗАЙЦЕВ.FM · RUS', u: 'https://abs.zaycev.fm/rus256k', b: 256, c: 'MP3' },
    { id: 'featured-zaycev-shanson', n: 'ЗАЙЦЕВ.FM · ШАНСОН', u: 'https://abs.zaycev.fm/shanson256k', b: 256, c: 'MP3' },

    // Радио Рекорд
    { id: 'featured-record-main', n: 'RECORD · ОСНОВНОЙ', u: 'https://radiorecord.hostingradio.ru/rr_main96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-russian-mix', n: 'RECORD · RUSSIAN MIX', u: 'https://radiorecord.hostingradio.ru/rus96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-alltimers', n: 'RECORD · ХИТЫ ВСЕХ ВРЕМЁН', u: 'https://radiorecord.hostingradio.ru/alltimers96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-90s', n: 'RECORD · СУПЕРДИСКОТЕКА 90-Х', u: 'https://radiorecord.hostingradio.ru/sd9096.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-russianhits', n: 'RECORD · RUSSIAN HITS', u: 'https://radiorecord.hostingradio.ru/russianhits96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-pump', n: 'RECORD · КОЛБАСНЫЙ ЦЕХ', u: 'https://radiorecord.hostingradio.ru/pump96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-festivals', n: 'RECORD · FESTIVALS', u: 'https://radiorecord.hostingradio.ru/livedjsets96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-deep', n: 'RECORD · DEEP', u: 'https://radiorecord.hostingradio.ru/deep96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-chill', n: 'RECORD · CHILL-OUT', u: 'https://radiorecord.hostingradio.ru/chil96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-tales', n: 'RECORD · СКАЗКИ MC V', u: 'https://radiorecord.hostingradio.ru/skazki96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-bbq', n: 'RECORD · НА ШАШЛЫКИ!', u: 'https://radiorecord.hostingradio.ru/nashashlyki96.aacp', b: 96, c: 'AAC' },
    { id: 'featured-record-house', n: 'RECORD · HOUSE', u: 'https://radiorecord.hostingradio.ru/house96.aacp', b: 96, c: 'AAC' },

    // MAXIMUM и ПИ FM
    { id: 'featured-maximum', n: 'MAXIMUM · ОСНОВНОЙ', u: 'https://maximum.hostingradio.ru/maximum128.mp3', b: 128, c: 'MP3' },
    { id: 'featured-pifm', n: 'ПИ FM · МОСКВА', u: 'https://cdn.pifm.ru/mp3', b: 128, c: 'MP3' }
  ];

  var FEATURED_GENRES = {
    'featured-zaycev-pop': ['pop'], 'featured-zaycev-club': ['elec'], 'featured-zaycev-disco': ['elec', 'retro'],
    'featured-zaycev-rock': ['rock'], 'featured-zaycev-rus': ['pop'], 'featured-zaycev-shanson': ['chanson'],
    'featured-record-main': ['elec'], 'featured-record-russian-mix': ['elec', 'pop'],
    'featured-record-alltimers': ['retro', 'elec'], 'featured-record-90s': ['retro', 'elec'],
    'featured-record-russianhits': ['pop', 'elec'], 'featured-record-pump': ['elec'],
    'featured-record-festivals': ['elec'], 'featured-record-deep': ['elec'], 'featured-record-chill': ['elec'],
    'featured-record-tales': ['kids'], 'featured-record-bbq': ['other'], 'featured-record-house': ['elec'],
    'featured-maximum': ['pop'], 'featured-pifm': ['other']
  };
  FEATURED_STATIONS.forEach(function (st) { st.cc = 'RU'; st.g = FEATURED_GENRES[st.id] || ['other']; });

  var DEFAULT_CITIES = [
    { n: 'Москва', la: 55.7558, lo: 37.6173 },
    { n: 'Санкт-Петербург', la: 59.9343, lo: 30.3351 },
    { n: 'Екатеринбург', la: 56.8389, lo: 60.6057 },
    { n: 'Новосибирск', la: 55.0084, lo: 82.9357 },
    { n: 'Казань', la: 55.7887, lo: 49.1221 },
    { n: 'Воронеж', la: 51.6608, lo: 39.2003 }
  ];

  var WMO = {
    0: 'ЯСНО', 1: 'ПРЕИМ. ЯСНО', 2: 'ПЕРЕМ. ОБЛАЧНО', 3: 'ПАСМУРНО', 45: 'ТУМАН', 48: 'ИЗМОРОЗЬ',
    51: 'МОРОСЬ', 53: 'МОРОСЬ', 55: 'МОРОСЬ', 56: 'ЛЕДЯНАЯ МОРОСЬ', 57: 'ЛЕДЯНАЯ МОРОСЬ',
    61: 'ДОЖДЬ', 63: 'ДОЖДЬ', 65: 'СИЛЬНЫЙ ДОЖДЬ', 66: 'ЛЕДЯНОЙ ДОЖДЬ', 67: 'ЛЕДЯНОЙ ДОЖДЬ',
    71: 'СНЕГ', 73: 'СНЕГ', 75: 'СИЛЬНЫЙ СНЕГ', 77: 'СНЕЖНАЯ КРУПА',
    80: 'ЛИВЕНЬ', 81: 'ЛИВЕНЬ', 82: 'СИЛЬНЫЙ ЛИВЕНЬ', 85: 'СНЕГОПАД', 86: 'СНЕГОПАД',
    95: 'ГРОЗА', 96: 'ГРОЗА С ГРАДОМ', 99: 'ГРОЗА С ГРАДОМ'
  };

  var dn = null;
  try { dn = new Intl.DisplayNames(['ru'], { type: 'region' }); } catch (e) {}
  function countryName(cc) {
    try { return (dn && dn.of(cc)) || cc; } catch (e) { return cc; }
  }

  /* ---------- состояние ---------- */
  var S = {
    status: 'stop',        // желаемое состояние: play | pause | stop
    playing: false,        // реально идёт звук
    gen: 0,
    msg: null,
    theme: store.get('theme', 'dark'),
    vol: store.get('vol', 72),
    base: [],              // каталог (РФ + выбранные GB/US) с учётом поиска
    full: [],              // каталог без поискового запроса — для списка доступных жанров
    list: [], cur: null, query: '',
    accMs: 0, segStart: 0, // время воспроизведения: накопленное + текущий отрезок
    loading: true, err: false,
    cities: store.get('cities', null) || DEFAULT_CITIES.slice(),
    ci: store.get('ci', 0),
    weather: null, geo: [], geoBusy: false,
    eqLive: false, ovMode: null, ovTab: 'all',
    favs: store.get('favs', []) || []
  };
  if (!Array.isArray(S.favs)) S.favs = [];
  // Внутри Android-приложения звук играет нативный плеер (шторка, Bluetooth, магнитола)
  var NATIVE = !!window.RadioAndroid;
  function nat(fn) { if (!NATIVE) return; try { fn(window.RadioAndroid); } catch (e) {} }
  if (S.ci >= S.cities.length || S.ci < 0) S.ci = 0;
  if (S.theme !== 'dark' && S.theme !== 'light') S.theme = 'dark';

  /* ---------- время воспроизведения (по меткам времени, не по счётчику таймера) ---------- */
  function markPlaying(v) {
    v = !!v;
    if (v === S.playing) return;
    var now = Date.now();
    if (v) S.segStart = now;
    else if (S.segStart) { S.accMs += now - S.segStart; S.segStart = 0; }
    S.playing = v;
  }
  function resetElapsed() { S.accMs = 0; S.segStart = S.playing ? Date.now() : 0; }
  function elapsedSec() { return Math.floor((S.accMs + (S.segStart ? Date.now() - S.segStart : 0)) / 1000); }

  /* ---------- сеть ---------- */
  function fetchJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 8000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }

  function radioApi(path) {
    var tries = 0;
    function next() {
      if (tries >= HOSTS.length) return Promise.reject(new Error('radio api unavailable'));
      var i = (hostIdx + tries) % HOSTS.length;
      return fetchJSON(HOSTS[i] + path).then(function (d) { hostIdx = i; return d; }, function () { tries++; return next(); });
    }
    return next();
  }


  /* ---------- каталог ---------- */
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  // Единый конвейер: тот же фильтр, что и в исходной версии (только https, без HLS, без повторов по названию).
  // Порядок — порядок ответа API (по популярности), он определяет «порядковые номера» отбора.
  function normalizeStations(arr, cc) {
    var seen = {}, out = [];
    (arr || []).forEach(function (s) {
      var u = s.url_resolved || '';
      if (!/^https:\/\//i.test(u) || s.hls) return;
      var nm = norm(s.name);
      if (!nm) return;
      var k = nm.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      var tags = norm(s.tags);
      out.push({ id: s.stationuuid, n: nm, u: u, b: s.bitrate || 0, c: (s.codec || '').toUpperCase(),
        cc: cc, t: tags, l: s.favicon || '', g: GN.classify(nm, tags) });
    });
    return out;
  }

  function gOf(st) { return (st && st.g && st.g.length) ? st.g : GN.classify(st && st.n, st && st.t); }
  function inGenre(st, id) { return id === 'all' || gOf(st).indexOf(id) >= 0; }
  function matchQuery(st, q) { return !q || st.n.toLowerCase().indexOf(q) >= 0; }

  function featuredForQuery(query) {
    var q = (query || '').trim().toLowerCase();
    return FEATURED_STATIONS.filter(function (st) { return matchQuery(st, q); });
  }

  // РФ: все избранные потоки + весь ответ каталога (как и раньше — без отсева по рейтингу и доступности).
  function mergeFeatured(dynamicStations, query) {
    var featured = featuredForQuery(query);
    var merged = [], names = {};
    featured.concat(dynamicStations || []).forEach(function (st) {
      var key = (st.n || '').toLowerCase();
      if (!st.u || names[key]) return;
      names[key] = true;
      merged.push(st);
    });
    return merged.slice(0, 120);
  }

  /* ---------- зарубежные станции: GB и US по порядковым номерам ---------- */
  // 1) catalog.json — проверенный снимок, собранный tools/build_catalog.mjs (в нём только рабочие потоки);
  // 2) иначе живой запрос по тем же номерам, результат фиксируется на устройстве (чтобы выбор не «плыл»).
  var foreignPromise = null;
  function loadForeign() {
    if (foreignPromise) return foreignPromise;
    foreignPromise = fetchJSON('catalog.json?v=1', 8000).then(function (j) {
      var arr = j && Array.isArray(j.foreign) ? j.foreign : [];
      if (!arr.length) throw new Error('catalog.json: foreign is empty');
      return arr.filter(function (st) { return st && st.u && /^(GB|US)$/.test(st.cc); });
    }).catch(function () {
      var cached = store.get(FOREIGN_CACHE_KEY, null);
      if (cached && cached.length) return cached;
      return Promise.all(Object.keys(FOREIGN_PICKS).map(function (cc) {
        var path = '/json/stations/search?countrycode=' + cc +
          '&hidebroken=true&order=clickcount&reverse=true&limit=120&is_https=true';
        return radioApi(path).then(function (arr) {
          var all = normalizeStations(arr, cc);
          return FOREIGN_PICKS[cc].map(function (n) { return all[n - 1]; }).filter(Boolean);
        }, function () { return []; });
      })).then(function (parts) {
        var out = [].concat.apply([], parts);
        if (out.length) store.set(FOREIGN_CACHE_KEY, out);
        return out;
      });
    }).then(function (arr) {
      S.foreign = arr;
      return arr;
    });
    return foreignPromise;
  }
  S.foreign = [];

  /* ---------- список станций (без разделения по жанрам) ---------- */
  // Пересобрать итоговый список: РФ + GB/US и поиск. Все станции — в одном списке.
  // Текущую станцию и воспроизведение не трогаем.
  function applyGenre() {
    var q = S.query.trim().toLowerCase();
    S.base = S.ru.concat(S.foreign.filter(function (st) { return matchQuery(st, q); }));
    S.full = S.base;
    S.list = S.base;
  }
  S.ru = [];

  var loadSeq = 0;
  function loadList() {
    var seq = ++loadSeq;
    S.loading = true; S.err = false;
    // Показываем последний успешно загруженный каталог, пока сеть отвечает.
    var cached = store.get('stations_RU', []);
    if (!S.ru.length && cached && cached.length) S.ru = cached;
    S.ru = mergeFeatured(S.ru, S.query);
    applyGenre();
    render();
    var q = S.query.trim();
    var path = '/json/stations/search?countrycode=RU' +
      '&hidebroken=true&order=clickcount&reverse=true&limit=120&is_https=true' +
      (q ? '&name=' + encodeURIComponent(q) : '');
    var fp = loadForeign().then(function () { if (seq === loadSeq) { applyGenre(); render(); if (S.ovMode) renderOverlay(); } });
    var rp = radioApi(path).then(function (arr) {
      if (seq !== loadSeq) return;
      var out = normalizeStations(arr, 'RU');
      S.ru = mergeFeatured(out, q);
      if (!q) store.set('stations_RU', S.ru);
      S.loading = false;
    }, function () {
      if (seq !== loadSeq) return;
      S.loading = false; S.err = true;
      // Не стираем ранее сохранённые станции при временной недоступности API.
      S.ru = mergeFeatured((S.ru && S.ru.length ? S.ru : (cached || [])), S.query);
    });
    return Promise.all([rp, fp]).then(function () {
      if (seq !== loadSeq) return;
      applyGenre();
      render();
      if (S.ovMode) renderOverlay();
    });
  }

  /* ---------- предотвращение выключения экрана ---------- */
  var screenWakeLock = null;
  var wakeLockWanted = false;

  function requestScreenWakeLock() {
    wakeLockWanted = true;
    if (!('wakeLock' in navigator) || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    if (screenWakeLock && !screenWakeLock.released) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      screenWakeLock = lock;
      lock.addEventListener('release', function () {
        if (screenWakeLock === lock) screenWakeLock = null;
      });
    }).catch(function () {
      // Браузер или устройство может не поддерживать Screen Wake Lock.
    });
  }

  function releaseScreenWakeLock() {
    wakeLockWanted = false;
    if (screenWakeLock) {
      var lock = screenWakeLock;
      screenWakeLock = null;
      try { lock.release(); } catch (e) {}
    }
  }

  /* ---------- сворачивание / возврат в приложение ---------- */
  // Аудиоэлемент НЕ уничтожается ни при перерисовке интерфейса, ни при смене экрана/оверлея (render() только
  // обновляет текст). При сворачивании поток не останавливаем: если звук идёт через Web Audio (ради живого
  // спектра), переводим его на обычный <audio>, который ОС не глушит в фоне. После возврата — докручиваем
  // воспроизведение, если система его приостановила.
  function onBackground() {
    if (NATIVE) return;
    if (S.status === 'play' && curNode) switchToPlain();
  }
  function onForeground() {
    if (NATIVE) return;
    if (document.visibilityState === 'hidden') return;
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    if (S.status === 'play') {
      requestScreenWakeLock();
      if (!audio) startStream();
      else if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () { startStream(); }); }
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') onForeground(); else onBackground();
  });
  window.addEventListener('pagehide', onBackground);
  window.addEventListener('pageshow', function (e) { if (e.persisted) onForeground(); });

  /* ---------- аудио ---------- */
  var audio = null, ctx = null, analyser = null, gain = null, curNode = null, fftBuf = null;

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          ctx = new AC();
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.55;
          gain = ctx.createGain();
          gain.gain.value = S.vol / 100;
          analyser.connect(gain);
          gain.connect(ctx.destination);
          fftBuf = new Uint8Array(analyser.frequencyBinCount);
          // Если ОС приостановила Web Audio (сворачивание, блокировка экрана), звук, идущий через него, замолкает.
          // В этом случае переводим поток на обычный <audio> без Web Audio — он продолжает играть в фоне.
          ctx.onstatechange = function () {
            if (ctx && ctx.state !== 'running' && S.status === 'play' && curNode) switchToPlain();
          };
        } catch (e) { ctx = null; analyser = null; gain = null; }
      }
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  function dropAudio() {
    if (curNode) { try { curNode.disconnect(); } catch (e) {} curNode = null; }
    if (audio) {
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (e) {}
      audio = null;
    }
  }

  // Пересоздаёт поток на обычном <audio> (одновременно живёт только один элемент: attempt() сначала сбрасывает прежний).
  function switchToPlain() {
    if (!S.cur || !curNode || S.status !== 'play') return;
    attempt(S.cur, false, S.gen);
  }

  var retryTimer = null, retryN = 0, streamUp = false; // streamUp: поток хотя бы раз начал играть
  function stopStream() {
    nat(function (R) { R.pause(); });
    releaseScreenWakeLock();
    clearTimeout(retryTimer); retryTimer = null; retryN = 0; streamUp = false;
    S.gen++;
    markPlaying(false);
    S.eqLive = false;
    dropAudio();
  }

  var natKey = '';
  function nativeSync(force, play) {
    if (!NATIVE || !S.cur) return;
    var arr = stepArr();
    if (favIdxIn(arr, S.cur) < 0) arr = [S.cur];
    var key = arr.map(function (x) { return x.id; }).join(',') + '|' + S.cur.id;
    if (!force && key === natKey) return;
    natKey = key;
    var json = JSON.stringify(arr.map(function (x) { return { id: x.id, n: x.n, u: x.u }; }));
    var sub = 'Радио Май · ' + (S.favCtx && arr === S.favs ? 'Избранное' : 'Все станции');
    nat(function (R) { R.setQueue(json, S.cur.id, !!play, sub); });
  }
  function favIdxIn(arr, st) { for (var k = 0; k < arr.length; k++) if (arr[k].id === st.id) return k; return -1; }

  function startStream() {
    if (NATIVE) {
      S.gen++; markPlaying(false); S.eqLive = false;
      if (!S.cur) return;
      S.msg = 'ЗАГРУЗКА…';
      nat(function (R) { R.setVolume(S.vol / 100); });
      nativeSync(true, true);
      return;
    }
    stopStream();
    if (!S.cur) return;
    requestScreenWakeLock();
    S.msg = 'ЗАГРУЗКА…';
    attempt(S.cur, true, S.gen);
    updateMediaSession();
  }

  function attempt(st, cors, gen) {
    dropAudio();
    var a = new Audio();
    if (cors) a.crossOrigin = 'anonymous';
    a.preload = 'none';
    audio = a;
    S.eqLive = false;
    var wired = false;
    if (cors) {
      ensureCtx();
      if (ctx && analyser) {
        try {
          curNode = ctx.createMediaElementSource(a);
          curNode.connect(analyser);
          wired = true;
          S.eqLive = true;
        } catch (e) { curNode = null; }
      }
    }
    a.volume = wired ? 1 : S.vol / 100;

    var started = false;
    a.addEventListener('playing', function () {
      if (gen !== S.gen || a !== audio) return;
      started = true; streamUp = true; retryN = 0;
      markPlaying(true); S.msg = null; render();
      if (curNode && ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    });
    a.addEventListener('waiting', function () {
      if (gen !== S.gen || a !== audio) return;
      markPlaying(false); S.msg = 'БУФЕРИЗАЦИЯ…'; render();
    });
    // Обрыв сети / окончание «живого» потока: переподключаемся, а не останавливаем плеер
    // (раньше любой сетевой сбой в фоне навсегда останавливал музыку).
    function lost() {
      if (gen !== S.gen || a !== audio) return;
      if (cors && !started) { attempt(st, false, gen); return; }
      // Поток, который так и не заиграл, пробуем 2 раза (быстрый отказ); работавший ранее — до 5 раз.
      if (S.status === 'play' && retryN < (streamUp ? 5 : 2)) {
        retryN++;
        markPlaying(false); S.msg = 'ПЕРЕПОДКЛЮЧЕНИЕ…'; render();
        clearTimeout(retryTimer);
        retryTimer = setTimeout(function () { if (gen === S.gen && S.status === 'play') attempt(st, false, gen); }, 1200 * retryN);
        return;
      }
      fail('ПОТОК НЕДОСТУПЕН — ЖМИТЕ ▶▶');
    }
    a.addEventListener('error', lost);
    a.addEventListener('ended', lost);
    // Паузу не из приложения (гарнитура, звонок, системная шторка) отражаем на панели.
    a.addEventListener('pause', function () {
      if (gen !== S.gen || a !== audio) return;
      if (S.status === 'play' && document.visibilityState === 'visible') doPause();
    });
    a.src = st.u;
    var p = a.play();
    if (p && p.catch) p.catch(function (e) {
      if (gen !== S.gen || a !== audio) return;
      if (e && e.name === 'NotAllowedError') fail('НАЖМИТЕ PLAY');
    });
    render();
  }

  function fail(text) {
    stopStream(); nat(function (R) { R.stop(); });
    S.status = 'stop'; resetElapsed(); S.msg = text;
    render();
  }

  function setVol(v) {
    S.vol = v; store.set('vol', v);
    nat(function (R) { R.setVolume(v / 100); });
    if (gain) { try { gain.gain.value = v / 100; } catch (e) {} }
    if (audio && !curNode) { try { audio.volume = v / 100; } catch (e) {} }
    render();
  }

  /* ---------- управление ---------- */
  function doPlay() {
    if (!S.cur) { if (!S.list.length) return; S.cur = S.list[0]; store.set('sid', S.cur.id); }
    if (S.status === 'play' && S.playing) { requestScreenWakeLock(); return; }
    S.status = 'play';
    requestScreenWakeLock();
    startStream();
    render();
  }
  function doPause() {
    if (S.status === 'play') { stopStream(); S.status = 'pause'; S.msg = null; render(); }
    else if (S.status === 'pause') doPlay();
  }
  function doStop() {
    stopStream(); nat(function (R) { R.stop(); }); S.status = 'stop'; resetElapsed(); S.msg = null; render();
  }
  function selectStation(st, autoplay, ctx) {
    if (ctx) S.favCtx = ctx === 'fav';
    S.cur = st; markPlaying(false); resetElapsed(); S.msg = null;
    if (st) store.set('sid', st.id);
    if (autoplay) { S.status = 'play'; startStream(); }
    else if (S.status === 'play') startStream();
    render();
  }
  // Список для переключения: если играет станция из избранного (запущена из
  // вкладки «Избранное») — листаем только избранное, иначе весь список страны.
  function stepArr() {
    if (S.favCtx && S.favs.length && S.cur && favIndex(S.cur) >= 0) return S.favs;
    return S.list;
  }
  function stepStation(d, autoplay) {
    var arr = stepArr();
    if (!arr.length) return;
    var i = -1;
    if (S.cur) for (var k = 0; k < arr.length; k++) if (arr[k].id === S.cur.id) { i = k; break; }
    i = i < 0 ? (d > 0 ? 0 : arr.length - 1) : (i + d + arr.length) % arr.length;
    selectStation(arr[i], !!autoplay);
  }

  /* ---------- шторка уведомлений / Bluetooth (Media Session) ---------- */
  // Кнопки «вперёд/назад» в шторке и на магнитоле (AVRCP) переключают станции
  // в том же списке, что и экранные кнопки. Станция сразу включается.
  function stepRemote(d) { stepStation(d, true); }

  function mediaArtwork(name) {
    var t = String(name || '').toUpperCase();
    if (t.length > 22) t = t.slice(0, 21) + '…';
    t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
      '<defs><linearGradient id="r" x1="0" x2="1"><stop offset="0" stop-color="#ff5a36"/><stop offset=".35" stop-color="#f7b32b"/><stop offset=".7" stop-color="#5dd36f"/><stop offset="1" stop-color="#2f8fe0"/></linearGradient>' +
      '<radialGradient id="g" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#2a2d33"/><stop offset="1" stop-color="#14161a"/></radialGradient></defs>' +
      '<rect width="512" height="512" fill="url(#g)"/>' +
      '<rect x="28" y="92" width="456" height="328" rx="24" fill="#23262b" stroke="#4b5059" stroke-width="6"/>' +
      '<rect x="52" y="114" width="408" height="156" rx="10" fill="#f1e6c6"/>' +
      '<rect x="52" y="114" width="408" height="16" rx="8" fill="url(#r)"/>' +
      '<circle cx="82" cy="164" r="16" fill="none" stroke="#3a2a1c" stroke-width="3"/>' +
      '<text x="82" y="171" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#3a2a1c">A</text>' +
      '<text x="270" y="176" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="38" letter-spacing="5" fill="#3a2a1c">РАДИО МАЙ</text>' +
      '<rect x="68" y="196" width="376" height="42" rx="6" fill="#e3d3a0"/>' +
      '<text x="256" y="226" text-anchor="middle" font-family="Courier New,monospace" font-size="26" font-weight="700" fill="#3a2a1c">' + t + '</text>' +
      '<rect x="76" y="278" width="360" height="116" rx="16" fill="#0c0d0f" stroke="#2f3338" stroke-width="3"/>' +
      '<g transform="translate(180 336)"><circle r="40" fill="#6b4a37"/><circle r="22" fill="#f4f4f4"/><circle r="9" fill="#14161a"/></g>' +
      '<g transform="translate(332 336)"><circle r="40" fill="#6b4a37"/><circle r="22" fill="#f4f4f4"/><circle r="9" fill="#14161a"/></g>' +
      '<path d="M150 372 L180 376 L332 376 L362 372" stroke="#6b4a37" stroke-width="4" fill="none"/>' +
      '<circle cx="46" cy="106" r="5" fill="#9aa0a8"/><circle cx="466" cy="106" r="5" fill="#9aa0a8"/><circle cx="46" cy="406" r="5" fill="#9aa0a8"/><circle cx="466" cy="406" r="5" fill="#9aa0a8"/>' +
      '</svg>';
    return [{ src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), sizes: '512x512', type: 'image/svg+xml' }];
  }

  var msKey = null, msState = null, msBound = false;
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    var ms = navigator.mediaSession;
    try {
      if (!msBound) {
        msBound = true;
        var bind = function (name, fn) { try { ms.setActionHandler(name, fn); } catch (e) {} };
        bind('play', doPlay);
        bind('pause', doPause);
        bind('stop', doStop);
        bind('previoustrack', function () { stepRemote(-1); });
        bind('nexttrack', function () { stepRemote(1); });
      }
      if (S.cur) {
        var key = S.cur.id;
        if (key !== msKey) {
          msKey = key;
          ms.metadata = new MediaMetadata({
            title: S.cur.n,
            artist: 'Радио Май · ' + (S.cur.cc ? countryName(S.cur.cc) : 'Все станции'),
            album: S.favs.length ? 'Избранное' : 'Радио',
            artwork: mediaArtwork(S.cur.n)
          });
        }
      }
      var state = S.status === 'play' ? 'playing' : (S.status === 'pause' ? 'paused' : 'none');
      if (state !== msState) { msState = state; ms.playbackState = state; }
    } catch (e) {}
  }

  /* ---------- погода и время ---------- */
  function city() { return S.cities[S.ci] || S.cities[0]; }

  function weatherFromWttr(j) {
    var now = j && j.current_condition && j.current_condition[0];
    if (!now || now.temp_C === undefined || !isFinite(Number(now.temp_C))) throw new Error('wttr.in: no current conditions');
    var wt = Number(now.weatherCode);
    var map = {
      113:0,116:2,119:3,122:3,143:45,248:45,260:48,263:51,266:53,281:56,284:57,
      293:61,296:61,299:63,302:63,305:65,308:65,311:66,314:67,317:66,320:71,
      323:71,326:73,329:75,332:75,335:75,338:75,350:77,353:80,356:81,359:82,
      362:66,365:67,368:85,371:86,374:77,377:77,386:95,389:95,392:95,395:99
    };
    return {
      t: Math.round(Number(now.temp_C)),
      code: map[wt] === undefined ? 2 : map[wt],
      wind: now.windspeedKmph !== undefined ? Math.round(Number(now.windspeedKmph)) : null,
      windDir: now.winddir16Point || '',
      off: null,
      source: 'wttr.in',
      updated: Date.now()
    };
  }

  function weatherFromOpenMeteo(j) {
    if (!j || !j.current || typeof j.current.temperature_2m !== 'number') {
      throw new Error('Open-Meteo: no current conditions');
    }
    return {
      t: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      wind: typeof j.current.wind_speed_10m === 'number' ? Math.round(j.current.wind_speed_10m) : null,
      windDir: '',
      off: typeof j.utc_offset_seconds === 'number' ? j.utc_offset_seconds : null,
      source: 'Open-Meteo',
      updated: Date.now()
    };
  }

  function weatherFromMetNo(j) {
    var series = j && j.properties && j.properties.timeseries;
    if (!series || !series.length) throw new Error('MET Norway: no forecast');
    var now = series[0];
    var details = now.data && (now.data.instant && now.data.instant.details);
    if (!details || typeof details.air_temperature !== 'number') {
      throw new Error('MET Norway: no temperature');
    }
    var symbol = '';
    var next = now.data.next_1_hours || now.data.next_6_hours || now.data.next_12_hours;
    if (next && next.summary) symbol = next.summary.symbol_code || '';
    var code = 2;
    if (/clearsky/.test(symbol)) code = 0;
    else if (/fair/.test(symbol)) code = 1;
    else if (/partlycloudy/.test(symbol)) code = 2;
    else if (/cloudy/.test(symbol)) code = 3;
    else if (/fog/.test(symbol)) code = 45;
    else if (/heavyrain/.test(symbol)) code = 65;
    else if (/rain/.test(symbol)) code = 61;
    else if (/heavysnow/.test(symbol)) code = 75;
    else if (/snow/.test(symbol)) code = 71;
    else if (/thunder/.test(symbol)) code = 95;
    else if (/sleet/.test(symbol)) code = 67;
    return {
      t: Math.round(details.air_temperature),
      code: code,
      wind: typeof details.wind_speed === 'number' ? Math.round(details.wind_speed * 3.6) : null,
      windDir: '',
      off: null,
      source: 'MET Norway',
      updated: Date.now()
    };
  }

  function loadWeather() {
    var c = city();
    var cached = store.get('weather_' + c.n, null);
    if (!cached || cached.t === undefined || cached.t === null || !isFinite(Number(cached.t))) cached = null;
    S.weather = cached || null;
    render();

    // Источники проверяются по очереди: wttr.in, MET Norway, затем Open-Meteo.
    // Все запросы идут напрямую из браузера, без VPN и без ключей API.
    var requests = [
      function () {
        var url = 'https://wttr.in/' + encodeURIComponent(c.la + ',' + c.lo) + '?format=j1&lang=ru';
        return fetchJSON(url, 12000).then(weatherFromWttr);
      },
      function () {
        var url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' +
          encodeURIComponent(c.la) + '&lon=' + encodeURIComponent(c.lo);
        return fetchJSON(url, 12000).then(weatherFromMetNo);
      },
      function () {
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.la + '&longitude=' + c.lo +
          '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=auto';
        return fetchJSON(url, 12000).then(weatherFromOpenMeteo);
      }
    ];

    function trySource(index) {
      if (index >= requests.length) {
        if (city() !== c) return;
        // Не затираем последний успешно полученный прогноз при временном сбое сети.
        if (!S.weather) S.weather = { t: null, code: null, off: null };
        render();
        return;
      }
      requests[index]().then(function (result) {
        if (city() !== c) return;
        S.weather = result;
        store.set('weather_' + c.n, result);
        render();
      }).catch(function () {
        trySource(index + 1);
      });
    }
    trySource(0);
  }
  function stepCity(d) {
    S.ci = (S.ci + d + S.cities.length) % S.cities.length;
    store.set('ci', S.ci);
    loadWeather();
  }
  function fmtTemp(t) {
    var n = Math.round(Number(t));
    if (!isFinite(n)) return '— °C';
    return (n > 0 ? '+' + n : (n < 0 ? '−' + Math.abs(n) : '0')) + '°C';
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  /* ---------- отрисовка ---------- */
  function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
  function setWeatherMarquee(el, value) {
    var signature = value + '|' + (el.clientWidth || 0);
    if (el.getAttribute('data-marquee') === value) return;
    el.setAttribute('data-marquee', value);
    el.textContent = '';
    el.classList.add('weather-marquee');
    var track = document.createElement('span');
    track.className = 'weather-marquee-track';
    var first = document.createElement('span');
    var second = document.createElement('span');
    first.className = 'weather-marquee-item';
    second.className = 'weather-marquee-item';
    first.textContent = value;
    second.textContent = value;
    track.appendChild(first);
    track.appendChild(second);
    el.appendChild(track);
  }
  // Короткое название города стоит на месте, длинное — прокручивается.
  function setCityName(text) {
    var el = $('cityVal');
    if (text.length > 13) setWeatherMarquee(el, text);
    else {
      if (el.getAttribute('data-marquee')) { el.removeAttribute('data-marquee'); el.classList.remove('weather-marquee'); el.textContent = ''; }
      setText(el, text);
    }
  }
  function setCls(el, c) { if (el.className !== c) el.className = c; }
  function clip(t, n) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  function render() {
    var st = S.status;
    updateMediaSession();
    nativeSync(false, false);
    setCls($('app'), 'app ' + S.theme + ' s-' + st);
    setCls(document.body, S.theme);
    setText($('themeLabel'), S.theme === 'dark' ? 'НОЧЬ' : 'ДЕНЬ');

    setCls($('lampPlay'), 'lamp' + (st === 'play' ? ' on' : ''));
    setCls($('lampPause'), 'lamp' + (st === 'pause' ? ' on' : ''));
    setCls($('lampStop'), 'lamp' + (st === 'stop' ? ' on' : ''));
    setCls($('lampStereo'), 'lamp' + (S.playing ? ' on' : ''));
    setCls($('btnPlay'), 'btn' + (st === 'play' ? ' pressed' : ''));
    setCls($('btnPause'), 'btn' + (st === 'pause' ? ' pressed' : ''));
    setCls($('btnStop'), 'btn' + (st === 'stop' ? ' pressed' : ''));
    $('btnPlay').setAttribute('aria-pressed', st === 'play');
    $('btnPause').setAttribute('aria-pressed', st === 'pause');
    $('btnStop').setAttribute('aria-pressed', st === 'stop');

    var cur = S.cur;
    setText($('infoBitrate'), cur && cur.b ? cur.b + ' KBPS' : '— KBPS');
    setText($('infoCodec'), cur ? ((cur.c || 'STREAM') + (S.playing ? (S.eqLive ? ' · FFT' : ' · SIM') : '')) : '—');
    setText($('infoCountry'), cur && cur.cc ? cur.cc + ' · ' + countryName(cur.cc).toUpperCase() : '—');

    var name = cur ? cur.n : (S.loading ? 'ЗАГРУЗКА…' : (S.err ? 'НЕТ СВЯЗИ' : 'НЕТ СТАНЦИЙ'));
    var mq;
    if (S.msg) mq = S.msg;
    else if (S.loading && !cur) mq = 'ЗАГРУЗКА СТАНЦИЙ…';
    else if (S.err && !cur) mq = 'НЕТ СВЯЗИ С КАТАЛОГОМ РАДИОСТАНЦИЙ';
    else if (!cur) mq = 'СТАНЦИИ НЕ НАЙДЕНЫ';
    else if (st === 'stop') mq = 'НАЖМИТЕ PLAY · ' + name;
    else mq = (cur.cc ? cur.cc + ' · ' + countryName(cur.cc) + ' — ' : '') + name + (cur.b ? ' · ' + cur.b + ' KBPS' : '');
    mq = mq.toUpperCase();
    setText($('mq1'), mq); setText($('mq2'), mq);
    setText($('stationLabel'), clip(name, 34));
    $('cassette').setAttribute('aria-label', 'Аудиокассета Радио Май: ' + name);

    setText($('listTab'), 'СПИСОК СТАНЦИЙ · ' + S.list.length);

    var c = city(), w = S.weather;
    var tempValue = w && w.t !== null && w.t !== undefined && isFinite(Number(w.t)) ? Number(w.t) : null;
    var conditionText = !w || tempValue === null ? (!w ? 'ЗАГРУЗКА…' : 'НЕТ ДАННЫХ') : (WMO[w.code] || 'ПОГОДА');
    var windText = w && w.wind !== null && w.wind !== undefined && isFinite(Number(w.wind))
      ? 'ВЕТЕР ' + Math.round(Number(w.wind)) + ' КМ/Ч' : '';
    // Верхняя строка: город и температура. Нижняя строка: состояние и ветер.
    // Обе строки прокручиваются независимо, поэтому состояние погоды больше не стоит на месте.
    setText($('wxTemp'), tempValue === null ? '— °C' : fmtTemp(tempValue));
    setCityName(c.n.toUpperCase());
    var conditionParts = [conditionText, windText].filter(function (part) { return !!part; });
    setWeatherMarquee($('cond'), conditionParts.join('   •   '));

    var fb = $('btnFav'), isFav = !!(S.cur && favIndex(S.cur) >= 0);
    setCls(fb, 'btn favbtn' + (isFav ? ' is-fav' : ''));
    fb.setAttribute('aria-pressed', isFav);
    fb.setAttribute('aria-label', isFav ? 'Убрать из избранного' : 'Добавить в избранное');
    setText($('volNum'), String(S.vol));
    $('vfill').style.width = S.vol + '%';
    if ($('vol').value !== String(S.vol)) $('vol').value = S.vol;
    tickClock();
    wxSetup();
    scIdle();
  }

  // Верхний зелёный дисплей — местное время устройства (ЧЧ:ММ).
  function tickClock() {
    var d = new Date();
    setText($('clockTop'), p2(d.getHours()) + ':' + p2(d.getMinutes()));
  }

  /* ---------- оверлей (станции / страны / города) ---------- */
  function favIndex(st) { for (var k = 0; k < S.favs.length; k++) if (S.favs[k].id === st.id) return k; return -1; }
  function toggleFav(st) {
    if (!st) {
      S.msg = 'СНАЧАЛА ВЫБЕРИТЕ СТАНЦИЮ'; render();
      setTimeout(function () { if (S.msg === 'СНАЧАЛА ВЫБЕРИТЕ СТАНЦИЮ') { S.msg = null; render(); } }, 2500);
      return;
    }
    var k = favIndex(st);
    if (k >= 0) S.favs.splice(k, 1);
    else S.favs.push({ id: st.id, n: st.n, u: st.u, b: st.b, c: st.c, cc: st.cc, t: st.t, g: st.g });
    store.set('favs', S.favs);
    render(); renderOverlay();
  }
  function mkRow(idx, name, right, active, fn, favSt) {
    var b = document.createElement('button');
    b.className = 'plrow' + (active ? ' on' : '');
    b.type = 'button';
    var i = document.createElement('span'); i.className = 'idx'; i.textContent = idx;
    var n = document.createElement('span'); n.style.cssText = 'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; n.textContent = name;
    var r = document.createElement('span'); r.className = 'right'; r.textContent = right || '';
    b.appendChild(i); b.appendChild(n); b.appendChild(r);
    if (favSt) {
      var h = document.createElement('span'); h.className = 'heart'; h.setAttribute('role', 'button');
      var isF = favIndex(favSt) >= 0;
      h.textContent = isF ? '♥' : '♡'; h.setAttribute('aria-label', isF ? 'Убрать из избранного' : 'В избранное');
      h.addEventListener('click', function (e) { e.stopPropagation(); haptic(); toggleFav(favSt); });
      b.appendChild(h);
    }
    b.addEventListener('click', function () { haptic(); fn(); });
    return b;
  }
  function mkInfo(text) {
    var d = document.createElement('div');
    d.className = 'plrow static'; d.style.cssText = 'position:relative;display:flex;align-items:center;height:44px;padding:0 10px';
    d.textContent = text;
    return d;
  }

  function renderOverlay() {
    var m = S.ovMode;
    if (!m) return;
    var rows = $('ovRows'), title = $('ovTitle'), q = $('ovQ');
    var frag = document.createDocumentFragment();

    var tabs = $('ovTabs');
    tabs.hidden = m !== 'stations';
    if (m === 'stations') {
      setCls($('tabAll'), 'lamp' + (S.ovTab === 'all' ? ' on' : ''));
      setCls($('tabFav'), 'lamp' + (S.ovTab === 'fav' ? ' on' : ''));
      setText($('tabAll'), 'ВСЕ · ' + S.list.length);
      setText($('tabFav'), '♥ ИЗБРАННОЕ · ' + S.favs.length);
    }
    if (m === 'stations' && S.ovTab === 'fav') {
      title.textContent = 'ИЗБРАННЫЕ СТАНЦИИ';
      if (!S.favs.length) frag.appendChild(mkInfo('НАЖМИТЕ ♡ У СТАНЦИИ'));
      S.favs.forEach(function (s, i) {
        frag.appendChild(mkRow(p2(i + 1) + '.', s.n, s.b ? s.b + 'K' : '', !!(S.cur && S.cur.id === s.id), function () {
          closeOverlay(); selectStation(s, true, 'fav');
        }, s));
      });
    } else if (m === 'stations') {
      title.textContent = 'ВСЕ СТАНЦИИ' + (S.query ? ' · «' + S.query.toUpperCase() + '»' : '');
      if (S.loading) frag.appendChild(mkInfo('ЗАГРУЗКА…'));
      else if (S.err) frag.appendChild(mkInfo('НЕТ СВЯЗИ С КАТАЛОГОМ'));
      else if (!S.list.length) frag.appendChild(mkInfo('НЕТ СОВПАДЕНИЙ'));
      else S.list.forEach(function (s, i) {
        frag.appendChild(mkRow(p2(i + 1) + '.', s.n, s.b ? s.b + 'K' : '', !!(S.cur && S.cur.id === s.id), function () {
          closeOverlay(); selectStation(s, true, 'all');
        }, s));
      });
    } else if (m === 'city') {
      var qs = q.value.trim();
      if (qs.length < 2) {
        title.textContent = 'ГОРОДА · ВВЕДИТЕ НАЗВАНИЕ ДЛЯ ПОИСКА';
        S.cities.forEach(function (c, i) {
          frag.appendChild(mkRow(p2(i + 1) + '.', c.n, '', i === S.ci, function () {
            closeOverlay(); S.ci = i; store.set('ci', i); loadWeather();
          }));
        });
      } else {
        title.textContent = 'ПОИСК ГОРОДА';
        if (S.geoBusy) frag.appendChild(mkInfo('ПОИСК…'));
        else if (!S.geo.length) frag.appendChild(mkInfo('НИЧЕГО НЕ НАЙДЕНО'));
        S.geo.forEach(function (g) {
          frag.appendChild(mkRow('+', g.name, g.sub, false, function () {
            var found = -1;
            for (var k = 0; k < S.cities.length; k++) if (Math.abs(S.cities[k].la - g.la) < 0.01 && Math.abs(S.cities[k].lo - g.lo) < 0.01) found = k;
            if (found < 0) { S.cities.push({ n: g.name, la: g.la, lo: g.lo }); found = S.cities.length - 1; store.set('cities', S.cities); }
            closeOverlay(); S.ci = found; store.set('ci', found); loadWeather();
          }));
        });
      }
    }
    rows.innerHTML = '';
    rows.appendChild(frag);
  }

  function openOverlay(mode) {
    var wasOpen = !!S.ovMode;
    if (!wasOpen || mode !== 'stations') S.ovTab = 'all';
    S.ovMode = mode;
    $('ov').hidden = false; $('ovBack').hidden = false;
    var q = $('ovQ');
    q.value = '';
    q.hidden = mode === 'stations';
    q.placeholder = 'НАЙТИ ГОРОД';
    $('btnList').setAttribute('aria-expanded', 'true');
    renderOverlay();
    if (!wasOpen) bridgeBack(true);
    $('ovRows').scrollTop = 0;
  }
  function closeOverlay() {
    if (!S.ovMode) return;
    S.ovMode = null;
    $('ov').hidden = true; $('ovBack').hidden = true;
    $('btnList').setAttribute('aria-expanded', 'false');
    bridgeBack(false);
  }

  /* ---------- события ---------- */
  function on(id, fn) { $(id).addEventListener('click', function () { haptic(); fn(); }); }
  on('btnPlay', doPlay);
  on('btnPause', doPause);
  on('btnStop', doStop);
  on('btnPrev', function () { stepStation(-1); });
  on('btnNext', function () { stepStation(1); });
  on('btnCityPrev', function () { stepCity(-1); });
  on('btnCityNext', function () { stepCity(1); });
  on('cityBtn', function () { openOverlay('city'); });
  on('btnList', function () { if (S.ovMode === 'stations') closeOverlay(); else openOverlay('stations'); });
  on('btnFav', function () { toggleFav(S.cur); });
  on('tabAll', function () { S.ovTab = 'all'; renderOverlay(); });
  on('tabFav', function () { S.ovTab = 'fav'; renderOverlay(); });
  on('btnTheme', function () { S.theme = S.theme === 'dark' ? 'light' : 'dark'; store.set('theme', S.theme); render(); });
  $('ovBack').addEventListener('click', closeOverlay);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlay(); });

  $('vol').addEventListener('input', function (e) { setVol(Number(e.target.value)); });

  var qTimer = null;
  $('q').addEventListener('input', function (e) {
    var v = e.target.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      S.query = v;
      if (S.ovMode !== 'stations') openOverlay('stations');
      loadList();
    }, 450);
  });

  var oTimer = null;
  $('ovQ').addEventListener('input', function () {
    if (S.ovMode !== 'city') return;
    clearTimeout(oTimer);
    var v = $('ovQ').value.trim();
    if (v.length < 2) { renderOverlay(); return; }
    S.geoBusy = true; renderOverlay();
    oTimer = setTimeout(function () {
      var url = 'https://geocoding-api.open-meteo.com/v1/search?count=8&language=ru&format=json&name=' + encodeURIComponent(v);
      fetchJSON(url, 8000).then(function (j) {
        S.geo = (j.results || []).map(function (r) {
          return { name: r.name, la: r.latitude, lo: r.longitude, sub: [r.admin1, r.country_code].filter(Boolean).join(', ') };
        });
        S.geoBusy = false; renderOverlay();
      }).catch(function () {
        // Резервный геокодер, если основной сервис недоступен из региона.
        var alt = 'https://photon.komoot.io/api/?limit=8&lang=ru&q=' + encodeURIComponent(v);
        fetchJSON(alt, 8000).then(function (j) {
          S.geo = (j.features || []).map(function (f) {
            var p = f.properties || {}, xy = f.geometry && f.geometry.coordinates || [];
            return { name: p.name || p.city || p.street || v, la: xy[1], lo: xy[0], sub: [p.state, p.country].filter(Boolean).join(', ') };
          }).filter(function (r) { return typeof r.la === 'number' && typeof r.lo === 'number'; });
          S.geoBusy = false; renderOverlay();
        }).catch(function () { S.geo = []; S.geoBusy = false; renderOverlay(); });
      });
    }, 400);
  });

  /* ---------- масштаб под экран ---------- */
  function fit() {
    var vv = window.visualViewport;
    var w = vv ? vv.width : window.innerWidth, h = vv ? vv.height : window.innerHeight;
    var s = Math.min(w / 390, h / 844, 1.6);
    $('stage').style.transform = 'scale(' + s.toFixed(4) + ')';
  }
  window.addEventListener('resize', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  fit();

  /* ---------- анимация кассеты и спектр ---------- */
  var eqEls = [], pkEls = [];
  (function buildBars() {
    var host = $('eqbars');
    for (var i = 0; i < 20; i++) {
      var w = document.createElement('div');
      w.style.cssText = 'position:relative;flex:1;min-width:0';
      var b = document.createElement('div');
      b.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(to top,#12e05a 0%,#8be31a 34%,#ffd21e 56%,#ff8a1c 76%,#ff2d3d 100%);background-size:100% 66px;background-position:bottom';
      var p = document.createElement('div');
      p.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:4px;opacity:0;background:var(--peak)';
      w.appendChild(b); w.appendChild(p); host.appendChild(w);
      eqEls.push(b); pkEls.push(p);
    }
  })();

  var q1 = function (s) { return document.querySelector(s); };
  var el = {
    reelL: q1('[data-reel="L"]'), reelR: q1('[data-reel="R"]'),
    packL: q1('[data-pack="L"]'), packR: q1('[data-pack="R"]'),
    sheenL: q1('[data-sheen="L"]'), sheenR: q1('[data-sheen="R"]'),
    tape: q1('[data-tape]'), tapeSheen: q1('[data-tapesheen]')
  };
  var A = { sp: 0, eqe: 0, phase: 0, aL: 0, aR: 140, dash: 0, tt: 0, last: performance.now(),
    lev: new Array(20).fill(0), pk: new Array(20).fill(0), hold: new Array(20).fill(0) };

  function tangent(cx, cy, r, px, py, left) {
    var vx = px - cx, vy = py - cy, d = Math.sqrt(vx * vx + vy * vy);
    var a = Math.atan2(vy, vx), dl = Math.acos(Math.min(1, r / d));
    var t1 = [cx + r * Math.cos(a + dl), cy + r * Math.sin(a + dl)];
    var t2 = [cx + r * Math.cos(a - dl), cy + r * Math.sin(a - dl)];
    if (left) return t1[0] < t2[0] ? t1 : t2;
    return t1[0] > t2[0] ? t1 : t2;
  }

  // границы 20 полос по FFT-бинам (лог-шкала, ~43 Гц на бин при 44.1 кГц)
  var EDGES = [];
  for (var ei = 0; ei <= 20; ei++) EDGES.push(Math.round(Math.pow(260, ei / 20)));


  /* ---------- анимация погоды (пиксельный «LCD»-стиль) ---------- */
  var FX = { cv: $('wxfx'), g: null, W: 74, H: 56, kind: 'clear', n: 0, wind: 0, hail: false, partly: false,
    key: '', parts: [], streaks: [], t: 0, flash: 0, nextFlash: 3, bolt: null, color: '#5dff98', theme: '', dirty: true, stars: [] };
  FX.g = FX.cv.getContext ? FX.cv.getContext('2d') : null;
  var REDUCE = false;
  try { REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  for (var si = 0; si < 14; si++) FX.stars.push({ x: 3 + Math.floor(Math.random() * 68), y: 3 + Math.floor(Math.random() * 30), ph: Math.random() * 6.28 });

  function wxKind(code) {
    if (code === null || code === undefined) return { kind: 'clear', n: 0 };
    if (code === 0 || code === 1) return { kind: 'clear', n: 0 };
    if (code === 2) return { kind: 'clear', n: 0, partly: true };
    if (code === 3) return { kind: 'cloud', n: 0 };
    if (code === 45 || code === 48) return { kind: 'fog', n: 0 };
    if (code >= 51 && code <= 55) return { kind: 'drizzle', n: 22 };
    if (code === 56 || code === 57 || code === 66 || code === 67) return { kind: 'sleet', n: 34 };
    if (code === 61 || code === 63 || code === 80 || code === 81) return { kind: 'rain', n: 42 };
    if (code === 65 || code === 82) return { kind: 'rain', n: 70 };
    if (code === 71 || code === 73 || code === 77) return { kind: 'snow', n: 32 };
    if (code === 75 || code === 85 || code === 86) return { kind: 'snow', n: 58 };
    if (code === 95) return { kind: 'storm', n: 60 };
    if (code === 96 || code === 99) return { kind: 'storm', n: 60, hail: true };
    return { kind: 'cloud', n: 0 };
  }
  function wxSetup() {
    if (!FX.g) return;
    var w = S.weather;
    var ok = w && w.t !== null && w.t !== undefined && isFinite(Number(w.t));
    var k = wxKind(ok ? w.code : null);
    var wind = ok && w.wind !== null && w.wind !== undefined && isFinite(Number(w.wind)) ? Number(w.wind) : 0;
    var wb = wind >= 40 ? 3 : wind >= 25 ? 2 : wind >= 12 ? 1 : 0;
    var key = [k.kind, k.n, !!k.hail, !!k.partly, wb, S.theme].join('|');
    if (key === FX.key) return;
    FX.key = key;
    FX.kind = k.kind; FX.n = k.n; FX.hail = !!k.hail; FX.partly = !!k.partly; FX.wind = wind;
    FX.wb = wb;
    var cs = getComputedStyle($('app'));
    FX.color = (cs.getPropertyValue('--lcd-on') || '#5dff98').trim();
    FX.theme = S.theme;
    var W = FX.W, H = FX.H, P = [], i;
    var drift = wb * 5;                                    // боковой снос частиц, px/с
    for (i = 0; i < k.n; i++) {
      var p = { x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.28, f: 1 + Math.random() * 2, big: Math.random() < .25 };
      if (k.kind === 'snow') { p.vy = 5 + Math.random() * 9; p.vx = drift; }
      else if (k.kind === 'drizzle') { p.vy = 26 + Math.random() * 10; p.vx = drift * .5; }
      else if (k.kind === 'sleet') { p.vy = 18 + Math.random() * 30; p.vx = drift; p.snow = i % 2 === 0; if (p.snow) p.vy *= .35; }
      else { p.vy = 60 + Math.random() * 35; p.vx = drift * 1.5; }
      P.push(p);
    }
    if (k.hail) for (i = 0; i < 10; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vy: 70 + Math.random() * 30, vx: drift, hail: true, ph: 0, f: 1 });
    FX.parts = P;
    var sc = [], ns = wb ? 4 + wb * 3 : 0;
    for (i = 0; i < ns; i++) sc.push({ x: Math.random() * W, y: 4 + Math.random() * (H - 8), len: 6 + Math.random() * 10, v: 35 + wind * 1.4 + Math.random() * 30 });
    FX.streaks = sc;
    FX.clouds = [];
    var nc = k.kind === 'cloud' ? 4 : (k.kind === 'clear' ? (k.partly ? 1 : 0) : (k.kind === 'fog' ? 0 : 2));
    for (i = 0; i < nc; i++) FX.clouds.push({ x: (i + Math.random()) * (W / nc) - 6, y: k.kind === 'cloud' ? 3 + i * 9 : (k.kind === 'clear' ? 20 : 1 + i * 3), s: k.kind === 'cloud' ? 2 : 2, v: 2 + Math.random() * 2 + wind * .15 });
    FX.dirty = true;
  }

  function wxCloud(g, x, y, s) {
    g.fillRect(x + 2 * s, y, 4 * s, s);
    g.fillRect(x + s, y + s, 7 * s, s);
    g.fillRect(x, y + 2 * s, 9 * s, s);
  }
  function wxDisc(g, cx, cy, r, notX, notY, notR) {
    for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy > r * r + 1) continue;
      if (notR && (xx - notX) * (xx - notX) + (yy - notY) * (yy - notY) <= notR * notR) continue;
      g.fillRect(cx + xx, cy + yy, 1, 1);
    }
  }
  function wxFrame(dt) {
    var g = FX.g;
    if (!g) return;
    if (REDUCE && !FX.dirty) return;
    if (REDUCE) dt = 0;
    FX.dirty = false;
    var W = FX.W, H = FX.H, t = (FX.t += dt), i, p;
    g.clearRect(0, 0, W, H);
    g.fillStyle = FX.color;
    var k = FX.kind;

    // небо: солнце (день) или луна со звёздами (ночь)
    if (k === 'clear') {
      if (S.theme === 'light') {
        g.globalAlpha = .6; wxDisc(g, 58, 15, 6);
        g.globalAlpha = .45;
        for (i = 0; i < 8; i++) {
          var a = t * .5 + i * Math.PI / 4;
          g.fillRect(Math.round(58 + Math.cos(a) * 11), Math.round(15 + Math.sin(a) * 11), 1, 1);
          g.fillRect(Math.round(58 + Math.cos(a) * 13), Math.round(15 + Math.sin(a) * 13), 1, 1);
        }
      } else {
        g.globalAlpha = .6; wxDisc(g, 58, 15, 7, -3, -2, 6);
        for (i = 0; i < FX.stars.length; i++) {
          var st = FX.stars[i];
          g.globalAlpha = .25 + .5 * Math.max(0, Math.sin(t * 1.3 + st.ph));
          g.fillRect(st.x, st.y, 1, 1);
        }
      }
    }
    // туман: медленные полосы
    if (k === 'fog') {
      for (i = 0; i < 6; i++) {
        var fy = 6 + i * 9, off = (t * (i % 2 ? 5 : -4) + i * 17) % 24;
        g.globalAlpha = .14 + .1 * Math.sin(t * .6 + i);
        g.fillRect(0, fy, W, 2);
        g.globalAlpha = .38;
        for (var fx = -24; fx < W + 24; fx += 24) g.fillRect(Math.round(fx + off), fy, 13, 1);
      }
    }
    // облака
    var cl = FX.clouds || [];
    for (i = 0; i < cl.length; i++) {
      var c = cl[i];
      c.x += c.v * dt;
      if (c.x > W + 4) c.x = -22;
      g.globalAlpha = (k === 'storm' || k === 'rain' || k === 'sleet' || k === 'drizzle') ? .5 : .38;
      wxCloud(g, Math.round(c.x), c.y, c.s);
    }
    // осадки
    var wxs = (FX.wb || 0);
    for (i = 0; i < FX.parts.length; i++) {
      p = FX.parts[i];
      p.y += p.vy * dt;
      p.x += (p.vx + (k === 'snow' || p.snow ? Math.sin(t * p.f + p.ph) * 5 : 0)) * dt;
      if (p.y > H) { p.y = -3; p.x = Math.random() * W; }
      if (p.x > W) p.x -= W; else if (p.x < 0) p.x += W;
      var px = Math.round(p.x), py = Math.round(p.y);
      if (p.hail) { g.globalAlpha = .95; g.fillRect(px, py, 2, 2); }
      else if (k === 'snow' || p.snow) { g.globalAlpha = p.big ? .95 : .7; if (p.big) { g.fillRect(px, py, 2, 2); } else g.fillRect(px, py, 1, 1); }
      else if (k === 'drizzle') { g.globalAlpha = .55; g.fillRect(px, py, 1, 1); }
      else { g.globalAlpha = .75; g.fillRect(px, py, 1, 2); if (wxs) g.fillRect(px - 1, py - 1, 1, 1); if (wxs > 1) g.fillRect(px - 2, py - 2, 1, 1); }
    }
    // ветер: волнистые штрихи
    for (i = 0; i < FX.streaks.length; i++) {
      var s = FX.streaks[i];
      s.x += s.v * dt;
      if (s.x - s.len > W) { s.x = -4; s.y = 4 + Math.random() * (H - 8); }
      g.globalAlpha = .4;
      for (var j = 0; j < s.len; j++) {
        var xx = Math.round(s.x - j);
        if (xx < 0 || xx >= W) continue;
        g.fillRect(xx, Math.round(s.y + Math.sin((xx) * .35 + t * 3) * 1.2), 1, 1);
      }
    }
    // гроза: вспышки и молния
    if (k === 'storm') {
      FX.nextFlash -= dt;
      if (FX.nextFlash <= 0) {
        FX.flash = 1; FX.nextFlash = 2.5 + Math.random() * 4;
        var bx = 18 + Math.random() * 38, by = 8, pts = [[bx, by]];
        while (by < 44) { bx += Math.round((Math.random() - .5) * 8); by += 4 + Math.floor(Math.random() * 4); pts.push([bx, by]); }
        FX.bolt = pts;
      }
      if (FX.flash > 0) {
        g.globalAlpha = FX.flash * .28; g.fillRect(0, 0, W, H);
        g.globalAlpha = Math.min(1, FX.flash * 1.6);
        var b = FX.bolt || [];
        for (i = 1; i < b.length; i++) {
          var x0 = b[i - 1][0], y0 = b[i - 1][1], x1 = b[i][0], y1 = b[i][1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (var q = 0; q <= n; q++) g.fillRect(Math.round(x0 + (x1 - x0) * q / n), Math.round(y0 + (y1 - y0) * q / n), 1, 1);
        }
        FX.flash = Math.max(0, FX.flash - dt * 2.4);
      }
    }
    g.globalAlpha = 1;
  }

  /* ---------- СКАН ЭФИРА: фишка вместо времени воспроизведения ---------- */
  // Нажатие запускает «прокрутку» шкалы: стрелка прыгает по частотам случайных станций каталога,
  // замедляется и «ловит» одну из них — станция сразу включается. Частота станции условная (87.5–108.0),
  // но для каждой станции всегда одна и та же.
  var SC = { cv: $('scCv'), g: null, pos: .5, target: .5, busy: false, timer: null, msgTimer: null, drawn: -1, key: '' };
  SC.g = SC.cv.getContext ? SC.cv.getContext('2d') : null;
  function freqOf(st) {
    var id = String((st && (st.id || st.n)) || ''), h = 7;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return 875 + (h % 206);                                   // десятые доли МГц
  }
  function fmtFreq(f) { return 'FM ' + (f / 10).toFixed(1); }
  function posOf(f) { return (f - 875) / 205; }
  function scDraw(force) {
    var g = SC.g;
    if (!g) return;
    var key = SC.pos.toFixed(3) + '|' + S.theme + '|' + S.list.length + '|' + (S.cur ? S.cur.id : '');
    if (!force && key === SC.key) return;
    SC.key = key;
    var cs = SC.cs || (SC.cs = {});
    var app = getComputedStyle($('app'));
    var on = (app.getPropertyValue('--lcd-on') || '#5dff98').trim(), dim = (app.getPropertyValue('--lcd-dim') || '#3b8f5c').trim();
    var W = 128, H = 16;
    g.clearRect(0, 0, W, H);
    g.fillStyle = dim;
    for (var x = 0; x < W; x += 4) g.fillRect(x, H - (x % 20 === 0 ? 7 : 4), 1, x % 20 === 0 ? 7 : 4);
    // точки — станции каталога
    g.fillStyle = on; g.globalAlpha = .55;
    var arr = S.list;
    for (var i = 0; i < arr.length; i++) g.fillRect(Math.round(posOf(freqOf(arr[i])) * (W - 3)) + 1, 2, 1, 2);
    g.globalAlpha = 1;
    // текущая станция — рамка-метка, стрелка — красная «игла»
    if (S.cur) g.fillRect(Math.round(posOf(freqOf(S.cur)) * (W - 3)), 0, 3, 1);
    var nx = Math.round(SC.pos * (W - 3));
    g.fillStyle = S.theme === 'dark' ? '#ff5a4d' : '#b3261e';
    g.fillRect(nx + 1, 0, 1, H);
    g.fillRect(nx, 0, 3, 1);
  }
  function scIdle() {
    if (!SC.g) return;
    if (!SC.busy) {
      var f = S.cur ? freqOf(S.cur) : null;
      SC.target = f === null ? .5 : posOf(f);
      setText($('scFreq'), f === null ? 'FM --.-' : fmtFreq(f));
      if (!SC.msgTimer) setText($('scName'), S.list.length > 1 ? 'ЛОВИ ВОЛНУ ▶' : '—');
    }
    scDraw(false);
  }
  function scMsg(text, ms) {
    setText($('scName'), text);
    clearTimeout(SC.msgTimer);
    SC.msgTimer = setTimeout(function () { SC.msgTimer = null; scIdle(); }, ms);
  }
  function scanStop() {
    clearTimeout(SC.timer); SC.timer = null; SC.busy = false;
    $('btnScan').classList.remove('busy');
  }
  function scanStart() {
    if (SC.busy) { scanStop(); clearTimeout(SC.msgTimer); SC.msgTimer = null; scMsg('СКАН ОТМЕНЁН', 1200); return; }
    var arr = S.list;
    if (arr.length < 2) { scMsg('НЕТ СТАНЦИЙ', 1500); return; }
    clearTimeout(SC.msgTimer); SC.msgTimer = null;
    var hops = [], pool = arr.filter(function (st) { return !S.cur || st.id !== S.cur.id; });
    for (var i = 0; i < 9; i++) hops.push(pool[Math.floor(Math.random() * pool.length)]);
    var final = hops[hops.length - 1];
    SC.busy = true; $('btnScan').classList.add('busy');
    var n = 0;
    (function step() {
      var st = hops[n], f = freqOf(st);
      SC.target = posOf(f);
      setText($('scFreq'), fmtFreq(f));
      setText($('scName'), clip(st.n.toUpperCase(), 18));
      if (n < hops.length - 1) haptic();
      n++;
      if (n < hops.length) { SC.timer = setTimeout(step, 80 + n * n * 5); return; }
      // зафиксировали — короткая пауза и включаем
      SC.timer = setTimeout(function () {
        scanStop();
        selectStation(final, true, 'all');
        scMsg('★ НАСТРОЕНО!', 1800);
      }, 500);
    })();
  }
  if ($('btnScan')) $('btnScan').addEventListener('click', function () { haptic(); scanStart(); });

  function frame(now) {
    requestAnimationFrame(frame);
    var st = S.status, playing = st === 'play';
    var dt = Math.min(0.05, Math.max(0, (now - A.last) / 1000));
    A.last = now;

    var tau = playing ? 0.8 : (st === 'stop' ? 0.5 : 0.9);
    A.sp += ((playing ? 1 : 0) - A.sp) * (1 - Math.exp(-dt / tau));
    if (!playing && A.sp < 0.003) A.sp = 0;

    A.phase += dt * A.sp * 0.021;
    var p = 0.5 + 0.4 * Math.sin(A.phase);
    var H = 14, SS = 1600 - H * H;
    var rL = Math.sqrt(H * H + SS * (1 - p)), rR = Math.sqrt(H * H + SS * p);
    var v = 98 * A.sp, K = 57.2958;
    A.aL = (A.aL - (v / rL) * dt * K) % 360;
    A.aR = (A.aR - (v / rR) * dt * K) % 360;
    A.dash = (A.dash + v * dt) % 14;

    el.reelL.setAttribute('transform', 'rotate(' + A.aL.toFixed(1) + ')');
    el.reelR.setAttribute('transform', 'rotate(' + A.aR.toFixed(1) + ')');
    el.packL.setAttribute('r', rL.toFixed(2));
    el.packR.setAttribute('r', rR.toFixed(2));
    el.sheenL.setAttribute('transform', 'rotate(' + A.aL.toFixed(1) + ') scale(' + (rL / 40).toFixed(3) + ')');
    el.sheenR.setAttribute('transform', 'rotate(' + A.aR.toFixed(1) + ') scale(' + (rR / 40).toFixed(3) + ')');
    var a1 = tangent(128, 118, rL, 92, 160, true), b1 = tangent(232, 118, rR, 268, 160, false);
    var dd = 'M' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1) + ' L92 160 L268 160 L' + b1[0].toFixed(1) + ' ' + b1[1].toFixed(1);
    el.tape.setAttribute('d', dd);
    el.tapeSheen.setAttribute('d', dd);
    el.tapeSheen.setAttribute('stroke-dashoffset', (-A.dash).toFixed(2));

    wxFrame(dt);
    var dpos = SC.target - SC.pos;
    if (Math.abs(dpos) > .0004) { SC.pos += dpos * (1 - Math.exp(-dt / (SC.busy ? .06 : .18))); scDraw(false); }

    // спектр: реальный (AnalyserNode) или имитация, если сервер потока не отдаёт CORS
    var live = S.playing && S.eqLive && analyser && fftBuf;
    var sim = S.playing && !S.eqLive;
    A.eqe += ((sim ? 1 : 0) - A.eqe) * (1 - Math.exp(-dt / (sim ? 0.3 : 0.15)));
    A.tt += dt;
    var t = A.tt;
    var ph = (t * 2.05) % 1, kick = Math.exp(-ph * 4.5);
    var ph2 = (t * 2.05 + 0.5) % 1, snare = Math.exp(-ph2 * 7);
    if (live) analyser.getByteFrequencyData(fftBuf);

    for (var i = 0; i < 20; i++) {
      var target = 0;
      if (live) {
        var lo = EDGES[i], hi = Math.max(lo + 1, EDGES[i + 1]), sum = 0, n = 0;
        for (var k = lo; k < hi && k < fftBuf.length; k++) { sum += fftBuf[k]; n++; }
        var avg = n ? sum / n / 255 : 0;
        target = Math.pow(avg, 1.25) * (1 + 0.8 * i / 19);
      } else if (A.eqe > 0.003) {
        var f = i / 19, tilt = 1 - 0.5 * f;
        var n1 = 0.5 + 0.5 * Math.sin(t * (1.9 + i * 0.41) + i * 1.7);
        var n2 = 0.5 + 0.5 * Math.sin(t * (3.3 + i * 0.23) + i * 2.9);
        target = tilt * (0.18 + 0.42 * n1 * n2);
        if (i < 6) target += 0.5 * kick * (1 - i / 8);
        else if (i > 7 && i < 15) target += 0.3 * snare * n1;
        else if (i >= 15) target += 0.12 * n2;
        target *= A.eqe;
      }
      target = Math.max(0, Math.min(1, target));
      var L = A.lev[i];
      var kk = target > L ? 1 - Math.exp(-dt / 0.04) : 1 - Math.exp(-dt / 0.2);
      A.lev[i] = L + (target - L) * kk;
      eqEls[i].style.height = (Math.round(A.lev[i] * 11) * 6) + 'px';
      if (A.lev[i] > A.pk[i]) { A.pk[i] = A.lev[i]; A.hold[i] = 0.4; }
      else if (A.hold[i] > 0) A.hold[i] -= dt;
      else A.pk[i] = Math.max(0, A.pk[i] - dt * 0.5);
      var ps = Math.round(A.pk[i] * 11);
      pkEls[i].style.bottom = (Math.max(0, ps - 1) * 6) + 'px';
      pkEls[i].style.opacity = ps > 0 ? '1' : '0';
    }
  }
  requestAnimationFrame(frame);

  /* ---------- таймеры ---------- */
  setInterval(tickClock, 1000);
  setInterval(function () { if (S.weather && S.weather.t !== null) loadWeather(); }, 600000);

  /* ---------- мост с Android-плеером ---------- */
  window.__radio = {
    onState: function (st) {
      if (S.status !== 'play') return;
      if (st === 'playing') { markPlaying(true); S.msg = null; }
      else if (st === 'buffering') { markPlaying(false); S.msg = 'БУФЕРИЗАЦИЯ…'; }
      else if (st === 'error') { fail('ПОТОК НЕДОСТУПЕН — ЖМИТЕ ▶▶'); return; }
      render();
    },
    onItem: function (id) {                       // станцию переключили из шторки / с магнитолы
      if (S.cur && S.cur.id === id) return;
      var arr = stepArr(), f = null;
      for (var k = 0; k < arr.length; k++) if (arr[k].id === id) f = arr[k];
      if (!f) return;
      S.cur = f; markPlaying(false); resetElapsed(); S.status = 'play'; S.msg = null;
      store.set('sid', f.id);
      render();
    },
    onCmd: function (c) {
      if (c === 'pause' && S.status === 'play') doPause();
      else if (c === 'play' && S.status !== 'play') doPlay();
      else if (c === 'stop' && S.status !== 'stop') doStop();
    }
  };
  nat(function (R) { R.reset(); R.setVolume(S.vol / 100); });

  /* ---------- старт ---------- */
  render();
  loadWeather();
  loadList().then(function () {
    var sid = store.get('sid', null), found = null;
    if (sid) for (var i = 0; i < S.base.length; i++) if (S.base[i].id === sid) found = S.base[i];
    // Сохранённый жанр, в котором (пока) нет станций, сбрасываем на «ВСЕ»
    S.cur = found || S.list[0] || null;
    if (S.cur) store.set('sid', S.cur.id);
    S.favCtx = !!(S.cur && favIndex(S.cur) >= 0);
    render();
  });
})();
