import SoundscapeAdventureUI from './soundscape-adventure-ui.mjs';
import constants from './utils/constants.mjs';
import { init as coreInit } from "./regions.mjs";
import SoundscapeAdventure from "./soundscape-adventure.mjs";
import TriggersSceneConfig from "./scene_triggers.js";
/**
 * FOUNDRY HOOKS
 */
Hooks.on('renderSidebarTab', (sidebar, html) => {
    if (sidebar instanceof PlaylistDirectory) {
        SoundscapeAdventureUI.init(html);
        coreInit();
    }
})

Hooks.on('combatStart', (combat, updateData) => {
    //event: name: "start" region: {id: "combat" }
    SoundscapeAdventure.triggerCombatEvent({ name: "start", region: { id: "combat" } })
})
Hooks.on('deleteCombat', (combat, updateData) => {
    SoundscapeAdventure.triggerCombatEvent({ name: "end", region: { id: "combat" } })
})



/**
 * MODULE HOOKS
 */
Hooks.on('SoundscapeAdventure-UpdateSidebar', () => {
    SoundscapeAdventureUI._updateHtml();
});

Hooks.on('SBAdventureNewMood', (moodName, mood) => {
    /*if (sidebar instanceof PlaylistDirectory) {*/
    SoundscapeAdventureUI.updateSoundboards();
    /*}*/
});

Hooks.on('SBAdventure-PlayingMood', (soundboardName, moodName, mood) => {
    /*if (sidebar instanceof PlaylistDirectory) {*/
    SoundscapeAdventureUI.updateMoodControlsUI(soundboardName, moodName, mood);
    /*}*/
});

Hooks.on('SoundscapeAdventure-ChangeSoundVolume', (id, moodId, mood) => {
    SoundscapeAdventureUI.updateMoodControlsUI(id, moodId, mood);
});

/**
 * Tigger Hooks
 */
Hooks.on("renderSceneConfig", (app, html, data) => {
    const originalUpdateObject = app._updateObject.bind(app);

  app._updateObject = async function(event, formData) {
    const moduleName = "soundscape-adventure"; // Ensure this matches your module name
    const scene_id = app.object._id;
    const mood = formData.mood;
    const soundscape = formData.soundscape;
    const action = formData.action;
    const trigger = {
        action: action,
        event: "scene",
        on: `${soundscape}:${mood}`
    };
    let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
    if (!triggerSettings["scenes"]) {
        triggerSettings["scenes"] = {}
    }

    triggerSettings["scenes"][app.object._id] = trigger;
    game.settings.set(constants.STORAGETRIGGERSETTINGS, "triggerSettings", triggerSettings);
    await originalUpdateObject(event, formData);
  };
    const moduleName = "soundscape-adventure"; // Certifique-se de que o nome do módulo corresponde ao nome em module.json
    let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
    const current = {
        action: "",
        mood: "",
        soundscape: ""
    }
    if (triggerSettings["scenes"]) {
        if (triggerSettings["scenes"][canvas.scene.id]) {
            const trig = triggerSettings["scenes"][canvas.scene.id];
            current.action = trig.action;
            current.mood = trig.on.split(":")[1];
            current.soundscape = trig.on.split(":")[0];
        }
    }
    // Adicionar nova aba à navegação das abas existentes
    const tabs = html.find(".tabs");
    tabs.append($('<a class="item" data-tab="my-custom-tab"><i class="fa-solid fa-speaker"></i>&nbsp;Soundscape Adventure</a>'));

    // Adicionar novo conteúdo da aba
    const content = html.find("form");
    const title = document.createElement("h3");
    title.textContent = "Play/Stop a mood when a scene is activate";

    const newNode = document.createElement("div");
    newNode.className = "tab"
    newNode.setAttribute("data-group", "main")
    newNode.setAttribute("data-tab", "my-custom-tab")
    const soundscapes = SoundscapeAdventure.soundboards;

    const formGroup1 = document.createElement('div');
    formGroup1.className = 'form-group';

    // Create and append the label for Soundscape
    const label1 = document.createElement('label');
    label1.textContent = 'Soundscape';
    formGroup1.appendChild(label1);

    // Create and append the select element for Soundscape
    const select1 = document.createElement('select');
    select1.name = 'soundscape';
    select1.className="soundscape-adventure-soundscape";
    const option1 = document.createElement('option');
    option1.value = '';
    option1.textContent = 'Select';
    select1.appendChild(option1);
    formGroup1.appendChild(select1);

    for (let key in soundscapes) {
        const option = document.createElement('option');
        option.value = soundscapes[key].class.id;
        if (current.soundscape == soundscapes[key].class.id)
            option.selected = "selected";
        option.textContent = soundscapes[key].class.name;
        select1.appendChild(option);
    }



    // Create the second form-group div
    const formGroup2 = document.createElement('div');
    formGroup2.className = 'form-group';

    // Create and append the label for Mood
    const label2 = document.createElement('label');
    label2.textContent = 'Mood';
    formGroup2.appendChild(label2);

    // Create and append the select element for Mood
    const select2 = document.createElement('select');
    select2.className="soundscape-adventure-mood";
    select2.name = 'mood';

    // Create and append the options for Mood
    const option2_1 = document.createElement('option');
    option2_1.value = '';
    select2.appendChild(option2_1);

    if (current.soundscape) {
        const soundscape = SoundscapeAdventure.soundboards[current.soundscape];
        const moods = soundscape.class.moods;
        for (let key in moods) {
            const option2_2 = document.createElement('option');
            option2_2.value = moods[key].id;
            option2_2.textContent = moods[key].name;
            if (moods[key].id == current.mood) {
                option2_2.selected = "selected";
            }
            select2.appendChild(option2_2);
        }
    }

    

    select1.addEventListener('change', function () {
        while (select2.firstChild) {
            select2.removeChild(select2.firstChild);
        }
        const soundboard = SoundscapeAdventure.soundboards[select1.value];
        const moods = soundboard.class.moods;
        const soption = document.createElement('option');
        soption.value = "";
        soption.textContent = "Select a mood";
        select2.appendChild(soption);
        for (let key in moods) {
            const option = document.createElement('option');
            option.value = moods[key].id;
            option.textContent = moods[key].name;
            select2.appendChild(option);
        }
    });
    formGroup2.appendChild(select2);
    
    // Action Form
    const actionForm = document.createElement('div');
    actionForm.className = 'form-group';

    const actionLabel = document.createElement('label');
    actionLabel.textContent = 'Action';
    actionForm.appendChild(actionLabel);

    const actionSelect = document.createElement('select');
    actionSelect.className="soundscape-adventure-action";
    actionSelect.name = 'action';
    const action_option_0 = document.createElement('option');
    action_option_0.value = '';
    action_option_0.textContent = 'Select';
    actionSelect.appendChild(action_option_0);

    const action_option_1 = document.createElement('option');
    action_option_1.value = 'play';
    action_option_1.textContent = 'Play';
    if (current.action == "play") action_option_1.selected = "selected";
    actionSelect.appendChild(action_option_1);

    const action_option_2 = document.createElement('option');
    action_option_2.value = 'stop';
    action_option_2.textContent = 'Stop';
    if (current.action == "stop") action_option_2.selected = "selected";
    actionSelect.appendChild(action_option_2);
    actionForm.appendChild(actionSelect);

    newNode.appendChild(title);
    newNode.appendChild(formGroup1);
    newNode.appendChild(formGroup2);
    newNode.appendChild(actionForm);
});

