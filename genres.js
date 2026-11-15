/* RADIO MAY — жанровая классификация станций.
   Подключается в браузере (window.RM_GENRES) и в Node (tools/build_catalog.mjs через require/import).
   Жанр определяется ТОЛЬКО по явным признакам: теги каталога (Radio Browser), формат вещания
   в названии станции и небольшой список известных новостных/классических станций.
   Если признаков нет — станция попадает в «ДРУГИЕ». Случайные жанры не назначаются. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RM_GENRES = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Порядок = порядок переключения стрелками. ДРУГИЕ — всегда последний.
  var LIST = [
    { id: 'all',     name: 'ВСЕ' },
    { id: 'rock',    name: 'РОК' },
    { id: 'pop',     name: 'ПОП' },
    { id: 'jazz',    name: 'ДЖАЗ' },
    { id: 'news',    name: 'НОВОСТИ' },
    { id: 'elec',    name: 'ЭЛЕКТРОННАЯ МУЗЫКА' },
    { id: 'retro',   name: 'РЕТРО' },
    { id: 'classic', name: 'КЛАССИКА' },
    // жанры, реально присутствующие в каталоге (Zaycev.FM «Шансон», Record «Сказки», рэп-станции США/Великобритании)
    { id: 'chanson', name: 'ШАНСОН' },
    { id: 'hiphop',  name: 'ХИП-ХОП' },
    { id: 'kids',    name: 'ДЕТСКОЕ' },
    { id: 'other',   name: 'ДРУГИЕ' }
  ];

  var RULES = [
    ['news',    /(^|[^a-zа-я])(news|новост[иь]?|вести|информационн|информация)([^a-zа-я]|$)|\b(lbc|cnn|npr|bbc world service|bbc radio 4|bbc radio 5|business fm|коммерсант|эхо москвы|говорит москва)\b/i],
    ['classic', /\bclassical\b|классическ|симфон|\bopera\b|\bопер[аы]\b|baroque|барокко|chamber music|orchestra|\bclassic fm\b|bbc radio 3/i],
    ['jazz',    /\bjazz\b|джаз|smooth jazz|bossa|\bswing\b/i],
    ['rock',    /\brock\b|(^|[^а-я])рок([^а-я]|$)|\bmetal\b|метал|\bpunk\b|панк|grunge|\bindie\b|alternative|hard ?rock/i],
    ['hiphop',  /hip[ -]?hop|хип[ -]?хоп|\brap\b|рэп|\btrap\b|\br ?& ?b\b|\brnb\b/i],
    ['elec',    /electronic|электрон|\bdance\b|\bedm\b|\bhouse\b|techno|техно|trance|транс\b|dubstep|\bdnb\b|drum ?(&|and|n) ?bass|\bclub\b|клуб|\bdeep\b|chill|lounge|ambient|downtempo|synth|progressive|pump|festival/i],
    ['retro',   /oldies|\bretro\b|ретро|golden|nostalg|ностальг|disco|дискотек|classic hits|олдис|хиты всех времен|хиты всех времён|(^|[^0-9])(50|60|70|80|90)(s|'s|-?х|-е|ые|-ых)(?![a-zа-я])|eighties|seventies|sixties|nineties/i],
    ['chanson', /шансон|chanson|блатн/i],
    ['kids',    /детск|сказк|\bkids?\b|children|lullab|колыбел/i],
    ['pop',     /\bpop\b|(^|[^а-я])поп([^а-я]|$)|top ?40|\bchr\b|\bhits?\b|хиты|euro ?hits|europa|европа плюс|contemporary|hit music/i]
  ];

  function classify(name, tags) {
    var text = String(name || '') + ',' + String(tags || '');
    var out = [];
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][1].test(text) && out.indexOf(RULES[i][0]) < 0) out.push(RULES[i][0]);
    }
    // «classic rock» и т.п. — рок + ретро: ретро добавляем только по явному слову «classic hits/oldies» (см. правила)
    return out.length ? out : ['other'];
  }

  function nameOf(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i].name;
    return id;
  }

  return { LIST: LIST, classify: classify, nameOf: nameOf };
});
