import constants from "./utils/constants.mjs";
import utils from "./utils/utils.mjs";
export default class Mood {
    sounds=[];
    name;
    status="stop";
    constructor(name, _sounds, status="stop") {
        this.name = name;
        this.status = status;
        const sounds = _sounds.slice();
        for (let i =0; i < sounds.length; i++) {
            if (!sounds[i].hasOwnProperty('status')) {
                sounds[i].status = "off";
            }
            this.sounds.push(sounds[i]);
        }
    }

    async stopSound(path, playlist) {
        const soundConfig = this.sounds.find(el => el.path == path);
        if (soundConfig.group.length > 0) {
            const soundGroup = this.sounds.filter(el => el.group == soundConfig.group);
            for (let i = 0; i < soundGroup.length; i++) {
                soundGroup[i].status = "off";
                const s = playlist.sounds.find(el => el.path == soundGroup[i].path);
                playlist.stopSound(s);
            }

        } else {
            soundConfig.status = "off";
            const s = playlist.sounds.find(el => el.path == path);
            playlist.stopSound(s);
        }
        Hooks.callAll("SBAdventure-PlayingMood", this.name, moodName, null);
    }

    async disableSound(path, playlist) {
        const soundConfig = this.sounds.find(el => el.path == path);
        if (soundConfig.group.length > 0) {
            const soundGroup = this.sounds.filter(el => el.group == soundConfig.group);
            for (let i=0; i < soundGroup.length; i++) {
                soundGroup[i].status = "off";
                const s = playlist.sounds.find(el => el.path == soundGroup[i].path);
                playlist.stopSound(s);
            }
        } else {
            soundConfig.status = "off";
            const s = playlist.sounds.find(el => el.path == soundConfig.path);
            //s.update({ volume: soundConfig.volume });
            await playlist.stopSound(s);
        }
    }
    async enableSound(path, playlist) {
        const soundConfig = this.sounds.find(el => el.path == path);
        if (soundConfig.group.length > 0) {
            const soundGroup = this.sounds.filter(el => el.group == soundConfig.group);
            for (let i = 0; i < soundGroup.length; i++) {
                soundGroup[i].status = "on";
            }
            this.playFromGroup(soundConfig.group, playlist)
        } else {
            soundConfig.status = "on";
            const s = playlist.sounds.find(el => el.path == soundConfig.path);
            s.update({ volume: soundConfig.volume });
            if (this.status == "playing") {
                await playlist.playSound(s);
            }
        }
    }

    async play(playlist) {
        const active_groups = [];
        if (this.status == "playing") return;
        this.status = "playing";
        const sounds = this.sounds.filter(el => el.status == "on");
        for (let i=0; i<sounds.length; i++) {
            if (sounds[i].type == constants.SOUNDTYPE.GROUP_RANDOM) {
                if(!active_groups.includes(sounds[i].group)) {
                    active_groups.push(sounds[i].group);
                    this.playFromGroup(sounds[i].group, playlist);
                }
            } if (sounds[i].type == constants.SOUNDTYPE.GROUP_LOOP) {
                if(!active_groups.includes(sounds[i].group)) {
                    active_groups.push(sounds[i].group);
                    this.playFromGroup(sounds[i].group, playlist);
                }
            } else {
                const s = await playlist.sounds.find( sound => sound.path == sounds[i].path);
                console.warn(`Simple play the sound ${s.path}`);
                const newVolume = sounds[i].volume;
                s.update({ volume: newVolume });
                playlist.playSound(s);
            }
        }
    }

    async _syncRemovedSounds(newSoundList) {
        utils.log(utils.getCallerInfo(),`Removing old sounds from the mood ${this.name}`);
        for (let i = 0; i < this.sounds.length; i++) {
            const sd = newSoundList.find(el => el.path == this.sounds[i].path);
            if (!sd) {
                utils.log(utils.getCallerInfo(),`Remove ${this.sounds[i].path} in the mood ${this.name}`);
                this.sounds.splice(i, 1)
            }
        }
    }
    async syncMood(newSoundList) {
        utils.log(utils.getCallerInfo(),`Syncing mood ${this.name}`);
        await this.updateSounds(newSoundList);
        await this._syncRemovedSounds(newSoundList);
    }
    async updateSounds(newSoundList) {
        utils.log(utils.getCallerInfo(),`Update sounds in mood ${this.name}`);
        const _newSonds = newSoundList.slice();
        for (let i=0; i<_newSonds.length;i++) {
            const found = await this.sounds.find(el => el.path == _newSonds[i].path);
            if (!found) {
                utils.log(utils.getCallerInfo(),`Adding new sound ${_newSonds[i].path} to the mood ${this.name}`);
                const newEl = _newSonds[i];
                newEl.status = "off"
                this.sounds.push(newEl);
            } else {
                utils.log(utils.getCallerInfo(),`Updating name for sound ${_newSonds[i].path} in the mood ${this.name}`);
                found.name = _newSonds[i].name;
            }
        }
    }

