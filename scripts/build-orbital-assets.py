"""THRESHOLD orbital construction kit. Original authored geometry, CC0.

Build all production GLBs, cheap silhouette descriptors and editable .blend:
  blender -b --python scripts/build-orbital-assets.py -- /absolute/project

Coordinates deliberately match the existing Y-up CR1 architecture. These are
visual construction details, never replacements for the shared support collider.
Every detailed export is joined by material inside its streaming cell.
"""
import bpy
import bmesh
import json
import math
import sys
import shutil
from pathlib import Path
from mathutils import Vector

ROOT = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT = ROOT / 'public/assets/orbital/architecture'
SOURCE = ROOT / 'assets/source/orbital'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
(SOURCE / 'chunks').mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

MATERIALS = {}
for name, rgb, metal, rough, emission in [
    ('metal', (0.49, 0.53, 0.54), .82, .32, 0),
    ('bronze', (.63, .43, .23), .84, .31, 0),
    ('limestone', (.56, .54, .49), .02, .77, 0),
    ('basalt', (.055, .072, .083), .38, .43, 0),
    ('glass', (.28, .53, .61), .10, .14, 0),
    ('luminous', (.97, .77, .43), .05, .3, 3.2),
    ('cool-luminous', (.37, .78, .94), .05, .25, 2.3),
]:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*rgb, 1)
        bs.inputs['Emission Strength'].default_value = emission
    if name == 'glass':
        bs.inputs['Alpha'].default_value = .115
        mat.surface_render_method = 'DITHERED'
    MATERIALS[name] = mat

CHUNKS = []
current = None


def cell(name, world, description):
    global current
    current = {'id': name, 'slot': world, 'description': description, 'objects': [], 'proxy': []}
    CHUNKS.append(current)


def own(obj, name, mat):
    obj.name = name
    obj.data.materials.append(MATERIALS[mat])
    obj['chunk'] = current['id']
    obj['asset_id'] = name
    obj['original_author'] = 'THRESHOLD orbital construction kit'
    current['objects'].append(obj)
    return obj


def finish(obj, bevel=0):
    if bevel:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES', clamp_overlap=True)
        bm.to_mesh(obj.data)
        bm.free()
    return obj


def box(name, c, size, mat='metal', bevel=.015, proxy=False, rotation=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x * size[0] / 2, y * size[1] / 2, z * size[2] / 2)
                    for x, y, z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),
                                    (1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]], [],
                   [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)])
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.location = c
    if rotation:
        obj.rotation_euler = rotation
    own(obj, name, mat)
    finish(obj, min(bevel, min(size) * .18) if bevel else 0)
    if proxy:
        current['proxy'].append({'type': 'box', 'position': list(c), 'size': list(size), 'material': mat,
                                 'rotation': list(rotation or (0, 0, 0))})
    return obj


