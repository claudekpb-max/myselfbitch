#!/usr/bin/env python3
"""Собирает комплект для сайта: deploy/manager_new/ и архив deploy/manager_new.zip.

  новый интерфейс прямо в /manager_new/: рабочий стол (index.php), конструктор КП, справочник, КП клиента, ИИ-помощник;
  страницы .php: проверка IP (ip-allow.php) + вход в Битрикс (guard.php), имя пользователя из Битрикса.
Архив распаковывается в /manager_new/ через админку Битрикса. /manager/ не затрагивается.
"""
import os, re, shutil, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'prototype')
D = os.path.join(ROOT, 'deploy', 'manager_new')
NEW = D

PAGES = {'manager-claude.html': 'index.php', 'offer.html': 'offer.php', 'spravochnik.html': 'spravochnik.php', 'kp.html': 'kp.php'}
STATIC = ['kb-data.js', 'kb-ui.css', 'kb-real.js', 'ai-assistant.js', 'ai-assistant.css', 'logo.png']
LINK = re.compile(r'\b(manager-claude|offer|spravochnik|kp)\.html')
NAME = {'manager-claude': 'index.php', 'offer': 'offer.php', 'spravochnik': 'spravochnik.php', 'kp': 'kp.php'}

HEAD = "<?php require __DIR__ . '/guard.php'; ?>\n"
USER_JS = ("<script>window.KB_BITRIX_USER=<?= json_encode($KB_USER, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;"
           "document.addEventListener('DOMContentLoaded',function(){var u=window.KB_BITRIX_USER;if(!u||!u.name)return;"
           "var p=u.name.split(/\\s+/),ini=((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase();"
           "[].forEach.call(document.querySelectorAll('.side .me'),function(m){var a=m.querySelector('.avatar');if(a)a.textContent=ini;"
           "var w=m.querySelector('.who')||a&&a.nextElementSibling;if(w){w.textContent=u.name;var s=document.createElement('small');s.textContent=u.login||'Менеджер';w.appendChild(s)}})});</script>\n")


# настройки интерфейса с сервера — самым первым скриптом страницы
SET_JS = ("<script>window.KB_SRV=<?= json_encode(kb_set_boot(), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;</script>"
          "<script src=\"kb-settings.js\"></script>")


def main():
    # новый интерфейс — прямо в /manager_new/
    if os.path.isdir(NEW):
        shutil.rmtree(NEW)
    os.makedirs(NEW)
    shutil.copy(os.path.join(ROOT, 'deploy', 'guard.php'), os.path.join(NEW, 'guard.php'))
    shutil.copy(os.path.join(ROOT, 'deploy', 'api.php'), os.path.join(NEW, 'api.php'))
    for f in ['settings.php', 'kb-settings.js']:
        shutil.copy(os.path.join(ROOT, 'deploy', f), os.path.join(NEW, f))
    for f in STATIC:
        src = open(os.path.join(P, f), 'rb').read()
        if f.endswith('.js'):
            src = LINK.sub(lambda m: NAME[m.group(1)], src.decode('utf-8')).encode('utf-8')
        open(os.path.join(NEW, f), 'wb').write(src)
    shutil.copytree(os.path.join(P, 'vendor'), os.path.join(NEW, 'vendor'))
    for src, dst in PAGES.items():
        html = open(os.path.join(P, src), encoding='utf-8').read()
        html = LINK.sub(lambda m: NAME[m.group(1)], html)
        html = html.replace('<?', '&lt;?') if '<?' in html else html  # в html не должно быть PHP-тегов
        html = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '\n' + USER_JS, html, count=1)
        html = re.sub(r'(<meta charset=[^>]*>)', lambda m: m.group(1) + '\n' + SET_JS, html, count=1, flags=re.I)
        assert SET_JS in html, src
        open(os.path.join(NEW, dst), 'w', encoding='utf-8').write(HEAD + html)
    # архив
    z = os.path.join(ROOT, 'deploy', 'manager_new.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for base, _, files in os.walk(D):
            for f in sorted(files):
                full = os.path.join(base, f)
                zf.write(full, os.path.relpath(full, D))
    print('deploy/manager_new и deploy/manager_new.zip обновлены (%d КБ)' % (os.path.getsize(z) // 1024))


if __name__ == '__main__':
    main()
