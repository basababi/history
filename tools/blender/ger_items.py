"""
Миний гэр — эд зүйлсийн 3D дүрс (12 эд + түгжээний гэрэгэ)

ОРЛУУЛАХ: MuseumScreen дахь emoji (🟫 🧶 🪟 🎴 🧰 ⚱️ 🎻 🪕 ☀️ ☸️ 🕯️ 🔥 🔒)
  Emoji нь төхөөрөмж бүрт өөр харагддаг (Samsung ≠ iOS ≠ Pixel) бөгөөд
  «Хүннүгийн хүрэл тогоо»-г ⚱️ (Грекийн ваар), «Ятга»-г 🪕 (банжо) гэж
  харуулж байсан — соёлын хувьд буруу. Энд эд бүрийг жинхэнэ хэлбэрээр нь
  загварчилна.

НЭГДМЭЛ ХЭВ МАЯГ:
  • Ижил гэрэлтүүлэг (дулаан key + оюу rim + хүйтэн fill) — бүх дүрс нэг
    «гэр бүл» мэт харагдана
  • Ижил алтан материал, ижил УЛЗИЙ ба ЭВЭР УГАЛЗ хээ — аппын Ornament.tsx
  • Тунгалаг дэвсгэр, ортографик камер

ХЭЭНИЙ ЭХ СУРВАЛЖ:
  • Улзий — Ornament.tsx-ийн яг ижил зам (viewBox 120)
  • Эвэр угалз — ишнээс хоёр тийш мушгирсан хуцны эвэр (спираль)
  • Соёмбо — дээрээс доош: гал, нар, сар, гурвалжин, хэвтээ тэгш өнцөгт,
    арга билэг (тайжи), хэвтээ тэгш өнцөгт, гурвалжин; хоёр талд босоо багана
  • Гэрэгэ (пайз) — Их Монгол Улсын эрх мэдлийн алтан тэмдэг; «түгжээтэй»
    төлөвийн дүрс. 🔒-ийн оронд түүхэн утгатай.

Ажиллуулах:
  blender --background --factory-startup --python ger_items.py -- \
      --outdir <dir> --res 320 --samples 64 [--only chest_wood,zul]
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nomad_lib as L  # noqa: E402

arg = L.cli_args()
OUTDIR = arg('--outdir', '.')
RES = int(arg('--res', '320'))
SAMPLES = int(arg('--samples', '64'))
ONLY = [s for s in arg('--only', '').split(',') if s]
FLOOR_SHADOW = arg('--floor-shadow', '0') == '1'

# Эргэлтийн бие, бөмбөрцөг, цагиргийн сегментийн үржүүлэгч. Рендерт 1.0;
# ger_realtime.py нь эдийг утсан дээр бодит цагт харуулахдаа бууруулна.
SEG_SCALE = 1.0

GOLD = '#DDB058'
INDIGO = '#22427C'


# ═══ 2D хээ ═════════════════════════════════════════════════════════
# Бүх хээ (x, y) хавтгайд, ойролцоогоор [-0.5, 0.5] хүрээнд. Сплайн бүр
# (цэгүүд, битүү эсэх) хос.

def ulzii_2d():
    """Улзий — Ornament.tsx-ийн яг ижил зам."""
    def p(x, y):
        return ((x - 60) / 120, (60 - y) / 120)
    loop = [p(40, 30), p(80, 30), p(80, 50), p(60, 50), p(60, 70), p(80, 70),
            p(80, 90), p(40, 90), p(40, 70), p(60, 70), p(60, 50), p(40, 50)]
    bars = [[p(30, 40), p(30, 80)], [p(90, 40), p(90, 80)],
            [p(30, 40), p(50, 40)], [p(70, 40), p(90, 40)],
            [p(30, 80), p(50, 80)], [p(70, 80), p(90, 80)]]
    return [(loop, True)] + [(b, False) for b in bars]


def horn_pair_2d(turns=0.8, n=36):
    """
    Эвэр угалз — (0,0)-оос дээш иш, оройноос нь хоёр тийш мушгирсан эвэр.
    Нэгж өндөр ~1.0. Спираль r = r0·(1 − 0.7f) — төв рүү аажмаар ороно.
    """
    r0, top = 0.3, 0.45
    left = []
    for i in range(n + 1):
        f = i / n
        th = 2 * math.pi * turns * f
        r = r0 * (1 - 0.7 * f)
        left.append((-r0 + r * math.cos(th), top + r * math.sin(th)))
    right = [(-x, y) for x, y in left]
    return [([(0, 0), (0, top)], False), (left, False), (right, False)]


def xf(splines, scale=1.0, rot=0.0, off=(0.0, 0.0)):
    c, s = math.cos(rot), math.sin(rot)
    return [([(off[0] + scale * (x * c - y * s), off[1] + scale * (x * s + y * c)) for x, y in pts], cyc)
            for pts, cyc in splines]


def toward(frm, to):
    """Эвэр угалзын иш (+Y) `frm`-ээс `to` руу харах эргэлт."""
    return math.atan2(to[1] - frm[1], to[0] - frm[0]) - math.pi / 2


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def circ(r, n=32, cx=0.0, cy=0.0, a0=0.0, a1=2 * math.pi, closed=True):
    m = n if closed else n + 1
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n))
            for i in range(m)]


def rrect(w, h, r, n=6, cx=0.0, cy=0.0):
    pts = []
    for qx, qy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + qx + r * math.cos(a), cy + qy + r * math.sin(a)))
    return pts


def densify(pts, step, closed=True):
    """Нугалаастай даавуун дээр хээ гадаргууг дагахын тулд цэг нягтруулна."""
    out = []
    seq = pts + [pts[0]] if closed else pts
    for (x0, y0), (x1, y1) in zip(seq, seq[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        for i in range(n):
            out.append((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))
    if not closed:
        out.append(pts[-1])
    return out


def soyombo_2d():
    """
    Соёмбо — нэгж өндөр ~1.4 (y: −0.46 … 0.95), тайжи тусдаа.
    Дээрээс доош: гал, нар, сар, гурвалжин, тэгш өнцөгт, [тайжи],
    тэгш өнцөгт, гурвалжин; хоёр талд босоо багана.
    """
    P = [
        rect(-0.25, -0.46, -0.19, 0.36), rect(0.19, -0.46, 0.25, 0.36),
        [(-0.15, -0.30), (0.15, -0.30), (0.0, -0.46)],
        rect(-0.15, -0.27, 0.15, -0.21),
        rect(-0.15, 0.11, 0.15, 0.17),
        [(-0.15, 0.36), (0.15, 0.36), (0.0, 0.20)],
    ]
    outer = circ(0.13, 20, 0, 0.42, math.pi, 2 * math.pi, closed=False)
    inner = circ(0.105, 20, 0, 0.45, 2 * math.pi, math.pi, closed=False)
    P.append(outer + inner)
    P.append(circ(0.075, 28, 0, 0.53))
    P.append([(-0.14, 0.62), (-0.13, 0.70), (-0.09, 0.80), (-0.06, 0.70), (-0.035, 0.79),
              (0.0, 0.95), (0.035, 0.79), (0.06, 0.70), (0.09, 0.80), (0.13, 0.70), (0.14, 0.62)])
    return P


def taiji_s(cy=-0.05, r=0.13, n=16):
    """Тайжийн S зураас — арга билгийг хуваах."""
    up = circ(r / 2, n, 0, cy + r / 2, math.pi / 2, 3 * math.pi / 2, closed=False)
    lo = circ(r / 2, n, 0, cy - r / 2, math.pi / 2, -math.pi / 2, closed=False)
    return up + lo[1:]


# ═══ 3D барилгын туслах ═══════════════════════════════════════════════

def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    e.rotation_euler = rot
    e.scale = (scale, scale, scale)
    if parent:
        e.parent = parent
    return e


def cord(name, splines, z, depth, mat, parent=None, surf=None):
    """Бевелтэй муруй — алтан утас, зээг (наамлын хүрээ)."""
    s3, cyc = [], []
    for pts, c in splines:
        s3.append([surf(x, y) if surf else (x, y, z) for x, y in pts])
        cyc.append(c)
    ob = L.poly_curve(name, s3, depth, cyc)
    L.assign(ob, mat)
    if parent:
        ob.parent = parent
    return ob


def plate(name, polys, z0, thick, mat, parent=None, bev=0.004):
    """Хавтгай олон өнцөгтүүдийг зузаатгана — наамал, будгийн хавтан, тэмдэг."""
    verts, faces = [], []
    for pts in polys:
        area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))
        if area < 0:
            pts = pts[::-1]
        b = len(verts)
        verts += [(x, y, z0) for x, y in pts]
        faces.append(list(range(b, b + len(pts))))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    md = ob.modifiers.new('S', 'SOLIDIFY')
    md.thickness = thick
    md.offset = 1.0
    if bev:
        bv = ob.modifiers.new('B', 'BEVEL')
        bv.width = bev
        bv.segments = 2
        bv.limit_method = 'ANGLE'
    L.assign(ob, mat)
    if parent:
        ob.parent = parent
    return ob


def lathe(name, prof, mat, seg=96, sharp=40):
    """Эргэлтийн бие (r, z) профилоос — зул, тогоо."""
    import bmesh
    seg = max(12, round(seg * SEG_SCALE))
    verts, faces = [], []
    n = len(prof)
    for j in range(seg):
        a = 2 * math.pi * j / seg
        for r, z in prof:
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for j in range(seg):
        j2 = (j + 1) % seg
        for i in range(n - 1):
            faces.append((j * n + i, j2 * n + i, j2 * n + i + 1, j * n + i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    L.assign(ob, mat)
    L.smooth(ob, sharp)
    return ob


def rod(p0, p1, r0, r1, mat, verts=16):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=d.length,
                                    location=(p0 + p1) / 2)
    o = L.active()
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    L.assign(o, mat)
    L.smooth(o)
    return o


def sphere(loc, r, mat, scale=(1, 1, 1), seg=24):
    seg = max(8, round(seg * SEG_SCALE))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2, location=loc)
    o = L.active()
    o.scale = scale
    L.assign(o, mat)
    L.smooth(o)
    return o


def torus(loc, R, r, mat, rot=(0, 0, 0), seg=96):
    seg = max(12, round(seg * SEG_SCALE))
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg,
                                     minor_segments=12, location=loc, rotation=rot)
    o = L.active()
    L.assign(o, mat)
    L.smooth(o)
    return o


def glow(loc, r, color, strength, density=0.6, seed=0.0):
    """Галын эргэн тойрны зөөлөн туяа — эзэлхүүнт гэрэл."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=loc)
    o = L.active()
    o.scale = (r, r, r)
    L.assign(o, L.soft_volume_mat('glow', color, density, emit=color, emit_strength=strength,
                                  noise_scale=1.2, seed=seed, falloff_pow=2.2, lo=0.0, hi=1.0))
    return o


