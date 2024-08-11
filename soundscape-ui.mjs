import SoundscapeAdventure from "./soundscape-adventure.mjs";
import utils from "./utils/utils.mjs";
function controlFromInput(fromSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#25daa5', controlSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromSlider.value = from;
    }
}
    
function controlToInput(toSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#25daa5', controlSlider);
    setToggleAccessible(toInput);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
    }
}

function controlFromSlider(fromSlider, toSlider, fromInput) {
  const [from, to] = getParsed(fromSlider, toSlider);
  fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
  if (from > to) {
    fromSlider.value = to;
    fromInput.value = to;
  } else {
    fromInput.value = from;
  }
}

function controlToSlider(fromSlider, toSlider, toInput) {
  const [from, to] = getParsed(fromSlider, toSlider);
  fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
  setToggleAccessible(toSlider);
  if (from <= to) {
    toSlider.value = to;
    toInput.value = to;
  } else {
    toInput.value = from;
    toSlider.value = from;
  }
}

function getParsed(currentFrom, currentTo) {
  const from = parseInt(currentFrom.value, 10);
  const to = parseInt(currentTo.value, 10);
  return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
    sliderColor = "rgba(255, 0, 0, 0)";
    rangeColor = "rgba(215, 117, 78, 0.5)";
    const rangeDistance = to.max-to.min;
    const fromPosition = from.value - to.min;
    const toPosition = to.value - to.min;
    controlSlider.style.background = `linear-gradient(
      to right,
      ${sliderColor} 0%,
      ${sliderColor} ${(fromPosition)/(rangeDistance)*100}%,
      ${rangeColor} ${((fromPosition)/(rangeDistance))*100}%,
      ${rangeColor} ${(toPosition)/(rangeDistance)*100}%, 
      ${sliderColor} ${(toPosition)/(rangeDistance)*100}%, 
      ${sliderColor} 100%)`;
}

function setToggleAccessible(currentTarget) {
  const toSlider = document.querySelector('#toSlider');
  if (Number(currentTarget.value) <= 0 ) {
    toSlider.style.zIndex = 2;
  } else {
    toSlider.style.zIndex = 0;
  }
}

