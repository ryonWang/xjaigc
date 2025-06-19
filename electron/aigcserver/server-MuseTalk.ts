import {VersionUtil} from "../lib/util";
import {SendType, ServerApiType, ServerContext, ServerFunctionDataType, ServerInfo} from "../mapi/server/type";

const serverRuntime = {
    port: 0,
}

let shellController = null
let isRunning = false


export const ServerMuseTalk: ServerContext = {
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
        // 检查并清理可能存在的旧进程
        await this.cleanupOldProcesses()
        
        this.send('starting', this.ServerInfo)
        let command = []
        if (this.ServerInfo.setting?.['port']) {
            serverRuntime.port = this.ServerInfo.setting.port
        } else if (!serverRuntime.port || !await this.ServerApi.app.isPortAvailable(serverRuntime.port)) {
            serverRuntime.port = await this.ServerApi.app.availablePort(50617)
        }
        const env = await this.ServerApi.env()
        command.push(`"${this.ServerInfo.localPath}/launcher"`)
        command.push(`--env=LAUNCHER_PORT=${serverRuntime.port}`)
        if (VersionUtil.ge(this.ServerInfo.version, '0.2.0')) {
            command.push(`--env=LAUNCHER_DEVICE=${this.ServerInfo.setting?.device || 'cpu'}`)
        }
        
        let hasStarted = false // 标记是否已经发送启动成功信号
        
        shellController = await this.ServerApi.app.spawnShell(command, {
            env,
            cwd: this.ServerInfo.localPath,
            stdout: (data) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
                // 检测服务启动成功的关键日志
                if (!hasStarted && (data.includes('start api mode') || data.includes('server starting'))) {
                    hasStarted = true
                    console.log('MuseTalk started successfully, sending success signal...')
                    // 延迟一秒确保服务完全就绪
                    setTimeout(() => {
                        this.send('success', this.ServerInfo)
                    }, 1000)
                }
            },
            stderr: (data) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
                // 检查错误信息
                if (data.includes('error') || data.includes('failed')) {
                    console.log('MuseTalk start error detected:', data)
                    this.send('error', this.ServerInfo)
                }
            },
            success: (data) => {
                // 进程正常退出时的处理（通常不会发生，因为服务会一直运行）
                if (!hasStarted) {
                    console.log('MuseTalk process exited unexpectedly')
                    this.send('error', this.ServerInfo)
                }
            },
            error: (data, code) => {
                this.ServerApi.file.appendText(this.ServerInfo.logFile, data)
                console.log('MuseTalk process error:', data, 'code:', code)
                this.send('error', this.ServerInfo)
            },
        })
    },
    
    // 清理旧进程的方法
    async cleanupOldProcesses() {
        try {
            console.log('Cleaning up old processes...')
            const launcherPath = this.ServerInfo.localPath + '/launcher'
            
            // 1. 清理PID文件
            const pidFile = launcherPath + '.pid'
            if (this.ServerApi.file) {
                try {
                    const pidContent = await this.ServerApi.file.read(pidFile, {isFullPath: true}) // 使用正确的read方法
                    if (pidContent) {
                        const pid = parseInt(pidContent.toString().trim())
                        if (pid > 0) {
                            console.log(`Found old PID: ${pid}, attempting to kill...`)
                            try {
                                if (process.platform === 'win32') {
                                    await this.ServerApi.app.shell(`taskkill /f /pid ${pid}`)
                                } else {
                                    await this.ServerApi.app.shell(`kill -9 ${pid}`)
                                }
                            } catch (e) {
                                console.log(`Failed to kill PID ${pid}:`, e.message)
                            }
                        }
                    }
                } catch (e) {
                    console.log('PID file not found or error reading:', e.message)
                }
                
                // 删除PID文件
                try {
                    await this.ServerApi.file.deletes(pidFile, {isFullPath: true})
                } catch (e) {
                    console.log('Error deleting PID file:', e.message)
                }
            }
            
            // 2. 按进程名称强制清理
            try {
                if (process.platform === 'win32') {
                    await this.ServerApi.app.shell('taskkill /f /im launcher.exe')
                } else {
                    await this.ServerApi.app.shell('pkill -f launcher')
                }
            } catch (e) {
                console.log('Failed to cleanup launcher processes:', e.message)
            }
            
            console.log('Old processes cleanup completed')
        } catch (error) {
            console.log('cleanup old processes error:', error)
        }
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
            // 优雅停止进程
            if (shellController) {
                shellController.stop()
                shellController = null
            }
            
            // 确保清理PID文件
            await this.cleanupOldProcesses()
            
            // 发送停止完成信号
            this.send('stopped', this.ServerInfo)
        } catch (e) {
            console.log('stop error', e)
            this.send('error', this.ServerInfo)
        }
    },
    async cancel() {
        await this.ServerApi.launcherCancel(this)
    },
    async config() {
        return {
            "code": 0,
            "msg": "ok",
            "data": {
                "httpUrl": shellController ? this.url() : null,
                "functions": {
                    "videoGen": {
                        "param": []
                    },
                }
            }
        }
    },
    async videoGen(data: ServerFunctionDataType) {
        if (!serverRuntime.port) {
            serverRuntime.port = 50617
        }
        if (!this.ServerInfo.logFile) {
            this.ServerInfo.logFile = `${this.ServerInfo.localPath}/log-debug.txt`
        }
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
            if (VersionUtil.ge(this.ServerInfo.version, '0.3.0')) {
                const result = await this.ServerApi.launcherSubmitConfigJsonAndQuery(this, {
                    id: data.id,
                    mode: 'local',
                    modelConfig: {
                        type: 'videoGen',
                        video: data.videoFile,
                        audio: data.soundFile,
                        box: -7
                    }
                })
                resultData.end = result.endTime
                resultData.data.filePath = result.result.url
            } else if (VersionUtil.ge(this.ServerInfo.version, '0.2.0')) {
                const configYaml = await this.ServerApi.file.temp('yaml')
                await this.ServerApi.file.write(configYaml, [
                    'task_0:',
                    `  video_path: ${data.videoFile}`,
                    `  audio_path: ${data.soundFile}`,
                    `  bbox_shift: -7`,
                    '',
                ].join('\n'), {
                    isFullPath: true
                })
                console.log('configYaml', configYaml)
                let outputFile = ''
                const submitRet = await this.ServerApi.requestPost(`${this.url()}submit`, {
                    entryPlaceholders: {
                        'CONFIG': configYaml
                    },
                    root: this.ServerInfo.localPath,
                })
                console.log('submitRet', JSON.stringify(submitRet))
                if (submitRet.code) {
                    throw new Error(`submit ${submitRet.msg}`)
                }
                for (let i = 0; i < 3600 * 24 / 5; i++) {
                    await this.ServerApi.sleep(5000)
                    const queryRet = await this.ServerApi.requestPost(`${this.url()}query`, {
                        token: submitRet.data.token
                    })
                    console.log('queryRet', JSON.stringify(queryRet))
                    if (queryRet.code) {
                        throw new Error(queryRet.msg)
                    }
                    let logs = queryRet.data.logs
                    if (logs) {
                        logs = this.ServerApi.base64Decode(logs)
                        if (logs) {
                            await this.ServerApi.file.appendText(this.ServerInfo.logFile, logs)
                            const match = logs.match(/ResultSaveTo:([.\/\w_-]+\.mp4)/);
                            if (match) {
                                outputFile = match[1];
                                break
                            }
                        }
                    }
                    if (queryRet.data.status === 'success') {
                        resultData.end = Date.now()
                        await this.ServerApi.file.appendText(this.ServerInfo.logFile, 'success')
                        break
                    }
                }
                if (!outputFile) {
                    throw new Error('outputFile not found')
                }
                const videoUrl = `${this.url()}download/${outputFile}`
                const videoLocal = await this.ServerApi.file.temp('mp4')
                await this.ServerApi.requestUrlFileToLocal(videoUrl, videoLocal)
                // console.log('video', {
                //     videoUrl,
                //     videoLocal
                // })
                resultData.data.filePath = videoLocal
            } else {
                const client = await this._client()
                const payload = []
                payload.push(this.ServerApi.GradioHandleFile(data.videoFile))
                payload.push(this.ServerApi.GradioHandleFile(data.soundFile))
                payload.push(-7)
                const result = await client.predict("/predict", payload);
                console.log('videoGen.result', JSON.stringify(result))
                resultData.end = Date.now()
                resultData.data.filePath = result.data[0].value.video.path
            }
            return {
                code: 0,
                msg: 'ok',
                data: resultData
            }
        } catch (e) {
            console.log('videoGen.error', e)
            throw e
        } finally {
            isRunning = false
        }
    },
}
