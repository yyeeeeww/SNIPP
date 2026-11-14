"""audio/mix.wav -> timeline.json (per-frame loudness/bass, kick & beat times, sections)."""
import json, numpy as np, librosa
FPS = 30
SECTIONS = [  # scene, duration, local drop time
    {"scene": "broadcast", "dur": 15.0, "drop": 1.75},
    {"scene": "coven",     "dur": 15.0, "drop": 1.78},
    {"scene": "forest",    "dur": 15.0, "drop": 2.40},
    {"scene": "vortex",    "dur": 15.3, "drop": 0.0, "out": 11.8},
]
y, sr = librosa.load("audio/mix.wav", sr=22050, mono=True)
hop = sr // FPS
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
rms = librosa.feature.rms(S=S)[0]
bass = S[fr < 140].mean(0)
def norm(x): x = x / (np.percentile(x, 97) + 1e-9); return np.clip(x, 0, 1)
env, bas = norm(rms), norm(bass)
# kicks: peaks of positive bass flux
flux = np.maximum(np.diff(bass, prepend=bass[0]), 0)
kick_fr = librosa.util.peak_pick(flux, pre_max=3, post_max=3, pre_avg=8, post_avg=8, delta=np.percentile(flux, 90) * 0.6, wait=6)
kicks = [round(float(k) / FPS, 3) for k in kick_fr]
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
on_fr = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop, backtrack=False)
onsets = [round(float(o) / FPS, 3) for o in on_fr]
json.dump({"fps": FPS, "sections": SECTIONS, "audio": "audio/mix.wav",
           "env": [round(float(v), 3) for v in env], "bass": [round(float(v), 3) for v in bas],
           "kicks": kicks, "onsets": onsets}, open("timeline.json", "w"))
print(len(env), "frames,", len(kicks), "kicks,", len(onsets), "onsets")
for i, s in enumerate(np.cumsum([0] + [x["dur"] for x in SECTIONS])[:-1]):
    print(SECTIONS[i]["scene"], [k for k in kicks if s <= k < s + SECTIONS[i]["dur"]][:12])
