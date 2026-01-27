import constants from './utils/constants.mjs';
import { init as coreInit } from "./regions.mjs";
import SoundscapeAdventure from "./soundscape-adventure.mjs";
import SoundscapeTab from "./soundscape-tab.mjs";
import SoundpadUI from "./soundpad-ui.mjs";
import utils from './utils/utils.mjs';
const cModuleName = "soundscape-adventure";
/**
 * Triggers HOOKS
 */

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

Hooks.on('SoundscapeAdventure-Init', (sidebar, html) => {
    game.soundscapeAdventure = SoundscapeAdventure;
    Hooks.call("SoundscapeAdventure-Ready");
});
Hooks.on('SoundscapeAdventure-UpdateSidebar', () => {
    ui.sidebar.parts[cModuleName].render(true);
    coreInit();
});

// Hooks.on('SBAdventureNewMood', (moodName, mood) => {
//     /*if (sidebar instanceof PlaylistDirectory) {*/
//     /*}*/
// });

// Hooks.on('SBAdventure-PlayingMood', (soundboardName, moodName, mood) => {
//     /*if (sidebar instanceof PlaylistDirectory) {*/
//     /*}*/
// });

// Hooks.on('SoundscapeAdventure-ChangeSoundVolume', (id, moodId, mood) => {    
// });

/**
 * Tigger Hooks
 */
Hooks.on("saveSceneConfig", (sceneConfig, data) => {
    if (data.name === "My Scene") {
        data.flags.myModule.customSetting = true; // Add a custom flag
    }
    return data; // Return the modified data
});
Hooks.on("renderSceneConfig", (app, html, data) => {
    const moduleName = "soundscape-adventure";
    let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
    const current = {
        action: "",
        mood: "",
        soundscape: ""
    };
    const sceneId = app.id.replace('SceneConfig-Scene-', '');
    if (triggerSettings["scenes"]) {
        if (triggerSettings["scenes"][sceneId]) {
            const trig = triggerSettings["scenes"][sceneId];
            current.action = trig.action;
            current.mood = trig.on.split(":")[1];
            current.soundscape = trig.on.split(":")[0];
        }
    }

    if (!SoundscapeAdventure.soundscapes.hasOwnProperty(current.soundscape)) {
        //ui.notifications.warn("The soundscape " + current.soundscape + " is not available. Reseting scene config.");
        current.action = "";
        current.mood = "";
        current.soundscape = "";
    } else {
        const soundscape = SoundscapeAdventure.soundscapes[current.soundscape];
        if (soundscape) {
            if (!soundscape.moods.hasOwnProperty(current.mood)) {
                ui.notifications.warn("The mood " + current.mood + " is not available in the soundscape " + current.soundscape + ". Reseting scene config.");
                current.action = "";
                current.mood = "";
                current.soundscape = "";
            }
        }
    }

    // Add tab header
    const tab_before = html.querySelector('[data-tab="ambience"]');
    const newItem = document.createElement("a");
    newItem.dataset.action = "tab";
    newItem.dataset.group = "sheet";
    newItem.dataset.tab = "music";
    newItem.innerHTML = `<i class="fa-solid fa-music" inert=""></i>
        <span>Music</span>`;
    tab_before.after(newItem);

    // Create tab body
    const before_body = html.querySelector('[data-application-part="ambience"]');
    const newNode = document.createElement("div");
    newNode.className = "tab";
    newNode.setAttribute("data-group", "sheet");
    newNode.setAttribute("data-tab", "music");
    newNode.setAttribute("data-application-part", "music");

    // Build content
    const title = document.createElement("h4");
    title.textContent = "Play or Stop a mood when a scene is activated";

    const soundscapes = SoundscapeAdventure.soundscapes;
    const formGroup1 = document.createElement('div');
    formGroup1.className = 'form-group';
    const label1 = document.createElement('label');
    label1.textContent = 'Soundscape';
    formGroup1.appendChild(label1);
    const select1 = document.createElement('select');
    select1.name = 'soundscape';
    select1.className = "form-field";
    const option1 = document.createElement('option');
    option1.value = '';
    option1.textContent = 'Select';
    select1.appendChild(option1);
    formGroup1.appendChild(select1);

    for (let key in soundscapes) {
        const option = document.createElement('option');
        option.value = soundscapes[key].id;
        if (current.soundscape == soundscapes[key].id)
            option.selected = "selected";
        option.textContent = soundscapes[key].name;
        select1.appendChild(option);
    }

    const formGroup2 = document.createElement('div');
    formGroup2.className = 'form-group';
    const label2 = document.createElement('label');
    label2.textContent = 'Mood';
    formGroup2.appendChild(label2);
    const select2 = document.createElement('select');
    select2.className = "form-field";
    select2.name = 'mood';
    const option2_1 = document.createElement('option');
    option2_1.value = '';
    select2.appendChild(option2_1);

    if (current.soundscape) {
        const soundscape = SoundscapeAdventure.soundscapes[current.soundscape];
        const moods = soundscape.moods;
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
        const soundboard = SoundscapeAdventure.soundscapes[select1.value];
        if (soundboard) {
            const moods = soundboard.moods;
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
        }
    });
    formGroup2.appendChild(select2);

    const actionForm = document.createElement('div');
    actionForm.className = 'form-group';
    const actionLabel = document.createElement('label');
    actionLabel.textContent = 'Action';
    actionForm.appendChild(actionLabel);
    const actionSelect = document.createElement('select');
    actionSelect.className = "soundscape-adventure-action";
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

    const saveBtn = document.createElement('button');
    saveBtn.className = "btn";
    saveBtn.textContent = "Save Music Trigger";
    saveBtn.addEventListener('click', async (event) => {
        const trigger = {
            action: actionSelect.value,
            event: "scene",
            on: `${select1.value}:${select2.value}`
        };
        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
        const sceneId = app.id.replace('SceneConfig-Scene-', '');
        if (!triggerSettings["scenes"]) {
            triggerSettings["scenes"] = {}
        }

        triggerSettings["scenes"][sceneId] = trigger;
        game.settings.set(constants.STORAGETRIGGERSETTINGS, "triggerSettings", triggerSettings);
        event.preventDefault();
    });


    // Append everything
    newNode.appendChild(title);
    newNode.appendChild(formGroup1);
    newNode.appendChild(formGroup2);
    newNode.appendChild(actionForm);
    newNode.appendChild(saveBtn);

    before_body.after(newNode);
});


