#!/usr/bin/env python3
"""Katana-Remix 'Die Leute kommen zu ULTRA' – Schnitt aus Kling-Shots + VO + Musik + Grafiken."""
import subprocess, json, os
FPS=24; W,H=1080,1920
# (Quelle, in-point, Dauer, (Zoom Start, Zoom Ende), (cx, cy) Bildausschnitt 0..1, Overlay)
EDL=[
 ('s1.mp4',0.0 ,2.55,(1.38,1.46),(.45,.18),None),   # Die Leute kommen zu ULTRA …
 ('s2.mp4',0.3 ,2.15,(1.04,1.09),(.5,.3),None),     # Ich hab noch nie …
 ('s3.mp4',0.2 ,1.90,(1.00,1.05),(.5,.3),None),
 ('s4.mp4',0.0 ,2.15,(1.22,1.28),(.45,.12),None),   # … Sozialleben hatte.
 ('s3.mp4',2.6 ,1.05,(1.16,1.20),(.5,.28),None),    # Das willst du?
 ('s4.mp4',2.6 ,1.00,(1.34,1.38),(.5,.14),None),    # Das willst du?
 ('s5.mp4',0.4 ,2.45,(1.30,1.40),(.5,.2),None),     # Schön. Aber dann …
 ('s1.mp4',2.9 ,2.05,(1.60,1.75),(.45,.17),None),   # Und gib niemand anderem die Schuld.
 ('s6.mp4',1.2 ,1.90,(1.00,1.05),(.5,.3),None),     # Montage
 ('CARD',  0.0 ,1.40,(1,1),(.5,.5),None),
 ('s5.mp4',2.9 ,1.90,(1.22,1.28),(.55,.2),'g_lowerthird.png'),
 ('s7.mp4',0.2 ,3.00,(1.55,1.62),(.3,.72),None),
]
parts=[]
for i,(src,a,d,(z0,z1),(cx,cy),ov) in enumerate(EDL):
    out=f'tmp_p{i:02d}.mp4'; parts.append(out)
    n=int(round(d*FPS))
    zoom=(f"scale=w='trunc({W}*({z0}+({z1}-{z0})*n/{max(n-1,1)})/2)*2':h=-2:eval=frame,"
          f"crop={W}:{H}:x='(iw-{W})*{cx}':y='(ih-{H})*{cy}'")
    if src=='CARD':
        vf=f"fade=in:st=0.12:d=0.06,fade=out:st={d-0.1}:d=0.1"
        cmd=['ffmpeg','-v','error','-y','-loop','1','-t',str(d),'-i','g_ultra_card.png','-vf',vf+f",fps={FPS},format=yuv420p",'-an','-c:v','libx264','-crf','16','-frames:v',str(n),out]
    else:
        base=f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setpts=PTS-STARTPTS,{zoom},eq=contrast=1.06:saturation=0.92,vignette=PI/5"
        if ov:
            cmd=['ffmpeg','-v','error','-y','-ss',str(a),'-t',str(d),'-i',src,'-loop','1','-t',str(d),'-i',ov,'-filter_complex',f"[0:v]{base}[v];[1:v]format=rgba,fade=in:st=0.15:d=0.15:alpha=1[o];[v][o]overlay=0:0,format=yuv420p",'-an','-c:v','libx264','-crf','16','-frames:v',str(n),'-r',str(FPS),out]
        else:
            cmd=['ffmpeg','-v','error','-y','-ss',str(a),'-t',str(d),'-i',src,'-vf',base+",format=yuv420p",'-an','-c:v','libx264','-crf','16','-frames:v',str(n),'-r',str(FPS),out]
    subprocess.run(cmd,check=True)
open('tmp_list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','tmp_list.txt','-c','copy','video_only.mp4'],check=True)
D=sum(int(round(e[2]*FPS)) for e in EDL)/FPS; VO_END=15.15
# Ton: Stimme −16 LUFS vorne; Musik unter der Stimme leise (Stimmen-Tasche), ab Montage voll
music='../../public/music/cinematic128.mp3'
af=(f"[0:a]loudnorm=I=-16:TP=-2,apad,atrim=0:{D}[vo];"
    f"[1:a]atrim=0:{D},asetpts=PTS-STARTPTS,equalizer=f=2500:t=q:w=1.4:g=-8,equalizer=f=1200:t=q:w=1:g=-6,"
    f"volume='if(lt(t,{VO_END}),0.16,0.85)':eval=frame,afade=t=out:st={D-0.6}:d=0.6[mu];"
    f"[vo][mu]amix=inputs=2:normalize=0[a]")
subprocess.run(['ffmpeg','-v','error','-y','-i','vo_raw.mp3','-i',music,'-filter_complex',af,'-map','[a]','-ar','48000','-c:a','pcm_s16le','tmp_mix.wav'],check=True)
# Master: messen, linear auf -14 LUFS anheben, Limiter
import re
m=subprocess.run(['ffmpeg','-hide_banner','-i','tmp_mix.wav','-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
I=float(re.findall(r'I:\s+(-?[\d.]+) LUFS',m)[-1]); g=-12.9-I
subprocess.run(['ffmpeg','-v','error','-y','-i','tmp_mix.wav','-af',f'volume={g}dB,alimiter=limit=0.76:level=0:attack=2:release=60','-c:a','aac','-b:a','256k','mix.m4a'],check=True)
print('mix I',I,'gain',round(g,2))
subprocess.run(['ffmpeg','-v','error','-y','-i','video_only.mp4','-i','mix.m4a','-map','0:v','-map','1:a','-c:v','copy','-c:a','copy','-movflags','+faststart','final.mp4'],check=True)
print('final.mp4', round(D,2),'s')
