"""Reproducible, authored architectural meshes + independent same-source proxies.
Run: blender -b --python scripts/build-v02-assets.py -- /absolute/project
"""
import bpy, math, json, sys, os
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(sys.argv[sys.argv.index('--')+1]); OUT=ROOT/'public/assets/v02';OUT.mkdir(parents=True,exist_ok=True);TEX=ROOT/'assets/source/textures';TEX.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}; all_boxes=[]; manifests=[]
COLORS={'mineral':'D9D6CE','limestone':'A9A49A','cold':'A8B2B3','obsidian':'24292B','basalt':'303536','copper':'B6A087','glass':'9BBCC3'}
for key,col in COLORS.items():
 m=bpy.data.materials.new(key);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');rgb=tuple(int(col[i:i+2],16)/255 for i in (0,2,4));bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Metallic'].default_value=1 if key=='copper' else 0;bs.inputs['Roughness'].default_value={'mineral':.86,'limestone':.78,'cold':.88,'obsidian':.32,'basalt':.72,'copper':.42,'glass':.15}[key]
 if key=='glass':bs.inputs['Alpha'].default_value=.19;m.surface_render_method='DITHERED';m.diffuse_color=(*rgb,.19)
 else:
  # Small, deterministic mineral variation. Saved pixels are exported, not unsupported procedural nodes.
  im=bpy.data.images.new(key+'-mineral',width=256,height=256);pixels=[]
  for y in range(256):
   for x in range(256):
    noise=((x*73856093 ^ y*19349663 ^ 1489)&1023)/1023
    seam=.84 if key=='limestone' and (x<1 or y<1) else 1
    vein=1
    if key=='obsidian':vein=1.19 if abs(math.sin(x*.031+y*.081+math.sin(y*.08)*.7))>.997 else 1
    factor=(.94+.08*noise)*seam*vein
    pixels.extend([min(1,c*factor) for c in rgb]+[1])
  im.pixels=pixels;im.filepath_raw=str(TEX/(key+'-mineral.png'));im.file_format='PNG';im.save();im.pack()
  bs.inputs['Base Color'].default_value=(1,1,1,1)
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 if key!='glass':
  base_rough=bs.inputs['Roughness'].default_value
  for kind in ['roughness','normal']:
   detail=bpy.data.images.new(key+'-'+kind,width=256,height=256);values=[]
   for y in range(256):
    for x in range(256):
     v=((x*73856093 ^ y*19349663 ^ 3847)&1023)/1023
     if kind=='roughness':r=max(0,min(1,base_rough+(v-.5)*.10));values.extend([r,r,r,1])
     else:
      v2=((x*83492791 ^ y*34257187 ^ 7481)&1023)/1023;values.extend([.5+(v-.5)*.035,.5+(v2-.5)*.035,1,1])
   detail.colorspace_settings.name='Non-Color';detail.pixels=values;detail.update();detail.filepath_raw=str(TEX/(key+'-'+kind+'.png'));detail.file_format='PNG';detail.save();detail.pack()
   node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=detail
   if kind=='roughness':m.node_tree.links.new(node.outputs['Color'],bs.inputs['Roughness'])
   else:
    normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.18;m.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 M[key]=m

def box(world,name,c,s,mat='mineral',collision=True,walk=False,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=c);o=bpy.context.object;o.name=name;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
 if bevel:
  mod=o.modifiers.new('Machined edges','BEVEL');mod.width=min(bevel,min(s)*.15);mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  o.modifiers.new('Weighted architectural normals','WEIGHTED_NORMAL')
 if collision:all_boxes.append({'world':world,'id':name,'center':c,'size':s,'walkable':walk,'glass':mat=='glass'})
 o['asset_id']=name;o['world']=world;return o

def frame(world,name,z,x0,x1,y0,y1,mat='basalt',depth=.16,width=.09):
 for suffix,c,s in [('L',[(x0-width/2), (y0+y1)/2,z],[width,y1-y0+width,depth]),('R',[x1+width/2,(y0+y1)/2,z],[width,y1-y0+width,depth]),('T',[(x0+x1)/2,y1+width/2,z],[x1-x0,width,depth])]:box(world,name+suffix,c,s,mat)

