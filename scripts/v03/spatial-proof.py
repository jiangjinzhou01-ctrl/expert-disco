import json, math, hashlib, subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'evidence/v03/spatial-proof'
OUT.mkdir(parents=True,exist_ok=True)
scene = json.loads((ROOT/'src/chapter/assets/architecture.generated.json').read_text())
cr1 = json.loads((ROOT/'docs/input/CR1/invert_spatial_manifest_CR1.json').read_text())
try:
    source_revision = subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True,stderr=subprocess.DEVNULL).strip()
except (OSError, subprocess.CalledProcessError):
    source_revision = 'source archive; see V03_DELIVERY_MANIFEST.json'

def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def bounds_of_box(b):
    c=np.array(b['center'],float); s=np.array(b['size'],float)*.5
    return c-s,c+s

def bounds_for_world(world):
    boxes=[b for b in scene['boxes'] if b['world']==world]
    los=[];his=[]
    for b in boxes:
        lo,hi=bounds_of_box(b);los.append(lo);his.append(hi)
    return np.min(los,axis=0),np.max(his,axis=0),len(boxes)

# Exact distance from a finite segment to an AABB, found by minimizing the convex
# point-to-box distance over t in [0,1]. Radius is applied separately for capsules.
def point_box_d2(p,lo,hi):
    d=np.maximum(np.maximum(lo-p,0),p-hi)
    return float(np.dot(d,d))

def segment_box_d2(a,b,lo,hi):
    v=b-a
    breaks=[0.0,1.0]
    for i in range(3):
        if abs(v[i])>1e-12:
            for edge in (lo[i],hi[i]):
                t=(edge-a[i])/v[i]
                if 0<t<1: breaks.append(float(t))
    breaks=sorted(set(breaks));best=math.inf
    for left,right in zip(breaks[:-1],breaks[1:]):
        mid=(left+right)*.5;pm=a+mid*v
        active=[]
        for i in range(3):
            if pm[i]<lo[i]:active.append((i,lo[i]))
            elif pm[i]>hi[i]:active.append((i,hi[i]))
        if active:
            den=sum(v[i]*v[i] for i,_ in active)
            t=mid if den<1e-20 else -sum(v[i]*(a[i]-edge) for i,edge in active)/den
            t=min(right,max(left,t))
        else:t=mid
        best=min(best,point_box_d2(a+t*v,lo,hi))
    return min(best,point_box_d2(a,lo,hi),point_box_d2(b,lo,hi))

def capsule_clearance(foot,up,box):
    up=np.array(up,float);up=up/np.linalg.norm(up)
    foot=np.array(foot,float); center=foot+.87*up
    a=center-.57*up;b=center+.57*up
    lo,hi=bounds_of_box(box)
    return math.sqrt(segment_box_d2(a,b,lo,hi))-.30

def sample_line(a,b,step=.04):
    a=np.array(a,float);b=np.array(b,float)
    count=max(1,math.ceil(np.linalg.norm(b-a)/step))
    for i in range(count+1):
        t=i/count
        yield a*(1-t)+b*t

# Candidate proposed support path from the existing CR1 wall top into the ceiling deck,
# then around the external 360-degree gravity ring. Source/target contact surfaces and
# the explicitly called-out shell/rail apertures are intentional.
branch=[]
z0=-12.5
for p in sample_line((4.7,4,z0),(4.7,6.2,z0)):
    branch.append((p,(-1,0,0),'wall-rise'))
R=5.4; cx=4.7+R;cy=6.2
steps=math.ceil((math.pi/2*R)/.025)
for i in range(steps+1):
    ph=(math.pi/2)*i/steps
    foot=np.array([cx-R*math.cos(ph),cy+R*math.sin(ph),z0])
    up=np.array([-math.cos(ph),math.sin(ph),0])
    branch.append((foot,up,'wall-to-top-curve'))
# Deck over the CR1 axis, then through a planned upper aperture in the east shell.
for p in sample_line((10.1,11.6,z0),(10.1,11.6,8.5)):
    branch.append((p,(0,1,0),'upper-deck-z'))
for p in sample_line((10.1,11.6,8.5),(25,11.6,8.5)):
    branch.append((p,(0,1,0),'upper-deck-x'))
