"""Build a crisp high-res copy of reference/talex-logo.png (298x50).

The source is tiny, so plain upscaling looks soft. We upscale the alpha
coverage of the white and green parts separately, then re-threshold the
edges with a narrow smoothstep so contours stay sharp at display size.
Output keeps the exact brand colours of the source file.
"""
import pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "reference" / "talex-logo.png"
DST = ROOT / "shared" / "assets" / "talex-logo-hd.png"
SCALE = 6

im = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.float32) / 255.0
rgb, a = im[..., :3], im[..., 3]
green_rgb = np.array([110, 239, 0]) / 255.0
is_green = (rgb[..., 0] < 0.7) & (rgb[..., 1] > 0.5)
masks = [(a * ~is_green, np.ones(3)), (a * is_green, green_rgb)]

h, w = a.shape
size = (w * SCALE, h * SCALE)
def up(m):
    img = Image.fromarray((m * 255).astype(np.uint8), "L")
    return np.asarray(img.resize(size, Image.BICUBIC)).astype(np.float32) / 255.0

mw, mg = (up(m) for m, _ in masks)
cov = np.clip(mw + mg, 0, 1)
edge = 0.12  # half-width of the anti-aliased edge band
t = np.clip((cov - (0.5 - edge)) / (2 * edge), 0, 1)
alpha = t * t * (3 - 2 * t)
col = np.where((mg > mw)[..., None], green_rgb, np.ones(3))
out = np.dstack([col, alpha])
Image.fromarray((out * 255).round().astype(np.uint8), "RGBA").save(DST)
print(DST, size)
