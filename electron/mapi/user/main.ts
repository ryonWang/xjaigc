import {ipcMain, shell} from "electron";
import {AppConfig} from "../../../src/config";
import {ResultType} from "../../lib/api";
import {Events} from "../event/main";
import {platformUUID} from "../../lib/env";
import {AppsMain} from "../app/main";
import Apps from "../app";
import StorageMain from "../storage/main";
import {Log} from "../log/main";

const init = () => {
    setTimeout(() => {
        refresh().then()
    }, 1000)
    return null
}

const userData = {
    isInit: false,
    apiToken: '',
    user: {
        id: '',
        name: '',
        avatar: '',
        deviceCode: '',
    },
    data: {},
    basic: {},
}

const get = async (): Promise<{
    apiToken: string,
    user: {
        id: string,
        name: string,
        avatar: string,
        deviceCode: string,
    },
    data: {
        [key: string]: any,
    },
    basic: {
        [key: string]: any,
    },
}> => {
    if (!userData.isInit) {
        const userStorageData = await StorageMain.get('user', 'data', {})
        userData.apiToken = userStorageData.apiToken || ''
        userData.user = userStorageData.user || {}
        userData.data = userStorageData.data || {}
        userData.basic = userStorageData.basic || {}
        userData.isInit = true
    }
    userData.user.id = userData.user.id || ''
    return {
        apiToken: userData.apiToken,
        user: userData.user,
        data: userData.data,
        basic: userData.basic,
    }
}

ipcMain.handle('user:get', async (event) => {
    return get()
})

const save = async (data: {
    apiToken: string,
    user: any,
    data: any,
    basic: {},
}) => {
    userData.apiToken = data.apiToken || ''
    userData.user = data.user || {}
    userData.data = data.data || {}
    userData.user.id = userData.user.id || ''
    Events.broadcast('UserChange', {})
    await StorageMain.set('user', 'data', {
        apiToken: data.apiToken,
        user: data.user,
        data: data.data,
        basic: data.basic,
    })
}

ipcMain.handle('user:save', async (event, data) => {
    return save(data)
})

const refresh = async () => {
    const result = await userInfoApi()
    // console.log('user.refresh', result)
    await save({
        apiToken: result.data.apiToken,
        user: result.data.user,
        data: result.data.data,
        basic: result.data.basic,
    })
}

ipcMain.handle('user:refresh', async (event) => {
    return refresh()
})

const getApiToken = async (): Promise<string> => {
    await get()
    return userData.apiToken
}

ipcMain.handle('user:getApiToken', async (event) => {
    return getApiToken()
})

const getWebEnterUrl = async (url: string) => {
    let param = []
    const apiToken = await getApiToken()
    if (apiToken) {
        param.push(`api_token=${apiToken}`)
    }
    if (await AppsMain.shouldDarkMode()) {
        param.push(`is_dark=1`)
    }
    param.push(`device_uuid=${platformUUID()}`)
    param.push(`url=${encodeURIComponent(url)}`)
    return `${AppConfig.apiBaseUrl}/app_manager/enter?${param.join('&')}`
}

ipcMain.handle('user:getWebEnterUrl', async (event, url) => {
    return getWebEnterUrl(url)
})

const openWebUrl = async (url: string) => {
    url = await getWebEnterUrl(url)
    await shell.openExternal(url)
}

ipcMain.handle('user:openWebUrl', async (event, url) => {
    return openWebUrl(url)
})

const apiPost = async (
    url: string,
    data: Record<string, any>,
    option?: {
        catchException?: boolean,
    }
) => {
    return post(url, data, option)
}

ipcMain.handle('user:apiPost', async (event, url, data, option) => {
    return apiPost(url, data, option)
})

export const User = {
    init,
    get,
    save,
    getApiToken,
    getWebEnterUrl,
    openWebUrl,
}

export default User

const post = async <T>(
    api: string,
    data: Record<string, any>,
    option?: {
        catchException?: boolean,
        retry?: number,
        retryTimes?: number,
        retryInterval?: number,
    }
): Promise<ResultType<T>> => {
    option = Object.assign({
        catchException: true,
        retry: 0,
        retryTimes: 0,
        retryInterval: 5,
    }, option)
    let url = api
    if (!api.startsWith('http:') && !api.startsWith('https:')) {
        url = `${AppConfig.apiBaseUrl}/${api}`
    }
    const apiToken = await User.getApiToken()
    let json = null, res = null
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': Apps.getUserAgent(),
                'Content-Type': 'application/json',
                'Api-Token': apiToken,
            },
            body: JSON.stringify(data)
        })
        if (res.status !== 200) {
            if (option.retry > 0 && option.retryTimes < option.retry) {
                option.retryTimes++
                Log.info('user.post.retry', {api, data, res, retryTimes: option.retryTimes})
                await new Promise(resolve => setTimeout(resolve, option.retryInterval * 1000))
                return await post(api, data, option)
            }
            Log.error('user.post.error', {api, data, res})
            if (option.catchException) {
                throw `RequestError(code:${res.status},text:${res.statusText})`
            }
            return {
                code: -1,
                msg: `RequestError(code:${res.status},text:${res.statusText})`
            } as ResultType<T>
        }
        json = await res.json()
    } catch (e) {
        res = `RequestError(${e})`
    }
    // console.log('post', JSON.stringify({api, data, json}, null, 2))
    if (!json || !('code' in json)) {
        if (option.retry > 0 && option.retryTimes < option.retry) {
            option.retryTimes++
            Log.info('user.post.retry', {api, data, res, retryTimes: option.retryTimes})
            await new Promise(resolve => setTimeout(resolve, option.retryInterval * 1000))
            return await post(api, data, option)
        }
        Log.error('user.post.error', {api, data, res})
        if (option.catchException) {
            throw 'ResponseError'
        }
        return {code: -1, msg: 'ResponseError'}
    }
    if (json.code) {
        // 未登录或登录过期
        if (json.code === 1001) {
            if (userData.user && userData.user.id) {
                await refresh()
            }
        }
        if (option.catchException) {
            throw json.msg
        }
    }
    return json
}

const userInfoApi = async (): Promise<ResultType<{
    apiToken: string,
    user: object,
    data: any,
    basic: object,
}>> => {
    return await post('app_manager/user_info', {})
}

export const UserApi = {
    post,
    userInfoApi
}
