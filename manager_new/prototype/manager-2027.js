/* Kupibas · Manager 2027 — тема + командная палитра. Без зависимостей. */
(function () {
  var root = document.documentElement, KEY = 'kupibas-mgr-theme';
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  root.setAttribute('data-theme', saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  function setTheme(t) {
    root.classList.add('k-theming');
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    setTimeout(function () { root.classList.remove('k-theming'); }, 350);
  }
  function toggle() { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }

  document.addEventListener('DOMContentLoaded', function () {
    var logo = document.querySelector('.logo');

    // Курсы: «Курс евро/руб.: <b>93.57</b>» → компактные пилюли
    var rate = document.querySelector('.offers-rate');
    if (rate && !rate.querySelector('.rate')) {
      var bs = rate.querySelectorAll(':scope > b'), labels = ['€', '$'], html = '';
      bs.forEach(function (b, i) { html += '<span class="rate">' + labels[i] + ' <b>' + (+b.textContent).toFixed(2) + '</b></span>'; });
      var portal = rate.querySelector('#js-offer-id-portal');
      rate.innerHTML = html; if (portal) rate.appendChild(portal);
    }

    // Панель инструментов: поиск ⌘K + переключатель темы
    if (logo && !document.querySelector('.k-tools')) {
      var tools = document.createElement('div');
      tools.className = 'k-tools';
      tools.innerHTML =
        '<button class="k-kbd" type="button" data-k-palette>Поиск и команды <kbd>⌘K</kbd></button>' +
        '<button class="k-theme" type="button" aria-label="Сменить тему" title="Светлая / тёмная">' +
        '<svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
        '<svg class="moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>';
      logo.insertBefore(tools, logo.firstChild);
      tools.querySelector('.k-theme').addEventListener('click', toggle);
    }

    // Командная палитра — пункты берём из меню + действия
    var wrap = document.createElement('div');
    wrap.className = 'k-palette-wrap';
    var items = '';
    document.querySelectorAll('.menu a').forEach(function (a) { items += '<a href="' + a.getAttribute('href') + '">' + a.textContent.trim() + '<span>Перейти</span></a>'; });
    wrap.innerHTML = '<div class="k-palette"><input placeholder="Номер предложения, клиент, товар или команда…">' +
      '<div class="grp"><div class="grp-t">Навигация</div>' + items + '</div>' +
      '<div class="grp"><div class="grp-t">Действия</div><a href="#" data-k-theme>Сменить тему<span>⇧D</span></a></div></div>';
    document.body.appendChild(wrap);
    var input = wrap.querySelector('input');
    function open() { wrap.classList.add('open'); input.value = ''; filter(); setTimeout(function () { input.focus(); }, 10); }
    function close() { wrap.classList.remove('open'); }
    function filter() {
      var q = input.value.toLowerCase();
      wrap.querySelectorAll('.grp a').forEach(function (a) { a.style.display = a.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; });
    }
    input.addEventListener('input', filter);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = [].find.call(wrap.querySelectorAll('.grp a'), function (a) { return a.style.display !== 'none'; });
        if (first) first.click();
      }
    });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('[data-k-theme]').addEventListener('click', function (e) { e.preventDefault(); toggle(); close(); });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-k-palette]')) open(); });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); wrap.classList.contains('open') ? close() : open(); }
      else if (e.key === 'Escape') close();
      else if (e.shiftKey && e.key === 'D' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) toggle();
    });
  });
})();
