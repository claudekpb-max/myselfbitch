/* /manager_new/ — рабочая копия менеджера на боевом сайте.
   База общая с /manager/: всё, что создаётся и меняется здесь, видно и в рабочем менеджере.
   Этот скрипт только (1) оставляет навигацию внутри копии: ссылки /manager/… → /manager_new/…,
   и (2) показывает плашку, что открыта копия. Файлы /manager/ он не трогает. */
(function () {
  'use strict';
  var BASE = '/manager_new/', OLD = '/manager/';
  function fixLinks(root) {
    [].forEach.call((root || document).querySelectorAll('a[href^="' + OLD + '"],form[action^="' + OLD + '"]'), function (el) {
      if (el.hasAttribute('data-kb-keep')) return;
      var attr = el.tagName === 'FORM' ? 'action' : 'href', v = el.getAttribute(attr);
      if (el.tagName === 'FORM' && el.querySelector('[name="AUTH_FORM"]')) return; /* вход оставляем как есть */
      el.setAttribute(attr, BASE + v.slice(OLD.length));
    });
  }
  function banner() {
    if (document.getElementById('kb-new-banner') || !document.body) return;
    var b = document.createElement('div'); b.id = 'kb-new-banner';
    b.innerHTML = 'Новый менеджер <b>/manager_new/</b> · данные общие с рабочим · <a href="/manager/" data-kb-keep style="color:inherit;text-decoration:underline">открыть рабочий</a>';
    b.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99998;background:#c96442;color:#fff;font:12.5px/1.4 system-ui,sans-serif;padding:4px 14px;border-radius:0 0 10px 10px;box-shadow:0 4px 12px rgba(0,0,0,.15);white-space:nowrap;max-width:96vw;overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(b);
  }
  function start() {
    fixLinks(); banner();
    if (window.MutationObserver) new MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) fixLinks(n.parentNode || n); }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
