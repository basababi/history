"""
nomad_lib — Blender 5.x туслах сан (Эртний Өв ассетийн шугам)

ЗОРИЛГО: аппын бүх 3D ассетийг НЭГ хэв маягаар — ижил гэрэлтүүлэг,
материал, камер, рендерийн тохиргоотой — скриптээр үүсгэх. Гараар
хийсэн ассет бүр өөр өөр харагддаг; скрипт нь нийцтэй байдлыг баталгаажуулна.

ГОЛ ШИЙДВЭРҮҮД:
  • Cycles CPU + OIDN denoise. Энэ машинд GPU байхгүй (i7-1355U).
    EEVEE нь дэлгэцгүй горимд shader хөрвүүлэлтэд 15с зарцуулж, эмзэг байв.
  • film_transparent = True. «Цагаан дөрвөлжин» асуудлын ҮНДСЭН засвар:
    PNG нь альфа сувагтай тул аппын шөнийн хөх дэвсгэр шууд харагдана.
  • AgX view transform — алтан металл ба дулаан гэрэлд Filmic-ээс
    илүү байгалийн өнгө өгнө (хэт ханалтыг цагаан руу биш, зөөлөн
    шилжүүлдэг).

Ажиллуулах:
  blender --background --factory-startup --python <script.py> -- --out x.png
"""
import math

import bmesh
import bpy
from mathutils import Vector

# Муруйн бевелийн нарийвчлал. Рендерт 4 (гөлгөр), бодит цагийн GLB-д 1 —
# ger_realtime.py үүнийг import хийхээсээ ӨМНӨ бууруулна.
CURVE_RES = 4


# ─── Өнгө ───────────────────────────────────────────────────────────

def lin(c: float) -> float:
    """sRGB [0..1] → шугаман. Blender дотооддоо шугаман өнгө хэрэглэдэг."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h: str, a: float = 1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (lin(r), lin(g), lin(b), a)


# ─── Үзэгдэл ба рендер ─────────────────────────────────────────────

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def setup_render(sc, res_x: int, res_y: int, samples: int, transparent: bool = True,
                 look: str = 'AgX - Punchy'):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 4
    sc.cycles.volume_bounces = 1
    sc.cycles.transparent_max_bounces = 16

    sc.render.film_transparent = transparent
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.resolution_percentage = 100

    im = sc.render.image_settings
    im.file_format = 'PNG'
    im.color_mode = 'RGBA'
    im.color_depth = '8'
    im.compression = 90

    for vt in ('AgX',):
        try:
            sc.view_settings.view_transform = vt
            break
        except Exception:
            pass
    # Punchy — AgX нь өндөр гэрэлд өнгийг цайруулдаг тул улаан → ягаан,
    # хөх → цайвар цэнхэр болж «пастел» харагдаж байв. Аппын гүн навч
    # хөх + алтан палитрт нийцэхийн тулд ханалтыг сэргээнэ.
    for lk in (look, 'AgX - Punchy', 'Punchy', 'AgX - Medium High Contrast'):
        try:
            sc.view_settings.look = lk
            break
        except Exception:
            continue
    print('LOOK', sc.view_settings.view_transform, sc.view_settings.look)


def world(sc, color: str, strength: float):
    """
    Орчны гэрэл. Дэвсгэр тунгалаг ч орчны гэрэл металлын тусгалд үлдэнэ —
    бүрэн хар орчинд алт бүдэг, амьгүй харагддаг.
    """
    w = bpy.data.worlds.new('World')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = hexc(color)
    bg.inputs[1].default_value = strength


# ─── Материал ──────────────────────────────────────────────────────

def _bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def _set(node, name, val):
    if name in node.inputs:
        node.inputs[name].default_value = val


def mat(name, color, rough=0.5, metal=0.0, spec=0.5, sheen=0.0, coat=0.0,
        emit=None, emit_strength=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    _set(b, 'Base Color', hexc(color))
    _set(b, 'Roughness', rough)
    _set(b, 'Metallic', metal)
    _set(b, 'Specular IOR Level', spec)
    _set(b, 'Sheen Weight', sheen)
    _set(b, 'Coat Weight', coat)
    _set(b, 'Subsurface Weight', sss)
    if emit:
        _set(b, 'Emission Color', hexc(emit))
        _set(b, 'Emission Strength', emit_strength)
    return m


def add_noise_bump(m, scale=40.0, strength=0.25, detail=6.0):
    """Эсгий, мод, чулууны гадаргын бүтэц — хавтгай хуванцар шиг харагдахаас сэргийлнэ."""
    nt = m.node_tree
    b = _bsdf(m)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = detail
    bm = nt.nodes.new('ShaderNodeBump')
    bm.inputs['Strength'].default_value = strength
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bm.inputs['Height'])
    nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    return m


def add_color_variation(m, c1, c2, scale=6.0):
    """Өнгөний жигд бус байдал — байгалийн материалд заавал."""
    nt = m.node_tree
    b = _bsdf(m)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 4.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = hexc(c1)
    ramp.color_ramp.elements[1].color = hexc(c2)
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def vol_mat(name, color, density, emit=None, emit_strength=0.0):
    """Эзэлхүүнт материал — тоононы утаа."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            nt.nodes.remove(n)
    out = nt.nodes['Material Output']
    pv = nt.nodes.new('ShaderNodeVolumePrincipled')
    pv.inputs['Color'].default_value = hexc(color)
    pv.inputs['Density'].default_value = density
    if emit:
        pv.inputs['Emission Color'].default_value = hexc(emit)
        pv.inputs['Emission Strength'].default_value = emit_strength
    nt.links.new(pv.outputs['Volume'], out.inputs['Volume'])
    return m


