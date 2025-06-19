import {spawn,ChildProcess} from 'child_process';
import {ipcMain} from 'electron';

interface ProcessInfo {
  pid:number;
  name:string;
  status:'running'|'stopped'|'error';
  memory:number;
  cpu:number;
  uptime:number;
  command:string;
  args:string[];
}

class ProcessManager {
  private processes=new Map<string,ChildProcess>(); // 进程缓存
  private processInfo=new Map<string,ProcessInfo>(); // 进程信息
  
  async spawn(id:string,command:string,args:string[],options?:any):Promise<ChildProcess> {
    const childProcess=spawn(command,args,{stdio:['pipe','pipe','pipe'],env:{...process.env,...options?.env},cwd:options?.cwd,...options}); // 启动进程
    this.processes.set(id,childProcess); // 缓存进程
    this.processInfo.set(id,{pid:childProcess.pid||0,name:id,status:'running',memory:0,cpu:0,uptime:Date.now(),command,args}); // 记录信息
    
    childProcess.on('exit',()=>{this.processes.delete(id);const info=this.processInfo.get(id);if(info)info.status='stopped';}); // 进程退出处理
    childProcess.on('error',()=>{const info=this.processInfo.get(id);if(info)info.status='error';}); // 进程错误处理
    
    return childProcess;
  }
  
  async terminate(id:string):Promise<void> {
    const process=this.processes.get(id);
    if(process){
      process.kill('SIGTERM'); // 优雅终止
      setTimeout(()=>process.kill('SIGKILL'),5000); // 5秒后强制终止
      this.processes.delete(id);
    }
  }
  
  killAll():void {
    this.processes.forEach((proc,id)=>{proc.kill('SIGTERM');setTimeout(()=>proc.kill('SIGKILL'),5000);}); // 终止所有进程
    this.processes.clear();this.processInfo.clear(); // 清空缓存
  }
  
  getProcesses():ProcessInfo[] {
    return Array.from(this.processInfo.values()).map(info=>({...info,uptime:Math.floor((Date.now()-info.uptime)/1000)})); // 返回进程列表
  }
  
  setupIPC():void {
    ipcMain.handle('system:getProcesses',()=>this.getProcesses()); // 获取进程列表
    ipcMain.handle('system:killProcess',async(_,pid:number)=>{
      const entry=Array.from(this.processInfo.entries()).find(([,info])=>info.pid===pid);
      if(entry)await this.terminate(entry[0]);
    }); // 终止进程
  }
}

export const processManager=new ProcessManager(); // 导出单例