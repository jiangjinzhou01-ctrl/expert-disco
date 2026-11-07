import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { ExperienceLoop } from '../engine/runtime/ExperienceLoop';
export let currentRuntime:ExperienceLoop|null=null;
function Runtime({onReady}:{onReady:(r:ExperienceLoop|null)=>void}){
 const {gl,camera,size,viewport}=useThree(); const runtime=useRef<ExperienceLoop|null>(null);
 useEffect(()=>{const r=new ExperienceLoop(gl,camera as PerspectiveCamera);runtime.current=r;currentRuntime=r;onReady(r);void r.initialize().catch(error=>console.error("Physics initialization failed",error));return()=>{onReady(null);currentRuntime=null;runtime.current=null;r.dispose();};},[gl,camera,onReady]);
 useEffect(()=>{runtime.current?.resize(size.width,size.height,viewport.dpr,runtime.current.portalRenderer.metrics.quality);},[size.width,size.height,viewport.dpr]);
 useFrame((_,delta)=>runtime.current?.tick(delta),1);
 return null;
}
export function Experience({onReady}:{onReady:(r:ExperienceLoop|null)=>void}){return <Canvas camera={{fov:65,near:.015,far:120}} dpr={[1,1.5]} gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}}><Runtime onReady={onReady}/></Canvas>;}