def soft_volume_mat(name, color, density, emit=None, emit_strength=0.0,
                    noise_scale=2.4, seed=0.0, falloff_pow=1.7, lo=0.3, hi=0.8):
    """
    Зөөлөн ирмэгтэй, үүлэрхэг эзэлхүүн — утаа, уур.

    ⚠ Нэгэн жигд нягттай бөмбөлөг ирмэгээрээ «цасан хүн» шиг харагддаг.
      Энд нягт = (1 − төвөөс зай)^pow × дуу чимээ, тэгэхээр ирмэг нь
      тэг рүү уусаж, дотор нь эргэлдсэн утааны бүтэц үүснэ.

    Торон бөмбөлгийг РАДИУС 1-ээр үүсгээд объектын scale-аар томруулах
    ёстой — тэгвэл Object координатын урт [0..1] болж зай хэвийн болно.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            nt.nodes.remove(n)
    out = nt.nodes['Material Output']
    tc = nt.nodes.new('ShaderNodeTexCoord')

    ln = nt.nodes.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    nt.links.new(tc.outputs['Object'], ln.inputs[0])

    fall = nt.nodes.new('ShaderNodeMapRange')
    fall.clamp = True
    fall.inputs['From Min'].default_value = 0.0
    fall.inputs['From Max'].default_value = 1.0
    fall.inputs['To Min'].default_value = 1.0
    fall.inputs['To Max'].default_value = 0.0
    nt.links.new(ln.outputs['Value'], fall.inputs['Value'])

    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = falloff_pow
    nt.links.new(fall.outputs['Result'], pw.inputs[0])

    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['W'].default_value = seed
    nz.inputs['Scale'].default_value = noise_scale
    nz.inputs['Detail'].default_value = 5.0
    nz.inputs['Roughness'].default_value = 0.62
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])

    ctr = nt.nodes.new('ShaderNodeMapRange')
    ctr.clamp = True
    ctr.inputs['From Min'].default_value = lo
    ctr.inputs['From Max'].default_value = hi
    nt.links.new(nz.outputs['Fac'], ctr.inputs['Value'])

    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(pw.outputs['Value'], mul.inputs[0])
    nt.links.new(ctr.outputs['Result'], mul.inputs[1])

    dens = nt.nodes.new('ShaderNodeMath')
    dens.operation = 'MULTIPLY'
    dens.inputs[1].default_value = density
    nt.links.new(mul.outputs['Value'], dens.inputs[0])

    pv = nt.nodes.new('ShaderNodeVolumePrincipled')
    pv.inputs['Color'].default_value = hexc(color)
    nt.links.new(dens.outputs['Value'], pv.inputs['Density'])
    if emit:
        pv.inputs['Emission Color'].default_value = hexc(emit)
        em = nt.nodes.new('ShaderNodeMath')
        em.operation = 'MULTIPLY'
        em.inputs[1].default_value = emit_strength
        nt.links.new(mul.outputs['Value'], em.inputs[0])
        nt.links.new(em.outputs['Value'], pv.inputs['Emission Strength'])
    nt.links.new(pv.outputs['Volume'], out.inputs['Volume'])
    return m


def assign(ob, m):
    ob.data.materials.clear()
    ob.data.materials.append(m)
    return ob


# ─── Геометрийн туслах ─────────────────────────────────────────────

def active():
    return bpy.context.active_object


def smooth(ob, angle=35):
    """Өнцгөөр гөлгөржүүлэх — Blender 4.1+ API (auto smooth-ийн орлуулга)."""
    me = ob.data
    if hasattr(me, 'shade_smooth'):
        me.shade_smooth()
    else:
        for p in me.polygons:
            p.use_smooth = True
    if hasattr(me, 'set_sharpness_by_angle'):
        me.set_sharpness_by_angle(angle=math.radians(angle))
    return ob


def bevel(ob, width=0.02, segments=3):
    """Хурц ирмэг байгальд байдаггүй — налуу ирмэг гэрлийг барьж хэлбэрийг тодруулна."""
    md = ob.modifiers.new('Bevel', 'BEVEL')
    md.width = width
    md.segments = segments
    md.limit_method = 'ANGLE'
    return ob


def solidify(ob, t):
    md = ob.modifiers.new('Solid', 'SOLIDIFY')
    md.thickness = t
    return ob


def select_only(ob):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_all(ob):
    select_only(ob)
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def apply_scale(ob):
    select_only(ob)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def boolean_diff(ob, cutter):
    md = ob.modifiers.new('Cut', 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = cutter
    try:
        md.solver = 'EXACT'
    except Exception:
        pass
    select_only(ob)
    bpy.ops.object.modifier_apply(modifier=md.name)


def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return ob


def poly_curve(name, splines, bevel_depth, cyclic=None, resolution=None):
    """Бевелтэй олон шугаман муруй — алтан хүрээ, улзий зэрэг хээнд."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel_depth
    cu.bevel_resolution = CURVE_RES if resolution is None else resolution
    for i, pts in enumerate(splines):
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for j, p in enumerate(pts):
            sp.points[j].co = (p[0], p[1], p[2], 1.0)
        if cyclic and cyclic[i]:
            sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    return ob