Hooks.on('updateScene', async (scene, data, modified, sceneId) => {
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

    if (!SoundscapeAdventure.soundscapes[soundscape]) {
        return;
    }
    if (game.ready && data.active) {

        if (action == "play") {
            await SoundscapeAdventure.soundscapes[soundscape].playMood(mood);
        } else {
            await SoundscapeAdventure.soundscapes[soundscape].stopMood(mood);
        }
        // invert the logic, if the trigger is to play a mood when scene is activated, we stop it when scene is deactivated
        Hooks.call("SoundscapeAdventure-UpdateSidebar");
    } else if (game.ready && !data.active) {
        if (action == "play") {
            await SoundscapeAdventure.soundscapes[soundscape].stopMood(mood);
        }

        Hooks.call("SoundscapeAdventure-UpdateSidebar");
    }
});

/**
 * Custom Handlebars
 */
Hooks.once('init', () => {
    game.soundscapeAdventure = {}
    Handlebars.registerHelper('isMoodPlaying', function (status, options) {
        return (status == constants.STATUS.MOOD.PLAYING) ? options.fn(this) : options.inverse(this);
    });
    Handlebars.registerHelper('eachSoundType', function (array, options) {
        let result = '';
        let groups = [];
        //
        array.forEach(el => {
            if (el.group != "") {
                //if ((type + 3) == el.type) { // type 4 + 3 = 7
                if (!groups.includes(el.group)) {

                    groups.push(el.group);
                    const clone = structuredClone(el);
                    clone.name = 'Group: ' + el.group,
                        result += options.fn(clone);
                }
                //}
            } else {
                result += options.fn(el);
            }
        });
        return result;
    });

    Handlebars.registerHelper('eachSoundCategory', function (array, type, options) {
        let result = '';
        let categories = {};
        categories["none"] = [];
        array.forEach(el => {
            if (el.type == type) {
                if (el.category == "") {
                    categories["none"].push(el)
                } else if (categories.hasOwnProperty(el.category)) {
                    categories[el.category].push(el)
                } else {
                    categories[el.category] = [];
                    categories[el.category].push(el)
                }
            }
        });


        return categories;
        //return result;
    });

    Handlebars.registerHelper('soundStatus', function (modStatus, soundStatus) {
        if (soundStatus == constants.STATUS.SOUND.ON && modStatus == constants.STATUS.MOOD.PLAYING) {
            return true;
        }
        return false;
    });

    Handlebars.registerHelper('opositeAction', function (status) {
        if (status == constants.STATUS.SOUND.ON) {
            return constants.STATUS.SOUND.OFF;
        }
        return constants.STATUS.SOUND.ON;
    });

    Handlebars.registerHelper('volumeUI', function (volume) {
        return parseInt(volume * 100) + "%";
    })

    Handlebars.registerHelper('volumeIcon', function (volume) {
        const size = parseInt(volume * 100);
        if (size == 0) {
            return "fas fa-volume-xmark volume-icon";
        } else if (size < 50) {
            return "fas fa-volume-low volume-icon";
        } else if (size < 80) {
            return "fas fa-volume volume-icon";
        }
        return "fas fa-volume-high volume-icon";
    })

    Handlebars.registerHelper('shortenString', function (str) {
        let decodedFileName = decodeURIComponent(str);
        let fileNameWithoutExtension = decodedFileName.replace(/\.[^/.]+$/, "");
        if (fileNameWithoutExtension && fileNameWithoutExtension.length > 16) {
            return `${fileNameWithoutExtension.substring(0, 16)}...`;
        }
        return fileNameWithoutExtension;
    });

    Handlebars.registerHelper('forSoundType', function (options) {
        let result = '';
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

    Handlebars.registerHelper('ifNotEquals', function (arg1, arg2, options) {
        return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
        
    });

    Handlebars.registerHelper('isPlaying', function (soundId, soundscapeId, moodId, options) {
        const soundConfig = SoundscapeAdventure.soundscapes[soundscapeId].moods[moodId].getSound(soundId);
        let sound = {};
        if (soundConfig.group == "") {
            sound = SoundscapeAdventure.soundscapes[soundscapeId].playlist.sounds.get(soundId);
        } else {

            const listSounds = SoundscapeAdventure.soundscapes[soundscapeId].moods[moodId].getSoundByGroup(soundConfig.id);
            sound.playing = false;
            for (let i = 0; i < listSounds.length; i++) {
                if (SoundscapeAdventure.soundscapes[soundscapeId].playlist.sounds.get(listSounds[i].id).playing) {
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
    });

    Handlebars.registerHelper("inColumn", function (itemIndex, buttonsPerColumn, totalColumns, currentColumnIndex) {
        itemIndex = Number(itemIndex);
        buttonsPerColumn = Number(buttonsPerColumn);
        totalColumns = Number(totalColumns);
        currentColumnIndex = Number(currentColumnIndex);

        // Each column gets a block of items
        const start = currentColumnIndex * buttonsPerColumn;
        const end = start + buttonsPerColumn;

        return itemIndex >= start && itemIndex < end;
    });

    Handlebars.registerHelper("range", function (start, end) {
        start = Number(start);
        end = Number(end);
        const arr = [];
        for (let i = start; i <= end; i++) arr.push(i);
        return arr;
    });

    Handlebars.registerHelper("sub", (a, b) => Number(a) - Number(b));
    // modulus helper
    Handlebars.registerHelper("mod", function (a, b) {
        return Number(a) % Number(b);
    });

    // length helper
    Handlebars.registerHelper("length", function (arr) {
        return Array.isArray(arr);
    });

    // check if is empty os array lengh is 0
    Handlebars.registerHelper("ifEmptyArray", function (arr, options) {
        if (Array.isArray(arr)) {
            if (arr.length > 0) {
                return options.inverse(this);
            }
        }
        return options.fn(this);
    })

    Handlebars.registerHelper("gteZero", function (value) {
        return Number(value) > 0;
    });

});

export const cNoteIcon = "fa-speaker";
export const cFolderIcon = "fa-folder";

/* IN ITIALIZE SBAdventure */
Hooks.once('ready', async () => {
    if (!game.user.isGM) {
        return
    }
    // TODO identify how to do this in a better way
    await new Promise(resolve => {
        const tryUnlock = () => {
            if (!foundry.audio.AudioHelper.locked) {
                document.removeEventListener("click", tryUnlock);
                document.removeEventListener("keydown", tryUnlock);
                resolve();
            }
        };

        document.addEventListener("click", tryUnlock);
        document.addEventListener("keydown", tryUnlock);
    });
    const current_soundscapes = await game.settings.get('soundscape-adventure', 'soundscapes');
    utils.log(utils.getCallerInfo(), `Current soundscapes ${current_soundscapes}`, constants.LOGLEVEL.INFO);
    const soundscape_list = current_soundscapes.split(";").map(vPath => vPath.trim()).filter(vPath => vPath.length > 0);
    const validSoundscapes = [];
    for (const soundscape of soundscape_list) {
        try {
            const response = await fetch(soundscape, { method: 'HEAD' });

            if (!response.ok) {
                // Log or notify about the missing file, but do not stop execution
                ui.notifications.warn(`Soundscape not found at ${soundscape}. Removing from this world...`);
            } else {
                // Only load if the file was found
                await SoundscapeAdventure.loadSoundscape(soundscape);
                validSoundscapes.push(soundscape);
            }
        } catch (error) {
            // Catch real fetch errors (e.g., CORS, network issues)
            ui.notifications.warn(`Error checking soundscape at ${soundscape}. Skipping...`);
            console.error(error);
        }
    }
    await game.settings.set('soundscape-adventure', 'soundscapes', validSoundscapes.join(";"));
    utils.log(utils.getCallerInfo(), `Saving soundscapes ${validSoundscapes.join(";")}`, constants.LOGLEVEL.INFO);
    Hooks.call("SoundscapeAdventure-UpdateSidebar");
    Hooks.call("SoundscapeAdventure-Init");

});

Hooks.on("getSceneControlButtons", (controls) => {
    //alert("getSceneControlButtons");
    // Find or create your own control group
    //let myTools = controls.find(c => c.name === "soundscape-adventure-controls");
    if (!controls.hasOwnProperty("soundscapeAdventure")) {
        // controls["soundscapeAdventure"] = {
        //     active: false,
        //     activeTool: "soundpad",       // true = active, false = inactive
        //     name: "soundscapeAdventure",          // Internal name
        //     title: "Soundpad",         // Tooltip name
        //     icon: "fas fa-star",          // FontAwesome icon
        //     layer: "tokens",              // Layer to activate (or null)
        //     tools: [],                    // Will hold your buttons
        //     onChange: (_event, active) => {
        //         ui.notifications.info("You clicked my button!");
        //     }
        // };
        //controls.push(myTools);
    }

    // Add a tool (button) to the group
    controls.sounds.tools["soundpad"] = {
        name: "soundpad",
        title: "Soundpad",
        icon: "fas fa-list-music",
        button: true,
        //toggle: false, // one-time click
        visible: true, // or () => true
        onChange: async (e, x) => {
            //ui.notifications.info("Token tool clicked!");
            if (game.soundscapeAdventure.soundpadUI) {
                await game.soundscapeAdventure.soundpadUI.render(true);
                //game.soundscapeAdventure.soundpadUI = null;
            } else {
                game.soundscapeAdventure.soundpadUI = new SoundpadUI({ position: { width: 600, height: 600 } });
                Hooks.call("SoundscapeAdventure-Soundpad-Render");
            }
        }
    };
});

Hooks.on("SoundscapeAdventure-Soundpad-Render", async () => {
    //scene-controls
    if (game.soundscapeAdventure.soundpadUI) {
        await game.soundscapeAdventure.soundpadUI.render(true);
        //game.soundscapeAdventure.soundpadUI.close();
    }
});

Hooks.on("soundscape-adventure.mood.playStopMood", (soundscapeId, moodId, mood) => {
    ui.sidebar.parts[cModuleName].render(true);
    if (SoundscapeAdventure.soundscapes[soundscapeId]?.openUI)
        SoundscapeAdventure.soundscapes[soundscapeId].openUI.render(true);


});
/* INITIALIZE Sidebar*/
Hooks.once('ready', () => {
    const cModuleName = "soundscape-adventure";
    //alert("Soundscape Adventure Loaded");
    const cVersion = game.data.release.generation;
    const cOldSideBarUI = cVersion < 13;

    let vSidebar = cOldSideBarUI ? ui.sidebar._element[0] : ui.sidebar.element;
    let vNoteTab = document.createElement("section");
    vNoteTab.classList.add("tab", "sidebar-tab", "playlists-sidebar", "directory", "flexcol");
    vNoteTab.setAttribute("id", cModuleName);
    vNoteTab.setAttribute("data-tab", cModuleName);
    if (!cOldSideBarUI) {
        vNoteTab.style.background = "var(--sidebar-background, var(--color-cool-5-90))";
        vNoteTab.style.color = "var(--color-text-primary)";
    }

    ui[cModuleName] = new SoundscapeTab({ tab: vNoteTab, oldUI: cOldSideBarUI });

    if (cOldSideBarUI) {
        ui.sidebar.tabs[cModuleName] = ui[cModuleName];

        let vNoteTabButton = document.createElement("a");
        vNoteTabButton.classList.add("item");
        vNoteTabButton.setAttribute("data-tab", cModuleName);
        vNoteTabButton.setAttribute("data-tooltip", "Soundscapes");
        vNoteTabButton.setAttribute("aria-controls", cModuleName);
        vNoteTabButton.setAttribute("role", "tab");

        let vNoteIcon = document.createElement("i");
        vNoteIcon.classList.add("fa-solid", cNoteIcon);

        vNoteTabButton.appendChild(vNoteIcon);

        vSidebar.querySelector("nav").querySelector(`[data-tab="playlists"]`).after(vNoteTabButton);
        vSidebar.appendChild(vNoteTab);
    }
    else {
        ui.sidebar.parts[cModuleName] = ui[cModuleName];
        let vNoteListItem = document.createElement("li");

        let vNoteTabButton = document.createElement("button");
        vNoteTabButton.classList.add("ui-control", "plain", "icon", "fa-solid", cNoteIcon, "item-active");
        vNoteTabButton.setAttribute("data-action", "tab");
        vNoteTabButton.setAttribute("role", "tab");
        vNoteTabButton.setAttribute("data-tab", cModuleName);
        vNoteTabButton.setAttribute("data-group", "primary");
        vNoteTabButton.setAttribute("data-tooltip", "Soundscapes");
        vNoteTabButton.setAttribute("aria-controls", cModuleName);
        vNoteTabButton.setAttribute("role", "tab");

        vNoteTab.setAttribute("data-group", "primary");

        vNoteListItem.appendChild(vNoteTabButton);
        vSidebar.querySelector("nav").querySelector(`[data-tab="playlists"]`).parentNode.after(vNoteListItem);
        vSidebar.querySelector('[id="sidebar-content"]').appendChild(vNoteTab);
    }
});