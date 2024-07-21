import SoundboardAdventure from "./soundboard-adventure.mjs";
import utils from './utils/utils.mjs';
//FIXME Implementar confirmacao antes de deletar mood
class SoundBoardAdventureUI {

    constructor() {
        if (SoundBoardAdventureUI.instance) {
            return SoundBoardAdventureUI.instance;
        }
        SoundBoardAdventureUI.instance = this;
        return this;
    }

    async init(html) {
        utils.log(utils.getCallerInfo(),"Init SoundBoard UI")
        await SoundboardAdventure.init();
        utils.log(utils.getCallerInfo(),"Adding main button");
        this.addLoadButton(html);
        utils.log(utils.getCallerInfo(),"Loading Configuration");
        await this.loadConfiguration(html);
    }

    async loadConfiguration(html) {
        utils.log(utils.getCallerInfo(),"Mapping soundboards to the sidebar");
        const directoryList = html.find('.directory-list');
        if (directoryList.length) {
            const playlists = directoryList.find('.directory-item');
            for (let i = 0; i < playlists.length; i++) {
                console.log("Playlist", playlists[i].querySelector(".playlist-name").innerText.trim());
                const playlistName = playlists[i].querySelector(".playlist-name").innerText.trim();
                const play = playlists[i];
                const sb = await SoundboardAdventure.soundboards.filter(el => el.name == playlistName && el.playlist_id != "online")[0];
                if (sb) {
                    const pl = await game.playlists.get(play.dataset.documentId);
                    if (pl.playing) {
                        sb.isPlaying = true;
                    } else {
                        sb.isPlaying = false;
                        await sb.class.stopAll();
                    }
                    console.log(`Playlist ${play.name} associated to the soundboard '${sb.name}'`);
                    sb.playlistId = play.dataset.documentId;
                    sb.class.playlistId = play.dataset.documentId;
                    sb.class.playlist = pl;
                    sb.status = "online";
                    //sb.class.loadSoundsFromPlaylist(play.dataset.documentId);
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
                        //console.log(event.currentTarget.dataset);
                        SoundboardAdventure.scanFiles(event.currentTarget.dataset.soundboardName);
                        //alert("reload sound board");
                    });

                    console.log(sb.class.moods);
                    const mood_list = play.querySelector("ol");
                    mood_list.innerHTML = "";

                    for(let i=0; i<sb.class.moods.length;i++) {
                        const mood = sb.class.moods[i];
                        
                        let li = document.createElement('li');
                        li.className = 'mood flexrow';
                        li.setAttribute('data-soundboard-name', sb.name);
                        li.setAttribute('data-mood-name', mood.name);
                        li.style.display = 'flex';

                        // Create the <h4> element
                        let h4 = document.createElement('h4');
                        h4.className = 'sound-name';
                        //h4.setAttribute('draggable', 'true');

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
                                    sb.class.deleteMood(dataset.moodName);
                                } 
                                
                            }
                            console.log(event.currentTarget.dataset);

                        });

                        // Create the second <a> element
                        let a2 = document.createElement('a');
                        if (mood.status == "playing") {
                            a2.className = 'soundboard-control fas fa-stop';
                            a2.setAttribute('data-action', 'sound-stop');
                            a2.setAttribute('data-tooltip', 'PLAYLIST.SoundStop');
                        } else {
                            a2.className = 'soundboard-control fas fa-play';
                            a2.setAttribute('data-action', 'sound-play');
                            a2.setAttribute('data-tooltip', 'PLAYLIST.SoundPlay');
                        }
                        
                        a2.setAttribute('data-soundboard-name', sb.name);
                        a2.setAttribute('data-mood-name', mood.name);
                        a2.addEventListener('click', (event) => {
                            const dataset = event.currentTarget.dataset;
                            if (dataset.action == "sound-play") {
                                //const sb = SoundBoardAdventure.soundboards.find(le => el.name == dataset.soundboardName);
                                if(sb) {
                                    sb.class.playMood(dataset.moodName);
                                    const md = sb.class.moods.find(el => el.name == mood.name);
                                    if(md) {
                                        md.status = "playing";
                                        a2.setAttribute('data-action', 'sound-stop');
                                        a2.className = 'soundboard-control fas fa-stop';
                                        sb.class.saveMoodsConfig();
                                    }
                                } 
                                
                            } else if (dataset.action == "sound-stop") {
                                if(sb) {
                                    const md = sb.class.moods.find(el => el.name == mood.name);
                                    if(md) {
                                        md.status = "stop";
                                        //sb.class.stopMood(dataset.moodName);
                                        sb.class.playlist.stopAll();
                                        a2.setAttribute('data-action', 'sound-play');
                                        a2.className = 'soundboard-control fas fa-play';
                                        sb.class.saveMoodsConfig();
                                    }
                                }
                            }
                           
                            console.log(event.currentTarget.dataset);

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
    }

    addLoadButton(html) {
        const soundboard_button = html.find('.create-soundboard');
        console.log(soundboard_button)
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
Object.freeze(instance); // Optional: to make the instance immutable

export default instance;