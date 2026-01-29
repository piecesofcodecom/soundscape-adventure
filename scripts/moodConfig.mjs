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
        this.groups = [];
        const soundpadui = this.categories.filter(el => el.type == constants.SOUNDTYPE.SOUNDPADUI);
        if (soundpadui.length == 0) {
            this.categories.push({ id: "", name: "None", type: constants.SOUNDTYPE.SOUNDPADUI, collapsed: false, sounds: [] })
        }
        if (moodConfig?.groups?.length > 0) {
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
        if (this.status == constants.STATUS.MOOD.PLAYING) {
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
                    status: constants.STATUS.SOUND.OFF,
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
            return sound.status == constants.STATUS.SOUND.ON;
        }
        const group = this.groups.find(obj => obj.id == soundId);
        if (group) {
            return group.status == constants.STATUS.SOUND.ON;
        }
        return false;
    }

    disableSound(_id) {
        const sound = this.sounds.find(obj => obj.id == _id);
        if (sound) {
            if (sound.group != "") {
                this.disableSoundByGroup(sound.group);
            } else {
                sound.status = constants.STATUS.SOUND.OFF;
            }
        }
    }

    enableSound(_id) {
        const sound = this.sounds.find(obj => obj.id == _id);
        if (sound) {
            if (sound.group != "") {
                this.enableSoundByGroup(sound.group);
            } else {
                sound.status = constants.STATUS.SOUND.ON;
            }
        } else {
            const group = this.groups.find(obj => obj.id == _id);
            if (group) {
                this.enableSoundByGroup(_id);
            }
        }
    }

    getEnabledSounds() {
        const s = this.sounds.filter(obj => obj.status == constants.STATUS.SOUND.ON);
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
        return this.sounds.filter(obj => obj.group == "" && obj.status == constants.STATUS.SOUND.ON && (obj.type == constants.SOUNDTYPE.LOOP || obj.type == constants.SOUNDTYPE.RANDOM));
    }

    getGroupsToPlay() {
        return this.groups.filter(obj => obj.status == constants.STATUS.SOUND.ON);
    }

    getSoundByCategory(category, enable_sounds = false) {
        if (enable_sounds) {
            const sounds = structuredClone(this.sounds.filter(obj => obj.status == constants.STATUS.SOUND.ON && obj.category == category));
            const group_sounds = structuredClone(this.groups.filter(obj => obj.status == constants.STATUS.SOUND.ON && obj.category == category));
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

    /**
     * Find a sound or group by ID
     * Use config.type with constants.SOUNDTYPE to determine what it is:
     * - Types 0-3: Regular sounds (AMBIENCE, LOOP, RANDOM, SOUNDPAD)
     * - Types 4-6: Groups (GROUP_LOOP, GROUP_RANDOM, GROUP_SOUNDPAD)
     * @param {string} id - The sound or group ID
     * @returns {SoundConfig|GroupConfig|null}
     */
    findById(id) {
        // Check ungrouped sounds first
        let result = this.sounds.find(s => s.id === id && s.group === "");
        if (result) return result;

        // Check groups
        result = this.groups.find(g => g.id === id);
        return result || null;
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
            sounds[i].status = constants.STATUS.SOUND.OFF;
        }

    }

    /**
     * Change volume of a sound or group
     * @param {string} soundId - The sound or group ID
     * @param {number} volume - The new volume
     * @returns {SoundConfig|GroupConfig|null} The modified config, or null if not found
     */
    changeSoundVolume(soundId, volume) {
        let config = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (config) {
            config.volume = volume;
            config.status = volume == 0 ? constants.STATUS.SOUND.OFF : constants.STATUS.SOUND.ON;
        } else {
            config = this.groups.find(obj => obj.id == soundId);
            if (config) {
                config.setVolume(volume);
                config.enableSound(volume != 0);
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].volume = volume;
                }
            }
        }
        if (!config) {
            ui.notifications.error("Sound not found " + soundId);
            return null;
        }
        this.has_changes = true;
        return config;
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
        return this.status == constants.STATUS.MOOD.PLAYING;
    }

    /**
     * State change methods - encapsulate internal state modifications
     */

    /**
     * Mark this mood as having unsaved changes
     */
    markAsChanged() {
        this.has_changes = true;
    }

    /**
     * Toggle the collapsed state of a category
     * @param {string} categoryId - The category ID
     * @param {number} type - The sound type
     * @returns {boolean} The new collapsed state
     */
    toggleCategoryCollapsed(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) {
            category.collapsed = !category.collapsed;
            return category.collapsed;
        }
        return false;
    }

    /**
     * Set the status of the mood
     * @param {string} status - The new status ("playing" or "stop")
     */
    setStatus(status) {
        this.status = status;
    }

    /**
     * Migrate from soundscape v2 to v3 format
     *
     * V2 structure:
     * - Sounds in groups have type GROUP_LOOP (4) or GROUP_RANDOM (5)
     * - Sound.group is the group NAME (string like "Rain")
     * - active_groups array lists group names
     * - Sound can be status "off" but have non-zero volume
     *
     * V3 structure:
     * - Groups are GroupConfig objects with type GROUP_LOOP (4) or GROUP_RANDOM (5)
     * - Sounds in groups have type LOOP (1) or RANDOM (2) - the BASE type
     * - Sound.group is the group ID (not name)
     * - Groups inherit category from their sounds
     * - Sound status is determined by volume: volume 0 = off, volume > 0 = on
     *
     * @param {string[]} active_groups - Array of active group names from v2
     */
    async migrate_from_v2_to_v3(active_groups) {
        const new_groups = [];
        const safeActiveGroups = active_groups || [];

        ui.notifications.info("Migrating soundscape from v2 to v3...");

        // Normalize mood status to use constant values
        if (this.status?.toLowerCase() === constants.STATUS.MOOD.PLAYING) {
            this.status = constants.STATUS.MOOD.PLAYING;
        } else if (this.status?.toLowerCase() === "stop" || this.status?.toLowerCase() === "stopped") {
            this.status = constants.STATUS.MOOD.STOP;
        }

        // First pass: normalize all sounds' status and volume
        // - Convert status strings to use constants (handle case variations)
        // - In V3, status is determined by volume: off = volume 0, on = volume > 0
        for (const sound of this.sounds) {
            // Normalize status to use constant values (handle "Off", "OFF", "off", etc.)
            if (sound.status?.toLowerCase() === constants.STATUS.SOUND.OFF) {
                sound.status = constants.STATUS.SOUND.OFF;
                sound.volume = "0.0";
            } else if (sound.status?.toLowerCase() === constants.STATUS.SOUND.ON) {
                sound.status = constants.STATUS.SOUND.ON;
            }
        }

        // Second pass: iterate through all sounds to find grouped ones
        for (let i = 0; i < this.sounds.length; i++) {
            const sound = this.sounds[i];

            // Check if this sound belongs to a group (non-empty group name)
            if (sound.hasOwnProperty('group') && sound.group !== '') {
                const groupName = sound.group;

                // Determine group type and base sound type
                // In V2: sounds have GROUP_LOOP (4) or GROUP_RANDOM (5)
                // In V3: groups have GROUP type, sounds have BASE type
                let groupType;
                let baseSoundType;

                if (sound.type === constants.SOUNDTYPE.GROUP_LOOP) {
                    groupType = constants.SOUNDTYPE.GROUP_LOOP;
                    baseSoundType = constants.SOUNDTYPE.LOOP;
                } else if (sound.type === constants.SOUNDTYPE.GROUP_RANDOM) {
                    groupType = constants.SOUNDTYPE.GROUP_RANDOM;
                    baseSoundType = constants.SOUNDTYPE.RANDOM;
                } else {
                    // Fallback: if type is already LOOP or RANDOM, keep it
                    baseSoundType = sound.type;
                    groupType = (sound.type === constants.SOUNDTYPE.RANDOM)
                        ? constants.SOUNDTYPE.GROUP_RANDOM
                        : constants.SOUNDTYPE.GROUP_LOOP;
                }

                // Check if we already created this group
                const existingGroup = new_groups.find(g => g.name === groupName);

                if (existingGroup) {
                    // Add sound to existing group
                    existingGroup.addSound({ id: sound.id, name: sound.name });
                    // Update sound's group reference to use the group ID
                    sound.group = existingGroup.id;
                    // Revert sound type to base type
                    sound.type = baseSoundType;
                } else {
                    // Create new group
                    const newGroupId = foundry.utils.randomID(16);
                    const new_group = new GroupConfig({
                        id: newGroupId,
                        name: groupName,
                        sounds: [{ id: sound.id, name: sound.name }],
                        intensity: parseFloat(sound.intensity) || 0,
                        current: sound.id, // Set first sound as current
                        status: sound.status,
                        volume: sound.volume,
                        type: groupType,
                        category: sound.category || "", // Inherit category from sound
                        soundIcon: 'icons/svg/sound.svg',
                        fadeIn: sound.fadeIn || 0,
                        fadeOut: sound.fadeOut || 0,
                        random: {
                            from: sound.from || 10,
                            to: sound.to || 60,
                        }
                    });

                    new_groups.push(new_group);
                    // Update sound's group reference to use the new group ID
                    sound.group = newGroupId;
                    // Revert sound type to base type
                    sound.type = baseSoundType;
                }
            }
        }

        // Validate migration against active_groups from v2
        if (safeActiveGroups.length > 0) {
            ui.notifications.info(`Validating migration of ${safeActiveGroups.length} active groups...`);
            const uniqueGroupNames = [...new Set(safeActiveGroups)];
            for (const groupName of uniqueGroupNames) {
                const migratedGroup = new_groups.find(g => g.name === groupName);
                if (!migratedGroup) {
                    ui.notifications.warn(`Group "${groupName}" was in active_groups but no sounds found for it`);
                } else {
                    utils.log(utils.getCallerInfo(), `Group "${groupName}" migrated with ${migratedGroup.sounds.length} sounds`, constants.LOGLEVEL.INFO);
                }
            }
        }

        ui.notifications.info(`Migration complete: ${new_groups.length} groups created`);
        this.groups = new_groups;
        this.has_changes = true;
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

    /**
     * Set intensity for a loop group
     * @param {string} groupId - The group ID
     * @param {number} value - The intensity value (0-1)
     * @returns {GroupConfig|null} The modified group, or null if not found
     */
    setIntensity(groupId, value) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.setIntensity(value);
            this.has_changes = true;
        }
        return group || null;
    }

    applyGroupConfigToSound(groupId, soundId) {
        this.sounds;

    }

    /**
     * Set fade in/out for a sound or group
     * @param {string} soundId - The sound or group ID
     * @param {number} fadeIn - Fade in duration in seconds
     * @param {number} fadeOut - Fade out duration in seconds
     * @returns {SoundConfig|GroupConfig|null} The modified config, or null if not found
     */
    setFade(soundId, fadeIn, fadeOut) {
        let config = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (config) {
            config.fadeIn = fadeIn;
            config.fadeOut = fadeOut;
        } else {
            config = this.groups.find(obj => obj.id == soundId);
            if (config) {
                config.fadeIn = fadeIn;
                config.fadeOut = fadeOut;
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].fadeIn = fadeIn;
                    gsounds[i].fadeOut = fadeOut;
                }
            }
        }
        if (!config) {
            ui.notifications.error("Sound not found " + soundId);
            return null;
        }
        this.has_changes = true;
        return config;
    }

    /**
     * Set random interval for a sound or group
     * @param {string} soundId - The sound or group ID
     * @param {number} from - Minimum interval in seconds
     * @param {number} to - Maximum interval in seconds
     * @returns {SoundConfig|GroupConfig|null} The modified config, or null if not found
     */
    setInterval(soundId, from, to) {
        let config = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (config) {
            config.from = from;
            config.to = to;
        } else {
            config = this.groups.find(obj => obj.id == soundId);
            if (config) {
                config.random.from = from;
                config.random.to = to;
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].from = from;
                    gsounds[i].to = to;
                }
            }
        }
        if (!config) {
            ui.notifications.error("Sound not found " + soundId);
            return null;
        }
        this.has_changes = true;
        return config;
    }

    /**
     * Set playOnce flag for a sound or group
     * @param {string} soundId - The sound or group ID
     * @param {boolean} playOnce - Whether to play only once
     * @returns {SoundConfig|GroupConfig|null} The modified config, or null if not found
     */
    setPlayOnce(soundId, playOnce) {
        let config = this.sounds.find(obj => obj.id == soundId && obj.group == "");
        if (config) {
            config.playOnce = playOnce;
        } else {
            config = this.groups.find(obj => obj.id == soundId);
            if (config) {
                config.playOnce = playOnce;
                const gsounds = this.sounds.filter(obj => obj.group == soundId);
                for (let i = 0; i < gsounds.length; i++) {
                    gsounds[i].playOnce = playOnce;
                }
            }
        }
        if (!config) {
            ui.notifications.error("Sound not found " + soundId);
            return null;
        }
        this.has_changes = true;
        return config;
    }

    // ==========================================
    // View Data Methods - UI-Model Separation
    // ==========================================

    /**
     * Get library sounds (SOUNDPAD type) sorted by name
     * @returns {SoundConfig[]} Array of library sounds
     */
    getLibrarySounds() {
        return this.sounds
            .filter(sound => sound.type === constants.SOUNDTYPE.SOUNDPAD)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get sounds organized for the UI view
     * Returns sounds grouped by type (Loop, Random, SoundpadUI) with categories
     * @returns {Array} Array of sound type sections with categories and sounds
     */
    getOrganizedSounds() {
        // Get ungrouped sounds
        const ungroupedSounds = this.sounds.filter(el => el.group === '');

        // Create the sound type sections with categories
        const soundSections = [
            {
                type: constants.SOUNDTYPE.LOOP,
                name: "Loop",
                categories: this._getCategoriesForType(constants.SOUNDTYPE.LOOP)
            },
            {
                type: constants.SOUNDTYPE.RANDOM,
                name: "Random",
                categories: this._getCategoriesForType(constants.SOUNDTYPE.RANDOM)
            },
            {
                type: constants.SOUNDTYPE.SOUNDPADUI,
                name: "Soundpad UI",
                categories: this._getCategoriesForType(constants.SOUNDTYPE.SOUNDPADUI)
            }
        ];

        // Add groups to appropriate sections
        this._addGroupsToSections(soundSections);

        // Add ungrouped sounds to appropriate sections
        this._addSoundsToSections(soundSections, ungroupedSounds);

        // Sort sounds within each category
        this._sortSoundsInCategories(soundSections);

        return soundSections;
    }

    /**
     * Get categories for a specific sound type
     * @param {number} soundType - The sound type constant
     * @returns {Array} Array of category objects with empty sounds array
     * @private
     */
    _getCategoriesForType(soundType) {
        return this.categories
            .filter(el => parseInt(el?.type) === parseInt(soundType))
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                type: cat.type,
                collapsed: cat.collapsed,
                sounds: []
            }));
    }

    /**
     * Add groups to their appropriate sound sections
     * @param {Array} soundSections - The sections to populate
     * @private
     */
    _addGroupsToSections(soundSections) {
        for (const group of this.groups) {
            // Clone the group to avoid modifying the original
            const groupClone = structuredClone(group);

            // Determine which section this group belongs to
            let sectionIndex = 0;
            if (group.type === constants.SOUNDTYPE.GROUP_RANDOM) {
                sectionIndex = 1;
            }

            // Find the category index
            let categoryIndex = groupClone.category !== ""
                ? soundSections[sectionIndex].categories.findIndex(el => el.id === groupClone.category)
                : 0;
            if (categoryIndex < 0) categoryIndex = 0;

            // Add "Group: " prefix to name
            groupClone.name = `Group: ${groupClone.name}`;

            // Add to the appropriate category
            if (soundSections[sectionIndex].categories[categoryIndex]) {
                soundSections[sectionIndex].categories[categoryIndex].sounds.push(groupClone);
            }
        }
    }

    /**
     * Add ungrouped sounds to their appropriate sections
     * @param {Array} soundSections - The sections to populate
     * @param {Array} ungroupedSounds - The ungrouped sounds to add
     * @private
     */
    _addSoundsToSections(soundSections, ungroupedSounds) {
        for (const sound of ungroupedSounds) {
            // Clone to avoid modifying original
            const soundClone = structuredClone(sound);

            // Determine section index based on type
            let sectionIndex = 0;
            if (soundClone.type === constants.SOUNDTYPE.RANDOM) {
                sectionIndex = 1;
            } else if (soundClone.type === constants.SOUNDTYPE.SOUNDPAD ||
                       soundClone.type === constants.SOUNDTYPE.GROUP_SOUNDPAD) {
                // Skip library sounds - they go in the library panel
                continue;
            } else if (soundClone.type === constants.SOUNDTYPE.SOUNDPADUI) {
                sectionIndex = 2;
            }

            // Find category index
            let categoryIndex = soundClone.category !== ""
                ? soundSections[sectionIndex].categories.findIndex(el => el.id === soundClone.category)
                : 0;
            if (categoryIndex < 0) categoryIndex = 0;

            // Add to appropriate category
            if (soundSections[sectionIndex].categories[categoryIndex]) {
                soundSections[sectionIndex].categories[categoryIndex].sounds.push(soundClone);
            }
        }
    }

    /**
     * Sort sounds within each category alphabetically by name
     * @param {Array} soundSections - The sections with categories to sort
     * @private
     */
    _sortSoundsInCategories(soundSections) {
        for (const section of soundSections) {
            for (const category of section.categories) {
                category.sounds.sort((a, b) => a.name.localeCompare(b.name));
            }
        }
    }

    /**
     * Get mood data formatted for the view
     * @param {boolean} isSelected - Whether this mood is currently selected
     * @returns {Object} Mood view data
     */
    getViewData(isSelected = false) {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            has_changes: this.has_changes,
            is_selected: isSelected,
            sounds: isSelected ? this.getOrganizedSounds() : null
        };
    }

    /**
     * Get summary data for mood list (without full sound data)
     * @param {boolean} isSelected - Whether this mood is currently selected
     * @returns {Object} Mood summary data
     */
    getMoodSummary(isSelected = false) {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            has_changes: this.has_changes,
            is_selected: isSelected
        };
    }
}

