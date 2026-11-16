<?php
/**
 * /manager_new/api.php — ТОЛЬКО ЧТЕНИЕ. Реальные КП для нового интерфейса.
 *
 * Берёт КП из инфоблоков типа «manager» (Админка → Контент → manager), с учётом прав пользователя.
 * Ничего не изменяет: только CIBlock*::GetList / CUser::GetList.
 * Доступ: guard.php (разрешённый IP из ip-allow.php + вход в Битрикс).
 *
 *   api.php?what=meta            — список инфоблоков типа manager и их свойств (для настройки)
 *   api.php                      — КП (инфоблок выбирается сам: по названию «КП/коммерческ/предлож», иначе самый большой)
 *   api.php?iblock=ID&limit=1000 — КП из конкретного инфоблока
 */
require __DIR__ . '/guard.php';
header('Content-Type: application/json; charset=utf-8');

function kb_json($a, $code = 200)
{
    http_response_code($code);
    echo json_encode($a, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}
function kb_user_names($ids)
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    $out = array();
    if (!$ids) return $out;
    $by = 'id'; $order = 'asc';
    $r = CUser::GetList($by, $order, array('ID' => implode(' | ', $ids)), array('FIELDS' => array('ID', 'LOGIN', 'NAME', 'LAST_NAME', 'EMAIL', 'ACTIVE')));
    while ($u = $r->Fetch()) {
        $name = trim($u['NAME'] . ' ' . $u['LAST_NAME']);
        $out[(int)$u['ID']] = array('ID' => $u['ID'], 'Логин' => $u['LOGIN'], 'Имя' => $u['NAME'] !== '' ? $u['NAME'] : $u['LOGIN'],
            'Фамилия' => $u['LAST_NAME'], 'E-Mail' => $u['EMAIL'], 'Активность' => $u['ACTIVE'] === 'Y' ? 'Да' : 'Нет', '_name' => $name !== '' ? $name : $u['LOGIN']);
    }
    return $out;
}
function kb_scalar($v)
{
    if (is_array($v)) {
        if (isset($v['TEXT'])) $v = $v['TEXT'];
        else return implode(', ', array_filter(array_map('kb_scalar', $v), 'strlen'));
    }
    $v = trim(html_entity_decode(strip_tags((string)$v), ENT_QUOTES, 'UTF-8'));
    return mb_strlen($v, 'UTF-8') > 300 ? mb_substr($v, 0, 300, 'UTF-8') . '…' : $v;
}

