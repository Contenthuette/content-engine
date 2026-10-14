import sys, json, urllib.request
sys.path.insert(0,'pipeline'); import engine
fc=engine.fal(); d='jobs/rea20'
img=fc.upload_file('pipeline/assets/face_source_master_2026-10.png'); aud=fc.upload_file(f'{d}/old_c.wav')
prompt=open('pipeline/assets/face_prompt.txt').read().strip()
res=engine.fal_run('rea20','aurora_old_720p_b','fal-ai/creatify/aurora',{'image_url':img,'audio_url':aud,'resolution':'720p','prompt':prompt})
urllib.request.urlretrieve(res['video']['url'], 'public/rea/face_dark2.mp4')
engine.cost('rea20','aurora old avatar 720p 2.0s (14.7-16.7)',round(2*0.14,2))
print('done')