# ═══ Материал ═════════════════════════════════════════════════════════

def quilt(m, scale=5.2, strength=0.45, groove=0.93):
    """
    Ширдэгийн сырмал оёдол — 45°-аар огтлолцсон хоёр чиглэлийн ховил.
    Хавтгай эсгийг «ширдэг» болгодог гол шинж.
    """
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    hs = []
    for ang in (45, -45):
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(ang))
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        wv = nt.nodes.new('ShaderNodeTexWave')
        wv.wave_type = 'BANDS'
        wv.bands_direction = 'X'
        wv.inputs['Scale'].default_value = scale
        wv.inputs['Distortion'].default_value = 0.0
        wv.inputs['Detail'].default_value = 0.0
        nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.clamp = True
        mr.inputs['From Min'].default_value = groove
        mr.inputs['From Max'].default_value = 1.0
        mr.inputs['To Min'].default_value = 1.0
        mr.inputs['To Max'].default_value = 0.0
        nt.links.new(wv.outputs['Fac'], mr.inputs['Value'])
        hs.append(mr)
    mn = nt.nodes.new('ShaderNodeMath')
    mn.operation = 'MINIMUM'
    nt.links.new(hs[0].outputs['Result'], mn.inputs[0])
    nt.links.new(hs[1].outputs['Result'], mn.inputs[1])
    bq = nt.nodes.new('ShaderNodeBump')
    bq.inputs['Strength'].default_value = strength
    bq.inputs['Distance'].default_value = 0.02
    nt.links.new(mn.outputs['Value'], bq.inputs['Height'])

    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 80.0
    nz.inputs['Detail'].default_value = 6.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    bf = nt.nodes.new('ShaderNodeBump')
    bf.inputs['Strength'].default_value = 0.15
    nt.links.new(nz.outputs['Fac'], bf.inputs['Height'])
    nt.links.new(bq.outputs['Normal'], bf.inputs['Normal'])
    nt.links.new(bf.outputs['Normal'], b.inputs['Normal'])
    return m


def wood_grain(m, c1, c2, scale=3.0):
    """Модны ширхэг — урт тэнхлэг (X) дагуу."""
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    wv = nt.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.bands_direction = 'Y'
    wv.inputs['Scale'].default_value = scale
    wv.inputs['Distortion'].default_value = 6.0
    wv.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = L.hexc(c1)
    ramp.color_ramp.elements[1].color = L.hexc(c2)
    nt.links.new(wv.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def bronze_mat():
    """Хүрэл + ногоон зэвийн толбо (патина) — 2000 жилийн настай хүрэл."""
    m = L.mat('bronze', '#B9854E', rough=0.35, metal=0.9)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.2
    nz.inputs['Detail'].default_value = 8.0
    nz.inputs['Roughness'].default_value = 0.6
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.30, L.hexc('#D29A5C')
    el[1].position, el[1].color = 0.56, L.hexc('#9C6A38')
    e2 = el.new(0.7)
    e2.color = L.hexc('#4F8A74')
    e3 = el.new(0.9)
    e3.color = L.hexc('#86B9A2')
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    for sock, a, c in (('Roughness', 0.28, 0.8), ('Metallic', 0.95, 0.15)):
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.clamp = True
        mr.inputs['From Min'].default_value = 0.62
        mr.inputs['From Max'].default_value = 0.74
        mr.inputs['To Min'].default_value = a
        mr.inputs['To Max'].default_value = c
        nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], b.inputs[sock])
    return m


