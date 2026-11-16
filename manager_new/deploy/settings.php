<?php
/**
 * /manager_new/2027/settings.php — настройки интерфейса на сервере.
 *   GET                         — мои настройки и общие по умолчанию
 *   POST ?sessid=…&action=save          {items:{…}} — сохранить мои
 *   POST ?sessid=…&action=reset                     — удалить мои (будут общие)
 *   POST ?sessid=…&action=save_default  {items:{…}} — сделать общими (только администратор)
 *   POST ?sessid=…&action=clear_default             — убрать общие (только администратор)
 * Пишет только настройки интерфейса (CUserOptions / COption). КП и другие данные не затрагивает.
 */
require __DIR__ . '/guard.php';
header('Content-Type: application/json; charset=utf-8');
function kb_out($a, $code = 200) { http_response_code($code); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') kb_out(array('user' => (object)kb_set_user(), 'defaults' => (object)kb_set_defaults()));
if (!check_bitrix_sessid()) kb_out(array('error' => 'Сессия устарела — обновите страницу'), 403);

$body = json_decode(file_get_contents('php://input'), true);
$items = kb_set_clean(isset($body['items']) ? $body['items'] : array());
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'save':
        CUserOptions::SetOption(KB_SET_CAT, 'settings', $items, false, $USER->GetID());
        kb_out(array('ok' => true, 'saved' => count($items)));
    case 'reset':
        CUserOptions::DeleteOption(KB_SET_CAT, 'settings', false, $USER->GetID());
        kb_out(array('ok' => true));
    case 'save_default':
        if (!$USER->IsAdmin()) kb_out(array('error' => 'Только для администратора'), 403);
        COption::SetOptionString(KB_SET_CAT, 'defaults', json_encode($items, JSON_UNESCAPED_UNICODE));
        kb_out(array('ok' => true, 'saved' => count($items)));
    case 'clear_default':
        if (!$USER->IsAdmin()) kb_out(array('error' => 'Только для администратора'), 403);
        COption::RemoveOption(KB_SET_CAT, 'defaults');
        kb_out(array('ok' => true));
}
kb_out(array('error' => 'Неизвестное действие'), 400);
