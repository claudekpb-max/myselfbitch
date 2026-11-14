/* Реальные данные менеджера в прототипе «Менеджер 2027».
   Выгрузка из админки Битрикса (кнопка «Excel» в списке = HTML-таблица .xls, CSV в UTF-8 или Windows-1251, JSON)
   читается прямо в браузере и хранится ТОЛЬКО в localStorage этого браузера.
   Никуда не отправляется: ни в Битрикс, ни в GitHub, ни на какой-либо сервер. */
(function () {
  var KEY = 'kb-real-v1', ME = 'kb-me-v1';

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function norm(s) { return String(s == null ? '' : s).replace(/[ \s]+/g, ' ').trim(); }
  function low(s) { return norm(s).toLowerCase().replace(/ё/g, 'е'); }

  /* ---------- чтение файлов ---------- */
  function decode(buf) {
    var u8 = new Uint8Array(buf), t;
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
    if ((u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF)) return new TextDecoder(u8[0] === 0xFF ? 'utf-16le' : 'utf-16be').decode(u8.subarray(2));
    t = new TextDecoder('utf-8').decode(u8);
    var head = t.slice(0, 3000), meta = head.match(/charset=["']?([\w-]+)/i);
    if (meta && /1251|cp-?1251/i.test(meta[1])) return new TextDecoder('windows-1251').decode(u8);
    if (/�/.test(t)) return new TextDecoder('windows-1251').decode(u8);
    return t;
  }
  function parseCsv(text) {
    var first = text.split(/\r?\n/, 1)[0] || '', d = [';', '\t', ','].sort(function (a, b) { return first.split(b).length - first.split(a).length; })[0];
    var rows = [], row = [], f = '', q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
      if (c === '"') q = true; else if (c === d) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return norm(x); }); });
  }
  function parseHtml(text) {
    var doc = new DOMParser().parseFromString(text, 'text/html'), best = null;
    [].forEach.call(doc.querySelectorAll('table'), function (t) { if (!best || t.rows.length > best.rows.length) best = t; });
    if (!best) return [];
    return [].map.call(best.rows, function (tr) { return [].map.call(tr.cells, function (td) { return norm(td.textContent); }); })
      .filter(function (r) { return r.some(function (x) { return x; }); });
  }
  function tablesFrom(name, text) {
    var s = text.replace(/^\s+/, '');
    if (/\.json$/i.test(name) || /^[\[{]/.test(s)) {
      var j = JSON.parse(s);
      if (j && (j.users || j.offers)) return [{ kind: 'native', data: j }];
      var arr = Array.isArray(j) ? j : (j && (j.items || j.data || j.result)) || [];
      if (!arr.length) return [];
      var keys = Object.keys(arr[0]);
      return [{ kind: 'rows', rows: [keys].concat(arr.map(function (o) { return keys.map(function (k) { return o[k] == null ? '' : (typeof o[k] === 'object' ? JSON.stringify(o[k]) : String(o[k])); }); })) }];
    }
    if (/<table/i.test(s.slice(0, 200000))) return [{ kind: 'rows', rows: parseHtml(text) }];
    return [{ kind: 'rows', rows: parseCsv(text) }];
  }

  /* ---------- распознавание колонок ---------- */
  var U = { id: ['id'], login: ['логин', 'login'], name: ['имя', 'name', 'first name'], last: ['фамилия', 'last_name', 'last name'], second: ['отчество', 'second_name'],
    email: ['e-mail', 'email', 'почта'], active: ['активн', 'active'], groups: ['групп', 'group'], fio: ['фио', 'ф.и.о', 'пользователь'] };
  var O = { no: ['номер кп', '№ кп', 'номер', '№', 'number', 'id'], title: ['название', 'наименование', 'предмет', 'title', 'name', 'описание'],
    client: ['заказчик', 'клиент', 'покупатель', 'контрагент', 'customer', 'client'], phone: ['телефон', 'phone'], addr: ['адрес', 'address', 'объект'],
    mgr: ['менеджер', 'ответственн', 'автор', 'создал', 'manager', 'created_by', 'responsible'], status: ['статус', 'состояни', 'status', 'stage'],
    sum: ['сумма', 'итого', 'стоимость', 'цена', 'total', 'sum', 'price', 'opportunity'], date: ['дата созд', 'создано', 'дата', 'date', 'created'],
    cur: ['валют', 'currency'] };
  function mapCols(head, dict) {
    var h = head.map(low), m = {}, used = {};
    Object.keys(dict).forEach(function (f) {
      for (var s = 0; s < dict[f].length; s++) {
        var syn = dict[f][s], i = h.findIndex(function (x, k) { return !used[k] && (x === syn || (syn.length > 2 && x.indexOf(syn) > -1)); });
        if (i > -1) { m[f] = i; used[i] = 1; return; }
      }
    });
    return m;
  }
  function kindOf(head) {
    var h = head.map(low).join('|');
    var u = /логин|login|e-mail|email|фамилия|last_name/.test(h), o = /сумм|итого|стоимост|total|opportunity|заказчик|клиент|контрагент|статус|status/.test(h);
    if (u && !/сумм|итого|стоимост|total|opportunity/.test(h)) return 'users';
    if (o) return 'offers';
    return u ? 'users' : null;
  }
  function headerRow(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) if (kindOf(rows[i])) return i;
    return 0;
  }

  /* ---------- нормализация ---------- */
  var COLORS = ['#6b5b4e', '#4e6b5e', '#8a5a44', '#5b5e7a', '#7a5b6e', '#4e626b', '#6e6a4a', '#7a4e4e'];
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function short(full) { var p = norm(full).split(' ').filter(Boolean); if (p.length < 2) return p[0] || ''; return p[0] + ' ' + p[1][0] + '.'; }
  function initials(full) { var p = norm(full).split(' ').filter(Boolean); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
  function money(v) { var s = String(v == null ? '' : v).replace(/[^\d,.\-]/g, ''); if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); var n = parseFloat(s); return isFinite(n) ? n : 0; }
  function date(v) {
    var s = norm(v), m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (m) return { t: new Date((m[3].length === 2 ? '20' : '') + m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2)).getTime() || 0, s: ('0' + m[1]).slice(-2) + '.' + ('0' + m[2]).slice(-2) + '.' + (m[3].length === 2 ? '20' : '') + m[3] };
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { t: new Date(m[0]).getTime() || 0, s: m[3] + '.' + m[2] + '.' + m[1] };
    return { t: 0, s: s };
  }
  function status(v) {
    var s = low(v);
    if (!s || /черн/.test(s)) return '';
    if (/отказ|архив|проигр|отмен|закрыт без/.test(s)) return 'lost';
    if (/заказ|принят|оплач|выигр|договор|успеш|согласов/.test(s)) return 'ok';
    if (/просм|откры|прочит/.test(s)) return 'seen';
    if (/жд|ожида|отправ|выслан|на рассмотр/.test(s)) return 'wait';
    if (/нов/.test(s)) return 'new';
    return 'wait';
  }
  function userFrom(r, m) {
    var g = function (f) { return m[f] != null ? norm(r[m[f]]) : ''; };
    var fio = g('fio'), name = g('name'), last = g('last');
    var full = norm((name || '') + ' ' + (last || '')) || fio || g('login') || g('email');
    return { id: g('id') || g('login') || full, login: g('login'), name: full, email: g('email'), active: !/^(n|нет|0|false)$/i.test(g('active')), groups: g('groups') };
  }
  function offerFrom(r, m) {
    var g = function (f) { return m[f] != null ? norm(r[m[f]]) : ''; }, d = date(g('date')), mgr = g('mgr').replace(/^\[\d+\]\s*/, '').replace(/\s*\(.*\)$/, '');
    return { no: g('no'), title: g('title'), client: g('client'), phone: g('phone'), addr: g('addr'), mgrFull: mgr, st: status(g('status')), stt: g('status') || 'Черновик',
      sum: money(g('sum')), cur: g('cur'), date: d.s, t: d.t };
  }

  function importTexts(files) {
    var users = [], offers = [], report = [];
    files.forEach(function (f) {
      var tabs;
      try { tabs = tablesFrom(f.name, f.text); } catch (e) { report.push(f.name + ': не удалось прочитать (' + e.message + ')'); return; }
      tabs.forEach(function (t) {
        if (t.kind === 'native') { users = users.concat(t.data.users || []); offers = offers.concat(t.data.offers || []); report.push(f.name + ': пользователей ' + (t.data.users || []).length + ', КП ' + (t.data.offers || []).length); return; }
        var rows = t.rows; if (!rows || rows.length < 2) { report.push(f.name + ': пустая таблица'); return; }
        var hi = headerRow(rows), head = rows[hi], kind = kindOf(head), body = rows.slice(hi + 1);
        if (kind === 'users') { var mu = mapCols(head, U); var us = body.map(function (r) { return userFrom(r, mu); }).filter(function (u) { return u.name; }); users = users.concat(us); report.push(f.name + ': пользователей ' + us.length); }
        else if (kind === 'offers') { var mo = mapCols(head, O); var os = body.map(function (r) { return offerFrom(r, mo); }).filter(function (o) { return o.no || o.client || o.sum; }); offers = offers.concat(os); report.push(f.name + ': КП ' + os.length + (mo.sum == null ? ' (колонка суммы не найдена)' : '')); }
        else report.push(f.name + ': не понял, что в таблице (колонки: ' + head.slice(0, 8).join(', ') + ')');
      });
    });
    return { users: users, offers: offers, report: report };
  }
  function finish(res, names) {
    var prev = load(KEY) || { users: [], offers: [] }, byId = {};
    var users = (res.users.length ? res.users : prev.users || []);
    var offers = res.offers.length ? res.offers : prev.offers || [];
    offers.forEach(function (o, i) { if (!o.no) o.no = String(i + 1); byId[o.no] = o; });
    offers = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) { return (b.t - a.t) || (+b.no - +a.no) || 0; });
    offers.forEach(function (o) { var m = o.mgrFull || ''; o.mgr = short(m) || '—'; o.mgri = initials(m || '?'); o.mgrc = COLORS[hash(m) % COLORS.length]; if (!o.title) o.title = o.client ? 'КП для ' + o.client : 'КП № ' + o.no; });
    var data = { users: users, offers: offers, files: names, at: Date.now() };
    if (!save(KEY, data)) throw new Error('Не хватило места в хранилище браузера — выгрузите меньше КП (например, за последний год)');
    return { data: data, report: res.report };
  }

  window.KBReal = {
    data: function () { var d = load(KEY); return d && (d.offers && d.offers.length || d.users && d.users.length) ? d : null; },
    me: function () { return load(ME); },
    setMe: function (u) { save(ME, u); },
    clear: function () { try { localStorage.removeItem(KEY); localStorage.removeItem(ME); } catch (e) {} },
    short: short, initials: initials,
    /* files: FileList / массив File. Возвращает Promise({data, report}) */
    importFiles: function (files) {
      files = [].slice.call(files || []);
      return Promise.all(files.map(function (f) {
        if (/\.xlsx$/i.test(f.name)) return Promise.resolve({ name: f.name, text: '', bad: 'формат .xlsx: сохраните из Excel как CSV или выгрузите кнопкой «Excel» в списке Битрикса' });
        return f.arrayBuffer().then(function (b) { return { name: f.name, text: decode(b) }; });
      })).then(function (list) {
        var bad = list.filter(function (x) { return x.bad; }).map(function (x) { return x.name + ': ' + x.bad; });
        var res = importTexts(list.filter(function (x) { return !x.bad; }));
        res.report = bad.concat(res.report);
        if (!res.users.length && !res.offers.length) { var e = new Error(res.report.join('\n') || 'В файлах не нашлось ни пользователей, ни КП'); e.report = res.report; throw e; }
        return finish(res, list.map(function (x) { return x.name; }));
      });
    },
    importTexts: function (list) { return finish(importTexts(list), list.map(function (x) { return x.name; })); }
  };
})();
