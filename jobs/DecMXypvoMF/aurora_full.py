import sys, json, os, urllib.request
sys.path.insert(0,'pipeline'); import engine
fc=engine.fal()
d='jobs/DecMXypvoMF'
img=fc.upload_file(f'{d}/aurora_in.png')
aud=fc.upload_file('public/fast_DecMXypvoMF_vo.wav')
prompt=("A young German entrepreneur in a black polo shirt sits on a black director's chair in a bright, clean white studio and talks "
 "energetically and confidently directly into the camera, natural precise lip movement, natural blinking, lively small head movements, "
 "expressive but controlled hand gestures near his knees, realistic skin texture, soft even white studio light, plain seamless white background, "
 "steady locked-off camera, no camera movement.")
res=engine.fal_run('DecMXypvoMF','aurora_full_720p','fal-ai/creatify/aurora',{'image_url':img,'audio_url':aud,'resolution':'720p','prompt':prompt})
urllib.request.urlretrieve(res['video']['url'], 'public/v4/DecMXypvoMF/leif_full.mp4')
engine.cost('DecMXypvoMF','aurora full 720p 31.4s',round(32*0.14,2))
print('done', res['video']['url'][:60])
