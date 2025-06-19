import {BrowserWindow,screen} from 'electron';

class WindowManager {
  private windows=new Map<string,BrowserWindow>(); // 窗口映射
  
  createWindow(id:string,options:Electron.BrowserWindowConstructorOptions={}):BrowserWindow {
    if(this.windows.has(id))return this.windows.get(id)!; // 防止重复创建
    
    const defaultOptions={width:1200,height:800,show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true}}; // 默认配置
    const window=new BrowserWindow({...defaultOptions,...options}); // 创建窗口
    
    window.once('ready-to-show',()=>window.show()); // 准备就绪时显示
    window.on('closed',()=>this.windows.delete(id)); // 窗口关闭时清理
    
    this.windows.set(id,window); // 缓存窗口
    return window;
  }
  
  getWindow(id:string):BrowserWindow|undefined {
    return this.windows.get(id); // 获取窗口
  }
  
  closeAll():void {
    this.windows.forEach(window=>window.close()); // 关闭所有窗口
  }
  
  centerWindow(window:BrowserWindow):void {
    const {width,height}=screen.getPrimaryDisplay().workAreaSize; // 获取屏幕尺寸
    const [winWidth,winHeight]=window.getSize(); // 获取窗口尺寸
    window.setPosition(Math.floor((width-winWidth)/2),Math.floor((height-winHeight)/2)); // 居中显示
  }
  
  getAllWindows():BrowserWindow[] {
    return Array.from(this.windows.values()); // 获取所有窗口
  }
}

export const windowManager=new WindowManager(); // 导出单例