import constants from "./utils/constants.mjs";

export class GroupConfig {

    constructor(obj) {
        if (obj) {
            this.id = obj.id;
            this.name = obj.name;  // sound name
            this.sounds = obj.sounds; //sound id list
            this.intensity = obj.intensity; // if applicabe
            this.current = obj.current; //the current sound id playing
            this.status = obj.status; // active or not
            this.volume = obj.volume; // the sound volume
            this.type = obj.type;
            this.category = obj.category;
            this.soundIcon = obj.soundIcon;
            this.fadeIn = obj.fadeIn;
            this.fadeOut = obj.fadeOut;
            this.random = {
                from: obj.random.from,
                to: obj.random.to,
            }
            this._adjustIntensity();
        } else {
            this.id = foundry.utils.randomID(16);
            this.name = "";  // sound name
            this.sounds = []; //sound id list
            this.intensity = 0.0; // if applicabe
            this.current = ""; //the current sound id playing
            this.status = constants.STATUS.SOUND.OFF; // active or not
            this.volume = 0.0; // the sound volume
            this.type = 0;
            this.category = 0;
            this.soundIcon = 'icons/svg/sound.svg';
            this.fadeIn = 0.0;
            this.fadeOut = 0.0;
            this.random = {
                from: 0,
                to: 0,
            }
        }
    }

    addSound(sounditem) {
        this.sounds.push(sounditem);
        this._adjustIntensity();
    }

    async removeSound(soundId) {
        const index = await this.sounds.findIndex(el => el.id == soundId);
        if (index >= 0) {
            this.sounds.splice(index, 1);
            this._adjustIntensity();
        }
    }

    //when we add a sound or create a new group
    // only for loop groups
    _adjustIntensity() {
        if (this.type !== constants.SOUNDTYPE.GROUP_LOOP || this.sounds.length == 0) return;
        if (this.sounds.length == 1) {
            this.current = this.sounds[0].id;
            return;
        }
        const segment_size = 100 / this.sounds.length;
        let index = Math.floor(this.intensity / segment_size);
        if (index >= this.sounds.length) index = this.sounds.length - 1;
        this.sounds.sort((a, b) => a.name.localeCompare(b.name));
        this.current = this.sounds[index].id;
    }

    setIntensity(newValue) {
        if (this.type !== constants.SOUNDTYPE.GROUP_LOOP) return;
        this.intensity = newValue;
        this._adjustIntensity();
    }

    setVolume(newVolume) {
        this.volume = newVolume;
    }
    enableSound(enable=true) {
        if (enable)
            this.status = constants.STATUS.SOUND.ON;
        else
            this.status = constants.STATUS.SOUND.OFF;
    }
}