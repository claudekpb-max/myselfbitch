<?php
/**
 * /manager_new/2027/api.php — ТОЛЬКО ЧТЕНИЕ. Реальные КП для нового интерфейса.
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

try {
    if (!CModule::IncludeModule('iblock')) kb_json(array('error' => 'Модуль iblock не установлен'), 500);

    /* инфоблоки типа manager, доступные пользователю */
    $iblocks = array();
    $r = CIBlock::GetList(array('SORT' => 'ASC', 'ID' => 'ASC'), array('TYPE' => 'manager', 'CHECK_PERMISSIONS' => 'Y'), true);
    while ($ib = $r->Fetch()) {
        $iblocks[] = array('id' => (int)$ib['ID'], 'code' => $ib['CODE'], 'name' => $ib['NAME'], 'count' => (int)$ib['ELEMENT_CNT']);
    }
    $what = isset($_GET['what']) ? $_GET['what'] : 'offers';

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
    $id = isset($_GET['iblock']) ? (int)$_GET['iblock'] : 0;
    if ($id && !in_array($id, array_column($iblocks, 'id'), true)) kb_json(array('error' => 'Инфоблок ' . $id . ' не найден среди типа manager или нет прав'), 404);
    if (!$id) {
        foreach ($iblocks as $ib) if (preg_match('/(кп|коммерч|предлож|offer|\bkp\b)/iu', $ib['name'] . ' ' . $ib['code'])) { $id = $ib['id']; break; }
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
    $rs = CIBlockElement::GetList(array('DATE_CREATE' => 'DESC', 'ID' => 'DESC'),
        array('IBLOCK_ID' => $id, 'CHECK_PERMISSIONS' => 'Y'), false, array('nTopCount' => $limit),
        array('ID', 'IBLOCK_ID', 'NAME', 'DATE_CREATE', 'TIMESTAMP_X', 'CREATED_BY', 'MODIFIED_BY', 'ACTIVE'));
    while ($ob = $rs->GetNextElement()) {
        $f = $ob->GetFields();
        $pv = $ob->GetProperties();
        $userIds[] = $f['CREATED_BY'];
        foreach ($pv as $code => $p) {
            if ($p['PROPERTY_TYPE'] === 'E' && $p['VALUE']) foreach ((array)$p['VALUE'] as $v) $elIds[] = (int)$v;
            if ($p['PROPERTY_TYPE'] === 'S' && in_array($p['USER_TYPE'], array('UserID', 'employee'), true) && $p['VALUE']) foreach ((array)$p['VALUE'] as $v) $userIds[] = (int)$v;
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
        );
        foreach ($pv as $code => $p) {
            if ($p['PROPERTY_TYPE'] === 'F') continue;
            $v = $p['VALUE'];
            if ($p['PROPERTY_TYPE'] === 'E') { $v = array_map(function ($x) use ($elNames) { return isset($elNames[(int)$x]) ? $elNames[(int)$x] : $x; }, (array)$v); }
            elseif ($p['PROPERTY_TYPE'] === 'S' && in_array($p['USER_TYPE'], array('UserID', 'employee'), true)) { $v = array_map(function ($x) use ($users) { return isset($users[(int)$x]) ? $users[(int)$x]['_name'] : $x; }, (array)$v); }
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
        'iblock' => $id, 'iblockName' => $ibName, 'iblocks' => $iblocks,
        'fields' => array_merge(array('ID', 'Название', 'Дата создания', 'Создал'), array_values(array_map(function ($p) { return $p['NAME']; }, $props))),
        'offers' => $rows, 'users' => $outUsers, 'at' => date('c'),
    ));
} catch (\Throwable $e) {
    kb_json(array('error' => 'Ошибка чтения КП: ' . $e->getMessage()), 500);
}
