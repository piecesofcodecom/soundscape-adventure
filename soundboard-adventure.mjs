import SoundBoard from "./soundboard.mjs";
import SoundBoardUI from "./soundboard-ui.mjs";
import utils from './utils/utils.mjs';

class SoundboardAdventure {
    path;
    soundboards = [];

    constructor() {
        if (SoundboardAdventure.instance) {
            return SoundboardAdventure.instance;
        }
        SoundboardAdventure.instance = this;
        return this;
    }

    async init() {
        utils.log(utils.getCallerInfo(),"Init SoundboardAdventure");
        this.path = "./worlds/soundboards";
        this.soundboards = [];
        await this.loadConfiguration();
    }

    async loadConfiguration() {
        utils.log(utils.getCallerInfo(),`Scanning folders within ${this.path}`);
        const folder = await FilePicker.browse('data', this.path, { recursive: true });
        for (const dir of folder.dirs) {
            utils.log(utils.getCallerInfo(),`Found folder ${dir}`);
            const name = `Soundboard: ${dir.split("/").pop()}`;
            const soundboard = await this.soundboards.find(el => el.name == name);
            if (!soundboard) {
                utils.log(utils.getCallerInfo(),`Soundboard ${name} not found`); 
                utils.log(utils.getCallerInfo(),`Adding soundboard '${name}' from ${dir}`);
                const sb = new SoundBoard(dir);
                await sb.init_soundboard();
                this.soundboards.push({
                    name: name,
                    path: dir,
                    playlistId: sb.playlistId,
                    status: "offline",
                    class: sb
                })
            } else {
                utils.log(utils.getCallerInfo(),`Soundboard ${name} already exisits`);
            }
        }
    }

    async scanFiles(sbName) {
        const sb = this.soundboards.find(el => el.name == sbName);
        if(sb) {
            sb.class.reScanFolder();
        }
    }

    /*async mapNewSoundboards() {
        console.log(`Loading new soundboards within ${this.path}`);
        const folder = await FilePicker.browse('data', this.path, { recursive: true });
        for (const dir of folder.dirs) {
            const name = `Soundboard: ${dir.split("/").pop()}`;
            const soundboard = this.soundboards.filter(el => el.name == name)[0];
            if (!soundboard) {
                const sb = new SoundBoard(dir);
                await sb.build();
                console.log(`Adding new soundboard '${sb.name}' from ${dir}`);
                this.soundboards.push({
                    name: name,
                    path: dir,
                    playlistId: sb.playlist._id,
                    status: "offline",
                    class: sb
                })
                console.log(`New soundboard detected: ${name}`);
            }
        }
        await this._save();
    }*/

    // it builds the playlist for the sourboard
    async loadOfflineSoundboard(name) {
        console.log(`Loading soundboard that is offline from ${name}`);
        const soundboard = this.soundboards.filter(el => el.name == name)[0];
        if(soundboard) {
            await soundboard.class.buildPlaylist();
            soundboard.status = "online";
            soundboard.playlistId = soundboard.class.playlist._id;
        }
        //await this._save();
    }

    async _save() {
        console.log(`Saving Soundboard Adventure configuration to ${this.path}`)
        const soundboardData = [];
        for (let i = 0; i < this.soundboards.length; i++) {
            soundboardData.push({
                name: this.soundboards[i].name,
                path: this.soundboards[i].path,
                status: "offline"
            })
        }
        try {
            const blob = new Blob([JSON.stringify(soundboardData, null, 2)], { type: 'application/json' });
            const file = new File([blob], this.configurationFile, { type: 'application/json' });
            await FilePicker.upload('data', this.path, file)
        } catch (error) {
            console.error(`Error saving Soundboard Adventure configuration to ${this.path}`, error);
        }
    }

    openSoundboard(soundboardName) {
        console.log(`Opening ${soundboardName}`)
        const sb = this.soundboards.filter(el => el.name == soundboardName)[0];
        if (sb) {
            console.log("Sound board found")
            console.log(sb)
            const soundboard = new SoundBoardUI(sb);
            soundboard.render(true);
        }
    }
}

const instance = new SoundboardAdventure();
Object.freeze(SoundboardAdventure); // Optional: to make the instance immutable

export default instance;