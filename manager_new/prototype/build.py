import base64, zipfile
logo="data:image/png;base64,"+base64.b64encode(open('logo.png','rb').read()).decode()
m=open('claude-style.src.html').read().replace('{{LOGO}}',logo)
open('manager-claude.html','w').write(m)
open('kp.html','w').write(open('kp.src.html').read().replace('{{LOGO}}',logo))
with zipfile.ZipFile('manager-claude-shots.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in ['manager-claude.html','kp.html','shots/claude-light.png','shots/claude-dark.png','shots/claude-auth.png','shots/max-modal.png','shots/kp-drawer.png','shots/kp-client.png','shots/kp-mobile.png']:
        try: z.write(f, f.split('/')[-1])
        except FileNotFoundError: pass
