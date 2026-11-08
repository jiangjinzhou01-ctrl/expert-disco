"""Original THRESHOLD finish kit. Blender 4.3+, no remote assets.
Geometry and physics furniture bounds share src/chapter/world/atelier-layout.json.
Appends three material-batched streaming cells to the existing orbital manifest.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT = ROOT / 'public/assets/orbital/architecture'
SOURCE = ROOT / 'assets/source/atelier'
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M = {}
for name, color, metal, rough in [
    ('obsidian', (.035, .052, .055), .65, .34),
    ('bronze', (.64, .46, .25), .9, .3),
    ('metal', (.55, .61, .62), .9, .32),
    ('mineral', (.76, .72, .62), 0, .86),
    ('luminous', (1, .72, .38), 0, .45),
]:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if name == 'luminous':
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = 1.8
    M[name] = m

cells = []
current = None


def own(o, name, material):
    o.name = name
    o.data.materials.append(M[material])
    o['asset_id'] = name
    o['atelier_cell'] = current['id']
    current['objects'].append(o)
    return o


def box(name, center, size, material, bevel=.01, proxy=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    own(o, name, material)
    if bevel:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) * .23), segments=3, affect='EDGES', clamp_overlap=True)
        bm.to_mesh(o.data)
        bm.free()
        o.modifiers.new('Weighted machined normals', 'WEIGHTED_NORMAL')
    if proxy:
        current['proxy'].append({'type': 'box', 'position': center, 'size': size, 'material': material})
    return o


def lettering(name, text, position, size, rotation, material='bronze'):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = text
    curve.size = size
    curve.extrude = .0006
    curve.align_x = 'CENTER'
    font = ROOT / 'public/assets/atelier/fonts/Manrope.ttf'
    if font.exists():
        curve.font = bpy.data.fonts.load(str(font))
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    o.location = position
    o.rotation_euler = rotation
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    own(o, name, material)
    o.select_set(False)


layout = json.loads((ROOT / 'src/chapter/world/atelier-layout.json').read_text())
for sign, side in [(1, 'east'), (-1, 'west')]:
    current = {'id': 'A-atelier-' + side, 'slot': 'A', 'description': 'Machined gallery benches, bronze tactile inlays and etched wayfinding pylons', 'objects': [], 'proxy': []}
    cells.append(current)
    for prop in layout['props']:
        x, y, z = prop['center']
        if x * sign < 0:
            continue
        key = prop['id']
        if prop['kind'] == 'bench':
            # Every visible part fits the one shared conservative collision hull.
            box(key + '-seat', (x, .465, z), (.72, .11, 2.8), 'obsidian', .024, True)
            box(key + '-undercut', (x, .405, z), (.69, .015, 2.76), 'bronze', .003)
            for dz in [-.92, .92]:
                box(key + '-pier-' + str(dz), (x, .205, z + dz), (.42, .41, .20), 'metal', .018, True)
                box(key + '-foot-' + str(dz), (x, .015, z + dz), (.68, .03, .35), 'obsidian', .01)
                for dx in [-.14, .14]:
                    box(key + '-fastener-' + str(dx) + str(dz), (x + dx, .394, z + dz), (.028, .013, .04), 'bronze', .003)
            for dz in [-1.2, 1.2]:
                box(key + '-seat-inlay-' + str(dz), (x, .5201, z + dz), (.62, .001, .005), 'bronze', 0)
        else:
            box(key + '-body', (x, .58, z), (.32, 1.16, .36), 'obsidian', .026, True)
            box(key + '-cap', (x, 1.145, z), (.30, .026, .34), 'bronze', .004)
            for dy in [.24, .91]:
                box(key + '-indicator-' + str(dy), (x, dy, z + .181), (.21, .012, .002), 'luminous', 0)
            lettering(key + '-number', '02', (x, .61, z + .181), .14, (0, 0, 0))
    for z in [-6, 14]:
        x = sign * 8.45
        lettering('ATELIER-ROUTE-' + str(z) + side, '01 / THRESHOLD', (x, .0015, z), .19, (-math.pi / 2, 0, math.pi))
        box('ATELIER-INLAY-' + str(z) + side, (x, .001, z + .32), (.85, .0015, .008), 'bronze', 0)

current = {'id': 'B-atelier-surface', 'slot': 'B', 'description': 'Continuous curved bronze coping, precision edge inlays and original-axis witness marks', 'objects': [], 'proxy': []}
cells.append(current)
# Same CR1 3.2m quarter-circle and terminal wall, offset only 8mm above support.
points = [(x, 0, 0, 1) for x in [-1.0, 1.5]]
for i in range(1, 129):
    a = math.pi * .5 * i / 128
    points.append((1.5 + 3.2 * math.sin(a), 3.2 * (1 - math.cos(a)), -math.sin(a), math.cos(a)))
points.append((4.7, 7.2, -1, 0))
for z in [-8.96, -5.04]:
    vertices = []
    faces = []
    for x, y, ux, uy in points:
        for side in [-1, 1]:
            vertices.append((x + ux * .008, y + uy * .008, z + side * .015))
    for i in range(len(points)-1):
        a = i * 2
        faces.append((a, a+1, a+3, a+2))
    mesh = bpy.data.meshes.new('ATELIER-COPING')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    o = bpy.data.objects.new('ATELIER-COPING-' + str(z), mesh)
    bpy.context.collection.objects.link(o)
    own(o, o.name, 'bronze')
    for f in mesh.polygons:
        f.use_smooth = True
for x in [-.8, .8]:
    box('ATELIER-APPROACH-LINE-' + str(x), (x, .001, -2.3), (.009, .002, 3.7), 'bronze', 0)
lettering('ATELIER-GRAVITY-INLAY', '02 / INVERT', (0, .0015, -.2), .25, (-math.pi/2, 0, 0))
for z in [-9.9, -12, -14.1]:
    box('ATELIER-WALL-INLAY-' + str(z), (4.691, 4.3, z), (.002, 1.65, .013), 'bronze', 0)

manifest_path = OUT / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['chunks'] = [c for c in manifest['chunks'] if '-atelier-' not in c['id']]
for cell in cells:
    objects = cell['objects']
    bpy.context.view_layer.update()
    bounds = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    vv, ff = [], []
    for o in objects:
        start = len(vv)
        vv.extend([o.matrix_world @ v.co for v in o.data.vertices])
        ff.extend([[start+i for i in f.vertices] for f in o.data.polygons])
    tree = BVHTree.FromPolygons(vv, ff)
    for o in objects:
        uv = o.data.uv_layers.active or o.data.uv_layers.new(name='PhysicalUV')
        color = o.data.color_attributes.new(name='AmbientOcclusion', type='FLOAT_COLOR', domain='POINT')
        o.data.color_attributes.active_color = color
        for face in o.data.polygons:
            for loop in face.loop_indices:
                p = o.matrix_world @ o.data.vertices[o.data.loops[loop].vertex_index].co
                n = face.normal
                uv.data[loop].uv = (p.x*2,p.z*2) if abs(n.y)>.6 else (p.z*2,p.y*2) if abs(n.x)>.6 else (p.x*2,p.y*2)
        for v in o.data.vertices:
            n = (o.matrix_world.to_3x3() @ v.normal).normalized()
            p = o.matrix_world @ v.co + n*.004
            occluded = tree.ray_cast(p, n, .5)[0] is not None
            ao = .76 if occluded else 1
            color.data[v.index].color = (ao,ao,ao,1)
    # Export copies: the editable .blend retains the individual machined parts.
    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for o in objects:
        copy = o.copy()
        copy.data = o.data.copy()
        bpy.context.collection.objects.link(copy)
        copy.select_set(True)
        copies.append(copy)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = cell['id']
    bpy.ops.export_scene.gltf(filepath=str(OUT / (cell['id']+'.glb')), use_selection=True, export_format='GLB', export_yup=False, export_apply=True, export_extras=True, export_vertex_color='ACTIVE')
    triangles = sum(len(f.vertices)-2 for f in joined.data.polygons)
    record = {k:cell[k] for k in ['id','slot','description','proxy']}
    record.update(file=cell['id']+'.glb', bounds=[[min(p[k] for p in bounds) for k in range(3)],[max(p[k] for p in bounds) for k in range(3)]], triangles=triangles, bytes=(OUT/(cell['id']+'.glb')).stat().st_size, drawCalls=len({m.name for m in joined.data.materials}))
    manifest['chunks'].append(record)
    bpy.data.objects.remove(joined, do_unlink=True)

manifest['totalTriangles'] = sum(c['triangles'] for c in manifest['chunks'])
manifest['totalBytes'] = sum(c['bytes'] for c in manifest['chunks'])
manifest['atelierGenerator'] = 'scripts/build-atelier-assets.py'
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'threshold-atelier-finishes.blend'))
(SOURCE/'manifest.json').write_text(json.dumps({'generator':'scripts/build-atelier-assets.py','sharedLayout':'src/chapter/world/atelier-layout.json','chunks':[c for c in manifest['chunks'] if '-atelier-' in c['id']]},indent=2)+'\n')
print('ATELIER: generated three real streaming cells, original furniture and continuous support inlays.')