# Exterior convex ring: radial-up field points out from its center; gravity is inward.
ring_center=np.array([25.0,5.8,8.5]); ring_r=5.8
steps=math.ceil(2*math.pi*ring_r/.025)
ring=[]
for i in range(steps+1):
    ph=2*math.pi*i/steps
    up=np.array([math.sin(ph),math.cos(ph),0.0])
    foot=ring_center+ring_r*up
    ring.append((foot,up,'B-exterior-gravity-ring'))

modified_ids={
    'I-shell-15.5', # replaced with a framed 3.2 x 3.2 upper passage
    'I-wall-parapet-7.35','I-wall-handrail-7.35',
    'I-wall-rail-post-7.35--12','I-wall-rail-post-7.35--14'
}
boxes=[b for b in scene['boxes'] if b['world']=='INVERT' and b['id'] not in modified_ids]
clearance_by={}
all_hits=[]
for path_name,samples in [('B-branch-and-deck',branch),('B-exterior-ring',ring)]:
    for foot,up,segment_name in samples:
        for b in boxes:
            c=capsule_clearance(foot,up,b)
            key=(path_name,b['id'])
            clearance_by[key]=min(clearance_by.get(key,math.inf),c)
            if c < -1e-4:
                all_hits.append({'path':path_name,'segment':segment_name,'box':b['id'],'penetration_m':round(-c,6),'foot_local':np.round(foot,4).tolist()})
near=sorted([{'path':k[0],'box':k[1],'minimum_clearance_m':round(v,4)} for k,v in clearance_by.items() if v<2.0],key=lambda x:x['minimum_clearance_m'])

# Existing region extents are derived from all actual Rapier cuboid descriptors.
a_lo,a_hi,a_count=bounds_for_world('VESTIBULE')
b_lo,b_hi,b_count=bounds_for_world('INVERT')

def ring_point(center,r,angle,plane='XY',inward=True):
    ph=math.radians(angle)
    if plane=='XY':
        up=np.array([-math.sin(ph),math.cos(ph),0.0]) if inward else np.array([math.sin(ph),math.cos(ph),0.0])
        foot=np.array(center,float)+r*np.array([math.sin(ph),-math.cos(ph),0.0])
    else:
        # Polar spiral in the YZ plane. Local up is the inward unit normal to its
        # actual changing-radius curve, not the radial approximation.
        rr=r+.30*(1-math.cos(ph))
        dr=.30*math.sin(ph)
        yp=center[1]-rr*math.cos(ph)
        zp=center[2]+rr*math.sin(ph)
        dy=-dr*math.cos(ph)+rr*math.sin(ph)
        dz=dr*math.sin(ph)+rr*math.cos(ph)
        tangent=np.array([dy,dz],float);tangent/=np.linalg.norm(tangent)
        up2=np.array([tangent[1],-tangent[0]])
        foot=np.array([center[0],yp,zp])
        up=np.array([0.0,up2[0],up2[1]])
        return foot,up
    return foot,up

nodes=[]
# A vestibule ring, inward-supported; ring center (34, 4.5, 0), R 4.5.
for key,angle in [('G01',30),('G02',90)]:
    foot,up=ring_point((34,4.5,0),4.5,angle,'XY',True)
    nodes.append({'id':key,'world':'VESTIBULE local','surface':'A inner gravity ring','parameter_deg':angle,'foot_or_center_m':np.round(foot,5).tolist(),'up':np.round(up,6).tolist(),'gravity_m_s2':np.round(-9.81*up,5).tolist()})