def opening_wall(world,z,xs,ys,holes,mat='cold'):
 xx=sorted(set(xs+sum(([h[0],h[1]] for h in holes),[])));yy=sorted(set(ys+sum(([h[2],h[3]] for h in holes),[])))
 for i in range(len(xx)-1):
  for j in range(len(yy)-1):
   x=(xx[i]+xx[i+1])/2;y=(yy[j]+yy[j+1])/2
   if not any(h[0]<x<h[1] and h[2]<y<h[3] for h in holes):box(world,f'{world}-enclosure-{z}-{i}-{j}',[x,y,z],[xx[i+1]-xx[i],yy[j+1]-yy[j],.18],mat,bevel=.014)

def mesh(world,name,verts,indices,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[indices[i:i+3] for i in range(0,len(indices),3)]);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(M[mat]);o['world']=world;o['asset_id']=name;return o

# Exact shared contact strip: flat approach -> 128-segment quarter arc -> wall.
points=[(-15,0,0,1),(1.5,0,0,1)]
for i in range(1,129):
 t=math.pi*.5*i/128;points.append((1.5+3.2*math.sin(t),3.2*(1-math.cos(t)),-math.sin(t),math.cos(t)))
points.append((4.7,7.2,-1,0))
verts=[];indices=[]
for x,y,ux,uy in points:verts.extend([[x,y,-9],[x,y,-5]])
for i in range(len(points)-1):
 a=2*i;indices.extend([a,a+1,a+2,a+1,a+3,a+2])
