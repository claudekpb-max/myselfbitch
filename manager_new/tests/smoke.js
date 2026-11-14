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

async function testMainExtra(ctx, label) {
  const p = await openPage(ctx, 'manager-claude.html');
  const { page } = p;
  await check(page, label, 'фильтр «Мои» и «Ждут ответа» реально фильтрует', async () => {
    await page.click('#flt [data-f="my"]');
    let vis = await page.$$eval('tbody tr[data-kp]:not(.hide)', r => r.length); assert(vis === 2, `Мои: ${vis}`);
    await page.click('#flt [data-f="wait"]');
    vis = await page.$$eval('tbody tr[data-kp]:not(.hide)', r => r.length); assert(vis === 2, `Ждут ответа: ${vis}`);
    await page.click('#flt [data-f="all"]');
    vis = await page.$$eval('tbody tr[data-kp]:not(.hide)', r => r.length); assert(vis === 5, `Все: ${vis}`);
  });
  await check(page, label, 'счётчик задач меняется', async () => {
    const before = await page.textContent('#task-cnt');
    await page.locator('.task').first().click();
    const after = await page.textContent('#task-cnt');
    assert(before !== after, `${before} → ${after}`);
  });
  await check(page, label, '«Позже» скрывает подсказку', async () => {
    const n = await page.$$eval('.tip:not(.gone)', x => x.length);
    await page.locator('[data-later]').first().click();
    const m = await page.$$eval('.tip:not(.gone)', x => x.length);
    assert(m === n - 1, `${n} → ${m}`);
  });
  await check(page, label, 'кнопка копирования в строке не открывает шторку', async () => {
    await page.locator('tbody tr[data-kp] [data-row-copy]').first().click({ force: true });
    await page.waitForSelector('#toast.show', { timeout: 1000 });
    assert(!(await page.$('#drawer.open')), 'открылась шторка');
  });
  await check(page, label, 'композер: номер КП открывает шторку', async () => {
    await page.fill('.composer textarea', 'КП 2418');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#drawer.open', { timeout: 1000 });
    assert((await page.textContent('#d-no')).includes('2418'), 'не та шторка');
    await page.keyboard.press('Escape');
  });
  await check(page, label, 'композер: «керамогранит перелив» ведёт в конструктор с нужным шаблоном', async () => {
    await page.fill('.composer textarea', 'бассейн керамогранит переливной 10 на 4');
    await Promise.all([page.waitForURL(/offer\.html\?tpl=tile-ovf/), page.keyboard.press('Enter')]);
    await page.goBack(); await page.waitForTimeout(200);
  });
  await check(page, label, '«Новое предложение» ведёт в конструктор', async () => {
    const href = await page.locator('.new-btn').getAttribute('href'); assert(href === 'offer.html', href);
  });
  await page.close();
}

