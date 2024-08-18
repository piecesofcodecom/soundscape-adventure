import SoundscapeAdventure from "./soundscape-adventure.mjs";
import utils from "./utils/utils.mjs";
import constants from "./utils/constants.mjs";
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
        /*const fromSlider = html[0].querySelectorAll('#fromSlider');
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
        }*/

        html.on('click', '.mood-control', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            const button = ev.currentTarget;
            if (dataset.action == 'play') {
                this.soundscape.isPlaying = true;
                ev.currentTarget.className="mood-control fa-solid fa-stop";
                ev.currentTarget.setAttribute("data-action","stop");
                const elements = ev.currentTarget.parentNode.parentNode.parentNode.parentNode.querySelectorAll(".on");
                //alert(elements.length)
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
                this.moodEdit(dataset.moodId);
            }
            return;
        });

        /**
         * Sound Controls
         */
        html.on('click', '.sound-control', async (ev) => {
            const dataset = ev.currentTarget.dataset;
            if(dataset.action == "volume") {
                const volume_ui = ev.currentTarget.parentNode.querySelector('#volume-value-1');
                volume_ui.innerText = parseInt(ev.currentTarget.value * 100) + "%";
                /*if (ev.currentTarget.value > 0) {
                    ev.currentTarget.parentNode.parentNode.className = "soundscapeadv-element on";
                } else {
                    ev.currentTarget.parentNode.parentNode.className = "soundscapeadv-element off";
                }*/
                this.soundscape.class.changeSoundVolume(dataset.moodId, dataset.id, ev.currentTarget.value);
            } else if(dataset.action == "intensity") {
                const intensity_ui = ev.currentTarget.parentNode.querySelector('#intensity-value-1');
                intensity_ui.innerText = parseInt(ev.currentTarget.value);
                this.soundscape.class.changeSoundIntensity(dataset.moodId, dataset.group, ev.currentTarget.value);
            } else if(dataset.action == "collapse") {
                const icon = ev.currentTarget.querySelector("i");
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
            } else if (dataset.action == "play") {
                if (ev.currentTarget.role == "play") {
                    const soundConfig = await this.soundscape.class.moods[dataset.moodId].getSound(dataset.soundId);
                    if (this.soundscape.class.moods[dataset.moodId].status != "playing" && !(soundConfig.type != constants.SOUNDTYPE.SOUNDPAD || soundConfig.type != constants.SOUNDTYPE.GROUP_SOUNDPAD))
                        return;
                    const sound = await this.soundscape.class.playlist.sounds.get(dataset.soundId);
                    await sound.load();
                    sound.sound.addEventListener("end", ()=> {
                        //this.render(this);
                        //alert("asd")
                        ev.currentTarget.role = "stop";
                        ev.currentTarget.innerHTML = '<i class="fa-solid fa-stop icon-rounded"></i>';
                    });
                    /*sound.sound.addEventListener("stop", ()=> {
                        ev.currentTarget.role = "play";
                        ev.currentTarget.innerHTML = '<i class="fa-solid fa-play icon-rounded"></i>';
                    });*/
                    await this.soundscape.class.playSound(soundConfig, dataset.moodId)
                } else {
                    await this.soundscape.class.stopSound(await this.soundscape.class.moods[dataset.moodId].getSound(dataset.soundId), dataset.moodId);
                }
                setTimeout(() => {
                    this.render(true);
                }, "100");
                
            } else if (dataset.action == "edit-sound") {
                const dataset = ev.currentTarget.dataset;
                this.soundEdit(dataset.moodId, dataset.soundId, dataset.group)
            } else if (dataset.action == "hidde-sound") {
                const icon = ev.currentTarget.querySelector(".fa-eye-slash");
                if (icon) {
                    ev.currentTarget.className = "sound-control fa-solid fa-eye";
                    this.soundscape.class.visible_off_sounds = false;
                } else {
                    ev.currentTarget.className = "sound-control fa-solid fa-slash";
                    this.soundscape.class.visible_off_sounds = true;
                }
                this.render(true);
            } else if (dataset.action == "enable") {
                const icon = ev.currentTarget.querySelector(".fa-microphone-slash");
                const soundConfig = this.soundscape.class.moods[dataset.moodId].getSound(dataset.soundId);
                if (icon) {
                    this.soundscape.class.moods[dataset.moodId].enableSound(dataset.soundId);
                    if (this.soundscape.class.moods[dataset.moodId].status == "playing") {
                        this.soundscape.class.playSound(soundConfig, dataset.moodId);
                    }
                } else {
                    this.soundscape.class.moods[dataset.moodId].disableSound(dataset.soundId);
                    if (this.soundscape.class.moods[dataset.moodId].status == "playing") {
                        this.soundscape.class.stopSound(soundConfig, dataset.moodId);
                    }
                }
                this.render(true);
            }
        });
        this.render(true)
    }

    async moodEdit(moodId) {
        const mood = this.soundscape.class.moods[moodId];
        
        const templatePath = "/modules/soundscape-adventure/templates/editmood.hbs";
        const triggers = [];

        for (let i=0; i < 3; i++) {
            triggers.push({
                actions: [
                {
                    id: "play",
                    name: "Play",
                    selected: false
                },
                {
                    id: "stop",
                    name: "Stop",
                    selected: false
                }],
                on: [{
                    id: "combat",
                    name: "Combat",
                    selected: false
                }],
                events: []
            })
        }

        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");

        if (triggerSettings[moodId]) {
            if (triggerSettings[moodId]["mood"]) {
                const currentTriggers = triggerSettings[moodId]["mood"];
                for (let i=0; i < currentTriggers.length; i++) {
                    for (let j = 0; j < triggers[i].actions.length; j++) {
                        if (triggers[i].actions[j].id == currentTriggers[i].action) {
                            triggers[i].actions[j].selected = true;
                        }
                    }
                    for (let j = 0; j < triggers[i].on.length; j++) {
                        if (triggers[i].on[j].id == currentTriggers[i].on) {
                            triggers[i].on[j].selected = true;
                            if (triggers[i].on[j].id == "combat") {
                                triggers[i].events.push({
                                    id: "start",
                                    name: "Start",
                                    selected: currentTriggers[i].event == "start" ? true : false
                                })
                                triggers[i].events.push({
                                    id: "end",
                                    name: "End",
                                    selected: currentTriggers[i].event == "end" ? true : false
                                })
                            }
                        }
                    }
                }
            }
        }
        const html_content = await renderTemplate(templatePath, {mood: mood, triggers: triggers});
        const dialog = new foundry.applications.api.DialogV2({
            window: { title: `Edit ${mood.name}` },
            content: html_content,
            buttons: [
                {
                    action: "save",
                    label: "Save",
                    callback: (event, button, dialog) => this.updateMood(button.form.elements, moodId),
                    icon: "fas fa-check"
                },
                {
                    action: "cancel",
                    label: "Cancel",
                    callback: () => {},
                    icon: "fas fa-times"
            }]
        });
        await dialog.render(true);
        const browser = dialog.element.querySelectorAll('.onElement');
        const removeAllTriggers = dialog.element.querySelector('.removeAllTriggers');
        removeAllTriggers.addEventListener('click', async (event) => {
            const dataset = event.srcElement.dataset;
            this.soundscape.class.removeAllTriggers(dataset.moodId);
        })
        for (let i=0; i< browser.length; i++) {
            browser[i].addEventListener('change', async (event) => {
                let eventSelect = event.target.parentNode.parentNode.querySelector(".eventElement");
                let length = eventSelect.options.length;

                for (i = length-1; i > 0;i--) {
                    eventSelect.remove(i);
                }
                if (event.target.value == "combat") {
                        var start = document.createElement('option');
                        start.value = "start";
                        start.innerHTML = "Start";
                        eventSelect.appendChild(start);
                        var end = document.createElement('option');
                        end.value = "end";
                        end.innerHTML = "End";
                        eventSelect.appendChild(end);
                } else if (event.target.value == "scene") {
                    const scenes = Array.from(game.scenes);
                    for (let i = 0; i < scenes.length; i++) {
                        const obj = document.createElement('option');
                        obj.value = scenes[i].id;
                        obj.innerHTML = scenes[i].name;
                        eventSelect.appendChild(obj);
                    }
                }
            });
        }
    }
    async soundEdit(moodId, soundId, group) {
        const soundConfig = this.soundscape.class.moods[moodId].getSound(soundId);
        const templatePath = "/modules/soundscape-adventure/templates/editsound.hbs";
        let others = {};
        const triggers = [];
        const regionEvents = [
            CONST.REGION_EVENTS.TOKEN_ENTER,
            CONST.REGION_EVENTS.TOKEN_EXIT,
            CONST.REGION_EVENTS.TOKEN_MOVE,
            CONST.REGION_EVENTS.TOKEN_MOVE_IN,
            CONST.REGION_EVENTS.TOKEN_MOVE_OUT,
            CONST.REGION_EVENTS.TOKEN_PRE_MOVE,
            CONST.REGION_EVENTS.TOKEN_ROUND_END,
            CONST.REGION_EVENTS.TOKEN_ROUND_START,
            CONST.REGION_EVENTS.TOKEN_TURN_END,
            CONST.REGION_EVENTS.TOKEN_TURN_START,
          ];
        const triggerActions = ["play", "stop"]
        const _regions = Array.from(game.canvas.scene.regions);
        let onElements = [];
        for (let m=0;m<_regions.length;m++) {
            onElements.push({
                id: _regions[m].id,
                name: _regions[m].name,
                selected: false
            })
        }
        onElements.push({
            id: "combat",
            name: "Combat",
            selected: false
        })
        for (let i=0; i < 3; i++) {
            triggers.push({
                actions: [
                {
                    id: "play",
                    name: "Play",
                    selected: false
                },
                {
                    id: "stop",
                    name: "Stop",
                    selected: false
                }],
                on: JSON.parse(JSON.stringify(onElements)),
                events: []
            })
        }

        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
        if (triggerSettings[moodId]) {
            if (triggerSettings[moodId][soundId]) {
                const currentTriggers = triggerSettings[moodId][soundId];
                for( let i=0; i < 3; i++) {
                    for (let j = 0; j < triggers[i].actions.length; j++) {
                        if (triggers[i].actions[j].id == currentTriggers[i].action) {
                            triggers[i].actions[j].selected = true;
                        }
                    }
                    for (let k=0; k <  triggers[i].on.length; k++) {
                        if (triggers[i].on[k].id == currentTriggers[i].on) {
                            triggers[i].on[k].selected = true;
                            if (triggers[i].on[k].id != "combat") {
                                for (let r=0; r< regionEvents.length; r++) {
                                    triggers[i].events.push({
                                        id: regionEvents[r],
                                        name: regionEvents[r],
                                        selected: regionEvents[r] == currentTriggers[i].event ? true : false
                                    })
                                }
                            } else {
                                triggers[i].events.push({
                                    id: "start",
                                    name: "Start",
                                    selected: "start" == currentTriggers[i].event ? true : false
                                })
                                triggers[i].events.push({
                                    id: "end",
                                    name: "End",
                                    selected: "end" == currentTriggers[i].event ? true : false
                                })
                            }
                        } else {
                            triggers[i].on[k].selected = false;
                        }
                    }
                }
            }
        }

        const html_content = await renderTemplate(templatePath, { sound: soundConfig, triggers: triggers});
        const soundEditDialog = new foundry.applications.api.DialogV2({
            window: { title: "Edit sound" },
            content: html_content,
            buttons: [
                {
                    action: "save",
                    label: "Save",
                    callback: (event, button, dialog) => this.updateSound(button.form.elements, soundId, moodId),
                    icon: "fas fa-check"
                },
                {
                    action: "cancel",
                    label: "Cancel",
                    callback: () => {},
                    icon: "fas fa-times"
            }]
        });
        await soundEditDialog.render(true);

        const browser = soundEditDialog.element.querySelectorAll('.onElement');
        for (let i=0; i< browser.length; i++) {
            browser[i].addEventListener('change', async (event) => {
                let eventSelect = event.target.parentNode.parentNode.querySelector(".eventElement");
                var length = eventSelect.options.length;
                for (i = length-1; i > 0;i--) {
                    eventSelect.remove(i);
                }
                if (event.target.value == "combat") {
                    var start = document.createElement('option');
                    start.value = "start";
                    start.innerHTML = "Start";
                    eventSelect.appendChild(start);
                    var end = document.createElement('option');
                    end.value = "end";
                    end.innerHTML = "End";
                    eventSelect.appendChild(end);
                } else if (event.target.value.length > 0) {
                    for (let i = 0; i < regionEvents.length; i++) {
                        var opt = document.createElement('option');
                        opt.value = regionEvents[i];
                        opt.innerHTML = regionEvents[i];
                        eventSelect.appendChild(opt);
                    }
                }   
            })
        }
        
    }

    async updateMood(elements, moodId) {
        const triggers = [];
        for (let i=0; i< elements.triggerAction.length; i++) {
            const trigger = {
                action: elements.triggerAction[i].value,
                event: elements.triggerEvent[i].value,
                on: elements.triggerOn[i].value
            }
            triggers.push(trigger)
        }
        this.soundscape.class.moods[moodId].name = elements.moodName.value;
        this.soundscape.class.saveTrigger(moodId, "mood", triggers);
        this.render(true);
    }
    async updateSound(elements, soundId, moodId) {
        
        let new_interval = {
            from: 10,
            to: 60
        };
        const from = elements.from;
        if (from) new_interval.from = from.value;
        const to = elements.to;
        if (to) new_interval.to = to.value;
        const new_fade = {
            fadeIn: parseInt(elements.fadeIn.value),
            fadeOut: parseInt(elements.fadeOut.value)
        }
        let playOnce = false;
        if (elements.playOnce) {
            playOnce = elements.playOnce.checked;
        }
        const triggers = [];
        for (let i=0; i< elements.triggerAction.length; i++) {
            const trigger = {
                action: elements.triggerAction[i].value,
                event: elements.triggerEvent[i].value,
                on: elements.triggerOn[i].value
            }
            triggers.push(trigger)
        }
        await this.soundscape.class.saveExtas(moodId, soundId, new_interval, new_fade, playOnce);
        if (elements.soundName)
            await this.soundscape.class.updateSoundName(soundId, elements.soundName.value);
        await this.soundscape.class.saveTrigger(moodId, soundId, triggers);
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
            soundscapeId: this.soundscape.class.id,
            off_visible: this.soundscape.class.visible_off_sounds,
            activeMood: this.currentMood
        }
    }

    async _dialogNewMood() {

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