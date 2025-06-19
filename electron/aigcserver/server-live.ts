import {SendType, ServerApiType, ServerContext, ServerInfo} from "../mapi/server/type";

const serverRuntime = {
    port: 0,
}

let shellController = null
let isRunning = false

export const ServerLive: ServerContext = {
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
        command.push(`"${this.ServerInfo.localPath}/launcher"`)
        command.push(`--env=DEBUG=true`)
        env['PATH'] = this.ServerApi.getPathEnv(`${this.ServerInfo.localPath}/binary`)
        env['AIGCPANEL_SERVER_PORT'] = `${serverRuntime.port}`
        env['AIGCPANEL_SERVER_PLACEHOLDER_CONFIG'] = await this.ServerApi.launcherPrepareConfigJson({
            id: 'live',
            modelConfig: {},
            setting: this.ServerInfo.setting,
        })
        // console.log('command', JSON.stringify(command))
        shellController = await this.ServerApi.app.spawnShell(command, {
            stdout: (data) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
                const result = this.ServerApi.extractResultFromLogs('live', data)
                if (result) {
                    if (result['Action']) {
                        const action = result['Action'].split(':')
                        this.send('action', {
                            type: action[0],
                            msg: action.length > 1 ? action[1] : '',
                        })
                    }
                }
            },
            stderr: (data) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
            },
            success: (data) => {
                // console.log('serverLive.success', {data})
                this.send('success', this.ServerInfo)
            },
            error: (data, code) => {
                // console.log('serverLive.error', {code, data})
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
            console.log('ping error', e)
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
                    live: {
                        content: ``,
                        param: [],
                    },
                }
            }
        }
    },
    async apiRequest(data: {
        url: string,
        param: any,
    }, option: any) {
        // serverRuntime.port = 60617
        // console.log('apiRequest', {url: this.url(), data, option})
        const {url, param} = data
        return this.ServerApi.request(`${this.url()}${url}`, param, {
            method: 'POST',
        })
    },
}
