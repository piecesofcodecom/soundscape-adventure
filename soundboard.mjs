import Mood from "./mood.mjs";
import utils from './utils/utils.mjs';
import constants from "./utils/constants.mjs";

//FIXME (BACK) quando um mood é parado, os sons randomicos ainda continuam todando. arrumar isso.
//FIXME (BACK) esta salvando muitas vezes o json
//FIXME (BACK) o ajude de volume nao volta certo. depois q ajusta o volume de um som em andamento, e faz refresh da tela a barra de som nao aparece no lugar certo.
//TODO (BACK) Remove sounds not founds in the folders from the soundboard and playlist
export default class SoundBoard {
    /* Variables */
    playlist;
    playlistId;
    path;
    isPlaying = false;
    moods = [];
    //sounds = [];
    soundConfigs = [];
    name;
    playlistConfigFile="playlist-config.json";
    moodsConfigFile="moods-config.json";
    soundsConfigFile="sound-list.json";

    constructor(path) {
        this.path = path;
        this.playlistId = "";
        this.playlist = null;
        this.soundConfigs = [];
        this.name = `Soundboard: ${path.split("/").pop()}`;
        
    }

    //FIXME (BACK) Veriy why the board/mood is not syncing with the playlist (change sound name in the playlist doesnt change in the board)
    //FIXME (BACK) soundboard is not loading previous sound volumes
    async init_soundboard() {
        //process the folder
        utils.log(utils.getCallerInfo(),`Maping files for '${this.name}' in ${this.path}`);
        const subfolders = await FilePicker.browse('data', this.path, { recursive: true });
        for (const dir of subfolders.dirs) {
            await this.loadSoundsOfType(dir, dir.split("/").pop());
        }
        
        // validate moods
        await this.loadMoods();
        // check if a playlist already exists
        utils.log(utils.getCallerInfo(),`Init Soundboard ${this.path}`);
        if (!this.playlistId) {
            utils.log(utils.getCallerInfo(),`Searching for a Playlist with name ${this.name}`);
            for(let i=0; i < game.playlists._source.length; i++) {
                if (game.playlists._source[i].name == this.name) {
                    this.playlist = await game.playlists.get(game.playlists._source[i]._id);
                    utils.log(utils.getCallerInfo(),`Found Playlist ${this.playlist.name}`);
                    this.playlistId = this.playlist._id;
                    this.syncPlaylistToSoundConfig();
                } 
            }
            if (this.playlistId == "") {
                utils.log('Playlist not found');
                await this._playlistRecreate()
            }
        }
    }

