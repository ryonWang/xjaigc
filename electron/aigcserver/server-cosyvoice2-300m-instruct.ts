import {SendType, ServerApiType, ServerContext, ServerFunctionDataType, ServerInfo} from "../mapi/server/type";

const serverRuntime = {
    port: 0,
}

let shellController = null
let isRunning = false

export const ServerCosyvoice2300mInstruct: ServerContext = {
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
                content: `
<p><b>支持指令如下</b></p>
<p><code>[breath]</code> 插入呼吸声音</p>
<p><code>&lt;strong&gt;&lt;/strong&gt;</code> 强调说明</p>
<p><code>&lt;laughter&gt;&lt;/laughter&gt;</code> 笑着说</p>
<p><code>[noise]</code> 表示噪音或杂音</p>
<p><code>[laughter]</code> 插入笑声</p>
<p><code>[cough]</code> 插入咳嗽声</p>
<p><code>[clucking]</code> 模拟鸡叫声</p>
<p><code>[accent]</code> 标记或模拟带有某种口音的语音</p>
<p><code>[quick_breath]</code> 表示快速的呼吸</p>
<p><code>[hissing]</code> 插入嘶嘶声</p>
<p><code>[sigh]</code> 插入叹气声</p>
<p><code>[vocalized-noise]</code> 表示口头上的杂音或模糊的语音</p>
<p><code>[lipsmack]</code> 插入嘴唇发出的“咂嘴”声音</p>
<p><code>[mn]</code> 插入“嗯”的声音</p>

`,
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
                    soundTts: {
                        param: [
                            {
                                name: "speaker",
                                type: "select",
                                title: "音色",
                                icon: "iconfont icon-speaker",
                                defaultValue: "中文女",
                                placeholder: "请选择音色",
                                options: [
                                    {label: "中文女", value: "中文女"},
                                    {label: "中文男", value: "中文男"},
                                    {label: "日语男", value: "日语男"},
                                    {label: "粤语女", value: "粤语女"},
                                    {label: "英文女", value: "英文女"},
                                    {label: "英文男", value: "英文男"},
                                    {label: "韩语女", value: "韩语女"},
                                ]
                            },
                        ],
                    }
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
                    seed: 1,
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
    async soundTts(data: ServerFunctionDataType) {
        // soundTts { text: '你好', speaker: '中文女', speed: 1, seed: 0 }
        // console.log('soundTts', data)
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
        resultData.start = Date.now()
        try {
            this.send('taskRunning', {id: data.id})
            const configJson = await this.ServerApi.launcherPrepareConfigJson({
                id: data.id,
                mode: 'local',
                modelConfig: {
                    type: 'tts',
                    seed: 1,
                    speed: 1,
                    text: data.text,
                    speakerId: data.param.speaker,
                },
                setting: this.ServerInfo.setting,
            })
            const result = await this.ServerApi.launcherSubmitAndQuery(this, {
                id: data.id,
                entryPlaceholders: {
                    'CONFIG': configJson
                },
                root: this.ServerInfo.localPath,
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
