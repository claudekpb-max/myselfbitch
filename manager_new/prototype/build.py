import base64
logo="data:image/png;base64,"+base64.b64encode(open('logo.png','rb').read()).decode()
m=open('claude-style.src.html').read().replace('{{LOGO}}',logo)
open('manager-claude.html','w').write(m)
open('kp.html','w').write(open('kp.src.html').read().replace('{{LOGO}}',logo))
