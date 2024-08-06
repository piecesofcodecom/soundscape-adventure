import SoundscapeAdventure from "./soundscape-adventure.mjs";
import utils from './utils/utils.mjs';
import constants from "./utils/constants.mjs";
//FIXME Implementar confirmacao antes de deletar mood
class SoundscapeAdventureUI {
    //playlists;
    constructor() {
        if (SoundscapeAdventureUI.instance) {
            return SoundscapeAdventureUI.instance;
        }
        SoundscapeAdventureUI.instance = this;
        
        return this;
    }

    async init(html) {
        this.playlists = {};
        this.moodControls = null;
        utils.log(utils.getCallerInfo(),"Init Soundscape Adventure UI")
        await SoundscapeAdventure.init();
        utils.log(utils.getCallerInfo(),"Adding main button");
        this.addLoadButton(html);
        utils.log(utils.getCallerInfo(),"Loading Configuration");
        await this.loadConfiguration(html);
        this.moodControlsElement = await html.find("#mood-controls");
        if (!this.moodControls) {
            await this._createMoodControls(html);
        }
        this.updateSoundboards();
    }

    async updateSoundboards() {
        this._updateHtml();
    }

    async updateMoodControlsUI(soundboardId, moodId, mood) {
        if (!this.moodControls) {
            return;
        }
        const playlistSounds = this.moodControls.querySelector(".playlist-sounds");
        let title = this.moodControls.querySelector("h4");
        title.innerHTML = `Playing: ${mood.name} <i class="collapse fa fa-angle-down"></i>`;
        playlistSounds.innerHTML = "";
        const playingSounds = mood.getEnabledSounds();
        const groups = [];
        for (let i=0; i< playingSounds.length; i++) {
            if ( playingSounds[i].group.length > 0) {
                if (!groups.includes(playingSounds[i].group)) {
                    groups.push(playingSounds[i].group);
                    let newLi = document.createElement('li');
                    newLi.id = playingSounds[i].id;
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
                    newInput.setAttribute("min","0");
                    newInput.setAttribute("max","1");
                    newInput.setAttribute("step","0.05");
                    newInput.setAttribute("value", playingSounds[i].volume);
                    newInput.setAttribute("aria-label","Music");
                    //Dataset
                    newInput.setAttribute("data-group",playingSounds[i].group);
                    newInput.setAttribute("data-tooltip",`Volume: ${parseInt(playingSounds[i].volume*100)}%`);
                    newInput.setAttribute("data-action","volume");
                    newInput.setAttribute("data-mood-id",moodId);
                    newInput.setAttribute("data-soundboard-id",soundboardId);
                    newInput.setAttribute("data-sound-id",playingSounds[i].id);
                    
                    newInput.addEventListener('click', (event) => {
                        event.currentTarget.setAttribute('data-tooltip',`Volume: ${parseInt(event.currentTarget.value*100)}%`)
                        event.currentTarget.setAttribute('value',event.currentTarget.value);
                        SoundscapeAdventure.sidebarControls(event.currentTarget.dataset, event.currentTarget.value)
                    });
                    newLi.appendChild(newInput);

                    playlistSounds.appendChild(newLi);
                    // ADD INTENSITY Control
                    if (playingSounds[i].type == constants.SOUNDTYPE.GROUP_LOOP) {
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
                        newInput2.setAttribute("data-tooltip","Intensity: "+playingSounds[i].intensity+"%");
                        newInput2.setAttribute("aria-label","Music");
                        //Dataset
                        newInput2.setAttribute("data-group",playingSounds[i].group);
                        newInput2.setAttribute("data-action","intensity");
                        newInput2.setAttribute("data-sound-id",playingSounds[i].id);
                        newInput2.setAttribute("data-mood-id",moodId);
                        newInput2.setAttribute("data-soundboard-id",soundboardId);

                        newInput2.addEventListener('click', (event) => {
                            event.currentTarget.setAttribute('data-tooltip',`${event.currentTarget.value}%`)
                            event.currentTarget.setAttribute('value',event.currentTarget.value);
                            SoundscapeAdventure.sidebarControls(event.currentTarget.dataset, event.currentTarget.value)
                        });
                        newIntensity.appendChild(newInput2);
                        playlistSounds.appendChild(newIntensity);
                    }

                }
            } else {
                
                    let newLi = document.createElement('li');
                    newLi.className = "sound flexrow";
                    newLi.id =  playingSounds[i].id;
                    
                    let newH4 = document.createElement('h4');
                    newH4.innerText = playingSounds[i].name;
                    newLi.appendChild(newH4);

                    let newI = document.createElement("i");
                    newI.className = "volume-icon fas fa-volume-down";
                    newLi.appendChild(newI);

                    let newInput = document.createElement("input");
                    newInput.className = "";
                    newInput.setAttribute("name", "");
                    newInput.setAttribute("type","range");
                    newInput.setAttribute("min","0");
                    newInput.setAttribute("max","1");
                    newInput.setAttribute("step","0.05");
                    newInput.setAttribute("value",playingSounds[i].volume);
                    newInput.setAttribute("data-tooltip","Volume: "+parseInt(playingSounds[i].volume*100)+"%");
                    newInput.setAttribute("aria-label","Music");
                    //Dataset
                    newInput.setAttribute("data-sound-id",playingSounds[i].id);
                    newInput.setAttribute("data-mood-id",moodId);
                    newInput.setAttribute("data-action","volume");
                    newInput.setAttribute("data-soundboard-id",soundboardId);

                    newInput.addEventListener('click', (event) => {
                        event.currentTarget.setAttribute('data-tooltip',`Volume: ${parseInt(event.currentTarget.value*100)}%`)
                        event.currentTarget.setAttribute('value',event.currentTarget.value);
                        SoundscapeAdventure.sidebarControls(event.currentTarget.dataset, event.currentTarget.value)
                    });
                    newLi.appendChild(newInput);

                    playlistSounds.appendChild(newLi);
                
                
                }
        }
    }

