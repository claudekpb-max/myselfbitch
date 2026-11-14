/* Купибас · Менеджер 2027 — общие данные прототипа.
   В рабочей версии:
   - CATALOG берётся из инфоблока каталога сайта (тот же, что на kupibas.ru), цены сверяются с 1С (обмен CommerceML / REST 1С);
   - WORKS — highload-блок «Справочник работ» (правка в интерфейсе менеджера, история изменений);
   - TEMPLATES — highload-блок «Шаблоны КП».
   Здесь всё демонстрационное, изменения сохраняются в localStorage браузера. */
(function (w) {
  'use strict';
  var EUR = 93.58;

  /* ---------- Каталог товаров (структура как на сайте: раздел → товар → артикул) ---------- */
  var CATALOG = [
    // Композитные чаши
    { sku: 'FAR-700', sec: 'Композитные бассейны', name: 'Композитная чаша Farol 7,0×3,5×1,5 м', unit: 'шт', price: 1190000, p1c: 1190000, cur: 'RUB' },
    { sku: 'FAR-800', sec: 'Композитные бассейны', name: 'Композитная чаша Farol 8,0×3,8×1,6 м', unit: 'шт', price: 1380000, p1c: 1415000, cur: 'RUB' },
    { sku: 'FRM-840', sec: 'Композитные бассейны', name: 'Композитная чаша Franmer 8,0×4,0×1,5 м', unit: 'шт', price: 1540000, p1c: 1540000, cur: 'RUB' },
    { sku: 'FRM-630', sec: 'Композитные бассейны', name: 'Композитная чаша Franmer 6,3×3,1×1,5 м', unit: 'шт', price: 1120000, p1c: 1120000, cur: 'RUB' },
    { sku: 'MRS-600', sec: 'Композитные бассейны', name: 'Композитная чаша Marshal 6,0×3,0×1,4 м', unit: 'шт', price: 980000, p1c: 965000, cur: 'RUB' },
    { sku: 'MRS-750', sec: 'Композитные бассейны', name: 'Композитная чаша Marshal 7,5×3,5×1,5 м', unit: 'шт', price: 1210000, p1c: 1210000, cur: 'RUB' },
    // Плёнка и отделка
    { sku: 'ALK-2000', sec: 'Плёнка ПВХ', name: 'Плёнка Alkorplan 2000, 1,5 мм, голубая', unit: 'м²', price: 1450, p1c: 1450, cur: 'RUB' },
    { sku: 'ALK-3D', sec: 'Плёнка ПВХ', name: 'Плёнка Alkorplan 3D Touch, 1,5 мм', unit: 'м²', price: 38.5, p1c: 39.9, cur: 'EUR' },
    { sku: 'GEO-300', sec: 'Плёнка ПВХ', name: 'Геотекстиль подложка 300 г/м²', unit: 'м²', price: 180, p1c: 180, cur: 'RUB' },
    { sku: 'TIL-AQ', sec: 'Керамогранит', name: 'Керамогранит бассейновый Aquaris 244×119', unit: 'м²', price: 4200, p1c: 4200, cur: 'RUB' },
    { sku: 'TIL-EDGE', sec: 'Керамогранит', name: 'Бортовой камень керамогранит, 30 см', unit: 'пог. м', price: 3600, p1c: 3850, cur: 'RUB' },
    { sku: 'GLU-C2', sec: 'Керамогранит', name: 'Клей и затирка эпоксидная (комплект на м²)', unit: 'м²', price: 950, p1c: 950, cur: 'RUB' },
    // Закладные
    { sku: 'SKM-15', sec: 'Закладные', name: 'Скиммер под бетон, широкий проём', unit: 'шт', price: 24500, p1c: 24500, cur: 'RUB' },
    { sku: 'NOZ-50', sec: 'Закладные', name: 'Форсунка возвратная', unit: 'шт', price: 3900, p1c: 3900, cur: 'RUB' },
    { sku: 'DRN-01', sec: 'Закладные', name: 'Донный слив', unit: 'шт', price: 8700, p1c: 8700, cur: 'RUB' },
    { sku: 'OVF-GR', sec: 'Закладные', name: 'Переливная решётка 245 мм', unit: 'пог. м', price: 6200, p1c: 6200, cur: 'RUB' },
    { sku: 'OVF-TANK', sec: 'Закладные', name: 'Переливная (накопительная) ёмкость 3 м³', unit: 'шт', price: 168000, p1c: 172000, cur: 'RUB' },
    // Оборудование
    { sku: 'FLT-600', sec: 'Фильтрация', name: 'Фильтровальная установка 600 мм, песок, 6-ходовой клапан', unit: 'шт', price: 186000, p1c: 186000, cur: 'RUB' },
    { sku: 'PMP-VS', sec: 'Насосы', name: 'Насос с частотным регулированием', unit: 'шт', price: 2290, p1c: 2290, cur: 'EUR' },
    { sku: 'HEX-40', sec: 'Подогрев', name: 'Теплообменник 40 кВт', unit: 'шт', price: 98000, p1c: 98000, cur: 'RUB' },
    { sku: 'LED-RGB', sec: 'Освещение', name: 'LED-прожектор RGB, управление со смартфона', unit: 'шт', price: 46000, p1c: 46000, cur: 'RUB' },
    { sku: 'DOS-PH', sec: 'Химия и дозация', name: 'Станция дозации pH/Cl', unit: 'шт', price: 76000, p1c: 79500, cur: 'RUB' },
    { sku: 'SND-25', sec: 'Фильтрация', name: 'Песок кварцевый 0,4–0,8 мм, мешок 25 кг', unit: 'меш', price: 950, p1c: 950, cur: 'RUB' },
    { sku: 'CHM-SET', sec: 'Химия и дозация', name: 'Набор химии на сезон', unit: 'компл', price: 18500, p1c: 18500, cur: 'RUB' },
    // Биодизайн
    { sku: 'BIO-FLT', sec: 'Биобассейны', name: 'Биофильтр с зоной регенерации', unit: 'шт', price: 420000, p1c: 420000, cur: 'RUB' },
    { sku: 'BIO-PLN', sec: 'Биобассейны', name: 'Водные растения (комплект на м² зоны)', unit: 'м²', price: 3200, p1c: 3200, cur: 'RUB' },
    { sku: 'BIO-STN', sec: 'Биобассейны', name: 'Природный камень для берега', unit: 'т', price: 14500, p1c: 14500, cur: 'RUB' }
  ];

  /* ---------- Справочник работ (по умолчанию) ---------- */
  var WORKS = [
    { id: 'w-dig', cat: 'Земляные', name: 'Разработка котлована', unit: 'м³', price: 1200 },
    { id: 'w-out', cat: 'Земляные', name: 'Вывоз грунта', unit: 'м³', price: 650 },
    { id: 'w-base', cat: 'Основание', name: 'Бетонное основание с армированием', unit: 'м²', price: 4800 },
    { id: 'w-del', cat: 'Логистика', name: 'Доставка манипулятором (до 120 км)', unit: 'рейс', price: 150000 },
    { id: 'w-comp', cat: 'Монтаж', name: 'Установка композитной чаши', unit: 'шт', price: 120000 },
    { id: 'w-fill', cat: 'Монтаж', name: 'Обратная засыпка с бетонированием пазух', unit: 'пог. м', price: 3500 },
    { id: 'w-mono', cat: 'Бетонные работы', name: 'Монолитная чаша: опалубка, армирование, бетон', unit: 'м²', price: 9800 },
    { id: 'w-hydro', cat: 'Бетонные работы', name: 'Гидроизоляция и выравнивание чаши', unit: 'м²', price: 2600 },
    { id: 'w-film', cat: 'Отделка', name: 'Укладка плёнки ПВХ со сваркой швов', unit: 'м²', price: 1900 },
    { id: 'w-tile', cat: 'Отделка', name: 'Облицовка керамогранитом', unit: 'м²', price: 5200 },
    { id: 'w-edge', cat: 'Отделка', name: 'Монтаж бортового камня', unit: 'пог. м', price: 2400 },
    { id: 'w-ovf', cat: 'Монтаж', name: 'Монтаж переливной системы', unit: 'пог. м', price: 4100 },
    { id: 'w-pipe', cat: 'Монтаж', name: 'Обвязка оборудования и трубопроводы', unit: 'компл', price: 268000 },
    { id: 'w-bio', cat: 'Биодизайн', name: 'Устройство зоны регенерации', unit: 'м²', price: 7600 },
    { id: 'w-plant', cat: 'Биодизайн', name: 'Посадка растений и оформление берега', unit: 'м²', price: 2100 },
    { id: 'w-start', cat: 'Запуск', name: 'Пусконаладка и обучение', unit: 'выезд', price: 78000 }
  ];

  /* ---------- Шаблоны: 8 вкладок (сгруппированы по технологии только для удобства правки) ----------
     Переменные в формулах: L, W, D — размеры (м); S — зеркало воды; P — периметр; F — площадь чаши (дно+стены);
     V — объём воды; X — объём котлована; B — зона регенерации (биодизайн, м²). */
  var TEMPLATES = [
    { tab: 'Композит', items: [
      { id: 'farol', name: 'Фарол', desc: 'Композитная чаша Farol под ключ', dims: [7, 3.5, 1.5], fixed: true, lines: [
        ['cat', 'bowl', 'FAR-700', '1'], ['work', 'bowl', 'w-del', '1'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'SND-25', '6'], ['cat', 'eq', 'LED-RGB', '2'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-base', '(L+1)*(W+1)'], ['work', 'work', 'w-comp', '1'], ['work', 'work', 'w-fill', 'P'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]},
      { id: 'franmer', name: 'Франмер', desc: 'Композитная чаша Franmer под ключ', dims: [8, 4, 1.5], fixed: true, lines: [
        ['cat', 'bowl', 'FRM-840', '1'], ['work', 'bowl', 'w-del', '1'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'HEX-40', '1'], ['cat', 'eq', 'LED-RGB', '3'], ['cat', 'eq', 'DOS-PH', '1'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-base', '(L+1)*(W+1)'], ['work', 'work', 'w-comp', '1'], ['work', 'work', 'w-fill', 'P'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]},
      { id: 'marshal', name: 'Маршал', desc: 'Композитная чаша Marshal под ключ', dims: [6, 3, 1.4], fixed: true, lines: [
        ['cat', 'bowl', 'MRS-600', '1'], ['work', 'bowl', 'w-del', '1'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'LED-RGB', '2'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-base', '(L+1)*(W+1)'], ['work', 'work', 'w-comp', '1'], ['work', 'work', 'w-fill', 'P'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]}
    ]},
    { tab: 'Бетон + плёнка', items: [
      { id: 'film-budget', name: 'Бетон плёнка бюджет', desc: 'Бетонная чаша, плёнка Alkorplan 2000, скиммеры', dims: [8, 4, 1.5], lines: [
        ['cat', 'bowl', 'ALK-2000', 'F*1.1'], ['cat', 'bowl', 'GEO-300', 'F*1.1'], ['cat', 'bowl', 'SKM-15', 'Math.max(2,Math.ceil(S/25))'], ['cat', 'bowl', 'NOZ-50', 'Math.max(3,Math.ceil(S/10))'], ['cat', 'bowl', 'DRN-01', '1'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'SND-25', '6'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-mono', 'F'], ['work', 'work', 'w-hydro', 'F'], ['work', 'work', 'w-film', 'F'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]},
      { id: 'film-3d', name: 'Бетон плёнка 3D', desc: 'Бетонная чаша, плёнка Alkorplan 3D Touch, подсветка', dims: [8, 4, 1.5], lines: [
        ['cat', 'bowl', 'ALK-3D', 'F*1.1'], ['cat', 'bowl', 'GEO-300', 'F*1.1'], ['cat', 'bowl', 'SKM-15', 'Math.max(2,Math.ceil(S/25))'], ['cat', 'bowl', 'NOZ-50', 'Math.max(3,Math.ceil(S/10))'], ['cat', 'bowl', 'DRN-01', '1'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'HEX-40', '1'], ['cat', 'eq', 'LED-RGB', '3'], ['cat', 'eq', 'SND-25', '6'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-mono', 'F'], ['work', 'work', 'w-hydro', 'F'], ['work', 'work', 'w-film', 'F'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]}
    ]},
    { tab: 'Керамогранит', items: [
      { id: 'tile-skim', name: 'Бетон керамогранит скиммерный', desc: 'Бетонная чаша, облицовка керамогранитом, скиммеры', dims: [8, 4, 1.5], lines: [
        ['cat', 'bowl', 'TIL-AQ', 'F*1.08'], ['cat', 'bowl', 'GLU-C2', 'F'], ['cat', 'bowl', 'TIL-EDGE', 'P'], ['cat', 'bowl', 'SKM-15', 'Math.max(2,Math.ceil(S/25))'], ['cat', 'bowl', 'NOZ-50', 'Math.max(3,Math.ceil(S/10))'], ['cat', 'bowl', 'DRN-01', '1'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'HEX-40', '1'], ['cat', 'eq', 'DOS-PH', '1'], ['cat', 'eq', 'SND-25', '6'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-mono', 'F'], ['work', 'work', 'w-hydro', 'F'], ['work', 'work', 'w-tile', 'F'], ['work', 'work', 'w-edge', 'P'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]},
      { id: 'tile-ovf', name: 'Керамогранит переливной', desc: 'Бетонная чаша, керамогранит, переливная система', dims: [10, 4, 1.5], lines: [
        ['cat', 'bowl', 'TIL-AQ', 'F*1.08'], ['cat', 'bowl', 'GLU-C2', 'F'], ['cat', 'bowl', 'OVF-GR', 'P'], ['cat', 'bowl', 'OVF-TANK', '1'], ['cat', 'bowl', 'NOZ-50', 'Math.max(4,Math.ceil(S/8))'], ['cat', 'bowl', 'DRN-01', '2'],
        ['cat', 'eq', 'FLT-600', '1'], ['cat', 'eq', 'PMP-VS', '2'], ['cat', 'eq', 'HEX-40', '1'], ['cat', 'eq', 'DOS-PH', '1'], ['cat', 'eq', 'LED-RGB', '4'], ['cat', 'eq', 'SND-25', '8'],
        ['work', 'work', 'w-dig', 'X'], ['work', 'work', 'w-out', 'X'], ['work', 'work', 'w-mono', 'F'], ['work', 'work', 'w-hydro', 'F'], ['work', 'work', 'w-tile', 'F'], ['work', 'work', 'w-ovf', 'P'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]}
    ]},
    { tab: 'Биодизайн', items: [
      { id: 'bio', name: 'Биодизайн', desc: 'Биобассейн с зоной регенерации, без химии', dims: [8, 4, 1.8], bio: true, lines: [
        ['cat', 'bowl', 'ALK-2000', '(F+B)*1.1'], ['cat', 'bowl', 'GEO-300', '(F+B)*1.1'], ['cat', 'bowl', 'BIO-STN', 'Math.ceil(P*0.3)'],
        ['cat', 'eq', 'BIO-FLT', '1'], ['cat', 'eq', 'PMP-VS', '1'], ['cat', 'eq', 'BIO-PLN', 'B'],
        ['work', 'work', 'w-dig', 'X+B*0.8'], ['work', 'work', 'w-out', 'X+B*0.8'], ['work', 'work', 'w-hydro', 'F'], ['work', 'work', 'w-film', 'F+B'], ['work', 'work', 'w-bio', 'B'], ['work', 'work', 'w-plant', 'B'], ['work', 'work', 'w-pipe', '1'], ['work', 'work', 'w-start', '1']
      ]}
    ]}
  ];

  var SECTIONS = [
    { id: 'bowl', name: 'Чаша и материалы' },
    { id: 'eq', name: 'Оборудование' },
    { id: 'work', name: 'Работы' },
    { id: 'extra', name: 'Дополнительно' }
  ];

  /* ---------- Хранилище ---------- */
  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  var KB = {
    EUR: EUR,
    SECTIONS: SECTIONS,
    TEMPLATES: TEMPLATES.reduce(function (a, g) { return a.concat(g.items); }, []),
    works: function () { return load('kb-works-v1', clone(WORKS)); },
    saveWorks: function (list) { return save('kb-works-v1', list); },
    resetWorks: function () { try { localStorage.removeItem('kb-works-v1'); } catch (e) {} return clone(WORKS); },
    catalog: function () {
      var acc = load('kb-cat-accepted-v1', {});
      return CATALOG.map(function (c) { var x = clone(c); if (acc[x.sku] != null) x.price = acc[x.sku]; return x; });
    },
    acceptPrice1c: function (sku) { var acc = load('kb-cat-accepted-v1', {}); var c = CATALOG.filter(function (x) { return x.sku === sku; })[0]; if (!c) return; acc[sku] = c.p1c; save('kb-cat-accepted-v1', acc); },
    resetCatalog: function () { try { localStorage.removeItem('kb-cat-accepted-v1'); } catch (e) {} },
    /* Имитация запроса в 1С: в рабочей версии — REST-сервис 1С или выгрузка CommerceML */
    check1c: function (cb) { setTimeout(function () { cb(KB.catalog().map(function (c) { return { sku: c.sku, p1c: c.p1c, ok: Math.abs(c.p1c - c.price) < 0.005 }; })); }, 700); },
    toRub: function (price, cur) { return cur === 'EUR' ? Math.round(price * EUR) : price; },
    vars: function (L, W, D, bio) {
      L = +L || 0; W = +W || 0; D = +D || 0;
      var S = L * W, P = 2 * (L + W), F = S + P * D, V = S * D, X = (L + 1) * (W + 1) * (D + 0.3), B = bio ? Math.round(S * 0.6 * 10) / 10 : 0;
      return { L: L, W: W, D: D, S: S, P: P, F: F, V: V, X: X, B: B };
    },
    calc: function (formula, v) {
      var rest = String(formula).replace(/Math\.(ceil|floor|round|max|min)/g, '').replace(/[LWDSPFVXB]/g, '');
      if (!/^[\d\s.+\-*/(),]*$/.test(rest)) return 0;
      try { var r = Function('L', 'W', 'D', 'S', 'P', 'F', 'V', 'X', 'B', 'return (' + formula + ')')(v.L, v.W, v.D, v.S, v.P, v.F, v.V, v.X, v.B); return isFinite(r) ? Math.round(r * 100) / 100 : 0; } catch (e) { return 0; }
    },
    money: function (n) { return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽'; },
    num: function (n) { return (Math.round(n * 100) / 100).toLocaleString('ru-RU'); },
    load: load, save: save
  };
  w.KB = KB;
})(window);

/* тема меняется сразу во всех открытых вкладках прототипа */
window.addEventListener('storage', function (e) { if (e.key === 'kb-theme-v2' && e.newValue) document.documentElement.setAttribute('data-theme', e.newValue === 'dark' ? 'dark' : 'light'); });
