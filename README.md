# snippet — fav universe, PS1/Dreamcast wizard creep

Real-time three.js scene rendered offline frame-by-frame (deterministic in time `t`).

- `src/main.js` — scenes (field → circle → tower → head), PS1 shader (vertex snapping, affine UVs, vertex fog, Gouraud),
  post (15-bit color + Bayer dither, scanlines, chroma, glitch, subliminal flashes)
- `assets/` — low-res textures cropped from the artwork (`tools/prep_textures.py`)
- `timeline.json` (optional) — section durations, per-frame audio envelope, onsets, audio path

Render:
```
npm i
node tools/capture.mjs stills out/ 3 12 25        # quick stills
node tools/capture.mjs video renders/out.mp4 4 audio/mix.wav   # 270x480 -> 1080x1920
```
Live preview: `python3 -m http.server` and open `index.html` (`?t=30` to jump).
