import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {DoubleSide,Mesh,MeshPhysicalMaterial,MeshStandardMaterial,RepeatWrapping,SRGBColorSpace,TextureLoader,Vector2,type Object3D,type Texture,type WebGLRenderer} from 'three';
import {architecturalRole,FINISHES,installArchitecturalFinish} from '../../engine/rendering/ArchitecturalFinish';

/** Shared, locally hosted photogrammetric maps. Chunk eviction never duplicates
 * textures, and every map is released on final experience teardown. */
export class OrbitalMaterials {
  private textures=new Map<string,Texture>();private materials=new Map<string,MeshStandardMaterial>();
  private retired=new Set<MeshStandardMaterial>();private retiredTextures=new Set<Texture>();
  private failures:string[]=[];
  async initialize(baseURL:string,renderer:WebGLRenderer){
    const loader=new TextureLoader();const compressed=new KTX2Loader().setTranscoderPath(`${baseURL}assets/basis/`).setWorkerLimit(2).detectSupport(renderer);
    await Promise.all(['concrete','metal','copper'].flatMap(set=>['albedo','roughness','normal'].map(async semantic=>{
      const stem=`${baseURL}assets/orbital/materials/${set}-${semantic}`;
      const texture=await compressed.loadAsync(`${stem}.ktx2`).catch(async error=>{this.failures.push(`${set}-${semantic}: ${String(error)}`);return loader.loadAsync(`${stem}.jpg`);});
      texture.name=`ambientCG:${set}:${semantic}`;texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=4;
      if(semantic==='albedo')texture.colorSpace=SRGBColorSpace;
      this.textures.set(`${set}-${semantic}`,texture);
    }))).finally(()=>compressed.dispose());
  }
  apply(root:Object3D){root.traverse(o=>{
    if(!(o instanceof Mesh))return;
    const replace=(material:import('three').Material)=>{
      if(!(material instanceof MeshStandardMaterial))return material;
      if(material.userData.sharedOrbitalPBR)return material;
      const name=architecturalRole(material.name);
      if(!name)return material;
      if(name==='glass')o.castShadow=false;
      // Existing vertex AO must remain active on the original meshes, while the
      // newly authored chunks have their own baked vertex AO/color semantics.
      const ao=Boolean(o.geometry.getAttribute('color'));
      const key=`${name}:${ao?'ao':'plain'}:${name==='glass'?material.opacity.toFixed(3):''}`;let replacement=this.materials.get(key);
      if(!replacement){
        if(name==='glass'){
          // Thin pressure glazing: specular IBL, no transmission prepass or
          // screen-space refraction that could sample the wrong portal world.
          replacement=new MeshPhysicalMaterial({name:'atelier-PBR-glass',color:0xb7d4da,metalness:0,roughness:.12,ior:1.46,clearcoat:.35,clearcoatRoughness:.11,transparent:true,opacity:material.opacity,depthWrite:false,side:DoubleSide,envMapIntensity:1.1});
          replacement.forceSinglePass=true;o.castShadow=false;
        }else if(name==='luminous'||name==='cool-luminous'){
          const color=name==='luminous'?0xffd6a0:0xa5d6df;
          replacement=new MeshStandardMaterial({name:`atelier-PBR-${name}`,color,emissive:color,emissiveIntensity:name==='luminous'?1.8:1.25,roughness:.45,metalness:.12,vertexColors:ao});
        }else{
          const finish=FINISHES[name],set=finish.set;
          const parameters={name:`atelier-PBR-${name}`,color:finish.color,map:this.textures.get(`${set}-albedo`),normalMap:this.textures.get(`${set}-normal`),roughnessMap:this.textures.get(`${set}-roughness`),normalScale:new Vector2(set==='concrete'?.38:.23,set==='concrete'?.38:.23),roughness:finish.roughness,metalness:finish.metalness,vertexColors:ao,envMapIntensity:1};
          // Reserve the more expensive layered/anisotropic BRDF for machined
          // fittings. Stone and painted structure use the standard PBR BRDF.
          replacement=name==='metal'||name==='bronze'?new MeshPhysicalMaterial({...parameters,clearcoat:finish.clearcoat,clearcoatRoughness:.32,anisotropy:name==='metal'?.25:0}):new MeshStandardMaterial(parameters);
          installArchitecturalFinish(replacement,name);
        }
        replacement.userData.sharedOrbitalPBR=true;replacement.userData.finishRole=name;this.materials.set(key,replacement);
      }
      if(material!==replacement){this.retired.add(material);for(const value of Object.values(material)){if(value&&typeof value==='object'&&(value as Texture).isTexture&&!this.texturesHas(value as Texture))this.retiredTextures.add(value as Texture);}}
      return replacement;
    };
    o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
  });
    for(const material of this.retired)material.dispose();for(const texture of this.retiredTextures)texture.dispose();this.retired.clear();this.retiredTextures.clear();
  }
  private texturesHas(texture:Texture){return [...this.textures.values()].includes(texture);}
  snapshot(){
    let payload=0;const formats:Record<string,number>={};let compressedMaps=0;
    for(const texture of this.textures.values()){
      const t=texture as import('three').CompressedTexture;
      if(t.isCompressedTexture){compressedMaps++;formats[String(t.format)]=(formats[String(t.format)]??0)+1;for(const mip of t.mipmaps)payload+=mip.data.byteLength;}
      else if(texture.image){const size=texture.image as {width:number;height:number};payload+=Math.round(size.width*size.height*4*4/3);}
    }
    return {sets:3,maps:this.textures.size,sharedMaterials:this.materials.size,jpegSourceBytes:1783030,ktxNetworkBytes:6714783,compressedMaps,formats,gpuUploadPayloadBytes:payload,payloadNote:'Typed texture payload with mips; excludes GPU driver overhead, not a measured VRAM total',fallbacks:[...this.failures],source:'ambientCG CC0 / Concrete048, Metal009, Metal047B'};
  }
  dispose(){for(const m of this.materials.values())m.dispose();for(const m of this.retired)m.dispose();for(const t of this.textures.values())t.dispose();for(const t of this.retiredTextures)t.dispose();this.materials.clear();this.textures.clear();this.retired.clear();this.retiredTextures.clear();}
}
