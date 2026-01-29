import MoodConfig from "./moodConfig.mjs";
import constants from "./utils/constants.mjs";
import utils from "./utils/utils.mjs";
import { RandomSoundManager } from './RandomSoundManager.mjs';
import { getHandler } from './soundTypeHandlers.mjs';


//TODO new behavior:
// - select global soundscape
// - load each soundscape from a folder

// TODO random needs to be improved
export default class Soundscape {
    id;
    name;
    type; // Type can be local or remote
    moods; // the moods associated to this soundscape
    playlist; // the playlist related to this soundscape
    soundsConfig; // a list of all sounds available for this soundscape
    path; // the soundscape path
    status; // it identifies if the soundscape is loaded (with a playlist)
    moodsConfigFile = "";
    random_idempotency;
    advice;
    version = 3;
    visible_off_sounds = false;
    activeMoodId = "";
    openUI = null;
    //the id of the mood is been displayed on the UI
    currentMoodOnUI = "";

    constructor(_path, _type = constants.SOUNDSCAPE_TYPE.LOCAL) {
        this.id = foundry.utils.randomID(16); // temp ID
        this.path = _path;
        this.type = _type;
        this.status = "offline";
        this.playlist = null;
        this.soundsConfig = [];
        this.random_idempotency = [];
        this.name = `${constants.PREFIX}: ${_path.split("/").pop()}`; // temp Name
        this.moods = {};
        this.playlistId = "";
        this.description = "";
        this.created = "";
        this.randomSoundManager = new RandomSoundManager();
    }

    /** Soundscape configuration */

    async init(globalSounds = []) {
        const response = await fetch(this.path);
        if (!response.ok) {
            ui.notifications.error(`Failed to load soundscape configuration from ${this.path}. Please check the path and try again.`);
            return;
        }
        const json = await response.json();
        if (json.version < 2) {
            ui.notifications.error(`The soundscape version ${json.version} is not supported. Please update the soundscape to version 2 or higher.`);
            return;
        }
        this.id = json.id || foundry.utils.randomID(16);
        this.name = json.name;
        this.playlistId = json?.playlistId;
        this.description = json.description;
        this.created = json.created;
        const moods = json.moods;
        this.moodsConfigFile = this.path.split("/").pop();
        this.playlist = await game.playlists.get(json.playlistId);

        if (this.playlist == null) {
            this.playlist = await game.playlists.find(el => el.name == "Soundscape: " + this.name);
            if (!this.playlist) {
                // TODO create playlist tries to add the audio files as well
                await this.createPlaylist(moods);
            } else {
                this.playlistId = this.playlist.id;
            }
        }

        let has_changes = false;

        for (const key in moods) {
            // TODO send to load mood
            const moodConfig = new MoodConfig(json.moods[key], this.playlist);
            await moodConfig.consistence(this.playlist);
            if (json.version == 2) {
                await moodConfig.migrate_from_v2_to_v3(json.moods[key].active_groups);
                has_changes = true;
                this.version = 3;
            }
            this.moods[key] = moodConfig;
            if (moods[key].status == constants.STATUS.MOOD.PLAYING) {
                this.activeMoodId = key;
                await this.playMood(key);
            }
        }
        if (has_changes) {
            await this.saveMoodsConfig();
        }
    }

    async reloadSoundscape() {
        await this.init();
    }