export default class SoundscapeUI extends Application {
    soundList = [];
    soundscape = {};
    currentMood= "";


    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = "Soundscape name",
        options.id = 'soundscape-app';
        options.template = 'modules/soundscape-adventure/templates/soundscape.hbs';
        options.width = 1050;
        options.height = 800;
        options.resizable = true;
        return options;
    }

    constructor(soundscape) {
        super({ title: `${soundscape.name}` });
        this.soundscape = soundscape;
    }
    async render(force = false, options = {}) {
        await super.render(force, options);
    }

    async close(options={}) {
        
        SoundscapeAdventure.closeUI(this.soundscape.class.id);
    
        // Call the original close method
        return super.close(options);
      }

    activateListeners(html) {
        super.activateListeners(html);
        const fromSlider = html[0].querySelectorAll('#fromSlider');
        const toSlider = html[0].querySelectorAll('#toSlider');
        const fromInput = html[0].querySelectorAll('#fromInput');
        const toInput = html[0].querySelectorAll('#toInput');
        for (let i=0; i < fromSlider.length; i++) {
            fillSlider(fromSlider[i], toSlider[i], '#C6C6C6', '#25daa5', toSlider[i]);
            setToggleAccessible(toSlider[i]);

            fromSlider[i].oninput = () => controlFromSlider(fromSlider[i], toSlider[i], fromInput[i]);
            toSlider[i].oninput = () => controlToSlider(fromSlider[i], toSlider[i], toInput[i]);
            fromInput[i].oninput = () => controlFromInput(fromSlider[i], fromInput[i], toInput[i], toSlider[i]);
            toInput[i].oninput = () => controlToInput(toSlider[i], fromInput[i], toInput[i], toSlider[i]);
        }

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
                const moodId = ev.currentTarget.dataset.moodId;
                const btns = ev.currentTarget.parentNode.parentNode.parentNode;
                this.currentMood = moodId;

                // Find all div elements with the class 'soundboardadv-main' within the root node
                const soundboardElements = root.querySelectorAll('div.soundboardadv-main');
                const buttonsElements = btns.querySelectorAll("div.playlist-track-ctn");

                buttonsElements.forEach(element => {
                    if (element.getAttribute('data-mood-id') === moodId) {
                        // Change the class name to 'soundboardadv-main mood-active'
                        element.className = "playlist-track-ctn active";
                    } else {
                        element.className = 'playlist-track-ctn disabled';
                    }
                })

                // Loop through each found element
                soundboardElements.forEach(element => {
                    // Check if the 'data-mood-name' attribute matches the 'moodName'
                    if (element.getAttribute('data-mood-id') === moodId) {
                        // Change the class name to 'soundboardadv-main mood-active'
                        element.className = 'soundboardadv-main mood-active';
                    } else {
                        element.className = 'soundboardadv-main';
                    }
                });
            } else if (dataset.action == "save") {
                this.soundscape.class.saveMoodsConfig();
            } else if (dataset.action == "delete") {
                foundry.applications.api.DialogV2.confirm({
                    content: "Are you sure?",
                    rejectClose: false,
                    modal: true
                }).then(proceed => {
                    if ( proceed ) { 
                        this.soundscape.class.deleteMood(dataset.moodId);
                        this.render(true);
                        //mood_list.removeChild(li);
                    }
                });
            } else if (dataset.action == "change-name") {
                this.moodNameEdit(dataset.moodId);
            }
            return;
        });

        /**
         * Sound Controls
         */
        html.on('click', '.action-sound', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            if(dataset.action == "volume") {
                const volume_ui = ev.currentTarget.parentNode.querySelector('#volume-value-1');
                volume_ui.innerText = parseInt(ev.currentTarget.value * 100) + "%";
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
            } else if(dataset.action == "collapse") {
                const icon = ev.currentTarget.querySelector("i");
                console.log(ev.currentTarget.parentNode)
                const random_extra = ev.currentTarget.parentNode.querySelector(".random_extra");
                const random_once_extra = ev.currentTarget.parentNode.querySelector(".random_once_extra");
                const fade_extra = ev.currentTarget.parentNode.querySelector(".fade_extra");
                const btn_extra = ev.currentTarget.parentNode.querySelector(".extra_btn_div");
                if (icon.className.includes("up")) {
                    icon.className = "fa fa-angle-down";
                    if (random_extra) {
                        random_extra.className="random_extra soundscapeadv-slider-container";
                        random_extra.style.display = "block";
                    }
                    if (random_once_extra) {
                        random_once_extra.className="random_once_extra soundscapeadv-slider-container";
                        random_once_extra.style.display = "block";
                    }
                    fade_extra.className="fade_extra soundscapeadv-slider-container";
                    fade_extra.style.display = "block";
                    btn_extra.className="extra_btn_div";
                    btn_extra.style.display = "block";
                } else {
                    icon.className = "fa fa-angle-up";
                    if (random_extra) {
                        random_extra.className="random_extra soundscapeadv-slider-container extras-collapsed ";
                        random_extra.style.display = "none";
                    }
                    if (random_once_extra) {
                        random_once_extra.className="random_once_extra soundscapeadv-slider-container extras-collapsed ";
                        random_once_extra.style.display = "none";
                    }
                    fade_extra.className="fade_extra soundscapeadv-slider-container extras-collapsed ";
                    fade_extra.style.display = "none";
                    btn_extra.className="extra_btn_div extras-collapsed ";
                    btn_extra.style.display = "none";
                }
            } else if (dataset.action == "save-extras") {
                let new_interval = {};
                const from = ev.currentTarget.parentNode.parentNode.querySelector("#fromInput");
                if (from) new_interval.from = from.value;
                const to = ev.currentTarget.parentNode.parentNode.querySelector("#toInput");
                if (to) new_interval.to = to.value;
                const new_fade = {
                    fadeIn: ev.currentTarget.parentNode.parentNode.querySelector("#fadeIn").value,
                    fadeOut: ev.currentTarget.parentNode.parentNode.querySelector("#fadeOut").value
                }
                let playOnce = false;
                if (ev.currentTarget.parentNode.parentNode.querySelector("#playOnce")) {
                    playOnce = ev.currentTarget.parentNode.parentNode.querySelector("#playOnce").checked;
                }
                this.soundscape.class.saveExtas(dataset.moodId, dataset.soundId, new_interval, new_fade, playOnce);
            } else if (dataset.action == "play") {
                if (ev.currentTarget.role == "play") {
                    ev.currentTarget.role = "stop";
                    ev.currentTarget.innerHTML = '<i class="fa-solid fa-stop"></i>';
                    ev.currentTarget.parentNode.className = "soundpad-player soundpad-playing";
                    // TODO rework to keep these actions within soundscape.mjs
                    const sound = await this.soundscape.class.playlist.sounds.get(dataset.soundId);
                    await sound.load();
                    sound.sound.addEventListener("end", ()=> {
                        ev.currentTarget.role = "play";
                        ev.currentTarget.parentNode.className = "soundpad-player";
                        ev.currentTarget.innerHTML = '<i class="fa-solid fa-play"></i>';
                    })
                    this.soundscape.class.playSound(await this.soundscape.class.moods[dataset.moodId].getSound(dataset.soundId), dataset.moodId)
                } else {
                    ev.currentTarget.role = "play";
                    ev.currentTarget.parentNode.className = "soundpad-player";
                    ev.currentTarget.innerHTML = '<i class="fa-solid fa-play"></i>';
                    this.soundscape.class.stopSound(await this.soundscape.class.moods[dataset.moodId].getSound(dataset.soundId), dataset.moodId);
                }
            } else if (dataset.action == "change-name") {
                const dataset = ev.currentTarget.dataset;
                this.soundEdit(dataset.moodId, dataset.soundId, dataset.group)
            }
        });

        /*html.on('contextmenu', '.action-sound', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            this.soundEdit(dataset.moodId, dataset.soundId, dataset.group)
        })*/
        this.render(true)
    }

    moodNameEdit(moodId) {
        const options_html = `
                <input id="moodName" type="text" placeholder="${this.soundscape.class.moods[moodId].name}">
                <input id="moodId" type="hidden" value="${moodId}">
        `
        new foundry.applications.api.DialogV2({
            window: { title: "Mood Name" },
            content: options_html,
            buttons: [
                {
                    action: "save",
                    label: "Save",
                    callback: (event, button, dialog) => this.updateMoodName(
                        button.form.elements.moodId.value,
                        button.form.elements.moodName.value),
                    icon: "fas fa-check"
                },
                {
                    action: "cancel",
                    label: "Cancel",
                    callback: () => {},
                    icon: "fas fa-times"
            }]
        }).render(true);
    }
    soundEdit(moodId, soundId, group) {
        if (group == "") {
            const sound = this.soundscape.class.soundsConfig.find(obj => obj.id == soundId);
            const options_html = `
                <input id="soundName" type="text" placeholder="${sound.name}">
                <input id="soundId" type="hidden" value="${soundId}">
            `
            new foundry.applications.api.DialogV2({
                window: { title: "Edit sound" },
                content: options_html,
                buttons: [
                    {
                        action: "save",
                        label: "Save",
                        callback: (event, button, dialog) => this.updateSound(
                            button.form.elements.soundName.value,
                            button.form.elements.soundId.value),
                        icon: "fas fa-check"
                    },
                    {
                        action: "cancel",
                        label: "Cancel",
                        callback: () => {},
                        icon: "fas fa-times"
                }]
            }).render(true);

        }
    }
    async updateSound(soundName, soundId) {
        await this.soundscape.class.updateSoundName(soundId, soundName);
        this.render(true);
    }

    updateMoodName(moodId, MoodName) {
        this.soundscape.class.moods[moodId].name = MoodName;
        this.soundscape.class.saveMoodsConfig();
        this.render(true);

    }

    async getData() {
        const currentPlaying = await game.settings.get('soundscape-adventure', 'current-playing').split(",");

        utils.log(utils.getCallerInfo(),`Loading dialog for ${this.soundscape.name}`)

        if (Object.keys(this.currentMood).length === 0) {
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