def mats():
    return {
        'gold': L.mat('gold', GOLD, rough=0.2, metal=1.0),
        'gold_dim': L.mat('gold_dim', '#B88832', rough=0.36, metal=1.0),
        'wood': L.add_noise_bump(L.mat('wood', '#A4432A', rough=0.42, coat=0.35), 25, 0.05),
        'wood_dk': L.mat('wood_dk', '#5A2214', rough=0.45, coat=0.4),
        'lacquer': L.mat('lacquer', '#9A2C1C', rough=0.3, coat=0.5),
        'orange': L.mat('orange', '#B5461F', rough=0.35, coat=0.4),
        'blue': L.mat('blue', '#16406A', rough=0.32, coat=0.5),
        'green': L.mat('green', '#245E45', rough=0.32, coat=0.5),
        'indigo': L.add_noise_bump(L.mat('indigo', '#1B3668', rough=0.85, sheen=0.3), 70, 0.12),
        'red_felt': L.add_noise_bump(L.mat('red_felt', '#84241B', rough=0.9, sheen=0.3), 70, 0.12),
        'cream_felt': L.add_noise_bump(L.mat('cream_felt', '#EADCC0', rough=0.92, sheen=0.5), 70, 0.14),
        'iron': L.mat('iron', '#2C2927', rough=0.5, metal=0.85),
        'dark': L.mat('dark', '#120D0A', rough=0.4),
        'enamel': L.mat('enamel', '#9E2A22', rough=0.25, coat=0.8),
        'bone': L.mat('bone', '#EDE3CC', rough=0.45),
        'string': L.mat('string', '#EFDDB0', rough=0.25, metal=1.0),
        'silk': L.mat('silk', '#C0392B', rough=0.45, sheen=0.8),
        'rock': L.add_noise_bump(
            L.add_color_variation(L.mat('rock', '#3A4557', rough=0.8), '#2B3444', '#6A7890', 4.0), 9, 0.5),
        'flame': L.mat('flame', '#FFB547', rough=1.0, emit='#FFB547', emit_strength=28.0),
        'ember': L.mat('ember', '#FF6A1F', rough=1.0, emit='#FF6A1F', emit_strength=12.0),
    }


# ═══ 1–2. Ширдэг ═════════════════════════════════════════════════════

def b_shirdeg(m, rare):
    """
    Ширдэг — сырмал эсгий. Зээгт наамал: өнгөт эсгий хээг ЗЭЭГ (мушгиа
    утас)-ээр хүрээлж наадаг — тиймээс хээ бүр товгор утсан хүрээтэй.
    Энгийн: цөцгий эсгий + бор наамал. Угалзан: улаан эсгий + хөх хүрээ
    + алтан эвэр угалз.
    """
    S, T = 2.0, 0.08
    base = quilt(L.mat('sh_base', '#7A1E18' if rare else '#E0CDA4', rough=0.95, sheen=0.3))
    band = quilt(L.mat('sh_band', '#18305E' if rare else '#553020', rough=0.9, sheen=0.3))
    cord_m = m['gold'] if rare else L.mat('cord', '#F3E7CF', rough=0.7, sheen=0.4)
    motif_m = m['gold'] if rare else L.mat('motif', '#5B3421', rough=0.8, sheen=0.4)
    L.box('base', (S, S, T), (0, 0, T / 2), base, bev=0.035)

    bw = 0.22 if rare else 0.16
    a = S / 2 - 0.08
    b = a - bw
    top = [(-a, a), (a, a), (b, b), (-b, b)]
    strips = [xf([(top, True)], rot=k * math.pi / 2)[0][0] for k in range(4)]
    plate('band', strips, T, 0.014, band, bev=0.003)
    cd = 0.016 if rare else 0.013
    cord('cords', [(rect(-a, -a, a, a), True), (rect(-b, -b, b, b), True)], T + 0.012, cd, cord_m)

    c_in = b - 0.16
    corners = [(sx * c_in, sy * c_in) for sx in (-1, 1) for sy in (-1, 1)]
    hs = 0.5 if rare else 0.36
    horns = []
    for cxy in corners:
        horns += xf(horn_pair_2d(), hs, toward(cxy, (0, 0)), cxy)
    cord('horns', horns, T + 0.01, 0.018 if rare else 0.015, motif_m)

    if rare:
        plate('medal', [circ(0.44, 64)], T, 0.014, band, bev=0.003)
        cord('medal_c', [(circ(0.44, 64), True), (circ(0.37, 64), True)], T + 0.012, 0.014, cord_m)
        cord('ulzii', xf(ulzii_2d(), 0.5), T + 0.024, 0.016, m['gold'])
        out = []
        for k in range(4):
            ang = k * math.pi / 2
            p = (0.46 * math.cos(ang), 0.46 * math.sin(ang))
            out += xf(horn_pair_2d(), 0.36, ang - math.pi / 2, p)
        cord('horns_out', out, T + 0.01, 0.016, m['gold'])
    else:
        d = 0.42
        dia = [(0, -d), (d, 0), (0, d), (-d, 0)]
        plate('diamond', [dia], T, 0.014, band, bev=0.003)
        cord('dia_c', [(dia, True)], T + 0.012, cd, cord_m)
        cord('ulzii', xf(ulzii_2d(), 0.42), T + 0.024, 0.013, cord_m)
    return dict(az=28, el=52, pad=1.06, floor=True)


# ═══ 3. Эсгий хөшиг — хан хана + эсгий ═══════════════════════════════