    async fileExists(path) {
        try {
            const response = await fetch(path);
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    async createPlaylist(moods) {
        const sounds = [];
        const playlistData = {
            name: "Soundscape: " + this.name,
            description: "A playlist created by Soundscape Adventure",
            mode: CONST.PLAYLIST_MODES.SIMULTANEOUS,
            sounds: sounds
        };

        this.playlist = await Playlist.create(playlistData);
        this.playlistId = this.playlist.id;
    }

    async save_soundboard() {
        let obj = {};
        for (let mood in this.moods) {
            obj[`${this.id}:${mood}`] = `${this.name} -> ${this.moods[mood].name}`
        }
        let soundscapes = await game.settings.get(`soundscape-adventure`, "regionSoundscapes");
        soundscapes = Object.assign(obj, soundscapes)
        game.settings.set(`soundscape-adventure`, "regionSoundscapes", soundscapes);

    }

    // enable an offiline soundscape means create a playlist
    // and load the moods
    // async enable() {
    //     await this._loadMoods();
    //     this.status = "online";
    //     const soundscapes = await game.settings.get('soundscape-adventure', 'soundscapes')
    //     //await game.settings.set('soundscape-adventure', 'soundscapes', soundscapes + ";" + this.name + "," + this.id);
    //     await this.saveMoodsConfig();
    // }

    // async validateFileExists(filePath) {
    //     const directory = filePath.substring(0, filePath.lastIndexOf('/'));
    //     const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

    //     try {
    //         const result = await foundry.applications.apps.FilePicker.browse("data", directory);

    //         if (result.files.includes(filePath)) {
    //             return true;
    //         } else {
    //             return false;
    //         }
    //     } catch (error) {
    //         return false;
    //     }
    // }

    // async reScanFolder() {
    //     await this.init();
    //     await this.saveMoodsConfig();
    // }

    //TODO sync playlist needs to be within the moodConfig
    // in the future, drag and drop will allow moods to have
    /// sounds from other soundscapes
    // async _syncPlaylist() {
    //     // validates all sounds are in the playlist
    //     for (let i = 0; i < this.soundsConfig.length; i++) {
    //         const sound = this.playlist.sounds.filter(el => el.path == this.soundsConfig[i].path);
    //         if (sound.length == 0) {
    //             // need to add the sound
    //             this.soundsConfig[i].id = await this._addSoundToPlaylist(this.soundsConfig[i]);
    //         } else if (sound.length > 1) {
    //             this.soundsConfig[i].id = sound[0].id;
    //             for (let j = 1; j < sound.length; j++) {
    //                 // double check that still exists
    //                 const sound_to_remove = this.playlist.sounds.find(el => el.id == sound[j].id);
    //                 if (sound_to_remove) {
    //                     await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [sound_to_remove._id]);
    //                 }
    //             }
    //         } else {
    //             this.soundsConfig[i].id = sound[0].id;
    //         }
    //     }

    //     // validates all sounds in the playlist are valid
    //     const sounds = this.playlist.sounds;
    //     for (let i = 0; i < sounds.length; i++) {
    //         const fileExists = this.validateFileExists(sounds[i].path);
    //         if (!fileExists) {
    //             await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [sounds[i]._id]);
    //         }
    //     }
    // }

    // async _addSoundToPlaylist(newSound) {
    //     utils.log(utils.getCallerInfo(), `Adding a new sound '${newSound.path}' to the playlist '${this.playlist.name}'`)
    //     await this.playlist.createEmbeddedDocuments("PlaylistSound", [newSound]);
    //     const sound = this.playlist.sounds.find(obj => obj.path == newSound.path);
    //     return sound.id;
    // }

    async _createPlaylist() {
        utils.log(utils.getCallerInfo(), `Creating playlist '${this.name}'`);
        let newPlaylistData = {
            name: this.name,
            description: "This is a playlist managed by Soundscape Adventure",
            folder: null,  // If you have a specific folder, provide its ID
            sorting: "a",  // Sorting method: "a" for alphabetic, "m" for manual
            mode: 2,  // Play mode: 0 for sequential, 1 for shuffle, 2 for simultaneous
            playing: false,  // Whether the playlist is currently playing
            sounds: this.soundsConfig
        };

        // Create the new playlist
        this.playlist = await Playlist.create(newPlaylistData);
    }

    /**
     * MOOD CONTROLS
     */
    async newMood(name, _soundsConfig = {}) {
        if (Object.keys(_soundsConfig).length === 0) {
            _soundsConfig.sounds = [];
            _soundsConfig.name = name;
            _soundsConfig.id = foundry.utils.randomID(16);
            _soundsConfig.status = "stop";
            _soundsConfig.groups = [];
            //_soundsConfig.active_groups = [];
            _soundsConfig.categories = [
                { id: "", name: "None", type: constants.SOUNDTYPE.LOOP, collapsed: false, sounds: [] },
                { id: "", name: "None", type: constants.SOUNDTYPE.RANDOM, collapsed: false, sounds: [] },
                { id: "", name: "None", type: constants.SOUNDTYPE.SOUNDPAD, collapsed: false, sounds: [] },
                { id: "", name: "None", type: constants.SOUNDTYPE.SOUNDPADUI, collapsed: false, sounds: [] }
            ]

        }
        utils.log(utils.getCallerInfo(), `Create new mood ${name}`);
        const mood = new MoodConfig(_soundsConfig, this.playlist);
        //mood.consistence();
        await mood.consistence(this.playlist);
        this.moods[_soundsConfig.id] = mood;
        await this.saveMoodsConfig();
        Hooks.callAll("SoundscapeAdventure-UpdateSidebar", name, mood);
    }
    async _loadMoods() {
        utils.log(utils.getCallerInfo(), `Checking moods for ${this.name}`);
        const folder = await foundry.applications.apps.FilePicker.browse('data', this.path, { recursive: false });
        let moodConfigFile = "";
        for (const file of folder.files) {
            if (file.includes(this.moodsConfigFile)) {
                moodConfigFile = file;
            }
        }
        if (moodConfigFile.length) {
            try {
                utils.log(utils.getCallerInfo(), `Previous mood configuration has been retrieved '${moodConfigFile}'`);
                const response = await fetch(moodConfigFile);
                const contents = await response.json();

                let name_update = true;
                for (let key in contents) {
                    const moodconfig = contents[key];
                    if (this.moods[moodconfig.id] == null) {
                        const currentPlaying = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
                        let status = "stop";
                        if (currentPlaying.length == 2) {
                            if (currentPlaying[0] == this.id && currentPlaying[1] == moodconfig.id) {
                                status = constants.STATUS.MOOD.PLAYING;
                            }
                        }
                        this.moods[moodconfig.id] = new MoodConfig(moodconfig, this.playlist, status);
                        //await this.moods[moodconfig.id].consistence(this.playlist);
                        //await this.moods[moodconfig.id].syncFolderSounds(this.soundsConfig);
                        if (status == constants.STATUS.MOOD.PLAYING) {
                            this.playMood(moodconfig.id, false);
                        }
                        // update soundscape sound names
                        if (name_update) {
                            name_update = false;
                            for (let i = 0; i < this.soundsConfig.length; i++) {
                                const sound = this.moods[moodconfig.id].sounds.find(obj => obj.id == this.soundsConfig[i].id);
                                if (sound) {
                                    this.soundsConfig[i].name = sound.name;
                                }
                            }
                        }
                    } else {
                        await this.moods[moodconfig.id].syncFolderSounds(this.soundsConfig);
                    }
                }
            } catch (error) {
                utils.log(utils.getCallerInfo(), `Can't parse file ${moodConfigFile}`, constants.LOGLEVEL.ERROR, error)
            }
        } else {
            utils.log(utils.getCallerInfo(), `No configuration found for ${this.name}`);
        }
        return;
    }

    async playStopMood(moodId) {
        console.warn("Toggling mood", moodId, this.moods[moodId].status, constants.STATUS.MOOD.PLAYING);
        if (this.moods[moodId].status == constants.STATUS.MOOD.PLAYING) {
            await this.stopMood(moodId);
        } else {
            if (this.activeMoodId && this.activeMoodId != moodId) {
                await this.stopMood(this.activeMoodId);
            }
            await this.playMood(moodId);
        }
        if (this.openUI) {
            this.openUI.render(true);
        }
        await this.saveMoodsConfig();
        Hooks.callAll('soundscape-adventure.mood.playStopMood', this.id, moodId, this.moods[moodId]);
    }
    async playMood(moodId) {
        this.activeMoodId = moodId;
        this.isPlaying = true;
        if (this.moods[moodId]) {
            const sounds = await this.moods[moodId].getSoundsToPlay();
            this.moods[moodId].status = constants.STATUS.MOOD.PLAYING;
            // configure sound before playing
            for (let i = 0; i < sounds.length; i++) {
                const s = this.playlist.sounds.get(sounds[i].id);
                if (s) {
                    if (sounds[i].type == constants.SOUNDTYPE.GROUP_SOUNDPAD || sounds[i].type == constants.SOUNDTYPE.RANDOM || sounds[i].type == constants.SOUNDTYPE.GROUP_RANDOM) {
                        await s.update({ repeat: false });
                    } else {
                        await s.update({ repeat: true });
                    }
                }
            }

            for (let i = 0; i < sounds.length; i++) {
                await this.playSound(sounds[i], moodId);
            }

            const groups = await this.moods[moodId].getGroupsToPlay();
            for (let i = 0; i < groups.length; i++) {
                if (groups[i].type == constants.SOUNDTYPE.GROUP_LOOP) {
                    await this._playLoopGroup(groups[i], moodId);
                } else {
                    await this.playSound(groups[i], moodId);
                }
            }
        }
        //Hooks.call("SoundscapeAdventure-Soundpad-Render");
    }

    async deleteMood(moodId) {
        await this.stopMood(moodId);
        if (this.moods[moodId]) {
            delete this.moods[moodId];
            await this.syncRegionSoundscapes();
            await this.saveMoodsConfig();
            Hooks.callAll("SoundscapeAdventure-UpdateSidebar", "", "");
        }
    }

    /**
     * Synchronizes the regionSoundscapes setting with the current moods.
     * Removes entries for moods that no longer exist and adds/updates entries for current moods.
     */
    async syncRegionSoundscapes() {
        let soundscapes = await game.settings.get(`soundscape-adventure`, "regionSoundscapes");
        let hasChanges = false;

        // Remove entries for this soundscape's moods that no longer exist
        for (const key of Object.keys(soundscapes)) {
            if (key.startsWith(`${this.id}:`)) {
                const moodId = key.split(':')[1];
                if (!this.moods[moodId]) {
                    delete soundscapes[key];
                    hasChanges = true;
                }
            }
        }

        // Add/update entries for current moods
        for (const moodId in this.moods) {
            const regionKey = `${this.id}:${moodId}`;
            const value = `${this.name} -> ${this.moods[moodId].name}`;
            if (soundscapes[regionKey] !== value) {
                soundscapes[regionKey] = value;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await game.settings.set(`soundscape-adventure`, "regionSoundscapes", soundscapes);
        }
    }
    async stopMood(moodId) {
        console.warn("Stopping mood", moodId);

        this.moods[moodId].status = constants.STATUS.MOOD.STOP;
        if (this.activeMoodId == moodId) {
            this.activeMoodId = "";
        }
        const sounds = await this.moods[moodId].getSoundsToPlay();
        for (let i = 0; i < sounds.length; i++) {
            await this.stopSound(sounds[i], moodId, true);
        }
        const soundpadSounds = await this.moods[moodId].sounds.filter(obj => obj.type == constants.SOUNDTYPE.SOUNDPADUI);
        for (let i = 0; i < soundpadSounds.length; i++) {
            await this.stopSound(soundpadSounds[i], moodId, true);
        }

        const groups = await this.moods[moodId].getGroupsToPlay();
        for (let i = 0; i < groups.length; i++) {
            const soundGroup = await this.moods[moodId].getSound(groups[i].current)
            if (soundGroup) {
                console.warn("stopping group sound", soundGroup);
                await this.stopSound(soundGroup, moodId);
            }
        }

        this.randomSoundManager.stopAll();


    }
    async stopAll() {
        for (const key in this.moods) {
            this.stopMood(key);
        }
        this.isPlaying = false;
    }
    async saveMoodsConfig() {
        utils.log(utils.getCallerInfo(), `Saving moods for ${this.name} to ${this.path}`)
        let moodsCopy = JSON.parse(JSON.stringify(this.moods));

        // Sync regionSoundscapes setting with current moods
        await this.syncRegionSoundscapes();

        // Reset has_changes flag for all moods
        for (let mood in this.moods) {
            this.moods[mood].has_changes = false;
        }

        try {
            const finalJson = {
                id: this.id,
                name: this.name,
                created: this.created,
                description: this.description,
                playlistId: this.playlistId,
                version: 3,
                moods: moodsCopy
            }
            const parts = decodeURIComponent(this.path).split('/');
            const filename = parts.pop(); // "soundscape_01.json"
            const path = parts.join('/'); // "music"
            const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json' });
            const file = new File([blob], filename, { type: 'application/json' });
            await foundry.applications.apps.FilePicker.implementation.upload('data', path, file, {}, { notify: false })
        } catch (error) {
            utils.log(utils.getCallerInfo(), `Error saving moods for ${this.name}:`, constants.LOGLEVEL.ERROR, error);
        }
        const current_play = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (current_play.length == 2) {
            if (current_play[0] == this.id) {
                const moodId = current_play[1];
                const mood = this.moods[moodId];
                Hooks.callAll('SoundscapeAdventure-ChangeSoundVolume', this.id, moodId, mood)
            }
        }
    }

    /**
     * SOUND CONTROLS
     */

    /**
     * Facade methods - hide internal structure from external callers
     */

    /**
     * Get a sound configuration from a mood
     * @param {string} moodId - The mood ID
     * @param {string} soundId - The sound ID
     * @returns {SoundConfig|undefined}
     */
    getSound(moodId, soundId) {
        return this.moods[moodId]?.getSound(soundId);
    }

    /**
     * Get a group configuration from a mood
     * @param {string} moodId - The mood ID
     * @param {string} groupId - The group ID
     * @returns {GroupConfig|undefined}
     */
    getGroup(moodId, groupId) {
        return this.moods[moodId]?.getGroup(groupId);
    }

    /**
     * Get a sound from the playlist
     * @param {string} soundId - The sound ID
     * @returns {PlaylistSound|undefined}
     */
    getPlaylistSound(soundId) {
        return this.playlist?.sounds.get(soundId);
    }

    /**
     * Mark a mood as having unsaved changes
     * @param {string} moodId - The mood ID
     */
    markMoodAsChanged(moodId) {
        if (this.moods[moodId]) {
            this.moods[moodId].markAsChanged();
        }
    }

    /**
     * Check if a mood exists
     * @param {string} moodId - The mood ID
     * @returns {boolean}
     */
    hasMood(moodId) {
        return !!this.moods[moodId];
    }

    /**
     * Get a mood by ID
     * @param {string} moodId - The mood ID
     * @returns {MoodConfig|undefined}
     */
    getMood(moodId) {
        return this.moods[moodId];
    }

    async enableDisableSound(moodId, soundId) {
        const mood = this.moods[moodId];
        if (mood) {
            await mood.enableDisableSound(soundId);
        } else {
            ui.notifications.error("Mood Not found: " + moodId)
        }
    }

    async enableSound(moodId, soundId) {
        const mood = this.moods[moodId];
        if (mood) {
            if (!mood.isSoundOn(soundId)) {
                mood.enableSound(soundId);
                if (mood.isPlaying()) {
                    const s = mood.getSound(soundId);
                    if (s) {
                        this.playSound(s, moodId);
                    } else {
                        utils.log(utils.getCallerInfo(), `Sound ${soundId} not found in playlist`, constants.LOGLEVEL.ERROR);
                    }
                }
            }
            mood.has_changes = true;
        } else {
            utils.log(utils.getCallerInfo(), `Sound ${soundId} not found in mood ${moodId}`, constants.LOGLEVEL.ERROR);
        }
    }

    async changeSoundVolume(moodId, soundId, newVolume, soundType) {
        const mood = this.moods[moodId];
        if (!mood) {
            ui.notifications.error(`Cannot change volume for mood ${moodId}`);
            return;
        }

        // Get old volume before modification
        const existingConfig = mood.findById(soundId);
        if (!existingConfig) {
            ui.notifications.error(`Cannot change volume for sound ${soundId}`);
            return;
        }
        const oldVolume = existingConfig.volume;

        // Modify and get the updated config in one call (no redundant lookup)
        const soundConfig = mood.changeSoundVolume(soundId, newVolume);
        if (!soundConfig) return;

        // Update playlist sound
        const playlistSound = this.playlist.sounds.get(soundConfig.id);
        if (playlistSound) {
            await playlistSound.update({ volume: newVolume });
        }

        // Play/stop logic based on volume change
        if (mood.isPlaying()) {
            if (newVolume == 0) {
                this.stopSound(soundConfig, moodId);
            } else if (oldVolume == 0 && newVolume > 0 &&
                       soundConfig.type != constants.SOUNDTYPE.SOUNDPADUI &&
                       soundConfig.type != constants.SOUNDTYPE.SOUNDPAD) {
                this.playSound(soundConfig, moodId);
            }
        }

        Hooks.callAll('SoundscapeAdventure-ChangeSoundVolume', this.id, moodId, mood);
    }

    async stopSound(soundConfig, moodId, stop_mood = false) {
        const mood = this.moods[moodId];
        if (!mood) return;

        // Use the Strategy Pattern - get handler for this sound type
        const handler = getHandler(soundConfig.type);
        const context = {
            playlist: this.playlist,
            playlistId: this.playlistId,
            mood: mood,
            moodId: moodId,
            randomSoundManager: this.randomSoundManager
        };

        await handler.stop(soundConfig, context);
    }

    async _playSound(soundConfig, sound) {
        await sound.load();
        sound.update({ volume: soundConfig.volume });
        if (soundConfig.type === constants.SOUNDTYPE.GROUP_LOOP || soundConfig.type === constants.SOUNDTYPE.LOOP) {
            sound.update({ "repeat": true });
        } else {
            sound.update({ "repeat": false });
        }
        await this.playlist.playSound(sound);
        await new Promise(r => setTimeout(r, 0));
        if (soundConfig.fadeIn > 0) {
            sound.sound.fade(soundConfig.volume, { duration: soundConfig.fadeIn * 1000, from: 0 })
        }
    }

    async playSound(soundConfig, moodId) {
        const mood = this.moods[moodId];
        if (!mood) return;

        const isPlayingMood = mood.status === constants.STATUS.MOOD.PLAYING;
        const isSoundpad = soundConfig.type === constants.SOUNDTYPE.SOUNDPADUI;

        if (!isPlayingMood && isSoundpad) return;
        if (soundConfig.volume == 0) {
            ui.notifications.warn(`The Sound ${soundConfig.name} is muted. Change the volume before hitting play.`);
        }

        // Use the Strategy Pattern - get handler for this sound type
        const handler = getHandler(soundConfig.type);
        const context = {
            playlist: this.playlist,
            playlistId: this.playlistId,
            mood: mood,
            moodId: moodId,
            randomSoundManager: this.randomSoundManager,
            playFromGroup: this.playFromGroup.bind(this)
        };

        await handler.play(soundConfig, context);
    }

    async playFromGroup(groupId, moodId) {
        const soundGroup = await this.moods[moodId].groups.find(g => g.id == groupId);
        if (soundGroup.sounds.length > 0) {
            if (soundGroup.type == constants.SOUNDTYPE.GROUP_LOOP) {
                console.warn("Playing group loop from group", moodId);
                this._playLoopGroup(soundGroup, moodId);
            }
        }
    }

    async _playLoopGroup(groupConfig, moodId) {
        const stopSounds = await groupConfig.sounds.filter(el => el.id != groupConfig.current);
        const playlistSound = this.playlist.sounds.get(groupConfig.current);
        for (let i = 0; i < stopSounds.length; i++) {
            await this.playlist.stopSound({ id: stopSounds[i].id });
        }
        console.warn("Group from mood", moodId, groupConfig);
        const soundConfig = await this.moods[moodId].getSound(groupConfig.current);
        console.warn("Playing group loop sound", soundConfig);
        await this._playSound(soundConfig, playlistSound);
    }

    async changeSoundIntensity(moodId, groupId, value) {
        const mood = this.moods[moodId];
        if (!mood) return;

        // setIntensity now returns the group (no redundant lookup)
        const groupConfig = mood.setIntensity(groupId, value);

        if (mood.isPlaying() && groupConfig) {
            await this._playLoopGroup(groupConfig, moodId);
        }
    }

    async updateSoundIcon(moodId, soundId, newIcon) {
        this.moods[moodId].updateSoundIcon(soundId, newIcon);
    }

    async updateSoundName(soundId, newName) {
        const sound = await this.playlist.sounds.get(soundId);
        if (sound) {
            sound.update({ name: newName });
            for (let key in this.moods) {
                this.moods[key].updateSoundName(soundId, newName);
            }
        }
        await this.saveMoodsConfig();
    }

    async saveExtas(moodId, soundId, new_interval, new_fade, playOnce) {
        const soundConfig = await this.moods[moodId].getSound(soundId);

        this.moods[moodId].setFade(soundId, new_fade.fadeIn, new_fade.fadeOut);
        this.moods[moodId].setInterval(soundId, new_interval.from, new_interval.to);
        this.moods[moodId].setPlayOnce(soundId, playOnce);
    }
    //moveSound(data.soundId, data.moodId, event.target.dataset.dropZone, event.target.dataset?.dropZoneCategory)
    async moveSound(soundId, moodId, target, category = 0) {
        const sounds = [];
        const sound = await this.moods[moodId].getSound(soundId);
        let isGroup = false;
        if (sound?.group != "") {
            sounds.push(...this.moods[moodId].getSoundByGroup(sound.group));
            isGroup = true;
        } else {
            sounds.push(sound);
        }
        if (target.toLowerCase() == constants.SOUNDTYPE.RANDOM) {
            for (let i = 0; i < sounds.length; i++) {
                const s = this.playlist.sounds.get(sounds[i].id);
                if (s) {
                    s.update({ repeat: false });
                }
                if (sound.type == constants.SOUNDTYPE.SOUNDPADUI && s.playing) {
                    this.playlist.stopSound(s);
                }
                sounds[i].repeat = false;
                sounds[i].type = isGroup ? constants.SOUNDTYPE.GROUP_RANDOM : constants.SOUNDTYPE.RANDOM;
                sounds[i].category = category ? category : "";
            }
        } else if (target.toLowerCase() == constants.SOUNDTYPE.LOOP) {
            for (let i = 0; i < sounds.length; i++) {
                const s = this.playlist.sounds.get(sounds[i].id);
                if (s) {
                    s.update({ repeat: true });
                }
                if (sound.type == constants.SOUNDTYPE.SOUNDPADUI && s.playing) {
                    this.playlist.stopSound(s);
                }
                sounds[i].repeat = true;
                sounds[i].type = isGroup ? constants.SOUNDTYPE.GROUP_LOOP : constants.SOUNDTYPE.LOOP;
                sounds[i].category = category ? category : "";
            }
        } else if (target.toLowerCase() == constants.SOUNDTYPE.SOUNDPAD) {
            for (let i = 0; i < sounds.length; i++) {
                const s = this.playlist.sounds.get(sounds[i].id);
                if (sound.type == constants.SOUNDTYPE.SOUNDPADUI && s.playing) {
                    this.playlist.stopSound(s);
                }
                if (s) {
                    s.update({ repeat: false });
                }
                sounds[i].repeat = false;
                sounds[i].type = isGroup ? constants.SOUNDTYPE.GROUP_SOUNDPAD : constants.SOUNDTYPE.SOUNDPAD;
                sounds[i].category = category ? category : "";
            }
        } else if (target.toLowerCase() == constants.SOUNDTYPE.SOUNDPADUI) {
            for (let i = 0; i < sounds.length; i++) {
                if (isGroup) {
                    ui.notifications.warn(`You cannot move a group of sounds to the Soundpad UI. Please move them individually.`);
                    return;
                }
                const s = this.playlist.sounds.get(sounds[i].id);
                if (s) {
                    s.update({ repeat: false });
                    this.playlist.stopSound(s);
                }
                if (sounds[i].type == constants.SOUNDTYPE.RANDOM || sounds[i].type == constants.SOUNDTYPE.GROUP_RANDOM) {
                    this.randomSoundManager.stop(this.playlistId, sounds[i].id);
                }
                sounds[i].repeat = false;
                sounds[i].type = constants.SOUNDTYPE.SOUNDPADUI;
                sounds[i].category = "";
            }
        }
    }

    async removeSoundFromGroup(moodId, soundId, groupId) {
        await this.moods[moodId].removeSoundFromGroup(soundId, groupId);
        // const sound = this.moods[moodId].getSound(soundId);
        // if (sound) {
        //     sound.group = "";
        //     if (sound.type == constants.SOUNDTYPE.GROUP_RANDOM) {
        //         sound.type = constants.SOUNDTYPE.RANDOM;
        //     } else if (sound.type == constants.SOUNDTYPE.GROUP_LOOP) {
        //         sound.type = constants.SOUNDTYPE.LOOP;
        //     }
        //     await this.saveMoodsConfig();
        // }
    }

    async addSoundToNewGroup(moodId, soundId, groupName) {
        await this.moods[moodId].createGroup(groupName, soundId);
        return;
    }

    async addSoundToGroup(moodId, soundId, groupId) {
        const sound = await this.moods[moodId].getSound(soundId);
        const group = await this.moods[moodId].getGroup(groupId);

        if (!sound || !group) {
            ui.notifications.error(`Cannot add sound to group ${groupId}. Sound or Group not found.`);
            return;
        }
        // if we add a random sound to a group and that sound is playing we need to stop it.
        if (sound.type == constants.SOUNDTYPE.RANDOM && sound.status == constants.STATUS.SOUND.ON) {
            this.randomSoundManager.stop(this.playlistId, sound.id);
        }
        // if the group we are adding the new sound is playing, we have to stop, add the sound and restart it.
        if (group.status == constants.STATUS.SOUND.ON && group.type == constants.SOUNDTYPE.GROUP_RANDOM) {
            const grupoofsounds = await group.sounds.map(sound => sound.id);
            this.randomSoundManager.stop(this.playlistId, grupoofsounds);
        }
        // await this.moods[moodId].addSoundToGroup(soundId, groupId);
         group.addSound({ id: sound.id, name: sound.name });
         sound.group = group.id;
         this.moods[moodId].has_changes = true;
        // restart  the group random
        if (group.status == constants.STATUS.SOUND.ON && group.type == constants.SOUNDTYPE.GROUP_RANDOM && this.moods[moodId].status == constants.STATUS.MOOD.PLAYING) {
            const groupOfSounds = group.sounds.map(sound => sound.id);
            this.randomSoundManager.start(
                this.playlistId,
                groupOfSounds,
                group.random.from,
                group.random.to,
                group.volume,
                group.playOnce);
        }
    }

    /**
     * TRIGGER
     */

    async playCombatTriggerEvent(event) {
        for (let key in this.moods) {
            this.playCustomTriggerEvent(event, key);
        }
    }
    async playCustomTriggerEvent(event, moodId) {

        const triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
        const moodTriggers = triggerSettings[moodId];
        let groups = [];

        if (moodTriggers) {
            for (let soundId in moodTriggers) {
                if (soundId == "mood") {
                    const triggers = moodTriggers[soundId];
                    for (let i = 0; i < triggers.length; i++) {
                        if (triggers[i].on == event.region.id && triggers[i].event == event.name) {
                            if (triggers[i].action == "play") {
                                this.playMood(moodId, true);
                            } else if (triggers[i].action == "stop") {
                                this.stopMood(moodId);
                            }
                        }
                    }

                } else {
                    if (this.moods[moodId].status != constants.STATUS.MOOD.PLAYING) continue;
                    const soundConfig = await this.moods[moodId].getSound(soundId);
                    //const triggerConfig = moodTriggers[soundId];
                    const triggers = moodTriggers[soundId];
                    for (let i = 0; i < triggers.length; i++) {
                        if (triggers[i].on == event.region.id && triggers[i].event == event.name) {
                            if (triggers[i].action == "play") {
                                this.playSound(soundConfig, moodId);
                            } else if (triggers[i].action == "stop") {
                                this.stopSound(soundConfig, moodId);
                            }
                        }
                    }
                }
            }
        }
    }
    async saveTrigger(moodId, soundId, triggers) {
        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
        if (!triggerSettings[moodId]) {
            triggerSettings[moodId] = {};
        }
        if (soundId == "mood") {
            triggerSettings[moodId]["mood"] = triggers;
        } else {
            const soundConfig = await this.moods[moodId].getSound(soundId);
            triggerSettings[moodId][soundId] = triggers
            if (soundConfig.group != "") {
                const sounds = this.moods[moodId].getSoundByGroup(soundConfig.group);
                for (let i = 0; i < sounds.length; i++) {
                    triggerSettings[moodId][sounds[i].id] = triggers;
                }
            }
        }
        game.settings.set(constants.STORAGETRIGGERSETTINGS, "triggerSettings", triggerSettings);
    }

    async removeAllTriggers(moodId) {
        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");

        if (triggerSettings[moodId]) {
            const tr = triggerSettings[moodId];
            for (let key in triggerSettings[moodId]) {
                delete triggerSettings[moodId][key];
            }
            game.settings.set(constants.STORAGETRIGGERSETTINGS, "triggerSettings", triggerSettings);
        }
    }

    async cloneMood(moodId, newName) {
        utils.log(utils.getCallerInfo(), `Cloning mood ${moodId} to ${newName}`);
        const mood = this.moods[moodId];
        if (mood) {
            const newMood = new MoodConfig(mood.toJSON(), this.playlist, "stop");
            //await newMood.consistence(this.playlist);
            newMood.name = newName;
            newMood.id = foundry.utils.randomID(16);
            this.moods[newMood.id] = newMood;
            this.saveMoodsConfig();
            Hooks.callAll("SoundscapeAdventure-UpdateSidebar", "", newMood);
            return newMood;
        } else {
            utils.log(utils.getCallerInfo(), `Mood ${moodId} not found`, constants.LOGLEVEL.ERROR);
        }
    }

    render(current_playing) {
        const directoryItem = document.createElement('li');
        directoryItem.className = 'directory-item document playlist flexrow';
        directoryItem.dataset.entryId = this.id;
        directoryItem.dataset.documentId = this.id;
        directoryItem.style.display = 'flex';
        // Create the header element
        const header = document.createElement('header');
        header.className = 'playlist-header flexrow';
        header.style.width = '100%';

        // Create the title h4 element
        const title = document.createElement('h4');
        title.className = 'entry-name playlist-name';
        title.draggable = true;
        title.style.color = 'var(--color-text-emphatic)';
        title.style.flex = '3';

        // // Create the collapse icon
        const playlistSounds = document.createElement('ol');
        const collapseIcon = document.createElement('i');
        collapseIcon.className = 'collapse fa fa-angle-down';
        collapseIcon.addEventListener('click', (ev) => {
            playlistSounds.classList.toggle("hidden");
            if (collapseIcon.className.includes("down")) {
                collapseIcon.className = 'collapse fa fa-angle-up';
            } else {
                collapseIcon.className = 'collapse fa fa-angle-down';
            }
        });

        // // Add the collapse icon and text to the title
        title.appendChild(collapseIcon);
        title.appendChild(document.createTextNode(` ${this.name}`));

        // Create the controls div
        const controls = document.createElement('div');
        controls.className = 'playlist-controls flexrow';
        controls.style.textAlign = 'center';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'center';
        controls.style.gap = '5px';

        // Create the speaker control
        const speakerControl = document.createElement('a');
        speakerControl.className = 'soundboard-control fa-solid fa-speaker';
        speakerControl.style.fontSize = 'medium';
        speakerControl.dataset.action = 'soundscape-open';
        speakerControl.dataset.tooltip = 'Open Soundscape';
        speakerControl.dataset.soundboardId = this.id;

        // Create the reload control
        const reloadControl = document.createElement('a');
        reloadControl.className = 'soundboard-control fa-solid fa-rotate-right';
        reloadControl.style.fontSize = 'medium';
        reloadControl.dataset.action = 'soundscape-reload';
        reloadControl.dataset.tooltip = 'Reload Soundscape';
        reloadControl.dataset.soundboardId = this.id;

        // Create the delete control
        const deleteControl = document.createElement('a');
        deleteControl.className = 'soundboard-control fa-solid fa-trash';
        deleteControl.style.fontSize = 'medium';
        deleteControl.dataset.action = 'soundscape-remove';
        deleteControl.dataset.tooltip = 'Delete Soundscape';
        deleteControl.dataset.soundboardId = this.id;

        // Add the controls to the controls div
        controls.appendChild(speakerControl);
        controls.appendChild(reloadControl);
        controls.appendChild(deleteControl);

        // Add the title and controls to the header
        header.appendChild(title);
        header.appendChild(controls);

        // Create the playlist sounds list
        playlistSounds.className = 'playlist-sounds';
        playlistSounds.style.textAlign = 'left';
        playlistSounds.style.width = '100%';

        // order moods by name
        const orderedMoods = Object.values(this.moods).sort((a, b) => a.name.localeCompare(b.name));

        for (const key in orderedMoods) {
            playlistSounds.appendChild(orderedMoods[key].render(this.id, current_playing));
        }
        directoryItem.appendChild(header);
        directoryItem.appendChild(playlistSounds);
        return directoryItem;
    }

    async dialogCloneMood() {
        const moods = Object.values(this.moods);
        const options = moods.map(mood => `<option value="${mood.id}">${mood.name}</option>`).join('')
        let newMood = [];
        try {
            newMood = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Select a name for the new mood" },
                content: `<select id="originalmood" name="originalmood" class="form-control">
                ${options}
            </select>
              <input id="moodname" name="moodname" value="" placeholder="Mood name">`,
                ok: {
                    label: "Clone Mood",
                    callback: (event, button, dialog) => [button.form.elements.moodname.value, button.form.elements.originalmood.value]
                }
            });
        } catch {
            return;
        }
        if (newMood.length < 2) {
            ui.notifications.warn("Error cloning a mood.");
            return;
        } else {

            if (newMood[0].trim() == "") {
                ui.notifications.warn("You must provide a name for the new mood.");
            } else {
                await this.cloneMood(newMood[1], newMood[0]);
            }
        }

    }

    async dialogNewMood() {
        let newMoodName = "";
        try {
            newMoodName = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Select a name for the new mood" },
                content: `<input id="moodname" name="moodname" value="" placeholder="Mood name" autofocus>`,
                ok: {
                    label: "New Mood",
                    callback: (event, button, dialog) => button.form.elements.moodname.value
                }
            });
        } catch {
            return;
        }
        if (newMoodName.trim() === "") {
            ui.notifications.warn("You must provide a name for the new mood.");
            return;
        } else {
            await this.newMood(newMoodName);
        }
    }

    async dialogDeleteMood(moodId) {
        const name = this.moods[moodId].name;
        const response = await foundry.applications.api.DialogV2.confirm({
            content: `Are you sure you want to delete the mood ${name}?`,
            rejectClose: false,
            modal: true
        });

        if (response) {
            await this.deleteMood(moodId);
            return true;
        }
        return false;
    }

    async createCategory(moodId, type, categoryName) {

        const id = foundry.utils.randomID(16);
        this.moods[moodId].categories.push({ id: id, name: categoryName, type: type, collapsed: false });
        return id;
    }

    async renameCategory(moodId, categoryId, newCategoryName) {
        const index = this.moods[moodId].categories.findIndex(el => el.id == categoryId);
        if (index) {
            this.moods[moodId].categories[index].name = newCategoryName;
        }
        this.moods[moodId].has_changes = true;
    }

    async playStopCategory(moodId, categoryId, action) {
        if (this.moods[moodId].isPlaying()) {
            const category = this.moods[moodId].categories.find(el => el.id == categoryId);
            const all_categories_same_name = this.moods[moodId].categories.filter(el => el.name == category.name);
            for (const cat of all_categories_same_name) {
                const sounds = await this.moods[moodId].getSoundByCategory(cat.id, true);
                if (action == "stop") {
                    for (const sound of sounds) {
                        await this.stopSound(sound, moodId, false);
                    }
                } else {
                    for (const sound of sounds) {
                        await this.playSound(sound, moodId);
                    }
                }
            }
        } else {
            ui.notifications.warn("Mood is currently stop")
        }
    }

    async enableSoundsinCategory(moodId, categoryId) {
        const sounds = await this.moods[moodId].getSoundByCategory(categoryId, false);
        for (const sound of sounds) {
            await this.enableSound(moodId, sound.id);
        }
    }

    async deleteCategory(moodId, categoryId) {
        const sounds = await this.moods[moodId].getSoundByCategory(categoryId, false);
        for (const sound of sounds) {
            sound.category = "";
        }
        const index = this.moods[moodId].categories.findIndex(el => el.id == categoryId);

        if (index > 0) {
            this.moods[moodId].categories.splice(index, 1);
        }

        this.moods[moodId].has_changes = true;
    }

    //the following functions are used by external modules
    getMoods() {
        return Object.values(this.moods).map(obj => obj.name);
    }
    async playStopMoodByName(moodName, force = false) {
        const mood = Object.values(this.moods).find(m => m.name.toLowerCase() == moodName.toLowerCase());
        if (mood) {
            this.playStopMood(mood.id, force);
        } else {
            ui.notifications.warn(`Mood ${moodName} not found in Soundscape ${this.name}`);
        }
    }
    // read all ogg, mp3, wav files from a folder and add them to a list of paths to include in the playlist
    async addSoundsToPlaylist(folderPath, loadSubfolders) {
        console.log("Adding sounds from folder", folderPath, "Subfolders:", loadSubfolders);
        const paths = [];
        const browseOptions = { recursive: loadSubfolders };
        const filePickerResult = await foundry.applications.apps.FilePicker.browse('data', folderPath, browseOptions);

        const soundFileRegex = /\.(mp3|ogg|wav)$/i;
        for (const file of filePickerResult.files) {
            console.log("Found file:", file);
            if (soundFileRegex.test(file)) {
                paths.push(file);
            }
        }
        if (paths.length > 0)
            await this.playlist.bulkImportSounds(paths);
        const dirs = filePickerResult.dirs;
        if (loadSubfolders && dirs.length > 0) {
            for (const dir of dirs) {
                const subfolderPaths = await this.addSoundsToPlaylist(dir, loadSubfolders);
            }
        }
    }

    async toggleCategoryCollapsed(moodId, categoryId) {
        this.moods[moodId].toggleCategoryCollapsed(categoryId);
    }
}