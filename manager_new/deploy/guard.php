<?php
/**
 * /manager_new/2027/guard.php — защита страниц нового интерфейса.
 * Подключается первой строкой в каждой странице /manager_new/2027/*.php.
 *
 * 1) Доступ только с разрешённых IP. Список — в соседнем файле ip-allow.php (его нет в архиве,
 *    поэтому обновление архивом его не затирает):
 *        <?php return array('1.2.3.4', '5.6.7.8');
 *    Ваш адрес показывает страница 403 «Доступ закрыт. Ваш IP: …».
 *    Пока ip-allow.php нет — пускаем только вошедших в Битрикс (без проверки IP).
 * 2) Только для вошедших в Битрикс пользователей — иначе на страницу входа /manager_new/.
 *
 * Файлы /manager/ не затрагиваются. Откат: удалить папку /manager_new/2027/.
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
    LocalRedirect('/manager_new/?back_url=' . urlencode($_SERVER['REQUEST_URI']));
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
