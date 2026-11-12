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
  // Несколько зеркал Radio Browser: если одно недоступно из WebView MAX,
  // автоматически пробуем следующее.
  var HOSTS = [
    'https://nl1.api.radio-browser.info',
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://fi1.api.radio-browser.info',
    'https://at1.api.radio-browser.info'
  ];
  var hostIdx = 0;

  // Резервный каталог прямых HTTPS-потоков, если Radio Browser недоступен.
  var CURATED = {
    RU: [
      { id:'ru-pifm', n:'ПИ FM', u:'https://cdn.pifm.ru/mp3', b:128, c:'MP3' },
      { id:'ru-marusya', n:'Маруся FM', u:'https://radio-holding.ru:9433/marusya_default', b:128, c:'MP3' },
      { id:'ru-maximum', n:'Радио Максимум', u:'https://hls-01-maximum.hostingradio.ru/maximum/playlist.m3u8', b:128, c:'HLS' },
      { id:'ru-record', n:'Радио Рекорд', u:'https://radio-srv1.11one.ru/rec64k', b:64, c:'AAC' },
      { id:'ru-record-pirate', n:'Рекорд · Пиратская станция', u:'https://radiorecord.hostingradio.ru/ps96.aacp', b:96, c:'AAC' },
      { id:'ru-mayak', n:'Радио Маяк', u:'https://icecast-vgtrk.cdnvideo.ru/mayakfm_mp3_192kbps', b:192, c:'MP3' },
      { id:'ru-russia', n:'Радио России', u:'https://icecast-vgtrk.cdnvideo.ru/rrzonam_mp3_192kbps', b:192, c:'MP3' },
      { id:'ru-zvezda', n:'Радио Звезда', u:'https://icecast-zvezda.mediacdn.ru/radio/zvezda_128', b:128, c:'MP3' },
      { id:'ru-vanya', n:'Радио Ваня', u:'https://icecast-radiovanya.cdnvideo.ru/radiovanya', b:64, c:'AAC' },
      { id:'ru-nashe', n:'Наше Радио', u:'https://nashe1.hostingradio.ru/nashe-256', b:256, c:'MP3' },
      { id:'ru-europaplus', n:'Европа Плюс', u:'https://emgregion.hostingradio.ru:8064/moscow.europaplus.mp3', b:128, c:'MP3' },
      { id:'ru-retro', n:'Ретро FM', u:'https://retroserver.streamr.ru:8043/retro256.mp3', b:256, c:'MP3' },
      { id:'ru-dorozhnoe', n:'Дорожное Радио', u:'https://dorognoe.hostingradio.ru:8000/radio', b:128, c:'MP3' },
      { id:'ru-rusradio', n:'Русское Радио', u:'https://dfm.hostingradio.ru/rusradio128.mp3', b:128, c:'MP3' },
      { id:'ru-silver', n:'Серебряный дождь', u:'https://213.59.4.27:8000/silver128.mp3', b:128, c:'MP3' }
    ],
    US: [
      { id:'us-paradise', n:'Radio Paradise', u:'https://stream.radioparadise.com/mp3-128', b:128, c:'MP3' },
      { id:'us-kexp', n:'KEXP Seattle', u:'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', b:128, c:'MP3' },
      { id:'us-groovesalad', n:'SomaFM · Groove Salad', u:'https://ice5.somafm.com/groovesalad-128-mp3', b:128, c:'MP3' },
      { id:'us-dronezone', n:'SomaFM · Drone Zone', u:'https://ice5.somafm.com/dronezone-128-mp3', b:128, c:'MP3' },
      { id:'us-secretagent', n:'SomaFM · Secret Agent', u:'https://ice5.somafm.com/secretagent-128-mp3', b:128, c:'MP3' }
    ],
    GB: [
      { id:'gb-nts1', n:'NTS Radio 1', u:'https://stream-relay-geo.ntslive.net/stream?client=direct', b:128, c:'MP3' },
      { id:'gb-nts2', n:'NTS Radio 2', u:'https://stream-relay-geo.ntslive.net/stream2?client=direct', b:128, c:'MP3' }
    ],
    DE: [
      { id:'de-dlf', n:'Deutschlandfunk', u:'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3?aggregator=web', b:128, c:'MP3' },
      { id:'de-dlfkultur', n:'Deutschlandfunk Kultur', u:'https://st02.sslstream.dlf.de/dlf/02/128/mp3/stream.mp3?aggregator=web', b:128, c:'MP3' },
      { id:'de-dlfnova', n:'Deutschlandfunk Nova', u:'https://st03.sslstream.dlf.de/dlf/03/128/mp3/stream.mp3?aggregator=web', b:128, c:'MP3' }
    ],
    FR: [
      { id:'fr-fip', n:'FIP', u:'https://icecast.radiofrance.fr/fip-midfi.mp3?id=radiofrance', b:128, c:'MP3' },
      { id:'fr-fiprock', n:'FIP Rock', u:'https://icecast.radiofrance.fr/fiprock-midfi.mp3?id=radiofrance', b:128, c:'MP3' },
      { id:'fr-fipjazz', n:'FIP Jazz', u:'https://icecast.radiofrance.fr/fipjazz-midfi.mp3?id=radiofrance', b:128, c:'MP3' }
    ],
    NL: [
      { id:'nl-nts', n:'NTS Radio', u:'https://stream-relay-geo.ntslive.net/stream?client=direct', b:128, c:'MP3' }
    ]
  };
  var CURATED_COUNTRIES = [
    {cc:'RU',name:'Россия',count:15},{cc:'US',name:'США',count:5},
    {cc:'GB',name:'Великобритания',count:2},{cc:'DE',name:'Германия',count:3},
    {cc:'FR',name:'Франция',count:3},{cc:'NL',name:'Нидерланды',count:1}
  ];

  var DEFAULT_CITIES = [
    { n: 'Москва', la: 55.7558, lo: 37.6173 },
    { n: 'Санкт-Петербург', la: 59.9343, lo: 30.3351 },
    { n: 'Екатеринбург', la: 56.8389, lo: 60.6057 },
    { n: 'Новосибирск', la: 55.0084, lo: 82.9357 },
    { n: 'Казань', la: 55.7887, lo: 49.1221 },
    { n: 'Амстердам', la: 52.3676, lo: 4.9041 }
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
    weather: null, weatherRetry: 0, geo: [], geoBusy: false,
    eqLive: false, ovMode: null
  };
  S.cities = (Array.isArray(S.cities) ? S.cities : DEFAULT_CITIES.slice()).map(function (c) {
    return {
      n: String(c.n || c.name || c.city || 'Город'),
      la: Number(c.la != null ? c.la : (c.lat != null ? c.lat : c.latitude)),
      lo: Number(c.lo != null ? c.lo : (c.lon != null ? c.lon : c.longitude))
    };
  }).filter(function (c) { return isFinite(c.la) && isFinite(c.lo) && Math.abs(c.la) <= 90 && Math.abs(c.lo) <= 180; });
  if (!S.cities.length) S.cities = DEFAULT_CITIES.slice();
  if (S.ci >= S.cities.length || S.ci < 0) S.ci = 0;
  if (S.theme !== 'dark' && S.theme !== 'light') S.theme = 'dark';

  /* ---------- сеть ---------- */
  function fetchJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = ms || 6000;
    var timer;
    var request = fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
    var timed = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (ctl) ctl.abort();
        reject(new Error('request timeout'));
      }, timeout);
    });
    return Promise.race([request, timed]).then(function (data) {
      clearTimeout(timer);
      return data;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
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

  var loadSeq = 0;
  function loadList() {
    var seq = ++loadSeq;
    S.loading = true; S.err = false; S.msg = null; render();
    var q = S.query.trim().toLowerCase();
    // Встроенная подборка: прямые HTTPS-потоки от самих вещателей.
    var out = (CURATED[S.cc] || []).slice();
    if (q) out = out.filter(function (s) { return s.n.toLowerCase().indexOf(q) >= 0; });
    S.list = out;
    S.loading = false;
    S.err = !out.length;
    if (!S.cur || !out.some(function (s) { return s.id === S.cur.id; })) S.cur = out[0] || null;
    if (S.cur) store.set('sid', S.cur.id);
    render();
    if (S.ovMode) renderOverlay();
    return Promise.resolve();
  }

    function withCountries(cb) {
    S.countries = CURATED_COUNTRIES.slice();
    cb();
  }

  /* ---------- аудио ---------- */
  var audio = null, ctx = null, analyser = null, gain = null, curNode = null, fftBuf = null, hlsPlayer = null;

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
    if (hlsPlayer) { try { hlsPlayer.destroy(); } catch (e) {} hlsPlayer = null; }
    if (curNode) { try { curNode.disconnect(); } catch (e) {} curNode = null; }
    if (audio) {
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (e) {}
      audio = null;
    }
  }

  function stopStream() {
    S.gen++;
    S.playing = false;
    S.eqLive = false;
    dropAudio();
  }

  function startStream() {
    stopStream();
    if (!S.cur) return;
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
    var isHls = /\.m3u8(?:$|\?)/i.test(st.u);
    if (isHls && window.Hls && window.Hls.isSupported()) {
      try {
        hlsPlayer = new window.Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 });
        hlsPlayer.loadSource(st.u);
        hlsPlayer.attachMedia(a);
        hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, function () {
          if (gen !== S.gen || a !== audio) return;
          var hp = a.play();
          if (hp && hp.catch) hp.catch(function () { if (gen === S.gen && a === audio) fail('НАЖМИТЕ PLAY ДЛЯ ЗАПУСКА'); });
        });
        hlsPlayer.on(window.Hls.Events.ERROR, function (_, data) {
          if (gen !== S.gen || a !== audio || !data || !data.fatal) return;
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) hlsPlayer.startLoad();
          else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) hlsPlayer.recoverMediaError();
          else fail('ПОТОК HLS НЕДОСТУПЕН');
        });
        render();
        return;
      } catch (e) { if (cors) { attempt(st, false, gen); return; } }
    }
    if (isHls && a.canPlayType('application/vnd.apple.mpegurl')) {
      a.src = st.u;
    } else if (isHls) {
      if (cors) { attempt(st, false, gen); return; }
      fail('HLS НЕ ПОДДЕРЖИВАЕТСЯ ЭТИМ БРАУЗЕРОМ');
      return;
    } else {
      a.src = st.u;
    }
    var p = a.play();
    if (p && p.catch) p.catch(function (e) {
      if (gen !== S.gen || a !== audio) return;
      if (e && e.name === 'NotAllowedError') {
        fail('НАЖМИТЕ PLAY ДЛЯ ЗАПУСКА');
      } else if (cors) {
        // Некоторые радиосерверы не поддерживают CORS для Web Audio.
        // Повторяем обычное воспроизведение без анализатора.
        attempt(st, false, gen);
      } else {
        fail('НЕ УДАЛОСЬ ЗАПУСТИТЬ ПОТОК');
      }
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
    if (S.status === 'play' && S.playing) return;
    S.status = 'play';
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

  var weatherSeq = 0;
  function loadWeather() {
    var c = city(), seq = ++weatherSeq;
    S.weather = null; render();
    var baseUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(c.la) +
      '&longitude=' + encodeURIComponent(c.lo) + '&timezone=auto';
    function parseWeather(j) {
      var cur = j && (j.current || j.current_weather);
      var temp = cur && (typeof cur.temperature_2m === 'number' ? cur.temperature_2m : cur.temperature);
      var code = cur && (typeof cur.weather_code === 'number' ? cur.weather_code : cur.weathercode);
      if (typeof temp !== 'number') throw new Error('weather response incomplete');
      return { t: Math.round(temp), code: typeof code === 'number' ? code : 0,
        off: typeof j.utc_offset_seconds === 'number' ? j.utc_offset_seconds : null };
    }
    fetchJSON(baseUrl + '&current=temperature_2m,weather_code&forecast_days=1', 12000)
      .catch(function () {
        return fetchJSON(baseUrl + '&current_weather=true', 12000);
      })
      .then(function (j) {
        if (seq !== weatherSeq || city() !== c) return;
        S.weatherRetry = 0;
        S.weather = parseWeather(j);
        render();
      })
      .catch(function () {
        if (seq !== weatherSeq || city() !== c) return;
        S.weather = { t: null, code: null, off: null, error: true };
        render();
        if (S.weatherRetry < 3) {
          S.weatherRetry++;
          setTimeout(function () {
            if (seq === weatherSeq && city() === c && S.weather && S.weather.t === null) loadWeather();
          }, 10000);
        }
      });
  }
  function stepCity(d) {
    S.ci = (S.ci + d + S.cities.length) % S.cities.length;
    store.set('ci', S.ci);
    loadWeather();
  }
  function fmtTemp(t) { return t > 0 ? '+' + t + '°' : (t < 0 ? '−' + Math.abs(t) + '°' : '0°'); }
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
    setText($('cityVal'), c.n.toUpperCase());
    setText($('cond'), !w ? 'ЗАГРУЗКА ПОГОДЫ…' : (w.t === null ? 'НЕТ ДАННЫХ' : fmtTemp(w.t) + ' · ' + (WMO[w.code] || '—')));

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
      fetchJSON(url).then(function (j) {
        S.geo = (j.results || []).map(function (r) {
          return { name: r.name, la: r.latitude, lo: r.longitude, sub: [r.admin1, r.country_code].filter(Boolean).join(', ') };
        });
        S.geoBusy = false; renderOverlay();
      }, function () { S.geo = []; S.geoBusy = false; renderOverlay(); });
    }, 400);
  });

  /* ---------- масштаб под экран ---------- */
  function fit() {
    var vv = window.visualViewport;
    var w = vv ? vv.width : window.innerWidth, h = vv ? vv.height : window.innerHeight;
    var s = Math.min(w / 390, h / 780, 1.6);
    if (w < 600) s *= 0.90;
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
  setInterval(function () { loadWeather(); }, 600000);

  /* ---------- старт ---------- */
  render();
  loadWeather();
  loadList().then(function () {
    var sid = store.get('sid', null), found = null;
    if (sid) for (var i = 0; i < S.list.length; i++) if (S.list[i].id === sid) found = S.list[i];
    S.cur = found || S.list[0] || null;
    if (S.cur) store.set('sid', S.cur.id);
    render();
    if (S.err) setTimeout(function () { if (!S.list.length) loadList(); }, 5000);
  });
})();
