"""
Монгол гэрийн диорама — «Миний гэр» дэлгэцийн гол ассет

ОРЛУУЛАХ: apps/mobile/assets/yurt-3d.jpg
  Асуудал нь чанар биш, ЦАГААН ДЭВСГЭР байв. JPEG альфа суваггүй тул
  аппын шөнийн хөх дэвсгэр дээр цагаан дөрвөлжин наасан мэт харагдана.

ЗОХИОМЖ:
  • Дугуй чулуун тавцан + алтан шигтгээ + ногоон зүлэг — изометрик диорама
  • Хан хана (торлог хана) — гэрийн хамгийн танигдам шинж
  • Унь (дээврийн шон) тооно руу цацарна; дээврийн ирмэгт хөх хээт тууз
  • Тооно — алтан хүрээтэй, ЯНДАНГААС ДУЛААН АЛТЛАГ УТАА суунаглана
  • Хаалга гадагш НЭЭЛТТЭЙ — дотроос гал голомтын шар гэрэл зүлгэн дээр
    цацарна (Монгол гэрийн хаалга гадагшаа нээгддэг)
  • Хаалган дээр УЛЗИЙ — аппын Ornament.tsx-ийн яг ижил замаас үүсгэсэн
  • Сарны хүйтэн гэрэл + дотоод дулаан гэрэл = шөнийн уур амьсгал
  • Тунгалаг дэвсгэр — аппын #080E18 шөнийн тэнгэр болж харагдана

ГАРАЛТ:
  <out>.png            — RGBA зураг
  <out>.anchors.json   — шошгоны цэгүүд (0..1, зүүн дээд буланаас).
                         Апп шошгыг яг тооно/хана/босгон дээр зааж байрлуулна.

Ажиллуулах:
  blender --background --factory-startup --python ger_diorama.py -- \
      --out ger.png --rx 900 --ry 830 --samples 96
"""
import json
import math
import os
import random
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nomad_lib as L  # noqa: E402

arg = L.cli_args()
OUT = arg('--out', 'ger.png')
RX = int(arg('--rx', '900'))
RY = int(arg('--ry', '830'))
SAMPLES = int(arg('--samples', '96'))
BLEND = arg('--blend', '')

sc = L.reset()
L.setup_render(sc, RX, RY, SAMPLES)
L.world(sc, '#1B2A46', 0.85)
# Бараан UI дээр ассет «тодрох» ёстой — харанхуй дэвсгэрт бүдэг зураг уусна
sc.view_settings.exposure = 0.35

# ─── Палитр — аппын theme/index.ts-тэй уялдана ─────────────────────
FELT = '#F1E6D0'
FELT_DK = '#E2D3B6'
WOOD = '#A4432A'
WOOD_DK = '#6A2817'
GOLD = '#DDB058'
INDIGO = '#22427C'
ROPE = '#3B2A1E'
STONE1, STONE2 = '#232C3B', '#4B5870'
GRASS1, GRASS2 = '#1A5638', '#3A8654'
RUG = '#8E2F26'

m_felt = L.add_noise_bump(L.mat('felt', FELT, rough=0.92, sheen=0.45), 60, 0.16)
m_roof = L.add_noise_bump(L.mat('felt_roof', FELT_DK, rough=0.95, sheen=0.3), 45, 0.2)
m_wood = L.add_noise_bump(L.mat('wood', WOOD, rough=0.48, coat=0.25), 25, 0.06)
m_wood_dk = L.mat('wood_dk', WOOD_DK, rough=0.6)
m_gold = L.mat('gold', GOLD, rough=0.22, metal=1.0)
m_indigo = L.add_noise_bump(L.mat('indigo', INDIGO, rough=0.85, sheen=0.6), 50, 0.12)
m_rope = L.mat('rope', ROPE, rough=0.85)
m_stone = L.add_noise_bump(
    L.add_color_variation(L.mat('stone', STONE1, rough=0.88), STONE1, STONE2, 3.5), 18, 0.35)
m_rock = L.add_noise_bump(
    L.add_color_variation(L.mat('rock', '#3A4557', rough=0.8), '#2B3444', '#6A7890', 4.0), 9, 0.5)
m_grass = L.add_noise_bump(
    L.add_color_variation(L.mat('grass', GRASS1, rough=0.95), GRASS1, GRASS2, 5.0), 90, 0.25)