def b_wall_felt(m):
    """
    Хан хана (торлог хана) дээр өлгөсөн эсгий хөшиг.
    Хананы ОРОЙ ба УЛ нь хоёр чиглэлийн шонгийн үзүүр нийлсэн «V» хэлбэртэй
    — хананы хамгийн танигдам шинж. Тиймээс Hh = 7·d (шонгийн алхам) байх
    ёстой, эс тэгвэл үзүүрүүд нийлэхгүй.
    """
    d = 0.2
    Hh = 7 * d
    W = 1.9
    knot = L.mat('knot', '#2A1A12', rough=0.6)

    def seg(c, sign):
        if sign > 0:
            x0, x1 = max(c, -W / 2), min(c + Hh, W / 2)
            return ((x0, x0 - c), (x1, x1 - c)) if x1 > x0 + 0.01 else None
        x0, x1 = max(c - Hh, -W / 2), min(c, W / 2)
        return ((x0, c - x0), (x1, c - x1)) if x1 > x0 + 0.01 else None

    cs = [k * d for k in range(-20, 21)]
    for sign, y in ((1, 0.0), (-1, -0.04)):
        for c in cs:
            s = seg(c, sign)
            if not s:
                continue
            (xa, za), (xb, zb) = s
            ln = math.hypot(xb - xa, zb - za)
            bpy.ops.mesh.primitive_cube_add(size=1, location=((xa + xb) / 2, y, (za + zb) / 2))
            o = L.active()
            o.scale = (ln, 0.036, 0.05)
            o.rotation_euler = (0, -math.atan2(zb - za, xb - xa), 0)
            L.apply_scale(o)
            L.assign(o, m['wood'])
            L.bevel(o, 0.008, 2)
    for c1 in cs:
        for c2 in cs:
            x, z = (c1 + c2) / 2, (c2 - c1) / 2
            if -W / 2 + 0.02 < x < W / 2 - 0.02 and 0.02 < z < Hh - 0.02:
                sphere((x, -0.065, z), 0.02, knot, seg=12)

    # Эсгий хөшиг — дээрээс унжсан, доошоо нугалаа гүнзгийрнэ
    top_z, drop = Hh + 0.06, 0.5
    nx, nz = 72, 18

    def fy(x, f):
        return -0.1 - 0.05 * (0.35 + 0.65 * f) * (1 + math.sin(x * 11 + 0.7))

    def fz(x, f):
        return top_z - drop * f + 0.035 * f * math.sin(x * 11 + 0.7)

    def sheet(name, f0, f1, off, mat_):
        verts, faces = [], []
        xs = [-W / 2 - 0.05 + (W + 0.1) * i / nx for i in range(nx + 1)]
        rows = max(2, int(nz * (f1 - f0)) + 1)
        for j in range(rows + 1):
            f = f0 + (f1 - f0) * j / rows
            for x in xs:
                verts.append((x, fy(x, f) - off, fz(x, f)))
        n = nx + 1
        for j in range(rows):
            for i in range(nx):
                faces.append((j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        L.solidify(ob, 0.022)
        L.assign(ob, mat_)
        L.smooth(ob, 60)
        return ob

    sheet('felt', 0.0, 1.0, 0.0, m['cream_felt'])
    sheet('hem', 0.84, 1.0, 0.006, m['indigo'])
    xs = [-W / 2 - 0.05 + (W + 0.1) * i / 90 for i in range(91)]
    for f in (0.84, 0.995):
        cord('hem_c', [([(x, 0) for x in xs], False)], 0, 0.011, m['gold'],
             surf=lambda x, _y, f=f: (x, fy(x, f) - 0.02, fz(x, f)))
    rod((-W / 2 - 0.12, -0.1, top_z + 0.03), (W / 2 + 0.12, -0.1, top_z + 0.03), 0.034, 0.034, m['wood_dk'])
    for sx in (-1, 1):
        sphere((sx * (W / 2 + 0.14), -0.1, top_z + 0.03), 0.055, m['gold'])
    # Шалны сүүдэргүй — торны сүүдэр бараан картан дээр хатуу «хайрцаг» болж харагдаж байв
    return dict(az=22, el=14, pad=1.08, floor=False)


# ═══ 4. Хатан хааны хивс ═════════════════════════════════════════════

def b_tapestry(m):
    """
    Өлгөөтэй хивс — хөх талбай, улаан хүрээ, алтан зээг, төвд улзий ба
    дөрвөн эвэр угалз, доод ирмэгт алтан цацаг. Бүх хээ даавууны
    нугалааг ДАГАНА (fold функц нэг).
    """
    W, Ht = 1.3, 1.8

    def fold(x):
        return 0.035 * math.sin(x * 8.5 + 0.6)

    def cloth(name, x0, x1, z0, z1, off, mat_, nx=64):
        verts, faces = [], []
        xs = [x0 + (x1 - x0) * i / nx for i in range(nx + 1)]
        for z in (z0, z1):
            for x in xs:
                verts.append((x, fold(x) - off, z))
        n = nx + 1
        for i in range(nx):
            faces.append((i, i + 1, n + i + 1, n + i))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        L.solidify(ob, 0.016)
        L.assign(ob, mat_)
        L.smooth(ob, 60)
        return ob

    def S(off):
        return lambda x, z: (x, fold(x) - off, z)

    bw = 0.13
    cloth('field', -W / 2, W / 2, 0, Ht, 0.0, m['indigo'])
    cloth('b_top', -W / 2, W / 2, Ht - bw, Ht, 0.004, m['red_felt'])
    cloth('b_bot', -W / 2, W / 2, 0, bw, 0.004, m['red_felt'])
    cloth('b_l', -W / 2, -W / 2 + bw, bw, Ht - bw, 0.004, m['red_felt'], nx=6)
    cloth('b_r', W / 2 - bw, W / 2, bw, Ht - bw, 0.004, m['red_felt'], nx=6)

    i0, i1 = 0.025, bw
    cord('edge', [(densify(rect(-W / 2 + i0, i0, W / 2 - i0, Ht - i0), 0.03), True),
                  (densify(rect(-W / 2 + i1, i1, W / 2 - i1, Ht - i1), 0.03), True)],
         0, 0.011, m['gold'], surf=S(0.016))
    # Хүрээн дээрх сувдан эгнээ
    beads = []
    mid = (i0 + i1) / 2
    for x in [(-W / 2 + mid) + k * 0.1 for k in range(13)]:
        if x <= W / 2 - mid + 1e-6:
            beads += [(x, mid), (x, Ht - mid)]
    for z in [mid + k * 0.1 for k in range(1, 18)]:
        if z < Ht - mid - 0.05:
            beads += [(-W / 2 + mid, z), (W / 2 - mid, z)]
    for x, z in beads:
        sphere((x, fold(x) - 0.018, z), 0.014, m['gold'], seg=10)

    cy = Ht / 2
    cord('medal', [(densify(circ(0.3, 48, 0, cy), 0.03), True)], 0, 0.012, m['gold'], surf=S(0.012))
    cord('ulzii', xf(ulzii_2d(), 0.42, 0, (0, cy)), 0, 0.013, m['gold'], surf=S(0.014))
    out = []
    for k in range(4):
        ang = k * math.pi / 2
        p = (0.31 * math.cos(ang), cy + 0.31 * math.sin(ang))
        out += xf(horn_pair_2d(), 0.26, ang - math.pi / 2, p)
    c_in = (W / 2 - bw - 0.1, cy - (Ht / 2 - bw - 0.1))
    for sx in (-1, 1):
        for sz in (-1, 1):
            p = (sx * c_in[0], cy + sz * (Ht / 2 - bw - 0.1))
            out += xf(horn_pair_2d(), 0.22, toward(p, (0, cy)), p)
    cord('horns', out, 0, 0.011, m['gold'], surf=S(0.012))

    for k in range(9):
        x = -W / 2 + 0.1 + k * (W - 0.2) / 8
        sphere((x, fold(x) - 0.01, -0.02), 0.026, m['gold'], seg=12)
        rod((x, fold(x) - 0.01, -0.03), (x, fold(x) - 0.01, -0.19), 0.016, 0.034, m['gold_dim'])
    rod((-W / 2 - 0.14, 0, Ht + 0.05), (W / 2 + 0.14, 0, Ht + 0.05), 0.03, 0.03, m['gold'])
    for sx in (-1, 1):
        sphere((sx * (W / 2 + 0.16), 0, Ht + 0.05), 0.05, m['gold'])
    return dict(az=18, el=6, pad=1.06, floor=False)


# ═══ 5. Модон авдар ═══════════════════════════════════════════════════

def b_chest(m):
    """
    Будагт авдар — улаан лак, урд талд хөх хавтантай хоёр хаалт, алтан
    зээг, улзий, эвэр угалз; дээд хүрээнд ногоон тууз дээр угалзан эгнээ;
    голд гуулин цоожны хавтан. Монгол будагт тавилгын өнгө: улаан, хөх,
    ногоон, алт.
    """
    W, D, Hc = 1.7, 0.95, 1.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.box('foot', (0.16, 0.16, 0.07), (sx * (W / 2 - 0.04), sy * (D / 2 - 0.04), 0.035), m['wood_dk'])
    L.box('plinth', (W + 0.08, D + 0.08, 0.1), (0, 0, 0.12), m['wood_dk'], bev=0.02)
    z0 = 0.17
    zc = z0 + Hc / 2
    L.box('body', (W, D, Hc), (0, 0, zc), m['lacquer'], bev=0.012)
    L.box('lid', (W + 0.1, D + 0.1, 0.09), (0, 0, z0 + Hc + 0.045), m['wood_dk'], bev=0.03)
    L.box('lid_line', (W + 0.02, D + 0.02, 0.022), (0, 0, z0 + Hc - 0.005), m['gold'], bev=0.006)
    ltop = z0 + Hc + 0.09
    cord('lid_c', [(rect(-W / 2 + 0.03, -D / 2 + 0.03, W / 2 - 0.03, D / 2 - 0.03), True)],
         ltop + 0.004, 0.012, m['gold'])

    front = empty('front', (0, -D / 2, zc), (math.pi / 2, 0, 0))
    fy0, fy1 = Hc / 2 - 0.2, Hc / 2 - 0.06
    plate('frieze', [rect(-W / 2 + 0.06, fy0, W / 2 - 0.06, fy1)], 0, 0.012, m['green'], front)
    cord('frieze_c', [(rect(-W / 2 + 0.06, fy0, W / 2 - 0.06, fy1), True)], 0.014, 0.009, m['gold'], front)
    fr = []
    for k in range(7):
        x = -0.72 + k * 0.24
        fr += xf(horn_pair_2d(), 0.12, 0 if k % 2 == 0 else math.pi, (x, fy0 + 0.02 if k % 2 == 0 else fy1 - 0.02))
    cord('frieze_h', fr, 0.014, 0.008, m['gold'], front)

    pw, ph, py = 0.66, 0.6, -0.1
    for sx in (-1, 1):
        cx = sx * 0.37
        plate('panel', [rrect(pw, ph, 0.05, cx=cx, cy=py)], 0, 0.014, m['blue'], front)
        cord('panel_c', [(rrect(pw - 0.06, ph - 0.06, 0.035, cx=cx, cy=py), True)], 0.016, 0.009, m['gold'], front)
        cord('panel_u', xf(ulzii_2d(), 0.3, 0, (cx, py)), 0.018, 0.011, m['gold'], front)
        hs = []
        for qx in (-1, 1):
            for qy in (-1, 1):
                p = (cx + qx * (pw / 2 - 0.1), py + qy * (ph / 2 - 0.1))
                hs += xf(horn_pair_2d(), 0.12, toward(p, (cx, py)), p)
        cord('panel_h', hs, 0.016, 0.007, m['gold'], front)
    plate('lock', [rrect(0.12, 0.24, 0.03, cx=0, cy=py)], 0, 0.02, m['gold'], front)
    plate('keyhole', [circ(0.018, 16, 0, py + 0.03), [(-0.012, py + 0.02), (0.012, py + 0.02), (0.02, py - 0.05), (-0.02, py - 0.05)]],
          0.02, 0.004, m['dark'], front, bev=0)
    ring = torus((0, -D / 2 - 0.03, zc + py - 0.14), 0.04, 0.009, m['gold'], rot=(math.pi / 2, 0, 0), seg=48)
    ring.name = 'pull'
    cord('base_c', [([(-W / 2 + 0.05, -Hc / 2 + 0.06), (W / 2 - 0.05, -Hc / 2 + 0.06)], False)], 0.004, 0.009, m['gold'], front)

    side = empty('side', (W / 2, 0, zc), (math.pi / 2, 0, math.pi / 2))
    plate('s_panel', [rrect(D - 0.22, Hc - 0.36, 0.05, cy=-0.05)], 0, 0.014, m['blue'], side)
    cord('s_c', [(rrect(D - 0.28, Hc - 0.42, 0.035, cy=-0.05), True)], 0.016, 0.009, m['gold'], side)
    cord('s_u', xf(ulzii_2d(), 0.28, 0, (0, -0.05)), 0.018, 0.011, m['gold'], side)
    return dict(az=32, el=22, pad=1.08, floor=True)


# ═══ 6. Хүннүгийн хүрэл тогоо ════════════════════════════════════════

def b_cauldron(m):
    """
    Хүннүгийн хүрэл тогоо (МЭӨ III – МЭ I зуун) — хонх хэлбэрийн бие,
    бүрээ хэлбэрийн хөндий хөл, амсар дээр босоо хоёр бариул, бариул бүрийн
    оройд ГУРВАН МӨӨГӨН ТОВРУУ — Хүннүгийн тогооны ялгах шинж.
    Бие дээр товгор бүс ба босоо хавирга.
    """
    bz = bronze_mat()
    # ⚠ Хөл нь БОГИНО байх ёстой — өндөр бүрээ хөлтэй бол цомын аяга шиг харагдана
    prof = [(0.0, 0.0), (0.3, 0.0), (0.32, 0.03), (0.26, 0.08), (0.19, 0.2), (0.17, 0.3),
            (0.3, 0.36), (0.52, 0.48), (0.62, 0.7), (0.65, 0.95), (0.64, 1.15), (0.6, 1.26),
            (0.63, 1.28), (0.63, 1.32), (0.57, 1.32), (0.55, 1.24), (0.5, 0.8), (0.1, 0.48), (0.0, 0.46)]
    lathe('body', prof, bz)

    def r_at(z):
        pts = prof[6:13]
        for (ra, za), (rb, zb) in zip(pts, pts[1:]):
            if za <= z <= zb:
                return ra + (rb - ra) * (z - za) / (zb - za)
        return 0.6

    for z in (1.12, 1.19):
        torus((0, 0, z), r_at(z) + 0.004, 0.02, bz)
    ribs = []
    for k in range(10):
        a = 2 * math.pi * (k + 0.5) / 10
        pts = []
        for i in range(14):
            z = 0.62 + (1.1 - 0.62) * i / 13
            r = r_at(z) + 0.004
            pts.append((r * math.cos(a), r * math.sin(a), z))
        ribs.append(pts)
    rb = L.poly_curve('ribs', ribs, 0.016)
    L.assign(rb, bz)

    zr = 1.32
    for sx in (-1, 1):
        x = sx * 0.6
        pts = [(x - 0.13, 0, zr - 0.02), (x - 0.13, 0, zr + 0.14)]
        for i in range(1, 12):
            a = math.pi - math.pi * i / 12
            pts.append((x + 0.13 * math.cos(a), 0, zr + 0.14 + 0.1 * math.sin(a)))
        pts += [(x + 0.13, 0, zr + 0.14), (x + 0.13, 0, zr - 0.02)]
        h = L.poly_curve('handle', [pts], 0.034, resolution=2)
        L.assign(h, bz)
        for dx in (-0.08, 0.0, 0.08):
            ztop = zr + 0.14 + 0.1 * math.sqrt(max(0.0, 1 - (dx / 0.13) ** 2))
            rod((x + dx, 0, ztop), (x + dx, 0, ztop + 0.06), 0.014, 0.014, bz, verts=10)
            sphere((x + dx, 0, ztop + 0.075), 0.032, bz, scale=(1, 1, 0.7), seg=16)
    return dict(az=30, el=16, pad=1.08, floor=True)


# ═══ 7. Морин хуур ════════════════════════════════════════════════════

def b_morin(m):
    """
    Морин хуур — трапец хайрцаг, урт иш, оройд МОРИНЫ ТОЛГОЙ, хоёр тийш
    цухуйсан хоёр чих (хөвч чангалагч), хоёр утас. Бага зэрэг хазайлгаж
    дүрсийн талбайг бүрэн ашиглана.
    """
    grp = empty('grp')
    # Бүрхүүл (coat) бага — их байвад rim гэрэл хажуу талд цагаан толбо үүсгэж байв
    wood = wood_grain(L.mat('mk_wood', '#6A2A16', rough=0.42, coat=0.25), '#5A2112', '#7E3A1E', 4.0)
    face = wood_grain(L.mat('mk_face', '#A55A2E', rough=0.35, coat=0.5), '#9A5028', '#C07844', 7.0)

    bw0, bw1, bh, bd = 0.27, 0.21, 0.62, 0.08
    v = [(-bw0, -bd, 0), (bw0, -bd, 0), (bw1, -bd, bh), (-bw1, -bd, bh),
         (-bw0, bd, 0), (bw0, bd, 0), (bw1, bd, bh), (-bw1, bd, bh)]
    f = [(0, 1, 2, 3), (5, 4, 7, 6), (4, 0, 3, 7), (1, 5, 6, 2), (3, 2, 6, 7), (4, 5, 1, 0)]
    box = L.mesh_from('box', v, f)
    L.assign(box, wood)
    L.bevel(box, 0.018, 3)
    box.parent = grp

    fr = empty('front', (0, -bd, 0), (math.pi / 2, 0, 0), parent=grp)
    sb = [(-0.245, 0.03), (0.245, 0.03), (0.19, 0.59), (-0.19, 0.59)]
    plate('board', [sb], 0, 0.006, face, fr, bev=0.002)
    cord('board_c', [(sb, True)], 0.008, 0.008, m['gold'], fr)
    cord('board_u', xf(ulzii_2d(), 0.13, 0, (0, 0.46)), 0.009, 0.006, m['gold'], fr)
    L.box('bridge', (0.12, 0.02, 0.035), (0, -bd - 0.02, 0.2), m['bone'], bev=0.004).parent = grp
    L.box('tail', (0.08, 0.02, 0.03), (0, -bd - 0.015, 0.05), m['wood_dk'], bev=0.004).parent = grp

    nz0 = bh
    L.box('neck', (0.065, 0.05, 1.22), (0, 0, nz0 + 0.61), m['wood_dk'], bev=0.01).parent = grp
    pz = nz0 + 1.22
    L.box('pegbox', (0.085, 0.07, 0.26), (0, 0, pz + 0.11), m['wood_dk'], bev=0.012).parent = grp
    for sx, z in ((-1, pz + 0.04), (1, pz + 0.16)):
        rod((0, 0, z), (sx * 0.17, 0, z), 0.016, 0.02, wood).parent = grp
        sphere((sx * 0.19, 0, z), 0.034, m['gold'], scale=(0.6, 1, 1)).parent = grp

    # Морины толгой — профиль (u: урагш = −u, v: дээш), YZ хавтгайд
    head = empty('head', (0, 0, pz + 0.23), (math.pi / 2, 0, math.pi / 2), scale=0.62, parent=grp)
    prof = [(0.10, 0.0), (0.12, 0.32), (0.06, 0.60), (-0.03, 0.78), (-0.06, 0.95), (-0.11, 0.80),
            (-0.28, 0.72), (-0.50, 0.50), (-0.58, 0.40), (-0.56, 0.30), (-0.44, 0.27), (-0.28, 0.33),
            (-0.15, 0.25), (-0.09, 0.0)]
    plate('horse', [prof], -0.11, 0.22, wood, head, bev=0.03)
    cord('mane', [([(0.13, 0.05), (0.14, 0.32), (0.08, 0.6), (-0.01, 0.78)], False)], 0.0, 0.03, m['gold'], head)
    for sz in (-1, 1):
        e = sphere((0, 0, 0), 0.028, m['gold'], seg=12)
        e.parent = head
        e.location = (-0.3, 0.6, sz * 0.115)

    strings = []
    for sx in (-0.014, 0.014):
        strings.append([(sx, -bd - 0.04, 0.06), (sx, -bd - 0.045, 0.2), (sx, -0.04, pz + 0.1)])
    s = L.poly_curve('strings', strings, 0.0035)
    L.assign(s, m['string'])
    s.parent = grp
    rod((0, 0, 0), (0, 0, -0.07), 0.02, 0.012, m['gold']).parent = grp

    grp.rotation_euler = (0, math.radians(-12), 0)
    return dict(az=38, el=10, pad=1.06, floor=False)


# ═══ 8. Ятга ══════════════════════════════════════════════════════════

def b_yatga(m):
    """
    Ятга — урт завин хэлбэрийн их бие, нуман дээд хавтан, 13 утас, утас
    бүрийн доор хөдөлгөөнт ГҮҮР диагональ эгнээгээр — ятгын ялгах шинж.
    """
    Lx, Wy, T, arch = 2.1, 0.4, 0.09, 0.03
    grain = wood_grain(L.mat('y_top', '#B8743F', rough=0.35, coat=0.5), '#A8642F', '#D09058', 5.0)
    L.box('body', (Lx, Wy, T), (0, 0, T / 2), m['lacquer'], bev=0.02)

    ny = 16
    verts, faces = [], []
    for x in (-Lx / 2 + 0.02, Lx / 2 - 0.02):
        for j in range(ny + 1):
            y = -Wy / 2 + 0.01 + (Wy - 0.02) * j / ny
            verts.append((x, y, T + arch * (1 - (2 * y / Wy) ** 2)))
    n = ny + 1
    for j in range(ny):
        faces.append((j, n + j, n + j + 1, j + 1))
    me = bpy.data.meshes.new('board')
    me.from_pydata(verts, [], faces)
    me.update()
    board = bpy.data.objects.new('board', me)
    bpy.context.collection.objects.link(board)
    L.solidify(board, 0.018)
    L.assign(board, grain)
    L.smooth(board, 50)

    L.box('head', (0.18, Wy + 0.05, 0.2), (Lx / 2 + 0.05, 0, 0.1), m['wood_dk'], bev=0.03)
    L.box('tailp', (0.12, Wy + 0.02, 0.14), (-Lx / 2 - 0.02, 0, 0.07), m['wood_dk'], bev=0.025)
    for sx in (-1, 1):
        L.box('nut', (0.03, Wy - 0.04, 0.03), (sx * (Lx / 2 - 0.12), 0, T + arch + 0.012), m['bone'], bev=0.005)
    cord('edge', [([(-Lx / 2 + 0.02, sy * (Wy / 2 - 0.004)), (Lx / 2 - 0.02, sy * (Wy / 2 - 0.004))], False)
                  for sy in (-1, 1)], T + 0.006, 0.008, m['gold'])

    NS = 13
    zs = T + arch + 0.04
    strs = []
    for i in range(NS):
        y = -0.16 + 0.32 * i / (NS - 1)
        strs.append([(-Lx / 2 + 0.1, y, T + arch + 0.03), (Lx / 2 - 0.1, y, zs)])
        bx = -0.5 + 0.075 * i
        bzt = zs - 0.002
        bzb = T + arch * (1 - (2 * y / Wy) ** 2) + 0.002
        v = [(bx - 0.036, y - 0.015, bzb), (bx + 0.036, y - 0.015, bzb), (bx, y - 0.015, bzt),
             (bx - 0.036, y + 0.015, bzb), (bx + 0.036, y + 0.015, bzb), (bx, y + 0.015, bzt)]
        f = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
        br = L.mesh_from('bridge', v, f)
        L.assign(br, m['bone'])
    s = L.poly_curve('strings', strs, 0.0032)
    L.assign(s, m['string'])

    hd = empty('head_face', (Lx / 2 + 0.141, 0, 0.1), (math.pi / 2, 0, math.pi / 2))
    cord('hd_c', [(rrect(Wy - 0.02, 0.15, 0.03), True)], 0.0, 0.008, m['gold'], hd)
    cord('hd_u', xf(ulzii_2d(), 0.12), 0.002, 0.007, m['gold'], hd)
    return dict(az=50, el=36, pad=1.05, floor=True)


# ═══ 9–10. Тооно ══════════════════════════════════════════════════════

def b_toono(m, epic):
    """
    Тооно — гэрийн «нар». Цагираг дээр ҮНЬ цацарч, дээгүүр нь хоёр нум
    (тэрэлж) загалмайлна. Эпик хувилбарт нумуудын огтлолцол дээр
    СОЁМБО бүхий улаан паалантай алтан медаль.
    """
    R0, R1, Hb = 0.52, 0.44, 0.14
    ring_m = m['enamel'] if epic else m['orange']
    arch_m = m['gold_dim'] if epic else m['orange']
    uni_m = m['orange']
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=R0, depth=Hb, end_fill_type='NOTHING', location=(0, 0, 0))
    ring = L.active()
    L.assign(ring, ring_m)
    L.solidify(ring, R0 - R1)
    L.bevel(ring, 0.012, 2)
    L.smooth(ring, 40)
    band_m = m['gold'] if epic else m['blue']
    torus((0, 0, 0), R0 + 0.004, 0.022, band_m)
    for z in (-0.05, 0.05):
        torus((0, 0, z), R0 + 0.003, 0.009, m['gold'] if epic else m['green'])

    N = 30
    reach = 0.95
    slope = math.radians(24)
    for k in range(N):
        a = 2 * math.pi * (k + 0.5) / N
        u = Vector((math.cos(a), math.sin(a), 0))
        p0 = u * (R0 - 0.02)
        p1 = u * (R0 + reach * math.cos(slope)) + Vector((0, 0, -reach * math.sin(slope)))
        rod(p0, p1, 0.02, 0.026, uni_m, verts=10)
        if epic:
            torus(tuple(u * (R0 + 0.1) + Vector((0, 0, -0.1 * math.tan(slope)))), 0.026, 0.008, m['gold'],
                  rot=(0, math.pi / 2, a), seg=24)

    top = Hb / 2 + 0.26
    for ang in (0, math.pi / 2):
        pts = []
        for i in range(25):
            th = math.pi - math.pi * i / 24
            x = (R1 - 0.02) * math.cos(th)
            pts.append((x * math.cos(ang), x * math.sin(ang), Hb / 2 + 0.26 * math.sin(th)))
        c = L.poly_curve('arch', [pts], 0.028)
        L.assign(c, arch_m)
    if epic:
        md = empty('medal', (0, 0, top + 0.01), (0, 0, math.radians(30)))
        # ⚠ Медаль ТОМ байх ёстой — r=0.16 үед Соёмбо дүрсний хэмжээнд уусч байв
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.28, depth=0.03, location=(0, 0, 0))
        disc = L.active()
        L.assign(disc, m['enamel'])
        L.bevel(disc, 0.006, 2)
        disc.parent = md
        tr = torus((0, 0, 0.015), 0.28, 0.016, m['gold'], seg=64)
        tr.parent = md
        sy = empty('soy', (0, -0.08, 0.015), scale=0.34, parent=md)
        plate('soyombo', soyombo_2d(), 0, 0.09, m['gold'], sy, bev=0.01)
        plate('taiji', [circ(0.13, 40, 0, -0.05)], 0, 0.09, m['gold'], sy, bev=0.01)
        cord('taiji_s', [(taiji_s(), False), (circ(0.13, 40, 0, -0.05), True)], 0.095, 0.014, m['enamel'], sy)
    else:
        sphere((0, 0, top + 0.02), 0.05, m['orange'])
    return dict(az=30, el=58, pad=1.04, floor=False)


