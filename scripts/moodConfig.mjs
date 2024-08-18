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
                _sounds[i].id = sound.id;
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
            } else {
                utils.log("Sound doesn't exist in the playlist yet", constants.LOGLEVEL.ERROR)
            }
        }
        this.consistence();
    }

    // validate files for sounds in the mood exist
    async consistence() {
        for (let i=0; i < this.sounds.length; i++) {
            const fileExists = await this.validateFileExists(this.sounds[i].path);
            if (!fileExists) {
                // Remove the item from the array
                this.sounds.splice(i, 1);
                i--; // Adjust index after removal
            }
        }
    }

    async validateFileExists(filePath) {
        const directory = filePath.substring(0, filePath.lastIndexOf('/'));
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
      
        try {
          const result = await FilePicker.browse("data", directory);

          if (result.files.includes(filePath)) {
            return true;
          } else {
            return false;
          }
        } catch (error) {
          return false;
        }
      }

    // adds to the playlist custom sounds
    // sounds that aren't part of the folder
    async updatePlaylist(playlist) {
        utils.log("Not implemented yet", constants.LOGLEVEL.INFO);
    }

    // sync sound within the folder
    // add new sounds
    async syncFolderSounds(soundsConfig) {
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
                    intensity: soundsConfig[i].intensity,
                    to: Object.hasOwn(soundsConfig[i], 'to') ? soundsConfig[i].to : 60,
                    from: Object.hasOwn(soundsConfig[i], 'from') ? soundsConfig[i].from : 10,
                    fadeIn: Object.hasOwn(soundsConfig[i], 'fadeIn') ? soundsConfig[i].fadeIn : 0,
                    fadeOut: Object.hasOwn(soundsConfig[i], 'fadeOut') ? soundsConfig[i].fadeOut : 0,
                    playOnce: Object.hasOwn(soundsConfig[i], 'playOnce') ? soundsConfig[i].playOnce : false,
                    category: Object.hasOwn(soundsConfig[i], 'category') ? soundsConfig[i].category : ""
                }));
            }
        }
        await this.consistence();
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
        } 
    }

    getEnabledSounds() {
        return this.sounds.filter(obj => obj.status == "on");
    }

    getSound(soundId) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        return sound;
    }
    getSoundByGroup(group) {
        return this.sounds.filter(obj => obj.group == group);
    }
    enableSoundByGroup(group) {
        const sounds = this.sounds.filter(obj => obj.group == group);
        for (let i = 0; i < sounds.length; i++) {
            sounds[i].status = "on";
        }
    }
    disableSoundByGroup(group) {
        const sounds = this.sounds.filter(obj => obj.group == group);
        for (let i = 0; i < sounds.length; i++) {
            sounds[i].status = "off";
        }

    }

    changeSoundVolume(soundId, volume) {
        let sound = this.sounds.find(obj => obj.id == soundId);
        if (sound) {
            sound.volume = volume;
        }
    }

    updateSoundName(soundId, newName) {
        const sound = this.sounds.find(obj => obj.id == soundId);
        sound.name = newName;
    }
}