/* сводка КП из Kupibas\Manager\Offer\Offer::load()->data (только чтение) */
function kb_num($v)
{
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = str_replace(array(' ', "\xc2\xa0"), '', (string)$v);
    if (preg_match('/,\d{1,2}$/', $s)) $s = str_replace(array('.', ','), array('', '.'), $s); else $s = str_replace(',', '', $s);
    return is_numeric($s) ? (float)$s : null;
}
function kb_pick($a, $keys)
{
    foreach ($keys as $k) if (isset($a[$k]) && !is_array($a[$k]) && trim((string)$a[$k]) !== '') return $a[$k];
    return null;
}
function kb_offer_summary($d, $full)
{
    $d = is_array($d) ? $d : array();
    $fio = trim(implode(' ', array_filter(array(kb_pick($d, array('customer_lastname')), kb_pick($d, array('customer')), kb_pick($d, array('customer_secondname'))))));
    if ($fio === '') $fio = trim((string)kb_pick($d, array('customer_fio')));
    $out = array('customer' => kb_scalar($fio), 'phone' => kb_scalar(kb_pick($d, array('phone'))));
    $rows = array(); $total = 0.0; $have = false;
    $recs = isset($d['records']) && is_array($d['records']) ? $d['records'] : array();
    foreach ($recs as $r) {
        if (!is_array($r)) continue;
        $name = kb_pick($r, array('name', 'NAME', 'title', 'TITLE'));
        $qty = kb_num(kb_pick($r, array('quantity', 'QUANTITY', 'count', 'COUNT', 'qty', 'amount')));
        $price = kb_num(kb_pick($r, array('price', 'PRICE', 'cost', 'PRICE_VALUE')));
        $sum = kb_num(kb_pick($r, array('sum', 'SUM', 'summ', 'SUMM', 'total', 'TOTAL', 'price_total')));
        if ($sum === null && $price !== null && $qty !== null) {
            $disc = kb_num(kb_pick($r, array('discount', 'DISCOUNT'))) ?: 0;
            $sum = $price * $qty * (1 - $disc / 100);
        }
        $isGroup = $sum === null && $price === null && $qty === null;
        if ($sum !== null) { $total += $sum; $have = true; }
        if ($full && count($rows) < 400) $rows[] = array('name' => kb_scalar($name), 'unit' => kb_scalar(kb_pick($r, array('unit', 'UNIT', 'measure', 'MEASURE'))),
            'qty' => $qty, 'price' => $price, 'sum' => $sum, 'group' => $isGroup);
    }
    $t = kb_num(kb_pick($d, array('total', 'total_sum', 'sum', 'TOTAL')));
    $out['total'] = $t !== null ? $t : ($have ? round($total, 2) : null);
    $out['positions'] = count($recs);
    if ($full) {
        $out += array('email' => kb_scalar(kb_pick($d, array('email'))), 'address' => kb_scalar(kb_pick($d, array('address'))),
            'comment' => kb_scalar(kb_pick($d, array('comment'))), 'performer' => kb_scalar(kb_pick($d, array('performer'))),
            'rate' => kb_scalar(kb_pick($d, array('offer-rate', 'rate'))), 'date' => kb_scalar(kb_pick($d, array('date'))), 'rows' => $rows);
    }
    return $out;
}