    async _createMoodControls(html) {
        this.moodControlsElement = html.find("#mood-controls");
        if (this.moodControlsElement.length == 0) {
            this.moodControls = document.createElement("div");
            this.moodControls.id = "mood-controls";
            this.moodControls.className = "global-control flexrow"; // Add a class to the new div for styling or identification
            
            // Create the header element with class
            var header = document.createElement('header');
            header.className = 'playlist-header flexrow header-extras';
            header.addEventListener('click', (event) => {
                if (event.currentTarget.parentNode.className.includes("collapsed")) {
                    event.currentTarget.parentNode.className = "global-control flexrow";
                    const icon2 = event.currentTarget.parentNode.querySelector(".collapse");
                    icon2.className = 'collapse fa fa-angle-down';
                } else {
                    event.currentTarget.parentNode.className = "global-control flexrow collapsed";
                    const icon2 = event.currentTarget.parentNode.querySelector(".collapse");
                    icon2.className = 'collapse fa fa-angle-up';
                }

                event.currentTarget.setAttribute('value',event.currentTarget.dataset);
                SoundscapeAdventure.sidebarControls(event.currentTarget.dataset, event.currentTarget.value)
            });
            
            // Create the h4 element and its content
            var h4 = document.createElement('h4');
            h4.textContent = 'Current Mood ';
            
            // Create the i element with class and data-action attribute
            var icon = document.createElement('i');
            icon.className = 'collapse fa fa-angle-down';
            icon.setAttribute('data-action', 'mood-controls-collapse');
            
            // Append the i element to the h4 element
            h4.appendChild(icon);
            
            // Append the h4 element to the header element
            header.appendChild(h4);
            
            // Append the header element to the div element
            this.moodControls.appendChild(header);
            
            // Create the ol element with class
            var ol = document.createElement('ol');
            ol.className = 'playlist-sounds';
            
            // Create the li element with style and text
            var li = document.createElement('li');
            li.style.width = '100%';
            li.style.textAlign = 'center';
            li.textContent = 'when a mood is playing you can control from here';
            
            // Append the li element to the ol element
            ol.appendChild(li);
            
            // Append the ol element to the div element
            this.moodControls.appendChild(ol);
            const globalVolumeElement = html.find("#global-volume");
            if (globalVolumeElement) {
                globalVolumeElement[0].parentNode.insertBefore(this.moodControls, globalVolumeElement[0].nextSibling);
            } else {
                console.error("Elements with class global-volume or current-playing not found");
            }
        }
    }

