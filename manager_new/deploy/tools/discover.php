<?php
/**
 * /manager_new/2027/discover.php — ТОЛЬКО ЧТЕНИЕ. Показывает, где хранятся КП, чтобы подключить реальные данные.
 * Выводит СТРУКТУРУ (названия инфоблоков, highload-блоков, таблиц, полей, количество записей)
 * и исходный код страниц /manager/ — без клиентских данных (имён, телефонов, сумм).
 * Ничего не изменяет: только SELECT / SHOW / чтение файлов.
 * Доступ: разрешённый IP (ip-allow.php) + вход в Битрикс + администратор.
 * После использования файл удалить.
 */
require __DIR__ . '/guard.php';
if (!$USER->IsAdmin()) { http_response_code(403); echo 'Только для администратора'; exit; }
header('Content-Type: text/plain; charset=utf-8');
@set_time_limit(60);

function out($s = '') { echo $s, "\n"; }
/* в коде прячем значения, похожие на пароли/ключи/токены */
function code($s) {
    $s = preg_replace('/((?:pass(?:word)?|pwd|token|secret|api[_-]?key|apikey|private[_-]?key|auth|login|user(?:name)?)["\']?\]?\s*(?:=>|=|:)\s*)(["\'])[^"\']{2,}\2/i', '$1$2***скрыто***$2', $s);
    $s = preg_replace('/(define\(\s*["\'][A-Z0-9_]*(?:PASS|PWD|TOKEN|SECRET|KEY|LOGIN|USER)[A-Z0-9_]*["\']\s*,\s*)(["\'])[^"\']*\2/i', '$1$2***скрыто***$2', $s);
    $s = preg_replace('/(mysql|https?|ftp):\/\/[^\s:@\/]+:[^\s@\/]+@/i', '$1://***:***@', $s);
    return $s;
}
function h($t) { out(); out('==== ' . $t . ' ===='); }
$RX = '/(кп|к\.п|коммерч|предлож|offer|kp|смет|calc|расч|manager|менедж|заказ|order|клиент|client)/iu';

h('Сайт');
out('Битрикс: ' . (defined('SM_VERSION') ? SM_VERSION : '?') . ' · PHP ' . PHP_VERSION . ' · кодировка: ' . (defined('LANG_CHARSET') ? LANG_CHARSET : '?'));

/* 1. Файлы /manager/ — исходный код (без данных) */
h('Файлы /manager/ (исходный код)');
$root = $_SERVER['DOCUMENT_ROOT'] . '/manager';
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
$files = array();
foreach ($it as $f) { if ($f->isFile()) $files[] = $f->getPathname(); }
sort($files);
foreach ($files as $p) {
    $rel = substr($p, strlen($_SERVER['DOCUMENT_ROOT']));
    out(sprintf('%-60s %8d байт', $rel, filesize($p)));
}
foreach ($files as $p) {
    if (!preg_match('/\.php$/', $p) || basename($p) === '.access.php') continue;
    if (filesize($p) > 200000) continue;
    $rel = substr($p, strlen($_SERVER['DOCUMENT_ROOT']));
    h('КОД ' . $rel);
    out(code(file_get_contents($p)));
}

