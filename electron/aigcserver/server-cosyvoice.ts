import {VersionUtil} from "../lib/util";
import {SendType, ServerApiType, ServerContext, ServerFunctionDataType, ServerInfo} from "../mapi/server/type";

const serverRuntime = {
    port: 0,
}

let shellController = null
let isRunning = false

export const ServerCosyvoice: ServerContext = {
    ServerApi: null as ServerApiType | null,
    ServerInfo: null as ServerInfo | null,
    url() {
        return `http://localhost:${serverRuntime.port}/`
    },
    send(type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {type, data})
    },

    async _client() {
        return await this.ServerApi.GradioClient.connect(this.url());
    },
    async init() {
    },
    async start() {
        // console.log('this.ServerApi.app.availablePort(50617)', await this.ServerApi.app.availablePort(50617))
        this.send('starting', this.ServerInfo)
        let command = []
        serverRuntime.port = await this.ServerApi.availablePort(serverRuntime.port, this.ServerInfo.setting)
        const env = await this.ServerApi.env()
        if (this.ServerInfo.setting?.['startCommand']) {
            command.push(this.ServerInfo.setting.startCommand)
        } else {
            if (VersionUtil.ge(this.ServerInfo.version, '0.2.0')) {
                command.push(`"${this.ServerInfo.localPath}/launcher"`)
                command.push(`--env=LAUNCHER_PORT=${serverRuntime.port}`)
                // command.push(`--debug`)
                const dep = process.platform === 'win32' ? ';' : ':'
                env['PATH'] = process.env['PATH'] || ''
                env['PATH'] = `${this.ServerInfo.localPath}/binary${dep}${env['PATH']}`
            } else if (VersionUtil.ge(this.ServerInfo.version, '0.1.0')) {
                command.push(`"${this.ServerInfo.localPath}/launcher"`)
                env['AIGCPANEL_SERVER_PORT'] = serverRuntime.port
                const dep = process.platform === 'win32' ? ';' : ':'
                env['PATH'] = process.env['PATH'] || ''
                env['PATH'] = `${this.ServerInfo.localPath}/binary${dep}${env['PATH']}`
            } else {
                command.push(`"${this.ServerInfo.localPath}/main"`)
                command.push(`--port=${serverRuntime.port}`)
                if (this.ServerInfo.setting?.['gpuMode'] === 'cpu') {
                    command.push('--gpu_mode=cpu')
                }
            }
        }
        // console.log('command', JSON.stringify(command))
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
            if (VersionUtil.ge(this.ServerInfo.version, '0.2.0')) {
                const res = await this.ServerApi.request(`${this.url()}ping`)
            } else {
                const client = await this._client()
                const result = await client.predict("/change_instruction", {
                    mode_checkbox_group: "预训练音色",
                });
            }
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
            if (VersionUtil.ge(this.ServerInfo.version, '0.2.0')) {
                const result = await this.ServerApi.launcherSubmitConfigJsonAndQuery(this, {
                    id: data.id,
                    mode: 'local',
                    modelConfig: {
                        type: 'tts',
                        seed: 1,
                        speed: 1,
                        text: data.text,
                        speakerId: data.param.speaker,
                    }
                })
                resultData.end = result.endTime
                resultData.data.filePath = result.result.url
            } else {
                const client = await this._client()
                const result = await client.predict("/generate_audio", {
                    mode_checkbox_group: "预训练音色",
                    tts_text: data.text,
                    sft_dropdown: data.param.speaker,
                    prompt_text: "",
                    prompt_wav_upload: null,
                    prompt_wav_record: null,
                    instruct_text: "",
                    seed: 1,
                    stream: "false",
                    speed: 1,
                });
                resultData.end = Date.now()
                resultData.data.filePath = await this.ServerApi.file.temp('wav')
                const resultWav = result.data[0].url
                await this.ServerApi.requestUrlFileToLocal(resultWav, resultData.data.filePath)
            }
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
            if (VersionUtil.ge(this.ServerInfo.version, '0.2.0')) {
                const configJson = await this.ServerApi.launcherPrepareConfigJson({
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
            } else {
                const client = await this._client()
                const result = await client.predict("/generate_audio", {
                    mode_checkbox_group: param['CrossLingual'] ? "跨语种复刻" : "3s极速复刻",
                    tts_text: data.text,
                    sft_dropdown: "",
                    prompt_text: data.promptText,
                    prompt_wav_upload: this.ServerApi.GradioHandleFile(data.promptAudio),
                    prompt_wav_record: null,
                    instruct_text: "",
                    seed: 1,
                    stream: "false",
                    speed: 1,
                });
                // console.log('soundClone.result', result)
                resultData.end = Date.now()
                resultData.data.filePath = await this.ServerApi.file.temp('wav')
                const resultWav = result.data[0].url
                await this.ServerApi.requestUrlFileToLocal(resultWav, resultData.data.filePath)
            }
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