# Existing CR1 node.
th=math.radians(45);foot=np.array([1.5+3.2*math.sin(th),3.2*(1-math.cos(th)),-7.0]);up=np.array([-math.sin(th),math.cos(th),0])
nodes.append({'id':'G03','world':'INVERT local','surface':'CR1 original support arc','parameter_deg':45,'foot_or_center_m':np.round(foot,5).tolist(),'up':np.round(up,6).tolist(),'gravity_m_s2':np.round(-9.81*up,5).tolist()})
# New wall-to-top branch at 90 degrees.
foot=np.array([cx,cy+R,z0]);up=np.array([0,1,0])
nodes.append({'id':'G04','world':'INVERT local','surface':'CR1 side branch / wall-to-top quarter curve','parameter_deg':90,'foot_or_center_m':np.round(foot,5).tolist(),'up':up.tolist(),'gravity_m_s2':[0,-9.81,0]})
# External ring around fixed vertical world axis, outward up.
for key,angle in [('G05',90),('G06',315)]:
    ph=math.radians(angle);up=np.array([math.sin(ph),math.cos(ph),0.0]);foot=ring_center+ring_r*up
    nodes.append({'id':key,'world':'INVERT local','surface':'B exterior radial gravity ring','parameter_deg':angle,'foot_or_center_m':np.round(foot,5).tolist(),'up':np.round(up,6).tolist(),'gravity_m_s2':np.round(-9.81*up,5).tolist()})
# Orthogonal cross-gravity circle.
for key,angle in [('G07',90),('G08',270)]:
    foot,up=ring_point((39,5,9),5.0,angle,'XY',True)
    nodes.append({'id':key,'world':'INVERT local','surface':'C orthogonal inner ring, X/Y plane','parameter_deg':angle,'foot_or_center_m':np.round(foot,5).tolist(),'up':np.round(up,6).tolist(),'gravity_m_s2':np.round(-9.81*up,5).tolist()})
# One-turn variable-radius spiral in YZ plane.
for key,angle in [('G09',90),('G10',270)]:
    foot,up=ring_point((52,5.2,9),5.2,angle,'YZ',True)
    nodes.append({'id':key,'world':'INVERT local','surface':'C one-turn closed gravity spiral','parameter_deg':angle,'foot_or_center_m':np.round(foot,5).tolist(),'up':np.round(up,6).tolist(),'gravity_m_s2':np.round(-9.81*up,5).tolist()})
nodes.append({'id':'G11','world':'INVERT local','surface':'D low-g floor lane','field_samples':[{'point':[64,0,9],'g':3.2373,'gravity':[0,-3.2373,0]},{'point':[68,0,9],'g':9.81,'gravity':[0,-9.81,0]}]})
nodes.append({'id':'G12','world':'INVERT local','surface':'D free-flight chamber','field_samples':[{'point':[73,7,9],'g':0.981,'gravity':[0,-0.981,0]},{'point':[78,7,11],'g':0,'gravity':[0,0,0]},{'point':[83,4,17],'g':4.905,'gravity':[0,-4.905,0]}]})

# Projection matrices use Three.js RH camera convention, 50 degree vertical FOV,
# 16:9 aspect, near=.1m, far=500m.
def camera(eye,target,up=(0,1,0),fov=50,aspect=16/9,near=.1,far=500):
    e=np.array(eye,float);t=np.array(target,float);u=np.array(up,float)
    z=e-t;z=z/np.linalg.norm(z);x=np.cross(u,z);x=x/np.linalg.norm(x);y=np.cross(z,x)
    view=np.eye(4);view[:3,:3]=np.array([x,y,z]);view[:3,3]=-view[:3,:3]@e
    f=1/math.tan(math.radians(fov)/2);proj=np.zeros((4,4))
    proj[0,0]=f/aspect;proj[1,1]=f;proj[2,2]=-(far+near)/(far-near);proj[2,3]=-2*far*near/(far-near);proj[3,2]=-1
    return view,proj

def project(view,proj,p):
    c=proj@view@np.array([*p,1.0])
    return (c[:3]/c[3]).tolist()

views={
    'A_RING_VIEW':{'eye':[24,1.55,6],'target':[34,4.5,0],'up':[0,1,0],
       'points':{'ring_center':[34,4.5,0],'ring_right':[38.5,4.5,0],'ring_top':[34,9,0],'ring_left':[29.5,4.5,0]}},
    'B_AXIS_VIEW':{'eye':[25,10.05,33],'target':[43,11,20],'up':[0,1,0],
       'points':{'C1_ring_center':[39,5,9],'C2_spiral_center':[52,5.2,9],'X_beam_start':[32,15.5,23],'X_beam_end':[58,15.5,23],'Y_mast_top':[43,18,23],'Z_beam_start':[43,15.5,12],'Z_beam_end':[43,15.5,34]}}
}
for name,v in views.items():
    V,P=camera(v['eye'],v['target'],v['up'])
    v['fov_deg']=50;v['aspect']=16/9;v['near']=.1;v['far']=500
    v['view_matrix_row_major']=np.round(V,8).tolist()
    v['projection_matrix_row_major']=np.round(P,8).tolist()
    v['projected_landmarks_ndc']={k:np.round(project(V,P,p),6).tolist() for k,p in v.pop('points').items()}

