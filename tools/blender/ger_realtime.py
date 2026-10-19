"""
Бодит цагийн 3D гэр — GLB экспорт (three.js + expo-gl)

ЗОРИЛГО: Хэрэглэгч гэрийг тойрон харж, хаалгаар орж, байрлуулсан эд бүрийг
гэрийн УЛАМЖЛАЛТ байрандаа харна:
  хоймор (хойд, хүндэт тал) · баруун = эрэгтэй тал · зүүн = эмэгтэй тал
  гал голомт (төв)          · тооно (дээд)

ДИОРАМААС ЯЛГАА — ЖИНХЭНЭ БҮТЭЦ:
  ger_diorama.py нь хан ханыг ГАДНА талд харуулсан урлагийн шийдэл. Жинхэнэ
  гэрт хана, унь ДОТОР, эсгий + цагаан бүрээс ГАДНА байдаг. Дотор нь орж
  харах тул энд бодит бүтцийг баримтална: гаднаас цагаан бүрээс, хөх хээт
  зах, бүслүүр; дотроос улбар шар хана, унь, хоёр багана, тооно.

ГЭРЭЭ — апп ↔ GLB зангилааны нэр (three.js-д getObjectByName):
  ger_shell       байнгын бүх геометр (материалаар хуваагдсан — draw call цөөн)
  stove           төмөр зуух + яндан; «Гал голомт» байрлуулахад нуугдана
  default_table   хойморын ширээ; «Модон авдар» байрлуулахад нуугдана
  item_<key>      байрлуулж болох эд; key нь src/ger3d/itemKeys.ts-тэй ИЖИЛ
  anchor_<zone>   шошгоны цэг: khoimor baruun zuun golomt toono bosgo
  cam_* orbit_target light_* smoke_origin — камер, гэрэл, утааны байрлал
  Координат: Blender Z-дээш → glTF Y-дээш (x, z, −y). Хаалга өмнө зүгт = three +Z.

МАТЕРИАЛ: glTF нь процедур node-ийг дамжуулдаггүй тул материалыг өнгө/металл/
  барзгар болгож «хавтгайруулж», давхардлыг нэгтгэнэ. Гүн ба булангийн
  сүүдрийг AO-оор оройн өнгөнд (COLOR_0) шатаана — three.js үүнийг суурь
  өнгөөр автоматаар үржүүлдэг. ТЕКСТУРГҮЙ тул RN дээр зураг задлах асуудал
  (Image/Blob API байхгүй) огт гарахгүй.

Ажиллуулах:
  blender --background --factory-startup --python ger_realtime.py -- --out ger.glb [--ao 0]
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nomad_lib as L  # noqa: E402

# Бодит цагт: муруйн огтлол 8 талт, эргэлтийн бие ~1/3 сегменттэй. Утасны
# дэлгэцэн дээр 20+ тал ялгарахгүй — гурвалжинг дэмий үрэхгүй.
L.CURVE_RES = 1
import ger_items as GI  # noqa: E402

GI.SEG_SCALE = 0.35

arg = L.cli_args()
OUT = arg('--out', 'ger.glb')
AO = arg('--ao', '1') == '1'
ITEM_TRIS = int(arg('--item-tris', '9000'))

sc = L.reset()
L.setup_render(sc, 64, 64, 32)  # AO шатаахад Cycles хэрэгтэй
L.world(sc, '#1B2A46', 1.0)

# ─── Хэмжээ (метр) — 5 ханатай гэрийн бодит харьцаа ────────────────
R = 3.0              # бүрээсний радиус
H = 1.5              # ханын өндөр
GZ = 0.30            # тавцангийн орой = шалны түвшин
ROOF_RISE = 1.05     # төвийн өндөр ≈ 2.55 м (бодит гэр 2.3–2.8)
EAVE = R + 0.14
TOONO_R = 0.55
RZ0 = GZ + H
RZ1 = RZ0 + ROOF_RISE
DOOR_W, DOOR_H, FW = 0.9, 1.25, 0.1
LAT_R = R - 0.045    # ханын гадна гадаргуу — эсгийн дотор талд
LAT_T = 0.028
PLAT_R = 4.6
rnd = random.Random(11)


def pm(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    return L.mat(name, color, rough=rough, metal=metal, emit=emit, emit_strength=strength)


MAT = {
    'canvas': pm('canvas', '#ECE6DA', 0.9),      # гадна цагаан бүрээс
    'felt_in': pm('felt_in', '#D6C5A4', 0.95),   # дотор эсгий
    'paint': pm('paint', '#B5461F', 0.45),       # улбар шар будаг — хана, унь, багана
    'paint_dk': pm('paint_dk', '#6A2817', 0.5),
    'blue': pm('blue', '#1E4A7A', 0.45),
    'gold': pm('gold', '#DDB058', 0.3, 1.0),
    'enamel': pm('enamel', '#9E2A22', 0.3),
    'rope': pm('rope', '#3B2A1E', 0.85),
    'stone': pm('stone', '#2E3746', 0.85),
    'rock': pm('rock', '#46526A', 0.8),
    'grass': pm('grass', '#1F5A3C', 0.95),
    'blade': pm('blade', '#2F7A50', 0.8),
    'floor': pm('floor', '#8A5A34', 0.7),
    'plank': pm('plank', '#5E3A20', 0.8),
    'rug': pm('rug', '#7A2A22', 0.9),
    'cream': pm('cream', '#EFE3CC', 0.9),
    'iron': pm('iron', '#2A2624', 0.55, 0.7),
    'copper': pm('copper', '#B06A3A', 0.35, 0.8),
    'leather': pm('leather', '#5A3620', 0.7),
    'wood': pm('wood', '#8A5A34', 0.6),
    'fire': pm('fire', '#FF8A30', 1.0, emit='#FF8A30', strength=6.0),
}

ANCHOR_PREFIX = ('anchor_', 'cam_', 'light_', 'smoke_', 'orbit_')


# ═══ Туслах ══════════════════════════════════════════════════════════

def link_mesh(name, verts, faces, mat=None, recalc=False):
    if recalc:
        ob = L.mesh_from(name, verts, faces)
    else:
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
    if mat:
        L.assign(ob, mat)
    return ob


def ring_strip(name, r0, z0, r1, z1, mat, n=160, rows=1):
    """
    (r0,z0) → (r1,z1) хоорондох эргэлтийн тууз: хана, дээвэр, шал, тууз.
    ⚠ `rows` нь зөвхөн гадаргын хэлбэрт биш, AO-д хэрэгтэй: оройн өнгө
      зөвхөн оройд хадгалагддаг тул хоёрхон мөртэй хананд булангийн сүүдэр
      огт гарахгүй.
    """
    verts, faces = [], []
    for j in range(rows + 1):
        t = j / rows
        r = r0 + (r1 - r0) * t
        z = z0 + (z1 - z0) * t
        for i in range(n):
            a = 2 * math.pi * i / n
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for j in range(rows):
        for i in range(n):
            i2 = (i + 1) % n
            faces.append((j * n + i, j * n + i2, (j + 1) * n + i2, (j + 1) * n + i))
    return link_mesh(name, verts, faces, mat)


def two_sided(ob, inner_mat, thickness):
    """Гадна нүүр — анхны материал, дотор нүүр — `inner_mat` (бүрээс ба эсгий)."""
    ob.data.materials.append(inner_mat)
    md = ob.modifiers.new('S', 'SOLIDIFY')
    md.thickness = thickness
    md.offset = -1.0
    md.material_offset = 1
    md.material_offset_rim = 1
    L.apply_all(ob)
    return ob


def tube_mesh(name, segs, mat, sides=6):
    """Олон шонг НЭГ меш болгоно — 48 унь 48 объект биш, 1 draw call."""
    verts, faces = [], []
    for p0, p1, r0, r1 in segs:
        p0, p1 = Vector(p0), Vector(p1)
        d = (p1 - p0).normalized()
        ref = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
        u = d.cross(ref).normalized()
        v = d.cross(u).normalized()
        b = len(verts)
        for p, r in ((p0, r0), (p1, r1)):
            for k in range(sides):
                a = 2 * math.pi * k / sides
                verts.append(tuple(p + (u * math.cos(a) + v * math.sin(a)) * r))
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append((b + k, b + k2, b + sides + k2, b + sides + k))
        faces.append(tuple(b + k for k in reversed(range(sides))))
        faces.append(tuple(b + sides + k for k in range(sides)))
    ob = link_mesh(name, verts, faces, mat, recalc=True)
    L.smooth(ob, 50)
    return ob


def torus_ring(name, loc, R_, r_, mat, major=96, minor=6):
    bpy.ops.mesh.primitive_torus_add(major_radius=R_, minor_radius=r_, major_segments=major,
                                     minor_segments=minor, location=loc)
    o = L.active()
    o.name = name
    L.assign(o, mat)
    L.smooth(o, 60)
    return o


def rock(loc, size, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    o = L.active()
    for v in o.data.vertices:
        v.co += Vector((rnd.uniform(-0.18, 0.18), rnd.uniform(-0.18, 0.18), rnd.uniform(-0.18, 0.18)))
    o.scale = size
    o.rotation_euler = (0, 0, rnd.uniform(0, 6.28))
    L.assign(o, mat)
    return o


def anchor(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    return e


def new_objects(before):
    return [o for o in bpy.data.objects if o not in before]


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ═══ Материал ═════════════════════════════════════════════════════════

def bsdf(m):
    if m is None or not m.use_nodes:
        return None
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def is_volume(m):
    return m is not None and m.use_nodes and bsdf(m) is None


def flatten(m):
    """
    Процедур node-ийг салгаж утга болгоно. ColorRamp-аас өнгийг 0.45 цэгт
    авна (хүрэл → хүрэл өнгө, патина биш; модны ширхэг → дундаж мод).
    """
    b = bsdf(m)
    if b is None:
        return
    nt = m.node_tree
    sock = b.inputs['Base Color']
    if sock.is_linked:
        src = sock.links[0].from_node
        col = tuple(src.color_ramp.evaluate(0.45)) if src.type == 'VALTORGB' else None
        nt.links.remove(sock.links[0])
        if col is not None:
            sock.default_value = col
    for name in ('Normal', 'Roughness', 'Metallic'):
        s = b.inputs.get(name)
        if s is not None and s.is_linked:
            nt.links.remove(s.links[0])
    # Sheen/coat/SSS нь three.js-д MeshPhysicalMaterial болж утсан дээр хүнд
    for name in ('Sheen Weight', 'Coat Weight', 'Subsurface Weight'):
        s = b.inputs.get(name)
        if s is not None:
            s.default_value = 0.0
    # Хоёр талт харуулах нь зөвхөн өвсний нэг давхар гурвалжинд хэрэгтэй
    m.use_backface_culling = not m.name.startswith('blade')


def mat_key(m):
    b = bsdf(m)

    def g(n):
        return b.inputs[n].default_value

    return (tuple(round(c, 3) for c in g('Base Color')[:3]), round(g('Metallic'), 2),
            round(g('Roughness'), 2), tuple(round(c, 3) for c in g('Emission Color')[:3]),
            round(g('Emission Strength'), 1), m.use_backface_culling)


def dedupe_materials():
    """Ижил материалыг нэгтгэнэ — 13 эд тус бүр өөрийн «алт»-тай байж 13 материал болохгүй."""
    canon = {}
    for ob in bpy.data.objects:
        if ob.type != 'MESH':
            continue
        for slot in ob.material_slots:
            m = slot.material
            if bsdf(m) is None:
                continue
            k = mat_key(m)
            canon.setdefault(k, m)
            slot.material = canon[k]
    return len(canon)


# ═══ Объект боловсруулалт ═════════════════════════════════════════════

def realize(objs):
    """
    Муруй → меш, модификатор хэрэглэх, эцэг (empty)-ийн хувиргалтыг
    шингээх. Эзэлхүүнт материалтай (утаа, туяа) объект glTF-д тунгалаг
    бус бөмбөлөг болох тул устгана — туяа, утааг апп өөрөө зурна.
    """
    bpy.context.view_layer.update()
    geo = [o for o in objs if o.type in ('MESH', 'CURVE')]
    world = {o.name: o.matrix_world.copy() for o in geo}
    for o in geo:
        o.parent = None
    for o in geo:
        o.matrix_world = world[o.name]
    bpy.ops.object.select_all(action='DESELECT')
    for o in geo:
        o.select_set(True)
    if geo:
        bpy.context.view_layer.objects.active = geo[0]
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    geo_names = {o.name for o in geo}
    for o in list(objs):
        try:
            name = o.name
        except ReferenceError:
            continue
        if name not in geo_names and not name.startswith(ANCHOR_PREFIX):
            bpy.data.objects.remove(o, do_unlink=True)
    keep = []
    for o in geo:
        if any(is_volume(m) for m in o.data.materials):
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            keep.append(o)
    return keep


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def normalize(ob, fit, size, mode='center', z_scale=1.0):
    """
    Эхийг ёроолын төв (эсвэл АР тал) болгож, `fit` хэмжээгээр томруулна.
    mode='back' — хананд наалдах эд: эх нь ар талд (+Y), тэгвэл байрлал нь
    хананы цэг, эргэлт нь эдийг гэрийн төв рүү харуулна.
    """
    vs = ob.data.vertices
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    dx, dy, dz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    ref = {'width': max(dx, dy), 'height': dz, 'max': max(dx, dy, dz)}[fit]
    s = size / ref
    ox = (min(xs) + max(xs)) / 2
    oy = max(ys) if mode == 'back' else (min(ys) + max(ys)) / 2
    oz = min(zs)
    for v in vs:
        v.co = Vector(((v.co.x - ox) * s, (v.co.y - oy) * s, (v.co.z - oz) * s * z_scale))
    ob.data.update()


def budget(ob, max_tris):
    n = tri_count(ob)
    if n > max_tris:
        md = ob.modifiers.new('D', 'DECIMATE')
        md.ratio = max(0.2, max_tris / n)
        L.select_only(ob)
        bpy.ops.object.modifier_apply(modifier=md.name)
    return tri_count(ob)


# ═══ 1. Тавцан ба тал нутаг ═══════════════════════════════════════════

def build_platform():
    ring_strip('plat_side', PLAT_R, 0.0, PLAT_R, GZ - 0.025, MAT['stone'], n=128, rows=3)
    ring_strip('plat_bevel', PLAT_R, GZ - 0.025, PLAT_R - 0.03, GZ, MAT['stone'], n=128)
    ring_strip('plat_top', PLAT_R - 0.03, GZ, 4.45, GZ, MAT['stone'], n=128)
    ring_strip('grass', 4.45, GZ + 0.002, R + 0.02, GZ + 0.002, MAT['grass'], n=128, rows=10)
    torus_ring('inlay', (0, 0, GZ + 0.004), 4.47, 0.018, MAT['gold'], major=128)

    verts, faces = [], []
    for _ in range(3500):
        r = math.sqrt(rnd.uniform((R + 0.15) ** 2, 4.4 ** 2))
        a = rnd.uniform(0, 2 * math.pi)
        x, y = r * math.cos(a), r * math.sin(a)
        if abs(x) < 0.5 and y < -R:
            continue
        h = rnd.uniform(0.03, 0.08)
        w = rnd.uniform(0.012, 0.02)
        ang = rnd.uniform(0, math.pi)
        dx, dy = math.cos(ang) * w / 2, math.sin(ang) * w / 2
        b = len(verts)
        verts += [(x - dx, y - dy, GZ), (x + dx, y + dy, GZ),
                  (x + rnd.uniform(-0.02, 0.02), y + rnd.uniform(-0.02, 0.02), GZ + h)]
        faces.append((b, b + 1, b + 2))
    link_mesh('blades', verts, faces, MAT['blade'])

    for sx, sy in ((0.05, -3.55), (-0.1, -3.9), (0.08, -4.22)):
        rock((sx, sy, GZ - 0.01), (0.22, 0.17, 0.04), MAT['rock'])
    for _ in range(12):
        a = rnd.uniform(0, 2 * math.pi)
        if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.45:
            continue
        r = rnd.uniform(3.7, 4.25)
        rock((r * math.cos(a), r * math.sin(a), GZ + 0.01),
             (rnd.uniform(0.08, 0.16), rnd.uniform(0.07, 0.13), rnd.uniform(0.05, 0.1)), MAT['rock'])


# ═══ 2. Хана, бүрээс, хаалга ══════════════════════════════════════════

def in_door(x, y, zl):
    return y < 0 and abs(x) < DOOR_W / 2 + FW + 0.01 and zl < DOOR_H + FW + 0.01


def build_lattice():
    """
    Хан хана — ДОТОР талд. ⚠ Хаалганы нүхийг boolean-аар биш, сегмент
    алгасаж гаргана (огтлолцсон туузыг EXACT solver устгадаг).
    """
    verts, faces = [], []
    M, segs = 44, 10
    wh = 0.05 * math.sqrt(2)
    r1, r0 = LAT_R, LAT_R - LAT_T
    prof = ((-wh / 2, r0), (wh / 2, r0), (wh / 2, r1), (-wh / 2, r1))

    def ring(s, zl):
        return [(rr * math.cos((s + ds) / LAT_R), rr * math.sin((s + ds) / LAT_R), GZ + zl)
                for ds, rr in prof]

    for direction in (1, -1):
        for i in range(M):
            th0 = 2 * math.pi * i / M
            for k in range(segs):
                za, zb = H * k / segs, H * (k + 1) / segs
                zm = (za + zb) / 2
                sm = th0 * LAT_R + direction * zm
                if in_door(LAT_R * math.cos(sm / LAT_R), LAT_R * math.sin(sm / LAT_R), zm):
                    continue
                b = len(verts)
                verts += ring(th0 * LAT_R + direction * za, za)
                verts += ring(th0 * LAT_R + direction * zb, zb)
                for j in range(4):
                    j2 = (j + 1) % 4
                    faces.append((b + j, b + j2, b + 4 + j2, b + 4 + j))
                faces.append((b + 3, b + 2, b + 1, b))
                faces.append((b + 4, b + 5, b + 6, b + 7))
    link_mesh('hana', verts, faces, MAT['paint'], recalc=True)


def build_walls():
    # Бүрээс ханын оройгоос ДЭЭШ 9 см — дээврийн захын доор завсар үлдээхгүй
    wall = ring_strip('wall', R, GZ, R, RZ0 + 0.09, MAT['canvas'], n=160, rows=15)
    two_sided(wall, MAT['felt_in'], 0.04)
    cuts = [wall, ring_strip('band_bot', R + 0.006, GZ + 0.015, R + 0.006, GZ + 0.2, MAT['blue'], rows=2)]
    for z in (GZ + 0.2, GZ + 0.02):
        cuts.append(torus_ring('wall_gold', (0, 0, z), R + 0.01, 0.008, MAT['gold'], major=160, minor=4))
    for f in (0.32, 0.62, 0.9):
        cuts.append(torus_ring('rope', (0, 0, GZ + H * f), R + 0.018, 0.017, MAT['rope'], major=160))

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -R, GZ + DOOR_H / 2 - 0.05))
    cut = L.active()
    cut.scale = (DOOR_W, 0.6, DOOR_H + 0.1)
    L.apply_scale(cut)
    for ob in cuts:
        L.boolean_diff(ob, cut)
    bpy.data.objects.remove(cut, do_unlink=True)
    build_lattice()


def build_door():
    """
    Хаалга гадагш бүрэн (78°) нээлттэй, гадна нүүрэндээ хөх самбар + алтан улзий.
    ⚠ Диорама шиг 40° байвал навчны үзүүр хаалганы голын шугамыг огтолж,
      апп дахь «гэрт орох» камерын зам навчийг нэвт гарна.
    """
    JY = -R - 0.02
    L.box('jambL', (FW, 0.2, DOOR_H + FW), (-DOOR_W / 2 - FW / 2, JY + 0.02, GZ + (DOOR_H + FW) / 2), MAT['paint'])
    L.box('jambR', (FW, 0.2, DOOR_H + FW), (DOOR_W / 2 + FW / 2, JY + 0.02, GZ + (DOOR_H + FW) / 2), MAT['paint'])
    L.box('lintel', (DOOR_W + 2 * FW, 0.2, FW), (0, JY + 0.02, GZ + DOOR_H + FW / 2), MAT['paint'])
    L.box('lintel_gold', (DOOR_W + 2 * FW - 0.04, 0.012, 0.03),
          (0, JY - 0.083, GZ + DOOR_H + FW / 2), MAT['gold'], bev=0.004)
    for sx in (-1, 1):
        L.box('jamb_gold', (0.025, 0.012, DOOR_H - 0.05),
              (sx * (DOOR_W / 2 + FW / 2), JY - 0.083, GZ + DOOR_H / 2), MAT['gold'], bev=0.004)
    L.box('bosgo', (DOOR_W + 0.3, 0.3, 0.07), (0, -R - 0.08, GZ + 0.035), MAT['paint_dk'])

    hinge = GI.empty('hinge', (-DOOR_W / 2, JY - 0.06, GZ), (0, 0, math.radians(-78)))
    leaf = L.box('leaf', (DOOR_W - 0.02, 0.06, DOOR_H - 0.02), (DOOR_W / 2, 0, DOOR_H / 2), MAT['paint'], bev=0.012)
    leaf.parent = hinge
    FY = -0.034
    panel = L.box('leaf_panel', (DOOR_W - 0.2, 0.006, DOOR_H - 0.24), (DOOR_W / 2, FY, DOOR_H / 2), MAT['blue'], bev=0)
    panel.parent = hinge
    cx0, cz0 = DOOR_W / 2, DOOR_H * 0.55
    GI.cord('leaf_ulzii', GI.xf(GI.ulzii_2d(), 0.4), 0, 0.01, MAT['gold'], parent=hinge,
            surf=lambda x, y: (cx0 + x, FY - 0.006, cz0 + y))
    GI.cord('leaf_frame', [(GI.rrect(DOOR_W - 0.24, DOOR_H - 0.28, 0.03), True)], 0, 0.009, MAT['gold'],
            parent=hinge, surf=lambda x, y: (DOOR_W / 2 + x, FY - 0.006, DOOR_H / 2 + y))


# ═══ 3. Дээвэр, унь, тооно, багана ════════════════════════════════════

DR = (TOONO_R + 0.03) - EAVE
DZ = (RZ1 + 0.01) - (RZ0 + 0.03)
LN = math.hypot(DR, DZ)
NR, NZ = DZ / LN, -DR / LN  # дээврийн гадагш нормаль (r, z) хавтгайд


def roof_pt(t, off=0.0):
    return EAVE + DR * t + NR * off, RZ0 + 0.03 + DZ * t + NZ * off


def build_roof():
    roof = ring_strip('roof', EAVE, RZ0 + 0.03, TOONO_R + 0.03, RZ1 + 0.01, MAT['canvas'], n=160, rows=10)
    two_sided(roof, MAT['felt_in'], 0.035)
    for t0, t1 in ((0.0, 0.13), (0.86, 1.0)):
        (ra, za), (rb, zb) = roof_pt(t0, 0.008), roof_pt(t1, 0.008)
        ring_strip('roof_band', ra, za, rb, zb, MAT['blue'], n=160, rows=2)
    for t in (0.13, 0.86):
        rr, zz = roof_pt(t, 0.012)
        torus_ring('roof_gold', (0, 0, zz), rr, 0.008, MAT['gold'], major=160, minor=4)
    torus_ring('eave', (0, 0, RZ0 + 0.03), EAVE, 0.028, MAT['rope'], major=160)
    rr, zz = roof_pt(0.45, 0.02)
    torus_ring('roof_rope', (0, 0, zz), rr, 0.014, MAT['rope'], major=128)

    # Унь — ханын толгойноос тооно руу; дээврийн эсгийн ДООР
    segs = []
    N = 48
    for i in range(N):
        a = 2 * math.pi * (i + 0.5) / N
        c, s = math.cos(a), math.sin(a)
        segs.append(((c * (LAT_R - 0.03), s * (LAT_R - 0.03), RZ0 + 0.02),
                     (c * (TOONO_R + 0.05), s * (TOONO_R + 0.05), RZ1 - 0.07), 0.026, 0.02))
    tube_mesh('uni', segs, MAT['paint'])


def build_toono():
    ring = ring_strip('toono_ring', TOONO_R + 0.06, RZ1 - 0.07, TOONO_R + 0.06, RZ1 + 0.1, MAT['paint'], n=64, rows=2)
    two_sided(ring, MAT['paint'], 0.08)
    ring_strip('toono_band', TOONO_R + 0.066, RZ1 - 0.01, TOONO_R + 0.066, RZ1 + 0.05, MAT['blue'], n=64)
    for z in (RZ1 - 0.01, RZ1 + 0.05):
        torus_ring('toono_gold', (0, 0, z), TOONO_R + 0.07, 0.007, MAT['gold'], major=64, minor=4)
    segs = []
    for ang in (0.0, math.pi / 2):
        pts = []
        for i in range(13):
            th = math.pi - math.pi * i / 12
            x = (TOONO_R - 0.01) * math.cos(th)
            pts.append((x * math.cos(ang), x * math.sin(ang), RZ1 + 0.09 + 0.2 * math.sin(th)))
        segs += [(pts[i], pts[i + 1], 0.026, 0.026) for i in range(12)]
    # Доод хөндлөвч — хоёр баганын оройг тоонотой холбоно
    segs.append(((-TOONO_R - 0.03, 0, RZ1 - 0.07), (TOONO_R + 0.03, 0, RZ1 - 0.07), 0.04, 0.04))
    tube_mesh('toono_bars', segs, MAT['paint'])


def build_pillars():
    """Хоёр багана — тоононы хөндлөвчийг тулна; хөх, алтан бүстэй."""
    top = RZ1 - 0.11
    for sx in (-1, 1):
        x = sx * 0.5
        L.box('bagana', (0.09, 0.09, top - GZ), (x, 0, (GZ + top) / 2), MAT['paint'], bev=0.01)
        for zc in (GZ + 0.4, GZ + 1.15, GZ + 1.9):
            L.box('bagana_band', (0.104, 0.104, 0.12), (x, 0, zc), MAT['blue'], bev=0.005)
            for dz in (-0.066, 0.066):
                L.box('bagana_gold', (0.11, 0.11, 0.012), (x, 0, zc + dz), MAT['gold'], bev=0.003)
        L.box('bagana_cap', (0.15, 0.15, 0.07), (x, 0, top - 0.035), MAT['paint_dk'], bev=0.012)
        L.box('bagana_base', (0.15, 0.15, 0.05), (x, 0, GZ + 0.025), MAT['paint_dk'], bev=0.01)


# ═══ 4. Шал ба байнгын тавилга ════════════════════════════════════════

def build_floor():
    ring_strip('floor', R - 0.035, GZ + 0.004, 0.02, GZ + 0.004, MAT['floor'], n=96, rows=18)
    for i in range(-10, 11):
        x = i * 0.27
        half = math.sqrt(max(0.0, (R - 0.06) ** 2 - x * x))
        if half > 0.1:
            L.box('plank', (0.012, 2 * half, 0.004), (x, 0, GZ + 0.006), MAT['plank'], bev=0)


def build_bed(cx, cy, facing):
    """Ор — хананы дагуу, толгой нь хоймор (хойд) зүгт."""
    ln, dp, hg = 1.8, 0.78, 0.36
    L.box('bed', (dp, ln, hg), (cx, cy, GZ + hg / 2), MAT['paint'], bev=0.015)
    L.box('bed_mat', (dp - 0.04, ln - 0.04, 0.09), (cx, cy, GZ + hg + 0.045), MAT['rug'], bev=0.03)
    L.box('pillow', (dp - 0.24, 0.32, 0.1), (cx, cy + ln / 2 - 0.3, GZ + hg + 0.13), MAT['cream'], bev=0.04)
    fx = cx + facing * (dp / 2 + 0.003)
    L.box('bed_panel', (0.006, ln - 0.24, hg - 0.14), (fx, cy, GZ + hg / 2), MAT['blue'], bev=0)
    for dz in (-(hg - 0.14) / 2, (hg - 0.14) / 2):
        L.box('bed_gold', (0.01, ln - 0.2, 0.014), (fx + facing * 0.002, cy, GZ + hg / 2 + dz), MAT['gold'], bev=0)
    L.box('bed_head', (dp, 0.06, 0.72), (cx, cy + ln / 2 + 0.03, GZ + 0.36), MAT['paint'], bev=0.012)
    L.box('bed_head_panel', (dp - 0.16, 0.006, 0.34), (cx, cy + ln / 2 - 0.003, GZ + 0.46), MAT['blue'], bev=0)


def build_cupboard():
    """Шүүгээ — ЗҮҮН (эмэгтэй) талд, хаалганы ойр; дээр нь зэс данх."""
    px, py = 1.98, -1.69
    e = GI.empty('shuugee', (px, py, GZ), (0, 0, math.atan2(py, px) - math.pi / 2))
    parts = [
        L.box('shuugee_body', (0.8, 0.42, 0.95), (0, 0, 0.475), MAT['paint'], bev=0.012),
        L.box('shuugee_top', (0.86, 0.46, 0.04), (0, 0, 0.97), MAT['paint_dk'], bev=0.01),
    ]
    for sx in (-1, 1):
        parts.append(L.box('shuugee_door', (0.33, 0.006, 0.6), (sx * 0.19, -0.213, 0.52), MAT['blue'], bev=0))
        GI.cord('shuugee_ulzii', GI.xf(GI.ulzii_2d(), 0.16), 0, 0.006, MAT['gold'], parent=e,
                surf=lambda x, y, sx=sx: (sx * 0.19 + x, -0.219, 0.56 + y))
    parts.append(L.box('shuugee_gold', (0.76, 0.01, 0.014), (0, -0.215, 0.86), MAT['gold'], bev=0))
    kettle = GI.lathe('kettle', [(0, 0), (0.11, 0), (0.13, 0.03), (0.14, 0.1), (0.12, 0.16), (0.06, 0.2),
                                 (0.06, 0.23), (0.02, 0.25), (0, 0.25)], MAT['copper'], seg=48)
    kettle.location = (0.15, 0, 0.99)
    parts += [kettle, GI.rod((0.27, 0, 1.07), (0.36, 0, 1.15), 0.018, 0.01, MAT['copper'])]
    for o in parts:
        o.parent = e


def build_khukhuur():
    """Хөхүүр (айргийн арьсан сав) + бүлүүр — БАРУУН (эрэгтэй) талд, хаалганы ойр."""
    x, y = -1.85, -1.9
    GI.sphere((x, y, GZ + 0.32), 1.0, MAT['leather'], scale=(0.24, 0.2, 0.32), seg=48)
    GI.rod((x, y, GZ + 0.6), (x, y, GZ + 0.7), 0.07, 0.06, MAT['leather'])
    GI.rod((x, y, GZ + 0.55), (x + 0.08, y + 0.06, GZ + 1.2), 0.018, 0.018, MAT['wood'])
    torus_ring('khukhuur_tie', (x, y, GZ + 0.62), 0.07, 0.012, MAT['rope'], major=24)


def build_zul_stand():
    """Хойморын баруун гарын жижиг ширээ — зул энд залагдана."""
    L.box('zul_stand', (0.36, 0.36, 0.4), (0.85, 2.35, GZ + 0.2), MAT['paint'], bev=0.01)
    L.box('zul_stand_top', (0.4, 0.4, 0.03), (0.85, 2.35, GZ + 0.405), MAT['paint_dk'], bev=0.008)
    L.box('zul_stand_panel', (0.26, 0.006, 0.24), (0.85, 2.35 - 0.183, GZ + 0.2), MAT['blue'], bev=0)


def build_table():
    before = set(bpy.data.objects)
    y = 2.6
    L.box('tbl_body', (0.9, 0.4, 0.44), (0, y, GZ + 0.22), MAT['paint'], bev=0.012)
    L.box('tbl_top', (0.96, 0.46, 0.04), (0, y, GZ + 0.46), MAT['paint_dk'], bev=0.01)
    L.box('tbl_panel', (0.78, 0.006, 0.3), (0, y - 0.203, GZ + 0.22), MAT['blue'], bev=0)
    for dz in (-0.16, 0.16):
        L.box('tbl_gold', (0.8, 0.01, 0.012), (0, y - 0.207, GZ + 0.22 + dz), MAT['gold'], bev=0)
    GI.cord('tbl_ulzii', GI.xf(GI.ulzii_2d(), 0.22), 0, 0.007, MAT['gold'],
            surf=lambda x, z: (x, y - 0.21, GZ + 0.22 + z))
    return join(realize(new_objects(before)), 'default_table')


def build_stove():
    """Төмөр зуух — яндан нь хоёр нумын завсраар (диагональ) тоонооор гарна."""
    before = set(bpy.data.objects)
    L.box('stove_plate', (0.9, 0.8, 0.012), (0, -0.1, GZ + 0.006), MAT['iron'], bev=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.box('stove_leg', (0.05, 0.05, 0.12), (sx * 0.24, -0.12 + sy * 0.17, GZ + 0.06), MAT['iron'], bev=0.005)
    L.box('stove_body', (0.6, 0.45, 0.42), (0, -0.12, GZ + 0.33), MAT['iron'], bev=0.02)
    L.box('stove_fire', (0.24, 0.008, 0.14), (0, -0.12 - 0.229, GZ + 0.3), MAT['fire'], bev=0)
    L.box('stove_handle', (0.3, 0.02, 0.02), (0, -0.12 - 0.235, GZ + 0.4), MAT['gold'], bev=0.004)
    torus_ring('stove_hole', (0.1, -0.12, GZ + 0.545), 0.1, 0.012, MAT['iron'], major=24, minor=4)
    px, py = 0.22, 0.22
    tube_mesh('stove_pipe', [((0, -0.05, GZ + 0.54), (0, -0.05, GZ + 0.66), 0.06, 0.06),
                             ((0, -0.05, GZ + 0.66), (px, py, GZ + 0.66), 0.06, 0.06),
                             ((px, py, GZ + 0.66), (px, py, RZ1 + 0.6), 0.06, 0.06)], MAT['iron'], sides=10)
    torus_ring('pipe_cap', (px, py, RZ1 + 0.6), 0.075, 0.015, MAT['gold'], major=24, minor=4)
    return join(realize(new_objects(before)), 'stove')


def build_soyombo():
    """
    Соёмбот тооно — тоононы алтан цагираг + хөндлөвчөөс унжсан медаль.
    Соёмбо ДООД нүүрэнд (гэрт орж дээш харахад) ба ДЭЭД нүүрэнд (гаднаас).
    """
    before = set(bpy.data.objects)
    torus_ring('soy_ring', (0, 0, RZ1 + 0.1), TOONO_R + 0.075, 0.018, MAT['gold'], major=64)
    hang = RZ1 + 0.03
    GI.rod((0, 0, RZ1 + 0.27), (0, 0, hang + 0.02), 0.006, 0.006, MAT['gold'], verts=6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.2, depth=0.025, location=(0, 0, hang))
    L.assign(L.active(), MAT['enamel'])
    torus_ring('soy_rim', (0, 0, hang), 0.2, 0.012, MAT['gold'], major=48)
    # Доод нүүр: X-ээр π (доош харуулна) + Z-ээр π (хаалганаас харахад дээд тал нь хойд зүгт)
    for name, z, rot in (('soy_bot', hang - 0.0125, (math.pi, 0, math.pi)), ('soy_top', hang + 0.0125, (0, 0, 0))):
        e = GI.empty(name, (0, 0, z), rot, scale=0.22)
        GI.plate(name + '_p', GI.soyombo_2d(), 0, 0.08, MAT['gold'], e, bev=0.01)
        GI.plate(name + '_t', [GI.circ(0.13, 32, 0, -0.05)], 0, 0.08, MAT['gold'], e, bev=0.01)
        GI.cord(name + '_s', [(GI.taiji_s(), False), (GI.circ(0.13, 32, 0, -0.05), True)],
                0.085, 0.014, MAT['enamel'], e)
    return join(realize(new_objects(before)), 'item_toono_soyombo')


# ═══ 5. Эд зүйлс — ger_items.py-ийн барилгуудыг дахин ашиглана ═════════

def felt_mats(m):
    """«Эсгий хөшиг» — хивсний хэлбэр, эсгий өнгө: цөцгий талбай, бор хүрээ, бор утас."""
    mm = dict(m)
    mm['indigo'] = L.mat('felt_hang', '#E6D8BC', rough=0.95)
    mm['red_felt'] = L.mat('felt_hang_border', '#6B3A22', rough=0.9)
    mm['gold'] = L.mat('felt_cord', '#3F2616', rough=0.8)
    mm['gold_dim'] = mm['gold']
    return mm


# key, барих, fit, хэмжээ(м), эх, байрлал (Blender), Z эргэлт(°), z_scale
ITEM_SPECS = [
    # Шал — гал голомт ба хойморын хооронд
    ('shirdeg_simple', lambda m: GI.b_shirdeg(m, False), 'width', 1.4, 'center', (0, 1.15, GZ + 0.008), 0, 0.25),
    ('shirdeg_ugalz', lambda m: GI.b_shirdeg(m, True), 'width', 1.4, 'center', (0, 1.15, GZ + 0.008), 0, 0.25),
    # Хана — зүүн талын орны дээр, гэрийн төв рүү харсан
    ('wall_felt', lambda m: GI.b_tapestry(felt_mats(m)), 'height', 0.85, 'back', (2.84, 0.15, GZ + 0.55), -90, 1.0),
    ('wall_royal', GI.b_tapestry, 'height', 0.85, 'back', (2.84, 0.15, GZ + 0.55), -90, 1.0),
    # Тавилга — хоймор
    ('chest_wood', GI.b_chest, 'width', 1.0, 'back', (0, 2.82, GZ), 0, 1.0),
    ('bronze_cauldron', GI.b_cauldron, 'height', 0.5, 'center', (0, 2.0, GZ), 0, 1.0),
    # Хөгжим — баруун (эрэгтэй) тал
    ('morin_khuur', GI.b_morin, 'height', 0.95, 'back', (-2.86, 0.45, GZ + 0.48), 90, 1.0),
    ('yatga', GI.b_yatga, 'width', 1.25, 'center', (-1.72, 1.2, GZ), 90, 1.0),
    # Гэрэл — зул хоймор дээр, гал голомт төвд (зуухыг орлоно)
    ('zul', GI.b_zul, 'height', 0.28, 'center', (0.85, 2.35, GZ + 0.42), 0, 1.0),
    ('hearth', GI.b_hearth, 'width', 0.85, 'center', (0, -0.1, GZ), 0, 1.0),
]


def build_item(spec):
    key, fn, fit, size, mode, loc, rot, zs = spec
    before = set(bpy.data.objects)
    fn(GI.mats())
    ob = join(realize(new_objects(before)), f'item_{key}')
    normalize(ob, fit, size, mode, zs)
    n = budget(ob, ITEM_TRIS)
    ob.location = loc
    ob.rotation_euler = (0, 0, math.radians(rot))
    print(f'ITEM {key:18s} tris={n}')
    return ob


# ═══ 6. Шошго, камер, гэрлийн цэгүүд ══════════════════════════════════

ANCHORS = {
    'anchor_khoimor': (0, 2.25, GZ + 1.2),
    'anchor_baruun': (-2.1, 0.2, GZ + 1.3),
    'anchor_zuun': (2.1, 0.2, GZ + 1.3),
    'anchor_golomt': (0, -0.1, GZ + 0.95),
    'anchor_toono': (0, 0, RZ1 + 0.1),
    'anchor_bosgo': (0, -R - 0.1, GZ + 0.2),
    'cam_inside': (0, -2.05, GZ + 1.38),
    'cam_inside_look': (0, 1.4, GZ + 0.85),
    'cam_door': (0, -5.6, GZ + 1.3),
    'cam_door_look': (0, -R, GZ + 0.8),
    'orbit_target': (0, 0, GZ + 1.05),
    'light_stove': (0, -0.42, GZ + 0.35),
    'light_hearth': (0, -0.1, GZ + 0.4),
    'light_zul': (0.85, 2.35, GZ + 0.72),
    'light_toono': (0, 0, RZ1 - 0.25),
    'light_door': (0, -R + 0.7, GZ + 1.05),
    'smoke_origin': (0.22, 0.22, RZ1 + 0.62),
}


# ═══ 7. AO шатаах ═════════════════════════════════════════════════════

def ensure_ao(ob):
    me = ob.data
    attr = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
    me.color_attributes.active_color = attr
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass


def bake(targets, hidden):
    for o in hidden:
        o.hide_render = True
    for o in targets:
        ensure_ao(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in targets:
        o.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o in hidden:
        o.hide_render = False


def lift(ob, floor):
    """AO-г [floor..1] руу шахна — бүрэн хар булан утасны дэлгэцэн дээр «нүх» мэт харагдана."""
    for d in ob.data.color_attributes['AO'].data:
        v = floor + (1 - floor) * d.color[0]
        d.color = (v, v, v, 1.0)


# ═══ Угсралт ══════════════════════════════════════════════════════════

build_platform()
build_walls()
build_door()
build_roof()
build_toono()
build_pillars()
build_floor()
build_bed(-2.33, 0.1, 1)
build_bed(2.33, 0.1, -1)
build_cupboard()
build_khukhuur()
build_zul_stand()

table = build_table()
stove = build_stove()
items = [build_soyombo()] + [build_item(s) for s in ITEM_SPECS]
special = set(items) | {table, stove}

shell_geo = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE') and o not in special]
shell = join(realize(shell_geo), 'ger_shell')
for o in list(bpy.data.objects):
    if o.type != 'MESH' and not o.name.startswith(ANCHOR_PREFIX):
        bpy.data.objects.remove(o, do_unlink=True)

for name, loc in ANCHORS.items():
    anchor(name, loc)

for m in bpy.data.materials:
    flatten(m)
n_mats = dedupe_materials()

if AO:
    sc.cycles.samples = 32
    sc.world.light_settings.distance = 0.9
    bake([shell], items)
    bake([stove, table], items)
    for it in items:
        bake([it], [o for o in items if o is not it])
    lift(shell, 0.32)
    for o in [stove, table] + items:
        lift(o, 0.45)

bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
    export_texcoords=False, export_normals=True, export_tangents=False,
    export_materials='EXPORT', export_vertex_color='ACTIVE' if AO else 'NONE',
    export_cameras=False, export_lights=False, export_extras=False,
    use_selection=False, use_visible=False, export_shared_accessors=True,
)

total = 0
for o in sorted((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: o.name):
    t = tri_count(o)
    total += t
    print(f'NODE {o.name:22s} tris={t:6d} verts={len(o.data.vertices):6d} mats={len(o.material_slots)}')
print(f'TOTAL_TRIS {total}  MATERIALS {n_mats}  AO {AO}')
print(f'GLB_KB {os.path.getsize(OUT) // 1024}  -> {OUT}')