# ═══ 11. Зул ══════════════════════════════════════════════════════════

def b_zul(m):
    """Цөгц зул — гуулин хөл, иш, товруу, аяга; тосон дээр гал ба туяа."""
    prof = [(0.0, 0.0), (0.34, 0.0), (0.36, 0.03), (0.3, 0.07), (0.12, 0.14), (0.07, 0.2), (0.07, 0.42),
            (0.13, 0.48), (0.07, 0.54), (0.08, 0.6), (0.28, 0.72), (0.36, 0.86), (0.37, 0.9),
            (0.34, 0.9), (0.3, 0.84), (0.1, 0.74), (0.0, 0.72)]
    lathe('lamp', prof, m['gold'])
    for k in range(18):
        a = 2 * math.pi * k / 18
        sphere((0.3 * math.cos(a), 0.3 * math.sin(a), 0.075), 0.022, m['gold'], seg=12)
    torus((0, 0, 0.62), 0.12, 0.018, m['gold'])
    butter = L.mat('butter', '#F3E2B0', rough=0.5, sss=0.3)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.3, depth=0.02, location=(0, 0, 0.84))
    L.assign(L.active(), butter)
    rod((0, 0, 0.84), (0, 0, 0.92), 0.008, 0.006, m['dark'], verts=8)
    fl = lathe('flame', [(0, 0), (0.05, 0.03), (0.065, 0.08), (0.05, 0.14), (0.02, 0.2), (0, 0.25)], m['flame'], seg=32)
    fl.location = (0, 0, 0.9)
    glow((0, 0, 1.02), 0.34, '#FFB347', 3.0, density=0.5)
    L.point_light('flame_l', (0, -0.05, 1.02), 30, 0.05, '#FFB14E')
    return dict(az=25, el=16, pad=1.1, floor=True)