async function testOffer(ctx, label) {
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('kb-test-clean')) { localStorage.removeItem('kb-offer-draft-v1'); localStorage.removeItem('kb-works-v1'); localStorage.removeItem('kb-cat-accepted-v1'); localStorage.setItem('kb-test-clean', '1'); } } catch (e) {} });
  const p = await openPage(ctx, 'offer.html');
  const { page } = p;
  await common(label, p);
  const total = () => page.evaluate(() => +document.querySelector('#tot').textContent.replace(/[^\d]/g, ''));
  await check(page, label, '8 вкладок шаблонов с правильными названиями', async () => {
    const names = await page.$$eval('#tabs button', b => b.map(x => x.textContent.replace(/^\d+/, '').trim()));
    const want = ['Фарол', 'Франмер', 'Маршал', 'Бетон плёнка бюджет', 'Бетон плёнка 3D', 'Бетон керамогранит скиммерный', 'Керамогранит переливной', 'Биодизайн'];
    assert(JSON.stringify(names) === JSON.stringify(want), names.join(', '));
  });
  await check(page, label, 'каждый шаблон применяется и даёт ненулевой итог', async () => {
    const n = await page.locator('#tabs button').count();
    for (let i = 0; i < n; i++) {
      const b = page.locator('#tabs button').nth(i);
      if (await b.evaluate(x => x.classList.contains('on'))) continue;
      await b.click(); await page.waitForSelector('#m-confirm.open', { timeout: 1000 });
      await page.click('#confirm-ok');
      assert(await b.evaluate(x => x.classList.contains('on')), 'вкладка не активна');
      const t = await total(); assert(t > 100000, `итог ${t} у шаблона ${i + 1}`);
      const rows = await page.$$eval('tr[data-row]', r => r.length); assert(rows >= 8, `позиций ${rows}`);
    }
  });
  await check(page, label, 'отмена смены шаблона ничего не меняет', async () => {
    const t0 = await total();
    await page.locator('#tabs button').first().click(); await page.waitForSelector('#m-confirm.open');
    await page.locator('#m-confirm [data-close]').last().click();
    assert(await total() === t0, 'итог изменился');
  });
  await check(page, label, 'размеры пересчитывают количества и итог', async () => {
    await page.locator('#tabs button', { hasText: 'Бетон плёнка бюджет' }).click(); await page.click('#confirm-ok');
    const t0 = await total();
    await page.fill('#f-L', '10'); await page.waitForTimeout(100);
    const t1 = await total(); assert(t1 > t0, `${t0} → ${t1}`);
    const s = await page.textContent('#metrics'); assert(/40 м²/.test(s), 'зеркало не 40 м²: ' + s);
  });
  await check(page, label, 'сумма разделов = итог; скидка считается', async () => {
    const r = await page.evaluate(() => { const n = s => +s.replace(/[^\d]/g, ''); const secs = [...document.querySelectorAll('.sec .sum')].map(x => n(x.textContent)); return { secs, tot: n(document.querySelector('#tot').textContent) }; });
    const sum = r.secs.reduce((a, b) => a + b, 0); assert(sum === r.tot, `${sum} ≠ ${r.tot}`);
    await page.fill('#f-disc', '10'); await page.waitForTimeout(50);
    const t = await total(); assert(Math.abs(t - Math.round(sum * 0.9)) <= 1, `со скидкой ${t}, ожидали ${Math.round(sum * 0.9)}`);
    await page.fill('#f-disc', '0');
  });
  await check(page, label, 'ручное количество и возврат к формуле', async () => {
    const q = page.locator('[data-qty]').first();
    await q.fill('3'); await q.press('Tab');
    assert(await page.locator('[data-q-reset]').count() >= 1, 'нет кнопки «вернуть»');
    await page.locator('[data-q-reset]').first().click();
    assert(await page.locator('[data-q-reset]').count() === 0, 'кнопка не исчезла');
  });
  await check(page, label, 'добавление товара из каталога поиском и Enter', async () => {
    const n0 = await page.$$eval('tr[data-row]', r => r.length);
    await page.locator('[data-add="extra"][data-kind="cat"]').click();
    await page.waitForSelector('#m-pick.open');
    await page.fill('#pick-q', 'химии на сезон');
    await page.keyboard.press('Enter');
    const n1 = await page.$$eval('tr[data-row]', r => r.length); assert(n1 === n0 + 1, `${n0} → ${n1}`);
    assert(await page.locator('.sec[data-sec="extra"] tr[data-row]').count() === 1, 'не в разделе «Дополнительно»');
  });
  await check(page, label, 'удаление позиции и отмена Ctrl+Z', async () => {
    const n0 = await page.$$eval('tr[data-row]', r => r.length);
    await page.locator('[data-del]').last().click();
    assert(await page.$$eval('tr[data-row]', r => r.length) === n0 - 1, 'не удалилось');
    await page.locator('body').click({ position: { x: 2, y: 300 } });
    await page.keyboard.press('Control+z');
    assert(await page.$$eval('tr[data-row]', r => r.length) === n0, 'не вернулось');
  });
  await check(page, label, 'сверка с 1С отмечает расхождения и принимает цену', async () => {
    await page.locator('#tabs button', { hasText: 'Бетон керамогранит скиммерный' }).click(); await page.click('#confirm-ok');
    await page.click('#btn-1c');
    await page.waitForSelector('[data-take1c]', { timeout: 3000 });
    const n = await page.locator('[data-take1c]').count(); assert(n >= 1, 'нет расхождений');
    await page.locator('#btn-apply1c').click();
    assert(await page.locator('[data-take1c]').count() === 0, 'расхождения остались');
  });
  await check(page, label, 'без клиента сохранить нельзя; с клиентом — черновик переживает перезагрузку', async () => {
    await page.fill('#f-client', '');
    await page.click('#btn-save');
    assert(await page.locator('#f-client.bad').count() === 1, 'нет подсветки поля');
    await page.fill('#f-client', 'Тест Клиентов');
    await page.click('#btn-save');
    const t0 = await total();
    await page.reload(); await page.waitForTimeout(200);
    assert(await page.inputValue('#f-client') === 'Тест Клиентов', 'клиент не восстановился');
    assert(await total() === t0, 'итог не восстановился');
  });
  await check(page, label, 'предпросмотр показывает итог', async () => {
    await page.click('#btn-preview'); await page.waitForSelector('#m-preview.open');
    const pv = await page.textContent('#pv'); const t = await page.textContent('#tot');
    assert(pv.includes(t.trim()), 'итог в предпросмотре не совпадает');
    await page.keyboard.press('Escape');
  });
  await check(page, label, 'модель композитной чаши меняет размеры', async () => {
    await page.locator('#tabs button', { hasText: 'Фарол' }).click(); await page.click('#confirm-ok');
    assert(await page.locator('#f-L').isDisabled(), 'размеры редактируемые');
    await page.selectOption('#f-model', 'FAR-800');
    assert(await page.inputValue('#f-L') === '8', 'длина ' + await page.inputValue('#f-L'));
  });
  await page.close();
}

