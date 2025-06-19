import {SendType, ServerApiType, ServerContext, ServerFunctionDataType, ServerInfo} from "../mapi/server/type";

const serverRuntime = {
    port: 0,
}

let shellController = null
let isRunning = false

export const ServerCosyvoice205b: ServerContext = {
    ServerApi: null as ServerApiType | null,
    ServerInfo: null as ServerInfo | null,
    url() {
        return `http://localhost:${serverRuntime.port}/`
    },
    send(type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {type, data})
    },

    async init() {
    },
    async start() {
        // console.log('this.ServerApi.app.availablePort(50617)', await this.ServerApi.app.availablePort(50617))
        this.send('starting', this.ServerInfo)
        let command = []
        serverRuntime.port = await this.ServerApi.availablePort(serverRuntime.port, this.ServerInfo.setting)
        const env = await this.ServerApi.env()
        command.push(`"${this.ServerInfo.localPath}/launcher"`)
        command.push(`--env=LAUNCHER_PORT=${serverRuntime.port}`)
        shellController = await this.ServerApi.app.spawnShell(command, {
            stdout: (data) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
            },
            stderr: (data) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
            },
            success: (data) => {
                this.send('success', this.ServerInfo)
            },
            error: (data, code) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
                this.send('error', this.ServerInfo)
            },
            env,
            cwd: this.ServerInfo.localPath,
        })
    },
    async ping() {
        try {
            const res = await this.ServerApi.request(`${this.url()}ping`)
            return true
        } catch (e) {
        }
        return false
    },
    async stop() {
        this.send('stopping', this.ServerInfo)
        try {
            shellController.stop()
            shellController = null
        } catch (e) {
            console.log('stop error', e)
        }
        this.send('stopped', this.ServerInfo)
    },
    async cancel() {
        await this.ServerApi.launcherCancel(this)
    },
    async config() {
        return {
            code: 0,
            msg: "ok",
            data: {
                httpUrl: shellController ? this.url() : null,
                content: ``,
                functions: {
                    soundClone: {
                        content: `
<p><b>模型克隆</b> 请使用5-10s的音频，太长的音频会导致克隆变慢。</p>
                `,
                        param: [
                            {
                                name: "crossLingual",
                                type: "switch",
                                title: "跨语种复刻",
                                defaultValue: false,
                                placeholder: "请输入语速",
                                tips: "跨语种克隆时需要特殊处理，因此需要标记是否为跨语种克隆"
                            }
                        ],
                    },
                }
            }
        }
    },
    async soundClone(data: ServerFunctionDataType) {
        const resultData = {
            // success, querying, retry
            type: 'success',
            start: 0,
            end: 0,
            data: {
                filePath: null
            }
        }
        if (isRunning) {
            resultData.type = 'retry'
            return {
                code: 0,
                msg: 'ok',
                data: resultData
            }
        }
        isRunning = true
        const param = data.param || {}
        resultData.start = Date.now()
        try {
            this.send('taskRunning', {id: data.id})
            const result = await this.ServerApi.launcherSubmitConfigJsonAndQuery(this, {
                id: data.id,
                mode: 'local',
                modelConfig: {
                    type: 'soundClone',
                    seed: 0,
                    speed: 1,
                    text: data.text,
                    promptAudio: data.promptAudio,
                    promptText: data.promptText,
                    crossLingual: !!param['CrossLingual'],
                }
            })
            resultData.end = result.endTime
            resultData.data.filePath = result.result.url
            return {
                code: 0,
                msg: 'ok',
                data: resultData
            }
        } catch (e) {
            throw e
        } finally {
            isRunning = false
        }
    },

}
