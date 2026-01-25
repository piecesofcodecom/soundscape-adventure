import SoundscapeUI from "./soundscape-ui.mjs";
import utils from './utils/utils.mjs';
import constants from "./utils/constants.mjs";
import Soundscape from "./soundscape.mjs";

class SoundscapeAdventure {
    path;
    soundboards = {};
    globalSoundscape = {};
    ui_soundscape_messages = [];
    soundscapes = {};

    constructor() {
        if (SoundscapeAdventure.instance) {
            return SoundscapeAdventure.instance;
        }

        SoundscapeAdventure.instance = this;
        return this;
    }

    async init() {
    }

    async loadSoundscape(path_To_file,havesounds=false, folderPath="", loadSubfolders=false) {
        utils.log(utils.getCallerInfo(), `Loading soundscape from ${path_To_file}`, constants.LOGLEVEL.INFO);
        const sb = new Soundscape(path_To_file);
        await sb.init();
        // Store Soundscape directly (no wrapper object)
        this.soundscapes[sb.id] = sb;
        let soundscapes = game.settings.get('soundscape-adventure','soundscapes');
        if (soundscapes.length > 0 && !soundscapes.includes(path_To_file)) {
            soundscapes += ";"+path_To_file
        } else {
            soundscapes = path_To_file
        }
        game.settings.set('soundscape-adventure','soundscapes', soundscapes);
        utils.log(utils.getCallerInfo(), `Saving soudscapes ${soundscapes}`, constants.LOGLEVEL.INFO);
        if (havesounds) {
            await sb.addSoundsToPlaylist(folderPath, loadSubfolders);
        }
        return true
    }

    async _save() {
        utils.log(utils.getCallerInfo(), `Saving Soundboard Adventure configuration to ${this.path}`)
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
            utils.log(utils.getCallerInfo(), `Error saving Soundboard Adventure configuration to ${this.path}`, constants.LOGLEVEL.ERROR, error);
        }
    }

    openSoundboard(soundscapeId) {
        utils.log(utils.getCallerInfo(), `Opening ${soundscapeId}`)
        const soundscape = this.soundscapes[soundscapeId];
        if (soundscape) {
            const ui = new SoundscapeUI(soundscape);
            soundscape.openUI = ui;
            ui.render(true);
        }
    }

    async reloadSoundboard(soundscapeId) {
        utils.log(utils.getCallerInfo(), `Reloading ${soundscapeId}`)
        const soundscape = this.soundscapes[soundscapeId];
        if (soundscape) {
            await soundscape.reloadSoundscape();
        }
    }

    closeUI(soundscapeId) {
        const soundscape = this.soundscapes[soundscapeId];
        if (soundscape) {
            soundscape.openUI = null;
        }
    }

    triggerEvent(action, _data, event) {
        const data = _data.split(":");
        const soundscape = this.soundscapes[data[0]];
        if (!soundscape) return;

        if (action == "play") {
            soundscape.playMood(data[1]);
        } else if (action == "stop") {
            soundscape.stopMood(data[1]);
        } else if (action == "custom") {
            soundscape.playCustomTriggerEvent(event, data[1]);
        }
    }

    triggerCombatEvent(event) {
        for (let key in this.soundscapes) {
            this.soundscapes[key].playCombatTriggerEvent(event);
        }
    }

    async deleteSoundscape(soundspaceId, remove_playlist = false) {
        const soundscape = this.soundscapes[soundspaceId];
        if (!soundscape) return;

        if (soundscape.openUI) {
            soundscape.openUI.close();
        }

        const current_soundscapes = await game.settings.get('soundscape-adventure', 'soundscapes');
        utils.log(utils.getCallerInfo(), `Current soundscapes ${current_soundscapes}`, constants.LOGLEVEL.INFO);
        const soundscapes = current_soundscapes.split(";");
        for (let i = 0; i < soundscapes.length; i++) {
            if (soundscape.path.includes(soundscapes[i])) {
                soundscapes.splice(i, 1);
                if (remove_playlist && soundscape.playlist) {
                    const playlist = game.playlists.get(soundscape.playlist.id);
                    if (playlist) {
                        await playlist.delete();
                    }
                }
                delete this.soundscapes[soundspaceId];
            }
        }
        await game.settings.set('soundscape-adventure', 'soundscapes', soundscapes.join(";"));
    }

    // Below are some utility methods for external modules access the soundscapes
    getSoundscapes() {
        return Object.values(this.soundscapes).map(soundscape => soundscape.name);
    }

    getSoundscape(soundscapeName) {
        const matches = Object.values(this.soundscapes).filter(soundscape => soundscape.name.includes(soundscapeName));
        if (matches.length > 0) {
            return matches[0];
        }
        return undefined;
    }
}

const instance = new SoundscapeAdventure();
Object.freeze(SoundscapeAdventure); // Optional: to make the instance immutable

export default instance;