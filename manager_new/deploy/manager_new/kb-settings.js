/* Настройки интерфейса на сервере (/manager_new/ на сайте).
   window.KB_SRV = {user:{…}, def:{…}, admin, sessid, keys:[…]} — выводит guard.php в начале страницы.
   1) До остальных скриптов кладём в localStorage серверные настройки:
      свои → иначе общие по умолчанию → иначе оставляем то, что уже есть в браузере (и переносим это на сервер).
   2) Любое изменение этих настроек на странице через ~1 с сохраняется на сервер (свои у каждого пользователя).
   Ключи ИИ (API) на сервер не уходят и при загрузке не затираются. */
(function () {
  'use strict';
  var S = window.KB_SRV; if (!S || !S.keys) return;
  var KEYS = S.keys, AI = 'kb-ai-cfg-v1', ls;
  try { ls = window.localStorage; ls.getItem('x'); } catch (e) { return; }
  var setI = Storage.prototype.setItem, remI = Storage.prototype.removeItem;
  function has(o) { return o && typeof o === 'object' && Object.keys(o).length > 0; }
  function apply(src) {
    KEYS.forEach(function (k) {
      var v = src[k];
      if (k === AI) {
        var mine = {}; try { mine = JSON.parse(ls.getItem(AI) || '{}') || {}; } catch (e) {}
        if (v == null) return;
        try { var c = JSON.parse(v); c.keys = mine.keys || {}; v = JSON.stringify(c); } catch (e) { return; }
      }
      if (v == null) remI.call(ls, k); else setI.call(ls, k, String(v));
    });
  }
  function collect() {
    var o = {};
    KEYS.forEach(function (k) {
      var v = ls.getItem(k); if (v == null) return;
      if (k === AI) { try { var c = JSON.parse(v); delete c.keys; v = JSON.stringify(c); } catch (e) { return; } }
      o[k] = v;
    });
    return o;
  }
  function post(action, items, keepalive) {
    return fetch('settings.php?action=' + action + '&sessid=' + encodeURIComponent(S.sessid), {
      method: 'POST', credentials: 'same-origin', keepalive: !!keepalive,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items || {} })
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || ('ошибка ' + r.status)); return j; }); });
  }

  /* 1. старт */
  var hadLocal = KEYS.some(function (k) { return ls.getItem(k) != null; }), pushLocal = false;
  if (has(S.user)) apply(S.user);
  else if (hadLocal) pushLocal = true;          /* свои настройки из этого браузера → на сервер */
  else if (has(S.def)) apply(S.def);

  /* 2. автосохранение */
  var timer = null, dirty = false, status = 'ok';
  function save(now) {
    clearTimeout(timer);
    var run = function () {
      if (!dirty) return; dirty = false;
      post('save', collect(), now).then(function () { status = 'ok'; }, function (e) { status = e.message; dirty = true; if (window.console) console.warn('[настройки] не сохранились:', e.message); });
    };
    if (now) run(); else timer = setTimeout(run, 1000);
  }
  function touched(k) { if (KEYS.indexOf(k) > -1) { dirty = true; save(false); } }
  Storage.prototype.setItem = function (k, v) { setI.call(this, k, v); if (this === ls) touched(k); };
  Storage.prototype.removeItem = function (k) { remI.call(this, k); if (this === ls) touched(k); };
  window.addEventListener('pagehide', function () { if (dirty) save(true); });
  if (pushLocal) { dirty = true; save(false); }

  window.KBSettings = {
    server: true, admin: !!S.admin,
    status: function () { return status; },
    saveNow: function () { dirty = true; clearTimeout(timer); dirty = false; return post('save', collect()); },
    reset: function () { clearTimeout(timer); dirty = false; return post('reset').then(function () { KEYS.forEach(function (k) { if (k !== AI) remI.call(ls, k); }); if (has(S.def)) apply(S.def); }); },
    saveDefault: function () { return post('save_default', collect()); },
    clearDefault: function () { return post('clear_default'); },
    hasDefault: function () { return has(S.def); }
  };
})();
