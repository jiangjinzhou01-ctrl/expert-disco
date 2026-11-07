export class PerformanceMonitor {
 private samples:number[]=[]; private cursor=0; physicsMs=0;
 record(ms:number){if(ms<=0||!Number.isFinite(ms))return;if(this.samples.length<1800)this.samples.push(ms);else{this.samples[this.cursor]=ms;this.cursor=(this.cursor+1)%1800;}}
 reset(){this.samples=[];this.cursor=0;this.physicsMs=0;}
 snapshot(){const s=[...this.samples].sort((a,b)=>a-b);const n=s.length;const avg=n?s.reduce((a,b)=>a+b,0)/n:0;return {samples:n,fps:avg?1000/avg:0,averageMs:avg,p50Ms:s[Math.min(n-1,Math.ceil(n*.5)-1)]??0,p95Ms:s[Math.min(n-1,Math.ceil(n*.95)-1)]??0,p99Ms:s[Math.min(n-1,Math.ceil(n*.99)-1)]??0,physicsMs:this.physicsMs,gpuMs:null};}
}
