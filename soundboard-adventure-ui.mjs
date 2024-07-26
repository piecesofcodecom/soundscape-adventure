import SoundboardAdventure from "./soundboard-adventure.mjs";
import utils from './utils/utils.mjs';
//FIXME Implementar confirmacao antes de deletar mood
class SoundBoardAdventureUI {
    //playlists;
    constructor() {
        if (SoundBoardAdventureUI.instance) {
            return SoundBoardAdventureUI.instance;
        }
        SoundBoardAdventureUI.instance = this;
        
        return this;
    }

    async init(html) {
        this.playlists = {};
        this.moodControls = null;
        utils.log(utils.getCallerInfo(),"Init SoundBoard UI")
        await SoundboardAdventure.init();
        utils.log(utils.getCallerInfo(),"Adding main button");
        this.addLoadButton(html);
        utils.log(utils.getCallerInfo(),"Loading Configuration");
        await this.loadConfiguration(html);
        const moodControlsElement = await html.find("#mood-controls");
        //alert(moodControlsElement.length)
        if (!this.moodControls) {
            await this._createMoodControls(html);
        }
    }

    async updateSoundboards() {
        this._updateHtml();
        //this._removeplaylists();
        //this._populateSoundboard();

    }

    updateMoodControlsUI(soundboardName, moodName, mood) {
        const playlistSounds = this.moodControls.querySelector(".playlist-sounds");
        let title = this.moodControls.querySelector("h4");
        title.inneHTML = `Current Mood Playing: ${moodName} <i class="collapse fa fa-angle-down"></i>`;
        console.log(playlistSounds);
        //alert(playlistSounds);
        playlistSounds.innerHTML = "";
        const playingSounds = mood.sounds.filter(el => el.status == "on");
        const groups = [];
        for (let i=0; i< playingSounds.length; i++) {
            if ( playingSounds[i].group.length > 0) {
                if (!groups.includes(playingSounds[i].group)) {
                    groups.push(playingSounds[i].group);
                    let newLi = document.createElement('li');
                    newLi.className = "sound flexrow";
                
                    let newH4 = document.createElement('h4');
                    newH4.innerText = `Group: ${playingSounds[i].group}`;
                    newLi.appendChild(newH4);

                    let newI = document.createElement("i");
                    newI.className = "volume-icon fas fa-volume-down";
                    newLi.appendChild(newI);

                    let newInput = document.createElement("input");
                    newInput.className = "control-volume global-volume-slider";
                    newInput.setAttribute("name", "globalPlaylistVolume");
                    newInput.setAttribute("type","range");
                    newInput.setAttribute("value",playingSounds[i].volume);
                    newInput.setAttribute("min","0");
                    newInput.setAttribute("max","1");
                    newInput.setAttribute("step","0.05");
                    newInput.setAttribute("data-tooltip","Volume: "+playingSounds[i].volume*100+"%");
                    newInput.setAttribute("aria-label","Music");
                    //Dataset
                    newInput.setAttribute("data-group",playingSounds[i].group);
                    newInput.setAttribute("data-mood-name",moodName);
                    newInput.setAttribute("data-soundboard-name",soundboardName);
                    
                    newInput.addEventListener('click', (event) => {
                        SoundboardAdventure.sidebarControls(event)
                    });
                    newLi.appendChild(newInput);

                    playlistSounds.appendChild(newLi);
                    // ADD INTENSITY Control
                    let newIntensity = document.createElement('li');
                    newIntensity.className = "sound flexrow";
                
                    let newH42 = document.createElement('h4');
                    newH42.innerText = "";
                    newIntensity.appendChild(newH42);

                    let newI2 = document.createElement("i");
                    newI2.className = "volume-icon fa-solid fa-dial-min";
                    newIntensity.appendChild(newI2);

                    let newInput2 = document.createElement("input");
                    newInput2.className = "control-volume global-volume-slider";
                    newInput2.setAttribute("name", "globalPlaylistVolume");
                    newInput2.setAttribute("type","range");
                    newInput2.setAttribute("value",playingSounds[i].intensity);
                    newInput2.setAttribute("min","0");
                    newInput2.setAttribute("max","100");
                    newInput2.setAttribute("step","5");
                    newInput2.setAttribute("data-tooltip","Volume: "+playingSounds[i].intensity+"%");
                    newInput2.setAttribute("aria-label","Music");
                    //Dataset
                    newInput2.setAttribute("data-group",playingSounds[i].group);
                    newInput2.setAttribute("data-mood-name",moodName);
                    newInput2.setAttribute("data-soundboard-name",soundboardName);

                    newInput2.addEventListener('click', (event) => {
                        SoundboardAdventure.sidebarControls(event)
                    });
                    newIntensity.appendChild(newInput2);
                    playlistSounds.appendChild(newIntensity);

                }
            } else {
                let newLi = document.createElement('li');
                newLi.className = "sound flexrow";
                
                let newH4 = document.createElement('h4');
                newH4.innerText = playingSounds[i].name;
                newLi.appendChild(newH4);

                let newI = document.createElement("i");
                newI.className = "volume-icon fas fa-volume-down";
                newLi.appendChild(newI);

                let newInput = document.createElement("input");
                newInput.className = "control-volume global-volume-slider";
                newInput.setAttribute("name", "globalPlaylistVolume");
                newInput.setAttribute("type","range");
                newInput.setAttribute("value",playingSounds[i].volume);
                newInput.setAttribute("min","0");
                newInput.setAttribute("max","1");
                newInput.setAttribute("step","0.05");
                newInput.setAttribute("data-tooltip","Volume: "+playingSounds[i].volume*100+"%");
                newInput.setAttribute("aria-label","Music");
                //Dataset
                newInput.setAttribute("data-path",playingSounds[i].patth);
                newInput.setAttribute("data-mood-name",moodName);
                newInput.setAttribute("data-soundboard-name",soundboardName);

                newInput.addEventListener('click', (event) => {
                    SoundboardAdventure.sidebarControls(event)
                });
                newLi.appendChild(newInput);

                playlistSounds.appendChild(newLi);
                }
            


        }
        /*
this.moodControls.innerHTML = `<div id="global-volume" class="global-control flexrow ">
            <header class="playlist-header flexrow">
                <h4>Current Mood Playing <i class="collapse fa fa-angle-down"></i></h4>
            </header>
            <ol class="playlist-sounds">
                <li class="sound flexrow" data-tooltip="AUDIO.CHANNELS.MUSIC.tooltip">
                    <h4>Our Montain</h4>
                    <i class="volume-icon fas fa-volume-down"></i>
                    <input class="global-volume-slider" name="globalPlaylistVolume" type="range" value="0.35" min="0" max="1" step="0.05" data-tooltip="Volume: 35%" aria-label="Music">
                </li>
                <li class="sound flexrow" data-tooltip="AUDIO.CHANNELS.ENVIRONMENT.tooltip">
                    <h4>River</h4>
                    <i class="volume-icon fas fa-volume-down"></i>
                    <input class="global-volume-slider" name="globalAmbientVolume" type="range" value="0.45" min="0" max="1" step="0.05" data-tooltip="Volume: 45%" aria-label="Environment">
                </li>
                <li class="sound flexrow" data-tooltip="AUDIO.CHANNELS.ENVIRONMENT.tooltip">
                    <h4>Group: Birds</h4>
                    <i class="volume-icon fas fa-volume-down"></i>
                    <input class="global-volume-slider" name="globalAmbientVolume" type="range" value="0.45" min="0" max="1" step="0.05" data-tooltip="Volume: 45%" aria-label="Environment">
                </li>
                <li class="sound flexrow" data-tooltip="AUDIO.CHANNELS.MUSIC.tooltip">
                    <h4></h4>
                    <i class="volume-icon fas fa-dial-min"></i>
                    <input class="global-volume-slider" name="globalPlaylistVolume" type="range" value="0.35" min="0" max="1" step="0.05" data-tooltip="Volume: 35%" aria-label="Music">
                </li>
                
                
                <li class="sound flexrow" data-tooltip="AUDIO.CHANNELS.INTERFACE.tooltip">
                    <h4>Interface</h4>
                    <i class="volume-icon fas fa-volume-down"></i>
                    <input class="global-volume-slider" name="globalInterfaceVolume" type="range" value="0.35" min="0" max="1" step="0.05" data-tooltip="Volume: 35%" aria-label="Interface">
                </li>
            </ol>
        </div>`;
        */

    }

