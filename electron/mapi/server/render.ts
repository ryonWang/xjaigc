import {ipcRenderer} from 'electron'
import {ServerInfo} from "./type";

const listGpus = async () => {
    return ipcRenderer.invoke('server:listGpus')
}

const runningServerCount = async (count: number | null) => {
    return ipcRenderer.invoke('server:runningServerCount', count)
}

const isSupport = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:isSupport', serverInfo)
}

const start = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:start', serverInfo)
}

const ping = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:ping', serverInfo)
}

const stop = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:stop', serverInfo)
}

const cancel = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:cancel', serverInfo)
}

const config = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:config', serverInfo)
}

const callFunction = async (serverInfo: ServerInfo, method: string, data: any, option: any) => {
    return ipcRenderer.invoke('server:callFunction', serverInfo, method, data, option)
}

const callFunctionWithException = async (serverInfo: ServerInfo, method: string, data: any, option: any) => {
    try {
        return ipcRenderer.invoke('server:callFunction', serverInfo, method, data, option)
    } catch (e) {
        return {
            code: -1,
            msg: e + '',
        }
    }
}

export default {
    listGpus,
    runningServerCount,
    isSupport,
    start,
    ping,
    stop,
    cancel,
    config,
    callFunction,
    callFunctionWithException,
}