    async _updateHtml() {
        const currentconfig = game.settings.get('soundscape-adventure', 'current-playing').split(",");
        let currentPlaying = {
            mood: "",
            soundboard: ""
        }

        if (currentconfig.length == 2) {
            currentPlaying.mood = currentconfig[1];
            currentPlaying.soundboard = currentconfig[0];

        }

        for (let i = 0; i < this.playlists.length; i++) {
            const playlistName = this.playlists[i].querySelector(".playlist-name").innerText.trim();
            const play = this.playlists[i];
            const sb = Object.values(SoundscapeAdventure.soundboards)
                            .find(el => el.name == playlistName && el.class.status == "online");
            if (sb) {
                const pl = await game.playlists.get(play.dataset.documentId);
                if (pl.playing) {
                    sb.isPlaying = true;
                } else {
                    sb.isPlaying = false;
                    await sb.class.stopAll();
                }
                utils.log(utils.getCallerInfo(),`Playlist ${pl.name} associated to the soundboard '${sb.name}'`);
                sb.playlistId = pl.id;
                sb.class.playlistId = pl.id;
                sb.class.playlist = pl;
                sb.status = "online";
                const controls = play.querySelector('.playlist-controls');
                controls.innerHTML = "";
                const newControl = document.createElement('a');
                newControl.classList.add('soundboard-control', 'fa-solid', 'fa-speaker');
                newControl.dataset.action = 'sound-create';
                newControl.dataset.tooltip = 'PLAYLIST.SoundCreate';
                newControl.dataset.soundboardId = sb.class.id;
                newControl.addEventListener('click', (event) => {
                    SoundscapeAdventure.openSoundboard(event.currentTarget.dataset.soundboardId)
                });

                const newControl2 = document.createElement('a');
                newControl2.classList.add('soundboard-control', 'fa-solid', 'fa-rotate-right');
                newControl2.dataset.action = 'sound-reload';
                newControl2.dataset.tooltip = 'Reload Soundboard';
                newControl2.dataset.soundboardId = sb.class.id;
                newControl2.addEventListener('click', (event) => {
                    SoundscapeAdventure.scanFiles(event.currentTarget.dataset.soundboardId);
                });

                const mood_list = play.querySelector("ol");
                mood_list.innerHTML = "";
                for (let key in sb.class.moods) {
                    const mood = sb.class.moods[key];
                    
                    let li = document.createElement('li');
                    li.id = mood.name;
                    li.className = 'mood flexrow';
                    li.setAttribute('data-soundboard-id', sb.class.id);
                    li.setAttribute('data-mood-id', mood.id);
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
                    a1.setAttribute('data-soundscape-id', sb.id);
                    a1.setAttribute('data-mood-id', mood.id);
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
                                            sb.class.deleteMood(dataset.moodId);
                                            mood_list.removeChild(li);
                                        }
                                    });
                            }
                        }
                    });

                    // Create the second <a> element
                    let a2 = document.createElement('a');
                    if (currentPlaying.soundboard == sb.class.id && currentPlaying.mood == mood.id) {
                        a2.className = 'soundboard-control fas fa-stop';
                        a2.setAttribute('data-action', 'sound-stop');
                        a2.setAttribute('data-tooltip', 'PLAYLIST.SoundStop');
                        this.updateMoodControlsUI(sb.class.id, mood.id, mood);
                    } else {
                        a2.className = 'soundboard-control fas fa-play';
                        a2.setAttribute('data-action', 'sound-play');
                        a2.setAttribute('data-tooltip', 'PLAYLIST.SoundPlay');
                    }
                    
                    a2.setAttribute('data-soundboard-id', sb.class.id);
                    a2.setAttribute('data-mood-id', mood.id);
                    a2.addEventListener('click', async (event) => {
                        const dataset = event.currentTarget.dataset;
                        if (dataset.action == "sound-play") {
                            if(sb) {
                                // TODO se tem outra tocando, precisa parar
                                sb.class.playMood(dataset.moodId);
                                const md = sb.class.moods[dataset.moodId];
                                if(md) {
                                    md.status = "playing";
                                    a2.setAttribute('data-action', 'sound-stop');
                                    a2.className = 'soundboard-control fas fa-stop';
                                }
                            } 
                            
                        } else if (dataset.action == "sound-stop") {
                            if(sb) {
                                const md = sb.class.moods[dataset.moodId];
                                if(md) {
                                    md.status = "stop";
                                    await sb.class.stopMood(mood.id);
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
                    <i class="fas fa-plus"></i> Load Soundscape
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
        const playlistOptions = Object.values(SoundscapeAdventure.soundboards)
            .filter(el => el.class.status == "offline")
            .map(playlist => { return `<option value="${playlist.class.id}">${playlist.name}</option>`; })
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
        //game.settings.set('soundscape-adventure', 'root-folder', "");
        foundry.applications.api.DialogV2.prompt({
            window: { title: "Load Soundboard" },
            content: content,
            ok: {
                icon: "fas fa-check",
                    label: "Create",
                    callback: async (event, button, dialog) => {
                        const soundboardId = button.form.elements.playlist.value;
                        await SoundscapeAdventure.loadOfflineSoundboard(soundboardId);
                        ui.notifications.warn(soundboardId);
                    }
            },
            /*buttons: {
                create: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Create",
                    callback: async (html) => {
                        const soundboardId = html.find('[name="playlist"]').val();
                        await SoundscapeAdventure.loadOfflineSoundboard(soundboardId);
                        ui.notifications.warn(soundboardId);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },*/
            default: "create"
        });
    }
}

const instance = new SoundscapeAdventureUI();
//Object.freeze(instance); // Optional: to make the instance immutable

export default instance;