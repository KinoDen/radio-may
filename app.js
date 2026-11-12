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

  function guessCountry() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/^Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Kirov|Saratov|Astrakhan|Ulyanovsk)|^Asia\/(Yekaterinburg|Omsk|Novosibirsk|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok|Magadan|Kamchatka|Chita|Barnaul|Tomsk|Novokuznetsk|Sakhalin|Srednekolymsk|Anadyr)/.test(tz)) return 'RU';
    var m = (navigator.language || '').match(/-([A-Za-z]{2})$/);
    return m ? m[1].toUpperCase() : 'RU';
  }

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
    cc: store.get('cc', guessCountry()),
    list: [], cur: null, query: '', elapsed: 0,
    loading: true, err: false,
    countries: null,
    cities: store.get('cities', null) || DEFAULT_CITIES.slice(),
    ci: store.get('ci', 0),
    weather: null, geo: [], geoBusy: false,
    eqLive: false, ovMode: null
  };
  if (S.ci >= S.cities.length || S.ci < 0) S.ci = 0;
  if (S.theme !== 'dark' && S.theme !== 'light') S.theme = 'dark';

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


  function featuredForQuery(query) {
    if (S.cc !== 'RU') return [];
    var q = (query || '').trim().toLowerCase();
    return FEATURED_STATIONS.filter(function (st) {
      return !q || st.n.toLowerCase().indexOf(q) >= 0;
    });
  }

  function mergeFeatured(dynamicStations, query) {
    var featured = featuredForQuery(query);
    var seen = {};
    featured.concat(dynamicStations || []).forEach(function (st) { seen[st.u] = true; });
    var merged = [], names = {};
    featured.concat(dynamicStations || []).forEach(function (st) {
      var key = (st.n || '').toLowerCase();
      if (!st.u || names[key]) return;
      names[key] = true;
      merged.push(st);
    });
    return merged.slice(0, 120);
  }

  var loadSeq = 0;
  function loadList() {
    var seq = ++loadSeq;
    S.loading = true; S.err = false;
    // Показываем последний успешно загруженный каталог, пока сеть отвечает.
    var cached = store.get('stations_' + S.cc, []);
    if (!S.list.length && cached && cached.length) S.list = cached;
    S.list = mergeFeatured(S.list, S.query);
    render();
    var q = S.query.trim();
    var path = '/json/stations/search?countrycode=' + encodeURIComponent(S.cc) +
      '&hidebroken=true&order=clickcount&reverse=true&limit=120&is_https=true' +
      (q ? '&name=' + encodeURIComponent(q) : '');
    return radioApi(path).then(function (arr) {
      if (seq !== loadSeq) return;
      var seen = {}, out = [];
      arr.forEach(function (s) {
        var u = s.url_resolved || '';
        if (!/^https:\/\//i.test(u) || s.hls) return;
        var nm = (s.name || '').replace(/\s+/g, ' ').trim();
        if (!nm) return;
        var k = nm.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ id: s.stationuuid, n: nm, u: u, b: s.bitrate || 0, c: (s.codec || '').toUpperCase() });
      });
      S.list = mergeFeatured(out, q);
      store.set('stations_' + S.cc, S.list);
      S.loading = false;
      render();
      if (S.ovMode) renderOverlay();
    }, function () {
      if (seq !== loadSeq) return;
      S.loading = false; S.err = true;
      // Не стираем ранее сохранённые станции при временной недоступности API.
      S.list = mergeFeatured((S.list && S.list.length ? S.list : (cached || [])), S.query);
      render();
      if (S.ovMode) renderOverlay();
    });
  }

  function withCountries(cb) {
    if (S.countries) { cb(); return; }
    radioApi('/json/countries').then(function (arr) {
      S.countries = arr.filter(function (c) { return c.iso_3166_1 && c.stationcount > 0; }).map(function (c) {
        return { cc: c.iso_3166_1, name: countryName(c.iso_3166_1), count: c.stationcount };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
      cb();
    }, function () { S.countries = []; cb(); });
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

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && wakeLockWanted && S.status === 'play') {
      requestScreenWakeLock();
    }
  });

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

  function stopStream() {
    releaseScreenWakeLock();
    S.gen++;
    S.playing = false;
    S.eqLive = false;
    dropAudio();
  }

  function startStream() {
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

    a.addEventListener('playing', function () {
      if (gen !== S.gen || a !== audio) return;
      S.playing = true; S.msg = null; render();
    });
    a.addEventListener('waiting', function () {
      if (gen !== S.gen || a !== audio) return;
      S.playing = false; S.msg = 'БУФЕРИЗАЦИЯ…'; render();
    });
    a.addEventListener('error', function () {
      if (gen !== S.gen || a !== audio) return;
      if (cors) { attempt(st, false, gen); return; }
      fail('ПОТОК НЕДОСТУПЕН — ЖМИТЕ ▶▶');
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
    stopStream();
    S.status = 'stop'; S.elapsed = 0; S.msg = text;
    render();
  }

  function setVol(v) {
    S.vol = v; store.set('vol', v);
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
    stopStream(); S.status = 'stop'; S.elapsed = 0; S.msg = null; render();
  }
  function selectStation(st, autoplay) {
    S.cur = st; S.elapsed = 0; S.msg = null;
    if (st) store.set('sid', st.id);
    if (autoplay) { S.status = 'play'; startStream(); }
    else if (S.status === 'play') startStream();
    render();
  }
  function stepStation(d) {
    if (!S.list.length) return;
    var i = -1;
    if (S.cur) for (var k = 0; k < S.list.length; k++) if (S.list[k].id === S.cur.id) { i = k; break; }
    i = i < 0 ? 0 : (i + d + S.list.length) % S.list.length;
    selectStation(S.list[i], false);
  }

  function setCountry(cc) {
    if (cc === S.cc && S.list.length) return;
    S.cc = cc; store.set('cc', cc); store.set('sid', null);
    S.query = ''; $('q').value = ''; S.cur = null;
    loadList().then(function () {
      S.cur = S.list[0] || null;
      if (S.cur) store.set('sid', S.cur.id);
      if (S.status === 'play' && S.cur) startStream(); else if (!S.cur) { stopStream(); S.status = 'stop'; }
      render();
    });
  }
  function stepCountry(d) {
    withCountries(function () {
      var arr = S.countries || [];
      if (!arr.length) return;
      var i = -1;
      for (var k = 0; k < arr.length; k++) if (arr[k].cc === S.cc) { i = k; break; }
      i = i < 0 ? 0 : (i + d + arr.length) % arr.length;
      setCountry(arr[i].cc);
    });
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !S.cur) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: S.cur.n, artist: 'Радио Май · ' + countryName(S.cc) });
      navigator.mediaSession.setActionHandler('play', doPlay);
      navigator.mediaSession.setActionHandler('pause', doPause);
      navigator.mediaSession.setActionHandler('stop', doStop);
      navigator.mediaSession.setActionHandler('previoustrack', function () { stepStation(-1); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { stepStation(1); });
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
  function clockParts() {
    var w = S.weather;
    if (w && w.off !== null) {
      var d = new Date(Date.now() + w.off * 1000);
      return { h: p2(d.getUTCHours()), m: p2(d.getUTCMinutes()), s: p2(d.getUTCSeconds()), city: true };
    }
    var l = new Date();
    return { h: p2(l.getHours()), m: p2(l.getMinutes()), s: p2(l.getSeconds()), city: false };
  }

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
  function setCls(el, c) { if (el.className !== c) el.className = c; }
  function clip(t, n) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  function render() {
    var st = S.status;
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

    var e = S.elapsed;
    setText($('elapsed'), p2(Math.floor(e / 60) % 100) + ':' + p2(e % 60));

    var cur = S.cur;
    setText($('infoBitrate'), cur && cur.b ? cur.b + ' KBPS' : '— KBPS');
    setText($('infoCodec'), cur ? ((cur.c || 'STREAM') + (S.playing ? (S.eqLive ? ' · FFT' : ' · SIM') : '')) : '—');
    setText($('infoCountry'), S.cc + ' · ' + countryName(S.cc).toUpperCase());

    var name = cur ? cur.n : (S.loading ? 'ЗАГРУЗКА…' : (S.err ? 'НЕТ СВЯЗИ' : 'НЕТ СТАНЦИЙ'));
    var mq;
    if (S.msg) mq = S.msg;
    else if (S.loading && !cur) mq = 'ЗАГРУЗКА СТАНЦИЙ…';
    else if (S.err && !cur) mq = 'НЕТ СВЯЗИ С КАТАЛОГОМ РАДИОСТАНЦИЙ';
    else if (!cur) mq = 'СТАНЦИИ НЕ НАЙДЕНЫ';
    else if (st === 'stop') mq = 'НАЖМИТЕ PLAY · ' + name;
    else mq = S.cc + ' · ' + countryName(S.cc) + ' — ' + name + (cur.b ? ' · ' + cur.b + ' KBPS' : '');
    mq = mq.toUpperCase();
    setText($('mq1'), mq); setText($('mq2'), mq);
    setText($('stationLabel'), clip(name, 34));
    $('cassette').setAttribute('aria-label', 'Аудиокассета Радио Май: ' + name);

    setText($('ctryCode'), 'СТРАНА · ' + S.cc);
    setText($('ctryName'), countryName(S.cc).toUpperCase());
    setText($('listTab'), 'СПИСОК СТАНЦИЙ · ' + S.list.length);

    var c = city(), w = S.weather;
    var tempValue = w && w.t !== null && w.t !== undefined && isFinite(Number(w.t)) ? Number(w.t) : null;
    var conditionText = !w || tempValue === null ? (!w ? 'ЗАГРУЗКА…' : 'НЕТ ДАННЫХ') : (WMO[w.code] || 'ПОГОДА');
    var windText = w && w.wind !== null && w.wind !== undefined && isFinite(Number(w.wind))
      ? 'ВЕТЕР ' + Math.round(Number(w.wind)) + ' КМ/Ч' : '';
    // Верхняя строка: город и температура. Нижняя строка: состояние и ветер.
    // Обе строки прокручиваются независимо, поэтому состояние погоды больше не стоит на месте.
    setWeatherMarquee($('cityVal'), c.n.toUpperCase() + '   •   ' + (tempValue === null ? '— °C' : fmtTemp(tempValue)));
    var conditionParts = [conditionText, windText].filter(function (part) { return !!part; });
    setWeatherMarquee($('cond'), conditionParts.join('   •   '));

    setText($('volNum'), String(S.vol));
    $('vfill').style.width = S.vol + '%';
    if ($('vol').value !== String(S.vol)) $('vol').value = S.vol;
    tickClock();
  }

  function tickClock() {
    var k = clockParts();
    setText($('hh'), k.h); setText($('mm'), k.m); setText($('ss'), k.s);
    setText($('clkLabel'), k.city ? 'ВРЕМЯ · ' + clip(city().n.toUpperCase(), 11) : 'ВРЕМЯ');
  }

  /* ---------- оверлей (станции / страны / города) ---------- */
  function mkRow(idx, name, right, active, fn) {
    var b = document.createElement('button');
    b.className = 'plrow' + (active ? ' on' : '');
    b.type = 'button';
    var i = document.createElement('span'); i.className = 'idx'; i.textContent = idx;
    var n = document.createElement('span'); n.style.cssText = 'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; n.textContent = name;
    var r = document.createElement('span'); r.className = 'right'; r.textContent = right || '';
    b.appendChild(i); b.appendChild(n); b.appendChild(r);
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

    if (m === 'stations') {
      title.textContent = 'СТРАНА: ' + countryName(S.cc).toUpperCase() + (S.query ? ' · «' + S.query.toUpperCase() + '»' : '');
      if (S.loading) frag.appendChild(mkInfo('ЗАГРУЗКА…'));
      else if (S.err) frag.appendChild(mkInfo('НЕТ СВЯЗИ С КАТАЛОГОМ'));
      else if (!S.list.length) frag.appendChild(mkInfo('НЕТ СОВПАДЕНИЙ'));
      else S.list.forEach(function (s, i) {
        frag.appendChild(mkRow(p2(i + 1) + '.', s.n, s.b ? s.b + 'K' : '', !!(S.cur && S.cur.id === s.id), function () {
          closeOverlay(); selectStation(s, true);
        }));
      });
    } else if (m === 'country') {
      title.textContent = 'ВЫБОР СТРАНЫ';
      var f = q.value.trim().toLowerCase();
      if (!S.countries) frag.appendChild(mkInfo('ЗАГРУЗКА…'));
      else {
        var arr = S.countries.filter(function (c) { return !f || c.name.toLowerCase().indexOf(f) >= 0 || c.cc.toLowerCase() === f; });
        if (!arr.length) frag.appendChild(mkInfo('НЕТ СОВПАДЕНИЙ'));
        arr.forEach(function (c) {
          frag.appendChild(mkRow(c.cc, c.name, String(c.count), c.cc === S.cc, function () { closeOverlay(); setCountry(c.cc); }));
        });
      }
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
    S.ovMode = mode;
    $('ov').hidden = false; $('ovBack').hidden = false;
    var q = $('ovQ');
    q.value = '';
    q.hidden = mode === 'stations';
    q.placeholder = mode === 'country' ? 'ПОИСК СТРАНЫ' : 'НАЙТИ ГОРОД';
    $('btnList').setAttribute('aria-expanded', 'true');
    renderOverlay();
    if (!wasOpen) bridgeBack(true);
    if (mode === 'country') withCountries(renderOverlay);
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
  on('btnCtryPrev', function () { stepCountry(-1); });
  on('btnCtryNext', function () { stepCountry(1); });
  on('btnCityPrev', function () { stepCity(-1); });
  on('btnCityNext', function () { stepCity(1); });
  on('ctryBtn', function () { openOverlay('country'); });
  on('cityBtn', function () { openOverlay('city'); });
  on('btnList', function () { if (S.ovMode === 'stations') closeOverlay(); else openOverlay('stations'); });
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
    if (S.ovMode === 'country') { renderOverlay(); return; }
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
  setInterval(function () {
    if (S.status === 'play' && S.playing) { S.elapsed = (S.elapsed + 1) % 6000; render(); }
    else tickClock();
  }, 1000);
  setInterval(function () { if (S.weather && S.weather.t !== null) loadWeather(); }, 600000);

  /* ---------- старт ---------- */
  render();
  loadWeather();
  loadList().then(function () {
    var sid = store.get('sid', null), found = null;
    if (sid) for (var i = 0; i < S.list.length; i++) if (S.list[i].id === sid) found = S.list[i];
    S.cur = found || S.list[0] || null;
    if (S.cur) store.set('sid', S.cur.id);
    render();
  });
})();