try {
    if (!CModule::IncludeModule('iblock')) kb_json(array('error' => 'Модуль iblock не установлен'), 500);

    /* инфоблоки типа manager, доступные пользователю */
    $iblocks = array();
    $r = CIBlock::GetList(array('SORT' => 'ASC', 'ID' => 'ASC'), array('TYPE' => 'manager', 'CHECK_PERMISSIONS' => 'Y'), true);
    while ($ib = $r->Fetch()) {
        $iblocks[] = array('id' => (int)$ib['ID'], 'code' => $ib['CODE'], 'name' => $ib['NAME'], 'count' => (int)$ib['ELEMENT_CNT']);
    }
    $what = isset($_GET['what']) ? $_GET['what'] : 'offers';
    /* как в /manager/: инфоблок КП и ограничение «менеджер видит только свои КП» берём из настроек рабочего менеджера */
    $kbCfg = class_exists('Kupibas\\Manager\\Config') ? \Kupibas\Manager\Config::get() : array();
    $kbLimited = !empty($kbCfg['USER_IS_LIMITED']);
    $kbOffersIb = !empty($kbCfg['OFFERS_IBLOCK_ID']) ? (int)$kbCfg['OFFERS_IBLOCK_ID'] : 0;

    if ($what === 'meta') {
        foreach ($iblocks as &$ib) {
            $ib['props'] = array();
            $pr = CIBlockProperty::GetList(array('SORT' => 'ASC'), array('IBLOCK_ID' => $ib['id']));
            while ($p = $pr->Fetch()) $ib['props'][] = array('code' => $p['CODE'], 'name' => $p['NAME'], 'type' => $p['PROPERTY_TYPE'] . ($p['USER_TYPE'] ? ':' . $p['USER_TYPE'] : ''), 'multiple' => $p['MULTIPLE']);
        }
        unset($ib);
        kb_json(array('iblocks' => $iblocks));
    }

    /* какой инфоблок — КП */
    $id = isset($_GET['iblock']) ? (int)$_GET['iblock'] : $kbOffersIb;
    if ($id && !in_array($id, array_column($iblocks, 'id'), true)) kb_json(array('error' => 'Инфоблок ' . $id . ' не найден среди типа manager или нет прав'), 404);
    if (!$id) {
        $best = null; /* среди подходящих по названию — самый большой (не «Шаблоны торговых предложений») */
        foreach ($iblocks as $ib) {
            if (!preg_match('/(кп|коммерч|предлож|offer|\bkp\b)/iu', $ib['name'] . ' ' . $ib['code'])) continue;
            if (preg_match('/шаблон/iu', $ib['name'])) continue;
            if (!$best || $ib['count'] > $best['count']) $best = $ib;
        }
        if ($best) $id = $best['id'];
    }
    if (!$id && $iblocks) {
        $big = $iblocks;
        usort($big, function ($a, $b) { return $b['count'] - $a['count']; });
        $id = $big[0]['id'];
    }
    if (!$id) kb_json(array('error' => 'Нет доступных инфоблоков типа manager', 'iblocks' => $iblocks), 404);
    $ibName = '';
    foreach ($iblocks as $ib) if ($ib['id'] === $id) $ibName = $ib['name'];

    $limit = isset($_GET['limit']) ? max(1, min(3000, (int)$_GET['limit'])) : 1000;

    /* свойства */
    $props = array();
    $pr = CIBlockProperty::GetList(array('SORT' => 'ASC'), array('IBLOCK_ID' => $id, 'ACTIVE' => 'Y'));
    while ($p = $pr->Fetch()) $props[$p['CODE'] !== '' ? $p['CODE'] : $p['ID']] = $p;

    /* элементы */
    $rows = array(); $userIds = array(); $elIds = array(); $raw = array();
    $kbFilter = array('IBLOCK_ID' => $id, 'CHECK_PERMISSIONS' => 'Y');
    if ($kbLimited) $kbFilter['PROPERTY_USER_ID'] = $USER->GetID();

    /* одно или несколько КП целиком: заказчик, телефон, позиции, итог (только чтение, через класс рабочего менеджера) */
    if ($what === 'offer' || $what === 'sums') {
        if (!class_exists('Kupibas\\Manager\\Offer\\Offer')) kb_json(array('error' => 'Класс КП рабочего менеджера недоступен'), 501);
        $ids = array_slice(array_values(array_unique(array_filter(array_map('intval', explode(',', isset($_GET['ids']) ? $_GET['ids'] : (isset($_GET['id']) ? $_GET['id'] : '')))))), 0, 60);
        if (!$ids) kb_json(array('error' => 'Не указаны КП'), 400);
        $allowed = array();
        $ar = CIBlockElement::GetList(array(), $kbFilter + array('ID' => $ids), false, false, array('ID', 'TIMESTAMP_X'));
        while ($a = $ar->Fetch()) $allowed[(int)$a['ID']] = $a['TIMESTAMP_X'];
        $res = array();
        foreach ($ids as $oid) {
            if (!isset($allowed[$oid])) continue;
            $o = \Kupibas\Manager\Offer\Offer::load($oid);
            if (!$o) continue;
            $res[$oid] = kb_offer_summary($o->data, $what === 'offer') + array('ts' => $allowed[$oid]);
            if ($what === 'offer' && !empty($_GET['debug']) && $USER->IsAdmin()) {
                $res[$oid]['debug'] = array('keys' => array_keys((array)$o->data),
                    'record_keys' => isset($o->data['records']) && is_array($o->data['records']) ? array_map(function ($r) { return is_array($r) ? array_keys($r) : gettype($r); }, array_slice($o->data['records'], 0, 3)) : null);
            }
        }
        kb_json(array('offers' => (object)$res));
    }

    $rs = CIBlockElement::GetList(array('DATE_CREATE' => 'DESC', 'ID' => 'DESC'),
        $kbFilter, false, array('nTopCount' => $limit),
        array('ID', 'IBLOCK_ID', 'NAME', 'DATE_CREATE', 'TIMESTAMP_X', 'CREATED_BY', 'MODIFIED_BY', 'ACTIVE'));
    while ($ob = $rs->GetNextElement()) {
        $f = $ob->GetFields();
        $pv = $ob->GetProperties();
        $userIds[] = $f['CREATED_BY'];
        foreach ($pv as $code => $p) {
            if ($p['PROPERTY_TYPE'] === 'E' && $p['VALUE']) foreach ((array)$p['VALUE'] as $v) $elIds[] = (int)$v;
            if (in_array($p['USER_TYPE'], array('UserID', 'employee'), true) && $p['VALUE']) foreach ((array)$p['VALUE'] as $v) $userIds[] = (int)$v;
        }
        $raw[] = array($f, $pv);
    }
    $users = kb_user_names($userIds);
    $elNames = array();
    $elIds = array_values(array_unique(array_filter($elIds)));
    if ($elIds) {
        $er = CIBlockElement::GetList(array(), array('ID' => $elIds, 'CHECK_PERMISSIONS' => 'Y'), false, false, array('ID', 'NAME'));
        while ($e = $er->Fetch()) $elNames[(int)$e['ID']] = $e['NAME'];
    }

    foreach ($raw as $pair) {
        list($f, $pv) = $pair;
        $row = array(
            'ID' => $f['ID'],
            'Название' => kb_scalar($f['~NAME'] ?? $f['NAME']),
            'Дата создания' => $f['DATE_CREATE'],
            'Создал' => isset($users[(int)$f['CREATED_BY']]) ? $users[(int)$f['CREATED_BY']]['_name'] : '',
            'Последняя активность' => $f['TIMESTAMP_X'],
            'Ссылка' => '/bitrix/admin/iblock_element_edit.php?IBLOCK_ID=' . $id . '&type=manager&ID=' . $f['ID'] . '&lang=ru',
        );
        foreach ($pv as $code => $p) {
            if ($p['PROPERTY_TYPE'] === 'F' || $code === 'BLOG_POST_ID') continue;
            $v = $p['VALUE'];
            if ($p['PROPERTY_TYPE'] === 'E') { $v = array_map(function ($x) use ($elNames) { return isset($elNames[(int)$x]) ? $elNames[(int)$x] : $x; }, (array)$v); }
            elseif (in_array($p['USER_TYPE'], array('UserID', 'employee'), true)) { $v = array_map(function ($x) use ($users) { return isset($users[(int)$x]) ? $users[(int)$x]['_name'] : $x; }, (array)$v); }
            elseif ($p['PROPERTY_TYPE'] === 'L' && isset($p['VALUE_ENUM']) && $p['VALUE_ENUM'] !== null && $p['VALUE_ENUM'] !== '') { $v = $p['VALUE_ENUM']; }
            $key = $p['NAME'] !== '' ? $p['NAME'] : $code;
            if (isset($row[$key])) $key .= ' (' . $code . ')';
            $row[$key] = kb_scalar($v);
        }
        $rows[] = $row;
    }

    $outUsers = array();
    foreach ($users as $u) { unset($u['_name']); $outUsers[] = $u; }
    kb_json(array(
        'iblock' => $id, 'iblockName' => $ibName, 'iblocks' => $iblocks, 'limited' => $kbLimited, 'detail' => class_exists('Kupibas\\Manager\\Offer\\Offer'),
        'fields' => array_merge(array('ID', 'Название', 'Дата создания', 'Создал', 'Последняя активность', 'Ссылка'), array_values(array_map(function ($p) { return $p['NAME']; }, array_filter($props, function ($p) { return $p['PROPERTY_TYPE'] !== 'F' && $p['CODE'] !== 'BLOG_POST_ID'; })))),
        'offers' => $rows, 'users' => $outUsers, 'at' => date('c'),
    ));
} catch (\Throwable $e) {
    kb_json(array('error' => 'Ошибка чтения КП: ' . $e->getMessage()), 500);
}
