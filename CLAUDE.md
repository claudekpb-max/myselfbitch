# Правила работы

## Рабочая папка — «код» на Google Диске
- **Всегда работаем только в папке «код»** на Google Диске владельца (claudekpb@gmail.com).
  Папка: https://drive.google.com/drive/folders/18yWuewZb1D3eegHEhED-9eoAclk9Aub4 (id `18yWuewZb1D3eegHEhED-9eoAclk9Aub4`).
- Все новые файлы, копии и правки складываем внутрь «код», каждый проект — в своей подпапке.
- Оригиналы вне «код» не изменяем: сначала копируем в «код», потом правим копию.

## manager_new — работаем только в GitHub
- Все изменения manager_new ведём **только в GitHub** (репозиторий claudekpb-max/myselfbitch, папка `manager_new/`), **никогда не трогая рабочую версию на сайте** kupibas.ru/manager/.
- Ссылки для тестирования (обновляются после каждого push в ветку `claude/elegant-feynman-bslnv4`, кэш до нескольких минут):
  https://raw.githack.com/claudekpb-max/myselfbitch/claude/elegant-feynman-bslnv4/manager_new/index.html
- Папка «код» на Google Диске — архивная копия; правки туда больше не дублируем, если владелец не попросит.

## Проекты в «код»
- `manager_new/` — рабочая копия редизайна kupibas.ru/manager/ «2027»
  (оригинал: папка «менеджер» на Диске, бэкап шаблона — там же в `backup/original/`).
  - `prototype/` — manager-claude.html (главная, собирается build.py из claude-style.src.html), offer.html (конструктор КП, 8 шаблонов), spravochnik.html (работы/расценки, каталог и цены 1С), kp.html (КП клиента), index.html + manager-2027.css/js (слой для Битрикса), kb-data.js / kb-ui.css (общие данные и стили)
  - `для-теста/` — самодостаточная копия для скачивания и открытия с диска (СТАРТ.html); на Google Диске: код/manager_new/для-теста
  - `tools/make-test-copy.sh` — пересобирает `для-теста/` из `prototype/`
  - `prototype/vendor/gridstack/` — GridStack 10.3.1 (MIT), перетаскивание и размер блоков рабочего стола
  - `prototype/ai-assistant.js` — блок «ИИ-помощник» (Claude / ChatGPT / DeepSeek, диктовка, КП, схемы, фото); `prototype/vendor/anthropic/` — SDK Claude 1.3.0 (Apache-2.0). Ключи API только в localStorage браузера, в код и чат не кладём; для боевой — прокси через сервер
  - `tests/smoke.js` — Playwright-проверка всех страниц: из manager_new `python3 -m http.server 8765`, затем `node tests/smoke.js`
  - `tools/bx.py` — запуск PHP через админку Битрикса (логин/пароль только из env `BX_USER`/`BX_PASS`, никогда не в коде и не в чате)
- `собственный-пляж/` — под копию лендинга собственный-пляж.рф (Битрикс, kupibas). Пока пусто: ждём архив резервной копии из админки.

## Боевые сайты
- Изменения на боевых kupibas.ru / собственный-пляж.рф — только после согласования с владельцем и с планом отката.