m_blade = L.add_color_variation(
    L.mat('blade', GRASS2, rough=0.7, sheen=0.3), '#236B45', '#5A9C68', 5.0)
m_rug = L.mat('rug', RUG, rough=0.9, sheen=0.5)
m_fire = L.mat('fire', '#FF9A3C', rough=1.0, emit='#FF9A3C', emit_strength=16.0)

# ─── Хэмжээ ────────────────────────────────────────────────────────
R = 3.0            # хананы радиус
H = 1.55           # хананы өндөр
BASE = 0.40        # тавцангийн орой
GZ = BASE + 0.025  # гэрийн суурь (зүлэгний орой)
ROOF_RISE = 1.45
EAVE = R + 0.20
TOONO_R = 0.46
DOOR_W = 0.98
DOOR_H = 1.22
FW = 0.12          # хаалганы хүрээний өргөн
RZ0 = GZ + H
RZ1 = RZ0 + ROOF_RISE
PLAT_R = 4.35

# ─── 1. Тавцан ─────────────────────────────────────────────────────
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=PLAT_R, depth=0.42, location=(0, 0, 0.19))
plat = L.active()
L.assign(plat, m_stone)
L.bevel(plat, 0.07, 4)
L.smooth(plat)

bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=4.22, depth=0.06, location=(0, 0, BASE - 0.005))
grass = L.active()
L.assign(grass, m_grass)
L.bevel(grass, 0.03, 3)
L.smooth(grass)

# Алтан шигтгээ — тавцангийн ирмэгийг аппын алтан хүрээтэй уялдуулна
bpy.ops.mesh.primitive_torus_add(
    major_radius=4.27, minor_radius=0.024, major_segments=192, minor_segments=12,
    location=(0, 0, BASE + 0.004))
L.assign(L.active(), m_gold)
L.smooth(L.active())

rnd = random.Random(7)


def grass_blades(n=5200):
    """Өвсний ир — гурвалжин бүр. Хаалганы өмнөх чулуун замыг чөлөөлнө."""
    verts, faces = [], []
    z0 = GZ - 0.006
    for _ in range(n):
        r = math.sqrt(rnd.uniform((R + 0.1) ** 2, 4.17 ** 2))
        a = rnd.uniform(0, 2 * math.pi)
        x, y = r * math.cos(a), r * math.sin(a)
        if abs(x) < 0.42 and y < -R:
            continue
        h = rnd.uniform(0.03, 0.085)
        w = rnd.uniform(0.012, 0.022)
        ang = rnd.uniform(0, math.pi)
        dx, dy = math.cos(ang) * w / 2, math.sin(ang) * w / 2
        lx, ly = rnd.uniform(-0.025, 0.025), rnd.uniform(-0.025, 0.025)
        b = len(verts)
        verts += [(x - dx, y - dy, z0), (x + dx, y + dy, z0), (x + lx, y + ly, z0 + h)]
        faces.append((b, b + 1, b + 2))
    return L.mesh_from('grass_blades', verts, faces)


L.assign(grass_blades(), m_blade)


def rock(loc, size, rot, mat_):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc)
    o = L.active()
    for v in o.data.vertices:
        v.co += Vector((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2)))
    o.scale = size
    o.rotation_euler = rot
    L.apply_scale(o)
    sub = o.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 2
    L.assign(o, mat_)
    L.smooth(o, 60)
    return o


# Ирмэгийн чулуу — хаалганы өмнөхийг чөлөөлнө
for _ in range(14):
    a = rnd.uniform(0, 2 * math.pi)
    if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.45:
        continue
    r = rnd.uniform(3.6, 4.05)
    rock((r * math.cos(a), r * math.sin(a), GZ + 0.015),
         (rnd.uniform(0.09, 0.2), rnd.uniform(0.08, 0.15), rnd.uniform(0.05, 0.11)),
         (rnd.uniform(0, 0.4), rnd.uniform(0, 0.4), rnd.uniform(0, 6.28)), m_rock)

# Хаалга руу хөтлөх чулуун зам
for i, (sx, sy) in enumerate(((0.06, -3.55), (-0.1, -3.85), (0.08, -4.1))):
    rock((sx, sy, GZ - 0.005),
         (0.24 - i * 0.02, 0.19 - i * 0.015, 0.045),
         (0, 0, rnd.uniform(0, 6.28)), m_rock)

