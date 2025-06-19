import StorageMain from "../storage/main";
import Files from "../file/main";

const versions = [
    {
        version: 0,
        up: async (db: DB) => {
            // await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`);
            // console.log('db.insert', await db.insert(`INSERT INTO users (name, email) VALUES (?, ?)`,['Alice', 'alice@example.com']));
            // console.log('db.select', await db.select(`SELECT * FROM users`));
            // console.log('db.first', await db.first(`SELECT * FROM users`));
        }
    },
    {
        version:1,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_tts (
                    id INTEGER PRIMARY KEY,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    text TEXT,
                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultWav TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_clone (
                    id INTEGER PRIMARY KEY,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    promptName TEXT,
                    promptWav TEXT,
                    promptText TEXT,
                    text TEXT,
                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultWav TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_video_template (
                    id INTEGER PRIMARY KEY,

                    name TEXT,
                    video TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_video_gen (
                    id INTEGER PRIMARY KEY,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    videoTemplateId INTEGER,
                    videoTemplateName TEXT,
                    soundType TEXT,
                    soundTtsId INTEGER,
                    soundTtsText TEXT,
                    soundCloneId INTEGER,
                    soundCloneText TEXT,

                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultMp4 TEXT
            )`);
        }
    },
    {
        version:2,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_sound_tts ADD COLUMN result TEXT`);
            await db.execute(`ALTER TABLE data_sound_clone ADD COLUMN result TEXT`);
            await db.execute(`ALTER TABLE data_video_gen ADD COLUMN result TEXT`);
        }
    },
    {
        version:3,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_video_gen ADD COLUMN soundCustomFile TEXT`);
        }
    },
    {
        version:4,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_task (
                   id INTEGER PRIMARY KEY,

                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),

                   biz TEXT,

                   status TEXT,
                   statusMsg TEXT,
                   startTime INTEGER,
                   endTime INTEGER,

                   serverName TEXT,
                   serverTitle TEXT,
                   serverVersion TEXT,

                   param TEXT,
                   jobResult TEXT,
                   modelConfig TEXT,
                   result TEXT

            )`);
        }
    },
    {
        version: 5,
        up: async (db: DB) => {
            // await db.execute(`DELETE FROM data_task where 1=1`);
            // SoundClone
            let records = await db.select(`SELECT * FROM data_sound_clone`);
            for(const r of records){
                const values = [
                    'SoundClone',
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        promptName: r.promptName,
                        promptWav: r.promptWav,
                        promptText: r.promptText,
                        text: r.text,
                    }),
                    JSON.stringify({
                        url: r.resultWav,
                    }),
                ]
                await db.insert(`INSERT INTO data_task
                    (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values)
            }
            // SoundTts
            records = await db.select(`SELECT * FROM data_sound_tts`);
            for(const r of records){
                const values = [
                    'SoundTts',
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        text: r.text,
                    }),
                    JSON.stringify({
                        url: r.resultWav,
                    }),
                ]
                await db.insert(`INSERT INTO data_task
                                 (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values)
            }
            // VideoGen
            records = await db.select(`SELECT * FROM data_video_gen`);
            for(const r of records){
                const values = [
                    'VideoGen',
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        videoTemplateId: r.videoTemplateId,
                        videoTemplateName: r.videoTemplateName,
                        soundType: r.soundType,
                        soundTtsId: r.soundTtsId,
                        soundTtsText: r.soundTtsText,
                        soundCloneId: r.soundCloneId,
                        soundCloneText: r.soundCloneText,
                        soundCustomFile: r.soundCustomFile,
                    }),
                    JSON.stringify({
                        url: r.resultMp4,
                    }),
                ]
                await db.insert(`INSERT INTO data_task
                                 (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values)
            }
        }
    },
    {
        version:6,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_storage (
                   id INTEGER PRIMARY KEY,

                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),

                   biz TEXT,

                   title TEXT,
                   sort INTEGER,
                   content TEXT

            )`);
        }
    },
    {
        version:7,
        up:async(db: DB) => {
            const records = await StorageMain.get("soundClonePrompt", "records", []);
            for(const r of records) {
                const values = [
                    'SoundPrompt',
                    r.name,
                    JSON.stringify({
                        url: r.promptWav,
                        promptText: r.promptText,
                    }),
                ]
                await db.insert(`INSERT INTO data_storage (biz, title, content)
                                 VALUES (?, ?, ?)`, values)
            }
        }
    },
    {
        version:8,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_task ADD COLUMN title TEXT`);
            const records = await db.select(`SELECT * FROM data_task`);
            for(const r of records) {
                let modelConfig:any = {}
                try {
                    modelConfig = JSON.parse(r.modelConfig);
                } catch (e) {
                    modelConfig = {}
                }
                let title = '';
                if(r.biz === 'SoundTts' || r.biz === 'SoundClone') {
                    title = Files.textToName(modelConfig.text);
                } else if(r.biz === 'VideoGen') {
                    title = Files.textToName([
                        modelConfig.videoTemplateName,
                        modelConfig.soundTtsText
                    ].join('_'));
                } else if(r.biz === 'VideoGenFlow') {
                    title = Files.textToName([
                        modelConfig.videoTemplateName,
                        modelConfig.text,
                    ].join('_'));
                }
                await db.execute(`UPDATE data_task SET title = ? WHERE id = ?`, [title, r.id]);
            }
        }
    },
]

export default {
    versions,
}


