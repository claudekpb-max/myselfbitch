<?php
/**
 * /manager_new/index.php — открывает новый интерфейс /manager_new/2027/.
 * Проверка IP (2027/ip-allow.php) и входа в Битрикс — та же, что у нового интерфейса (2027/guard.php).
 * Старая копия рабочего стола сохранена рядом как /manager_new/index-old.php (её не трогаем).
 * Откат: удалить этот файл и переименовать index-old.php обратно в index.php.
 */
require __DIR__ . '/2027/guard.php';
LocalRedirect('/manager_new/2027/' . (empty($_SERVER['QUERY_STRING']) ? '' : '?' . $_SERVER['QUERY_STRING']));