# ─── 2. Хана — хоосон бүрхүүл (хаалганы нүхээр дотор харагдах ёстой) ──
bpy.ops.mesh.primitive_cylinder_add(
    vertices=160, radius=R, depth=H, end_fill_type='NOTHING', location=(0, 0, GZ + H / 2))
wall = L.active()
L.assign(wall, m_felt)
L.solidify(wall, 0.08)
L.apply_all(wall)
L.smooth(wall, 30)

DOOR_GAP = DOOR_W / 2 + FW + 0.015
DOOR_TOP = DOOR_H + FW + 0.015


def in_door(x, y, z):
    return y < 0 and abs(x) < DOOR_GAP and z < DOOR_TOP


def lattice(M=46, width=0.058, t=0.038, segs=20):
    """
    Хан хана — 45° налуутай хоёр чиглэлийн мушгиа тууз.

    ⚠ Шулуун хайрцгаар хийвэл цилиндрийн гадаргуугаас ~8см ХОЛДОНО
      (27° нумыг шулуун шугам хөндлөн огтолдог). Тиймээс тууз бүрийг
      гадаргуу дагуу 20 хэсэгт хувааж мушгиагаар барина.

    ⚠ Хаалганы нүхийг BOOLEAN-аар гаргаж болохгүй: хоёр чиглэлийн тууз
      хоорондоо огтлолцдог тул EXACT solver торыг бүхэлд нь устгасан.
      Оронд нь хаалганы хэсэгт орох сегментийг үүсгэхгүй алгасна.
    """
    verts, faces = [], []
    wh = width * math.sqrt(2)  # 45°-д перпендикуляр өргөнийг хэвтээ болгож хөрвүүлнэ
    r0, r1 = R + 0.012, R + 0.012 + t
    prof = ((-wh / 2, r0), (wh / 2, r0), (wh / 2, r1), (-wh / 2, r1))

    def ring(s_c, z):
        return [(rr * math.cos((s_c + ds) / R), rr * math.sin((s_c + ds) / R), GZ + z)
                for ds, rr in prof]

    for direction in (1, -1):
        for i in range(M):
            th0 = 2 * math.pi * i / M
            for k in range(segs):
                za, zb = H * k / segs, H * (k + 1) / segs
                zm = (za + zb) / 2
                sm = th0 * R + direction * zm
                if in_door(R * math.cos(sm / R), R * math.sin(sm / R), zm):
                    continue
                b = len(verts)
                verts += ring(th0 * R + direction * za, za)
                verts += ring(th0 * R + direction * zb, zb)
                for j in range(4):
                    j2 = (j + 1) % 4
                    faces.append((b + j, b + j2, b + 4 + j2, b + 4 + j))
                faces.append((b + 3, b + 2, b + 1, b))
                faces.append((b + 4, b + 5, b + 6, b + 7))
    return L.mesh_from('lattice', verts, faces)


L.assign(lattice(), m_wood)

# Бүслүүр — хананы гурван олс
bands = []
for zf in (0.16, 0.54, 0.92):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=R + 0.06, minor_radius=0.032, major_segments=160, minor_segments=12,
        location=(0, 0, GZ + H * zf))
    b = L.active()
    L.assign(b, m_rope)
    L.smooth(b)
    bands.append(b)

# Хананы дээд хүрээ
bpy.ops.mesh.primitive_torus_add(
    major_radius=R + 0.03, minor_radius=0.05, major_segments=160, minor_segments=12, location=(0, 0, RZ0))
L.assign(L.active(), m_wood_dk)
L.smooth(L.active())

# ─── 3. Дээвэр ─────────────────────────────────────────────────────
bpy.ops.mesh.primitive_cone_add(
    vertices=160, radius1=EAVE, radius2=TOONO_R, depth=ROOF_RISE,
    end_fill_type='NOTHING', location=(0, 0, (RZ0 + RZ1) / 2))
roof = L.active()
L.assign(roof, m_roof)
L.solidify(roof, 0.09)
L.apply_all(roof)
L.smooth(roof, 30)

bpy.ops.mesh.primitive_torus_add(
    major_radius=EAVE, minor_radius=0.055, major_segments=160, minor_segments=12, location=(0, 0, RZ0))
L.assign(L.active(), m_wood_dk)
L.smooth(L.active())

r1, z1 = EAVE - 0.02, RZ0 + 0.01
r2, z2 = TOONO_R + 0.02, RZ1 - 0.01
dr, dz = r2 - r1, z2 - z1
ln = math.hypot(dr, dz)
NR, NZ = dz / ln, -dr / ln  # конусын гадагш нормаль (r,z) хавтгайд


