import SoundBoard from "./soundboard.mjs";
import SoundBoardUI from "./soundboard-ui.mjs";
import utils from './utils/utils.mjs';
import constants from "./utils/constants.mjs";

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
        if (this.soundboards.length <= 0) {
            utils.log(utils.getCallerInfo(),"Init SoundboardAdventure");
            this.path = game.settings.get('soundboard-adventure', 'root-folder');
            this.soundboards = [];
            if (this.path.trim().length > 0) {
                await this.loadConfiguration();
            }
        }
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
                // await sb.init_soundboard();
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

    // it builds the playlist for the sourboard
    async loadOfflineSoundboard(name) {
        utils.log(utils.getCallerInfo(),`Loading soundboard that is offline from ${name}`);
        const sb = this.soundboards.filter(el => el.name == name)[0];
        if(sb) {
            await sb.class.init_soundboard();
        }
    }

    async _save() {
        utils.log(utils.getCallerInfo(),`Saving Soundboard Adventure configuration to ${this.path}`)
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
            utils.log(utils.getCallerInfo(),`Error saving Soundboard Adventure configuration to ${this.path}`, constants.LOGLEVEL.ERROR, error);
        }
    }

    openSoundboard(soundboardName) {
        utils.log(utils.getCallerInfo(),`Opening ${soundboardName}`)
        const sb = this.soundboards.filter(el => el.name == soundboardName)[0];
        if (sb) {
            const soundboard = new SoundBoardUI(sb);
            soundboard.render(true);
        }
    }
    sidebarControls(event) {
        const dataset = event.currentTarget.dataset;
        event.currentTarget.setAttribute('data-tooltip',`${event.currentTarget.value}%`)
        event.currentTarget.setAttribute('value',event.currentTarget.value)
        //event.currentTarget.setAttribute('data-tooltip',`${event.currentTarget.value}%`)

    }
}

const instance = new SoundboardAdventure();
Object.freeze(SoundboardAdventure); // Optional: to make the instance immutable

export default instance;