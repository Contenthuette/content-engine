import sys, os, urllib.request
sys.path.insert(0, 'pipeline')
import engine
fc = engine.fal()
img = fc.upload_file('public/v4/leif_studio_916.png')
aud = fc.upload_file('jobs/showreel_v5/vo.wav')
print('uploaded', flush=True)
r = fc.subscribe('fal-ai/bytedance/omnihuman/v1.5', arguments={
    'image_url': img, 'audio_url': aud, 'resolution': '1080p',
    'prompt': ('A confident young man sits on a black director\'s chair in a bright white photo studio and talks '
               'directly into the camera with energy, natural expressive hand gestures, slight forward lean, '
               'subtle head movement, eye contact, natural soft daylight, realistic, steady locked-off camera'),
}, with_logs=False)
u = r['video']['url']; print('done', u, r.get('duration'), flush=True)
os.makedirs('public/v5', exist_ok=True)
urllib.request.urlretrieve(u, 'public/v5/leif_talk.mp4')
engine.cost('showreel_v5', 'omnihuman 1.5 1080p', round(0.16 * float(r.get('duration') or 13.8), 2))
print('saved', flush=True)