def cone_pt(t, off):
    return r1 + dr * t + NR * off, z1 + dz * t + NZ * off


def ribs(N=40, w=0.07, lift=0.035, segs=10):
    """Унь — тооно руу цацарсан шон, дээврийн гадаргууд наалдсан."""
    verts, faces = [], []
    for i in range(N):
        ph = 2 * math.pi * (i + 0.5) / N
        start = len(verts)
        for k in range(segs + 1):
            t = k / segs
            rb, _ = cone_pt(t, 0)
            half = w / 2 / max(rb, 0.2)
            for dphi, off in ((-half, 0.0), (half, 0.0), (half, lift), (-half, lift)):
                rr, zz = cone_pt(t, off)
                a = ph + dphi
                verts.append((rr * math.cos(a), rr * math.sin(a), zz))
        for k in range(segs):
            a = start + k * 4
            b = a + 4
            for j in range(4):
                j2 = (j + 1) % 4
                faces.append((a + j, a + j2, b + j2, b + j))
        faces.append((start + 3, start + 2, start + 1, start))
        e = start + segs * 4
        faces.append((e, e + 1, e + 2, e + 3))
    return L.mesh_from('uni', verts, faces)


L.assign(ribs(), m_wood)


def roof_band(t0, t1, off, n=192):
    """Дээврийн ирмэгийн хөх тууз — уламжлалт гэрийн дээврийн хээтэй хүрээ."""
    verts, faces = [], []
    ra, za = cone_pt(t0, off)
    rb, zb = cone_pt(t1, off)
    for i in range(n):
        a = 2 * math.pi * i / n
        verts += [(ra * math.cos(a), ra * math.sin(a), za), (rb * math.cos(a), rb * math.sin(a), zb)]
    for i in range(n):
        j = (i + 1) % n
        faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    o = L.mesh_from('roof_band', verts, faces)
    L.solidify(o, 0.03)
    return o


band = roof_band(0.0, 0.14, 0.05)
L.assign(band, m_indigo)
L.smooth(band)
for t, off in ((0.14, 0.075), (0.005, 0.07)):
    rr, zz = cone_pt(t, off)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=rr, minor_radius=0.016, major_segments=192, minor_segments=10, location=(0, 0, zz))
    L.assign(L.active(), m_gold)
    L.smooth(L.active())

for t in (0.42, 0.72):
    rr, zz = cone_pt(t, 0.045)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=rr, minor_radius=0.026, major_segments=128, minor_segments=10, location=(0, 0, zz))
    L.assign(L.active(), m_rope)
    L.smooth(L.active())

# ─── 4. Тооно + яндан + утаа ───────────────────────────────────────
bpy.ops.mesh.primitive_torus_add(
    major_radius=TOONO_R + 0.02, minor_radius=0.078, major_segments=64, minor_segments=16,
    location=(0, 0, RZ1))
L.assign(L.active(), m_wood)
L.smooth(L.active())

bpy.ops.mesh.primitive_uv_sphere_add(radius=TOONO_R, segments=48, ring_count=24, location=(0, 0, RZ1))
dome = L.active()
dome.scale = (1, 1, 0.28)
L.assign(dome, m_roof)
L.smooth(dome)

bpy.ops.mesh.primitive_torus_add(
    major_radius=TOONO_R + 0.02, minor_radius=0.024, major_segments=64, minor_segments=10,
    location=(0, 0, RZ1 + 0.075))
L.assign(L.active(), m_gold)
L.smooth(L.active())

PIPE_H = 0.55
PIPE_TOP = RZ1 + PIPE_H
PX, PY = 0.12, 0.10
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.085, depth=PIPE_H, location=(PX, PY, RZ1 + PIPE_H / 2))
L.assign(L.active(), m_wood_dk)
L.smooth(L.active())
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.115, depth=0.045, location=(PX, PY, PIPE_TOP))
L.assign(L.active(), m_gold)
L.smooth(L.active())

