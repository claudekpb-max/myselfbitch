<?php
/**
 * /manager_new/guard.php — защита страниц нового интерфейса.
 * Подключается первой строкой в каждой странице /manager_new/*.php.
 *
 * 1) Доступ только с разрешённых IP. Список — в соседнем файле ip-allow.php (его нет в архиве,
 *    поэтому обновление архивом его не затирает):
 *        <?php return array('1.2.3.4', '5.6.7.8');
 *    Ваш адрес показывает страница 403 «Доступ закрыт. Ваш IP: …».
 *    Пока ip-allow.php нет — пускаем только вошедших в Битрикс (без проверки IP).
 * 2) Только для вошедших в Битрикс пользователей — иначе на страницу входа /manager_new/.
 *
 * Файлы /manager/ не затрагиваются. Откат: вернуть старый index.php из index-old.php.
 */
$KB_ALLOW_IP = is_file(__DIR__ . '/ip-allow.php') ? (array)include __DIR__ . '/ip-allow.php' : array();

$kbIp = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
if (count($KB_ALLOW_IP) && !in_array($kbIp, $KB_ALLOW_IP, true)) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<h1>403</h1><p>Доступ закрыт. Ваш IP: ' . htmlspecialchars($kbIp, ENT_QUOTES, 'UTF-8') . '</p>';
    exit;
}

require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';
global $USER;
if (!is_object($USER) || !$USER->IsAuthorized()) {
    LocalRedirect('/manager/?back_url=' . urlencode($_SERVER['REQUEST_URI'])); /* вход — через страницу входа рабочего менеджера */
    exit;
}
/* имя вошедшего пользователя — для рабочего стола (вместо демо-имени) */
$KB_USER = array(
    'name'  => trim($USER->GetFirstName() . ' ' . $USER->GetLastName()) ?: $USER->GetLogin(),
    'login' => $USER->GetLogin(),
    'email' => $USER->GetEmail(),
);
$KB_USER['short'] = $KB_USER['name'];
$kbParts = preg_split('/\s+/u', $KB_USER['name']);
if (count($kbParts) > 1) {
    $KB_USER['short'] = $kbParts[0] . ' ' . mb_substr($kbParts[1], 0, 1, 'UTF-8') . '.';
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

/* ---------- настройки интерфейса на сервере ----------
   у каждого пользователя свои (CUserOptions — профиль пользователя Битрикса),
   общие «по умолчанию» задаёт администратор (COption, модуль kb.manager_new).
   КП и другие данные не затрагиваются. */
define('KB_SET_CAT', 'kb.manager_new');
$KB_SET_KEYS = array('kb-dash-v1', 'kb-offers-cols-v1', 'kb-offers-removed-v1', 'kb-theme-v2', 'kb-side-off',
    'kb-works-v1', 'kb-cat-accepted-v1', 'kb-offer-draft-v1', 'kb-ai-cfg-v1');
function kb_set_clean($items)
{
    global $KB_SET_KEYS;
    $out = array();
    if (!is_array($items)) return $out;
    foreach ($KB_SET_KEYS as $k) {
        if (!isset($items[$k]) || !is_string($items[$k])) continue;
        $v = $items[$k];
        if ($k === 'kb-ai-cfg-v1') { /* ключи API на сервер не сохраняем */
            $c = json_decode($v, true);
            if (is_array($c)) { unset($c['keys']); $v = json_encode($c, JSON_UNESCAPED_UNICODE); }
        }
        $out[$k] = $v;
    }
    if (strlen(json_encode($out)) > 60000) unset($out['kb-offer-draft-v1']);
    if (strlen(json_encode($out)) > 60000) unset($out['kb-works-v1']);
    return $out;
}
function kb_set_user()
{
    global $USER;
    $v = CUserOptions::GetOption(KB_SET_CAT, 'settings', false, $USER->GetID());
    return is_array($v) ? $v : array();
}
function kb_set_defaults()
{
    $v = json_decode(COption::GetOptionString(KB_SET_CAT, 'defaults', ''), true);
    return is_array($v) ? $v : array();
}
function kb_set_boot()
{
    global $USER, $KB_SET_KEYS;
    return array('user' => (object)kb_set_user(), 'def' => (object)kb_set_defaults(), 'admin' => (bool)$USER->IsAdmin(),
        'sessid' => bitrix_sessid(), 'keys' => $KB_SET_KEYS);
}
