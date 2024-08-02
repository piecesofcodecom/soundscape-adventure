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
    }
}


export default class MoodConfig {
    id;
    name;
    status;
    sounds;
    active_groups;

    constructor(_soundsConfig, playlist, _status="stop") {
        this.id = _soundsConfig.id;
        this.name = _soundsConfig.name;
        this.status = _status;
        this.active_groups = [];
        this.sounds = [];
        const _sounds = _soundsConfig.sounds.slice();
        for (let i = 0; i <_sounds.length; i++) {
            const sound = playlist.sounds.find(el => el.path == _sounds[i].path);
            if (sound) {
                if(_sounds[i].hasOwnProperty('status')) {
                    if (_sounds[i].status == "on") {
                        this.sounds.push(new SoundConfig(_sounds[i]));
                    } else {
                        this.sounds.push(new SoundConfig(_sounds[i]));
                    }
                } else {
                    _sounds[i].status = "off";
                    this.sounds.push(new SoundConfig(_sounds[i]));
                }
            }
        }
    }

    // sync sound in the mood with available sounds
    // old sounds are not populated in the contructor
    // no need to remove those
    syncSoundIds(soundsConfig) {
        // add new sounds
        for (let i = 0; i < soundsConfig.length; i++) {
            const sound = this.sounds.find(el => el.path == soundsConfig[i].path);
            if (!sound) {
                this.sounds.push(new SoundConfig({
                    id: soundsConfig[i].id,
                    _id: soundsConfig[i]._id,
                    status: "off",
                    group: soundsConfig[i].group,
                    name:  soundsConfig[i].name,
                    description: soundsConfig[i].description,
                    path: soundsConfig[i].path,
                    repeat: soundsConfig[i].repeat,
                    volume: soundsConfig[i].volume,
                    type: soundsConfig[i].type,
                    group: soundsConfig[i].group,
                    intensity: soundsConfig[i].intensity
                }));
            } else {
                sound.id = soundsConfig[i].id;
                sound._id = soundsConfig[i]._id;
            }
        }
    }

    isSoundOn(soundId) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        if (sound) {
            return true;
        }
        return false;
    }

    disableSound(_id) {
        const sound = this.sounds.find(obj => obj.id == _id);
    
        if (sound) {
            sound.status = "off";
            sound.volume = 0;
        } 
    }

    enableSound(_id) {
        const sound = this.sounds.find(obj => obj.id == _id);
    
        if (sound) {
            sound.status = "on";
        } 
    }

    getEnabledSounds() {
        return this.sounds.filter(obj => obj.status == "on");
    }

    getSound(soundId) {
        return this.sounds.find(obj => obj.id == soundId);
    }
    getSoundByGroup(group) {
        return this.sounds.filter(obj => obj.group == group);
    }
    disableSoundByGroup(group) {
        const sounds = this.sounds.filter(obj => obj.group == group);
        for (let i = 0; i < sounds.length; i++) {
            this.disableSound(sounds[i].id);
        }

    }

    changeSoundVolume(soundId, volume) {
        let sound = this.sounds.find(obj => obj.id == soundId);
        if (sound) {
            sound.volume = volume;
            if (volume > 0) {
                this.enableSound(soundId);
            } else {
                this.disableSound(soundId);
            }
        }
    }

    updateSoundName(soundId, newName) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        sound.name = newName;
    }
}