Hooks.on('updateScene', (scene, data, modified, sceneId) => {
    if (game.ready && data.active) {
        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
        if (!triggerSettings["scenes"]) {
            return;
        }
        if (!triggerSettings["scenes"][scene.id]) {
            return
        }
        const trigger = triggerSettings["scenes"][scene.id];
        const action = trigger.action;
        const on = trigger.on.split(":")
        const soundscape = on[0];
        const mood = on[1];
        if (SoundscapeAdventure.soundboards[soundscape] && data.active) {
            if (action == "play") {
                SoundscapeAdventure.soundboards[soundscape].class.playMood(mood);
            } else {
                SoundscapeAdventure.soundboards[soundscape].class.stopMood(mood);
            }
        }
    }
});

/**
 * Custom Handlebars
 */
Hooks.once('init', () => {
    Handlebars.registerHelper('eachSoundType', function (array, type, options) {
        let result = '';
        let groups = [];
        array.forEach(el => {
            if (el.type == type) {
                // for groups we add only a representation for all sounds
                result += options.fn(el);
            } else if (el.group != "") {
                if ((type + 3) == el.type) {
                    if (!groups.includes(el.group)) {
                        groups.push(el.group);
                        const clone = structuredClone(el);
                        clone.name = 'Group: ' + el.group,
                        result += options.fn(clone);
                    }
                }
            }
        });
        return result;
    });

    Handlebars.registerHelper('soundStatus', function (modStatus, soundStatus) {
        if (soundStatus == "on" && modStatus == "playing") {
            return true;
        }
        return false;
    });

    Handlebars.registerHelper('opositeAction', function (status) {
        if (status == "on") {
            return 'off';
        }
        return 'on';
    });

    Handlebars.registerHelper('volumeUI', function (volume) {
        return parseInt(volume * 100) + "%";
    })

    Handlebars.registerHelper('shortenString', function (str) {
        if (str && str.length > 26) {
            return `${str.substring(0, 26)}...`;
        }
        return str;
    });

    Handlebars.registerHelper('forSoundType', function (options) {
        let result = '';

        result += options.fn({
            name: "ambience",
            title: "Ambience",
            code: constants.SOUNDTYPE.AMBIENCE
        });
        result += options.fn({
            name: "loop",
            title: "Loop",
            code: constants.SOUNDTYPE.LOOP
        });
        result += options.fn({
            name: "random",
            title: "Random",
            code: constants.SOUNDTYPE.RANDOM
        });
        result += options.fn({
            name: "none",
            title: "Soundpad",
            code: constants.SOUNDTYPE.SOUNDPAD
        });
        return result;
    });

    Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('isPlaying', function (soundId, soundscapeId, moodId, options) {
        const soundConfig = SoundscapeAdventure.soundboards[soundscapeId].class.moods[moodId].getSound(soundId);
        let sound = {};
        if (soundConfig.group == "") {
            sound = SoundscapeAdventure.soundboards[soundscapeId].class.playlist.sounds.get(soundId);
        } else {
           
            const listSounds = SoundscapeAdventure.soundboards[soundscapeId].class.moods[moodId].getSoundByGroup(soundConfig.group);
            sound.playing = false;
            for (let i=0; i < listSounds.length; i++) {
                if (SoundscapeAdventure.soundboards[soundscapeId].class.playlist.sounds.get(listSounds[i].id).playing) {
                    sound.playing = true;
                    break;
                }
            }
        }
        if (sound.playing) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    })

});