# Rear wall section shares the exact arc exit edge in the same collider mesh.
a=len(verts);verts.extend([[4.7,3.2,-18.2],[4.7,7.2,-18.2],[4.7,3.2,-9],[4.7,7.2,-9]]);indices.extend([a,a+2,a+1,a+1,a+2,a+3])
support={'vertices':verts,'indices':indices}
# Closed same-source collision shell: weld the rear-wall seam, offset its true normals,
# reverse the backing faces, and cap only actual boundary edges (never internal joins).
weld={};front=[];front_normals=[];remap=[]
for i,v in enumerate(verts):
 key=tuple(round(c,6) for c in v)
 if key not in weld:
  weld[key]=len(front);front.append(v)
  normal=points[i//2][2:] if i<len(points)*2 else (-1,0)
  front_normals.append(normal)
 remap.append(weld[key])
front_indices=[remap[i] for i in indices];count=len(front)
volume_vertices=front+[[v[0]-.55*normal[0],v[1]-.55*normal[1],v[2]] for v,normal in zip(front,front_normals)]
back_indices=[];boundary={}
for i in range(0,len(front_indices),3):
 a,b,c=front_indices[i:i+3];back_indices.extend([a+count,c+count,b+count])
 for edge in [(a,b),(b,c),(c,a)]:
  key=tuple(sorted(edge))
  if key in boundary:boundary.pop(key)
  else:boundary[key]=edge
side_indices=[]
for a,b in boundary.values():side_indices.extend([a,a+count,b,b,a+count,b+count])
support_volume={'vertices':volume_vertices,'indices':front_indices+back_indices+side_indices}

def export_world(world):
 objects=[o for o in bpy.context.scene.objects if o.get('world')==world]
 for o in bpy.context.scene.objects:o.select_set(o in objects)
 # Physical-size UVs and offline local AO, computed by rays against this world's actual architecture.
 solid=[o for o in objects if o.type=='MESH' and o.data.materials[0].name!='glass']
 vv=[];ff=[]
 for o in solid:
  base=len(vv);vv.extend([o.matrix_world@v.co for v in o.data.vertices]);ff.extend([[base+i for i in f.vertices] for f in o.data.polygons])
 tree=BVHTree.FromPolygons(vv,ff)
 for o in objects:
  if o.type=='MESH':
   me=o.data
   uv=me.uv_layers.active or me.uv_layers.new(name='ArchitectureUV')
   for face in me.polygons:
    n=face.normal
    for loop in face.loop_indices:
     p=o.matrix_world@me.vertices[me.loops[loop].vertex_index].co
     scale=.5 if me.materials[0].name=='limestone' else 2
     uv.data[loop].uv=(p.x*scale,p.z*scale) if abs(n.y)>.6 else (p.z*scale,p.y*scale) if abs(n.x)>.6 else (p.x*scale,p.y*scale)
   color=me.color_attributes.get('AmbientOcclusion') or me.color_attributes.new(name='AmbientOcclusion',type='FLOAT_COLOR',domain='POINT')
   me.color_attributes.active_color=color
   for value in color.data:value.color=(1,1,1,1)
   if o in solid:
    for v in me.vertices:
     n=v.normal.normalized();axis=Vector((0,1,0)) if abs(n.y)<.9 else Vector((1,0,0));t=n.cross(axis).normalized();b=n.cross(t).normalized();origin=o.matrix_world@v.co+n*.012;hits=0
     for k in range(8):
      angle=k*2.39996323;d=(n*.7+t*math.cos(angle)*.714+b*math.sin(angle)*.714).normalized()
      hit=tree.ray_cast(origin,d,2)
      if hit[0] is not None:hits+=1
     ao=1-.32*hits/8;color.data[v.index].color=(ao,ao,ao,1)
 for o in objects:
  if o.type=='MESH':
   me=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();tri=sum(len(p.vertices)-2 for p in me.polygons);o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
   bounds=[o.matrix_world@Vector(c) for c in o.bound_box];manifests.append({'id':o.name,'world':world,'origin':list(o.location),'bounds':[[min(v[k] for v in bounds) for k in range(3)],[max(v[k] for v in bounds) for k in range(3)]],'materials':[m.name for m in o.data.materials],'triangles':tri})
 bpy.ops.export_scene.gltf(filepath=str(OUT/(world.lower()+'.glb')),use_selection=True,export_format='GLB',export_extras=True,export_yup=False,export_apply=True,export_vertex_color='ACTIVE')

# VESTIBULE. Floors ring a genuinely open four-metre void.
w='VESTIBULE'
for n,c,s in [('west',[-10.5,-.24,0],[11,.48,44]),('east',[10.5,-.24,0],[11,.48,44]),('north',[0,-.24,-10],[10,.48,24]),('south',[0,-.24,16],[10,.48,12])]:box(w,'V-'+n+'-floor',c,s,'limestone',walk=True)
box(w,'V-corridor-floor',[0,-.24,29],[4,.48,14],'limestone',walk=True)
box(w,'V-void-floor',[0,-4.24,6],[10,.48,8],'basalt',walk=True)
for x in [-5.3,5.3]:box(w,'V-pit-return-'+str(x),[x,-2,6],[.6,4,8],'mineral')
for z in [1.7,10.3]:box(w,'V-pit-return-'+str(z),[0,-2,z],[10,4,.6],'mineral')
for x in [-16.5,16.5]:box(w,'V-main-wall-'+str(x),[x,12,0],[1,24,44],'mineral',bevel=.07)
box(w,'V-door-wall-L',[-9.15,12,-20.48],[14.7,24,1],'mineral');box(w,'V-door-wall-R',[9.15,12,-20.48],[14.7,24,1],'mineral');box(w,'V-door-wall-top',[0,15,-20.48],[3.6,18,1],'mineral')
for x in [-9.5,9.5]:box(w,'V-entry-return-'+str(x),[x,12,22],[15,24,.8],'mineral')
for x in [-2.4,2.4]:box(w,'V-compression-'+str(x),[x,2.5,29],[.8,5,14],'basalt')
box(w,'V-compression-roof',[0,5.3,29],[5.6,.6,14],'basalt')
box(w,'V-compression-end',[0,2.5,36.4],[4.8,5,.8],'basalt')
for x in [-8.5,8.5]:box(w,'V-roof-slit-'+str(x),[x,24,0],[15,.6,44],'mineral')
for x in [-12.9,12.9]:
 for z in [-17,-5,7,18]:
  box(w,f'V-pier-{x}-{z}',[x,11,z],[1.5,22,2.1],'mineral',bevel=.09)
  box(w,f'V-pier-shoe-{x}-{z}',[x,.12,z],[1.8,.24,2.4],'basalt')
# Thick stepped gallery sections, structural ribs, recessed joint lines.
for x,y in [(-11.6,6.4),(11.6,9.4)]:
 box(w,'V-cantilever-'+str(x),[x,y,0],[7.2,.75,37],'mineral')
 for z in range(-18,19,6):box(w,f'V-gallery-rib-{x}-{z}',[x,y-.65,z],[7.1,.55,.24],'basalt')
 for z in range(-18,19,3):box(w,f'V-gallery-baluster-{x}-{z}',[x+(3.4 if x<0 else -3.4),y+.6,z],[.045,1.2,.05],'copper')
 box(w,'V-gallery-handrail-'+str(x),[x+(3.4 if x<0 else -3.4),y+1.2,0],[.045,.05,37],'copper')
# Void guards have visible glass panels and framed posts; no invisible barrier.
for x in [-5.15,5.15]:
 for a,b in [(2,5.05),(6.95,10)]:
  box(w,f'V-pit-glass-{x}-{a}',[x,.65,(a+b)/2],[.065,1.3,b-a],'glass')
  box(w,f'V-pit-rail-{x}-{a}',[x,1.31,(a+b)/2],[.055,.06,b-a],'copper')
 for z in [2,4,5.05,6.95,8,10]:box(w,f'V-pit-post-{x}-{z}',[x,.65,z],[.06,1.3,.06],'basalt')
for z in [1.85,10.15]:
 box(w,'V-pit-glass-'+str(z),[0,.65,z],[10,1.3,.065],'glass');box(w,'V-pit-rail-'+str(z),[0,1.31,z],[10,.06,.055],'copper')
# Traverse bridge is a real volume over the void; ordinary side paths remain clear.
box(w,'V-void-bridge',[0,-.24,6],[10,.48,1.8],'mineral',walk=True)
for z in [5.05,6.95]:box(w,'V-bridge-rail-'+str(z),[0,.65,z],[10,1.2,.05],'glass')
# Traversable low approach treads at sides; main portal stays bottom-aligned at y=0.
for sign in [-1,1]:
 for i in range(6):box(w,f'V-side-steps-{sign}-{i}',[sign*6,.07*i,-15-i*.7],[3,.14*(i+1),.7],'limestone',walk=True,bevel=.01)
for x in [-2.4,2.4]:box(w,'V-portal-monolith-'+str(x),[x,4,-20.48],[1.2,8,1.25],'obsidian',bevel=.065)
box(w,'V-portal-crown',[0,6.8,-20.48],[6,2.4,1.25],'obsidian',bevel=.065)
for z in [-20.08,-20.42,-20.8]:frame(w,'V-deep-reveal-'+str(z),z,-1.8,1.8,0,5.6,'basalt',.16,.055)
# Architectural joints: actual inset panels / reveals and ceiling light baffles.
for y in range(3,24,3):box(w,'V-stone-course-'+str(y),[0,y,-21.48],[32,.015,.02],'basalt',False,bevel=0)
for x in [-12,-8,-4,4,8,12]:box(w,'V-rear-panel-reveal-'+str(x),[x,12,-21.48],[.015,24,.02],'basalt',False,bevel=0)
for z in range(-20,23,4):
 for x in [-15.94,15.94]:box(w,f'V-wall-joint-{x}-{z}',[x,10,z],[.018,20,.018],'basalt',False,bevel=0)
for z in [-14,-3,8,19]:box(w,'V-skylight-baffle-'+str(z),[0,23.5,z],[2,.7,.14],'basalt',False)
# Static device plinth in pit; active geometry is a separate runtime asset.
box(w,'V-device-plinth',[0,-3.5,6],[2.4,1,2.4],'obsidian')
export_world(w)
# INVERT. Intentional void, fixed original axes and explicit sight windows.
w='INVERT'
xx=[-15,-13,-5,1.5,4.7,15];zz=[-19,-17,-9,-5,-2,19]
for i in range(len(xx)-1):
 for j in range(len(zz)-1):
  x=(xx[i]+xx[i+1])/2;z=(zz[j]+zz[j+1])/2
  if (-13<x<-5 and -17<z<-2) or (-9<z<-5 and x<4.7):continue
  box(w,f'I-tessellated-floor-{i}-{j}',[x,-.275,z],[xx[i+1]-xx[i],.55,zz[j+1]-zz[j]],'cold',walk=True,bevel=.008)
mesh(w,'I-continuous-ground-arc-wall',verts,indices,'cold')
# Actual rear and side faces of the same watertight 55cm shell.
mesh(w,'I-support-backing',volume_vertices,back_indices,'basalt')
mesh(w,'I-support-edge-caps',volume_vertices,side_indices,'basalt')
for x in [-15.5,15.5]:box(w,'I-shell-'+str(x),[x,11,0],[1,22,38],'cold')
box(w,'I-rear-wall',[0,11,-19.5],[31,22,1],'cold')
for x in [-8.65,8.65]:box(w,'I-entrance-wall-'+str(x),[x,11,18.8],[13.7,22,.6],'cold')
box(w,'I-entry-crown',[0,14,18.8],[3.6,16,.6],'cold')
for x in [-2.2,2.2]:box(w,'I-entry-reveal-'+str(x),[x,3.2,18.45],[.8,6.4,.6],'basalt')
box(w,'I-entry-reveal-top',[0,6,18.45],[5.2,.8,.6],'basalt')
for z in [13,5,-3,-12]:
 for x in [-13.7,13.7]:box(w,f'I-shell-buttress-{x}-{z}',[x,10,z],[1.7,20,1.2],'cold',bevel=.07)
# Roof tectonics have a light slit; fixed down/up world never rolls.
for x in [-10,9.5]:box(w,'I-roof-'+str(x),[x,22,0],[11,.6,38],'cold')
for z in [-15,0,13]:box(w,'I-roof-rib-'+str(z),[0,21,z],[27,1,.35],'basalt',False)
opening_wall(w,-5,[-.8,5.25],[0,7.6],[[-.5,1.55,0,2.6],[1.75,3.85,.65,4.6]])
opening_wall(w,-9,[-.8,5.25],[0,7.6],[[.6,2.45,2.5,7.3],[2.6,4.7,3.4,6.8]])
for name,z,x0,x1,y0,y1 in [('I-front-sight',-5,1.75,3.85,.65,4.6),('I-rear-sight',-9,.6,2.45,2.5,7.3)]:
 box(w,name,[(x0+x1)/2,(y0+y1)/2,z],[x1-x0,y1-y0,.055],'glass',bevel=.005);frame(w,name+'-frame',z,x0,x1,y0,y1,'basalt',.16,.065)
# Wall-route side parapets protrude toward -X: visible, solid, outside the gate.
for y in [3.05,7.35]:box(w,'I-wall-parapet-'+str(y),[4.1,y,-13.65],[1.2,.18,9.1],'glass')
for y in [3.05,7.35]:
 box(w,'I-wall-handrail-'+str(y),[3.48,y,-13.65],[.06,.2,9.1],'basalt')
 for z in [-10,-12,-14,-16,-18]:box(w,f'I-wall-rail-post-{y}-{z}',[4.1,y,z],[1.2,.12,.06],'basalt')
box(w,'I-terminal-end-stop',[3.85,5.2,-18.2],[1.7,4.4,.22],'glass')
for x in [3,4.7]:box(w,'I-endcap-frame-'+str(x),[x,5.2,-18.2],[.09,4.4,.25],'basalt')
for name,c,s in [('ORIGINAL_AXIS_CANTILEVER',[-1.5,8,-14.45],[21,.8,1.7]),('ORIGINAL_AXIS_PIER',[.35,10,-14.6],[1.3,20,1.6]),('RIGHT_ANCHOR',[9.2,4.5,-14.45],[1.2,9,1.9])]:box(w,name,c,s,'basalt' if name=='ORIGINAL_AXIS_CANTILEVER' else 'mineral',bevel=.08)
for x in [-.1,.8]:box(w,'I-pier-plumb-reveal-'+str(x),[x,10,-13.79],[.045,18,.025],'basalt',False,bevel=.004)
for x in [-12,9]:box(w,'I-slab-end-trim-'+str(x),[x,8,-14.45],[.08,.72,1.6],'basalt',False)
# Human-scale original-Y staircase and observation landing. Their visible risers and
# upright balustrades remain in the ORIGINAL frame when the player's floor becomes X.
# Every structural proxy ends at X<=2.55, leaving the wall capsule's X>=2.954 clear.
for i in range(19):
 height=(i+1)*.22;front=-10-i*.4;back=front-.4
 if front>back:
  box(w,'I-axis-stair-'+str(i),[1.8,height/2,(front+back)/2],[1.2,height,front-back],'mineral',walk=True,bevel=.012)
  box(w,'I-axis-nosing-'+str(i),[1.8,height-.006,front-.015],[1.18,.025,.025],'basalt',False,bevel=0)
box(w,'I-axis-observation-landing',[-.25,4.28,-18.25],[5.5,.24,1.3],'mineral',walk=True,bevel=.025)
box(w,'I-axis-landing-cantilever',[-.25,4.06,-18.65],[5.4,.24,.8],'basalt',False)
for x in [-2.65,.4]:box(w,'I-axis-landing-pier-'+str(x),[x,2.0,-18.45],[.32,4.0,.38],'mineral')
# Glass/metal rails: vertical in old +Y, visibly sideways from the X-gravity route.
for x in [-3,2.5]:
 box(w,'I-axis-landing-glass-'+str(x),[x,4.92,-18.25],[.045,1.04,1.25],'glass')
 box(w,'I-axis-landing-rail-'+str(x),[x,5.48,-18.25],[.055,.065,1.3],'basalt')
 for z in [-18.8,-17.65]:box(w,f'I-axis-landing-post-{x}-{z}',[x,4.95,z],[.06,1.1,.06],'basalt')
box(w,'I-axis-landing-nosing',[1.8,4.394,-17.615],[1.18,.025,.025],'basalt',False,bevel=0)
# Front rail ends exactly before the 1.2m clear staircase opening.
box(w,'I-axis-landing-front-glass',[-.9,4.92,-17.6],[4.2,1.04,.045],'glass')
box(w,'I-axis-landing-front-rail',[-.9,5.48,-17.6],[4.2,.065,.055],'basalt')
for x in [-3,-1.6,-.2,1.17]:box(w,'I-axis-landing-front-post-'+str(x),[x,4.95,-17.6],[.06,1.1,.06],'basalt')
# Protected witness apparatus, visible side gravity receiver.
box(w,'I-witness-receiver',[9.7,4.1,.6],[.2,2,2.1],'obsidian')
box(w,'I-witness-glass-front',[8,4.1,1.65],[3.6,2,.06],'glass')
box(w,'I-witness-glass-rear',[8,4.1,-.45],[3.6,2,.06],'glass')
box(w,'I-witness-plinth',[8,3.05,.6],[3.6,.2,2.2],'basalt')
for x in [-13,-5]:box(w,'I-void-guard-'+str(x),[x,.65,-9.5],[.12,1.3,15],'basalt')
for z in [-17,-2]:box(w,'I-void-guard-'+str(z),[-9,.65,z],[8,1.3,.12],'basalt')
box(w,'I-void-bottom',[-9,-7.3,-9.5],[8,.6,15],'basalt')
for x in [-13.3,-4.7]:box(w,'I-void-shaft-'+str(x),[x,-3.5,-9.5],[.6,7,15],'cold')
export_world(w)
# Keep both local origins while making each authored world editable in its own collection.
for world in ['VESTIBULE','INVERT']:
 collection=bpy.data.collections.new(world);bpy.context.scene.collection.children.link(collection)
 for o in list(bpy.context.scene.objects):
  if o.get('world')==world:
   for previous in list(o.users_collection):previous.objects.unlink(o)
   collection.objects.link(o)
 collection.hide_viewport=world=='INVERT'
# Preserve editable master and exact collision descriptors.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/threshold-v02-architecture.blend'))
data={'revision':'CR1','boxes':all_boxes,'support':support,'supportVolume':support_volume,'assetCount':len(manifests),'assets':manifests}
(OUT/'architecture.json').write_text(json.dumps(data,separators=(',',':')))
(ROOT/'src/chapter/assets/architecture.generated.json').write_text(json.dumps(data,separators=(',',':')))
(OUT/'asset-manifest.json').write_text(json.dumps({'generator':'scripts/build-v02-assets.py','assets':manifests,'materials':COLORS},indent=2))
print('ASSETS_COMPLETE',len(manifests),len(all_boxes))