async function testSprav(ctx, label) {
  const p = await openPage(ctx, 'spravochnik.html');
  const { page } = p;
  await common(label, p);
  await check(page, label, 'изменение расценки сохраняется и подхватывается конструктором', async () => {
    await page.fill('#w-q', 'котлован');
    const inp = page.locator('tr[data-id="w-dig"] [data-f="price"]');
    await inp.fill('1500');
    assert(!(await page.locator('#w-save').isDisabled()), 'кнопка сохранения неактивна');
    await page.click('#w-save');
    assert(await page.locator('#w-save').isDisabled(), 'после сохранения кнопка активна');
    await page.reload(); await page.waitForTimeout(200);
    await page.fill('#w-q', 'котлован');
    assert(await page.locator('tr[data-id="w-dig"] [data-f="price"]').inputValue() === '1500', 'цена не сохранилась');
    const o = await ctx.newPage(); await o.goto(BASE + 'offer.html'); await o.waitForTimeout(200);
    const price = await o.locator('tr[data-row]').filter({ hasText: 'Разработка котлована' }).locator('[data-price]').inputValue();
    assert(price === '1500', 'конструктор взял ' + price); await o.close();
  });
  await check(page, label, 'добавление работы, проверка обязательных полей, удаление', async () => {
    await page.fill('#w-q', '');
    const n0 = await page.locator('tr[data-id]').count();
    await page.click('#w-add');
    await page.click('#w-save');
    assert(await page.locator('[data-f="name"].bad').count() === 1, 'пустое название не подсвечено');
    await page.locator('tr[data-id]').first().locator('[data-f="name"]').fill('Демонтаж старой чаши');
    await page.click('#w-save');
    await page.reload(); await page.waitForTimeout(200);
    assert(await page.locator('tr[data-id]').count() === n0 + 1, 'новая работа не сохранилась');
    await page.locator('tr[data-id]').first().locator('[data-wdel]').click();
    await page.click('#w-save');
    assert(await page.locator('tr[data-id]').count() === n0, 'не удалилась');
  });
  await check(page, label, '«Отменить» возвращает несохранённые правки', async () => {
    const inp = page.locator('tr[data-id="w-out"] [data-f="price"]'); const v0 = await inp.inputValue();
    await inp.fill('999'); await page.click('#w-cancel');
    assert(await page.locator('tr[data-id="w-out"] [data-f="price"]').inputValue() === v0, 'не вернулось');
  });
  await check(page, label, 'каталог: сверка с 1С, фильтр расхождений, принятие цены', async () => {
    await page.click('[data-tab="catalog"]');
    await page.click('#c-reset');
    await page.click('#c-check'); await page.waitForSelector('[data-accept]', { timeout: 3000 });
    await page.check('#c-mis');
    const n = await page.locator('#c-tbl tbody tr.mis').count(); assert(n >= 3, `расхождений ${n}`);
    await page.locator('[data-accept]').first().click();
    assert(await page.locator('#c-tbl tbody tr.mis').count() === n - 1, 'не принялась');
    await page.click('#c-reset');
  });
  await check(page, label, 'ссылка #catalog открывает вкладку каталога', async () => {
    await page.goto(BASE + 'spravochnik.html#catalog'); await page.waitForTimeout(150);
    assert(await page.locator('#p-catalog').isVisible(), 'каталог не открыт');
  });
  await page.close();
}