# ═══ 12. Гал голомт ═══════════════════════════════════════════════════

def b_hearth(m):
    """
    Гал голомт — ТУЛГА (гурван хөлт төмөр цагираг, хөлийн орой эвэр
    мэт мушгирсан) дор түлээ ба гал; эргэн тойронд чулуу. Гал голомт бол
    гэрийн ариун төв — Монгол ёсонд галыг хүндэтгэнэ.
    """
    rnd = random.Random(3)
    # Бараан чулуу — галын ойрын гэрэлд цайвар чулуу «өндөг» шиг цайрч байв
    hrock = L.add_noise_bump(
        L.add_color_variation(L.mat('hrock', '#2A2E36', rough=0.85), '#1D2027', '#434A56', 4.0), 9, 0.5)
    for k in range(11):
        a = 2 * math.pi * k / 11 + rnd.uniform(-0.1, 0.1)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=(0.62 * math.cos(a), 0.62 * math.sin(a), 0.05))
        o = L.active()
        for v in o.data.vertices:
            v.co += Vector((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2)))
        o.scale = (rnd.uniform(0.1, 0.14), rnd.uniform(0.09, 0.12), rnd.uniform(0.07, 0.1))
        o.rotation_euler = (0, 0, a)
        sub = o.modifiers.new('Sub', 'SUBSURF')
        sub.levels = 1
        sub.render_levels = 2
        L.assign(o, hrock)
        L.smooth(o, 60)
    logm = L.add_noise_bump(L.mat('log', '#3B2416', rough=0.8), 30, 0.4)
    for k in range(4):
        a = math.pi * k / 4
        d = Vector((math.cos(a), math.sin(a), 0))
        rod(tuple(-d * 0.34 + Vector((0, 0, 0.05))), tuple(d * 0.34 + Vector((0, 0, 0.12 + 0.02 * k))), 0.05, 0.045, logm)
    for k in range(9):
        sphere((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 0.04), rnd.uniform(0.025, 0.04), m['ember'], seg=10)
    for k, (x, y, h) in enumerate(((0, 0, 0.5), (0.1, 0.05, 0.36), (-0.1, 0.04, 0.38), (0.03, -0.1, 0.34), (-0.05, 0.1, 0.3))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=(x, y, 0.16 + h * 0.5))
        o = L.active()
        o.scale = (0.1, 0.1, h * 0.55)
        L.assign(o, L.soft_volume_mat(f'fire{k}', '#FF9B3D', 10.0, emit='#FFA640', emit_strength=40.0,
                                      noise_scale=2.5, seed=k * 2.1, falloff_pow=1.3, lo=0.25, hi=0.75))
    sphere((0, 0, 0.2), 0.08, m['flame'], scale=(1, 1, 1.6))
    L.point_light('fire_l', (0, 0, 0.35), 70, 0.15, '#FF9F45')

    zr = 0.62
    torus((0, 0, zr), 0.42, 0.024, m['iron'])
    legs = []
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 6
        c, s = math.cos(a), math.sin(a)
        prof = [(0.56, 0.0), (0.52, 0.2), (0.45, 0.46), (0.42, zr), (0.43, 0.72), (0.5, 0.8), (0.58, 0.8), (0.6, 0.74)]
        legs.append([(r * c, r * s, z) for r, z in prof])
        sphere((0.6 * c, 0.6 * s, 0.74), 0.028, m['gold'], seg=12)
    lg = L.poly_curve('legs', legs, 0.026, resolution=3)
    L.assign(lg, m['iron'])
    return dict(az=30, el=24, pad=1.08, floor=True)


