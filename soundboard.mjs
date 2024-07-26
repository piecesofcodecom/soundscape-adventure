import Mood from "./mood.mjs";
import utils from './utils/utils.mjs';
import constants from "./utils/constants.mjs";

//FIXME (BACK) quando um mood é parado, os sons randomicos ainda continuam todando. arrumar isso.
//FIXME (BACK) esta salvando muitas vezes o json
//FIXME (BACK) o ajude de volume nao volta certo. depois q ajusta o volume de um som em andamento, e faz refresh da tela a barra de som nao aparece no lugar certo.
//TODO (BACK) Remove sounds not founds in the folders from the soundboard and playlist
//FIXME se nao tem playlist, so cria a soundboard vazia e deixa ela disponivel para o load SoundBoard
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
        this.status = "offline";
        this.playlistId = "";
        this.playlist = null;
        this.soundConfigs = [];
        this.name = `Soundboard: ${path.split("/").pop()}`;
        
    }

    //FIXME (BACK) Veriy why the board/mood is not syncing with the playlist (change sound name in the playlist doesnt change in the board)
    //FIXME (BACK) soundboard is not loading previous sound volumes
    async init_soundboard() {
        this.status = "online";
        utils.log(utils.getCallerInfo(),`Maping files for '${this.name}' in ${this.path}`);
        const subfolders = await FilePicker.browse('data', this.path, { recursive: true });

        // load all files in each folder
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
            await this.loadSoundsOfType(dir, sound_type);
        }
        
        // check if a playlist already exists
        utils.log(utils.getCallerInfo(),`Init Soundboard ${this.path}`);
        if (!this.playlistId) {
            utils.log(utils.getCallerInfo(),`Searching for a Playlist with name ${this.name}`);
            for(let i=0; i < game.playlists._source.length; i++) {
                if (game.playlists._source[i].name == this.name) {
                    this.playlist = await game.playlists.get(game.playlists._source[i]._id);
                    utils.log(utils.getCallerInfo(),`Found Playlist ${this.playlist.name}`);
                    this.playlistId = this.playlist._id;
                    //TODO review how the sync happens and its logic
                    this.syncPlaylistToSoundConfig();
                } 
            }
            if (this.playlistId == "") {
                utils.log('Playlist not found');
                await this._playlistRecreate()
            }
        }

        // validate moods
        await this.loadMoods();
        // sync soundboard
        await this.syncSoundboard()
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
        for( let i=0; i < sounds.length; i++) {
            const local_config = await this.soundConfigs.find(el => el.path == sounds[i].path);
            if(local_config) {
                if(local_config.name != sounds[i].name || local_config.volume != sounds[i].volume) {
                    local_config.name = sounds[i].name;
                }
            } else {
                // TODO: (BACK) need to implement the update soundConfigs and moods with latest files from playlist
                utils.log("TODO INPLEMENT")
            }
        }
    }

    async _syncNewFilesToPlaylist() {
        utils.log(utils.getCallerInfo(),`Syncing new files to the playlist ${this.playlistId}`);
        const playlist_sounds = Array.from(this.playlist.sounds);
        const sounds = this.soundConfigs;
        for (let i = 0; i< sounds.length; i++) {
            const sd = await playlist_sounds.find(el => el.path == sounds[i].path);
            if(!sd) {
                utils.log(utils.getCallerInfo(),`A new sound ${sounds[i].path} needs to be added to the playlist`)
                let newSound = {
                    name: sounds[i].name,
                    path: sounds[i].path,
                    playing: false,
                    repeat: sounds[i].repeat,
                    volume: sounds[i].volume
                };
                await this.playlist.createEmbeddedDocuments("PlaylistSound", [newSound])
            }
        }
    }

    async _syncRemovedFilesToPlaylist() {
        utils.log(utils.getCallerInfo(),`Syncing removed files to the playlist ${this.playlistId}`);
        const playlist_sounds = Array.from(this.playlist.sounds);
        const sounds = this.soundConfigs;
        for (let i =0; i< playlist_sounds.length; i++) {
            const sd = await sounds.find(el => el.path == playlist_sounds[i].path);
            if(!sd) {
                utils.log(utils.getCallerInfo(),`A removed sound ${playlist_sounds[i].path} needs to be deleted from the playlist`);
                await this.playlist.deleteEmbeddedDocuments("PlaylistSound", [playlist_sounds[i].id]);
            }
        }
    }

    async syncSoundboard() {
        await this._syncMood();
        await this._syncPlaylist();
    }

    async _syncMood() {
        for (let i = 0; i < this.moods.length; i++) {
            utils.log(utils.getCallerInfo(),`Syncing mood ${this.moods[i].name}`);
            await this.moods[i].syncMood(this.soundConfigs);
        }
    }

    async _syncPlaylist() {
        utils.log(utils.getCallerInfo(),`Syncing playlist ${this.playlistId}`);
        await this._syncNewFilesToPlaylist();
        await this._syncRemovedFilesToPlaylist();
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

    /*async _hasConfig() {
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
            utils.log(utils.getCallerInfo(),`Previous configuration has been retrieved '${this.name}'`);
            this.playlist = game.playlists.filter(el => el.name == this.name)[0];
            const response = await fetch(soundsConfigFile);
            const contents = await response.json();
            this.soundConfigs = contents;
            if (this.playlist) {
                console.log(`Playlist '${this.name}' has been retrieved`);
                hasConfig = true;
            } else {
                // will need to re-create the playlist
                utils.log(utils.getCallerInfo(),"Playlist doesn't exist in this world")
                return await this._playlistRecreate(playlistConfig);
            }
        }
        return hasConfig;
        
    }*/

    async saveMoodsConfig() {
        utils.log(utils.getCallerInfo(),`Saving moods for ${this.name} to ${this.path}`)
        try {
            const blob = new Blob([JSON.stringify(this.moods, null, 2)], { type: 'application/json' });
            const file = new File([blob], this.moodsConfigFile, { type: 'application/json' });
            await FilePicker.upload('data', this.path, file)
        } catch (error) {
            utils.log(utils.getCallerInfo(),`Error saving moods for ${this.name}:`, constants.LOGLEVEL.ERROR, error);
        }
    }

    async loadSoundsOfType(path, type) {
        utils.log(utils.getCallerInfo(),`Loading sounds of type '${type}' from '${path}'`)
        if (type == constants.SOUNDTYPE.INVALID) {
            console.log(`Sounds of type ${type} aren't supported`);
            return;
        }
        try {
            const subfolder = await FilePicker.browse('data', path, { recursive: true });
            for (const file of subfolder.files) {
                if (file.includes(".mp3")) {
                    if (type == constants.SOUNDTYPE.GROUP_LOOP || type == constants.SOUNDTYPE.GROUP_RANDOM) {
                        await this.appendSound(file.split("/").pop(), file, type, path.split("/").pop());
                    } else {
                        await this.appendSound(file.split("/").pop(), file, type);
                    }
                }
            }
            if (type == constants.SOUNDTYPE.LOOP || type == constants.SOUNDTYPE.RANDOM) {
                const subfolderType = (type == constants.SOUNDTYPE.LOOP) ? constants.SOUNDTYPE.GROUP_LOOP : constants.SOUNDTYPE.GROUP_RANDOM;
                for (const dir of subfolder.dirs) {
                    this.loadSoundsOfType(dir, subfolderType);
                }
            }
        } catch (error) {
            utils.log(utils.getCallerInfo(),`Error loading sounds of type ${type}:`, constants.LOGLEVEL.ERROR, error);
        }
    }

    async loadSoundGroups(dir, type) {

    }
    async appendSound(name, path, type, group="") {
        utils.log(utils.getCallerInfo(),`Adding new sound ${name} with group '${group}' to the ${this.name}`);
        let soundData = {
            _id: foundry.utils.randomID(16),
            name: name,
            description: "This sound is managed by the Soundboard Adventure",
            path: path, // Path to the sound file
            repeat: (constants.SOUNDTYPE.LOOP === type || constants.SOUNDTYPE.AMBIENCE === type || constants.SOUNDTYPE.GROUP_LOOP),// ? false : true,
            volume: 0,
            type: type,
            group: group,
            intensity: 0
        };
        const existing_sound = await this.soundConfigs.find(el => el.path == path);
        if(!existing_sound) {
            this.soundConfigs.push(soundData);
        } else {
            utils.log(utils.getCallerInfo(),`Sound ${path} is already in the soundboard ${this.name}`);
        }
    }

    async newMood(name) {
        utils.log(utils.getCallerInfo(),`Create new mood ${name}`);
        const mood = new Mood(name, this.soundConfigs);
        this.moods.push(mood);
        await this.saveMoodsConfig();
        Hooks.callAll("SBAdventureNewMood", name, mood);
    }
    async playSound(moodName, path) {
        utils.log(utils.getCallerInfo(),`Play sound ${path}`);
        const sound = await this.soundConfigs.find(el => el.path == path);
        const mood = await this.moods.find(el => el.name == moodName);
        sound.status = "on";
        const currentPlaying = await game.settings.get('soundboard-adventure', 'current-playing').split(",");

        if (currentPlaying.length == 2) {
            if (moodName == currentPlaying[1] &&  this.name == currentPlaying[0]) {
                if(sound) {
                    const s = await this.playlist.sounds.find(el => el.path == sound.path);
                    if(s) {
                        if (sound.type == constants.SOUNDTYPE.RANDOM || sound.type == constants.SOUNDTYPE.GROUP_RANDOM) {
                            utils.log(utils.getCallerInfo(),`Schedule random sound ${path} from a group '${sound.group}'`);
                            this.playAfterDuration(moodName, s.path, sound.group, utils.randomWaitTime());
                        } else {
                            // it is a loop or group
                            this._playSound(s, moodName, sound.group);
                        }
                    }
                Hooks.callAll("SBAdventure-PlayingMood", this.name, moodName, mood);
                }
            }
        }
    }

    async _playsound(sound, moodName, group) {
        if (group == '') {
            this.playlist.playSound(sound);
        } else {
            this._playGroup(moodName, group);
        }
    }

    async _playGroup(moodName, group) {
        const mood = this.moods.find(el => el.name == moodName);
        alert("asd")
        mood.playFromGroup(group, this.playlist);

    }

    async stopSound(moodName, path) {
        utils.log(utils.getCallerInfo(),`Play sound ${path}`);
        const mood = this.moods(el => el.name == moodName);
        if (mood) {
            mood.stopSound(path, this.playlist);
        }
    }

    async reScanFolder() {
        await this.init_soundboard();
        await this.saveMoodsConfig();

    }

    async changeSoundVolume(moodName, path, newVolume) {
        //const sound = await this.playlist.sounds.find(el => el.path == path);
        const mood = await this.moods.find(el => el.name == moodName);
        if (mood) {
            mood.changeSoundVolume(path, newVolume, this.playlist);
        }
    }

    async changeSoundIntensity(moodName, group, value) {
        const mood = this.moods.find(el => el.name == moodName);
        if (mood) {
            mood.changeSoundIntensity(group, value, this.playlist);
        }
    }
    
    

    playAfterDuration(name, path, group, delay) {
        console.warn(`schedule to play mood '${name}' of the group '${group}' or the sound '${path}' with delay '${delay}'`);
        setTimeout(async () => {
            const mood = await this.moods.find(el => el.name === name);
            const sound = await mood.sounds.filter(el => el.path === path);
            if (mood.status == "playing" && sound.length > 0) {
                if (sound[0].status == "on") {
                    if (group == "") {
                        const s = await this.playlist.sounds.find(el => el.path === path);
                        console.warn(`Playing scheduled sound '${path}' for mood '${name}' `);
                        this.playlist.playSound(s);
                        // delay to play + duration to avoid play the same sound during current execution
                        this.playAfterDuration(name, path, utils.randomWaitTime() + s.duration);
                    } else {
                        mood.playRandomFromGroup(group, this.playlist);
                    }
                    
                }
            } else {
                console.warn(`Canceled scheduled sound '${path}' for mood '${name}' `);
            }
        }, delay);
    }

    async enableSound(moodName, path) {
        const mood = this.moods.find(el => el.name == moodName);
        if (mood) {
            mood.enableSound(path, this.playlist);
        }
    }

    async disableSound(moodName, path) {
        const mood = this.moods.find(el => el.name == moodName);
        if (mood) {
            mood.disableSound(path, this.playlist);
        }
    }
    
    async playMood(moodName) {
        const currentconfig = await game.settings.get('soundboard-adventure', 'current-playing').split(",");
       
        if (currentconfig.length == 2) {
            await this.stopMood(currentconfig[1])
        }
        await game.settings.set('soundboard-adventure', 'current-playing', `${this.name},${moodName}`);
        this.isPlaying = true;
        const mood = this.moods.find(el => el.name == moodName);
        if(mood) {
            mood.play(this.playlist);
        }
    }

    async deleteMood(moodName) {
        const mood = this.moods.findIndex(el => el.name == moodName);
        if (mood > -1) {
            this.moods.splice(mood,1);
            this.saveMoodsConfig();
        }
    }
    async stopMood(moodName) {
        await game.settings.set('soundboard-adventure', 'current-playing', "");
        const mood = await this.moods.find(el => el.name == moodName);
        mood.status = "stop";
        this.isPlaying = false;
        await this.playlist.stopAll();
    }
    async stopAll() {
        for (let i=0;i>this.moods.length;i++) {
            this.moods[i].status="stop";
        }
        this.isPlaying = false;
    }
}