    async _createMoodControls(html) {
        //alert("create")

        // Find the global-volume element
        const moodControlsElement = html.find("#mood-controls");
        //alert(moodControlsElement.length)
        if (moodControlsElement.length == 0) {
            //alert("dasd")
            this.moodControls = document.createElement("div");
            this.moodControls.id = "mood-controls";
            this.moodControls.className = "soundboard-control flexrow"; // Add a class to the new div for styling or identification
            this.moodControls.innerHTML = `<div id="global-volume" class="global-control flexrow ">
            <header class="playlist-header flexrow">
                <h4>Current Mood Playing <i class="collapse fa fa-angle-down"></i></h4>
            </header>
            <ol class="playlist-sounds">
            <li style="width: 100%; text: center">when a mood is playing you can control from here</span>
            </li>
                
            </ol>
            
        </div>`;
            const globalVolumeElement = html.find("#global-volume");
            //alert(globalVolumeElement)
            if (globalVolumeElement) {
                //alert("ads")
                console.log(globalVolumeElement[0].parentNode)
                globalVolumeElement[0].parentNode.insertBefore(this.moodControls, globalVolumeElement[0].nextSibling);
            } else {
                console.error("Elements with class global-volume or current-playing not found");
            }

            

        }
        
    }

    async _updateHtml() {
        const currentconfig = game.settings.get('soundboard-adventure', 'current-playing').split(",");
        let currentPlaying = {
            mood: "",
            soundboard: ""
        }

        if (currentconfig.length == 2) {
            currentPlaying.mood = currentconfig[1];
            currentPlaying.soundboard = currentconfig[0];

        }
        console.log("ASDASDASDSAD", currentconfig)
        console.log("currentPlaying", currentPlaying)
  
        for (let i = 0; i < this.playlists.length; i++) {
            const playlistName = this.playlists[i].querySelector(".playlist-name").innerText.trim();
            const play = this.playlists[i];
            const sb = await SoundboardAdventure.soundboards.find(el => el.name == playlistName /*&& el.status != "online"*/);
            if (sb) {
                await sb.class.init_soundboard();
                const pl = await game.playlists.get(play.dataset.documentId);
                if (pl.playing) {
                    sb.isPlaying = true;
                } else {
                    sb.isPlaying = false;
                    await sb.class.stopAll();
                }
                utils.log(utils.getCallerInfo(),`Playlist ${play.name} associated to the soundboard '${sb.name}'`);
                sb.playlistId = play.dataset.documentId;
                sb.class.playlistId = play.dataset.documentId;
                sb.class.playlist = pl;
                sb.status = "online";
                const controls = play.querySelector('.playlist-controls');
                controls.innerHTML = "";
                const newControl = document.createElement('a');
                newControl.classList.add('soundboard-control', 'fa-solid', 'fa-speaker');
                newControl.dataset.action = 'sound-create';
                newControl.dataset.tooltip = 'PLAYLIST.SoundCreate';
                newControl.dataset.soundboardName = sb.name;
                newControl.addEventListener('click', (event) => {
                    SoundboardAdventure.openSoundboard(event.currentTarget.dataset.soundboardName)
                });

                const newControl2 = document.createElement('a');
                newControl2.classList.add('soundboard-control', 'fa-solid', 'fa-rotate-right');
                newControl2.dataset.action = 'sound-reload';
                newControl2.dataset.tooltip = 'Reload Soundboard'; //PLAYLIST.SoundCreate
                newControl2.dataset.soundboardName = sb.name;
                newControl2.addEventListener('click', (event) => {
                    SoundboardAdventure.scanFiles(event.currentTarget.dataset.soundboardName);
                });

                const mood_list = play.querySelector("ol");
                mood_list.innerHTML = "";
                for(let i=0; i<sb.class.moods.length;i++) {
                    const mood = sb.class.moods[i];
                    
                    let li = document.createElement('li');
                    li.id = mood.name;
                    li.className = 'mood flexrow';
                    li.setAttribute('data-soundboard-name', sb.name);
                    li.setAttribute('data-mood-name', mood.name);
                    li.style.display = 'flex';

                    // Create the <h4> element
                    let h4 = document.createElement('h4');
                    h4.className = 'sound-name';

                    // Create the text node for the <h4> element
                    let textNode = document.createTextNode(mood.name);

                    // Append the text node to the <h4> element
                    h4.appendChild(textNode);

                    // Create the <div> element
                    let div = document.createElement('div');
                    div.className = 'sound-controls flexrow';

                    // Create the first <a> element
                    let a1 = document.createElement('a');
                    a1.className = 'sound-control fa-solid fa-trash';
                    a1.setAttribute('data-action', 'mood-delete');
                    a1.setAttribute('data-tooltip', 'Delete Sound');
                    a1.setAttribute('data-soundboard-name', sb.name);
                    a1.setAttribute('data-mood-name', mood.name);
                    a1.addEventListener('click', (event) => {
                        const dataset = event.currentTarget.dataset;
                        if (dataset.action == "mood-delete") {
                            if(sb) {
                                //TODO after delete, refresh sidebar
                                foundry.applications.api.DialogV2.confirm({
                                    content: "Are you sure?",
                                    rejectClose: false,
                                    modal: true
                                    }).then(proceed => {
                                        if ( proceed ) { 
                                            mood_list.removeChild(li);
                                            sb.class.deleteMood(dataset.moodName);
                                        }
                                    });
                            }
                        }
                    });

                    // Create the second <a> element
                    let a2 = document.createElement('a');
                    console.log("DASDASDASDASDASDDASDASDDASDASDSFGSDXVBXCB")
                    console.log("soundboard");
                    console.log(`'${currentPlaying.soundboard}' == '${sb.name}'`);
                    console.log("Mood");
                    console.log(`'${currentPlaying.mood}' == '${mood.name}'`)
                    if (currentPlaying.soundboard == sb.name && currentPlaying.mood == mood.name) {
                        a2.className = 'soundboard-control fas fa-stop';
                        a2.setAttribute('data-action', 'sound-stop');
                        a2.setAttribute('data-tooltip', 'PLAYLIST.SoundStop');
                        this.updateMoodControlsUI(sb.name, mood.name, mood);
                    } else {
                        a2.className = 'soundboard-control fas fa-play';
                        a2.setAttribute('data-action', 'sound-play');
                        a2.setAttribute('data-tooltip', 'PLAYLIST.SoundPlay');
                    }
                    
                    a2.setAttribute('data-soundboard-name', sb.name);
                    a2.setAttribute('data-mood-name', mood.name);
                    a2.addEventListener('click', async (event) => {
                        const dataset = event.currentTarget.dataset;
                        if (dataset.action == "sound-play") {
                            if(sb) {
                                sb.class.playMood(dataset.moodName);
                                const md = sb.class.moods.find(el => el.name == mood.name);
                                if(md) {
                                    md.status = "playing";
                                    a2.setAttribute('data-action', 'sound-stop');
                                    a2.className = 'soundboard-control fas fa-stop';
                                }
                            } 
                            
                        } else if (dataset.action == "sound-stop") {
                            if(sb) {
                                const md = sb.class.moods.find(el => el.name == mood.name);
                                if(md) {
                                    md.status = "stop";
                                    await sb.class.stopMood(mood.name);
                                    a2.setAttribute('data-action', 'sound-play');
                                    a2.className = 'soundboard-control fas fa-play';
                                }
                            }
                        }
                    });

                    // Append the <a> elements to the <div> element
                    div.appendChild(a1);
                    div.appendChild(a2);

                    // Append the <h4> and <div> elements to the <li> element
                    li.appendChild(h4);
                    li.appendChild(div);
                    mood_list.appendChild(li);

                }
                // Append the new control to the controls div
                controls.appendChild(newControl);
                controls.appendChild(newControl2);
            }

            //TODO arrumar
            //if (currentconfig.soundboard == playlistName) {
            
            //console.log(this.playlists[i].classList.value);
            //this.playlists[i].hide(); //className = "directory-item document playlist flexrow"; //this.playlists[i].classList.value;
            //}
        }
    }

