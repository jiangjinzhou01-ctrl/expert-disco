import {describe,it,expect} from 'vitest';
import {PerformanceMonitor} from '../../engine/diagnostics/PerformanceMonitor';
describe('real frame telemetry statistics',()=>{
 it('uses the nearest-rank P95/P99 on a reproducible 100-frame sample',()=>{const monitor=new PerformanceMonitor();for(let i=1;i<=100;i++)monitor.record(i);const result=monitor.snapshot();expect(result.averageMs).toBe(50.5);expect(result.p95Ms).toBe(95);expect(result.p99Ms).toBe(99);expect(result.fps).toBeCloseTo(1000/50.5);expect(result.gpuMs).toBeNull();});
 it('retains only the most recent 1800 valid frames',()=>{const monitor=new PerformanceMonitor();for(let i=0;i<200;i++)monitor.record(1000);for(let i=0;i<1800;i++)monitor.record(10);for(const n of [0,-1,NaN,Infinity])monitor.record(n);expect(monitor.snapshot()).toMatchObject({samples:1800,averageMs:10,p95Ms:10,p99Ms:10,fps:100});});
 it('resets the sample window before an explicit isolated measurement',()=>{const monitor=new PerformanceMonitor();monitor.record(55);monitor.physicsMs=2;monitor.reset();expect(monitor.snapshot()).toMatchObject({samples:0,averageMs:0,p95Ms:0,p99Ms:0,fps:0,physicsMs:0});});
});
