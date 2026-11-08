// Смоук-тест прототипа manager_new: node tests/smoke.js [base_url]
// Проверяет каждую страницу на десктопе и телефоне: ошибки JS, битые ресурсы,
// горизонтальный скролл и все интерактивные элементы.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/prototype/';
const results = [];
const ok = (page, name) => results.push({ page, name, ok: true });
const bad = (page, name, msg) => results.push({ page, name, ok: false, msg });

async function check(page, label, name, fn) {
  try { await fn(); ok(label, name); } catch (e) { bad(label, name, (e.message || String(e)).split('\n')[0]); }
}
function assert(c, m) { if (!c) throw new Error(m); }

async function openPage(ctx, path) {
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // /local/templates/... и /bitrix/... есть только на боевом сайте — их 404 в прототипе не считаем
  const serverOnly = u => /\/(local|bitrix)\//.test(new URL(u).pathname);
  page.on('requestfailed', r => { if (!serverOnly(r.url())) failed.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400 && !serverOnly(r.url())) failed.push(r.status() + ' ' + r.url()); });
  page.on('console', m => { if (m.type() === 'error' && /Failed to load resource/.test(m.text())) errors.pop(); });
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { page, errors, failed };
}

async function common(label, p) {
  await check(p.page, label, 'нет JS-ошибок', async () => assert(p.errors.length === 0, p.errors.join(' | ')));
  await check(p.page, label, 'все ресурсы загрузились', async () => assert(p.failed.length === 0, p.failed.join(' | ')));
  await check(p.page, label, 'нет горизонтальной прокрутки', async () => {
    const w = await p.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert(w[0] <= w[1] + 1, `scrollWidth ${w[0]} > ${w[1]}`);
  });
  await check(p.page, label, 'картинки не битые', async () => {
    const broken = await p.page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(0, 80)));
    assert(broken.length === 0, broken.join(', '));
  });
  await check(p.page, label, 'внутренние ссылки на файлы существуют', async () => {
    const hrefs = await p.page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))
      .filter(h => h && !h.startsWith('#') && !h.startsWith('tel:') && !h.startsWith('mailto:') && !h.startsWith('/') && !/^https?:/.test(h)));
    for (const h of [...new Set(hrefs)]) {
      const r = await p.page.request.get(new URL(h, p.page.url()).href);
      assert(r.ok(), `${h} → ${r.status()}`);
    }
  });
  await check(p.page, label, 'нет ссылок на внешний сервер сборки', async () => {
    const ext = await p.page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => /aquabara|\/home\//.test(h)));
    assert(ext.length === 0, ext.join(', '));
  });
}

async function themeToggle(label, page, selector) {
  await check(page, label, 'переключение темы и запоминание', async () => {
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.locator(selector).first().click();
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(before !== after, `тема не сменилась (${before})`);
    await page.reload(); await page.waitForTimeout(200);
    const kept = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(kept === after, `после перезагрузки ${kept}, ожидали ${after}`);
    await page.locator(selector).first().click(); await page.waitForTimeout(450);
  });
}