def cylinder(name, c, radius, depth, mat='metal', axis='Y', radius2=None, vertices=20, proxy=False):
    r2 = radius if radius2 is None else radius2
    vv = [(math.cos(i * math.tau / vertices) * r, math.sin(i * math.tau / vertices) * r, dz)
          for r, dz in [(radius, -depth / 2), (r2, depth / 2)] for i in range(vertices)]
    ff = [tuple(reversed(range(vertices))), tuple(range(vertices, vertices * 2))]
    ff += [(i, (i+1) % vertices, (i+1) % vertices + vertices, i + vertices) for i in range(vertices)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(vv, [], ff)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.location = c
    rotation = {'Y': (-math.pi / 2, 0, 0), 'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0)}[axis]
    obj.rotation_euler = rotation
    own(obj, name, mat)
    finish(obj, min(.012, depth * .08, radius * .1))
    if proxy:
        current['proxy'].append({'type': 'cylinder', 'position': list(c), 'radius': radius,
                                 'radius2': radius if radius2 is None else radius2,
                                 'depth': depth, 'axis': axis, 'material': mat})
    return obj


def tube(name, a, b, radius=.025, mat='metal', vertices=12):
    aa, bb = Vector(a), Vector(b)
    delta = bb - aa
    obj = cylinder(name, (aa + bb) / 2, radius, delta.length, mat, 'Z', vertices=vertices)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


def torus(name, c, major, minor, mat='bronze', axis='Z', segments=64, proxy=False):
    vv = [((major + minor * math.cos(j * math.tau / 8)) * math.cos(i * math.tau / segments),
           (major + minor * math.cos(j * math.tau / 8)) * math.sin(i * math.tau / segments),
           minor * math.sin(j * math.tau / 8)) for i in range(segments) for j in range(8)]
    ff = [(i * 8 + j, ((i + 1) % segments) * 8 + j, ((i + 1) % segments) * 8 + (j+1) % 8,
           i * 8 + (j+1) % 8) for i in range(segments) for j in range(8)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(vv, [], ff)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.location = c
    rotation = {'Z': (0, 0, 0), 'Y': (math.pi / 2, 0, 0), 'X': (0, math.pi / 2, 0)}[axis]
    obj.rotation_euler = rotation
    own(obj, name, mat)
    if proxy:
        current['proxy'].append({'type': 'torus', 'position': list(c), 'radius': major,
                                 'tube': minor, 'axis': axis, 'material': mat})
    return obj


def bolt(name, c, axis='Z', radius=.027, mat='bronze'):
    cylinder(name + '-head', c, radius, .018, mat, axis, vertices=6)
    direction = {'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[axis]
    cc = tuple(c[i] + direction[i] * .01 for i in range(3))
    cylinder(name + '-socket', cc, radius * .41, .004, 'basalt', axis, vertices=6)


def chamfer_ring(name, z, width, height, thickness=.1, depth=.18, y=0, mat='metal', open_floor=False):
    # Octagonal structural rib: open centre and real extruded thickness.
    cut = .43
    half = width / 2
    outer = [(-half + cut, y), (half - cut, y), (half, y + cut), (half, y + height - cut),
             (half - cut, y + height), (-half + cut, y + height), (-half, y + height - cut), (-half, y + cut)]
    inner = [(x - math.copysign(thickness, x), yy + thickness if yy < y + height / 2 else yy - thickness)
             for x, yy in outer]
    verts = [(x, yy, z + dz) for dz in (-depth / 2, depth / 2) for ring in (outer, inner) for x, yy in ring]
    faces = []
    for i in range(8):
        # The authored capsule has no raised threshold across its walkable
        # floor. Lower corner braces are omitted as well: their diagonal inner
        # edges would otherwise intrude into the unchanged vertical guard.
        if open_floor and i in [0, 1, 7]:
            continue
        j = (i + 1) % 8
        faces += [(i, j, 8 + j, 8 + i), (16 + i, 24 + i, 24 + j, 16 + j),
                  (i, 16 + i, 16 + j, j), (8 + i, 8 + j, 24 + j, 24 + i)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    own(obj, name, mat)
    finish(obj, .012)
    # A cheap open silhouette, never an opaque box across a window or doorway.
    for x in [-half + thickness / 2, half - thickness / 2]:
        current['proxy'].append({'type': 'box', 'position': [x, y + height / 2, z],
                                 'size': [thickness, height - .3, depth], 'material': mat, 'rotation': [0, 0, 0]})
    current['proxy'].append({'type': 'box', 'position': [0, y + height - thickness / 2, z],
                             'size': [width - .4, thickness, depth], 'material': mat, 'rotation': [0, 0, 0]})
    return obj


def panel(name, c, size, normal='Z', mat='metal', fasteners=True):
    obj = box(name, c, size, mat, .025)
    # Inset framing provides a real shadowed reveal rather than a flat texture.
    if normal == 'X':
        sign = -1 if c[0] > 0 else 1
        box(name + '-inset', (c[0] + sign * (size[0] / 2 + .006), c[1], c[2]),
            (.012, size[1] * .8, size[2] * .84), 'basalt', .005)
        if fasteners:
            for dy in [-.4, .4]:
                for dz in [-.4, .4]:
                    bolt(name + f'-bolt-{dy}-{dz}', (c[0] + sign * (size[0] / 2 + .018),
                                                    c[1] + size[1] * dy, c[2] + size[2] * dz), 'X')
    elif normal in ['Z', '-Z']:
        sign = -1 if normal == '-Z' else 1
        box(name + '-inset', (c[0], c[1], c[2] + sign * (size[2] / 2 + .007)),
            (size[0] * .8, size[1] * .8, .012), 'basalt', .005)
        if fasteners:
            for dx in [-.4, .4]:
                for dy in [-.4, .4]:
                    bolt(name + f'-bolt-{dx}-{dy}', (c[0] + size[0] * dx, c[1] + size[1] * dy,
                                                    c[2] + sign * (size[2] / 2 + .022)))
    return obj


# 01 / Capsule. Existing side-wall colliders are retained behind visible glazing.
cell('A-capsule', 'A', 'Machined octagonal transfer capsule, glazing, fasteners and services')
for i, z in enumerate([22.15, 24.4, 26.65, 28.9, 31.15, 33.4, 35.8]):
    chamfer_ring(f'CAPSULE-RIB-{i}', z, 4.24, 4.8, .12, .2, mat='metal', open_floor=True)
    for x in [-2.16, 2.16]:
        for y in [.55, 4.24]:
            box(f'CAPSULE-RIB-BOOT-{i}-{x}-{y}', (x, y, z), (.24, .48, .27), 'basalt', .025)
            for yy in [y - .11, y + .11]:
                bolt(f'CAPSULE-RIB-FIX-{i}-{x}-{yy}', (x, yy, z + .145), radius=.035)
for i, z in enumerate([23.275, 25.525, 27.775, 30.025, 32.275, 34.6]):
    for sign in [-1, 1]:
        x = sign * 2.025
        box(f'CAPSULE-VIEW-{sign}-{i}', (x, 2.38, z), (.035, 3.05, 2.025), 'glass', .006)
        box(f'CAPSULE-SILL-{sign}-{i}', (sign * 2.13, .42, z), (.26, .84, 2.04), 'basalt', .025, True)
        panel(f'CAPSULE-SILL-COVER-{sign}-{i}', (sign * 2.08, .43, z), (.035, .62, 1.88), 'X')
        box(f'CAPSULE-CROWN-{sign}-{i}', (x, 4.44, z), (.16, .67, 2.03), 'basalt', .025, True)
        box(f'CAPSULE-CROWN-LIGHT-{sign}-{i}', (sign * 1.925, 4.16, z), (.018, .035, 1.78), 'luminous', .003)
    box(f'CAPSULE-SKYLIGHT-{i}', (0, 4.81, z), (3.11, .035, 2.02), 'glass', .005)
    for x in [-1.53, 1.53]:
        box(f'CAPSULE-OVERHEAD-TRUNK-{i}-{x}', (x, 4.7, z), (.22, .16, 2.03), 'basalt', .02, True)
        for j in range(7):
            box(f'CAPSULE-VENT-{i}-{x}-{j}', (x, 4.605, z - .69 + j * .23), (.19, .022, .07), 'metal', .004)
    # Thin floor plates share the actual existing floor height. No artificial steps.
    for x in [-1.24, 0, 1.24]:
        box(f'CAPSULE-DECK-{i}-{x}', (x, .004, z), (1.19, .006, 2.09), 'metal', .001)
        for dz in [-.84, .84]:
            cylinder(f'CAPSULE-DECK-FASTENER-{i}-{x}-{dz}', (x, .009, z + dz), .023, .004, 'basalt', 'Y', vertices=8)
    for x in [-1.67, 1.67]:
        box(f'CAPSULE-FLOOR-WAYFINDING-{i}-{x}', (x, .012, z), (.025, .008, 1.93), 'luminous', .001)
for sign in [-1, 1]:
    tube(f'CAPSULE-HANDRAIL-{sign}', (sign * 2.05, 1.05, 22.4), (sign * 2.05, 1.05, 35.7), .026, 'bronze')
    for z in [23.1, 27.6, 32.1, 35.5]:
        tube(f'CAPSULE-RAIL-BRACKET-{sign}-{z}', (sign * 2.05, 1.05, z), (sign * 2.15, .96, z), .021)
    # Paired utility conduits are outside the main clear capsule volume.
    for y in [4.52, 4.61]:
        tube(f'CAPSULE-CONDUIT-{sign}-{y}', (sign * 1.68, y, 22.2), (sign * 1.68, y, 35.8), .028, 'bronze')
# Rear airlock retains the visible stop at the old collider z=36.
box('CAPSULE-AIRLOCK-BACKPLATE', (0, 2.4, 36.3), (4.05, 4.8, .12), 'basalt', .04, True)
for x in [-.86, .86]:
    panel(f'CAPSULE-AIRLOCK-LEAF-{x}', (x, 2.35, 36.2), (1.68, 4.1, .12), '-Z')
    for y in [.72, 3.98]:
        box(f'CAPSULE-AIRLOCK-LATCH-{x}-{y}', (x, y, 36.10), (.9, .14, .15), 'bronze', .025)
box('CAPSULE-AIRLOCK-SEAM', (0, 2.4, 36.01), (.024, 3.6, .018), 'luminous', .003)
chamfer_ring('CAPSULE-AIRLOCK-PERIMETER', 36.11, 3.9, 4.7, .17, .16, y=.02, mat='bronze')
for x in [-1.4, 1.4]:
    cylinder(f'CAPSULE-AIRLOCK-ACTUATOR-{x}', (x, 2.42, 36.08), .055, 2.0, 'metal', 'Y')

# 02 / Main arrival threshold: large shapes + close-scale bolted portal architecture.
cell('A-arrival', 'A', 'Built-in transition portal, fluted jambs and connected floor inlays')
for sign in [-1, 1]:
    x = sign * 2.26
    box(f'ARRIVAL-PORTAL-JAMB-{sign}', (x, 2.65, 22.05), (.42, 5.3, .75), 'basalt', .06, True)
    for i in range(9):
        box(f'ARRIVAL-JAMB-FLUTE-{sign}-{i}', (x - sign * .19, .4 + i * .56, 21.75), (.045, .36, .18), 'bronze', .007)
    for z in [20.5, 18.7, 16.9, 15.1]:
        box(f'ARRIVAL-GUIDE-{sign}-{z}', (sign * 1.68, .006, z), (.025, .008, 1.45), 'luminous', .001)
    # Thick-bolted cover is on the existing return-wall face, outside walk volume.
    for x in [sign * 5.2, sign * 10.4]:
        panel(f'ARRIVAL-RETURN-FIXTURE-{x}', (x, 2.0, 21.56), (2.8, 3.5, .09), 'Z', 'limestone')
        box(f'ARRIVAL-FIXTURE-NUMBER-BAR-{x}', (x, 2.83, 21.5), (1.6, .022, .028), 'bronze', .004)
box('ARRIVAL-PORTAL-LINTEL', (0, 5.37, 22.05), (4.94, .4, .75), 'basalt', .06, True)
box('ARRIVAL-PORTAL-STATUS', (0, 5.13, 21.64), (2.9, .025, .02), 'luminous', .003)
for i in range(14):
    z = 11 + i * .74
    for x in [-1.73, 1.73]:
        box(f'ARRIVAL-DECK-JOINT-{i}-{x}', (x, .003, z), (.32, .004, .009), 'basalt', 0)

# 03/04 / Two galleries. Thin surface treatments respect existing wall colliders.
for sign, label in [(-1, 'west'), (1, 'east')]:
    cell('A-gallery-' + label, 'A', 'Stone courses, recessed metal services, gallery rib joints and bronze fittings')
    x = sign * 15.96
    for iz, z in enumerate([-16, -10, -4, 2, 8, 14, 20]):
        # Edge-plane panel seams are actually inset strips with regular construction spacing.
        panel(f'GALLERY-{label}-SERVICE-{iz}', (x, 1.0, z), (.045, 1.6, 1.05), 'X', 'metal')
        for y in [2.1, 5.7, 9.3, 12.9, 16.5, 20.1]:
            box(f'GALLERY-{label}-HORIZONTAL-JOINT-{iz}-{y}', (x, y, z), (.014, .016, 5.7), 'basalt', .002)
        box(f'GALLERY-{label}-VERTICAL-JOINT-{iz}', (x, 11, z - 2.9), (.014, 21.8, .018), 'basalt', .002)
        if iz % 2 == 0:
            box(f'GALLERY-{label}-LOW-LIGHT-{iz}', (x - sign * .015, .2, z), (.022, .035, 2.6), 'luminous', .003)
    # Deep overhead coffer panels build a legible underside without adding walk obstacles.
    gallery_y = 6.4 if sign < 0 else 9.4
    for iz, z in enumerate(range(-16, 18, 4)):
        for dx in [0, 1.8]:
            xx = sign * (10.3 + dx)
            panel(f'GALLERY-{label}-SOFFIT-{iz}-{dx}', (xx, gallery_y - .41, z), (1.68, .045, 3.8), 'Y', 'metal')
        for xx in [sign * 8.22, sign * 14.7]:
            box(f'GALLERY-{label}-SOFFIT-LIGHT-{iz}-{xx}', (xx, gallery_y - .47, z), (.028, .03, 3.75), 'luminous', .003)
    for z in [-17, -5, 7, 18]:
        # Base collars fit inside the already-solid pier shoes.
        x = sign * 12.9
        box(f'GALLERY-{label}-PIER-COLLAR-{z}', (x, .34, z), (1.6, .28, 2.2), 'metal', .025, True)
        for dx in [-.58, .58]:
            for dz in [-.85, .85]:
                bolt(f'GALLERY-{label}-PIER-BOLT-{z}-{dx}-{dz}', (x + dx, .49, z + dz), 'Y', .048)
    # Flat route markers at floor level, kept clear of the pit.
    for z in [-12, -6, 0, 6, 12]:
        for dx in [-.12, .12]:
            box(f'GALLERY-{label}-FLOOR-MARKER-{z}-{dx}', (sign * 8 + dx, .005, z), (.035, .006, .55), 'bronze', .001)

# 05 / Gate precinct. Nothing crosses the exact 3.6 x 5.6 portal aperture.
cell('A-gate', 'A', 'Layered machined portal surround, suspended crown and engraved survey inlays')
for sign in [-1, 1]:
    for i in range(4):
        x = sign * (1.86 + i * .095)
        box(f'GATE-REVEAL-{sign}-{i}', (x, 2.8, -19.80 + i * .06), (.035, 5.58, .09), 'bronze', .007, i == 0)
    x = sign * 2.4
    for y in [.45, 1.5, 2.55, 3.6, 4.65, 5.7, 6.75]:
        panel(f'GATE-BOLTED-CLADDING-{sign}-{y}', (x, y, -19.80), (.84, .9, .055), 'Z', 'basalt')
    box(f'GATE-INSET-PILASTER-{sign}', (sign * 4.45, 4.0, -19.88), (.12, 7.9, .07), 'bronze', .015, True)
    for y in [2, 4, 6]:
        for k in range(8):
            box(f'GATE-INSTRUMENT-SLOTS-{sign}-{y}-{k}', (sign * 4.38, y + k * .055, -19.81), (.12, .017, .02), 'luminous' if k == 0 else 'metal', .002)
for i in range(4):
    box(f'GATE-REVEAL-CROWN-{i}', (0, 5.66 + i * .095, -19.80 + i * .06), (3.75 + i * .18, .035, .09), 'bronze', .007)
for z in [-18.8, -17.4, -16.0]:
    for sign in [-1, 1]:
        box(f'GATE-APPROACH-INLAY-{sign}-{z}', (sign * 1.55, .004, z), (.12, .006, .025), 'bronze', .001)
for sign in [-1, 1]:
    box(f'GATE-SUSPENDED-STRUCTURE-{sign}', (sign * 6.2, 13.5, -18.1), (3.1, .9, 3.5), 'basalt', .08, True)
    for k in range(12):
        box(f'GATE-CROWN-LOUVRE-{sign}-{k}', (sign * 6.2, 12.7, -19.55 + k * .27), (2.9, .55, .06), 'metal', .009)
    for x in [sign * 5.2, sign * 7.2]:
        cylinder(f'GATE-CROWN-HANGER-{x}', (x, 18.5, -18.1), .035, 9, 'bronze', 'Y', vertices=12)


# 06 / Open-roof transfer trusses: structural rhythm with uninterrupted sky gaps.
cell('A-roof-trusses', 'A', 'Open observatory roof, triangulated spanning trusses and edge crown connections')
for sign in [-1, 1]:
    box(f'ROOF-CROWN-EDGE-{sign}', (sign * 16.0, 24.05, 0), (.48, .38, 43.5), 'basalt', .045, True)
    box(f'ROOF-CROWN-BRONZE-{sign}', (sign * 15.74, 24.02, 0), (.035, .14, 43.5), 'bronze', .008)
for z in [-14, 1, 16]:
    for y in [22.8, 23.8]:
        box(f'ROOF-TRUSS-CHORD-{z}-{y}', (0, y, z), (31.8, .15, .28), 'metal', .025, True)
    for i in range(8):
        x = -15.75 + i * 3.94
        tube(f'ROOF-DIAGONAL-{z}-{i}', (x, 22.85 if i % 2 == 0 else 23.75, z),
             (x + 3.94, 23.75 if i % 2 == 0 else 22.85, z), .065, 'bronze')
    for x in [-15.6, -7.8, 0, 7.8, 15.6]:
        box(f'ROOF-TRUSS-NODE-{z}-{x}', (x, 23.3, z), (.27, 1.12, .34), 'basalt', .03)
        for y in [22.95, 23.65]:
            bolt(f'ROOF-NODE-FIX-{z}-{x}-{y}', (x, y, z + .18), 'Z', .052)


def orbital_facility(name, center, radius, length, axis='Y'):
    cx, cy, cz = center
    cylinder(name + '-tapered-core', center, radius * .56, length, 'metal', axis, radius * .32, 32, True)
    if axis != 'Y':
        return
    for i, dy in enumerate([-length * .4, -length * .16, length * .16, length * .4]):
        torus(name + f'-pressure-ring-{i}', (cx, cy + dy, cz), radius, radius * .085, 'basalt', 'Y', 72, True)
        for k in range(12):
            angle = math.tau * k / 12
            p = (cx + math.cos(angle) * radius, cy + dy, cz + math.sin(angle) * radius)
            q = (cx + math.cos(angle) * radius * .45, cy + dy, cz + math.sin(angle) * radius * .45)
            tube(name + f'-radial-truss-{i}-{k}', p, q, radius * .035, 'bronze')
    for k in range(12):
        a = math.tau * k / 12
        xx, zz = cx + math.cos(a) * radius, cz + math.sin(a) * radius
        tube(name + f'-longeron-{k}', (xx, cy - length * .4, zz), (xx, cy + length * .4, zz), radius * .032, 'metal')
    for sign in [-1, 1]:
        x = cx + sign * radius * 2.45
        box(name + f'-radiator-{sign}', (x, cy, cz), (radius * 2.7, length * .48, .12), 'basalt', .025, True)
        for j in range(10):
            xx = x - radius * 1.2 + j * radius * .265
            box(name + f'-radiator-fin-{sign}-{j}', (xx, cy, cz + .1), (.035, length * .45, .075), 'metal', .004)
        for y in [cy - length * .22, cy + length * .22]:
            tube(name + f'-wing-spar-{sign}-{y}', (cx, y, cz), (x + sign * radius * 1.2, y, cz), .12, 'bronze')
    cylinder(name + '-observation-crown', (cx, cy + length * .57, cz), radius * .9, length * .13,
             'basalt', 'Y', radius * .62, 32, True)
    torus(name + '-crown-beacon', (cx, cy + length * .62, cz), radius * .7, radius * .025, 'cool-luminous', 'Y', 64)


# 06/07 / Remote real architecture visible through capsule glazing and the atrium.
cell('A-exterior-west', 'A', 'Detached orbital observatory and radial docking trusses, west parallax anchor')
orbital_facility('WEST-OBSERVATORY', (-28, 4, 19), 4.4, 19)
torus('WEST-DOCKING-HALO', (-22, -5, 27), 8.2, .28, 'bronze', 'Y', 96, True)
for k in range(8):
    a = math.tau * k / 8
    tube(f'WEST-HALO-SPOKE-{k}', (-22 + math.cos(a) * 8.2, -5, 27 + math.sin(a) * 8.2),
         (-22 + math.cos(a) * 5.5, -5.7, 27 + math.sin(a) * 5.5), .12, 'metal')
cell('A-exterior-east', 'A', 'Detached eastern habitat, ring deck and precision radiator assemblies')
orbital_facility('EAST-HABITAT', (31, 0, 27), 5.6, 25)
torus('EAST-RING-DECK', (31, -7.5, 27), 10.8, .5, 'basalt', 'Y', 96, True)
torus('EAST-RING-INLAY', (31, -6.98, 27), 10.8, .045, 'luminous', 'Y', 96)
for k in range(16):
    a = math.tau * k / 16
    tube(f'EAST-DECK-SPOKE-{k}', (31, -8.1, 27), (31 + math.cos(a) * 10.8, -7.5, 27 + math.sin(a) * 10.8), .12)

# 08 / Invert receives precision fabrication detail but all CR1 witness views stay clear.
cell('B-services', 'B', 'Wall-integrated pressure services, overhead ribs and measurement details')
for sign in [-1, 1]:
    x = sign * 14.965
    for z in [-16, -8, 0, 8, 16]:
        panel(f'INVERT-WALL-SERVICE-{sign}-{z}', (x, 1.2, z), (.025, 1.8, 2.2), 'X', 'metal')
        box(f'INVERT-WALL-LIGHT-{sign}-{z}', (x - sign * .015, .22, z), (.025, .035, 1.6), 'cool-luminous', .003)
    for y in [4, 9, 14, 19]:
        box(f'INVERT-COURSE-{sign}-{y}', (x, y, 0), (.014, .016, 37.6), 'basalt', .002)
    for z in [13, 5, -3, -12]:
        # All collars occupy the existing thick buttress material.
        box(f'INVERT-BUTTRESS-COLLAR-{sign}-{z}', (sign * 13.7, .38, z), (1.5, .34, 1.02), 'metal', .025, True)
        for zz in [z - .35, z + .35]:
            for dx in [-.52, .52]:
                bolt(f'INVERT-BASE-FIX-{sign}-{z}-{zz}-{dx}', (sign * 13.7 + dx, .57, zz), 'Y', .05)
for z in [-14, 0, 12]:
    cylinder(f'INVERT-OVERHEAD-SERVICE-{z}', (0, 20.3, z), .16, 27, 'metal', 'X', vertices=24, proxy=True)
    for x in [-12, -8, -4, 0, 4, 8, 12]:
        torus(f'INVERT-PIPE-COLLAR-{z}-{x}', (x, 20.3, z), .2, .025, 'bronze', 'X', 24)

# 09 / The curved route has thin same-equation inlays and no separate support mesh.
cell('B-gravity-instruments', 'B', 'Same-curve gravitational survey inlays and terminal mechanism backing')
for z in [-8.975, -5.025]:
    for i in range(64):
        theta = (i + .5) * math.pi / 128
        # A hairline on the true R=3.2 surface, offset towards the open side by 4 mm.
        x = 1.5 + (3.2 - .004) * math.sin(theta)
        y = 3.2 - (3.2 - .004) * math.cos(theta)
        box(f'GRAVITY-EDGE-{z}-{i}', (x, y, z), (.075, .004, .022), 'bronze', 0,
            rotation=(0, 0, theta))
    for i in range(10):
        theta = i * math.pi / 18
        x = 1.5 + (3.2 - .008) * math.sin(theta)
        y = 3.2 - (3.2 - .008) * math.cos(theta)
        box(f'GRAVITY-SURVEY-TICK-{z}-{i}', (x, y, z), (.019, .004, .17), 'cool-luminous', 0,
            rotation=(0, 0, theta))
for y in [3.37, 6.9]:
    for z in [-17.3, -15.7, -14.1, -12.5, -10.9]:
        box(f'WALL-SURVEY-INLAY-{y}-{z}', (4.695, y, z), (.004, .025, .7), 'bronze', 0)
# A ring can be seen from the wall route without occupying the player's foot strip Y=4.
torus('TERMINAL-PRESSURE-RING', (4.62, 5.1, -16.5), .66, .035, 'bronze', 'X', 64, True)
torus('TERMINAL-SEAL-RING', (4.64, 5.1, -16.5), .78, .018, 'metal', 'X', 64)
for k in range(8):
    a = math.tau * k / 8
    y = 5.1 + math.cos(a) * .74
    z = -16.5 + math.sin(a) * .74
    bolt(f'TERMINAL-RING-FIX-{k}', (4.61, y, z), 'X', .032)


def apply_uv(obj):
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name='MetreScaleUV')
    obj.update_from_editmode()
    for face in mesh.polygons:
        n = obj.matrix_world.to_3x3() @ face.normal
        for loop in face.loop_indices:
            p = obj.matrix_world @ mesh.vertices[mesh.loops[loop].vertex_index].co
            if abs(n.y) >= max(abs(n.x), abs(n.z)):
                uv.data[loop].uv = (p.x, p.z)
            elif abs(n.x) > abs(n.z):
                uv.data[loop].uv = (p.z, p.y)
            else:
                uv.data[loop].uv = (p.x, p.y)


bpy.context.view_layer.update()
capsule_clearance_vertices = 0
for chunk in CHUNKS:
    if chunk['id'] != 'A-capsule':
        continue
    for obj in chunk['objects']:
        used = {i for polygon in obj.data.polygons for i in polygon.vertices}
        for index in used:
            point = obj.matrix_world @ obj.data.vertices[index].co
            if .02 < point.y < 1.74 and 22 < point.z < 35.999:
                assert abs(point.x) >= 1.9999, f'{obj.name}: collision-free capsule clear width intruded: {list(point)}'
                capsule_clearance_vertices += 1
(SOURCE / 'capsule-clearance-validation.json').write_text(json.dumps({
    'result': 'PASS', 'verifiedReferencedVertices': capsule_clearance_vertices,
    'criterion': 'All authored capsule geometry at reachable body heights0.02..1.74m and Z22..36 remains outside clear X[-2,2]. Thin floor inlays below2cm are excepted. Rear airlock remains behind original Z36 collider plane.',
    'guardPlanesMetres': {'left': -2, 'right': 2, 'rear': 36},
}, indent=2) + '\n')

manifest = {'schema': 1, 'generator': 'scripts/build-orbital-assets.py',
            'license': 'CC0-1.0', 'author': 'THRESHOLD project — original geometry',
            'coordinateSystem': 'Right handed Y up, metres, matching CR1; B offset applied at runtime',
            'replacesVisualMeshes': ['V-compression--2.4', 'V-compression-2.4', 'V-compression-roof', 'V-compression-end'],
            'collisionPolicy': 'Existing CR1 colliders retained. Capsule glazing meets existing X=+-2 side planes. '
                               'Built-in services are coplanar treatments; no new walk obstacles.',
            'chunks': []}

for chunk in CHUNKS:
    objects = chunk['objects']
    bpy.context.view_layer.update()
    bounds = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = [min(p[k] for p in bounds) for k in range(3)]
    high = [max(p[k] for p in bounds) for k in range(3)]
    # Join by material before exporting: approximately 4-7 draw calls per detailed cell.
    merged = []
    batches = {matname: [obj for obj in objects if obj.data.materials[0].name == matname]
               for matname in MATERIALS}
    for matname in MATERIALS:
        selected = batches[matname]
        if not selected:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in selected:
            obj.select_set(True)
            apply_uv(obj)
        bpy.context.view_layer.objects.active = selected[0]
        bpy.ops.object.join()
        result = bpy.context.object
        result.name = chunk['id'] + '-' + matname
        result['chunk'] = chunk['id']
        # Weighted corner normals are applied once per joined material batch,
        # preserving clean broad panels and the highlights on actual bevels.
        modifier = result.modifiers.new('Weighted construction normals', 'WEIGHTED_NORMAL')
        modifier.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        merged.append(result)
    chunk['objects'] = merged
    triangles = sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in merged)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in merged:
        obj.select_set(True)
    filename = chunk['id'] + '.glb'
    bpy.ops.export_scene.gltf(filepath=str(OUT / filename), use_selection=True, export_format='GLB',
                               export_extras=True, export_yup=False, export_apply=True)
    shutil.copy2(OUT / filename, SOURCE / 'chunks' / filename)
    manifest['chunks'].append({'id': chunk['id'], 'slot': chunk['slot'], 'description': chunk['description'],
                               'file': filename, 'bounds': [low, high], 'triangles': triangles,
                               'bytes': (OUT / filename).stat().st_size, 'drawCalls': len(merged),
                               'proxy': chunk['proxy']})
manifest['totalTriangles'] = sum(c['triangles'] for c in manifest['chunks'])
manifest['totalBytes'] = sum(c['bytes'] for c in manifest['chunks'])
assert manifest['totalTriangles'] <= 300000, manifest['totalTriangles']
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(SOURCE / 'LICENSE.txt').write_text('THRESHOLD Orbital Construction Kit\nOriginal authored geometry, 2026.\n'
                                   'Released under CC0 1.0 Universal.\n'
                                   'https://creativecommons.org/publicdomain/zero/1.0/\n')
(SOURCE / 'construction-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'threshold-orbital-construction.blend'))
print('ORBITAL_ASSET_RESULT ' + json.dumps({'chunks': len(manifest['chunks']),
                                         'triangles': manifest['totalTriangles'],
                                         'bytes': manifest['totalBytes'],
                                         'drawCallsIfAllResident': sum(c['drawCalls'] for c in manifest['chunks'])}))
