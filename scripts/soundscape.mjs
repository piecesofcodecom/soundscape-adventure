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
    advice;
    visible_off_sounds=false;

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

    async init(globalSounds = []) {
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
            for (let i=0; i < globalSounds.length; i++) {
                this._newLocalSound(globalSounds[i].name, globalSounds[i].path, globalSounds[i].type, globalSounds[i].group);
            }
            
            await this.init_local();
        } else {
            utils.log(utils.getCallerInfo(),`The type '${this.type}' isn't implemented yet`, constants.LOGLEVEL.ERROR);
        }
    }

    async init_local() {
        utils.log(utils.getCallerInfo(),`Init Soundspace '${this.name}' within ${this.path}`);
        let missing_folders = "<li>Ambience</li><li>Loop</li><li>Random</li><li>Soundpad</li>";
        const subfolders = await FilePicker.browse('data', this.path, { recursive: false });
        //load sounds to the soundsConfig
        utils.log(utils.getCallerInfo(),`Loading sounds from '${this.path}'`);
        for (const dir of subfolders.dirs) {
            let sound_type = constants.SOUNDTYPE.INVALID;
            switch (dir.split("/").pop().toLowerCase()) {
                case "ambience":
                    sound_type = constants.SOUNDTYPE.AMBIENCE;
                    missing_folders = missing_folders.replace("<li>Ambience</li>","");
                    break;
                case "random":
                    sound_type = constants.SOUNDTYPE.RANDOM;
                    missing_folders = missing_folders.replace("<li>Random</li>","");
                    break;
                case "loop":
                    sound_type = constants.SOUNDTYPE.LOOP;
                    missing_folders = missing_folders.replace("<li>Loop</li>","");
                    break;
                case "soundpad":
                    sound_type = constants.SOUNDTYPE.SOUNDPAD;
                    missing_folders = missing_folders.replace("<li>Soundpad</li>","");
                    break;
                default:
                    sound_type = constants.SOUNDTYPE.INVALID;
                    break;
            }
            await this._loadLocalSounds(dir, sound_type);
        }

        if (missing_folders.length && !SoundscapeAdventure.ui_soundscape_messages.includes(this.name)) {
            SoundscapeAdventure.ui_soundscape_messages.push(this.name);
            const message = `
            <p>The soundscape's directory supports the directories below:</p>
            <ul>
            <li>Ambience: Continuous sounds that play in the background, creating an immersive atmosphere.</li>
            <li>Loop: These sounds also play continuously but are typically shorter and repeat more frequently compared to ambience sounds.</li>
            <li>Random: These sounds play at random intervals, adding an element of unpredictability and variety to the soundscape.</li>
            <li>Soundpad: These sounds are played precisely when clicked. You can use them for specific actions and to enhance the mood whenever you find it necessary.</li>
            </ul>
            <p>The Soundscape "${this.name}" within "${this.path}" doesn't contain the folders below. Please add the pending folders to stop receiving this message</p>
            <ul>
            ${missing_folders}
            </ul>`;
            //const randomNumberInRange = (min, max) => Math.random() * (max - min) + min;
           foundry.applications.api.DialogV2.prompt({
                window: { title: this.name  },
                position: {
                    width: 550, 
                    //top: randomNumberInRange(40, 60),
                    //left: randomNumberInRange(10, 160)
                },
                content: message,
                rejectClose: false,
                ok: {
                    label: "Confirm",
                }
            });

        }
        if (this.playlist != null) {
            await this._syncPlaylist();
            //await this._syncSoundIds();
            await this._loadMoods();
        }
    }

    // enable an offiline soundscape means create a playlist
    // and load the moods
    async enable() {
        await this._createPlaylist();
        await this._syncPlaylist();
        //await this._syncSoundIds();
        await this._loadMoods();
        this.status = "online";
        const soundscapes = await game.settings.get('soundscape-adventure', 'soundscapes')
        await game.settings.set('soundscape-adventure', 'soundscapes', soundscapes + ";" + this.name + "," +this.id);
        await this.saveMoodsConfig();
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

    async reScanFolder() {
        await this.init();
        await this.saveMoodsConfig();
    }

    //TODO sync playlist needs to be within the moodConfig
    // in the future, drag and drop will allow moods to have
    /// sounds from other soundscapes
    async _syncPlaylist() {
        // validates all sounds are in the playlist
        for (let i = 0; i < this.soundsConfig.length; i++) {
             const sound = this.playlist.sounds.filter(el => el.path == this.soundsConfig[i].path);
             if (sound.length == 0) {
                // need to add the sound
                this.soundsConfig[i].id = await this._addSoundToPlaylist(this.soundsConfig[i]);
             } else if (sound.length > 1) {
                this.soundsConfig[i]. id = sound[0].id;
                for( let j = 1; j < sound.length; j++) {
                    // double check that still exists
                    const sound_to_remove = this.playlist.sounds.find(el => el.id == sound[j].id);
                    if (sound_to_remove) {
                        await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [sound_to_remove._id]);
                    }
                }
             } else {
                this.soundsConfig[i].id = sound[0].id;
             }
        }

        // validates all sounds in the playlist are valid
        const sounds = this.playlist.sounds;
        for (let i=0; i < sounds.length; i++) {
            const fileExists = this.validateFileExists(sounds[i].path);
            if (!fileExists) {
                await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [sounds[i]._id]);
            }
        }
    }

    async _addSoundToPlaylist(newSound) {
        utils.log(utils.getCallerInfo(),`Adding a new sound '${newSound.path}' to the playlist '${this.playlist.name}'`)
        await this.playlist.createEmbeddedDocuments("PlaylistSound", [newSound]);
        const sound = this.playlist.sounds.find(obj => obj.path == newSound.path);
        return sound.id;
    }

    async _createPlaylist() {
        utils.log(utils.getCallerInfo(),`Creating playlist '${this.name}'`);
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
            const subfolder = await FilePicker.browse('data', path, { recursive: false });
            for (const file of subfolder.files) {
                const re = /(\.mp3|\.ogg)$/i;
                if (re.exec(file)) {
                    if (type == constants.SOUNDTYPE.GROUP_LOOP || type == constants.SOUNDTYPE.GROUP_RANDOM || type == constants.SOUNDTYPE.GROUP_SOUNDPAD) {
                        await this._newLocalSound(file.split("/").pop(), file, type, path.split("/").pop());
                    } else {
                        await this._newLocalSound(file.split("/").pop(), file, type);
                    }
                }
            }
            if (type == constants.SOUNDTYPE.LOOP || type == constants.SOUNDTYPE.RANDOM || constants.SOUNDTYPE.SOUNDPAD) {
                let subfolderType = -1;
                if (type == constants.SOUNDTYPE.LOOP) subfolderType = constants.SOUNDTYPE.GROUP_LOOP;
                else if (type == constants.SOUNDTYPE.RANDOM) subfolderType = constants.SOUNDTYPE.GROUP_RANDOM;
                else if (type == constants.SOUNDTYPE.SOUNDPAD) subfolderType = constants.SOUNDTYPE.GROUP_SOUNDPAD;
                for (const dir of subfolder.dirs) {
                    await this._loadLocalSounds(dir, subfolderType);
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
            from: 10,
            to: 60,
            fadeIn: 0,
            fadeOut: 0,
            intensity: 0,
            playOnce: false,
            category: ""
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
        const mood = new MoodConfig(_soundsConfig, this.playlist);
        this.moods[_soundsConfig.id] = mood;
        await this.saveMoodsConfig();
        Hooks.callAll("SBAdventureNewMood", name, mood);
    }
    async _loadMoods() {
        utils.log(utils.getCallerInfo(),`Checking moods for ${this.name}`);
        const folder = await FilePicker.browse('data', this.path, { recursive: false });
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
                let name_update = true;
                for(let key in contents) {
                    const moodconfig = contents[key];
                    if (this.moods[moodconfig.id] == null) {
                        const currentPlaying = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
                        let status = "stop";
                        if(currentPlaying.length == 2) {
                            if (currentPlaying[0] == this.id && currentPlaying[1] == moodconfig.id) {
                                status = "playing";
                            }
                        }
                        this.moods[moodconfig.id] = new MoodConfig(moodconfig, this.playlist, status);
                        await this.moods[moodconfig.id].syncFolderSounds(this.soundsConfig);
                        if (status == "playing") {
                            this.playMood(moodconfig.id,false);
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
            const sounds = this.moods[moodId].getEnabledSounds().filter(obj => obj.type != constants.SOUNDTYPE.SOUNDPAD);
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
        const sounds = this.moods[moodId].getEnabledSounds();
        for (let i=0; i < sounds.length; i++ ) {
            this.stopSound(sounds[i], moodId, true);
        }
        //await this.playlist.stopAll();
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
                        } 
                        Hooks.callAll('SoundscapeAdventure-ChangeSoundVolume', this.id, moodId, this.moods[moodId]);
                    } else {
                        utils.log(utils.getCallerInfo(),"Sound not found", constants.LOGLEVEL.ERROR);
                    }
                }
            } else {
                const sound = this.playlist.sounds.get(soundId);
                const soundConfig = this.moods[moodId].getSound(soundId);
                if (sound) {
                    sound.update({ volume: newVolume });
                    this.moods[moodId].changeSoundVolume(soundId, newVolume);
                } else {
                    utils.log(utils.getCallerInfo(),"Sound not found", constants.LOGLEVEL.ERROR);
                }   
            }
        }
    }

    async stopSound(soundConfig, moodId, stop_mood=false) {
        if (soundConfig.type == constants.SOUNDTYPE.GROUP_SOUNDPAD) {
                const sounds = this.moods[moodId].getSoundByGroup(soundConfig.group);
                for (let i=0; i < sounds.length; i++) {
                    this.playlist.stopSound({ id: sounds[i].id });
                }
        } else {
            const s = await this.playlist.sounds.get(soundConfig.id);
            if (s) {
                await s.load();
                if (!stop_mood)
                    this.moods[moodId].disableSound(soundConfig.id);
                if (s.playing) {
                    await s.sound.load();
                    if (soundConfig.fadeOut > 0 && s.sound.currentTime > soundConfig.fadeIn) {
                        s.sound.fade(0, { duration: soundConfig.fadeOut * 1000, from: s.sound.volume }).then( () => {
                            this.playlist.stopSound(s);
                        })
                    } else {
                        this.playlist.stopSound(s)
                    }
                    if (soundConfig.group != "") {
                        this.moods[moodId].active_groups = this.moods[moodId].active_groups.filter(item => item != soundConfig.group);
                    }
                }
            } else {
                console.warn("NOT FOUND",soundConfig)
            }
                
        }
    }

    async _playSound(soundConfig, sound) {
        await sound.load();
        sound.update({ volume: soundConfig.volume });
        await this.playlist.playSound(sound);
        sound.sound.fade(soundConfig.volume, { duration: soundConfig.fadeIn * 1000, from: 0 })
    }

    async playSound(soundConfig, moodId) {
        if (this.moods[moodId].status != "playing" 
            && !(soundConfig.type == constants.SOUNDTYPE.GROUP_SOUNDPAD || soundConfig.type == constants.SOUNDTYPE.SOUNDPAD))
            return;
        if (soundConfig.volume == 0) {
            ui.notifications.warn(`The Sound ${soundConfig.name} is muted. Change the volume before hitting play.`)
        }
        if (soundConfig.type == constants.SOUNDTYPE.GROUP_RANDOM) {
            if(!(this.moods[moodId].active_groups.includes(soundConfig.group))) {
                this.moods[moodId].active_groups.push(soundConfig.group);
                this.playFromGroup(soundConfig.group, moodId);
            }
           
        } if (soundConfig.type == constants.SOUNDTYPE.GROUP_LOOP) {
            if(!(this.moods[moodId].active_groups.includes(soundConfig.group))) {
                this.moods[moodId].active_groups.push(soundConfig.group);
                this.playFromGroup(soundConfig.group, moodId);
            }
        } else if (soundConfig.type == constants.SOUNDTYPE.LOOP || soundConfig.type == constants.SOUNDTYPE.AMBIENCE) {
            const s = await this.playlist.sounds.get(soundConfig.id);
            this.moods[moodId].enableSound(soundConfig.id);
            this._playSound(soundConfig, s)
            
        } else if (soundConfig.type == constants.SOUNDTYPE.RANDOM) {
            this.moods[moodId].enableSound(soundConfig.id);
            this.playAfterDuration2([soundConfig], moodId, soundConfig.group, utils.randomWaitTime(soundConfig.from, soundConfig.to));
        } else if (soundConfig.type == constants.SOUNDTYPE.SOUNDPAD) {
            const s = await this.playlist.sounds.get(soundConfig.id);
            this._playSound(soundConfig, s);
        } else if (soundConfig.type == constants.SOUNDTYPE.GROUP_SOUNDPAD) {
            const sounds = this.moods[moodId].getSoundByGroup(soundConfig.group);
            const randomIndex = Math.floor(Math.random() * sounds.length);
            const s = await this.playlist.sounds.get(sounds[randomIndex].id);
            await this._playSound(soundConfig, s);
        }
    }

    async playFromGroup(group, moodId) {
        const soundGroup = this.moods[moodId].getSoundByGroup(group);
        if (soundGroup.length > 0) {
            if (soundGroup[0].type == constants.SOUNDTYPE.GROUP_RANDOM) {
                this.playAfterDuration2(soundGroup, moodId, group, utils.randomWaitTime(soundGroup[0].from, soundGroup[0].to));
            } else if(soundGroup[0].type == constants.SOUNDTYPE.GROUP_LOOP) {
                this._playLoopGroup(soundGroup, soundGroup[0].intensity, moodId);
            }
        }
    }

    async _playLoopGroup(soundGroup, intensity, moodId) {
        console.warn(soundGroup);
        const segment_size = 100/soundGroup.length;
        let index = Math.floor(intensity / segment_size);
        if (index >= soundGroup.length) index = soundGroup.length-1;
        soundGroup.sort((a, b) => a.path.localeCompare(b.path));
        let soundConfig_to_stop = {};
        let soundConfig_to_play = soundGroup[index];
        let sound_to_play = this.playlist.sounds.get(soundConfig_to_play.id);
        console.warn(soundGroup[index]);
        for (let i=0; i < soundGroup.length; i++) {
            soundGroup[i].intensity = intensity;
            soundGroup[i].status = "on";
            const s = this.playlist.sounds.get(soundGroup[i].id);
            await s.load()
            if (s.playing && i != index) {
                soundConfig_to_stop = soundGroup;
                //this.stopSound(soundGroup[i], moodId);
            }

            if (Object.keys(soundConfig_to_stop).length !== 0) {
                console.warn("STOP", soundConfig_to_stop);
                await this.stopSound(soundConfig_to_stop, moodId);
            } else {
                console.warn("NO sound to stop")
            }
            await this.moods[moodId].enableSound(soundConfig_to_play.id);
            console.warn("PLAY:", sound_to_play);
            await this._playSound(soundConfig_to_play, sound_to_play);
        }
    }

    async changeSoundIntensity(moodId, group, value) {
        if (this.moods[moodId]) {
            const soundGroup = this.moods[moodId].sounds.filter(el => el.group == group);
            this._playLoopGroup(soundGroup, value, moodId);
        }
    }

    async randomSound(sounds,moodId, group, s, idempotency) {
        const config = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (config.length == 2) {
            if (config[0] == this.id && config[1] == moodId) {
                const index = sounds.findIndex(obj => obj.id == s.id);
                if (sounds[index].status == "on") {
                    await this._playSound(sounds[index], s)
                    s.load();
                    if (!sounds[index].playOnce) {
                        const onEndListener = () => {
                            if (this.random_idempotency.includes(idempotency)) {
                                this.random_idempotency.pop(idempotency);
                                this.playAfterDuration2(sounds,moodId, group, utils.randomWaitTime(sounds[index].from, sounds[index].to)) 
                            }
                        }
                        s.sound.removeEventListener('end', onEndListener);
                        s.sound.addEventListener('end', onEndListener);
                    }
                }
            }
        }
    }

    async playAfterDuration2(sounds,moodId, group, delay) {
        
        const idempotency = foundry.utils.randomID(16);
        this.random_idempotency.push(idempotency);
        const config = await game.settings.get('soundscape-adventure', 'current-playing').split(",");
        if (config.length == 2) {
            if (config[0] == this.id && config[1] == moodId) {
                const randomIndex = Math.floor(Math.random() * sounds.length);
                if (sounds[randomIndex].status == "on") {
                    const s = await this.playlist.sounds.get(sounds[randomIndex].id);
                    const timeout = new foundry.audio.AudioTimeout(delay, {callback: () => this.randomSound(sounds,moodId, group, s, idempotency)});
                }
            }
        }
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

    async saveExtas(moodId, soundId, new_interval, new_fade, playOnce) {
       const soundConfig = await this.moods[moodId].getSound(soundId);
       
       Object.assign(soundConfig, new_interval);
       Object.assign(soundConfig, new_fade);
       soundConfig.playOnce = playOnce;
       // if sound is random or random group, i need to schedule a play again
       // need to update the config for all sounds within a group
       if (soundConfig.group != "") {
        const sounds = this.moods[moodId].getSoundByGroup(soundConfig.group);
        for (let i=0; i < sounds.length; i++) {
            Object.assign(sounds[i], new_interval);
            Object.assign(sounds[i], new_fade);
            sounds[i].playOnce = playOnce;
        }
       }
       await this.saveMoodsConfig();
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
                    for (let i=0; i < triggers.length; i++) {
                        if (triggers[i].on == event.region.id && triggers[i].event == event.name) {
                            if (triggers[i].action == "play") {
                                this.playMood(moodId, false);
                            } else if (triggers[i].action == "stop") {
                                this.stopMood(moodId);
                            }
                        }
                    }
                    
                } else {
                    if (this.moods[moodId].status != "playing") continue;
                    const soundConfig = await this.moods[moodId].getSound(soundId);
                    //const triggerConfig = moodTriggers[soundId];
                    const triggers = moodTriggers[soundId];
                    for (let i=0; i < triggers.length; i++) {
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
                for (let i=0; i < sounds.length; i++) {
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
}