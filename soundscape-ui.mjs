import SoundscapeAdventure from "./soundscape-adventure.mjs";
import utils from "./utils/utils.mjs";

//TODO botao salvar, a pessoa tem que salvar os moods
export default class SoundscapeUI extends Application {
    soundList = []
    soundscape = {}
    currentMood= "";

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = "🔊 Soundscape name", //`🔊${game.i18n.localize('SOUNDBOARD.app.title')}`;
        options.id = 'soundscape-app';
        options.template = 'modules/soundscape-adventure/templates/soundscape.hbs';
        options.width = 1050;
        options.height = 800;
        options.resizable = true;
        return options;
    }

    constructor(soundscape) {
        super({ title: `🔊 ${soundscape.name}` });
        this.soundscape = soundscape;
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
                this.soundscape.isPlaying = true;
                ev.currentTarget.className="mood-control fa-solid fa-stop";
                ev.currentTarget.setAttribute("data-action","stop");
                await this.soundscape.class.playMood(dataset.moodId);
                this.render(true);
            
            } else if (dataset.action == "new") {
                await this._dialogNewMood();
            
            } else if (dataset.action == "stop") {
                await this.soundscape.class.stopMood(dataset.moodId);
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
                this.soundscape.class.saveMoodsConfig();
            }
            return;
        });

        /**
         * Sound Controls
         */
        html.on('click', '.action-sound', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            if (dataset.action == "on") {
                this.soundscape.class.enableSound(dataset.moodName, dataset.path);
                this.render(true);
                
            } else if (dataset.action == "off") {
                this.soundscape.class.disableSound(dataset.moodName, dataset.path);
                this.render(true);
            } else if(dataset.action == "volume") {
                const volume_ui = ev.currentTarget.parentNode.querySelector('#volume-value-1');
                volume_ui.innerText = parseInt(ev.currentTarget.value * 100);
                if (ev.currentTarget.value > 0) {
                    ev.currentTarget.parentNode.parentNode.className = "soundscapeadv-element on";
                } else {
                    ev.currentTarget.parentNode.parentNode.className = "soundscapeadv-element off";
                }
                this.soundscape.class.changeSoundVolume(dataset.moodId, dataset.id, ev.currentTarget.value);
            } else if(dataset.action == "intensity") {
                const intensity_ui = ev.currentTarget.parentNode.querySelector('#intensity-value-1');
                intensity_ui.innerText = parseInt(ev.currentTarget.value);
                this.soundscape.class.changeSoundIntensity(dataset.moodId, dataset.group, ev.currentTarget.value);
            }
        });

        html.on('contextmenu', '.action-sound', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            this.soundEdit(dataset.moodId, dataset.soundId, dataset.group)
        })
        this.render(true)
    }

    soundEdit(moodId, soundId, group) {
        if (group == "") {
            const sound = this.soundscape.class.soundsConfig.find(obj => obj.id == soundId);
            const options_html = `
                <input id="soundName" type="text" placeholder="${sound.name}">
                <input id="soundId" type="hidden" value="${soundId}">
                <input id="moodId" type="hidden" value="${moodId}">
            `
            new Dialog({
                title: "Edit sound",
                content: options_html,
                buttons: {
                button1: {
                    label: "Save",
                    callback: (html) => this.updateSound(html),
                    icon: `<i class="fas fa-check"></i>`
                },
                button2: {
                    label: "Cancel",
                    callback: () => {},
                    icon: `<i class="fas fa-times"></i>`
                }
                }
            }).render(true);

        }
        
    }
    async updateSound(html) {
        const newName = html.find('[id="soundName"]').val();
        const soundId = html.find('[id="soundId"]').val();
        await this.soundscape.class.updateSoundName(soundId, newName);
        this.render(true);
    }

    async getData() {
        const currentPlaying = await game.settings.get('soundscape-adventure', 'current-playing').split(",");

        utils.log(utils.getCallerInfo(),`Loading dialog for ${this.soundscape.name}`)

        if(currentPlaying.length == 2) {
            if (currentPlaying[0] == this.soundscape.class.id) {
                const mood = this.soundscape.class.moods[currentPlaying[1]];
                if (mood) {
                    this.currentMood = mood.id;
                }
            }
        } else if(Object.values(this.soundscape.class.moods).length > 0) {
            this.currentMood = Object.values(this.soundscape.class.moods)[0].id;
        } else {
            this.currentMood = {}
        }
        return {
            name: this.soundscape.class.name,
            moods: Object.values(this.soundscape.class.moods),
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
              await this.soundscape.class.newMood(result);
              this.render(true);
            }
          }).render({ force: true });

    }
}