result={
 'title':'THRESHOLD V0.3 Multi-Gravity Spatial Proof — D1 analytical layout',
 'status':'ANALYTICAL_CANDIDATE_NOT_ENGINE_CERTIFIED',
 'units':'metres; VESTIBULE and INVERT local coordinates; INVERT global offset is +100m X',
 'source_revision':source_revision,
 'source_files':{
   'architecture_generated_sha256':digest(ROOT/'src/chapter/assets/architecture.generated.json'),
   'cr1_manifest_sha256':digest(ROOT/'docs/input/CR1/invert_spatial_manifest_CR1.json')
 },
 'existing_collision_bounds':{
   'VESTIBULE':{'boxes':a_count,'min':np.round(a_lo,5).tolist(),'max':np.round(a_hi,5).tolist()},
   'INVERT':{'boxes':b_count,'min':np.round(b_lo,5).tolist(),'max':np.round(b_hi,5).tolist()},
   'CR1_support_samples':cr1['arc_reference_samples']
 },
 'candidate_modules':{
   'A_entry_aperture':{'world':'VESTIBULE','min':[16,0,-1.6],'max':[17,3.2,1.6],'intentional':'cut in V-main-wall-16.5 only'},
   'A_access_corridor':{'world':'VESTIBULE','min':[17,0,-1.6],'max':[29.1,3.2,1.6]},
   'A_gravity_ring_shell':{'world':'VESTIBULE','center':[34,4.5,0],'support_radius':4.5,'shell_outer_radius':4.9,'z_width':3.8,'aabb_min':[29.1,-.4,-1.9],'aabb_max':[38.9,9.4,1.9],'inner_clear_radius_min':2.76,'central_prop_radius_max':1.8},
   'A_view_spur':{'world':'VESTIBULE','centerline':[[24,0,0],[24,0,6]],'clear_width':2.4,'height':3.2},
   'B_cr1_branch_collar':{'world':'INVERT','centerline_start':[4.7,6.2,-12.5],'curve_center_xy':[10.1,6.2],'radius':5.4,'angle_deg':[0,90],'end_foot':[10.1,11.6,-12.5],'welded_support_required':True,'planned_upper_guard_aperture_z':[-14.1,-10.9]},
   'B_upper_deck':{'world':'INVERT','z_leg':{'min':[8.5,11.6,-12.5],'max':[11.7,11.95,8.5]},'east_leg':{'min':[10.1,11.6,6.9],'max':[25,11.95,10.1]}},
   'B_upper_shell_aperture':{'world':'INVERT','center':[15.5,11.6,8.5],'clear_y':[10.0,13.2],'clear_z':[6.9,10.1],'intentional':'cut in I-shell-15.5; buttress free margins 1.3m and 2.3m'},
   'B_exterior_radial_ring':{'world':'INVERT','center':[25,5.8,8.5],'support_radius':5.8,'support_side':'outer convex surface','shell_radial_thickness':.4,'z_width':3.6,'aabb_min':[18.8,-.4,6.7],'aabb_max':[31.2,12.0,10.3],'top_join':[25,11.6,8.5],'minimum_capsule_to_old_shell_clearance_m':1.46},
   'B_east_access_corridor':{'world':'INVERT','min':[16,0,7.4],'max':[30,3.2,10.6]},
   'C_main_spine':{'world':'INVERT','min':[16,0,15.9],'max':[60,3.2,19.1]},
   'C1_cross_gravity_ring':{'world':'INVERT','center':[39,5,9],'support_radius':5.0,'shell_outer_radius':5.35,'z_width':3.6,'aabb_min':[33.65,-.35,7.2],'aabb_max':[44.35,10.35,10.8]},
   'C2_spiral_ring':{'world':'INVERT','center':[52,5.2,9],'base_radius':5.2,'r(phi)':'5.2 + 0.30*(1-cos(phi)); phi in [0,2pi]','shell_radial_outer_max':6.15,'x_width':3.2,'aabb_min':[50.4,-.95,2.85],'aabb_max':[53.6,11.35,15.15]},
   'D_low_zero_g_module':{'world':'INVERT','outer_aabb_min':[60,0,3],'outer_aabb_max':[86,14,22],'low_g_lane_x':[61,70],'zero_g_usable_min':[73.5,1,5],'zero_g_usable_max':[82.5,12,15],'return_corridor':{'min':[60,0,15.9],'max':[84,3.2,19.1]}},
   'B_axis_landmark_frame':{'world':'INVERT','X_beam_min':[32,15.375,22.875],'X_beam_max':[58,15.625,23.125],'Y_mast_min':[42.85,0,22.85],'Y_mast_max':[43.15,18,23.15],'Z_beam_min':[42.875,15.375,12],'Z_beam_max':[43.125,15.625,34]},
   'B_observation_ramp':{'world':'INVERT','centerline_start':[25,0,17.5],'centerline_end':[25,8.5,32.22],'slope_deg':30,'landing_aabb_min':[23.4,8.5,31.5],'landing_aabb_max':[26.6,8.8,35]}
 },
 'gravity_nodes':nodes,
 'camera_matrices':views,
 'path_capsule_audit':{
   'shape':'Rapier capsule half-segment 0.57m, radius 0.30m; foot offset 0.87m along local up; centreline segment endpoints center +/-0.57*up',
   'samples':len(branch)+len(ring),
   'sample_spacing_max_m':.04,
   'modified_existing_colliders_excluded':sorted(modified_ids),
   'existing_box_collision_count':len(all_hits),
   'penetrations':all_hits[:30],
   'nearest_unmodified_box_clearances':near[:20],
   'warning':'This checks the proposed B branch/deck/radial-ring against current box colliders. It does not query the current CR1 trimesh support, new meshes, renderer visibility, or Rapier castShape rotation sweep.'
 }
}
(OUT/'spatial-proof.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')

