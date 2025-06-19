import api from './api'

export type ServerApiType = typeof api

export type SendType = never
    // 服务
    | 'starting'
    | 'stopping'
    | 'stopped'
    | 'success'
    | 'error'
    // 其他
    | 'action'
    // 任务
    | 'taskRunning'
    | 'taskResult'
    | 'taskStatus'

export type ServerInfo = {
    localPath: string,
    name: string,
    version: string,
    setting: {
        [key: string]: any,
    },
    logFile: string,
    eventChannelName: string,
    config: any,
}

export type ServerContext = {
    ServerApi: ServerApiType | null,
    ServerInfo: ServerInfo | null,

    send: (type: SendType, data: any) => void,

    init: () => Promise<void>,
    start: () => Promise<void>,
    cancel: () => Promise<void>,
    stop: () => Promise<void>,
    url: () => string,
    ping: () => Promise<boolean>,
    config: () => Promise<any>,

    [key: string]: any,
}

export type ServerFunctionDataType = {
    id: string,
    [key: string]: any,
}
