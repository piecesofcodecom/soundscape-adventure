import SoundscapeUI from "./soundscape-ui.mjs";
import utils from './utils/utils.mjs';
import constants from "./utils/constants.mjs";
import Soundscape from "./soundscape.mjs";

class SoundscapeAdventure {
    path;
    soundboards = {};
    globalSoundscape = {};
    ui_soundscape_messages = [];

    constructor() {
        if (SoundscapeAdventure.instance) {
            return SoundscapeAdventure.instance;
        }

        SoundscapeAdventure.instance = this;
        return this;
    }

    async init() {
        if(Object.keys(this.soundboards).length === 0) {
            utils.log(utils.getCallerInfo(),"Init SoundscapeAdventure");
            this.path = game.settings.get('soundscape-adventure', 'root-folder');
            this.soundboards = {};
            if (this.path.trim().length > 0) {
                await this.loadConfiguration();
            }
        }
    }

    findSoundscapeByName(name) {
        for (let key in this.soundboards) {
          if (this.soundboards[key].name == name) {
            return this.soundboards[key];
          }
        }
        return null;
      }

    async loadConfiguration() {
        utils.log(utils.getCallerInfo(),`Scanning folders within ${this.path}`);
        const folder = await FilePicker.browse('data', this.path, { recursive: false });
        this.globalSoundscape = await this.getGlobalConfiguration();
        for (const dir of folder.dirs) {
            utils.log(utils.getCallerInfo(),`Found folder ${dir}`);
            const name = `${constants.PREFIX}: ${dir.split("/").pop()}`;
            if (name != `${constants.PREFIX}: Global`) {
                const soundboard = this.findSoundscapeByName(name);
                if (!soundboard) {
                    utils.log(utils.getCallerInfo(),`Soundboard ${name} not found`); 
                    utils.log(utils.getCallerInfo(),`Adding soundboard '${name}' from ${dir}`);
                    const sb = new Soundscape(dir);
                    await sb.init(this.globalSoundscape.soundsConfig);
                    this.soundboards[sb.id] = {
                        name: name,
                        path: dir,
                        class: sb,
                        openUI: null
                    };
                } else {
                    utils.log(utils.getCallerInfo(),`Soundboard ${name} already exisits`);
                }
            }
        }
    }

    async getGlobalConfiguration() {
        try {
            // Attempt to browse the given path using FilePicker
            const result = await FilePicker.browse("data", `${this.path}/Global`);
            const sb = new Soundscape(`${this.path}/Global`);
            await sb.init();
            return sb;
          } catch (error) {
            // there is no global sounds
            return { soundsConfig: [] };
          }
    }

    async scanFiles(id) {
        if (id in this.soundboards) {
            await this.soundboards[id].class.reScanFolder();
            this.soundboards[id].openUI.render(true);
        }
    }

    // it builds the playlist for the sourboard
    async loadOfflineSoundboard(soundboardId) {
        utils.log(utils.getCallerInfo(),`Loading offline soundscape ${soundboardId}`);
        const sb = this.soundboards[soundboardId];
        if(sb) {
            await sb.class.enable();
        }
        Hooks.callAll('SoundscapeAdventure-UpdateSidebar', null);
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

    openSoundboard(soundscapeId) {
        utils.log(utils.getCallerInfo(),`Opening ${soundscapeId}`)
        const sb = this.soundboards[soundscapeId];
        if (sb) {
            const ui = new SoundscapeUI(sb);
            this.soundboards[soundscapeId].openUI = ui;
            ui.render(true);
        }
    }
    closeUI(soundscapeId) {
        this.soundboards[soundscapeId].openUI = null;
    }
    refreshSoundscapeUI(soundscapeId) {
        const sb = this.soundboards[soundscapeId];
        if (sb.openUI) {
            this.openSoundboard(soundscapeId);
        }
        
    }

    sidebarControls(dataset, value) {
        if (dataset.action == "volume") {
            this.soundboards[dataset.soundboardId].class.changeSoundVolume(dataset.moodId, dataset.soundId, value);
        } else if (dataset.action == "intensity") {
            this.soundboards[dataset.soundboardId].class.changeSoundIntensity(dataset.moodId, dataset.group, value)
        }
    }
}

const instance = new SoundscapeAdventure();
Object.freeze(SoundscapeAdventure); // Optional: to make the instance immutable

export default instance;