async function testMain(ctx, label) {
  const p = await openPage(ctx, 'manager-claude.html');
  const { page } = p;
  await common(label, p);
  await check(page, label, 'приветствие по времени суток', async () => {
    const t = await page.textContent('#greet'); assert(/^(Доброй ночи|Доброе утро|Добрый день|Добрый вечер), Анна$/.test(t), t);
  });
  const visibleToggle = async () => {
    const all = page.locator('[data-theme-toggle]');
    for (let i = 0; i < await all.count(); i++) if (await all.nth(i).isVisible()) return all.nth(i);
    throw new Error('нет видимого переключателя темы');
  };
  await check(page, label, 'переключение темы и запоминание', async () => {
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await (await visibleToggle()).click(); await page.waitForTimeout(450);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(before !== after, 'тема не сменилась');
    await page.reload(); await page.waitForTimeout(200);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === after, 'тема не сохранилась');
    await (await visibleToggle()).click(); await page.waitForTimeout(450);
  });
  await check(page, label, 'палитра Ctrl+K открывается, фильтрует, Esc закрывает', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#pal.open', { timeout: 1000 });
    await page.keyboard.type('пред');
    const vis = await page.$$eval('#pal .g a', as => as.filter(a => a.style.display !== 'none').length);
    assert(vis > 0, 'фильтр ничего не нашёл по «пред»');
    await page.keyboard.press('Escape');
    assert(!(await page.$('#pal.open')), 'не закрылась по Esc');
  });
  await check(page, label, 'кнопка поиска открывает палитру', async () => {
    const btns = page.locator('[data-pal]');
    let clicked = false;
    for (let i = 0; i < await btns.count(); i++) if (await btns.nth(i).isVisible()) { await btns.nth(i).click(); clicked = true; break; }
    assert(clicked, 'нет видимой кнопки поиска');
    await page.waitForSelector('#pal.open', { timeout: 1000 });
    await page.mouse.click(5, 5);
    assert(!(await page.$('#pal.open')), 'не закрылась кликом по фону');
  });
  await check(page, label, 'сегменты фильтра таблицы переключаются', async () => {
    const seg = page.locator('.seg button');
    if (await seg.count() < 2) return;
    await seg.nth(1).click();
    assert(await seg.nth(1).evaluate(b => b.classList.contains('on')), 'сегмент не активировался');
    await seg.nth(0).click();
  });
  await check(page, label, 'клик по строке КП открывает шторку с данными строки', async () => {
    const row = page.locator('tbody tr[data-kp]').nth(1);
    const no = await row.getAttribute('data-kp');
    const cl = await row.evaluate(r => r.dataset.client);
    await row.locator('td').first().click();
    await page.waitForSelector('#drawer.open', { timeout: 1000 });
    assert((await page.textContent('#d-no')).includes(no), 'номер КП не тот');
    const shown = await page.textContent('#d-cl');
    assert(!/&laquo;|&raquo;/.test(shown), 'в имени клиента сырые HTML-сущности: ' + shown);
    assert(shown.replace(/[«»]/g, '') === cl.replace(/[«»]/g, '').replace(/&laquo;|&raquo;/g, ''), `клиент «${shown}» ≠ «${cl}»`);
    await page.keyboard.press('Escape');
    assert(!(await page.$('#drawer.open')), 'шторка не закрылась по Esc');
  });
  await check(page, label, 'кнопка «В МАКС» открывает окно с текстом и ссылкой', async () => {
    const btn = page.locator('tbody tr[data-kp] [data-max]').first();
    await btn.click();
    await page.waitForSelector('#maxModal.open', { timeout: 1000 });
    assert(!(await page.$('#drawer.open')), 'вместе с окном открылась и шторка');
    const txt = await page.inputValue('#mm-text');
    assert(/https:\/\/kupibas\.ru\/kp\/[a-z0-9]{6}/.test(txt), 'нет ссылки в сообщении');
    await page.locator('#maxModal [data-copy]').first().click();
    await page.waitForSelector('#toast.show', { timeout: 1000 });
    assert(!(await page.$('#maxModal.open')), 'окно не закрылось после копирования');
  });
  await check(page, label, 'из шторки можно открыть окно МАКС', async () => {
    const op = page.locator('[data-open-kp]');
    let clicked = false;
    for (let i = 0; i < await op.count(); i++) if (await op.nth(i).isVisible()) { await op.nth(i).click(); clicked = true; break; }
    if (!clicked) { await page.locator('tbody tr[data-kp] td').first().click(); }
    await page.waitForSelector('#drawer.open', { timeout: 1000 });
    await page.locator('#drawer [data-max-from-drawer]').click();
    await page.waitForSelector('#maxModal.open', { timeout: 1000 });
    await page.locator('#maxModal [data-close]').first().click();
    assert(!(await page.$('#maxModal.open')), 'окно не закрылось крестиком');
  });
  await check(page, label, 'переключение экрана «Вход» и обратно', async () => {
    await page.locator('.proto button[data-s="s-auth"]').click();
    assert(await page.locator('#s-auth').isVisible(), 'экран входа не показан');
    assert(!(await page.locator('#s-dash').isVisible()), 'рабочий стол не скрылся');
    await page.locator('.proto button[data-s="s-dash"]').click();
    assert(await page.locator('#s-dash').isVisible(), 'не вернулись на рабочий стол');
  });
  await check(page, label, 'ссылка на КП ведёт на kp.html', async () => {
    const a = page.locator('a[href$="kp.html"]').first();
    assert(await a.count() > 0, 'нет ссылки на kp.html');
  });
  await page.close();
}

async function testIndex(ctx, label) {
  const p = await openPage(ctx, 'index.html');
  const { page } = p;
  await common(label, p);
  await check(page, label, 'курсы превращены в пилюли', async () => {
    const n = await page.$$eval('.offers-rate .rate', x => x.length); assert(n === 2, `пилюль: ${n}`);
  });
  await themeToggle(label, page, '.k-theme');
  await check(page, label, 'палитра Ctrl+K и Enter переходит по первой ссылке', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.k-palette-wrap.open', { timeout: 1000 });
    await page.keyboard.type('предлож');
    const vis = await page.$$eval('.k-palette-wrap .grp a', as => as.filter(a => a.style.display !== 'none').length);
    assert(vis > 0, 'фильтр ничего не нашёл');
    await page.keyboard.press('Escape');
    assert(!(await page.$('.k-palette-wrap.open')), 'не закрылась по Esc');
  });
  await check(page, label, 'кнопка «Поиск и команды» открывает палитру', async () => {
    await page.locator('[data-k-palette]').click();
    await page.waitForSelector('.k-palette-wrap.open', { timeout: 1000 });
    await page.keyboard.press('Escape');
  });
  await check(page, label, 'Shift+D меняет тему, но не в поле ввода', async () => {
    const a = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.locator('body').click({ position: { x: 3, y: 3 } });
    await page.keyboard.press('Shift+D'); await page.waitForTimeout(400);
    const b = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(a !== b, 'Shift+D не сработал');
    await page.keyboard.press('Shift+D'); await page.waitForTimeout(400);
  });
  await check(page, label, 'переключатель экранов прототипа', async () => {
    await page.locator('.proto-switch a', { hasText: 'Вход' }).click();
    assert(await page.locator('.bx-authform').isVisible(), 'форма входа не показана');
    await page.locator('.proto-switch a', { hasText: 'Рабочий стол' }).click();
    assert(await page.locator('.k-bento').isVisible(), 'рабочий стол не вернулся');
  });
  await page.close();
}

