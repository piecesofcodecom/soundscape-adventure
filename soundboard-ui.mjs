import SoundboardAdventure from "./soundboard-adventure.mjs";
import utils from "./utils/utils.mjs";

//TODO botao salvar, a pessoa tem que salvar os moods
export default class SoundBoardUI extends Application {
    soundList = []
    soundboard = {}
    currentMood= "";

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = "🔊 Sound board name", //`🔊${game.i18n.localize('SOUNDBOARD.app.title')}`;
            options.id = 'soundboard-app';
        options.template = 'modules/soundboard-adventure/templates/soundboard.hbs';
        options.width = 1020;
        options.height = 800;
        options.resizable = true;
        return options;
    }

    constructor(soundboard) {
        super({ title: `🔊 ${soundboard.name}` });
        this.soundboard = soundboard;
    }
    async render(force = false, options = {}) {
        await super.render(force, options);
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', '.mood-control', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            const button = ev.currentTarget;
            if (dataset.action == 'play') {
                this.soundboard.isPlaying = true;
                ev.currentTarget.className="mood-control fa-solid fa-stop";
                ev.currentTarget.setAttribute("data-action","stop");
                await this.soundboard.class.playMood(dataset.moodName);
                this.render(true);
            
            } else if (dataset.action == "new") {
                await this._dialogNewMood();
            
            } else if (dataset.action == "stop") {
                await this.soundboard.class.stopMood(dataset.moodName);
                this.render(true);
            
            } else if(dataset.action == "view-mood") {
                const root = ev.currentTarget.parentNode.parentNode.parentNode.parentNode;
                const moodName = ev.currentTarget.dataset.moodName;
                const btns = ev.currentTarget.parentNode.parentNode.parentNode;
                this.currentMood = moodName;

                // Find all div elements with the class 'soundboardadv-main' within the root node
                const soundboardElements = root.querySelectorAll('div.soundboardadv-main');
                const buttonsElements = btns.querySelectorAll("div.playlist-track-ctn");

                buttonsElements.forEach(element => {
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
            } else if (dataset.action == "save") {
                this.soundboard.class.saveMoodsConfig();
            }
            return;
        });

        /**
         * Sound Controls
         */
        html.on('click', '.action-sound', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            if (dataset.action == "on") {
                this.soundboard.class.enableSound(dataset.moodName, dataset.path);
                this.render(true);
                
            } else if (dataset.action == "off") {
                this.soundboard.class.disableSound(dataset.moodName, dataset.path);
                this.render(true);
            } else if(dataset.action == "volume") {
                this.soundboard.class.changeSoundVolume(dataset.moodName, dataset.path, ev.currentTarget.value);
            } else if(dataset.action == "intensity") {
                this.soundboard.class.changeSoundIntensity(dataset.moodName, dataset.group, ev.currentTarget.value);
            }
        });

        html.on('contextmenu', '.action-sound', async (ev) => {
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
        const currentPlaying = await game.settings.get('soundboard-adventure', 'current-playing').split(",");

        utils.log(utils.getCallerInfo(),`Loading dialog for ${this.soundboard.name}`)

        const playlist = await game.playlists.get(this.soundboard.playlistId);
        if(currentPlaying.length == 2) {
            if (currentPlaying[0] == this.soundboard.name) {
                const mood = this.soundboard.class.moods.find(el => el.name == currentPlaying[1]);
                if (mood) {
                    this.currentMood = mood.name;
                }
            }
        }
        
        if(this.soundboard.class.moods.length > 0 && this.currentMood == "") {
            this.currentMood = this.soundboard.class.moods[0].name;
        }

        return {
            name: this.soundboard.class.name,
            moods: this.soundboard.class.moods,
            activeMood: this.currentMood
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
              await this.soundboard.class.newMood(result);
              this.render(true);
            }
          }).render({ force: true });

    }
}