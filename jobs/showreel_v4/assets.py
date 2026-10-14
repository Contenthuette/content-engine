import sys, json, os, urllib.request, concurrent.futures as cf
sys.path.insert(0,'pipeline'); import engine
J='showreel_v4'; O='public/v4/reel'
imgs={
 'phone_explode':'A modern smartphone floating in mid-air, exploded view: screen, battery, circuit board and frame separated into hovering layers, pure seamless white studio background, soft natural shadow, high-end editorial product photography, ultra sharp, vertical composition',
 'spotlight':'Cinematic black and white photo of a lone young man in a black polo sitting on a director chair in a single hard spotlight in a pitch dark empty studio, film grain, dramatic contrast, vertical composition',
 'papers':'Hundreds of white paper sheets with printed code flying and swirling through the air in a bright white studio, motion blur on the edges, editorial photography, vertical composition',
 'robot_key':'Close-up of a sleek white robotic hand pressing a single black keyboard key, pure white studio background, soft shadow, premium product photography, vertical composition',
 'city_chip':'Aerial night view of a dense glowing city whose streets look like a computer circuit board, deep blue and white light trails, cinematic, vertical composition',
 'eye_code':'Extreme macro close-up of a human eye, green-grey iris with a faint reflection of a laptop screen full of code, crisp lashes, high-end editorial beauty photography',
}
def img(k):
    p=f'{O}/{k}.png'
    if os.path.exists(p): return p
    r=engine.fal_run(J,f'img_{k}','fal-ai/nano-banana',{'prompt':imgs[k],'num_images':1,'aspect_ratio':'9:16','output_format':'png'})
    urllib.request.urlretrieve(r['images'][0]['url'],p); engine.cost(J,f'img {k}',0.039); return p
aud={
 'music':('Hard-hitting energetic electronic beat for a fast tech showreel, 128 BPM, massive punchy kick and clap from the very first beat, distorted sub bass, short stutter edits, risers into drops every 4 bars, aggressive, modern, no intro, no vocals',16),
 'sfx_impact':('Single deep cinematic sub bass impact boom hit with short tail, punchy, clean, no music',2),
 'sfx_glitch':('Short aggressive digital glitch stutter hit, data corruption sound, punchy, no music',1),
 'sfx_swipe':('Fast aggressive air whoosh swipe, very short, punchy, no music',1),
 'sfx_riser':('Short tense synth riser building up for one second ending abruptly, no music',1),
}
def au(k):
    p=f'{O}/{k}.wav'
    if os.path.exists(p): return p
    pr,s=aud[k]
    r=engine.fal_run(J,f'aud_{k}','fal-ai/stable-audio-25/text-to-audio',{'prompt':pr,'seconds_total':s})
    url=r['audio']['url'] if isinstance(r.get('audio'),dict) else r['audio_file']['url']
    raw=p+'.src'; urllib.request.urlretrieve(url,raw)
    os.system(f'ffmpeg -nostdin -loglevel error -y -i "{raw}" -ar 48000 -ac 2 "{p}"'); engine.cost(J,f'audio {k}',0.2); return p
with cf.ThreadPoolExecutor(6) as ex:
    fs=[ex.submit(img,k) for k in imgs]+[ex.submit(au,k) for k in aud]
    for f in fs:
        try: print(f.result())
        except Exception as e: print('ERR',e)
