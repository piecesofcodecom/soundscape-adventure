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

    async updateSounds(newSoundList) {
        const _newSonds = newSoundList.slice();
        for (let i=0; i<_newSonds.length;i++) {
            const found = await this.sounds.find(el => el.path == _newSonds[i].path);
            if (!found) {
                const newEl = _newSonds[i];
                newEl.status = "off"
                this.sounds.push(newEl);
            } else {
                //Update the sound name and volume
                found.name = _newSonds[i].name;
                found.volume = _newSonds[i].volume;
            }
        }
    }
}