# Draw coordinate projections for engineering discussion (not a render/screenshot).
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, Ellipse
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9})
fig,axs=plt.subplots(1,3,figsize=(16,6))
ax=axs[0]
ax.add_patch(Rectangle((-17,-22),34,44,fill=False,edgecolor='#53636b',lw=1.2,label='existing VESTIBULE main hall'))
ax.add_patch(Rectangle((-2.8,22),5.6,14.8,fill=False,edgecolor='#53636b',lw=1.2,label='existing arrival corridor'))
ax.add_patch(Rectangle((17,-1.6),12.1,3.2,facecolor='#9ac5d8',alpha=.45,edgecolor='#206080',label='new entry corridor'))
ax.add_patch(Ellipse((34,0),9.8,3.8,fill=False,edgecolor='#b04b72',lw=2,label='A gravity ring shell footprint'))
ax.add_patch(Circle((34,0),1.8,fill=False,edgecolor='#a33',ls=':',label='central clear prop limit'))
ax.plot([24,24],[0,6],color='#218c8c',lw=2)
ax.scatter([24],[6],marker='s',color='#218c8c')
ax.text(24.3,5.5,'A ring sightline bay')
ax.set_title('A · VESTIBULE local plan (X/Z)')
ax.set_xlabel('X (m)');ax.set_ylabel('Z (m)')
ax.set_xlim(-20,42);ax.set_ylim(-27,39);ax.set_aspect('equal',adjustable='box');ax.grid(alpha=.2)
ax=axs[1]
ax.add_patch(Rectangle((-16,-19),32,38,fill=False,edgecolor='#53636b',lw=1.5,label='existing INVERT shell bound'))
ax.plot([0,0],[15.2,8],color='#496a80',lw=2)
ax.plot([0,1.5,4.7,4.7,4.7],[8,-7,-7,-12,-16.5],color='#9b5878',lw=2,label='CR1 route (schematic)')
ax.plot([4.7,10.1,10.1,25],[ -12.5,-12.5,-12.5, -12.5],alpha=0) if False else None
ax.plot([10.1,10.1,25],[ -12.5,8.5,8.5],color='#d07b32',lw=2,label='B ceiling branch/deck')
ax.add_patch(Rectangle((18.8,6.7),12.4,3.6,fill=False,edgecolor='#d07b32',lw=1.8,label='B exterior gravity ring'))
ax.plot([16,30],[9,9],color='#4b8c62',lw=2,label='B east access')
ax.plot([28,60],[17.5,17.5],color='#4477aa',lw=2,label='C/D spine')
ax.add_patch(Rectangle((33.65,7.2),10.7,3.6,fill=False,edgecolor='#8a5bc2',lw=1.7,label='C1 cross-gravity ring bound'))
ax.add_patch(Rectangle((50.4,2.85),3.2,12.3,fill=False,edgecolor='#c25454',lw=1.7,label='C2 spiral ring bound'))
ax.add_patch(Rectangle((60,3),26,19,facecolor='#64a88b',alpha=.16,edgecolor='#237452',lw=1.5,label='D low/zero-g module'))
ax.add_patch(Rectangle((22.8,31.5),4.4,3.5,fill=False,edgecolor='#222',lw=1.4,label='axis view landing'))
ax.plot([25,25],[17.5,32.2],color='#222',lw=1.3,ls='--')
ax.set_title('B · INVERT local plan (X/Z)')
ax.set_xlabel('X (m)');ax.set_ylabel('Z (m)')
ax.set_xlim(-20,90);ax.set_ylim(-23,39);ax.set_aspect('equal',adjustable='box');ax.grid(alpha=.2)
ax=axs[2]
theta=np.linspace(0,math.pi/2,100)
ax.plot(1.5+3.2*np.sin(theta),3.2*(1-np.cos(theta)),color='#9b5878',lw=3,label='CR1 quarter arc')
ax.plot([4.7,4.7],[3.2,7.2],color='#9b5878',lw=3,label='CR1 wall walk')
ax.plot([4.7,4.7],[4,6.2],color='#9b5878',lw=1.5,ls=':')
phi=np.linspace(0,math.pi/2,100)
ax.plot(10.1-5.4*np.cos(phi),6.2+5.4*np.sin(phi),color='#d07b32',lw=3,label='new wall-to-top connector')
ax.plot([10.1,10.1],[11.6,11.6],color='#d07b32',lw=3)
circle=plt.Circle((25,5.8),5.8,fill=False,color='#d07b32',lw=2)
ax.add_patch(circle)
ax.text(25,5.8,'B radial ring',ha='center',va='center')
ax.plot([0,32],[0,0],color='#999',lw=.8,ls='--')
ax.set_title('B · INVERT X/Y elevation (depth projected)')
ax.set_xlabel('X (m)');ax.set_ylabel('Y (m)')
ax.set_xlim(-2,34);ax.set_ylim(-2,15);ax.set_aspect('equal',adjustable='box');ax.grid(alpha=.2)
handles,labels=[],[]
for a in axs:
    h,l=a.get_legend_handles_labels()
    handles.extend(h);labels.extend(l)
by={}
for h,l in zip(handles,labels):by[l]=h
fig.legend(by.values(),by.keys(),loc='lower center',ncol=4,frameon=False)
fig.suptitle('THRESHOLD V0.3 candidate spatial proof — local coordinates, analytical only',fontsize=14)
fig.tight_layout(rect=[0,0.09,1,.94])
fig.savefig(OUT/'spatial-layout.svg',bbox_inches='tight')
fig.savefig(OUT/'spatial-layout.png',dpi=180,bbox_inches='tight')
print(json.dumps({
 'source_revision':source_revision,
 'existing_bounds':{'VESTIBULE':{'min':a_lo.tolist(),'max':a_hi.tolist(),'boxes':a_count},'INVERT':{'min':b_lo.tolist(),'max':b_hi.tolist(),'boxes':b_count}},
 'B_branch_deck_ring_samples':len(branch)+len(ring),
 'B_existing_box_hits':len(all_hits),
 'penetrations':all_hits[:10],
 'near_clearances':near[:12],
 'node_count':len(nodes),
 'camera_views':{k:{'eye':v['eye'],'target':v['target'],'ndc':v['projected_landmarks_ndc']} for k,v in views.items()},
 'output':str(OUT)
},indent=2))