async function testKp(ctx, label) {
  const p = await openPage(ctx, 'kp.html');
  const { page } = p;
  await common(label, p);
  await themeToggle(label, page, '#tt');
  await check(page, label, 'группы состава раскрываются', async () => {
    const d = page.locator('details.grp').nth(1);
    await d.locator('summary').click();
    assert(await d.evaluate(x => x.open), 'группа не раскрылась');
  });
  await check(page, label, 'сумма групп = итог', async () => {
    const r = await page.evaluate(() => {
      const n = s => +s.replace(/[^\d]/g, '');
      const groups = [...document.querySelectorAll('.grp summary .s')].map(x => n(x.textContent));
      const items = [...document.querySelectorAll('.grp')].map(g => [...g.querySelectorAll('.it .p')].reduce((a, x) => a + n(x.textContent), 0));
      const total = n(document.querySelector('.total .v').textContent);
      const eco = document.querySelector('.total .eco'); const disc = eco ? n(eco.textContent) : 0;
      const bar = n(document.querySelector('.bar .sum b').textContent);
      return { groups, items, total, bar, disc };
    });
    r.groups.forEach((g, i) => assert(g === r.items[i], `группа ${i + 1}: ${g} ≠ сумма позиций ${r.items[i]}`));
    const sum = r.groups.reduce((a, b) => a + b, 0);
    assert(sum - r.disc === r.total, `сумма групп ${sum} − скидка ${r.disc} ≠ итог ${r.total}`);
    assert(r.bar === r.total, `итог в панели ${r.bar} ≠ ${r.total}`);
  });
  await check(page, label, '«Принять» открывает подтверждение, «Закрыть» закрывает', async () => {
    await page.locator('[data-accept]').click();
    await page.waitForSelector('#o-acc.open', { timeout: 1000 });
    await page.locator('#o-acc [data-x]').click();
    assert(!(await page.$('#o-acc.open')), 'не закрылось');
  });
  await check(page, label, '«Вопрос» → «Отправить» показывает «Вопрос отправлен»', async () => {
    await page.locator('.bar [data-ask]').click();
    await page.waitForSelector('#o-ask.open', { timeout: 1000 });
    await page.fill('#o-ask textarea', 'Можно другой цвет?');
    await page.locator('#o-ask [data-sent]').click();
    await page.waitForSelector('#o-acc.open', { timeout: 1000 });
    assert((await page.textContent('#o-acc h3')) === 'Вопрос отправлен', 'заголовок не сменился');
    await page.locator('#o-acc [data-x]').click();
  });
  await check(page, label, 'после вопроса «Принять» снова показывает «Спасибо»', async () => {
    await page.locator('[data-accept]').click();
    await page.waitForSelector('#o-acc.open', { timeout: 1000 });
    const h = await page.textContent('#o-acc h3');
    assert(/Спасибо/.test(h), `заголовок остался «${h}»`);
    await page.keyboard.press('Escape');
    assert(!(await page.$('#o-acc.open')), 'окно не закрывается по Esc');
  });
  await check(page, label, 'кнопка PDF что-то делает', async () => {
    const href = await page.locator('.bar a.pdf').getAttribute('href');
    const onclick = await page.locator('.bar a.pdf').evaluate(a => a.hasAttribute('data-print') || !!a.onclick);
    assert(href !== '#' || onclick, 'PDF — пустая ссылка href="#"');
  });
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  const configs = [
    ['десктоп', { viewport: { width: 1366, height: 860 } }],
    ['телефон', { ...devices['iPhone 13'] }],
  ];
  for (const [dev, opts] of configs) {
    const ctx = await browser.newContext({ ...opts, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(() => { window.open = () => null; });
    await testMain(ctx, `главная (manager-claude.html) · ${dev}`);
    await testIndex(ctx, `слой Битрикса (index.html) · ${dev}`);
    await testKp(ctx, `КП клиента (kp.html) · ${dev}`);
    await ctx.close();
  }
  await browser.close();
  let cur = '';
  for (const r of results) {
    if (r.page !== cur) { cur = r.page; console.log('\n## ' + cur); }
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : ' — ' + r.msg));
  }
  const f = results.filter(r => !r.ok).length;
  console.log(`\nИтого: ${results.length - f} ок, ${f} ошибок`);
  process.exit(f ? 1 : 0);
})();
