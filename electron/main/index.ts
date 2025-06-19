import {app, BrowserWindow, desktopCapturer, dialog, session, shell} from 'electron'
import {optimizer} from '@electron-toolkit/utils'

/** process.js 必须位于非依赖项的顶部 */
import {isDummy} from "../lib/process";
import {AppEnv, AppRuntime} from "../mapi/env";
import {MAPI} from '../mapi/main';

import {WindowConfig} from "../config/window";
import {AppConfig} from "../../src/config";
import Log from "../mapi/log/main";
import {ConfigMenu} from "../config/menu";
import {ConfigLang, t} from "../config/lang";
import {ConfigContextMenu} from "../config/contextMenu";
import {preloadDefault, rendererLoadPath} from "../lib/env-main";
import {Page} from "../page";
import {ConfigTray} from "../config/tray";
import {icnsLogoPath, icoLogoPath, logoPath} from "../config/icon";
import {isDev, isMac, isPackaged} from "../lib/env";
import {executeHooks} from "../lib/hooks";
import {DevToolsManager} from "../lib/devtools";
import {AppsMain} from "../mapi/app/main";
import {ServerMain} from "../mapi/server/main";

const isDummyNew = isDummy

if (process.env['ELECTRON_ENV_PROD']) {
    DevToolsManager.setEnable(false)
}

process.on('uncaughtException', (reason) => {
    let error: any = reason
    if (error instanceof Error) {
        error = [
            error.message,
            error.stack,
        ].join("\n")
    }
    Log.error('UncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
    Log.error('UnhandledRejection', reason);
    let error: any = reason
    if (error instanceof Error) {
        error = [
            error.message,
            error.stack,
        ].join("\n")
    }
    Log.error('UnhandledRejection', error);
});

app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

const hasSplashWindow = true

AppEnv.appRoot = process.env.APP_ROOT
AppEnv.appData = app.getPath('appData')
AppEnv.userData = app.getPath('userData')
AppEnv.isInit = true

MAPI.init()
ConfigContextMenu.init()

Log.info('Starting')
Log.info('LaunchInfo', {
    isPackaged,
    userData: AppEnv.userData
})

async function createWindow() {
    let icon = logoPath
    if (process.platform === 'win32') {
        icon = icoLogoPath
    } else if (process.platform === 'darwin') {
        icon = icnsLogoPath
    }
    if (hasSplashWindow) {
        AppRuntime.splashWindow = new BrowserWindow({
            title: AppConfig.name,
            width: 600,
            height: 350,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            hasShadow: true,
            skipTaskbar: true,
        })
        rendererLoadPath(AppRuntime.splashWindow, 'splash.html')
    }
    AppRuntime.mainWindow = new BrowserWindow({
        show: !hasSplashWindow,
        title: AppConfig.name,
        ...(!isPackaged ? {icon} : {}),
        frame: false,
        transparent: false,
        hasShadow: true,
        center: true,
        minWidth: WindowConfig.initWidth,
        minHeight: WindowConfig.initHeight,
        width: WindowConfig.initWidth,
        height: WindowConfig.initHeight,
        backgroundColor: await AppsMain.defaultDarkModeBackgroundColor(),
        titleBarStyle: 'hidden',
        trafficLightPosition: {x: 10, y: 11},
        webPreferences: {
            preload: preloadDefault,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            contextIsolation: false,
            // sandbox: false,
        },
    })

    AppRuntime.mainWindow.on('closed', () => {
        AppRuntime.mainWindow = null
    })
    AppRuntime.mainWindow.on('show', async () => {
        await executeHooks(AppRuntime.mainWindow, 'Show')
    });
    AppRuntime.mainWindow.on('hide', async () => {
        await executeHooks(AppRuntime.mainWindow, 'Hide')
    });

    if (isMac) {
        AppRuntime.mainWindow.on('close', (event) => {
            // @ts-ignore
            if (!app.quitForce && !isDev) {
                executeHooks(AppRuntime.mainWindow, 'ShowQuitConfirmDialog')
                event.preventDefault();
            }
        })
    }
    AppRuntime.mainWindow.on('enter-full-screen', () => {
        executeHooks(AppRuntime.mainWindow, 'EnterFullScreen')
    })
    AppRuntime.mainWindow.on('leave-full-screen', () => {
        executeHooks(AppRuntime.mainWindow, 'LeaveFullScreen')
    })

    rendererLoadPath(AppRuntime.mainWindow, 'index.html')
    DevToolsManager.register('Main', AppRuntime.mainWindow)

    AppRuntime.mainWindow.webContents.on('did-finish-load', () => {
        if (hasSplashWindow) {
            AppRuntime.mainWindow?.show()
            setTimeout(() => {
                try {
                    AppRuntime.splashWindow?.close()
                    AppRuntime.splashWindow = null
                    // AppRuntime.mainWindow.webContents.openDevTools({
                    //     mode: 'detach',
                    // })
                } catch (e) {
                }
            }, 1000);
        }
        Page.ready('main')
        DevToolsManager.autoShow(AppRuntime.mainWindow)
    })
    AppRuntime.mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return {action: 'deny'}
    })
}

app.whenReady()
    .then(() => {
        session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({types: ['screen']}).then((sources) => {
                // Grant access to the first screen found.
                callback({video: sources[0], audio: 'loopback'})
            })
        })
    })
    .then(ConfigLang.readyAsync)
    .then(() => {
        MAPI.ready()
        ConfigMenu.ready()
        ConfigTray.ready()
        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window)
        })
        createWindow().then()
    })

app.on('before-quit', (event) => {
    const localServerRunningCount = ServerMain.getRunningServerCount()
    if (localServerRunningCount > 0) { //  && isPackaged
        event.preventDefault()
        dialog.showMessageBox({
            type: 'info',
            title: t('提醒'),
            message: t('有 {count} 个本地模型服务正在运行，请停止后再关闭应用', {
                count: localServerRunningCount
            }),
            buttons: [t('确定')]
        })
    }
});

app.on('will-quit', () => {
    MAPI.destroy()
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
    if (AppRuntime.mainWindow) {
        if (AppRuntime.mainWindow.isMinimized()) {
            AppRuntime.mainWindow.restore()
        }
        AppRuntime.mainWindow.show()
        AppRuntime.mainWindow.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        if (!AppRuntime.mainWindow.isVisible()) {
            AppRuntime.mainWindow.show()
        }
        AppRuntime.mainWindow.focus()
    } else {
        createWindow().then()
    }
})