/* 2. Компоненты, которые подключает /manager/ — где лежат */
h('Компоненты из /manager/');
$all = '';
foreach ($files as $p) if (preg_match('/\.php$/', $p)) $all .= file_get_contents($p);
preg_match_all('/IncludeComponent\(\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']*)["\']/', $all, $m, PREG_SET_ORDER);
$seen = array();
foreach ($m as $c) {
    $key = $c[1] . ' / шаблон «' . $c[2] . '»';
    if (isset($seen[$key])) continue; $seen[$key] = 1;
    list($ns, $name) = array_pad(explode(':', $c[1], 2), 2, '');
    $paths = array();
    foreach (array('/local/components/', '/bitrix/components/') as $base) {
        $d = $_SERVER['DOCUMENT_ROOT'] . $base . $ns . '/' . $name;
        if (is_dir($d)) $paths[] = $base . $ns . '/' . $name;
    }
    out($key . ' → ' . ($paths ? implode(', ', $paths) : 'папка не найдена'));
    foreach ($paths as $pp) {
        foreach (array('component.php', 'class.php', '.parameters.php', 'ajax.php') as $fn) {
            $f = $_SERVER['DOCUMENT_ROOT'] . $pp . '/' . $fn;
            if (is_file($f) && filesize($f) < 300000) { h('КОД ' . $pp . '/' . $fn); out(code(file_get_contents($f))); }
        }
    }
}

/* 3. Инфоблоки */
h('Инфоблоки (все: ID · тип · код · название · элементов)');
if (CModule::IncludeModule('iblock')) {
    $res = CIBlock::GetList(array('ID' => 'ASC'), array('CHECK_PERMISSIONS' => 'N'), true);
    $hit = array();
    while ($ib = $res->Fetch()) {
        $line = sprintf('%5d · %-18s · %-24s · %-40s · %d', $ib['ID'], $ib['IBLOCK_TYPE_ID'], $ib['CODE'], $ib['NAME'], $ib['ELEMENT_CNT']);
        out($line);
        if (preg_match($RX, $ib['NAME'] . ' ' . $ib['CODE'] . ' ' . $ib['IBLOCK_TYPE_ID'])) $hit[] = $ib['ID'];
    }
    foreach ($hit as $id) {
        h('Свойства инфоблока ' . $id);
        $pr = CIBlockProperty::GetList(array('SORT' => 'ASC'), array('IBLOCK_ID' => $id));
        while ($p = $pr->Fetch()) out(sprintf('%-28s %-6s %-4s %s', $p['CODE'], $p['PROPERTY_TYPE'], $p['MULTIPLE'], $p['NAME']));
    }
} else out('модуль iblock не установлен');

/* 4. Highload-блоки */
h('Highload-блоки (ID · имя · таблица · записей · поля)');
if (CModule::IncludeModule('highloadblock')) {
    $hl = \Bitrix\Highloadblock\HighloadBlockTable::getList(array('order' => array('ID' => 'ASC')));
    global $DB;
    while ($b = $hl->fetch()) {
        $cnt = $DB->Query('SELECT COUNT(*) C FROM `' . $DB->ForSql($b['TABLE_NAME']) . '`', true);
        $c = $cnt ? $cnt->Fetch() : array('C' => '?');
        out(sprintf('%4d · %-30s · %-30s · %s', $b['ID'], $b['NAME'], $b['TABLE_NAME'], $c['C']));
        $uf = CUserTypeEntity::GetList(array('SORT' => 'ASC'), array('ENTITY_ID' => 'HLBLOCK_' . $b['ID'], 'LANG' => 'ru'));
        while ($f = $uf->Fetch()) out('       ' . sprintf('%-28s %-12s %s', $f['FIELD_NAME'], $f['USER_TYPE_ID'], $f['EDIT_FORM_LABEL']));
    }
} else out('модуль highloadblock не установлен');

/* 5. Свои таблицы БД (не стандартные b_*) и таблицы с подходящими именами */
h('Таблицы БД: свои (не b_*) и похожие на КП · записей · колонки');
global $DB;
$t = $DB->Query('SHOW TABLE STATUS');
while ($r = $t->Fetch()) {
    $n = $r['Name'];
    if (strpos($n, 'b_') === 0 && !preg_match($RX, $n)) continue;
    $cols = array();
    $c = $DB->Query('SHOW COLUMNS FROM `' . $DB->ForSql($n) . '`');
    while ($cc = $c->Fetch()) $cols[] = $cc['Field'] . ':' . $cc['Type'];
    out(sprintf('%-40s ~%s строк', $n, $r['Rows']));
    out('       ' . implode(', ', $cols));
}

/* 6. Правила адресов для manager */
h('urlrewrite.php — правила с manager');
$rules = array();
if (is_file($_SERVER['DOCUMENT_ROOT'] . '/urlrewrite.php')) { include $_SERVER['DOCUMENT_ROOT'] . '/urlrewrite.php'; $rules = isset($arUrlRewrite) ? $arUrlRewrite : array(); }
foreach ($rules as $r) if (stripos(print_r($r, true), 'manager') !== false) out(print_r($r, true));

h('Готово. Скопируйте весь текст этой страницы и пришлите. Затем удалите discover.php.');
