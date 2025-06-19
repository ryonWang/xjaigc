import {ipcMain,BrowserWindow} from 'electron';

interface IPCRequest {
  id:string;
  channel:string;
  data:any;
  timestamp:number;
}

class IPCOptimizer {
  private requestQueue:IPCRequest[]=[];
  private batchTimer:NodeJS.Timeout|null=null;
  private readonly BATCH_SIZE=10;
  private readonly BATCH_DELAY=16; // 16ms批处理延迟
  
  setupBatchProcessing():void {
    ipcMain.handle('batch:request',async(_,requests:IPCRequest[])=>{
      const results=await Promise.allSettled(requests.map(req=>this.processRequest(req))); // 批量处理请求
      return results.map(result=>result.status==='fulfilled'?result.value:{error:result.reason});
    });
  }
  
  private async processRequest(request:IPCRequest):Promise<any> {
    try{
      return await this.handleRequest(request.channel,request.data); // 处理单个请求
    }catch(error){
      return {error:(error as Error).message};
    }
  }
  
  private async handleRequest(channel:string,data:any):Promise<any> {
    switch(channel){
      case 'system:metrics':return this.getSystemMetrics();
      case 'system:processes':return this.getProcesses();
      default:throw new Error(`未知频道: ${channel}`);
    }
  }
  
  private getSystemMetrics():any {
    return {memory:process.memoryUsage(),cpu:process.cpuUsage(),timestamp:Date.now()}; // 系统指标
  }
  
  private getProcesses():any[] {
    return [{pid:process.pid,name:'main',status:'running',memory:process.memoryUsage().heapUsed,cpu:0,uptime:process.uptime()}]; // 进程信息
  }
  
  broadcast(channel:string,data:any):void {
    BrowserWindow.getAllWindows().forEach(win=>win.webContents.send(channel,data)); // 广播消息
  }
}

export const ipcOptimizer=new IPCOptimizer(); // 导出单例