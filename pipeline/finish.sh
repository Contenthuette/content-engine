#!/bin/bash
# finish.sh IN OUT [W=720] [H=900]  -- "realism finish" for avatar clips (keeps audio)
# neutral bg + mild grade, sub-pixel handheld drift + slow 2% push-in, light sharpen, temporal grain, soft vignette, 30 fps
in=$1; out=$2; W=${3:-720}; H=${4:-900}; W2=$((W*2)); H2=$((H*2))
ffmpeg -v error -y -i "$in" -filter_complex "\
[0:v]fps=30,scale=$W2:$H2:flags=lanczos:force_original_aspect_ratio=increase,crop=$W2:$H2,\
scale=w='trunc($W2*(1.04+0.025*t/6)/2)*2':h='trunc($H2*(1.04+0.025*t/6)/2)*2':eval=frame:flags=bicubic,\
crop=$W2:$H2:x='(iw-ow)/2+7*sin(2*PI*t*0.31)+3*sin(2*PI*t*0.83+1.3)+1.2*sin(2*PI*t*2.1)':\
y='(ih-oh)/2+6*sin(2*PI*t*0.23+0.7)+2.5*sin(2*PI*t*0.71)+1*sin(2*PI*t*1.9+2)',\
scale=$W:$H:flags=lanczos,\
colorbalance=rh=-0.03:gh=-0.005:bh=0.03,eq=saturation=0.95:contrast=1.0:brightness=0,\
unsharp=5:5:0.35:5:5:0,vignette=angle=PI/10,${FINISH_EXTRA}\
noise=c0s=5:c0f=t+u:c1s=2:c1f=t:c2s=2:c2f=t,format=yuv420p[v]" \
-map "[v]" -map 0:a? -c:v libx264 -crf 17 -preset medium -threads 2 -c:a aac -b:a 160k "$out"
