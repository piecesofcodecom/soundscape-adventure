import MoodConfig from "./moodConfig.mjs";
import constants from "./utils/constants.mjs";
import utils from "./utils/utils.mjs";
import SoundscapeAdventure from "./soundscape-adventure.mjs";
export default class Soundscape {
    id;
    name;
    type; // Type can be local or remote
    moods; // the moods associated to this soundscape
    playlist; // the playlist related to this soundscape
    soundsConfig; // a list of all sounds available for this soundscape
    path; // the soundscape path
    status; // it identifies if the soundscape is loaded (with a playlist)
    moodsConfigFile="moods.json";
    random_idempotency;

    constructor(_path, _type=constants.SOUNDSCAPE_TYPE.LOCAL) {
        this.id = foundry.utils.randomID(16);
        this.path = _path;
        this.type = _type;
        this.status = "offline";
        this.playlist = null;
        this.soundsConfig = [];
        this.random_idempotency = [];
        this.name = `${constants.PREFIX}: ${_path.split("/").pop()}`;
        this.moods = {};
    }

    /** Soundscape configuration */

    async init() {
        if (this.type == constants.SOUNDSCAPE_TYPE.LOCAL) {
            // if there is a playlist with same name, we initialize the soundscape
            for(let i=0; i < game.playlists._source.length; i++) {
                if (game.playlists._source[i].name.trim() == this.name.trim()) {    
                    utils.log(utils.getCallerInfo(),`Found Playlist ${game.playlists._source[i].name}`);
                    this.playlist = await game.playlists.get(game.playlists._source[i]._id);
                    this.status = "online";
                    // recover previous soundscape id
                    const soundscapes = await game.settings.get('soundscape-adventure', 'soundscapes').split(";");
                    for (let i=0; i< soundscapes.length; i++) {
                        const soundspace = soundscapes[i].split(",");
                        if (soundspace[0] == this.name) {
                            this.id = soundspace[1];
                        }
                    }
                    if (this.playlist.playing) {
                        const currentPlaying = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
                    }
                }
            }
            await this.init_local()
        } else {
            utils.log(utils.getCallerInfo(),`The type '${this.type}' isn't implemented yet`, constants.LOGLEVEL.ERROR);
        }
    }

    async init_local() {
        utils.log(utils.getCallerInfo(),`Init Soundspace '${this.name}' within ${this.path}`);

        const subfolders = await FilePicker.browse('data', this.path, { recursive: true });
        //load sounds to the soundsConfig
        utils.log(utils.getCallerInfo(),`Loading sounds from '${this.path}'`);
        for (const dir of subfolders.dirs) {
            let sound_type = constants.SOUNDTYPE.INVALID;
            switch (dir.split("/").pop().toLowerCase()) {
                case "ambience":
                    sound_type = constants.SOUNDTYPE.AMBIENCE;
                    break;
                case "random":
                    sound_type = constants.SOUNDTYPE.RANDOM;
                    break;
                case "loop":
                    sound_type = constants.SOUNDTYPE.LOOP;
                    break;
                case "soundpad":
                    sound_type = constants.SOUNDTYPE.SOUNDPAD;
                    break;
                default:
                    sound_type = constants.SOUNDTYPE.INVALID;
                    break;
            }
            await this._loadLocalSounds(dir, sound_type);
        }

        if (this.playlist != null) {
            await this._syncPlaylist();
            await this._syncSoundIds();
            await this._loadMoods();
        }
    }

    // enable an offiline soundscape means create a playlist
    // and load the moods
    async enable() {
        await this._createPlaylist();
        await this._syncSoundIds();
        await this._loadMoods();
        this.status = "online";
        const soundscapes = await game.settings.get('soundscape-adventure', 'soundscapes')
        await game.settings.set('soundscape-adventure', 'soundscapes', soundscapes + ";" + this.name + "," +this.id);
        await this.saveMoodsConfig();
    }

    async fileExists(path) {
        try {
          const result = await FilePicker.browse("data", path);
          return result.files.length > 0 || result.dirs.length > 0;
        } catch (e) {
          //console.error(e);
          return false;
        }
      }

    async reScanFolder() {
        await this.init();
        await this.saveMoodsConfig();
    }