def box(name, size, loc, material, bev=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = active()
    o.name = name
    o.scale = size
    apply_scale(o)
    assign(o, material)
    if bev:
        bevel(o, bev, 2)
    return o


# ─── Гэрэл ба камер ────────────────────────────────────────────────

def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def area_light(name, loc, target, energy, size, color):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.size = size
    ld.color = hexc(color)[:3]
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    look_at(ob, target)
    return ob


def point_light(name, loc, energy, radius, color):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.shadow_soft_size = radius
    ld.color = hexc(color)[:3]
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    return ob


def spot_light(name, loc, target, energy, angle_deg, blend, radius, color):
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = energy
    ld.spot_size = math.radians(angle_deg)
    ld.spot_blend = blend
    ld.shadow_soft_size = radius
    ld.color = hexc(color)[:3]
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    look_at(ob, target)
    return ob


def studio_rig(center, key=2200, rim=1400, fill=350):
    """
    Гурван цэгийн гэрэл — БАРААН UI-д зориулсан.

    ⚠ Арын (rim) гэрэл ЗААВАЛ. Аппын дэвсгэр #080E18 бараг хар тул
      арын гэрэлгүй бол объектын сүүдэртэй тал дэвсгэрт уусч алга болно.
      Хүйтэн оюу өнгөтэй rim нь дулаан key-тэй тэнцвэр үүсгэнэ.
    """
    c = Vector(center)
    area_light('key', c + Vector((-6, -7, 8)), c, key, 7, '#FFE6C2')
    area_light('rim', c + Vector((6, 7, 5)), c, rim, 6, '#8EE3F0')
    area_light('fill', c + Vector((8, -5, 1)), c, fill, 8, '#9DB7E8')


def ortho_camera(sc, az_deg, el_deg, target, dist=30.0):
    cd = bpy.data.cameras.new('Cam')
    cd.type = 'ORTHO'
    cam = bpy.data.objects.new('Cam', cd)
    bpy.context.collection.objects.link(cam)
    az = math.radians(az_deg)
    el = math.radians(el_deg)
    t = Vector(target)
    cam.location = t + Vector((math.sin(az) * math.cos(el),
                               -math.cos(az) * math.cos(el),
                               math.sin(el))) * dist
    look_at(cam, t)
    sc.camera = cam
    return cam


def frame(sc, cam, objs, pad=1.1):
    """
    Объектуудыг кадрт автоматаар багтаана.

    Ортографик камерын `ortho_scale` нь рендерийн ТОМ талд үйлчилнэ —
    тиймээс харьцаанаас хамаарч өргөн эсвэл өндрөөр тооцоолно.
    """
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for ob in objs:
        if ob.type not in ('MESH', 'CURVE'):
            continue
        for c in ob.bound_box:
            p = inv @ (ob.matrix_world @ Vector(c))
            xs.append(p.x)
            ys.append(p.y)
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    aspect = sc.render.resolution_x / sc.render.resolution_y
    scale = max(w, h * aspect) if aspect >= 1 else max(w / aspect, h)
    cam.data.ortho_scale = scale * pad
    cam.location = cam.matrix_world @ Vector((cx, cy, 0))
    bpy.context.view_layer.update()


def render(sc, out_path, blend_path=None):
    sc.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    if blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print('RENDERED', out_path)


def cli_args():
    import sys
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

    def get(name, default):
        return a[a.index(name) + 1] if name in a else default

    return get
