"""
Blender рендерийг аппын ассет болгох (системийн Python + Pillow)

  python tools/blender/postprocess.py <icons_dir> <ger-diorama.png> <ger-diorama.anchors.json>

1. Эд бүрийн дүрс: 384 → 192px (64dp × 3). PREMULTIPLIED alpha-аар
   жижигрүүлнэ — энгийн RGBA resize ирмэгт бараан хүрээ (halo) үлдээдэг.
2. Диорама: тунгалаг захыг тайрна. Ортографик кадрыг bound box-оор
   тооцдог тул цилиндр тавцангийн «булан» кадрыг тал бүрт ~14% томруулж,
   гэр картан дотор жижиг харагдаж байв.
3. Шошгоны цэгийг тайрсан кадрт дахин тооцоолж хэвлэнэ →
   apps/mobile/src/components/GerArt.tsx-ийн GER_ANCHORS, GER_DIORAMA_RATIO.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DST = os.path.join(ROOT, 'apps', 'mobile', 'assets', 'ger')
ICON = 192
PAD = 16


def icons(src):
    for f in sorted(os.listdir(src)):
        if not f.endswith('.png'):
            continue
        im = Image.open(os.path.join(src, f)).convert('RGBA')
        im = im.convert('RGBa').resize((ICON, ICON), Image.LANCZOS).convert('RGBA')
        out = os.path.join(DST, f)
        im.save(out, optimize=True)
        print(f'{f:24s} {os.path.getsize(out) // 1024:4d} KB')


def diorama(src, anchors_path):
    im = Image.open(src).convert('RGBA')
    W, H = im.size
    x0, y0, x1, y1 = im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
    box = (max(0, x0 - PAD), max(0, y0 - PAD), min(W, x1 + PAD), min(H, y1 + PAD))
    c = im.crop(box)
    out = os.path.join(DST, 'ger-diorama.png')
    c.save(out, optimize=True)
    cw, ch = c.size
    print(f'ger-diorama.png  {cw}x{ch}  GER_DIORAMA_RATIO = {ch} / {cw}  {os.path.getsize(out) // 1024} KB')
    with open(anchors_path, encoding='utf-8') as f:
        anchors = json.load(f)
    print('GER_ANCHORS:')
    for k, (u, v) in anchors.items():
        print(f'  {k}: [{(u * W - box[0]) / cw:.4f}, {(v * H - box[1]) / ch:.4f}],')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    os.makedirs(DST, exist_ok=True)
    icons(sys.argv[1])
    diorama(sys.argv[2], sys.argv[3])
