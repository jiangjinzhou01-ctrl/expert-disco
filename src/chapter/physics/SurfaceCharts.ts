import { Matrix4, Quaternion, Vector3 } from 'three';
import { surfacePose } from './GravitySurface';
import type { WorldId } from '../../scenes/RoomLayout';

export interface ChartPose {
  foot: Vector3; up: Vector3; tangent: Vector3; lateral: Vector3; rotation: Quaternion;
}
export interface SurfaceChart {
  readonly id: string; readonly slot: WorldId; readonly width: number;
  sample(s: number, lateral: number): ChartPose;
  project(foot: Vector3, previousS?: number): { s: number; lateral: number; distance: number };
}

/** Compatibility adapter uses the original, already tested CR1 parameterization. */
export const CR1Chart: SurfaceChart = {
  id: 'CR1', slot: 'B', width: 4,
  sample(s, lateral) {
    const pose = surfacePose(s, lateral);
    return { foot: pose.foot, up: pose.up, tangent: pose.tangent, lateral: new Vector3(0,0,1), rotation: pose.rotation };
  },
  project(foot) {
    const s = foot.x <= 1.5 ? foot.x-1.5 : foot.y >= 3.2 && Math.abs(foot.x-4.7)<.05
      ? 3.2*Math.PI/2+foot.y-3.2 : 3.2*Math.atan2(foot.x-1.5,3.2-foot.y);
    return { s, lateral: foot.z, distance: surfacePose(s,foot.z).foot.distanceTo(foot) };
  },
};

/** A continuous architectural ribbon. The same sampled surface builds the visible
 * asset and the Rapier solid. Arclength lookup keeps configured m/s independent
 * of circle radius or the changing radius of a closed spiral. */
export class RingChart implements SurfaceChart {
  readonly length: number;
  readonly axis: Vector3;
  private readonly distances = new Float64Array(4097);
  private readonly radial: Vector3;
  private readonly tangent0: Vector3;
  constructor(readonly id: string, readonly slot: WorldId, readonly center: Vector3,
    readonly radius: number, radial0: Vector3, tangent0: Vector3, readonly inward = true,
    readonly width = 3.2, readonly modulation = 0) {
    if (!id || ![...center.toArray(),radius,width,modulation,...radial0.toArray(),...tangent0.toArray()].every(Number.isFinite)
      || radius<2.4 || width<2.4 || modulation<0 || modulation>radius*.2
      || Math.abs(radial0.length()-1)>.0001 || Math.abs(tangent0.length()-1)>.0001
      || Math.abs(radial0.dot(tangent0))>.0001) throw new RangeError('Invalid support chart');
    this.radial=radial0.clone();this.tangent0=tangent0.clone();
    this.axis=tangent0.clone().cross(radial0.clone().multiplyScalar(inward?-1:1)).normalize();
    let previous=this.curve(0).foot;
    for(let i=1;i<=4096;i++){const next=this.curve(i/4096*Math.PI*2).foot;this.distances[i]=this.distances[i-1]!+next.distanceTo(previous);previous=next;}
    this.length=this.distances[4096]!;
  }
  private curve(angle:number){
    const r=this.radius+this.modulation*(1-Math.cos(angle)),dr=this.modulation*Math.sin(angle);
    const radial=this.radial.clone().multiplyScalar(Math.cos(angle)).addScaledVector(this.tangent0,Math.sin(angle));
    const derivative=this.radial.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(this.tangent0,Math.cos(angle));
    const tangent=derivative.multiplyScalar(r).addScaledVector(radial,dr).normalize();
    const up=this.axis.clone().cross(tangent).normalize();
    return { foot: this.center.clone().addScaledVector(radial,r),tangent,up };
  }
  private angleForDistance(s:number):number{
    const d=((s%this.length)+this.length)%this.length;
    let lo=0,hi=4096;while(hi-lo>1){const mid=(lo+hi)>>1;if(this.distances[mid]!<=d)lo=mid;else hi=mid;}
    const t=(d-this.distances[lo]!)/(this.distances[hi]!-this.distances[lo]!);
    return (lo+t)/4096*Math.PI*2;
  }
  sample(s:number,lateral:number):ChartPose{
    if(!Number.isFinite(s+lateral))throw new RangeError('Non-finite chart coordinates');
    const p=this.curve(this.angleForDistance(s));
    p.foot.addScaledVector(this.axis,lateral);
    const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(p.tangent,p.up,this.axis));
    return {...p,lateral:this.axis.clone(),rotation};
  }
  project(foot:Vector3,previousS=0){
    const rel=foot.clone().sub(this.center),lateral=rel.dot(this.axis);
    let angle=Math.atan2(rel.dot(this.tangent0),rel.dot(this.radial));if(angle<0)angle+=Math.PI*2;
    const k=angle/(Math.PI*2)*4096,lo=Math.floor(k),hi=Math.min(4096,lo+1);
    let s=this.distances[lo]!+(this.distances[hi]!-this.distances[lo]!)*(k-lo);
    s+=Math.round((previousS-s)/this.length)*this.length;
    return {s,lateral,distance:this.sample(s,lateral).foot.distanceTo(foot)};
  }
}

export interface RibbonVolume { vertices: Float32Array; indices: Uint32Array }
export function buildRibbonVolume(chart:RingChart,thickness=.35):RibbonVolume{
  if(!Number.isFinite(thickness)||thickness<=0)throw new RangeError('Invalid ribbon thickness');
  const count=Math.max(256,Math.ceil(chart.length/.06)),vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=count;i++){
    const p=chart.sample(i/count*chart.length,0);
    for(const bottom of [false,true])for(const side of [-1,1]){
      const v=p.foot.clone().addScaledVector(p.lateral,side*chart.width/2);
      if(bottom)v.addScaledVector(p.up,-thickness);vertices.push(...v.toArray());
    }
    if(i===count)continue;
    const a=i*4,b=a+4;
    indices.push(a,a+1,b,a+1,b+1,b); // supporting face, normal = local up
    indices.push(a+2,b+2,a+3,a+3,b+2,b+3);
    indices.push(a,b,a+2,a+2,b,b+2);
    indices.push(a+1,a+3,b+1,a+3,b+3,b+1);
  }
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}
