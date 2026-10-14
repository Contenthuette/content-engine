import sys, json, urllib.request
sys.path.insert(0,'pipeline'); import engine
fc=engine.fal(); d='jobs/rea20'
src=json.load(open('pipeline/assets/face_sources.json'))['active']
img=fc.upload_file(f'pipeline/assets/{src}'); aud=fc.upload_file(f'{d}/old_face_in.wav')
prompt=open('pipeline/assets/face_prompt.txt').read().strip()
res=engine.fal_run('rea20','aurora_old_720p','fal-ai/creatify/aurora',{'image_url':img,'audio_url':aud,'resolution':'720p','prompt':prompt})
urllib.request.urlretrieve(res['video']['url'], f'{d}/old_face_raw.mp4')
engine.cost('rea20','aurora old avatar 720p 5.6s',round(6*0.14,2))
print('done', src)