async function testDash(ctx, label, mobile) {
  const p = await openPage(ctx, 'manager-claude.html');
  const { page } = p;
  await page.evaluate(() => { localStorage.removeItem('kb-dash-v1'); localStorage.removeItem('kb-side-off'); }); await page.reload(); await page.waitForTimeout(300);
  await check(page, label, 'конструктор: 9 блоков, без ошибок', async () => {
    assert(p.errors.length === 0, p.errors.join(' | '));
    const n = await page.$$eval('#dash .grid-stack-item', x => x.length); assert(n === 9, `блоков ${n}`);
  });
  await check(page, label, 'без режима настройки блоки не двигаются', async () => {
    assert(!(await page.locator('.w-handle').first().isVisible()), 'шапка блока видна вне режима настройки');
  });
  await check(page, label, '«Настроить» включает режим, «Готово» выключает', async () => {
    await page.click('[data-dash-edit]');
    assert(await page.locator('#dash.editing').count() === 1, 'режим не включился');
    assert(await page.locator('.w-handle').first().isVisible(), 'нет шапок блоков');
    await page.click('[data-dash-edit]');
    assert(await page.locator('#dash.editing').count() === 0, 'режим не выключился');
  });
  if (!mobile) {
    await check(page, label, 'перетаскивание блока меняет его место и сохраняется', async () => {
      await page.click('[data-dash-edit]');
      const tasks = page.locator('.grid-stack-item[gs-id="tasks"]');
      const before = await tasks.getAttribute('gs-x');
      await tasks.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      const h = await tasks.locator('.w-handle').boundingBox();
      const ai = await page.locator('.grid-stack-item[gs-id="ai"]').boundingBox();
      await page.mouse.move(h.x + 40, h.y + 15); await page.mouse.down();
      await page.mouse.move(h.x - 200, h.y + 20, { steps: 8 }); await page.mouse.move(ai.x + 30, ai.y + 15, { steps: 12 });
      await page.mouse.up(); await page.waitForTimeout(400);
      const after = await tasks.getAttribute('gs-x');
      assert(before !== after, `x: ${before} → ${after}`);
      await page.click('[data-dash-edit]');
      await page.reload(); await page.waitForTimeout(300);
      assert(await page.locator('.grid-stack-item[gs-id="tasks"]').getAttribute('gs-x') === after, 'место не сохранилось');
    });
    await check(page, label, 'изменение размера блока за угол', async () => {
      await page.click('[data-dash-edit]');
      const k = page.locator('.grid-stack-item[gs-id="kpi-offers"]');
      const w0 = +(await k.getAttribute('gs-w'));
      await k.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      const b = await k.boundingBox();
      await page.mouse.move(b.x + b.width - 12, b.y + b.height - 12); await page.mouse.down();
      await page.mouse.move(b.x + b.width + 160, b.y + b.height + 40, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(300);
      const w1 = +(await k.getAttribute('gs-w')); assert(w1 > w0, `ширина ${w0} → ${w1}`);
      await page.click('[data-dash-edit]');
    });
  }
  await check(page, label, 'скрыть блок и вернуть через панель «Блоки»', async () => {
    await page.click('[data-dash-edit]');
    await page.locator('.grid-stack-item[gs-id="kpi-conv"] [data-w-hide]').click();
    assert(await page.locator('.grid-stack-item[gs-id="kpi-conv"]').count() === 0, 'блок не скрылся');
    await page.reload(); await page.waitForTimeout(300);
    assert(await page.locator('.grid-stack-item[gs-id="kpi-conv"]').count() === 0, 'скрытие не сохранилось');
    await page.click('[data-dash-edit]'); await page.click('[data-lib]');
    await page.waitForSelector('#lib.open');
    await page.locator('[data-w-toggle="kpi-conv"]').check();
    assert(await page.locator('.grid-stack-item[gs-id="kpi-conv"]').count() === 1, 'блок не вернулся');
    await page.locator('#lib [data-lib-close]').last().click();
  });
  await check(page, label, '«Сбросить» возвращает исходную раскладку', async () => {
    await page.locator('.dash-tools [data-dash-reset]').click();
    const x = await page.locator('.grid-stack-item[gs-id="tasks"]').getAttribute('gs-x');
    assert(x === (mobile ? '0' : '8'), 'tasks x=' + x);
    await page.click('[data-dash-edit]');
  });
  await check(page, label, 'уменьшенный блок масштабируется, а не обрезается', async () => {
    const r = await page.evaluate(async () => {
      const g = KBDash.grid, el = document.querySelector('.grid-stack-item[gs-id="offers"]');
      g.update(el, { w: g.getColumn() === 1 ? 1 : 5, h: 3 }); await new Promise(r => setTimeout(r, 250)); KBDash.fitAll();
      const out = [...document.querySelectorAll('#dash .w-body')].map(b => ({ id: b.closest('.grid-stack-item').getAttribute('gs-id'), z: +b.dataset.zoom, clip: b.scrollHeight > b.clientHeight + 2 || b.scrollWidth > b.clientWidth + 2 }));
      return { cols: g.getColumn(), out };
    });
    if (r.cols === 1) return;
    const o = r.out.find(x => x.id === 'offers'); assert(o.z < 1, 'масштаб не уменьшился: ' + o.z);
    const clipped = r.out.filter(x => x.clip).map(x => x.id); assert(clipped.length === 0, 'обрезано: ' + clipped.join(','));
    await page.evaluate(() => document.querySelector('.dash-tools [data-dash-reset]').click());
  });
  await check(page, label, 'рабочий стол во всю ширину', async () => {
    const w = await page.evaluate(() => [document.querySelector('#dash').getBoundingClientRect().width, document.querySelector('.main').clientWidth]);
    assert(w[0] >= w[1] - 60, `стол ${w[0]} из ${w[1]}`);
  });
  await check(page, label, 'кнопки внутри блоков работают (фильтр, задачи)', async () => {
    await page.click('#flt [data-f="my"]');
    assert(await page.$$eval('tbody tr[data-kp]:not(.hide)', r => r.length) === 2, 'фильтр');
    await page.click('#flt [data-f="all"]');
  });
  await check(page, label, 'таблица КП: 7 полей по умолчанию, выбор и порядок колонок сохраняются', async () => {
    await page.evaluate(() => localStorage.removeItem('kb-offers-cols-v1')); await page.reload(); await page.waitForTimeout(300);
    let th = await page.$$eval('#offers-tbl th[data-col]', t => t.map(x => x.dataset.col).join(','));
    assert(th === 'no,title,client,mgr,status,date,sum', th);
    await page.locator('[data-cols]').scrollIntoViewIfNeeded(); await page.click('[data-cols]');
    await page.uncheck('[data-col-on="title"]');
    await page.click('[data-col-up="6"]');
    th = await page.$$eval('#offers-tbl th[data-col]', t => t.map(x => x.dataset.col).join(','));
    assert(th === 'no,client,mgr,status,sum,date', th);
    const cells = await page.$$eval('#offers-tbl tbody tr:first-child td', t => t.length); assert(cells === 7, 'ячеек ' + cells);
    await page.reload(); await page.waitForTimeout(300);
    th = await page.$$eval('#offers-tbl th[data-col]', t => t.map(x => x.dataset.col).join(','));
    assert(th === 'no,client,mgr,status,sum,date', 'после перезагрузки ' + th);
    await page.locator('[data-cols]').scrollIntoViewIfNeeded(); await page.click('[data-cols]'); await page.click('[data-cols-reset]'); await page.click('[data-cols-close]');
    assert(await page.locator('#colpick').isHidden(), 'список не закрылся');
  });
  await check(page, label, 'фильтр «Мои» работает и без колонки «Менеджер»', async () => {
    await page.click('[data-cols]'); await page.uncheck('[data-col-on="mgr"]'); await page.click('[data-cols-close]');
    await page.click('#flt [data-f="my"]');
    assert(await page.$$eval('tbody tr[data-kp]:not(.hide)', r => r.length) === 2, 'фильтр');
    await page.click('#flt [data-f="all"]'); await page.click('[data-cols]'); await page.click('[data-cols-reset]'); await page.click('[data-cols-close]');
  });
  await check(page, label, 'левая панель выезжает и прячется', async () => {
    if (mobile) {
      await page.click('[data-menu]'); assert(await page.locator('.side.m-open').isVisible(), 'меню не открылось');
      await page.click('#side-ovl', { position: { x: 350, y: 300 } }); assert(await page.locator('.side.m-open').count() === 0, 'меню не закрылось');
    } else {
      await page.click('[data-collapse]'); await page.waitForTimeout(350);
      assert(await page.locator('#s-dash.side-off').count() === 1, 'панель не спряталась');
      await page.click('[data-menu]'); await page.waitForTimeout(350);
      assert(await page.locator('#s-dash.side-off').count() === 0, 'панель не вернулась');
    }
  });
  await check(page, label, 'нет горизонтальной прокрутки', async () => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert(w[0] <= w[1] + 1, w.join('>'));
  });
  await page.close();
}

