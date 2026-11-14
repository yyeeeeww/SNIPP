import sys, numpy as np, librosa
for f in sys.argv[1:]:
    y, sr = librosa.load(f, sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    bt = librosa.frames_to_time(beats, sr=sr)
    rms = librosa.feature.rms(y=y, hop_length=512)[0]; t = librosa.times_like(rms, sr=sr, hop_length=512)
    on = librosa.onset.onset_strength(y=y, sr=sr)
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)); fr = librosa.fft_frequencies(sr=sr)
    low = S[fr < 150].mean(0)
    print(f"\n{f}: dur {len(y)/sr:.1f}s tempo {float(np.atleast_1d(tempo)[0]):.1f} first beat {bt[0]:.2f}")
    prof = []
    for s in range(0, int(len(y)/sr), 2):
        m = (t >= s) & (t < s+2); prof.append(f"{s}:{rms[m].mean()*100:.0f}/{low[m].mean():.0f}")
    print("  rms/bass per 2s:", " ".join(prof))
