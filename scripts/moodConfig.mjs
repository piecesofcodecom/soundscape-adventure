import { GroupConfig } from "./groupConfig.mjs";
import constants from "./utils/constants.mjs";
import utils from "./utils/utils.mjs";
class SoundConfig {

    constructor(obj) {
        this.id = obj.id;
        this._id = obj._id;
        this.status = obj.status;
        this.group = obj.group;
        this.name = obj.name;
        this.description = obj.description;
        this.path = obj.path;
        this.repeat = obj.repeat;
        this.volume = obj.volume;
        this.type = obj.type
        this.group = obj.group
        this.intensity = obj.intensity
        this.to = Object.hasOwn(obj, 'to') ? obj.to : 60,
            this.from = Object.hasOwn(obj, 'from') ? obj.from : 10,
            this.fadeIn = Object.hasOwn(obj, 'fadeIn') ? obj.fadeIn : 0,
            this.fadeOut = Object.hasOwn(obj, 'fadeOut') ? obj.fadeOut : 0,
            this.playOnce = Object.hasOwn(obj, 'playOnce') ? obj.playOnce : false
        this.category = Object.hasOwn(obj, 'category') ? obj.category : ""
        this.soundIcon = Object.hasOwn(obj, 'soundIcon') ? obj.soundIcon : "";
    }
}


export default class MoodConfig {
    id;
    name;
    status;
    sounds;
    groups = [];
    categories = [];
    has_changes = false;

    constructor(moodConfig, playlist, _status = "stop") {
        utils.log(utils.getCallerInfo(), `MoodConfig:`, constants.LOGLEVEL.INFO);
        this.id = moodConfig.id;
        this.name = moodConfig.name;
        this.status = moodConfig.status;
        this.sounds = moodConfig.sounds;
        this.categories = moodConfig?.categories ? moodConfig.categories : [];
        const soundpadui = this.categories.filter(el => el.type == constants.SOUNDTYPE.SOUNDPADUI);
        if (soundpadui.length == 0) {
            this.categories.push({ id: "", name: "None", type: constants.SOUNDTYPE.SOUNDPADUI, collapsed: false, sounds: [] })
        }
        if (moodConfig?.groups.length > 0) {
            for (let i = 0; i < moodConfig.groups.length; i++) {
                this.groups.push(new GroupConfig(moodConfig.groups[i]))
            }
        }
    }

    async registerSound(sound, playlist) {
        await playlist.createEmbeddedDocuments("PlaylistSound", [{
            id: sound.id,
            name: sound.name,
            path: sound.path,
            repeat: sound.repeat,
            volume: sound.volume,
        }]);
        const finalSound = await playlist.sounds.find(el => el.path == sound.path);
        return finalSound.id;
    }