async function testAI(ctx, label) {
  const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  const json = (r, status, body) => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: H }) : r.fulfill({ status, contentType: 'application/json', headers: H, body: JSON.stringify(body) });
  let claudeReq = null;
  await ctx.route('https://api.anthropic.com/**', r => { if (r.request().method() !== 'OPTIONS') claudeReq = JSON.parse(r.request().postData());
    return json(r, 200, { id: 'msg_t', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: '{"reply":"Правлю КП","action":{"type":"edit_offer","disc":3,"add":[{"ref":"LED-RGB","qty":2}]}}' }] }); });
  await ctx.route('https://api.openai.com/v1/chat/completions', r => json(r, 200, { choices: [{ message: { content: '{"reply":"Фото","action":{"type":"image","prompt":"pool"}}' } }] }));
  await ctx.route('https://api.openai.com/v1/images/generations', r => json(r, 200, { data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }] }));
  await ctx.route('https://api.deepseek.com/**', r => json(r, 401, { error: { message: 'bad key' } }));
  const p = await openPage(ctx, 'manager-claude.html');
  const { page } = p;
  await page.evaluate(() => { ['kb-ai-cfg-v1', 'kb-ai-chat-v1', 'kb-offer-draft-v1', 'kb-dash-v1'].forEach(k => localStorage.removeItem(k)); }); await page.reload(); await page.waitForTimeout(300);
  const idle = () => page.waitForFunction(() => !document.querySelector('#aiw').classList.contains('busy'), null, { timeout: 15000 });
  const last = () => page.$eval('#ai-log .aiw-m:last-child', e => e.innerText);
  await check(page, label, 'блок ИИ на месте, без ключа — демо-режим', async () => {
    assert(await page.locator('#aiw').isVisible(), 'нет блока');
    assert((await page.$eval('#ai-st', e => e.textContent)).includes('демо'), 'статус');
    assert((await page.$$eval('#ai-prov option', o => o.map(x => x.textContent).join(','))) === 'Claude,ChatGPT,DeepSeek', 'провайдеры');
  });
  await check(page, label, 'демо: «КП Франмер 8×4 … скидка 5%» → карточка КП → конструктор', async () => {
    await page.fill('#ai-in', 'КП Франмер 8×4 для Ирины Беловой, скидка 5%'); await page.press('#ai-in', 'Enter');
    assert((await last()).includes('Франмер · 8×4 м'), await last());
    await page.locator('#ai-log [data-ai-open]').last().click(); await page.waitForURL(/offer\.html/); await page.waitForTimeout(300);
    const d = await page.evaluate(() => JSON.parse(localStorage.getItem('kb-offer-draft-v1')).st);
    assert(d.tpl === 'franmer' && d.L === 8 && d.W === 4 && d.disc === 5, JSON.stringify([d.tpl, d.L, d.W, d.disc]));
    assert((await page.$eval('#f-client', e => e.value)).includes('Белов'), 'клиент');
    await page.goto(BASE + 'manager-claude.html'); await page.waitForTimeout(200);
  });
  await check(page, label, 'схема бассейна рисуется и скачивается', async () => {
    await page.fill('#ai-in', 'нарисуй схему 10×4×1,6 с переливом'); await page.click('[data-ai-send]');
    const w = await page.$eval('#ai-log .aiw-m:last-child .aiw-fig img', i => i.naturalWidth); assert(w > 100, 'ширина ' + w);
    const dl = page.waitForEvent('download'); await page.locator('#ai-log .aiw-m:last-child [data-ai-dl]').click(); assert((await dl).suggestedFilename().endsWith('.svg'), 'файл');
  });
  await check(page, label, 'настройки: ключи сохраняются, панель закрывается', async () => {
    await page.click('[data-ai-cfg]'); await page.fill('#ai-key-claude', 'sk-ant-test'); await page.fill('#ai-key-openai', 'sk-test'); await page.fill('#ai-key-deepseek', 'sk-ds'); await page.click('[data-ai-save]');
    assert(!(await page.locator('#ai-cfg').isVisible()), 'панель не закрылась');
    assert((await page.$eval('#ai-st', e => e.textContent)) === 'claude-opus-5-5', 'модель по умолчанию');
  });
  await check(page, label, 'Claude: запрос через SDK, правка КП применяется в конструкторе', async () => {
    await page.fill('#ai-in', 'добавь две подсветки и скидку 3%'); await page.click('[data-ai-send]'); await idle();
    assert(claudeReq && claudeReq.model === 'claude-opus-5-5' && claudeReq.fallbacks === 'default' && claudeReq.system.includes('FRM-840'), 'тело запроса');
    assert((await last()).includes('Правка КП'), await last());
    await page.locator('#ai-log [data-ai-open]').last().click(); await page.waitForURL(/offer\.html/); await page.waitForTimeout(300);
    const d = await page.evaluate(() => JSON.parse(localStorage.getItem('kb-offer-draft-v1')).st);
    const led = d.rows.filter(r => r.ref === 'LED-RGB').map(r => r.qty);
    assert(d.tpl === 'franmer' && d.disc === 3 && led.length === 1 && led[0] === 5, JSON.stringify([d.tpl, d.disc, led]));
    await page.goto(BASE + 'manager-claude.html'); await page.waitForTimeout(200);
  });
  await check(page, label, 'ChatGPT: фото генерируется', async () => {
    await page.selectOption('#ai-prov', 'openai'); await page.fill('#ai-in', 'фото бассейна у дома'); await page.click('[data-ai-send]'); await idle();
    assert((await page.$eval('#ai-log .aiw-m:last-child img', i => i.src)).startsWith('data:image/png'), 'нет фото');
  });
  await check(page, label, 'DeepSeek: понятная ошибка при неверном ключе', async () => {
    await page.selectOption('#ai-prov', 'deepseek'); await page.fill('#ai-in', 'привет'); await page.click('[data-ai-send]'); await idle();
    assert((await last()).includes('неверный API-ключ'), await last());
  });
  await check(page, label, 'диктовка: кнопка микрофона отвечает', async () => {
    await page.click('[data-ai-mic]'); await page.waitForTimeout(200);
    const t = await page.$eval('#toast span', e => e.textContent); assert(/Говорите|не поддерживается|микрофон/.test(t), t);
    await page.evaluate(() => { const b = document.querySelector('#aiw'); if (b.classList.contains('rec')) b.querySelector('[data-ai-mic]').click(); });
  });
  await check(page, label, 'нет горизонтальной прокрутки', async () => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert(w[0] <= w[1] + 1, w.join('>'));
  });
  await check(page, label, 'ИИ в конструкторе КП: панель открывается, правка сразу применяется', async () => {
    await page.evaluate(() => ['kb-ai-cfg-v1', 'kb-ai-chat-offer-v1', 'kb-offer-draft-v1'].forEach(k => localStorage.removeItem(k)));
    await page.goto(BASE + 'offer.html?tpl=marshal'); await page.waitForTimeout(300);
    await page.click('[data-ai-toggle]'); await page.waitForTimeout(350);
    assert(await page.locator('#ai-in').isVisible(), 'панель не открылась');
    assert((await page.$eval('#ai-st', e => e.textContent)).includes('демо'), 'статус');
    await page.fill('#ai-in', 'добавь теплообменник и 2 прожектора, скидка 4%'); await page.press('#ai-in', 'Enter'); await page.waitForTimeout(400);
    assert((await last()).includes('применено'), await last());
    const d = await page.evaluate(() => JSON.parse(localStorage.getItem('kb-offer-draft-v1')).st);
    assert(d.tpl === 'marshal' && d.disc === 4 && d.rows.some(r => r.ref === 'HEX-40'), JSON.stringify([d.tpl, d.disc]));
    assert(await page.locator('tr[data-row] [data-qty]').count() > 0, 'таблица');
    await page.fill('#ai-in', 'размеры 7 на 3,5'); await page.press('#ai-in', 'Enter'); await page.waitForTimeout(300);
    const d2 = await page.evaluate(() => JSON.parse(localStorage.getItem('kb-offer-draft-v1')).st);
    assert(d2.tpl === 'marshal' && d2.L === 7 && d2.W === 3.5 && d2.disc === 4, JSON.stringify([d2.tpl, d2.L, d2.W, d2.disc]));
    await page.click('[data-ai-close]'); await page.waitForTimeout(350);
    assert(!(await page.locator('#ai-drawer').evaluate(e => e.classList.contains('open'))), 'не закрылась');
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert(w[0] <= w[1] + 1, w.join('>'));
    assert(p.errors.length === 0, p.errors.join(' | '));
  });
  await page.evaluate(() => ['kb-ai-cfg-v1', 'kb-ai-chat-v1', 'kb-offer-draft-v1'].forEach(k => localStorage.removeItem(k)));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
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
    await testMainExtra(ctx, `главная — детали · ${dev}`);
    await testDash(ctx, `конструктор рабочего стола · ${dev}`, dev === 'телефон');
    await testAI(ctx, `ИИ-помощник · ${dev}`);
    await testOffer(ctx, `конструктор КП (offer.html) · ${dev}`);
    await testSprav(ctx, `справочник (spravochnik.html) · ${dev}`);
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