# Утаа — давхацсан зөөлөн бөмбөлгүүд. Дээшлэх тусам тэлж, сийрэгжиж,
# салхинд баруун тийш хийснэ. Доод хэсэг нь галын гэрлээр алтлаг гэрэлтэнэ.
PLUME = 14
for i in range(PLUME):
    t = i / (PLUME - 1)
    z = PIPE_TOP + 0.08 + t * 1.7
    x = PX + 0.8 * t ** 1.5 + 0.05 * math.sin(i * 1.9)
    y = PY + 0.1 * t
    rad = 0.14 + 0.42 * t
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=(x, y, z))
    o = L.active()
    o.scale = (rad, rad, rad * 0.85)
    L.assign(o, L.soft_volume_mat(
        f'smoke{i}', '#F8DDB0', density=24.0 * (1 - t * 0.8),
        emit='#FFBE55', emit_strength=8.0 * (1 - t) ** 1.3,
        noise_scale=1.6, seed=i * 1.37, falloff_pow=1.3, lo=0.12, hi=0.7))

# Тоононоос дээш цацрах дулаан гэрэл — утааг доороос нь алтлаг гэрэлтүүлнэ
L.point_light('toono_glow', (PX, PY, PIPE_TOP + 0.15), 90, 0.2, '#FFB04A')

# ─── 5. Хаалга ─────────────────────────────────────────────────────
# Хана болон олсонд нүх гаргана (тэдгээр нь огтлолцолгүй тул boolean аюулгүй)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -R, GZ + DOOR_H / 2 - 0.1))
cut = L.active()
cut.scale = (DOOR_W, 0.7, DOOR_H + 0.2)
L.apply_scale(cut)
for ob in [wall] + bands:
    L.boolean_diff(ob, cut)
bpy.data.objects.remove(cut, do_unlink=True)

JY = -R - 0.02
L.box('jambL', (FW, 0.16, DOOR_H + FW), (-DOOR_W / 2 - FW / 2, JY, GZ + (DOOR_H + FW) / 2), m_wood)
L.box('jambR', (FW, 0.16, DOOR_H + FW), (DOOR_W / 2 + FW / 2, JY, GZ + (DOOR_H + FW) / 2), m_wood)
L.box('lintel', (DOOR_W + 2 * FW, 0.16, FW), (0, JY, GZ + DOOR_H + FW / 2), m_wood)
L.box('lintelGold', (DOOR_W + 2 * FW - 0.04, 0.02, 0.035),
      (0, JY - 0.085, GZ + DOOR_H + FW / 2), m_gold, bev=0.006)
for sx in (-1, 1):
    L.box(f'jambGold{sx}', (0.03, 0.02, DOOR_H - 0.04),
          (sx * (DOOR_W / 2 + FW / 2), JY - 0.085, GZ + DOOR_H / 2), m_gold, bev=0.006)

# Нугас — зүүн талд, 40° хагас нээлттэй.
#   ⚠ Камер баруун урдаас харна. Хаалгыг их нээвэл навч нь камерт
#     ХАЖУУГААРАА харагдаж улзий алга болно; хаавал дотоод гэрэл харагдахгүй.
#     40° үед улзийтэй гадна нүүр камер руу хандаж, баруун хагас нүхээр
#     дотоод гал голомтын гэрэл цацарна.
hinge = bpy.data.objects.new('hinge', None)
bpy.context.collection.objects.link(hinge)
hinge.location = (-DOOR_W / 2, -R - 0.04, GZ)

LEAF_T = 0.07
bpy.ops.mesh.primitive_cube_add(size=1, location=(DOOR_W / 2, 0, DOOR_H / 2))
leaf = L.active()
leaf.scale = (DOOR_W - 0.02, LEAF_T, DOOR_H - 0.02)
L.apply_scale(leaf)
L.assign(leaf, m_wood)
L.bevel(leaf, 0.015, 2)
leaf.parent = hinge

FY = -LEAF_T / 2 - 0.006  # навчны ГАДНА гадаргуу (−Y)
IW, IH = DOOR_W - 0.16, DOOR_H - 0.18
cx0, cz0 = DOOR_W / 2, DOOR_H / 2
rect = [(cx0 - IW / 2, FY, cz0 - IH / 2), (cx0 + IW / 2, FY, cz0 - IH / 2),
        (cx0 + IW / 2, FY, cz0 + IH / 2), (cx0 - IW / 2, FY, cz0 + IH / 2)]
trim = L.poly_curve('trim', [rect], 0.014, [True])
L.assign(trim, m_gold)
trim.parent = hinge

# Улзий — Ornament.tsx-ийн яг ижил зам (viewBox 0 0 120 120)
KS = 0.46
KZ = DOOR_H * 0.56