# ═══ 13. Гэрэгэ — түгжээ ══════════════════════════════════════════════

def b_seal(m):
    """
    Гэрэгэ (пайз) — Их Монгол Улсын элч, түшмэдэд олгодог алтан тэмдэг.
    Дугуй оройтой хавтан, дээд хэсэгт утас гаргах нүх, товгор хүрээ,
    төвд улзий, доор нь цоожны нүх — «битүүмжилсэн» гэсэн утга.
    Улаан торгон оосор нүхээр гарна.
    """
    # ⚠ Урт, нарийн (≈1:2.4) — өргөн байхад дугуй оройтой «хаалга» мэт харагдаж байв
    W, Ht, T = 0.64, 1.55, 0.07

    def tablet(w, h, y0=0.0, r=0.08, n=24):
        cy = y0 + h - w / 2
        pts = []
        for i in range(7):
            a = math.radians(180 + 90 * i / 6)
            pts.append((-w / 2 + r + r * math.cos(a), y0 + r + r * math.sin(a)))
        for i in range(7):
            a = math.radians(270 + 90 * i / 6)
            pts.append((w / 2 - r + r * math.cos(a), y0 + r + r * math.sin(a)))
        for i in range(n + 1):
            a = math.pi * i / n
            pts.append(((w / 2) * math.cos(a), cy + (w / 2) * math.sin(a)))
        return pts

    grp = empty('grp', (0, 0, 0), (math.pi / 2, 0, 0))
    body = plate('tablet', [tablet(W, Ht)], 0, T, m['gold'], grp, bev=0.018)
    L.apply_all(body)
    hy = Ht - W / 2 + 0.17
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.07, depth=1.0, location=(0, 0, 0))
    cut = L.active()
    cut.parent = grp
    cut.location = (0, hy, 0)
    bpy.context.view_layer.update()
    L.boolean_diff(body, cut)
    bpy.data.objects.remove(cut, do_unlink=True)
    torus((0, 0, 0), 0.07, 0.014, m['gold']).parent = grp
    for o in bpy.data.objects:
        if o.name.startswith('Torus'):
            o.location = (0, hy, T)

    ins = 0.06
    cord('rim', [(tablet(W - 2 * ins, Ht - 2 * ins, ins, 0.05), True)], T + 0.004, 0.014, m['gold'], grp)
    plate('field', [tablet(W - 0.2, Ht - 0.42, 0.1, 0.04)], T, 0.008, m['gold_dim'], grp, bev=0.002)
    cord('ulzii', xf(ulzii_2d(), 0.5, 0, (0, 0.82)), T + 0.02, 0.018, m['gold'], grp)
    plate('esc', [rrect(0.24, 0.32, 0.06, cx=0, cy=0.36)], T + 0.008, 0.02, m['gold'], grp, bev=0.006)
    plate('keyhole', [circ(0.055, 24, 0, 0.41), [(-0.03, 0.39), (0.03, 0.39), (0.052, 0.24), (-0.052, 0.24)]],
          T + 0.028, 0.004, m['dark'], grp, bev=0)
    cr = torus((0, 0, 0), 0.14, 0.018, m['silk'], rot=(0, math.pi / 2, 0), seg=64)
    cr.parent = grp
    cr.location = (0, hy + 0.14, T / 2)
    return dict(az=18, el=8, pad=1.08, floor=False)


