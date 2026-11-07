export interface TransferEvent { id:number; step:number; source:string; destination:string; position:number[]; velocity:number[]; }
export class EventRecorder {
 events:TransferEvent[]=[];
 record(event:TransferEvent){this.events.push(event);if(this.events.length>10000)this.events.shift();}
}