def P(x, y):
    return (cx0 + (x - 60) / 120 * KS, FY, KZ + (60 - y) / 120 * KS)


ulzii_loop = [P(40, 30), P(80, 30), P(80, 50), P(60, 50), P(60, 70), P(80, 70),
              P(80, 90), P(40, 90), P(40, 70), P(60, 70), P(60, 50), P(40, 50)]
ulzii = L.poly_curve('ulzii', [
    ulzii_loop,
    [P(30, 40), P(30, 80)], [P(90, 40), P(90, 80)],
    [P(30, 40), P(50, 40)], [P(70, 40), P(90, 40)],
    [P(30, 80), P(50, 80)], [P(70, 80), P(90, 80)],
], 0.011, [True] + [False] * 6)
L.assign(ulzii, m_gold)
ulzii.parent = hinge

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(DOOR_W - 0.14, FY - 0.02, DOOR_H * 0.45))
knob = L.active()
L.assign(knob, m_gold)
L.smooth(knob)
knob.parent = hinge

hinge.rotation_euler = (0, 0, math.radians(-40))

L.box('bosgo', (DOOR_W + 0.34, 0.34, 0.08), (0, -R - 0.18, GZ + 0.04), m_wood_dk)
L.box('bosgoGold', (DOOR_W + 0.28, 0.02, 0.025), (0, -R - 0.355, GZ + 0.05), m_gold, bev=0.005)

# ─── 6. Дотор — гал голомт ба ширдэг ───────────────────────────────
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=R - 0.12, depth=0.02, location=(0, 0, GZ + 0.012))
L.assign(L.active(), m_rug)
bpy.ops.mesh.primitive_torus_add(
    major_radius=R - 0.45, minor_radius=0.018, major_segments=128, minor_segments=8,
    location=(0, 0, GZ + 0.024))
L.assign(L.active(), m_gold)

bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.32, depth=0.42, location=(0, 0.35, GZ + 0.21))
L.assign(L.active(), m_wood_dk)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(0, 0.35, GZ + 0.46))
fire = L.active()
fire.scale = (1, 1, 0.6)
L.assign(fire, m_fire)

L.point_light('inside', (0.1, -0.5, GZ + 1.0), 420, 0.7, '#FFB25A')
# Хаалгаар гадагш цацрах гэрэл — нүх нь өөрөө «гобо» болж зүлгэн дээр
# шар трапец гэрэл тусгана
L.spot_light('doorspill', (0, -R + 0.9, GZ + 1.05), (0.2, -R - 1.3, GZ), 3200, 75, 0.5, 0.12, '#FFB45C')

# ─── 7. Шөнийн гэрэлтүүлэг ─────────────────────────────────────────
# Сар нь бараг цагаан — хэт хөх бол цөцгий эсгий саарал-ягаан болж
# «шөнө» биш «бохир» харагддаг. Шөнийн мэдрэмжийг дулаан дотоод гэрэл,
# хүйтэн оюу rim хоёрын ялгаа л бүтээнэ.
c = Vector((0, 0, GZ + 1.2))
L.area_light('moon', c + Vector((-7, -5, 9)), c, 3600, 6, '#E6ECFF')
L.area_light('rim', c + Vector((6, 8, 5)), c, 2200, 6, '#86E0EA')
L.area_light('fill', c + Vector((9, -6, 1.5)), c, 600, 8, '#A9B8E0')

cam = L.ortho_camera(sc, az_deg=24, el_deg=27, target=(0, 0, GZ + 1.2))
L.frame(sc, cam, [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE')], pad=1.05)

# ─── 8. Шошгоны цэгүүд ─────────────────────────────────────────────
wa = math.radians(-128)
anchors = {
    'toono': (0, 0, RZ1 + 0.1),
    'khana': (R * math.cos(wa), R * math.sin(wa), GZ + H * 0.55),
    'bosgo': (0, -R - 0.2, GZ + 0.06),
}
res = {}
for k, p in anchors.items():
    v = world_to_camera_view(sc, cam, Vector(p))
    res[k] = [round(v.x, 4), round(1 - v.y, 4)]
    print('ANCHOR', k, res[k][0], res[k][1])
with open(os.path.splitext(OUT)[0] + '.anchors.json', 'w', encoding='utf-8') as f:
    json.dump(res, f, indent=2)

L.render(sc, OUT, BLEND or None)