    async loadMoods() {
        utils.log(utils.getCallerInfo(),"Checking for mood configuration");
        const folder = await FilePicker.browse('data', this.path, { recursive: true });
        let moodConfigFile = "";
        for (const file of folder.files) {
            if (file.includes(this.moodsConfigFile)) {
                moodConfigFile = file;
            }
        }
        if(moodConfigFile.length) {
            try {
                const response = await fetch(moodConfigFile);
                const contents = await response.json();
                utils.log(utils.getCallerInfo(),`Previous mood configuration has been retrieved '${moodConfigFile}'`);
                for(let i = 0; i < contents.length ; i++) {
                    const moodconfig = contents[i];
                    
                    utils.log(utils.getCallerInfo(),`Processing mood '${moodconfig.name}' currently with ${moodconfig.sounds.length} sounds`);
                    const mood = await this.moods.find(el => el.name == moodconfig.name);
                    if (mood) {
                        utils.log(utils.getCallerInfo(),`Found existing mood '${moodconfig.name}'. Updating sounds`);
                        await mood.updateSounds(this.soundConfigs);
                    } else {
                        utils.log(utils.getCallerInfo(),`Mood '${moodconfig.name}' doesn't exist. Creating from file ${moodConfigFile} that contains ${moodconfig.sounds.length} pre-confgured sounds`);
                        const newMood = new Mood(moodconfig.name, moodconfig.sounds, moodconfig.status);
                        await newMood.updateSounds(this.soundConfigs);
                        this.moods.push(newMood);
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

    // when a playlist exists in the world
    async loadSoundsFromPlaylist(playlistID) {
        this.playlistId = playlistID;
        this.playlist = await game.playlists.get(playlistID);
    }

    async _playlistRecreate() {
        utils.log(utils.getCallerInfo(),`Recreating playlist ${this.name}`);
        let newPlaylistData = {
            name: this.name,
            description: "This is a playlist managed by SBAdventure",
            folder: null,  // If you have a specific folder, provide its ID
            sorting: "a",  // Sorting method: "a" for alphabetic, "m" for manual
            mode: 2,  // Play mode: 0 for sequential, 1 for shuffle, 2 for simultaneous
            playing: false,  // Whether the playlist is currently playing
            sounds: this.soundConfigs
          };
          
          // Create the new playlist
          this.playlist = await Playlist.create(newPlaylistData);
          this.playlistId = this.playlist._id;
    }

    async syncPlaylistToSoundConfig() {
        const sounds = Array.from(this.playlist.sounds);
        let has_changes = false;
        for( let i=0; i < sounds.length; i++) {
            const local_config = await this.soundConfigs.find(el => el.path == sounds[i].path);
            if(local_config) {
                if(local_config.name != sounds[i].name || local_config.volume != sounds[i].volume) {
                    local_config.name = sounds[i].name;
                    local_config.volume = sounds[i].volume;
                }
            } else {
                // TODO: (BACK) need to implement the update soundConfigs and moods with latest files from playlist
                utils.log("TODO INPLEMENT")
            }
        }

        //Update the sounds in the moods
        if(has_changes) {
            for (let i=0; i<this.moods.length;i++) {
                await this.moods[i].updateSounds(this.soundConfigs);
            }
            this.saveMoodsConfig();
        }
    }

    async updatePlaylist() {
        console.log(`Updating playlist ${this.playlistId}`);
        console.log(this.soundConfigs);
        console.log(this.playlist.sounds);
        const current_sounds = Array.from(this.playlist.sounds);
        const sounds = this.soundConfigs;
        for (let i =0; i< sounds.length; i++) {
            const sd = await current_sounds.find(el => el.path == sounds[i].path);
            if(!sd) {
                console.log(`A new sound ${sounds[i].name} needs to be added to the playlist`)
                let newSound = {
                    name: sounds[i].name,
                    path: sounds[i].path,
                    playing: false,
                    repeat: false,
                    volume: sounds[i].volume
                };
                await this.playlist.createEmbeddedDocuments("PlaylistSound", [newSound])
                /*this.playlist.update({
                    sounds: [...this.playlist.sounds, newSound]
                })*/
            }
        }
    }
    // when the playlist doesnt exist
    async buildPlaylist() {
        console.log(`Building a playlist for ${this.name}`);
        let playlistData = {
            name: this.name,
            description: "A playlist managed by Soundboard Adventure",
            mode: 2, // 0 = Sequential, 1 = Shuffle, 2 = Simultaneous
            playing: false,
            sounds: this.soundConfigs
        };
        console.log(playlistData);
        this.playlist = await Playlist.create(playlistData);
        this.playlist_id = this.playlist._id;

        console.log(`The playlist ${this.playlist.name} has been created`);
    }

    async _hasConfig() {
        console.log("Checking for configuration");
        const folder = await FilePicker.browse('data', this.path, { recursive: true });
        let hasConfig=false;
        let playlistConfig = "";
        let soundsConfigFile = "";
        for (const file of folder.files) {
            if (file.includes("playlist-config.json")) {
                console.log("soudboard config found");
                playlistConfig = file;
            } else if (file.includes(this.soundsConfigFile)) {
                console.log("sounds config found");
                soundsConfigFile = file;
            }
        }

        if(playlistConfig.length && soundsConfigFile.length) {
            console.log(`Previous configuration has been retrieved '${this.name}'`);
            this.playlist = game.playlists.filter(el => el.name == this.name)[0];
            const response = await fetch(soundsConfigFile);
            const contents = await response.json();
            this.soundConfigs = contents;
            if (this.playlist) {
                console.log(`Playlist '${this.name}' has been retrieved`);
                hasConfig = true;
            } else {
                // will need to re-create the playlist
                console.log("Playlist doesn't exist in this world")
                return await this._playlistRecreate(playlistConfig);
            }
        }
        return hasConfig;
        
    }

    async saveMoodsConfig() {
        console.log(`Saving moods for ${this.name} to ${this.path}`)
        try {
            const blob = new Blob([JSON.stringify(this.moods, null, 2)], { type: 'application/json' });
            const file = new File([blob], this.moodsConfigFile, { type: 'application/json' });
            await FilePicker.upload('data', this.path, file)
        } catch (error) {
            console.error(`Error saving moods for ${this.name}:`, error);
        }
    }

    async loadSoundsOfType(path, type) {
        utils.log(utils.getCallerInfo(),`Loading sounds of type '${type}' from '${path}'`)
        if (!["Ambience", "Loop", "Random", "Soundpad"].includes(type)) {
            console.log(`Sounds of type ${type} aren't supported`);
            return;
        }
        try {
            const subfolder = await FilePicker.browse('data', path, { recursive: true });
            for (const file of subfolder.files) {
                if (file.includes(".mp3")) {
                    await this.appendSound(file.split("/").pop(), file, type);
                }
            }
        } catch (error) {
            utils.log(utils.getCallerInfo(),`Error loading sounds of type ${type}:`, constants.LOGLEVEL.ERROR, error);
        }
    }
    async appendSound(name, path, type) {
        utils.log(utils.getCallerInfo(),`Adding new sound ${name} to the ${this.name}`);
        let soundData = {
            _id: foundry.utils.randomID(16),
            name: name,
            description: "This sound is managed by the Soundboard Adventure",
            path: path, // Path to the sound file
            repeat: ["Soundpad", "Random"].includes(type) ? false : true,
            volume: 5.5,
            type: type
        };
        const existing_sound = await this.soundConfigs.find(el => el.path == path);
        if(!existing_sound) {
            this.soundConfigs.push(soundData);
        } else {
            utils.log(utils.getCallerInfo(),`Sound ${path} is already in the soundboard ${this.name}`);
        }
    }

    async newMood(name) {
        console.log(`Create new mood ${name}`);
        this.moods.push(new Mood(name, this.soundConfigs));
        await this.saveMoodsConfig();
    }
    async playSound(moodName, path) {
        console.log("Play sound", path);
        console.log(this.soundConfigs);
        const sound = await this.soundConfigs.find(el => el.path == path);
        console.log(sound);
        sound.status = "on";
        //this.saveMoodsConfig();
        if(sound){
            const s = await this.playlist.sounds.find(el => el.path == sound.path);
            //const config = this.soundConfigs.find(el => el.path = sound.path);
            if(s) {
                if (sound.type.toLowerCase() == "random") {
                    console.log("Schedule random sound");
                    this.playAfterDuration(moodName, s.path, utils.randomWaitTime());
                } else {
                    this.playlist.playSound(s);
                }
            }
        }
    }

    async stopSound(moodName, path) {
        console.log("Play sound", path);
        console.log(this.soundConfigs);
        const sound = await this.soundConfigs.find(el => el.path == path);
        console.log(sound);
        sound.status = "on";
        this.saveMoodsConfig();
        if(sound){
            const s = await this.playlist.sounds.find(el => el.path == sound.path);
            //const config = this.soundConfigs.find(el => el.path = sound.path);
            if(s) {
                this.playlist.stopSound(s);
            }
        }
    }

    async reScanFolder() {
        await this.init_soundboard()

    }

    async changeSoundVolume(moodName, path, newVolume) {
        console.log("NEW VOL?UME")
        console.log("new volume", newVolume/100);
        const sound = await this.playlist.sounds.find(el => el.path == path);
        const mood_config = await this.moods.find(el => el.name == moodName);
        if(sound  && mood_config) {
            const sound_config = await mood_config.sounds.find(el => el.path == path);
            if (sound_config) {
                sound_config.volume = newVolume;
                sound.update({ volume: newVolume/100 });
                this.saveMoodsConfig();
            }
        }
    }

    playAfterDuration(name, path, delay) {
        console.warn(`schedule play ${name}: ${path} with delay ${delay}`);
        setTimeout(async () => {
            console.warn(`playing ${name}: ${path}`);
            const mood = await this.moods.find(el => el.name === name);
            const sound = await mood.sounds.find(el => el.path === path);
            console.warn(`playing delayed sound ${path} from mood ${name} ${mood.status} ${sound.status}`);
            if (mood.status === "playing" && sound) {
                if (sound.status === "on") {
                    const s = await this.playlist.sounds.find(el => el.path === path);
                    console.warn("PLAYING IT", path, sound);
                    console.warn(s);
                    this.playlist.playSound(s);
                    this.playAfterDuration(name, path, utils.randomWaitTime());
                }
            }
        }, delay);
    }
    
    async playMood(moodName) {
        console.log(`Playing mood ${moodName}`);
        this.isPlaying = true;
        const mood = this.moods.filter(el => el.name == moodName)[0];
        if(mood) {
            mood.status = "playing";
            const sounds = mood.sounds.filter(el => el.status == "on");
            for (let i=0; i<sounds.length; i++) {
                console.warn(`Processing sound ${sounds[i].path}`);
                const s = await this.playlist.sounds.find( sound => sound.path == sounds[i].path);
                console.warn(s);
                const newVolume = sounds[i].volume;
                if (sounds[i].type.toLowerCase() == "random") {
                    console.warn(`Schedule random sound ${s.path}`);
                    this.playAfterDuration(moodName, s.path, utils.randomWaitTime());
                } else {
                    console.warn(`Simple play the sound ${s.path}`);
                    s.update({ volume: newVolume/100 });
                    this.playlist.playSound(s);
                }
            }
        }
    }

    async deleteMood(moodName) {
        const mood = this.moods.findIndex(el => el.name == moodName);
        if (mood > -1) {
            this.moods.splice(mood,1);
            this.saveMoodsConfig();
        }
    }
    async stopAll() {
        //alert(this.moods.length)
        for (let i=0;i>this.moods.length;i++) {
            this.moods[i].status="stop";
        }
        console.log(this.moods);
        this.saveMoodsConfig();
    }
}

