import {CanvasTexture,Color,CylinderGeometry,DoubleSide,Group,IcosahedronGeometry,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,RingGeometry,SRGBColorSpace,TorusGeometry,Vector3,type Object3D} from 'three';

function plaque(title:string,sub:string,width:number){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d')!;
 c.fillStyle='#121c24';c.fillRect(0,0,1024,256);c.strokeStyle='#8a7660';c.lineWidth=2;c.strokeRect(12,12,1000,232);
 c.fillStyle='#dbd0b6';c.font='500 42px sans-serif';c.fillText(title,45,95);c.fillStyle='#869da6';c.font='24px monospace';c.fillText(sub,45,163);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 const mesh=new Mesh(new PlaneGeometry(width,width/4),new MeshBasicMaterial({map:texture,side:DoubleSide,toneMapped:false}));mesh.userData.artPlaque=true;return mesh;
}
export interface ExperienceArtifacts {groups:Record<'A'|'B',Group>;update:(elapsed:number,returned:boolean,observed:boolean,mode:string)=>void;dispose:()=>void;}
/** These details communicate actual simulation state; they never move a player. */
export function createExperienceArtifacts():ExperienceArtifacts{
 const A=new Group(),B=new Group();A.name='ORBITAL-INTERACTIVE-DETAILS';B.name='GRAVITY-INTERACTIVE-DETAILS';B.position.x=100;
 const bronze=new MeshStandardMaterial({name:'bronze',color:0xb6a087,metalness:.8,roughness:.29});const dark=new MeshStandardMaterial({name:'obsidian',color:0x1f2b34,metalness:.7,roughness:.38});
 const glow=new MeshStandardMaterial({name:'atelier-state-signal',color:0xb9cfdb,emissive:0x527988,emissiveIntensity:.6,metalness:.4,roughness:.3});glow.userData.finishRole='state-signal';
 const rings:Mesh[]=[];
 for(let i=0;i<3;i++){
  const ring=new Mesh(new TorusGeometry(1.22+i*.27,.025+i*.008,8,96),bronze);ring.position.set(0,-2,6);ring.rotation.set(.25+i*.8,.4+i*.3,.25);ring.castShadow=false;A.add(ring);rings.push(ring);
 }
 const plinth=new Mesh(new CylinderGeometry(.38,.65,.32,48),dark);plinth.position.set(0,-3.7,6);A.add(plinth);
 const bridgeLabel=plaque('THRESHOLD  /  01','ORBITAL VESTIBULE    —    RETURN TO RESONATE',2.5);bridgeLabel.position.set(0,1.15,10.11);A.add(bridgeLabel);
 // Observation device mounts against the existing visible/collidable capsule wall.
 const scope=new Group();scope.position.set(1.62,.95,24);scope.rotation.z=.2;
 const base=new Mesh(new CylinderGeometry(.17,.25,.55,24),dark);scope.add(base);
 const lens=new Mesh(new TorusGeometry(.23,.025,8,48),bronze);lens.position.y=.36;lens.rotation.y=-Math.PI/2;scope.add(lens);
 const orb=new Mesh(new IcosahedronGeometry(.16,2),glow);orb.position.y=.36;scope.add(orb);A.add(scope);
 const scopeLabel=plaque('AUREOLE  /  OBSERVATORY','OBSERVE THE ORBITAL ASSEMBLY',1.25);scopeLabel.position.set(1.967,1.5,24.9);scopeLabel.rotation.y=-Math.PI/2;A.add(scopeLabel);
 const entryLabel=plaque('01     THE FIRST THRESHOLD','ORBITAL VESTIBULE    /    ARRIVAL',1.65);entryLabel.position.set(0,3.7,35.94);entryLabel.rotation.y=Math.PI;A.add(entryLabel);
 const sampleLabel=plaque('LOCAL GRAVITY  /  +X','RELEASE A WITNESS. WATCH THE DIRECTION.',2.1);sampleLabel.position.set(6.8,3,.32);B.add(sampleLabel);
 const reference=new Group();reference.position.set(6.8,4.2,.6);
 for(const axis of [0,1,2]){const ring=new Mesh(new TorusGeometry(.65,.012,6,48),bronze);if(axis===1)ring.rotation.x=Math.PI/2;if(axis===2)ring.rotation.y=Math.PI/2;reference.add(ring);}B.add(reference);
 // Hairline light guides sit outside the capsule path; arrows describe the same
 // analytic support frame used by the real gravity controller.
 const guides:Mesh[]=[];
 for(let i=0;i<11;i++){const a=i*Math.PI/20;const ring=new Mesh(new RingGeometry(.032,.065,12),glow);ring.position.set(1.5+3.2*Math.sin(a)-.018*Math.sin(a),3.2*(1-Math.cos(a))+.018*Math.cos(a),-5.14);ring.quaternion.setFromUnitVectors(new Vector3(0,0,1),new Vector3(-Math.sin(a),Math.cos(a),0));B.add(ring);guides.push(ring);}
 const terminalLabel=plaque('02     LOCAL FRAME','RESONATE  /  RETURN THROUGH THE THRESHOLD',1.2);terminalLabel.position.set(4.65,5.95,-16.5);terminalLabel.rotation.y=-Math.PI/2;B.add(terminalLabel);
 let disposed=false;
 const resources=new Set<Object3D>([A,B]);
 return {groups:{A,B},update(elapsed,returned,observed,mode){
  rings.forEach((ring,i)=>{ring.rotation.x=(returned?Math.PI/2:.25+i*.8)+Math.sin(elapsed*.1+i)*.1;ring.rotation.y=elapsed*(returned?.12:.025)*(i%2?1:-1)+i*.3;});
  orb.rotation.y=elapsed*(observed?.7:.15);orb.scale.setScalar(observed?1.18:1);
  const c=new Color(returned?0xf0cb8b:0x527988);glow.emissive.copy(c);glow.emissiveIntensity=returned?.8:.4;
  reference.rotation.y=elapsed*.08;guides.forEach(g=>{g.scale.setScalar(mode==='NORMAL'?1:1.2);});
 },dispose(){
  if(disposed)return;disposed=true;
  const geometries=new Set<import('three').BufferGeometry>(),materials=new Set<import('three').Material>(),textures=new Set<import('three').Texture>();
  for(const root of resources){
   root.traverse(o=>{
    if(!(o instanceof Mesh))return;
    geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
     materials.add(m);
     for(const v of Object.values(m))if(v&&typeof v==='object'&&(v as import('three').Texture).isTexture)textures.add(v as import('three').Texture);
    }
   });root.removeFromParent();
  }
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
 }};
}
