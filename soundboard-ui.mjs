//FIXME: (UI) Ao interagir com o mood (selecionar ou desabilitar som) a lista de sons desaparecem

import SoundboardAdventure from "./soundboard-adventure.mjs";
export default class SoundBoardUI extends Application {
    soundList = []
    soundboard = {}

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = "🔊 Sound board name", //`🔊${game.i18n.localize('SOUNDBOARD.app.title')}`;
            options.id = 'soundboard-app';
        options.template = 'modules/soundboard-adventure/templates/soundboard.hbs';
        options.width = 1020;
        options.height = 800;
        options.resizable = true;
        return options;
        //TODO: Look into TabsV2 impl.
    }

    constructor(soundboard) {
        super({ title: `🔊 ${soundboard.name}` });
        this.soundboard = soundboard;
        console.log("Dialog",this.soundboard);
        console.log("Dialog sounds",this.soundboard.class);
    }
    async render(force = false, options = {}) {
        await super.render(force, options);
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', '.mood-control', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            console.log("dataset", dataset)
            const button = ev.currentTarget;
            if (dataset.action == 'play') {
                console.log("Play Mood");
                this.soundboard.isPlaying = true;
                ev.currentTarget.className="mood-control fa-solid fa-stop";
                ev.currentTarget.setAttribute("data-action","stop");
                await this.soundboard.class.playMood(dataset.moodName);
                await this.soundboard.class.saveMoodsConfig();
                this.render(true);
            } else if (dataset.action == "new") {
                await this._dialogNewMood();
            } else if (dataset.action == "stop") {
                const mood = await this.soundboard.class.moods.find(el => el.name == dataset.moodName);
                mood.status = "stop";
                this.soundboard.isPlaying = false;
                await this.soundboard.class.playlist.stopAll();
                await this.soundboard.class.saveMoodsConfig();
                //ev.currentTarget.className="mood-control fa-solid fa-play";
                //ev.currentTarget.setAttribute("data-action","play");
                this.render(true);
            } else if(dataset.action == "view-mood") {
                const root = ev.currentTarget.parentNode.parentNode.parentNode.parentNode;
                const moodName = ev.currentTarget.dataset.moodName;
                const btns = ev.currentTarget.parentNode.parentNode.parentNode;
                console.log(btns)

                // Find all div elements with the class 'soundboardadv-main' within the root node
                const soundboardElements = root.querySelectorAll('div.soundboardadv-main');
                const buttonsElements = btns.querySelectorAll("div.playlist-track-ctn");

                buttonsElements.forEach(element => {
                    console.log(element)
                    if (element.getAttribute('data-mood-name') === moodName) {
                        // Change the class name to 'soundboardadv-main mood-active'
                        element.className = "playlist-track-ctn active";
                    } else {
                        element.className = 'playlist-track-ctn disabled';
                    }
                })

                // Loop through each found element
                soundboardElements.forEach(element => {
                    // Check if the 'data-mood-name' attribute matches the 'moodName'
                    if (element.getAttribute('data-mood-name') === moodName) {
                        // Change the class name to 'soundboardadv-main mood-active'
                        element.className = 'soundboardadv-main mood-active';
                    } else {
                        element.className = 'soundboardadv-main';
                    }
                });
            }
            return;
        });

        html.on('click', '.action-sound', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            console.log(dataset);
            if (dataset.action == "on") {
                const mood = this.soundboard.class.moods.filter(el => el.name == dataset.moodName)[0];
                if (mood) {
                    const sound = mood.sounds.filter(el => el._id == dataset.soundId)[0];
                    if(sound) {
                        sound.status="on";
                        if (this.soundboard.isPlaying) {
                            this.soundboard.class.playSound(dataset.moodName, dataset.path);
                        }
                        await this.soundboard.class.saveMoodsConfig();
                        this.render(true);
                    }
                }
                
            } else if (dataset.action == "off") {
                const mood = this.soundboard.class.moods.filter(el => el.name == dataset.moodName)[0];
                if (mood) {
                    const sound = mood.sounds.filter(el => el._id == dataset.soundId)[0];
                    if(sound) {
                        sound.status="off";
                        if (this.soundboard.isPlaying) {
                            this.soundboard.class.stopSound(dataset.moodName, dataset.path);
                        }
                        await this.soundboard.class.saveMoodsConfig();
                        this.render(true);
                    }
                }
            } else if(dataset.action == "volume") {
                console.log(ev.currentTarget.value);
                console.log(dataset);
                this.soundboard.class.changeSoundVolume(dataset.moodName, dataset.path, ev.currentTarget.value);
            }
        });

        html.on('contextmenu', '.action-sound', async (ev) => {
            //console.log(ev.currentTarget);
            const dataset = ev.currentTarget.dataset;
            const sb = await SoundboardAdventure.soundboards.find(el => el.name == dataset.soundboardName)
            if (sb) {
                const _sounds = Array.from(sb.class.playlist.sounds)
                const sound = _sounds.find(el => el.path == dataset.path);
                if (sound) {
                    const soundConfig = new PlaylistSoundConfig(sound);
                    //TODO: (UI) reload the soundboard UI with the new name
                    const dialog = await soundConfig.render(true);
                }
            }
        })
        this.render(true)
    }

    async getData() {
        console.log(`Loading dialog for ${this.soundboard.name}`)
        console.log(this.soundboard.class.moods);

        const playlist = await game.playlists.get(this.soundboard.playlistId);
        //const sounds = Array.from(playlist.sounds);
        //const soundsData = [];
        return {
            //sounds: sounds,
            name: this.soundboard.class.name,
            moods: this.soundboard.class.moods,
        }
    }

    async _dialogNewMood() {
        //const content = await renderTemplate('path/to/template.hbs', data)

        new foundry.applications.api.DialogV2({
            window: { title: "Choose an option" },
            content: `
              <input name="moodname" value="" placeholder="Mood name">
            `,
            buttons: [{
              action: "create",
              label: "Create Mood",
              default: true,
              callback: (event, button, dialog) => button.form.elements.moodname.value
            }],
            submit: async (result) => {
              console.log(`User picked name: ${result}`);
              await this.soundboard.class.newMood(result);
              this.render(true);
            }
          }).render({ force: true });

    }
}