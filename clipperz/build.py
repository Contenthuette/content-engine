import base64
def uri(p,m): return f"data:{m};base64,"+base64.b64encode(open(p,'rb').read()).decode()
s=open('src.html').read()
s=s.replace('{{FACE1}}',uri('leif_front_t.jpg','image/jpeg')).replace('{{FACE2}}',uri('leif_34_t.jpg','image/jpeg')).replace('{{POSTER}}',uri('poster.jpg','image/jpeg')).replace('{{VIDEO}}',uri('sample.mp4','video/mp4'))
open('index.html','w').write(s); print(len(s)//1024,'KB')