    async playLoopGroup(soundGroup, playlist) {
        // Generate a random index
        let randomIndex = Math.floor(Math.random() * soundGroup.length);
        const sound = playlist.sounds.find(el => el.path == soundGroup[randomIndex].path);
        if (sound) {
            setTimeout(function() {
                // call it again when the sound finishes
                if (this.status == 'playing') {
                    this.playLoopGroup(soundGroup, playlist);
                }
            }, sound.duration);
            playlist.playSound(sound);
        }
    }

    async _playRandomGroup(soundGroup, playlist) {
        //const sounds = this.sounds.filter(el => el.group == soundGroup);
        let randomIndex = Math.floor(Math.random() * soundGroup.length);
        
        const sound = playlist.sounds.find(el => el.path == soundGroup[randomIndex].path)
        if (sound) {
            utils.log(utils.getCallerInfo(),`Playing sound ${sound.path} from Random group ${soundGroup}`, constants.LOGLEVEL.WARN);
            await playlist.playSound(sound);
            await sound.load();
            const delay = parseInt(sound.sound.duration*1000) + utils.randomWaitTime();
            setTimeout(() => {
                utils.log(utils.getCallerInfo(),`Scheduled play for Random group ${soundGroup} - ${this.status}`, constants.LOGLEVEL.WARN);
                if (this.status == 'playing') {
                    this._playRandomGroup(soundGroup, playlist);
                }
            }, delay);
            utils.log(utils.getCallerInfo(),`Scheduling the next play to ${delay} for Random group ${soundGroup}`, constants.LOGLEVEL.WARN);
        }
    }

    async _playLoopGroup(soundGroup, playlist, intensity) {
        console.warn(soundGroup)
        console.warn(intensity)
        //const sounds = this.sounds.filter(el => el.group == soundGroup);
        console.warn("current volume", intensity);
        const segment_size = 100/soundGroup.length;
        console.warn("segment_size", segment_size);
        let index = Math.floor(intensity / segment_size);
        console.warn("index", index);
        if (index >= soundGroup.length) index = soundGroup.length-1;
        soundGroup.sort((a, b) => a.path.localeCompare(b.path));
        console.warn("Ordenados", soundGroup);
        for (let i=0; i < soundGroup.length; i++) {
            soundGroup.intensity = intensity;
            const s = playlist.sounds.find(el => el.path == soundGroup[i].path);
            await s.load()
            if (s.playing && i != index) {
                playlist.stopSound(s);
            } else if(i == index) {
                playlist.playSound(s)
            }
        }

        //let itensity = Math.floor(Math.random() * sounds.length);
    }
    async changeSoundIntensity(group, value, playlist) {
        console.warn("change", group, value)
        const soundGroup = this.sounds.filter(el => el.group == group);

        this._playLoopGroup(soundGroup, playlist, value);

    }
    async playFromGroup(group, playlist) {
        console.warn(group)
        const soundGroup = this.sounds.filter(el => el.group == group && el.status == 'on');
        console.warn(soundGroup)
        if (soundGroup.length > 0) {
            if (soundGroup[0].type == constants.SOUNDTYPE.GROUP_RANDOM) {
                this._playRandomGroup(soundGroup, playlist);
            } else if(soundGroup[0].type == constants.SOUNDTYPE.GROUP_LOOP) {
                this._playLoopGroup(soundGroup, playlist, soundGroup[0].intensity);
            }
        }
    }

    async changeSoundVolume(path, newVolume, playlist) {
        const soundConfig = this.sounds.find(el => el.path == path);
        if (soundConfig.group.length > 0) {
            const soundGroup = this.sounds.filter(el => el.group == soundConfig.group);
            for (let i = 0; i < soundGroup.length; i++) {
                soundGroup[i].volume = newVolume;
                const sound = playlist.sounds.find(el => el.path == soundGroup[i].path);
                if (sound) {
                    await sound.load();
                    console.warn(`setting volume for ${sound.name}`)
                    sound.update({ volume: newVolume });   
                    //}
                }
            }
        } else {
            const sound = playlist.sounds.find(el => el.path == path);
            soundConfig.volume = newVolume;
            if (sound) {
                if (sound.playing) {
                    sound.update({ volume: newVolume });   
                }
            }
        }
    }
}
