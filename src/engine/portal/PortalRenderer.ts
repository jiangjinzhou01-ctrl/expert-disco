import {
  Box3, Frustum, Matrix4, Color, PerspectiveCamera, Plane, Vector2, Vector3, Vector4, WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { computePortalTransform } from './PortalMath';
import { portalNormal, type RoomScene } from './PortalGeometry';
import type { WorldId } from '../../scenes/RoomLayout';

export interface PortalRenderMetrics {
  targetWidth:number;targetHeight:number;quality:number;
  mainDrawCalls:number;offscreenDrawCalls:number;
  geometries:number;textures:number;programs:number;
  context:'active'|'lost';passes:number;targetResizes:number;
}
export interface ProjectedMarker {
  id:string;color:number;worldPosition:number[];x:number;y:number;ndcZ:number;
  drawingBufferWidth:number;drawingBufferHeight:number;
}

/** Owns graphics only. Never commits physics/world membership or creates an animation loop. */
export class PortalRenderer {
  readonly virtualCamera=new PerspectiveCamera();
  readonly metrics:PortalRenderMetrics={targetWidth:1,targetHeight:1,quality:1,mainDrawCalls:0,offscreenDrawCalls:0,geometries:0,textures:0,programs:0,context:'active',passes:0,targetResizes:0};
  private readonly target=new WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});
  private readonly drawingBuffer=new Vector2();
  private readonly clipPlane=new Plane();
  private readonly clipPlanes=[this.clipPlane];
  private readonly viewport=new Vector4();
  private readonly scissor=new Vector4();
  private readonly clearColor=new Color();
  private readonly normal=new Vector3();
  private readonly markerPosition=new Vector3();
  private readonly mapping:Record<WorldId,Matrix4>;
  visibilityCulling=false; adaptiveResolution=true; private readonly frustum=new Frustum();private readonly viewProjection=new Matrix4();private readonly portalBounds=new Box3();
  private disposed=false;
  private readonly contextLost=(event:Event)=>{event.preventDefault();this.metrics.context='lost';};
  private readonly contextRestored=()=>{this.metrics.context='active';this.target.dispose();};

  constructor(private readonly renderer:WebGLRenderer,readonly rooms:Record<WorldId,RoomScene>,private readonly mainCamera:PerspectiveCamera){
    this.mapping={A:computePortalTransform(rooms.A.portal,rooms.B.portal).matrix,B:computePortalTransform(rooms.B.portal,rooms.A.portal).matrix};
    this.target.texture.name='threshold-live-portal';
    this.target.texture.generateMipmaps=false;
    for(const room of Object.values(rooms))room.surface.material.uniforms.portalTexture.value=this.target.texture;
    renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    renderer.domElement.addEventListener('webglcontextrestored',this.contextRestored);
  }

  resize(width:number,height:number,dpr:number,quality=1):void{
    if(!Number.isFinite(width+height+dpr+quality)||width<=0||height<=0||dpr<=0)throw new Error('Invalid portal render dimensions');
    this.metrics.quality=Math.min(1,Math.max(.25,quality));
    const targetWidth=Math.max(1,Math.round(width*dpr*this.metrics.quality));
    const targetHeight=Math.max(1,Math.round(height*dpr*this.metrics.quality));
    if(targetWidth!==this.metrics.targetWidth||targetHeight!==this.metrics.targetHeight){
      this.target.setSize(targetWidth,targetHeight);this.metrics.targetResizes++;
      this.metrics.targetWidth=targetWidth;this.metrics.targetHeight=targetHeight;
    }
  }

  private mapCamera(worldId:WorldId):void{
    const destination=this.rooms[worldId==='A'?'B':'A'];
    this.mainCamera.updateMatrixWorld(true);
    this.virtualCamera.matrixWorld.multiplyMatrices(this.mapping[worldId],this.mainCamera.matrixWorld);
    this.virtualCamera.matrixWorld.decompose(this.virtualCamera.position,this.virtualCamera.quaternion,this.virtualCamera.scale);
    this.virtualCamera.fov=this.mainCamera.fov;this.virtualCamera.aspect=this.mainCamera.aspect;
    this.virtualCamera.near=this.mainCamera.near;this.virtualCamera.far=this.mainCamera.far;
    this.virtualCamera.zoom=this.mainCamera.zoom;
    this.virtualCamera.projectionMatrix.copy(this.mainCamera.projectionMatrix);
    this.virtualCamera.projectionMatrixInverse.copy(this.mainCamera.projectionMatrixInverse);
    this.virtualCamera.updateMatrixWorld(true);
    portalNormal(destination.portal,this.normal);
    this.clipPlane.setFromNormalAndCoplanarPoint(this.normal,destination.portal.position);
    // Keep geometry on/in front of the destination exit, with sub-millimetre tolerance.
    this.clipPlane.constant+=.0001;
  }

  render(worldId:WorldId):void{
    if(this.disposed||this.metrics.context==='lost')return;
    const renderer=this.renderer;
    renderer.getDrawingBufferSize(this.drawingBuffer);
    const actualDpr=renderer.getPixelRatio();
    // Adaptive chapter targets are resized exactly once below, never expanded then shrunk each frame.
    if(!this.visibilityCulling)this.resize(this.drawingBuffer.x/actualDpr,this.drawingBuffer.y/actualDpr,actualDpr,this.metrics.quality);
    this.rooms.A.surface.material.uniforms.drawingBufferSize.value.copy(this.drawingBuffer);
    this.rooms.B.surface.material.uniforms.drawingBufferSize.value.copy(this.drawingBuffer);
    this.mapCamera(worldId);
    const source=this.rooms[worldId];const destination=this.rooms[worldId==='A'?'B':'A'];
    if(this.visibilityCulling){
      this.mainCamera.updateMatrixWorld(true);
      this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(this.mainCamera.projectionMatrix,this.mainCamera.matrixWorldInverse));
      this.portalBounds.setFromCenterAndSize(source.portal.position,new Vector3(source.portal.width,source.portal.height,.002));
      const front=this.mainCamera.position.clone().sub(source.portal.position).dot(new Vector3(0,0,1).applyQuaternion(source.portal.rotation))>0;
      if(!front||!this.frustum.intersectsBox(this.portalBounds)){
        renderer.render(source.scene,this.mainCamera);this.metrics.offscreenDrawCalls=0;this.metrics.passes=0;this.metrics.mainDrawCalls=renderer.info.render.calls;this.metrics.geometries=renderer.info.memory.geometries;this.metrics.textures=renderer.info.memory.textures;this.metrics.programs=renderer.info.programs?.length??0;return;
      }
      const distance=this.mainCamera.position.distanceTo(source.portal.position);
      const coverage=Math.min(1,source.portal.width*source.portal.height/Math.max(1,distance*distance));
      // Discrete coverage bands avoid reallocating GPU attachments on every movement pixel.
      const effective=this.adaptiveResolution?Math.min(this.metrics.quality,coverage>.5?1:coverage>.2?.75:coverage>.08?.5:.35):this.metrics.quality;
      const w=Math.round(this.drawingBuffer.x*effective),h=Math.round(this.drawingBuffer.y*effective);
      if(w!==this.metrics.targetWidth||h!==this.metrics.targetHeight){this.target.setSize(w,h);this.metrics.targetResizes++;this.metrics.targetWidth=w;this.metrics.targetHeight=h;}
    }
    const previousTarget=renderer.getRenderTarget();
    const previousFace=renderer.getActiveCubeFace();const previousMip=renderer.getActiveMipmapLevel();
    renderer.getViewport(this.viewport);renderer.getScissor(this.scissor);
    const scissorTest=renderer.getScissorTest();
    const previousClipping=renderer.clippingPlanes;const localClipping=renderer.localClippingEnabled;
    renderer.getClearColor(this.clearColor);const clearAlpha=renderer.getClearAlpha();
    const autoClear=renderer.autoClear;const autoClearColor=renderer.autoClearColor;
    const autoClearDepth=renderer.autoClearDepth;const autoClearStencil=renderer.autoClearStencil;
    const xr=renderer.xr.enabled;const shadowUpdate=renderer.shadowMap.autoUpdate;
    const surfaceVisible=destination.surface.visible;
    const infoAutoReset=renderer.info.autoReset;
    try{
      renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;
      destination.surface.visible=false;
      renderer.clippingPlanes=this.clipPlanes;
      renderer.setRenderTarget(this.target);
      renderer.setViewport(0,0,this.metrics.targetWidth,this.metrics.targetHeight);
      renderer.setScissorTest(false);
      renderer.autoClear=true;renderer.autoClearColor=true;renderer.autoClearDepth=true;renderer.autoClearStencil=true;
      renderer.info.autoReset=true;
      renderer.render(destination.scene,this.virtualCamera);
      this.metrics.offscreenDrawCalls=renderer.info.render.calls;
      this.metrics.passes=1;
    }finally{
      destination.surface.visible=surfaceVisible;
      renderer.clippingPlanes=previousClipping;renderer.localClippingEnabled=localClipping;
      renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadowUpdate;
      renderer.autoClear=autoClear;renderer.autoClearColor=autoClearColor;
      renderer.autoClearDepth=autoClearDepth;renderer.autoClearStencil=autoClearStencil;
      renderer.setRenderTarget(previousTarget,previousFace,previousMip);
      renderer.setViewport(this.viewport);renderer.setScissor(this.scissor);renderer.setScissorTest(scissorTest);
      renderer.setClearColor(this.clearColor,clearAlpha);renderer.info.autoReset=infoAutoReset;
    }
    const callsBeforeMain=renderer.info.render.calls;
    renderer.render(source.scene,this.mainCamera);
    this.metrics.mainDrawCalls=renderer.info.render.calls-(infoAutoReset?0:callsBeforeMain);
    this.metrics.geometries=renderer.info.memory.geometries;this.metrics.textures=renderer.info.memory.textures;
    this.metrics.programs=renderer.info.programs?.length??0;
  }

  projectMarkers(worldId:WorldId):ProjectedMarker[]{
    this.mapCamera(worldId);
    this.renderer.getDrawingBufferSize(this.drawingBuffer);
    const destination=this.rooms[worldId==='A'?'B':'A'];
    return destination.markers.map(marker=>{
      this.markerPosition.set(...marker.position).project(this.virtualCamera);
      return {id:marker.id,color:marker.color,worldPosition:[...marker.position],
        x:(this.markerPosition.x*.5+.5)*this.drawingBuffer.x,
        y:(-.5*this.markerPosition.y+.5)*this.drawingBuffer.y,ndcZ:this.markerPosition.z,
        drawingBufferWidth:this.drawingBuffer.x,drawingBufferHeight:this.drawingBuffer.y};
    });
  }

  dispose():void{
    if(this.disposed)return;this.disposed=true;
    this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);
    this.target.dispose();
  }
}
