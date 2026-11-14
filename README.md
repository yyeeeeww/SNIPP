# fav — snippet (Instagram Reels, 9:16, 60 s)

Paranormal / psychedelic PS1-style wizard visuals, fully procedural (no photos), synced to 4 track hooks.

| # | track | cut (s) | scene |
|---|-------|---------|-------|
| 1 | sprite | 67.90 – 82.90 | **broadcast** — figure in dead-channel static → endless kaleidoscopic arcade, he teleports closer every 5 kicks |
| 2 | (track 2) | 45.00 – 60.00 | **coven** — night-vision camcorder, ring of 12 hooded figures → pit erupts & opens an eye, all heads turn up, dive into the pupil |
| 3 | LICORMX | 36.80 – 51.80 | **forest** — forest of giant witch hats → trunks open eyes, moon-eye, a giant rises; bass melts the world |
| 4 | NICHEGONENADO | 28.20 – 43.50 | **vortex** — infinite tunnel of blinking eyes → beat dies, the static figure returns (loops into the start) |

Pipeline:
```
npm i && pip install librosa
tools/make_mix.sh                  # audio/*.wav -> audio/mix.wav (cuts above)
python3 tools/make_timeline.py     # mix.wav -> timeline.json (loudness, bass, kicks)
node tools/capture.mjs stills out/ 3 20 40                  # quick stills (feedback warmed up)
node tools/capture.mjs video renders/out.mp4 4 audio/mix.wav # 270x480 -> 1080x1920 + audio
```
Source tracks go in `audio/` as `1_sprite.wav 2_track.wav 3_licormx.wav 4_nichegonenado.wav` (not committed).
