"""Crop the artist's artwork into small PS1-style textures (power-of-two, low-res)."""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1]           # folder with the original images
OUT = sys.argv[2]           # assets folder
os.makedirs(OUT, exist_ok=True)

def src(name): return Image.open(os.path.join(SRC, name)).convert("RGB")

def save(img, name, size):
    img = img.resize(size, Image.BILINEAR)
    img.save(os.path.join(OUT, name))

def key_white(img, thr=200, soft=40):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    lum = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    alpha = np.clip((thr + soft - lum) / soft, 0, 1)
    alpha = np.maximum(alpha, np.clip(sat / 60, 0, 1))
    rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")

# mandala: red on black -> red channel becomes alpha
m = src("b34df10f-image.jpg")
r = np.asarray(m)[:, :, 0]
rgba = np.dstack([np.full_like(r, 255), np.zeros_like(r), np.zeros_like(r), r])
Image.fromarray(rgba, "RGBA").resize((256, 256), Image.BILINEAR).save(f"{OUT}/mandala.png")

save(src("dd83d724-image.jpg"), "flowerman.png", (128, 128))
save(src("1a6a61b4-image.jpg"), "redF.png", (128, 128))
save(src("2523648f-image.jpg"), "claydoll.png", (128, 128))
save(src("18eb0bf9-image.jpg"), "creature.png", (128, 128))
save(src("0462b7ae-image.jpg"), "dollhead.png", (128, 128))

c = src("10f7ae45-image.jpg")
save(c.crop((345, 690, 635, 890)), "fieldman.png", (128, 64))
save(c.crop((35, 140, 280, 355)), "sackdoll.png", (128, 128))
save(c.crop((370, 405, 598, 588)), "glitchshrine.png", (128, 128))
key_white(c.crop((0, 375, 220, 630))).resize((64, 64), Image.BILINEAR).save(f"{OUT}/flowers.png")

lin = src("895bf7a9-image.jpg").crop((540, 60, 1400, 1300))
save(lin, "ghostline.png", (128, 128))

red = src("0ef7e646-image.jpg")
save(red.crop((0, 0, 1280, 420)), "redsmear.png", (256, 64))

# procedural stone + ground
rng = np.random.default_rng(7)
def noise(sz, octaves=4):
    out = np.zeros((sz, sz))
    for o in range(octaves):
        n = 2 ** (o + 2)
        g = rng.random((n, n))
        g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((sz, sz), Image.BICUBIC)) / 255
        out += g / (2 ** o)
    return out / out.max()
s = noise(64)
bricks = np.ones((64, 64))
bricks[::16, :] = 0.35
for row in range(4):
    off = 0 if row % 2 else 8
    for x in range(off, 64, 16): bricks[row*16:(row+1)*16, x] = 0.35
v = (0.25 + 0.45 * s) * bricks
Image.fromarray(np.dstack([v*210, v*200, v*205]).astype(np.uint8)).save(f"{OUT}/stone.png")
g = noise(64)
Image.fromarray(np.dstack([40 + g*90, 8 + g*14, 12 + g*14]).astype(np.uint8)).save(f"{OUT}/ground.png")
print("ok", sorted(os.listdir(OUT)))
