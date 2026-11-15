#!/bin/bash
# Same 4 hooks, but overlapped with 0.8 s crossfades (drops stay at the same absolute times) -> audio/mix_dc.wav
set -e
cd "$(dirname "$0")/../audio"
X=0.8
seg() { ffmpeg -loglevel error -y -ss $2 -t $3 -i $1 -af "afade=t=in:d=0.02" -ar 44100 -ac 2 $4; }
seg 1_sprite.wav        67.90 15.8 c1.wav
seg 2_track.wav         45.00 15.8 c2.wav
seg 3_licormx.wav       36.80 15.8 c3.wav
seg 4_nichegonenado.wav 28.20 15.3 c4.wav
ffmpeg -loglevel error -y -i c1.wav -i c2.wav -i c3.wav -i c4.wav -filter_complex \
 "[0][1]acrossfade=d=$X:c1=qsin:c2=qsin[a];[a][2]acrossfade=d=$X:c1=qsin:c2=qsin[b];[b][3]acrossfade=d=$X:c1=qsin:c2=qsin,afade=t=out:st=59.9:d=0.4[o]" -map "[o]" mix_dc.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 mix_dc.wav