# ═══ Үндсэн давталт ═══════════════════════════════════════════════════

ITEMS = {
    'shirdeg_simple': lambda m: b_shirdeg(m, False),
    'shirdeg_ugalz': lambda m: b_shirdeg(m, True),
    'wall_felt': b_wall_felt,
    'wall_royal': b_tapestry,
    'chest_wood': b_chest,
    'bronze_cauldron': b_cauldron,
    'morin_khuur': b_morin,
    'yatga': b_yatga,
    'toono_simple': lambda m: b_toono(m, False),
    'toono_soyombo': lambda m: b_toono(m, True),
    'zul': b_zul,
    'hearth': b_hearth,
    'seal_locked': b_seal,
}


def bbox_center(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, lo, hi


def render_item(name, fn):
    sc = L.reset()
    L.setup_render(sc, RES, RES, SAMPLES)
    L.world(sc, '#1B2A46', 0.9)
    sc.view_settings.exposure = 0.0
    view = fn(mats())
    objs = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE')]
    ctr, lo, hi = bbox_center(objs)
    size = max((hi - lo).x, (hi - lo).y, (hi - lo).z)
    k = size / 2.0
    L.area_light('key', ctr + Vector((-6, -7, 8)) * k, ctr, 3600 * k * k, 7 * k, '#FFE9CC')
    L.area_light('rim', ctr + Vector((6, 7, 5)) * k, ctr, 2600 * k * k, 6 * k, '#86E0EA')
    L.area_light('fill', ctr + Vector((8, -5, 1)) * k, ctr, 700 * k * k, 8 * k, '#A9B8E0')
    cam = L.ortho_camera(sc, view['az'], view['el'], ctr, dist=30 * k)
    L.frame(sc, cam, objs, pad=view['pad'])
    # ⚠ Шалны сүүдэр АППАД УНТРААЛТТАЙ: түгжээтэй эдийг `tintColor`-оор
    #   сүүдэр-дүрс болгоход бүдэг сүүдэр ч мөн будагдаж, авдар, тогоо,
    #   ятгын ард тэгш өнцөгт «хайрцаг» үүсгэж байв. Бараан UI дээр сүүдэр
    #   бараг харагддаггүй тул ашиг багатай. Маркетингийн зурагт True болго.
    if view.get('floor') and FLOOR_SHADOW:
        bpy.ops.mesh.primitive_plane_add(size=20 * k, location=(ctr.x, ctr.y, lo.z))
        L.active().is_shadow_catcher = True
    L.render(sc, os.path.join(OUTDIR, f'{name}.png'))


def main():
    for name, fn in ITEMS.items():
        if ONLY and name not in ONLY:
            continue
        try:
            render_item(name, fn)
        except Exception as e:  # нэг эд унавал бусдыг зогсоохгүй
            import traceback
            traceback.print_exc()
            print('FAILED', name, e)


# ger_realtime.py нь барих функцүүдийг import хийж ашиглана — тэр үед рендер хийхгүй
if __name__ == '__main__':
    main()
