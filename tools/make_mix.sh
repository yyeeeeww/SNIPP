#!/bin/bash
# Cut the 4 hooks and butt-splice them with tiny fades -> audio/mix.wav
set -e
cd "$(dirname "$0")/../audio"
seg() { ffmpeg -loglevel error -y -ss $2 -t $3 -i $1 -af "afade=t=in:d=0.03,afade=t=out:st=$(echo "$3-0.06"|bc):d=0.06" -ar 44100 -ac 2 $4; }
seg 1_sprite.wav        67.90 15.0 s1.wav   # drop @ +1.75
seg 2_track.wav         45.00 15.0 s2.wav   # drop @ +1.78
seg 3_licormx.wav       36.80 15.0 s3.wav   # drop @ +2.40
seg 4_nichegonenado.wav 28.20 15.3 s4.wav   # beat out @ +11.8, tail to the end
ffmpeg -loglevel error -y -i s1.wav -i s2.wav -i s3.wav -i s4.wav -filter_complex "concat=n=4:v=0:a=1" mix.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 mix.wav