    async loadConfiguration(html) {
        utils.log(utils.getCallerInfo(),"Mapping soundboards to the sidebar");
        const directoryList = html.find('.directory-list');
        if (directoryList.length) {
            this.playlists = directoryList.find('.directory-item');
            this._updateHtml()
        }
    }

    addLoadButton(html) {
        const soundboard_button = html.find('.create-soundboard');
        if (soundboard_button.length == 0) {
            const header = html.find('.header-actions');
            const customButton = $(
                `<button class="create-soundboard">
                    <i class="fas fa-plus"></i> Load SoundBoard
                    </button>`
            );
            customButton.on('click', () => {
                this.loadListSoundbarsDialog();
            });
            header.append(customButton);
        }
    }

    loadListSoundbarsDialog() {
        // Create playlist options for the dialog
        const playlistOptions = SoundboardAdventure.soundboards
            .filter(el => el.status == "offline")
            .map(playlist => { return `<option value="${playlist.name}">${playlist.name}</option>`; })
            .join("");

        // Dialog content
        const content = `
              <form>
                  <div class="form-group">
                  <select name="playlist">
                  <option value="">Select a Playlist</option>
                    ${playlistOptions}
                  </select>
                </div>
                <br />
              </form>
            `;

        // Create and render the dialog
        new Dialog({
            title: "Load Soundboard",
            content: content,
            buttons: {
                create: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Create",
                    callback: async (html) => {
                        const name = html.find('[name="playlist"]').val();
                        await SoundboardAdventure.loadOfflineSoundboard(name);
                        ui.notifications.warn(name);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "create"
        }).render(true);
    }
}

const instance = new SoundBoardAdventureUI();
//Object.freeze(instance); // Optional: to make the instance immutable

export default instance;