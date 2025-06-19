import {SendType, ServerApiType, ServerFunctionDataType, ServerInfo} from "../mapi/server/type";
import {EncodeUtil} from "../lib/util";
import {Files} from "../mapi/file/main";
import {Log} from "../mapi/log/main";

type LauncherResultType = {
    result: {
        [key: string]: any,
    },
    endTime: number | null,
}

export const EasyServer = function (config: any) {
    let controller: any = null
    this.serverConfig = config as {
        easyServer: {
            entry: string,
            entryArgs: string[],
            envs: string[],
            functions: {
                soundTts?: object,
                soundClone?: object,
                videoGen?: object,
            },
        }
    }
    this.isRunning = false
    this.ServerApi = null as ServerApiType | null
    this.ServerInfo = null as ServerInfo | null
    this.serverRuntime = {
        startTime: 0,
    }
    this.send = function (type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {type, data})
    }
    this.init = async function () {
    };
    this.config = async function () {
        return {
            code: 0,
            msg: "ok",
            data: {
                httpUrl: null,
                functions: this.serverConfig.easyServer.functions || {},
            }
        }
    };
    this.start = async function () {
        // console.log('start', this.ServerInfo)
        this.serverRuntime.startTime = Date.now()
        this.send('starting', this.ServerInfo)
    }
    this.ping = async function (): Promise<boolean> {
        // console.log('ping', this.ServerInfo)
        return this.serverRuntime.startTime > 0
    }
    this.stop = async function () {
        // console.log('stop', this.ServerInfo)
        this.send('stopping', this.ServerInfo)
        this.serverRuntime.startTime = 0
        this.send('stopped', this.ServerInfo)
        this.send('success', this.ServerInfo)
    }
    this.cancel = async function () {
        controller.stop()
    }
    this._callFunc = async function (
        data: ServerFunctionDataType,
        configCalculator: (data: ServerFunctionDataType) => Promise<any>,
        resultDataCalculator: (data: ServerFunctionDataType, launcherResult: LauncherResultType) => Promise<any>,
        option: {
            timeout: number,
        }
    ) {
        option = Object.assign({
            timeout: 24 * 3600,
        }, option)
        const resultData = {
            // success, querying, retry
            type: 'success',
            start: 0,
            end: 0,
            data: {}
        }
        if (this.isRunning) {
            resultData.type = 'retry'
            return {
                code: 0,
                msg: 'ok',
                data: resultData
            }
        }
        this.isRunning = true
        resultData.start = Date.now()
        let configJsonPath = null
        try {
            this.send('taskRunning', {id: data.id})
            const configData = await configCalculator(data)
            configData.setting = this.ServerInfo.setting
            configJsonPath = await this.ServerApi.launcherPrepareConfigJson(configData)
            let command = []
            command.push(this.serverConfig.easyServer.entry)
            if (this.serverConfig.easyServer.entryArgs) {
                command = command.concat(this.serverConfig.easyServer.entryArgs)
            }
            for (let i = 0; i < command.length; i++) {
                command[i] = command[i].replace('${CONFIG}', `"${configJsonPath}"`)
                command[i] = command[i].replace('${ROOT}', this.ServerInfo.localPath)
            }
            const envMap = {}
            // console.log('EasyServer', this.serverConfig.easyServer)
            if (this.serverConfig.easyServer.entry === 'launcher') {
                const systemEnv = await this.ServerApi.env()
                // console.log('EasyServer.systemEnv', systemEnv)
                for (const k in systemEnv) {
                    envMap[k] = systemEnv[k]
                }
            }
            envMap['PATH'] = this.ServerApi.getPathEnv([
                `${this.ServerInfo.localPath}`,
                `${this.ServerInfo.localPath}/binary`,
            ])
            envMap['PYTHONIOENCODING'] = 'utf-8'
            envMap['AIGCPANEL_SERVER_PLACEHOLDER_CONFIG'] = configJsonPath
            envMap['AIGCPANEL_SERVER_PLACEHOLDER_ROOT'] = this.ServerInfo.localPath
            if (this.serverConfig.easyServer.envs) {
                for (const e of this.serverConfig.easyServer.envs) {
                    let pcs = e.split('=')
                    const key = pcs.shift()
                    envMap[key] = pcs.join('=')
                }
            }
            for (const k in envMap) {
                envMap[k] = envMap[k].replace('${CONFIG}', `"${configJsonPath}"`)
                envMap[k] = envMap[k].replace('${ROOT}', this.ServerInfo.localPath)
            }
            // console.log('EasyServer.envMap', envMap)
            const launcherResult: LauncherResultType = {
                result: {},
                endTime: null,
            }
            // console.log('easyServer.start', JSON.stringify({command, envMap, configData}))
            await (async () => {
                return new Promise((resolve, reject) => {
                    let timer = null
                    controller = null
                    if (option.timeout > 0) {
                        timer = setTimeout(() => {
                            if (controller) {
                                try {
                                    controller.stop()
                                } catch (e) {
                                    Log.error('easyServer.timeout.stop.error', e)
                                }
                            }
                            this.ServerApi.file.appendText(this.ServerInfo.logFile, 'timeout')
                            resolve(undefined)
                        }, option.timeout * 1000)
                    }
                    this.ServerApi.app.spawnShell(command, {
                        env: envMap,
                        cwd: this.ServerInfo.localPath,
                        stdout: (_data) => {
                            // console.log('easyServer.stdout', _data)
                            this.ServerApi.file.appendText(this.ServerInfo.logFile, _data)
                            const result = this.ServerApi.extractResultFromLogs(data.id, _data)
                            if (result) {
                                launcherResult.result = Object.assign(launcherResult.result, result)
                                this.send('taskResult', {id: data.id, result})
                            }
                        },
                        stderr: (_data) => {
                            // console.log('easyServer.stderr', _data)
                            this.ServerApi.file.appendText(this.ServerInfo.logFile, _data)
                        },
                        success: (_data) => {
                            // console.log('easyServer.success', _data)
                            clearTimeout(timer)
                            resolve(undefined)
                        },
                        error: (_data, code) => {
                            // console.log('easyServer.error', _data)
                            this.ServerApi.file.appendText(this.ServerInfo.logFile, `exit code ${code}`)
                            clearTimeout(timer)
                            resolve(undefined)
                        },
                    }).then(c => {
                        controller = c
                    })
                })
            })()
            resultData.end = Date.now()
            resultData.data = await resultDataCalculator(data, launcherResult)
            // console.log('easyServer.end', launcherResult)
            await Files.deletes(configJsonPath, {isFullPath: true})
            return {
                code: 0,
                msg: 'ok',
                data: resultData
            }
        } catch (e) {
            throw e
        } finally {
            this.isRunning = false
        }
    }
    this.soundTts = async function (data: ServerFunctionDataType) {
        // console.log('soundTts', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: 'local',
                    modelConfig: {
                        type: 'soundTts',
                        param: data.param,
                        text: data.text,
                    }
                }
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!('url' in launcherResult.result)) {
                    throw "执行失败，请查看模型日志"
                }
                const localPath = await this.ServerApi.file.temp('wav')
                await this.ServerApi.file.rename(launcherResult.result.url, localPath, {
                    isFullPath: true
                })
                return {
                    filePath: localPath
                }
            }
        )
    }
    this.soundClone = async function (data: ServerFunctionDataType) {
        // console.log('soundClone', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: 'local',
                    modelConfig: {
                        type: 'soundClone',
                        param: data.param,
                        text: data.text,
                        promptAudio: data.promptAudio,
                        promptText: data.promptText,
                    }
                }
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!('url' in launcherResult.result)) {
                    throw "执行失败，请查看模型日志"
                }
                const localPath = await this.ServerApi.file.temp('wav')
                await this.ServerApi.file.rename(launcherResult.result.url, localPath, {
                    isFullPath: true
                })
                return {
                    filePath: localPath
                }
            }
        )
    }
    this.videoGen = async function (data: ServerFunctionDataType) {
        // console.log('videoGen', JSON.stringify({data, serverInfo: this.ServerInfo}))
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: 'local',
                    modelConfig: {
                        type: 'videoGen',
                        param: data.param,
                        video: data.videoFile,
                        audio: data.soundFile,
                    }
                }
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!('url' in launcherResult.result)) {
                    throw "执行失败，请查看模型日志"
                }
                const localPath = await this.ServerApi.file.temp('mp4')
                await this.ServerApi.file.rename(launcherResult.result.url, localPath, {
                    isFullPath: true
                })
                return {
                    filePath: localPath
                }
            }
        )
    }
}