    render(id, current_playing) {
        const moodRender = document.createElement('li');
        moodRender.id = this.name;
        moodRender.className = 'playlist-mood flexrow';
        moodRender.dataset.soundboardId = id;
        moodRender.dataset.moodId = this.id;
        moodRender.style.display = 'flex';

        // Create the strong text for Peaceful Day
        const moodRenderText = document.createElement('strong');
        moodRenderText.textContent = this.name;

        // Create sound controls for Peaceful Day
        const moodRenderControls = document.createElement('div');
        moodRenderControls.className = 'mood-controls flexrow';
        moodRenderControls.dataset.soundscapeId = id;
        moodRenderControls.dataset.moodId = this.id;
        moodRenderControls.style.textAlign = 'right';
        moodRenderControls.style.maxWidth = '50px';

        // Create delete control for Peaceful Day
        const moodRenderDeleteControl = document.createElement('a');
        moodRenderDeleteControl.className = 'soundscape-tab-button mood-control fa-solid fa-trash';
        moodRenderDeleteControl.dataset.action = 'deleteMood';
        moodRenderDeleteControl.dataset.tooltip = 'Delete Mood';
        moodRenderDeleteControl.dataset.soundscapeId = id;
        moodRenderDeleteControl.dataset.moodId = this.id;

        // Create play control for Peaceful Day
        const moodRenderPlayControl = document.createElement('a');
        if (this.status == "playing") {
            moodRenderPlayControl.className = 'soundscape-tab-button mood-control fas fa-stop item-active';
        } else {
            moodRenderPlayControl.className = 'soundscape-tab-button mood-control fas fa-play';
        }
        moodRenderPlayControl.dataset.action = 'playStopMood';
        moodRenderPlayControl.dataset.tooltip = 'Play Mood';
        moodRenderPlayControl.dataset.soundboardId = id;
        moodRenderPlayControl.dataset.moodId = this.id;

        // Add controls to Peaceful Day
        moodRenderControls.appendChild(moodRenderDeleteControl);
        moodRenderControls.appendChild(moodRenderPlayControl);
        moodRender.appendChild(moodRenderText);
        moodRender.appendChild(moodRenderControls);
        return moodRender;

    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            categories: this.categories,
            groups: this.groups,
            sounds: this.sounds
        }
    }

    // validate files for sounds in the mood exist
    //TODO include the consistence for groups
    async consistence(playlist) {
        // validates if all sounds in the mood are in the playlist
        for (let i = 0; i < this.sounds.length; i++) {
            const playlistsound = playlist.sounds.find(el => el.path == this.sounds[i].path);
            if (!playlistsound) {
                this.has_changes = true;
                const response = await fetch(this.sounds[i].path, { method: 'HEAD' });
                if (!response.ok) {
                    // Log or notify about the missing file, but do not stop execution
                    ui.notifications.warn(`Sound not found ${this.sounds[i].path}. Removing from the soundscape.`);
                    this.removeSoundFromAllGroups(this.sounds[i].id);
                    this.sounds.splice(i, 1);
                    //TODO check if sound id is in a group and remove it
                } else {
                    // Only load if the file was found
                    const old_id = this.sounds[i].id;
                    this.sounds[i].id = await this.registerSound(this.sounds[i], playlist);
                    this.updateGroupSoundId(old_id, this.sounds[i].id);
                    utils.log(utils.getCallerInfo(), `Had to register a new audio: ${this.sounds[i].path}`, constants.LOGLEVEL.INFO);
                }
            } else {
                //check file still exists
                try {
                    const response = await fetch(playlistsound.path, { method: 'HEAD' });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const old_id = this.sounds[i].id;
                    this.sounds[i].id = playlistsound.id;
                    this.updateGroupSoundId(old_id, this.sounds[i].id);
                } catch (err) {
                    ui.notifications.warn(`Sound not found ${this.sounds[i].path}. Removing from the soundscape.`);
                    this.removeSoundFromAllGroups(this.sounds[i].id);
                    this.sounds.splice(i, 1);
                    await playlist.deleteEmbeddedDocuments("PlaylistSound", [playlistsound.id]);
                    this.has_changes = true;
                }
            }
        }

        // validates if all sounds in the playlist are in the mood
        const plSounds = Array.from(playlist.sounds)
        for (let i = 0; i < plSounds.length; i++) {
            const sound = this.sounds.find(el => el.path == plSounds[i].path);
            if (!sound) {
                this.sounds.push(new SoundConfig({
                    id: plSounds[i].id,
                    _id: plSounds[i].id,
                    status: "off",
                    group: "",
                    name: plSounds[i].name,
                    description: "",
                    path: plSounds[i].path,
                    repeat: false,
                    volume: "0.0",
                    type: constants.SOUNDTYPE.SOUNDPAD,
                    intensity: "",
                    to: 0,
                    from: 0,
                    fadeIn: 0,
                    fadeOut: 0,
                    playOnce: false,
                    category: ""
                }));
            }
        }
        return;
    }

    async validateFileExists(filePath) {
        const directory = filePath.substring(0, filePath.lastIndexOf('/'));
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

        try {
            const result = await foundry.applications.apps.FilePicker.browse("data", directory);

            if (result.files.includes(filePath)) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    updateGroupSoundId(oldId, newId) {
        for (let i = 0; i < this.groups.length; i++) {
            const soundInGroup = this.groups[i].sounds.find(el => el.id == oldId);
            if (soundInGroup) {
                soundInGroup.id = newId;
            }
            if (this.groups[i].current == oldId) {
                this.groups[i].current = newId;
            }
        }
    }

    async removeSoundFromAllGroups(soundId) {
        for (let i = 0; i < this.groups.length; i++) {
            await this.groups[i].removeSound(soundId);
        }
    }

    // adds to the playlist custom sounds
    // sounds that aren't part of the folder
    async updatePlaylist(playlist) {
        utils.log("Not implemented yet", constants.LOGLEVEL.INFO);
    }

    isSoundOn(soundId) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        if (sound) {
            return sound.status == "on";
        }
        const group = this.groups.find(obj => obj.id == soundId);
        if (group) {
            return group.status == "on";
        }
        return false;
    }

    disableSound(_id) {
        const sound = this.sounds.find(obj => obj.id == _id);
        if (sound) {
            if (sound.group != "") {
                this.disableSoundByGroup(sound.group);
            } else {
                sound.status = "off";
            }
        }
    }

    enableSound(_id) {
        const sound = this.sounds.find(obj => obj.id == _id);
        if (sound) {
            if (sound.group != "") {
                this.enableSoundByGroup(sound.group);
            } else {
                sound.status = "on";
            }
        } else {
            const group = this.groups.find(obj => obj.id == _id);
            if (group) {
                this.enableSoundByGroup(_id);
            }
        }
    }

    getEnabledSounds() {
        const s = this.sounds.filter(obj => obj.status == "on");
        return s;
    }
    enableDisableSound(soundId, status) {
        const sound = this.sounds.find(s => s.id == soundId);
        if (sound) {
            sound.status = status;
            this.has_changes = true;
        } else {
            const group = this.groups.find(g => g.id == soundId);
            if (group) {
                group.status = status;
                this.has_changes = true;
            }
        }
    }

    getSoundsToPlay() {
        return this.sounds.filter(obj => obj.status == "on" && (obj.type == constants.SOUNDTYPE.LOOP || obj.type == constants.SOUNDTYPE.RANDOM));
    }

    getGroupsToPlay() {
        return this.groups.filter(obj => obj.status == "on");
    }

    getSoundByCategory(category, enable_sounds = false) {
        if (enable_sounds) {
            const sounds = structuredClone(this.sounds.filter(obj => obj.status == "on" && obj.category == category));
            const group_sounds = structuredClone(this.groups.filter(obj => obj.status == "on" && obj.category == category));
            return [...sounds, ...group_sounds];
        }
        return this.sounds.filter(obj => obj.category == category);
    }

    getSound(soundId) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        if (sound) { return sound; }
        const group = this.groups.find(obj => obj.id == soundId);
        if (group) {
            return this.sounds.find(obj => obj.id == group.current);
        }
        return undefined;
    }
    getSoundByGroup(groupId) {
        return this.sounds.filter(obj => obj.group == groupId);
    }
    getGroup(groupId) {
        return this.groups.find(obj => obj.id == groupId);
    }
    // TODO CHANGE IT
    enableSoundByGroup(groupId) {
        const group = this.groups.find(obj => obj.id == groupId);
        if (group) {
            group.enableSound(true);
        } else {
            ui.notifications.error(`enableSoundByGroup: Group ${groupId} not found!`);
        }
    }
    // TODO CHANGE IT
    disableSoundByGroup(group) {
        const sounds = this.sounds.filter(obj => obj.group == group);
        for (let i = 0; i < sounds.length; i++) {
            sounds[i].status = "off";
        }

    }

    changeSoundVolume(soundId, volume) {
        let sound = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (sound) {
            sound.volume = volume;
            sound.status = volume == 0 ? 'off' : 'on';
        } else {
            sound = this.groups.find(obj => obj.id == soundId);
            if (sound) {
                sound.setVolume(volume);
                sound.enableSound(volume == 0 ? false : true);
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].volume = volume;
                }
            }
        }
        if (!sound) {
            ui.notifications.error("Sound not found " + soundId);
            return;
        }
        this.has_changes = true;
    }

    updateSoundName(soundId, newName) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        sound.name = newName;
    }

    updateSoundIcon(soundId, newIcon) {
        let sound = this.sounds.find(obj => obj.id == soundId);
        if (!sound) {
            sound = this.groups.find(obj => obj.id == soundId);
        }
        if (sound) {
            sound.soundIcon = newIcon;
            this.has_changes = true;
        } else {
            ui.notifications.error("updateSoundIcon: Sound not found")
        }
    }

    isPlaying() {
        return this.status == "playing";
    }

    // convert a group from soundscape v2 to v3 field active_groups(array)
    // to the field groups that is an array of objects of type GroupConfig
    async migrate_from_v2_to_v3(active_groups) {
        let new_groups = [];
        ui.notifications.info("Migrating groups");
        for (let i = 0; i < this.sounds.length; i++) {
            if (this.sounds[i].hasOwnProperty('group')) {
                if (this.sounds[i].group !== '') {
                    const group = await new_groups.find(el => el.name == this.sounds[i].group);
                    if (group) {
                        group.addSound({ id: this.sounds[i].id, name: this.sounds[i].name });
                        this.sounds[i].group = group.id;
                    } else {
                        let group_type = constants.SOUNDTYPE.GROUP_LOOP;
                        if (sound.type == constants.SOUNDTYPE.RANDOM) {
                            group_type = constants.SOUNDTYPE.GROUP_RANDOM;
                        }
                        const new_group = new GroupConfig({
                            id: foundry.utils.randomID(16),
                            name: this.sounds[i].group,
                            sounds: [{ id: this.sounds[i].id, name: this.sounds[i].name }],
                            intensity: this.sounds[i].intensity,
                            current: '',
                            status: this.sounds[i].status,
                            volume: this.sounds[i].volume,
                            type: group_type,
                            category: this.sounds[i].category,
                            soundIcon: 'icons/svg/sound.svg',
                            fadeIn: this.sounds[i].fadeIn,
                            fadeOut: this.sounds[i].fadeOut,
                            random: {
                                from: this.sounds[i].from,
                                to: this.sounds[i].to,
                            }
                        });
                        new_groups.push(new_group);
                        this.sounds[i].group = new_group.id;
                    }
                }
            }
        }
        ui.notifications.info("Validating migration of groups: " + active_groups.join(","));
        for (let i = 0; i < active_groups.lenth; i++) {
            const groupname = new_groups.find(el => el.name === active_groups[i]);
            if (!groupname) {
                ui.notifications.error("Failed to migrate group: " + active_groups[i]);
            } else {
                ui.notifications.info("Group migrated " + active_groups[i])
            }
        }
        ui.notifications.info("Groups migration finished");
        this.groups = structuredClone(new_groups);
    }

    createGroup(newGroupName, soundId) {
        const sound = this.sounds.find(e => e.id == soundId);
        const group_exists = this.groups.find(el => el.name == newGroupName);
        const _id = foundry.utils.randomID(16);
        let group_type = constants.SOUNDTYPE.GROUP_LOOP;
        if (sound.type == constants.SOUNDTYPE.RANDOM) {
            group_type = constants.SOUNDTYPE.GROUP_RANDOM;
        }

        if (!group_exists && sound) {
            this.groups.push(new GroupConfig({
                id: _id,
                name: newGroupName,
                sounds: [{ id: sound.id, name: sound.name }],
                intensity: 0.0,
                current: sound.id,
                status: sound.status,
                volume: sound.volume,
                type: group_type,
                category: sound.category,
                soundIcon: 'icons/svg/sound.svg',
                fadeIn: sound.fadeIn,
                fadeOut: sound.fadeOut,
                random: {
                    from: sound.from,
                    to: sound.to,
                }
            }))
            sound.group = _id;
            this.has_changes = true;
        } if (group_exists && group_exists?.type != sound.type) {
            this.groups.push(new GroupConfig({
                id: _id,
                name: newGroupName,
                sounds: [{ id: sound.id, name: sound.name }],
                intensity: 0.0,
                current: sound.id,
                status: sound.status,
                volume: sound.volume,
                type: group_type,
                category: sound.category,
                soundIcon: 'icons/svg/sound.svg',
                fadeIn: sound.fadeIn,
                fadeOut: sound.fadeOut,
                random: {
                    from: sound.from,
                    to: sound.to,
                }
            }));
            sound.group = _id;
            this.has_changes = true;
        } else {
            if (!sound) ui.notifications.error("Cannot create group: Sound not found");
            if (group_exists) ui.notifications.warn("Group Already Exists");
        }
    }

    addSoundToGroup(soundId, groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) {
            ui.notifications.error("Group not found");
            return;
        }
        const sound = this.sounds.find(s => s.id === soundId);

        if (!sound) {
            ui.notifications.error("Sound not found");
            return;
        }

        group.addSound({ id: sound.id, name: sound.name });
        sound.volume = group.volume;
        sound.group = group.id;
        this.has_changes = true;
    }
    removeSoundFromGroup(soundId, groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) {
            ui.notifications.error("Group not found");
            return;
        }
        const sound = this.sounds.find(s => s.id === soundId);

        if (!sound) {
            ui.notifications.error("Sound not found");
            return;
        }
        group.removeSound(sound.id);
        sound.group = "";
        sound.volume = 0.0;
        if (group.sounds.length == 0) {
            this.removeGroup(groupId);
        }
        this.has_changes = true;
    }

    removeGroup(groupId) {
        const index = this.groups.findIndex(el => el.id === groupId);
        if (index >= 0) {
            this.groups.splice(index, 1);
        } else {
            ui.notifications.error("Group not found");
            return;
        }
        this.has_changes = true;
    }

    setIntensity(groupId, value) {
        const group = this.groups.find(g => g.id === groupId);
        group.setIntensity(value);
        this.has_changes = true;
    }

    applyGroupConfigToSound(groupId, soundId) {
        this.sounds;

    }

    setFade(soundId, fadeIn, fadeOut) {
        let sound = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (sound) {
            sound.fadeIn = fadeIn;
            sound.fadeOut = fadeOut;
        } else {
            sound = this.groups.find(obj => obj.id == soundId);
            if (sound) {
                sound.fadeIn = fadeIn;
                sound.fadeOut = fadeOut;
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].fadeIn = fadeIn;
                    gsounds[i].fadeOut = fadeOut;
                }
            }
        }
        if (!sound) {
            ui.notifications.error("Sound not found " + soundId);
            return;
        }
        this.has_changes = true;
    }

    setInterval(soundId, from, to) {
        let sound = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (sound) {
            sound.from = from;
            sound.to = to;
        } else {
            sound = this.groups.find(obj => obj.id == soundId);
            if (sound) {
                sound.random.from = from;
                sound.random.to = to;
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].from = from;
                    gsounds[i].to = to;
                }
            }
        }
        if (!sound) {
            ui.notifications.error("Sound not found " + soundId);
            return;
        }
        this.has_changes = true;
    }

    setPlayOnce(soundId, playOnce) {
        let sound = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (sound) {
            sound.playOnce = playOnce;
        } else {
            sound = this.groups.find(obj => obj.id == soundId);
            if (sound) {
                sound.playOnce = playOnce;
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].playOnce = playOnce;
                }
            }
        }
        if (!sound) {
            ui.notifications.error("Sound not found " + soundId);
            return;
        }
        this.has_changes = true;
    }
}

