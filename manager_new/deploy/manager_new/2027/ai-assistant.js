/* ИИ-помощник рабочего стола «Менеджер 2027».
   Пишете или надиктовываете задачу → ИИ создаёт / правит КП, рисует схему бассейна или делает фото.
   Провайдер настраивается: Claude (Anthropic), ChatGPT (OpenAI), DeepSeek.
   Ключи хранятся ТОЛЬКО в localStorage этого браузера. Для боевой версии запросы нужно вести
   через сервер Битрикса (ключ на сервере), а не из браузера. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var root = $('#aiw'); if (!root || !window.KB) return;
  var CFG_KEY = 'kb-ai-cfg-v1', LOG_KEY = 'kb-ai-chat-v1', HANDOFF = 'kb-ai-offer', DRAFT = 'kb-offer-draft-v1';
  var PROV = {
    claude: { name: 'Claude', model: 'claude-opus-5-5', keyHint: 'sk-ant-…', site: 'console.anthropic.com' },
    openai: { name: 'ChatGPT', model: 'gpt-4o', keyHint: 'sk-…', site: 'platform.openai.com' },
    deepseek: { name: 'DeepSeek', model: 'deepseek-chat', keyHint: 'sk-…', site: 'platform.deepseek.com' }
  };
  var TPLS = KB.TEMPLATES;
  var TPLW = [[/фарол|farol/i, 'farol'], [/франмер|franmer/i, 'franmer'], [/маршал|marshal/i, 'marshal'], [/3d|3д/i, 'film-3d'], [/плён|плен/i, 'film-budget'], [/перелив/i, 'tile-ovf'], [/керамогранит|плитк/i, 'tile-skim'], [/био/i, 'bio']];

  /* ---------- разметка блока (одна на рабочий стол и конструктор КП) ---------- */
  var MIC = '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  var SPARK = '<svg class="spark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.1L20 6l-4.4 4.9L22 12l-6.4 1.1L20 18l-6.4-2.1L12 22l-1.6-6.1L4 18l4.4-4.9L2 12l6.4-1.1L4 6l6.4 2.1z"/></svg>';
  var GEAR = '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  var X = '<svg class="ic" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var SEND = '<svg class="ic" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>';
  var ON_OFFER = !!window.KBOffer;
  if (ON_OFFER) LOG_KEY = 'kb-ai-chat-offer-v1';
  function provRow(p) { var v = PROV[p]; return '<div class="aiw-pr"><b>' + v.name + '</b><input class="inp" type="password" id="ai-key-' + p + '" placeholder="API-ключ ' + v.keyHint + '" autocomplete="off" spellcheck="false"><input class="inp" id="ai-model-' + p + '" autocomplete="off" spellcheck="false" title="Модель"><small>ключ: ' + v.site + '</small></div>'; }
  if (!root.children.length) root.innerHTML =
    '<div class="aiw-hd">' + SPARK + '<b>ИИ-помощник</b><select id="ai-prov" class="aiw-sel" title="Чей ИИ отвечает"><option value="claude">Claude</option><option value="openai">ChatGPT</option><option value="deepseek">DeepSeek</option></select>' +
    '<span class="aiw-st" id="ai-st"></span><span class="aiw-sp"></span><button class="icon-btn" data-ai-clear title="Очистить переписку">' + X.replace('class="ic"', 'class="ic" style="opacity:.7"') + '</button><button class="icon-btn" data-ai-cfg title="Настройки ИИ: ключи и модели">' + GEAR + '</button>' +
    (ON_OFFER ? '<button class="icon-btn" data-ai-close title="Закрыть панель">' + X + '</button>' : '') + '</div>' +
    '<div class="aiw-cfg" id="ai-cfg" hidden><div class="aiw-note">Ключи хранятся только в этом браузере и уходят напрямую выбранному провайдеру. Без ключа работает демо-режим: простые команды, схемы. Для боевой версии ключ переносим на сервер Битрикса.</div>' +
    provRow('claude') + provRow('openai') + provRow('deepseek') +
    '<div class="aiw-pr"><b>Фото</b><input class="inp" id="ai-model-image" placeholder="gpt-image-1" title="Модель изображений OpenAI"><small>фото рисует ChatGPT (нужен его ключ), с любым выбранным ИИ</small></div>' +
    '<div class="aiw-cf"><span class="aiw-test" id="ai-test"></span><button class="btn" data-ai-forget>Удалить ключи</button><button class="btn" data-ai-test>Проверить подключение</button><button class="btn dark" data-ai-save>Сохранить</button></div></div>' +
    '<div class="aiw-log" id="ai-log" aria-live="polite"></div>' +
    '<div class="aiw-chips">' + (ON_OFFER
      ? '<button data-ai-q="Добавь в КП ">Добавить позицию</button><button data-ai-q="Поставь скидку %">Скидка</button><button data-ai-q="Поменяй размеры на ">Размеры</button><button data-ai-q="Нарисуй схему этого бассейна">Схема</button><button data-ai-q="Сделай фото этого бассейна у дома">Фото</button>'
      : '<button data-ai-q="Создай КП Франмер 8×4 для ">Создать КП</button><button data-ai-q="Измени текущее КП: ">Изменить КП</button><button data-ai-q="Нарисуй схему бассейна 8×4×1,5">Схема бассейна</button><button data-ai-q="Сделай фото бассейна у дома: ">Фото</button>') +
    '<span class="aiw-busy" id="ai-busy"></span></div>' +
    '<div class="aiw-in"><textarea id="ai-in" rows="2" placeholder="' + (ON_OFFER ? 'Например: «добавь теплообменник и 2 прожектора, скидка 5%»' : 'Напишите или надиктуйте: «КП Франмер 8×4 для Ирины Беловой, скидка 5%»') + '"></textarea>' +
    '<button class="icon-btn aiw-mic" data-ai-mic title="Надиктовать голосом">' + MIC + '</button><button class="btn dark aiw-go" data-ai-send title="Отправить (Enter)">' + SEND + '</button></div>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t) { var el = $('#toast'); if (!el) return; el.querySelector('span').textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2600); }
  function tpl(id) { return TPLS.filter(function (t) { return t.id === id; })[0]; }
  function num(v, d) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? n : d; }
  function fmt(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

  /* ---------- настройки ---------- */
  function cfg() {
    var c = KB.load(CFG_KEY, null) || {};
    c.prov = PROV[c.prov] ? c.prov : 'claude'; c.keys = c.keys || {}; c.models = c.models || {};
    if (!c.models.image) c.models.image = 'gpt-image-1';
    return c;
  }
  function saveCfg(c) { KB.save(CFG_KEY, c); }
  function model(c, p) { return (c.models[p] || '').trim() || PROV[p].model; }
  function status() {
    var c = cfg(), k = (c.keys[c.prov] || '').trim();
    $('#ai-prov').value = c.prov;
    var s = $('#ai-st'); s.textContent = k ? model(c, c.prov) : 'демо-режим, без ключа'; s.className = 'aiw-st' + (k ? ' on' : '');
  }
  function fillCfg() {
    var c = cfg();
    Object.keys(PROV).forEach(function (p) { $('#ai-key-' + p).value = c.keys[p] || ''; $('#ai-model-' + p).value = c.models[p] || ''; $('#ai-model-' + p).placeholder = PROV[p].model; });
    $('#ai-model-image').value = c.models.image;
  }
  function readCfg() {
    var c = cfg();
    Object.keys(PROV).forEach(function (p) { c.keys[p] = $('#ai-key-' + p).value.trim(); c.models[p] = $('#ai-model-' + p).value.trim(); });
    c.models.image = $('#ai-model-image').value.trim() || 'gpt-image-1';
    return c;
  }

  /* ---------- журнал ---------- */
  var log = KB.load(LOG_KEY, null) || [];
  function persistLog() { KB.save(LOG_KEY, log.slice(-40).map(function (m) { var x = { r: m.r, t: m.t }; if (m.a) x.a = m.a; if (m.svg) x.svg = m.svg; return x; })); }
  function actCard(a, i) {
    if (!a) return '';
    if (a.type === 'create_offer' || a.type === 'edit_offer') {
      var T = tpl(a.tpl), bits = [];
      if (T) bits.push(T.name);
      if (a.L || a.W) bits.push(fmt(num(a.L, 0)) + '×' + fmt(num(a.W, 0)) + (a.D ? '×' + fmt(num(a.D, 0)) : '') + ' м');
      if (a.client) bits.push(a.client);
      if (a.disc != null && a.disc !== '') bits.push('скидка ' + a.disc + '%');
      if (a.add && a.add.length) bits.push('+' + a.add.length + ' поз.');
      if (a.remove && a.remove.length) bits.push('−' + a.remove.length + ' поз.');
      return '<div class="aiw-act"><div><b>' + (a.type === 'create_offer' ? 'Новое КП' : 'Правка КП') + '</b><small>' + esc(bits.join(' · ') || 'по текущему черновику') + '</small></div>' + (ON_OFFER ? '<span class="aiw-done">✓ применено</span>' : '<button class="btn dark" data-ai-open="' + i + '">Открыть в конструкторе</button>') + '</div>';
    }
    if (a.type === 'open_kp' && a.kp) return '<div class="aiw-act"><div><b>КП № ' + esc(a.kp) + '</b></div><button class="btn" data-open-kp="' + esc(a.kp) + '">Открыть</button></div>';
    return '';
  }
  function bubble(m, i) {
    var h = '<div class="aiw-m ' + (m.r === 'u' ? 'u' : 'a') + (m.err ? ' err' : '') + '"><div class="aiw-b">' + esc(m.t).replace(/\n/g, '<br>');
    if (m.r === 'a') h += actCard(m.a, i);
    if (m.svg) h += '<figure class="aiw-fig"><img alt="Схема бассейна" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m.svg) + '"><figcaption><button class="btn" data-ai-dl="' + i + '">Скачать SVG</button></figcaption></figure>';
    if (m.img) h += '<figure class="aiw-fig"><img alt="Сгенерированное изображение" src="' + m.img + '"><figcaption><button class="btn" data-ai-dl="' + i + '">Скачать PNG</button></figcaption></figure>';
    return h + '</div></div>';
  }
  function render() {
    var el = $('#ai-log');
    el.innerHTML = log.length ? log.map(bubble).join('') : '<div class="aiw-empty"><b>Что сделать?</b>Напишите или надиктуйте 🎤, например:<br>«КП Франмер 8×4 для Ирины Беловой, скидка 5%»<br>«Добавь в КП теплообменник и 2 прожектора»<br>«Нарисуй схему бассейна 10×4×1,6 с переливом»</div>';
    el.scrollTop = el.scrollHeight;
  }
  function push(m) { log.push(m); persistLog(); render(); }

  /* ---------- контекст для модели ---------- */
  function draftInfo() {
    var d = KB.load(DRAFT, null); if (!d || !d.st) return 'Открытого черновика КП нет.';
    var s = d.st, T = tpl(s.tpl);
    return 'Текущий черновик КП в конструкторе: шаблон ' + s.tpl + (T ? ' (' + T.name + ')' : '') + ', размеры ' + s.L + '×' + s.W + '×' + s.D + ' м, клиент: ' + (s.client || '—') + ', скидка ' + (s.disc || 0) + '%. Позиции: ' +
      s.rows.map(function (r) { return r.ref + '×' + (Math.round(r.qty * 100) / 100); }).join(', ') + '.';
  }
  function system() {
    return [
      'Ты — ИИ-помощник менеджера компании «Купибас» (бассейны под ключ). Отвечай по-русски, коротко и по делу.',
      'Ты умеешь: создать новое коммерческое предложение (КП), изменить текущий черновик КП, нарисовать схему бассейна, сделать фото/визуализацию, открыть существующее КП.',
      'ВСЕГДА отвечай ОДНИМ JSON-объектом без markdown и пояснений вокруг, строго в формате:',
      '{"reply":"текст для менеджера","action":{"type":"create_offer|edit_offer|scheme|image|open_kp|none", ...}}',
      'Поля action по типам:',
      '- create_offer / edit_offer: "tpl" (id шаблона), "client", "phone", "addr", "L","W","D" (метры, числа), "disc" (скидка %, число), "add":[{"ref":"артикул или id работы","qty":число}], "remove":["артикул или id работы"], "set_qty":[{"ref":"…","qty":число}]. Указывай только то, что нужно поменять. edit_offer правит текущий черновик.',
      '- scheme: "L","W","D" (метры), "tpl" (если понятна технология), "steps" (true/false — лестница), "title".',
      '- image: "prompt" — подробное описание изображения на английском (фотореалистичный бассейн, окружение, свет).',
      '- open_kp: "kp" — номер КП (например "2417").',
      'Шаблоны (id — название — размеры по умолчанию):',
      TPLS.map(function (t) { return t.id + ' — ' + t.name + ' — ' + t.dims.join('×'); }).join('; '),
      'Каталог (артикул — название — ед.):',
      KB.catalog().map(function (c) { return c.sku + ' — ' + c.name + ' — ' + c.unit; }).join('; '),
      'Работы (id — название — ед.):',
      KB.works().map(function (w) { return w.id + ' — ' + w.name + ' — ' + w.unit; }).join('; '),
      'Используй только артикулы и id из списков выше. Если запрос неясен — action.type "none" и уточняющий вопрос в reply.',
      draftInfo(),
      ON_OFFER ? 'Менеджер сейчас в конструкторе этого КП: команды по умолчанию относятся к нему (edit_offer). create_offer — только если явно просят новое КП.' : ''
    ].join('\n');
  }
  function history(q) {
    var msgs = [];
    log.slice(-12).forEach(function (m) {
      if (m.err) return;
      var role = m.r === 'u' ? 'user' : 'assistant', text = m.r === 'u' ? m.t : JSON.stringify({ reply: m.t, action: m.a || { type: 'none' } });
      if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + text; else msgs.push({ role: role, content: text });
    });
    if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs[msgs.length - 1].content += '\n' + q; else msgs.push({ role: 'user', content: q });
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    return msgs;
  }
  function parse(text) {
    var s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i > -1 && j > i) { try { var o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o === 'object') return { reply: String(o.reply || ''), action: o.action || null }; } catch (e) {} }
    return { reply: s || 'Пустой ответ модели', action: null };
  }

  /* ---------- провайдеры ---------- */
  var sdk = null;
  function loadSdk() {
    if (window.Anthropic) return Promise.resolve(window.Anthropic);
    if (sdk) return sdk;
    sdk = new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = 'vendor/anthropic/anthropic-sdk-1.3.0.min.js';
      s.onload = function () { ok(window.Anthropic); }; s.onerror = function () { sdk = null; bad(new Error('Не удалось загрузить SDK Claude')); };
      document.head.appendChild(s);
    });
    return sdk;
  }
  function askClaude(c, msgs) {
    return loadSdk().then(function (Anthropic) {
      var client = new Anthropic({ apiKey: c.keys.claude, dangerouslyAllowBrowser: true });
      return client.beta.messages.create({
        model: model(c, 'claude'), max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: system(), messages: msgs
      }).then(function (r) {
        if (r.stop_reason === 'refusal') throw new Error('Claude отказался выполнить запрос' + (r.stop_details && r.stop_details.explanation ? ': ' + r.stop_details.explanation : ''));
        var text = r.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
        if (r.stop_reason === 'max_tokens' && !text) throw new Error('Ответ не уместился в лимит — сформулируйте короче');
        return text;
      }, function (e) {
        if (e instanceof Anthropic.AuthenticationError) throw new Error('Claude: неверный API-ключ');
        if (e instanceof Anthropic.PermissionDeniedError) throw new Error('Claude: у ключа нет доступа к модели ' + model(c, 'claude'));
        if (e instanceof Anthropic.NotFoundError) throw new Error('Claude: модель «' + model(c, 'claude') + '» не найдена');
        if (e instanceof Anthropic.RateLimitError) throw new Error('Claude: превышен лимит запросов, попробуйте через минуту');
        if (e instanceof Anthropic.APIConnectionError) throw new Error('Claude: нет связи с api.anthropic.com');
        if (e instanceof Anthropic.APIError) throw new Error('Claude: ошибка ' + (e.status || '') + ' — ' + e.message);
        throw e;
      });
    });
  }
  var OAI = { openai: 'https://api.openai.com/v1/chat/completions', deepseek: 'https://api.deepseek.com/chat/completions' };
  function askOai(c, p, msgs) {
    return fetch(OAI[p], {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.keys[p] },
      body: JSON.stringify({ model: model(c, p), messages: [{ role: 'system', content: system() }].concat(msgs), response_format: { type: 'json_object' } })
    }).then(httpJson(PROV[p].name)).then(function (j) { return j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : ''; });
  }
  function httpJson(name) {
    return function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (r.ok && j) return j;
        var msg = j && j.error ? (j.error.message || j.error) : t.slice(0, 160);
        if (r.status === 401) throw new Error(name + ': неверный API-ключ');
        if (r.status === 402) throw new Error(name + ': на счёте недостаточно средств');
        if (r.status === 429) throw new Error(name + ': превышен лимит запросов');
        throw new Error(name + ': ошибка ' + r.status + (msg ? ' — ' + msg : ''));
      });
    };
  }
  function netErr(name) { return function (e) { if (e instanceof TypeError) throw new Error(name + ': запрос не прошёл (сеть или браузер заблокировал прямой доступ к API — в боевой версии запросы пойдут через сервер)'); throw e; }; }
  function ask(c, msgs) {
    var p = c.prov;
    return (p === 'claude' ? askClaude(c, msgs) : askOai(c, p, msgs).catch(netErr(PROV[p].name))).then(parse);
  }
  function image(c, prompt) {
    var key = (c.keys.openai || '').trim();
    if (!key) return Promise.reject(new Error('Для фото нужен ключ ChatGPT (OpenAI) — добавьте его в настройках ⚙. Пока могу нарисовать схему.'));
    return fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: c.models.image || 'gpt-image-1', prompt: prompt, size: '1024x1024', n: 1 })
    }).catch(netErr('ChatGPT')).then(httpJson('ChatGPT')).then(function (j) {
      var d = j.data && j.data[0]; if (!d) throw new Error('ChatGPT: изображение не получено');
      return d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url;
    });
  }

  /* ---------- демо-режим без ключа: понимает простые команды ---------- */
  function local(q) {
    var a = { type: 'none' }, t = null, i;
    for (i = 0; i < TPLW.length; i++) if (TPLW[i][0].test(q)) { t = TPLW[i][1]; break; }
    var dm = q.match(/(\d+(?:[.,]\d+)?)\s*(?:[x×х*]|на)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:[x×х*]|на)\s*(\d+(?:[.,]\d+)?))?/i);
    var disc = q.match(/скидк\S*\s*(?:в\s*)?(\d+(?:[.,]\d+)?)/i);
    var cl = q.match(/для\s+((?:ООО|ИП|АО)\s*«[^»]+»|[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/);
    var no = q.match(/\b(24\d\d)\b/);
    if (/схем|чертёж|чертеж|план/i.test(q)) a = { type: 'scheme' };
    else if (/фото|картин|визуал|рендер|изображ/i.test(q)) a = { type: 'image', prompt: 'Photorealistic backyard swimming pool ' + (dm ? dm[1] + 'x' + dm[2] + ' m' : '') + ', modern house, evening light' };
    else if (/измени|поменя|добав|убер|удали|исправ/i.test(q) || (disc && !t && !dm)) a = { type: 'edit_offer' };
    else if (no && !t) a = { type: 'open_kp', kp: no[1] };
    else if (t || dm || /кп|предложени/i.test(q)) a = { type: 'create_offer' };
    if (ON_OFFER && a.type === 'create_offer' && !t) a.type = 'edit_offer';
    if (t) a.tpl = t;
    if (dm) { a.L = num(dm[1]); a.W = num(dm[2]); if (dm[3]) a.D = num(dm[3]); }
    if (disc) a.disc = num(disc[1], 0);
    if (cl) a.client = cl[1];
    if (a.type === 'edit_offer') {
      var add = [];
      if (/теплообмен|подогрев/i.test(q)) add.push({ ref: 'HEX-40', qty: 1 });
      var led = q.match(/(\d+)\s*(?:прожектор|светильник|led)/i); if (led || /подсветк|прожектор/i.test(q)) add.push({ ref: 'LED-RGB', qty: led ? +led[1] : 1 });
      if (/дозац|ph/i.test(q)) add.push({ ref: 'DOS-PH', qty: 1 });
      if (/хими/i.test(q)) add.push({ ref: 'CHM-SET', qty: 1 });
      if (add.length) a.add = add;
    }
    if (a.type === 'scheme') { a.steps = !/без\s+лестниц/i.test(q); if (/перелив/i.test(q)) a.tpl = 'tile-ovf'; }
    var R = {
      create_offer: 'Готово: собрал новое КП' + (t ? ' по шаблону «' + tpl(t).name + '»' : '') + '. Откройте его в конструкторе и проверьте позиции.',
      edit_offer: ON_OFFER ? 'Готово, правки внесены в КП.' : 'Подготовил правки к текущему черновику КП.',
      scheme: 'Схема бассейна готова.',
      image: 'Для фото нужен ключ ChatGPT — в демо-режиме нарисую схему.',
      open_kp: 'Открываю КП № ' + (no ? no[1] : ''),
      none: 'Демо-режим понимает простые команды: «КП Франмер 8×4 для Беловой, скидка 5%», «добавь теплообменник», «схема 10×4×1,6». Для свободного общения подключите Claude, ChatGPT или DeepSeek в настройках ⚙.'
    };
    return { reply: R[a.type], action: a };
  }

  /* ---------- схема бассейна (рисуем сами: точные размеры, без «фантазий» модели) ---------- */
  function scheme(a) {
    var d = KB.load(DRAFT, null), s = d && d.st, T = tpl(a.tpl || (s && s.tpl)) || tpl('film-budget');
    var L = num(a.L, s ? s.L : T.dims[0]), W = num(a.W, s ? s.W : T.dims[1]), D = num(a.D, s ? s.D : T.dims[2]);
    var ovf = T.id === 'tile-ovf', bio = T.id === 'bio', steps = a.steps !== false;
    var k = Math.min(520 / L, 230 / W), pw = L * k, ph = W * k, x0 = 60, y0 = 70, sk = Math.max(2, Math.ceil(L * W / 25)), nz = Math.max(3, Math.ceil(L * W / 10));
    var ink = '#3d3d3a', water = '#cfe6f2', acc = '#c96442', o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 640 520" font-family="Arial,sans-serif" font-size="13" fill="' + ink + '">');
    o.push('<rect width="640" height="520" fill="#fff"/>');
    o.push('<text x="20" y="30" font-size="17" font-weight="bold">' + esc(a.title || 'Схема бассейна — ' + T.name) + '</text>');
    o.push('<text x="20" y="50" fill="#8f8d84">' + fmt(L) + ' × ' + fmt(W) + ' × ' + fmt(D) + ' м · зеркало ' + fmt(L * W) + ' м² · объём ≈ ' + fmt(L * W * D) + ' м³</text>');
    if (ovf) o.push('<rect x="' + (x0 - 9) + '" y="' + (y0 - 9) + '" width="' + (pw + 18) + '" height="' + (ph + 18) + '" fill="none" stroke="' + acc + '" stroke-width="5" stroke-dasharray="3 3"/>');
    if (bio) o.push('<rect x="' + (x0 + pw * .66) + '" y="' + y0 + '" width="' + pw * .34 + '" height="' + ph + '" fill="#d9ead0" stroke="' + ink + '"/><text x="' + (x0 + pw * .83) + '" y="' + (y0 + ph / 2) + '" text-anchor="middle" font-size="12">зона регенерации</text>');
    o.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + (bio ? pw * .66 : pw) + '" height="' + ph + '" fill="' + water + '" stroke="' + ink + '" stroke-width="2"/>');
    if (steps) for (i = 0; i < 3; i++) o.push('<rect x="' + (x0 + 2) + '" y="' + (y0 + ph - 2 - (i + 1) * Math.min(ph / 5, 22)) + '" width="' + Math.min(pw / 5, 70) + '" height="' + Math.min(ph / 5, 22) + '" fill="#e9f3f8" stroke="' + ink + '" stroke-width=".8"/>');
    var i, bw = bio ? pw * .66 : pw;
    if (!ovf) for (i = 0; i < sk; i++) o.push('<rect x="' + (x0 + bw * (i + 1) / (sk + 1) - 9) + '" y="' + (y0 - 7) + '" width="18" height="10" fill="' + acc + '"/>');
    for (i = 0; i < nz; i++) o.push('<circle cx="' + (x0 + bw * (i + 1) / (nz + 1)) + '" cy="' + (y0 + ph - 6) + '" r="4" fill="#fff" stroke="' + acc + '" stroke-width="2"/>');
    o.push('<circle cx="' + (x0 + bw / 2) + '" cy="' + (y0 + ph / 2) + '" r="6" fill="' + ink + '"/>');
    var yd = y0 + ph + 30;
    o.push('<path d="M' + x0 + ' ' + (yd - 6) + 'v12M' + (x0 + pw) + ' ' + (yd - 6) + 'v12M' + x0 + ' ' + yd + 'H' + (x0 + pw) + '" stroke="' + ink + '"/><text x="' + (x0 + pw / 2) + '" y="' + (yd - 6) + '" text-anchor="middle">' + fmt(L) + ' м</text>');
    var xd = x0 + pw + 30;
    o.push('<path d="M' + (xd - 6) + ' ' + y0 + 'h12M' + (xd - 6) + ' ' + (y0 + ph) + 'h12M' + xd + ' ' + y0 + 'V' + (y0 + ph) + '" stroke="' + ink + '"/><text x="' + (xd + 8) + '" y="' + (y0 + ph / 2 + 4) + '">' + fmt(W) + ' м</text>');
    var sy = yd + 40, sh = Math.min(110, D * 55);
    o.push('<text x="20" y="' + (sy - 8) + '" font-weight="bold">Разрез</text>');
    o.push('<path d="M' + x0 + ' ' + sy + 'V' + (sy + sh) + 'H' + (x0 + pw) + 'V' + sy + '" fill="' + water + '" stroke="' + ink + '" stroke-width="2"/>');
    o.push('<path d="M' + (x0 + pw + 18) + ' ' + sy + 'v' + sh + '" stroke="' + ink + '"/><text x="' + (x0 + pw + 26) + '" y="' + (sy + sh / 2 + 4) + '">' + fmt(D) + ' м</text>');
    var ly = 505, leg = [[ovf ? 'переливной лоток' : 'скиммер ×' + sk, acc, 'r'], ['форсунка ×' + nz, acc, 'c'], ['донный слив', ink, 'd']];
    if (steps) leg.push(['лестница', ink, 's']);
    leg.forEach(function (g, n) { var lx = 20 + n * 150; o.push(g[2] === 'c' ? '<circle cx="' + (lx + 7) + '" cy="' + (ly - 4) + '" r="4" fill="#fff" stroke="' + g[1] + '" stroke-width="2"/>' : g[2] === 'd' ? '<circle cx="' + (lx + 7) + '" cy="' + (ly - 4) + '" r="5" fill="' + g[1] + '"/>' : '<rect x="' + lx + '" y="' + (ly - 9) + '" width="14" height="9" fill="' + (g[2] === 's' ? '#e9f3f8' : g[1]) + '" stroke="' + ink + '" stroke-width=".8"/>'); o.push('<text x="' + (lx + 20) + '" y="' + ly + '">' + g[0] + '</text>'); });
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- выполнение действия ---------- */
  function run(res, c, live) {
    var a = res.action || { type: 'none' }, m = { r: 'a', t: res.reply || '', a: null };
    if (a.type === 'create_offer' || a.type === 'edit_offer') {
      if (a.tpl && !tpl(a.tpl)) delete a.tpl;
      m.a = a;
      if (ON_OFFER) { try { window.KBOffer.apply(a); m.applied = true; } catch (e) { m.t += '\nНе удалось применить: ' + e.message; } }
      else KB.save(HANDOFF, a);
      push(m); return Promise.resolve();
    }
    if (a.type === 'open_kp') { m.a = a; push(m); return Promise.resolve(); }
    if (a.type === 'scheme' || (a.type === 'image' && !live)) {
      if (a.type === 'image') a = { type: 'scheme' };
      m.svg = scheme(a); m.a = { type: 'scheme' }; push(m); return Promise.resolve();
    }
    if (a.type === 'image') {
      setBusy(true, 'Рисую изображение…');
      return image(c, a.prompt || 'Photorealistic backyard swimming pool').then(function (src) { m.img = src; m.a = { type: 'image' }; push(m); toast('Изображение готово'); },
        function (e) { m.t = (m.t ? m.t + '\n' : '') + e.message; m.svg = scheme(a); m.a = { type: 'scheme' }; push(m); });
    }
    push(m); return Promise.resolve();
  }
  var busy = false;
  function setBusy(on, txt) { busy = on; root.classList.toggle('busy', on); $('#ai-busy').textContent = on ? (txt || 'Думаю…') : ''; $('[data-ai-send]').disabled = on; }
  function send(q) {
    q = (q || '').trim(); var ta = $('#ai-in');
    if (!q) { ta.focus(); toast('Напишите или надиктуйте задачу'); return; }
    if (busy) return;
    stopMic();
    var c = cfg(), key = (c.keys[c.prov] || '').trim(), msgs = history(q);
    push({ r: 'u', t: q }); ta.value = '';
    if (!key) { run(local(q), c, false); return; }
    setBusy(true, PROV[c.prov].name + ' думает…');
    ask(c, msgs).then(function (res) { return run(res, c, true); })
      .catch(function (e) { push({ r: 'a', t: e.message || String(e), err: true }); })
      .then(function () { setBusy(false); });
  }

  /* ---------- диктовка ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, base = '';
  function stopMic() { if (rec) { try { rec.stop(); } catch (e) {} } }
  function mic() {
    if (rec) { stopMic(); return; }
    if (!SR) { toast('Голосовой ввод не поддерживается этим браузером — откройте в Chrome, Edge или Safari'); return; }
    var ta = $('#ai-in'); base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
    rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = function (e) { var fin = '', tmp = ''; for (var i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else tmp += e.results[i][0].transcript; } ta.value = base + fin + tmp; };
    rec.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Разрешите доступ к микрофону в браузере'); else if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Диктовка: ' + e.error); };
    rec.onend = function () { rec = null; root.classList.remove('rec'); $('#ai-in').focus(); };
    try { rec.start(); root.classList.add('rec'); toast('Говорите… нажмите 🎤 ещё раз, чтобы закончить'); } catch (e) { rec = null; toast('Не удалось включить микрофон'); }
  }

  /* ---------- проверка подключения ---------- */
  function test() {
    var c = readCfg(), p = $('#ai-prov').value; c.prov = p;
    if (!(c.keys[p] || '').trim()) { toast('Введите ключ ' + PROV[p].name); return; }
    var out = $('#ai-test'); out.textContent = 'Проверяю ' + PROV[p].name + '…'; out.className = 'aiw-test';
    ask(c, [{ role: 'user', content: 'Проверка связи. Ответь: {"reply":"Связь есть","action":{"type":"none"}}' }])
      .then(function (r) { out.textContent = '✓ ' + PROV[p].name + ' отвечает: ' + (r.reply || 'ok'); out.className = 'aiw-test ok'; },
        function (e) { out.textContent = '✕ ' + (e.message || e); out.className = 'aiw-test bad'; });
  }

  function download(i) {
    var m = log[i]; if (!m) return; var a = document.createElement('a');
    if (m.svg) { a.href = URL.createObjectURL(new Blob([m.svg], { type: 'image/svg+xml' })); a.download = 'skhema-basseyna.svg'; }
    else if (m.img) { a.href = m.img; a.download = 'foto-basseyna.png'; }
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- события ---------- */
  root.addEventListener('click', function (e) {
    var el = e.target, t;
    if (el.closest('[data-ai-send]')) { send($('#ai-in').value); return; }
    if (el.closest('[data-ai-mic]')) { mic(); return; }
    if (t = el.closest('[data-ai-q]')) { var ta = $('#ai-in'); ta.value = t.dataset.aiQ; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return; }
    if (el.closest('[data-ai-cfg]')) { var p = $('#ai-cfg'); p.hidden = !p.hidden; if (!p.hidden) { fillCfg(); $('#ai-test').textContent = ''; } return; }
    if (el.closest('[data-ai-save]')) { var c = readCfg(); c.prov = $('#ai-prov').value; saveCfg(c); status(); $('#ai-cfg').hidden = true; toast('Настройки ИИ сохранены в этом браузере'); return; }
    if (el.closest('[data-ai-test]')) { test(); return; }
    if (el.closest('[data-ai-forget]')) { var c2 = cfg(); c2.keys = {}; saveCfg(c2); fillCfg(); status(); toast('Ключи удалены из браузера'); return; }
    if (el.closest('[data-ai-close]')) { document.body.classList.remove('ai-open'); var dr = document.getElementById('ai-drawer'); if (dr) dr.classList.remove('open'); return; }
    if (el.closest('[data-ai-clear]')) { log = []; persistLog(); render(); return; }
    if (t = el.closest('[data-ai-open]')) { var m0 = log[+t.dataset.aiOpen]; if (m0 && m0.a) KB.save(HANDOFF, m0.a); location.href = 'offer.php?ai=1'; return; }
    if (t = el.closest('[data-ai-dl]')) { download(+t.dataset.aiDl); return; }
  });
  $('#ai-prov').addEventListener('change', function () { var c = cfg(); c.prov = this.value; saveCfg(c); status(); });
  $('#ai-in').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(this.value); } });
  render(); status();
  window.KBAI = { send: send, local: local, scheme: scheme, parse: parse, cfg: cfg };
})();