    async _syncPlaylist() {
        // validates all sounds are in the playlist
        for (let i = 0; i < this.soundsConfig.length; i++) {
             const sound = this.playlist.sounds.filter(el => el.path == this.soundsConfig[i].path);
             if (sound.length == 0) {
                // need to add the sound
                await this._addSoundToPlaylist(this.soundsConfig[i]);
             } else if (sound.length > 1) {
                //console.warn("remove duplicated sound "+sound[0].path)
                for( let j = 1; j < sound.length; j++) {
                    // double check that still exists
                    const sound_to_remove = this.playlist.sounds.filter(el => el.id == sound[j].id);
                    if (sound_to_remove) {
                        await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [sound_to_remove.id]);
                    }
                }
             }
        }

        // remove sounds that are in the playlist but aren't mapped in the soundsConfig
        const sounds = Array.from(this.playlist.sounds);
        for (let i = 0; i < sounds.length; i++) {
            const sound = this.soundsConfig.find(el => el.path == sounds[i].path);
            if (!sound) {
               // need to remove from playlist
               await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [sounds[i].id]);
            }
       }
    }

    async _addSoundToPlaylist(newSound) {
        utils.log(utils.getCallerInfo(),`Adding a new sound '${newSound.path}' to the playlist '${this.playlist.name}'`)
        await this.playlist.createEmbeddedDocuments("PlaylistSound", [newSound])
    }

    async _createPlaylist() {
        utils.log(utils.getCallerInfo(),`Creating playlist '${this.name}'`);
        let newPlaylistData = {
            name: this.name,
            description: "This is a playlist managed by SBAdventure",
            folder: null,  // If you have a specific folder, provide its ID
            sorting: "a",  // Sorting method: "a" for alphabetic, "m" for manual
            mode: 2,  // Play mode: 0 for sequential, 1 for shuffle, 2 for simultaneous
            playing: false,  // Whether the playlist is currently playing
            sounds: this.soundsConfig
          };
          
          // Create the new playlist
          this.playlist = await Playlist.create(newPlaylistData);
    }

    async _syncSoundIds() {
        // it update sound ids from playlist to soundsConfig
        for (let i = 0; i < this.soundsConfig.length; i++) {
            const sound = this.playlist.sounds.find(el => el.path == this.soundsConfig[i].path);
            if (sound) {
                this.soundsConfig[i].id = sound.id;
                this.soundsConfig[i]._id = sound._id;
            }
        }
    }

    async _loadLocalSounds(path, type) {
        utils.log(utils.getCallerInfo(),`Loading local sounds of type '${type}' from '${path}'`)
        if (type == constants.SOUNDTYPE.INVALID) {
            return;
        }
        try {
            const subfolder = await FilePicker.browse('data', path, { recursive: true });
            for (const file of subfolder.files) {
                if (file.includes(".mp3")) {
                    if (type == constants.SOUNDTYPE.GROUP_LOOP || type == constants.SOUNDTYPE.GROUP_RANDOM) {
                        await this._newLocalSound(file.split("/").pop(), file, type, path.split("/").pop());
                    } else {
                        await this._newLocalSound(file.split("/").pop(), file, type);
                    }
                }
            }
            if (type == constants.SOUNDTYPE.LOOP || type == constants.SOUNDTYPE.RANDOM) {
                const subfolderType = (type == constants.SOUNDTYPE.LOOP) ? constants.SOUNDTYPE.GROUP_LOOP : constants.SOUNDTYPE.GROUP_RANDOM;
                for (const dir of subfolder.dirs) {
                    this._loadLocalSounds(dir, subfolderType);
                }
            }
        } catch (error) {
            utils.log(utils.getCallerInfo(),`Error loading sounds of type ${type}:`, constants.LOGLEVEL.ERROR, error);
        }
    }

    async _newLocalSound(name, path, type, group="") {
        utils.log(utils.getCallerInfo(),`Adding new local sound ${name} with group '${group}' to the ${this.name}`);
        let soundData = {
            _id: foundry.utils.randomID(16),
            name: name,
            description: "This sound is managed by the Soundscape Adventure",
            path: path, // Path to the sound file
            repeat: (constants.SOUNDTYPE.LOOP === type || constants.SOUNDTYPE.AMBIENCE === type || constants.SOUNDTYPE.GROUP_LOOP === type),// ? false : true,
            volume: 0,
            type: type,
            group: group,
            intensity: 0
        };
        const existing_sound = await this.soundsConfig.find(el => el.path == path);
        if(!existing_sound) {
            this.soundsConfig.push(soundData);
        } else {
            utils.log(utils.getCallerInfo(),`Sound ${path} is already in the soundscape ${this.name}`);
        }
    }

     /** End soundscape configuration */

    /**
     * SOUNDSCAPE CONTROLS
     */

    async stopAll() {
        for (let i=0;i>this.moods.length;i++) {
            this.moods[i].status="stop";
        }
        //this.isPlaying = false;
    }

    /**
     * MOOD CONTROLS
     */
    async newMood(name, _soundsConfig={}) {
        if (Object.keys(_soundsConfig).length === 0) {
            _soundsConfig.sounds = this.soundsConfig.slice();
            _soundsConfig.name = name;
            _soundsConfig.id = foundry.utils.randomID(16);
            _soundsConfig.active_groups = [];

        }
        utils.log(utils.getCallerInfo(),`Create new mood ${name}`);
        console.warn(_soundsConfig.sounds)
        const mood = new MoodConfig(_soundsConfig, this.playlist);
        this.moods[_soundsConfig.id] = mood;
        await this.saveMoodsConfig();
        Hooks.callAll("SBAdventureNewMood", name, mood);
    }
    async _loadMoods() {
        utils.log(utils.getCallerInfo(),`Checking moods for ${this.name}`);
        const folder = await FilePicker.browse('data', this.path, { recursive: true });
        let moodConfigFile = "";
        for (const file of folder.files) {
            if (file.includes(this.moodsConfigFile)) {
                moodConfigFile = file;
            }
        }
        if(moodConfigFile.length) {
            try {
                utils.log(utils.getCallerInfo(),`Previous mood configuration has been retrieved '${moodConfigFile}'`);
                const response = await fetch(moodConfigFile);
                const contents = await response.json();
                // it allows to run name updates once
                let name_update = true;
                for(let key in contents) {
                    const moodconfig = contents[key];
                    if (this.moods[moodconfig.id] == null) {
                        // creates a mood from scratch
                        const currentPlaying = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
                        let status = "stop";
                        if(currentPlaying.length == 2) {
                            if (currentPlaying[0] == this.id && currentPlaying[1] == moodconfig.id) {
                                status = "playing";
                            }
                        }
                        this.moods[moodconfig.id] = new MoodConfig(moodconfig, this.playlist, status);
                        await this.moods[moodconfig.id].syncSoundIds(this.soundsConfig);
                        if (status == "playing") {
                            this.playMood(moodconfig.id, saveconfig=false);
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
                    }
                }
            } catch (error) {
                utils.log(utils.getCallerInfo(),`Can't parse file ${moodConfigFile}`, constants.LOGLEVEL.ERROR, error)
            }
        } else {
            utils.log(utils.getCallerInfo(),`No configuration found for ${this.name}`);
        }
        return;
    }

    async playMood(moodId, saveconfig=true) {
        const currentconfig = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (currentconfig.length == 2) {
            if(currentconfig[0] == this.id && currentconfig[1] != moodId)
                await this.stopMood(currentconfig[1])
        }
        if (saveconfig) {
            await game.settings.set('soundscape-adventure', 'current-playing', `${this.id},${moodId}`);
        }
        this.moods[moodId].status = "playing";
        this.isPlaying = true;
        if(this.moods[moodId]) {
            const sounds = this.moods[moodId].getEnabledSounds();
            this.moods[moodId].status = "playing";
            for (let i=0; i<sounds.length; i++) {
                await this.playSound(sounds[i], moodId);
            }
        }
    }

    async deleteMood(moodId) {
        if (this.moods[moodId]) {
            delete this.moods[moodId];
            await this.saveMoodsConfig();
            SoundscapeAdventure.refreshSoundscapeUI(this.id)
        }
    }
    async stopMood(moodId) {
        await game.settings.set('soundscape-adventure', 'current-playing', "");
        this.isPlaying = false;
        await this.playlist.stopAll();
        this.moods[moodId].status = "stop";
        this.moods[moodId].active_groups = [];
    }
    async stopAll() {
        for (let i=0;i>this.moods.length;i++) {
            this.moods[i].status="stop";
        }
        this.isPlaying = false;
    }
    async saveMoodsConfig() {
        utils.log(utils.getCallerInfo(),`Saving moods for ${this.name} to ${this.path}`)
        let moodsCopy = JSON.parse(JSON.stringify(this.moods));

        for (let key in moodsCopy) {
            if (moodsCopy.hasOwnProperty(key)) {
                delete moodsCopy[key].active_groups;
                delete moodsCopy[key].status;
            }
        }
        try {
            const blob = new Blob([JSON.stringify(moodsCopy, null, 2)], { type: 'application/json' });
            const file = new File([blob], this.moodsConfigFile, { type: 'application/json' });
            await FilePicker.upload('data', this.path, file)
        } catch (error) {
            utils.log(utils.getCallerInfo(),`Error saving moods for ${this.name}:`, constants.LOGLEVEL.ERROR, error);
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

    async changeSoundVolume(moodId, soundId, newVolume) {
        const currentconfig = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (this.moods[moodId]) {
            const group = this.moods[moodId].getSound(soundId).group;
            if ( group != "") {
                const sounds = this.moods[moodId].getSoundByGroup(group);
                for (let i = 0; i < sounds.length; i++) {
                    const sound = this.playlist.sounds.get(sounds[i].id);
                    if (sound) {
                        sound.update({ volume: newVolume });
                        this.moods[moodId].changeSoundVolume(sounds[i].id, newVolume);
                        if (currentconfig[0] == this.id && currentconfig[1] == moodId) {
                            if (newVolume == 0) {
                                this.stopSound(this.moods[moodId].getSound(sounds[i].id), moodId);
                            } else {
                                this.playSound(this.moods[moodId].getSound(sounds[i].id), moodId);
                            }
                        } 
                        Hooks.callAll('SoundscapeAdventure-ChangeSoundVolume', this.id, moodId, this.moods[moodId]);
                    } else {
                        console.error("Sound not found")
                    }
                }
            } else {
                const sound = this.playlist.sounds.get(soundId);
                if (sound) {
                    sound.update({ volume: newVolume });
                    this.moods[moodId].changeSoundVolume(soundId, newVolume);
                    if (currentconfig[0] == this.id && currentconfig[1] == moodId) {
                        if (newVolume == 0) {
                            this.stopSound(this.moods[moodId].getSound(soundId), moodId);
                        } else {
                            this.playSound(this.moods[moodId].getSound(soundId), moodId);
                        }
                    } 
                } else {
                    console.error("Sound not found")
                }   
            }
        }
    }

    async stopSound(sound, moodId) {
        this.playlist.stopSound({ id: sound.id })
        this.moods[moodId].disableSound(sound.id);
        if (sound.group != "") {
            this.moods[moodId].active_groups.pop(sound.group);
            this.moods[moodId].disableSoundByGroup(sound.group);
        }
    }
    async playSound(sound, moodId) {

        if (sound.type == constants.SOUNDTYPE.GROUP_RANDOM) {
            if(!(this.moods[moodId].active_groups.includes(sound.group))) {
                this.moods[moodId].active_groups.push(sound.group);
                this.playFromGroup(sound.group, moodId);
            }
           
        } if (sound.type == constants.SOUNDTYPE.GROUP_LOOP) {
            
            if(!(this.moods[moodId].active_groups.includes(sound.group))) {
                this.moods[moodId].active_groups.push(sound.group);
                this.playFromGroup(sound.group, moodId);
            }
        } else if (sound.type == constants.SOUNDTYPE.LOOP || sound.type == constants.SOUNDTYPE.AMBIENCE) {
            const s = await this.playlist.sounds.get(sound.id);
            this.moods[moodId].enableSound(sound.id);
            const newVolume = sound.volume;
            s.update({ volume: newVolume });
            this.playlist.playSound(s);
        } else if (sound.type == constants.SOUNDTYPE.RANDOM) {
            this.moods[moodId].enableSound(sound.id);
            //console.warn(`Request sound scheduler for a random sound ${sound.path}`);
            this.playAfterDuration2([sound], moodId, sound.group, utils.randomWaitTime());
        }
    }

    async playFromGroup(group, moodId) {
        const soundGroup = this.moods[moodId].getSoundByGroup(group);
        if (soundGroup.length > 0) {
            if (soundGroup[0].type == constants.SOUNDTYPE.GROUP_RANDOM) {
                //console.warn(`Request sound scheduler for a group random sound ${group}`);
                this.playAfterDuration2(soundGroup, moodId, group, utils.randomWaitTime());
            } else if(soundGroup[0].type == constants.SOUNDTYPE.GROUP_LOOP) {
                this._playLoopGroup(soundGroup, soundGroup[0].intensity);
            }
        }
    }

    async _playLoopGroup(soundGroup, intensity) {
        const segment_size = 100/soundGroup.length;
        let index = Math.floor(intensity / segment_size);
        if (index >= soundGroup.length) index = soundGroup.length-1;
        soundGroup.sort((a, b) => a.path.localeCompare(b.path));
        for (let i=0; i < soundGroup.length; i++) {
            soundGroup[i].intensity = intensity;
            soundGroup[i].status = "on";
            const s = this.playlist.sounds.get(soundGroup[i].id);
            await s.load()
            if (s.playing && i != index) {
                this.playlist.stopSound(s);
            } else if(i == index) {
                s.update({ volume: soundGroup[i].volume })
                this.playlist.playSound(s)
            }
        }
    }

    async changeSoundIntensity(moodId, group, value) {
        if (this.moods[moodId]) {
            const soundGroup = this.moods[moodId].sounds.filter(el => el.group == group);
            this._playLoopGroup(soundGroup, value);
        }
    }

    async randomSound(sounds,moodId, group, s, idempotency) {
        //console.warn(`Time to play the sound ${s.path}`);
        const config = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (config.length == 2) {
            if (config[0] == this.id && config[1] == moodId) {
                const index = sounds.findIndex(obj => obj.id == s.id);
                if (sounds[index].status == "on") {
                    await s.load();
                    s.update({ volume: sounds[index].volume });
                    //console.warn(`Playing ${s.path}`);
                    this.playlist.playSound(s);
                    await s.load();
                    s.sound.addEventListener('end',
                        () => {
                            if (this.random_idempotency.includes(idempotency)) {
                                this.random_idempotency.pop(idempotency);
                                this.playAfterDuration2(sounds,moodId, group, utils.randomWaitTime()) 
                            }
                        }
                    )
                }
            }
        }
    }

    async playAfterDuration2(sounds,moodId, group, delay) {
        //console.warn(`Scheduling a sound to play in ${parseInt(delay/100)} seconds`);
        const idempotency = foundry.utils.randomID(16);
        this.random_idempotency.push(idempotency);
        const config = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (config.length == 2) {
            if (config[0] == this.id && config[1] == moodId) {
                const randomIndex = Math.floor(Math.random() * sounds.length);
                if (sounds[randomIndex].status == "on") {
                    const s = await this.playlist.sounds.get(sounds[randomIndex].id);
                    //console.warn(`Creating the Audio Buffer for ${sounds[randomIndex].name} to play in ${parseInt(delay/100)} seconds`);
                    const timeout = new foundry.audio.AudioTimeout(delay, {callback: () => this.randomSound(sounds,moodId, group, s, idempotency)});
                }
            } /*else {
                console.warn(`Stop scheduling due to this soundboard ${this.id} and mood ${moodId} isn't active`);
                console.warn(config);
            }*/
        } /*else {
            console.warn(`Stop scheduling due to no soundboard/mood is active`);
        }*/
    }

    updateSoundName(soundId, newName) {
        const sound = this.soundsConfig.find(obj => obj.id == soundId);
        sound.name = newName;
        const s = this.playlist.sounds.get(soundId);
        s.update({ name: newName });
        for (let key in this.moods) {
            this.moods[key].updateSoundName(soundId, newName);
        }
    }
}