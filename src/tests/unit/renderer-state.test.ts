import { describe,expect,it,vi } from 'vitest';
import { Color,PerspectiveCamera,Vector2,Vector4,WebGLRenderTarget,type WebGLRenderer } from 'three';
import { PortalRenderer } from '../../engine/portal/PortalRenderer';
import { createRoomA } from '../../scenes/RoomA';
import { createRoomB } from '../../scenes/RoomB';

function fixture(throwOnRender=false){
  const previousTarget=new WebGLRenderTarget(8,8);
  const state={target:previousTarget as WebGLRenderTarget|null,face:2,mip:1,viewport:new Vector4(4,5,800,450),scissor:new Vector4(6,7,600,350),scissorTest:true,clearColor:new Color('#123456'),clearAlpha:.25};
  const setRectangle=(target:Vector4,x:number|Vector4,y?:number,width?:number,height?:number)=>x instanceof Vector4?target.copy(x):target.set(x,y!,width!,height!);
  const fake={
    domElement:new EventTarget(),xr:{enabled:true},shadowMap:{autoUpdate:true},
    clippingPlanes:[],localClippingEnabled:true,autoClear:false,autoClearColor:false,autoClearDepth:false,autoClearStencil:false,
    info:{autoReset:false,render:{calls:0},memory:{geometries:12,textures:2},programs:[]},
    getDrawingBufferSize:(v:Vector2)=>v.set(1920,1080),getPixelRatio:()=>1,
    getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,
    setRenderTarget:(target:WebGLRenderTarget|null,face=0,mip=0)=>{state.target=target;state.face=face;state.mip=mip;},
    getViewport:(v:Vector4)=>v.copy(state.viewport),setViewport:(...args:[number|Vector4,number?,number?,number?])=>setRectangle(state.viewport,...args),
    getScissor:(v:Vector4)=>v.copy(state.scissor),setScissor:(...args:[number|Vector4,number?,number?,number?])=>setRectangle(state.scissor,...args),
    getScissorTest:()=>state.scissorTest,setScissorTest:(value:boolean)=>{state.scissorTest=value;},
    getClearColor:(color:Color)=>color.copy(state.clearColor),getClearAlpha:()=>state.clearAlpha,
    setClearColor:(color:Color,alpha:number)=>{state.clearColor.copy(color);state.clearAlpha=alpha;},
    render:vi.fn(()=>{if(throwOnRender)throw new Error('injected offscreen failure');fake.info.render.calls=21;}),
  };
  const rooms={A:createRoomA(),B:createRoomB()};
  const camera=new PerspectiveCamera(65,16/9,.015,120);camera.position.set(0,1.55,-4);
  const portalRenderer=new PortalRenderer(fake as unknown as WebGLRenderer,rooms,camera);
  return {fake,state,rooms,camera,portalRenderer,previousTarget};
}

describe('PortalRenderer state and lifecycle',()=>{
  it('restores all renderer state and destination visibility after an offscreen exception',()=>{
    const f=fixture(true);const clipPlanes=f.fake.clippingPlanes;
    expect(()=>f.portalRenderer.render('A')).toThrow('injected offscreen failure');
    expect(f.state.target).toBe(f.previousTarget);expect(f.state.face).toBe(2);expect(f.state.mip).toBe(1);
    expect(f.state.viewport.toArray()).toEqual([4,5,800,450]);expect(f.state.scissor.toArray()).toEqual([6,7,600,350]);expect(f.state.scissorTest).toBe(true);
    expect(f.fake.clippingPlanes).toBe(clipPlanes);expect(f.fake.localClippingEnabled).toBe(true);
    expect(f.state.clearColor.getHexString()).toBe('123456');expect(f.state.clearAlpha).toBe(.25);
    expect(f.fake.autoClear).toBe(false);expect(f.fake.autoClearColor).toBe(false);expect(f.fake.autoClearDepth).toBe(false);expect(f.fake.autoClearStencil).toBe(false);
    expect(f.fake.xr.enabled).toBe(true);expect(f.fake.shadowMap.autoUpdate).toBe(true);expect(f.fake.info.autoReset).toBe(false);
    expect(f.rooms.B.surface.visible).toBe(true);expect(f.fake.render).toHaveBeenCalledTimes(1);
    f.portalRenderer.dispose();f.rooms.A.dispose();f.rooms.B.dispose();f.previousTarget.dispose();
  });
  it('renders exactly one destination pass and one main pass, never re-enters its destination surface',()=>{
    const f=fixture();
    f.fake.render.mockImplementation(()=>{expect(f.rooms.B.surface.visible).toBe(false);});
    f.fake.render.mockImplementationOnce(()=>{expect(f.rooms.B.surface.visible).toBe(false);});
    // Main pass occurs after destination surface visibility restoration.
    f.fake.render.mockImplementationOnce(()=>{expect(f.rooms.B.surface.visible).toBe(true);});
    f.portalRenderer.render('A');
    expect(f.fake.render).toHaveBeenCalledTimes(2);expect(f.portalRenderer.metrics.passes).toBe(1);
    f.portalRenderer.dispose();f.rooms.A.dispose();f.rooms.B.dispose();f.previousTarget.dispose();
  });
  it('preserves viewport aspect across DPR and quality changes without allocating targets per frame',()=>{
    const f=fixture();
    f.portalRenderer.resize(1920,1080,1.5,.5);
    expect(f.portalRenderer.metrics.targetWidth).toBe(1440);expect(f.portalRenderer.metrics.targetHeight).toBe(810);
    const texture=f.rooms.A.surface.material.uniforms.portalTexture.value;
    for(let i=0;i<50;i++){
      f.portalRenderer.resize(1000+i,600+i,1.5,.75);
      const m=f.portalRenderer.metrics;
      expect(Math.abs(m.targetWidth/m.targetHeight-(1000+i)/(600+i))).toBeLessThan(.003);
      expect(f.rooms.A.surface.material.uniforms.portalTexture.value).toBe(texture);
    }
    expect(()=>f.portalRenderer.resize(0,100,1)).toThrow();expect(()=>f.portalRenderer.resize(100,100,NaN)).toThrow();
    f.portalRenderer.dispose();f.rooms.A.dispose();f.rooms.B.dispose();f.previousTarget.dispose();
  });
  it('marks context loss, suppresses passes until restore, and disposes scenes idempotently',()=>{
    const f=fixture();const geometryDispose=vi.fn();f.rooms.A.surface.geometry.addEventListener('dispose',geometryDispose);
    const event=new Event('webglcontextlost',{cancelable:true});f.fake.domElement.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);expect(f.portalRenderer.metrics.context).toBe('lost');
    f.portalRenderer.render('A');expect(f.fake.render).not.toHaveBeenCalled();
    f.fake.domElement.dispatchEvent(new Event('webglcontextrestored'));
    expect(f.portalRenderer.metrics.context).toBe('active');f.portalRenderer.render('A');expect(f.fake.render).toHaveBeenCalledTimes(2);
    f.portalRenderer.dispose();f.portalRenderer.dispose();f.rooms.A.dispose();f.rooms.B.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);f.portalRenderer.render('A');expect(f.fake.render).toHaveBeenCalledTimes(2);
    f.previousTarget.dispose();
  });
});
