#!/usr/bin/env python3
"""Собирает комплект для сайта: deploy/manager_new/ и архив deploy/manager_new.zip.

  assets/  — слой дизайна для копии рабочего менеджера (/manager_new/ и /manager_new/table/)
  2027/    — новый интерфейс (рабочий стол, конструктор КП, справочник, КП клиента, ИИ-помощник)
             страницы .php: проверка IP + вход в Битрикс (guard.php), имя пользователя из Битрикса.
Архив распаковывается в /manager_new/ через админку Битрикса. /manager/ не затрагивается.
"""
import os, re, shutil, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'prototype')
D = os.path.join(ROOT, 'deploy', 'manager_new')
NEW = os.path.join(D, '2027')

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


def main():
    # assets для копии рабочего менеджера
    os.makedirs(os.path.join(D, 'assets'), exist_ok=True)
    for f in ['manager-2027.css', 'manager-2027.js']:
        shutil.copy(os.path.join(P, f), os.path.join(D, 'assets', f))
    # новый интерфейс
    if os.path.isdir(NEW):
        shutil.rmtree(NEW)
    os.makedirs(NEW)
    shutil.copy(os.path.join(ROOT, 'deploy', 'guard.php'), os.path.join(NEW, 'guard.php'))
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
        open(os.path.join(NEW, dst), 'w', encoding='utf-8').write(HEAD + html)
    # архив
    z = os.path.join(ROOT, 'deploy', 'manager_new.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for base, _, files in os.walk(D):
            for f in sorted(files):
                if f == 'подключение.php.txt':
                    continue
                full = os.path.join(base, f)
                zf.write(full, os.path.relpath(full, D))
    print('deploy/manager_new и deploy/manager_new.zip обновлены (%d КБ)' % (os.path.getsize(z) // 1024))


if __name__ == '__main__':
    main()
