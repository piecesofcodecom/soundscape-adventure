import SoundscapeAdventureUI from './soundscape-adventure-ui.mjs';
import constants from './utils/constants.mjs';

/**
 * FOUNDRY HOOKS
 */
Hooks.on('renderSidebarTab', (sidebar, html) => {
    if (sidebar instanceof PlaylistDirectory) {
        SoundscapeAdventureUI.init(html);
    }
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


/** AFTER LOAD and Heandlebars */
Hooks.once('init', () => {
    // Register a custom helper named 'customLoop'
    Handlebars.registerHelper('eachSoundType', function (array, type, options) {
        let result = '';
        let groups = [];
        array.forEach(el => {
            if (el.type == type) {
                // for groups we add only a representation for all sounds
                result += options.fn(el);
            } else if (el.group != "") {
                if( (type + 3) == el.type) { 
                    if (!groups.includes(el.group)) {
                        groups.push(el.group);
                        result += options.fn({
                            name: 'Group: '+el.group,
                            path: el.path,
                            id: el.id,
                            status: el.status,
                            type: el.type,
                            volume: el.volume,
                            group: el.group,
                            intensity: el.intensity
                        })
                    }
                }
            }
        });
        return result;
    });

    Handlebars.registerHelper('soundStatus', function(modStatus, soundStatus) {
        if(soundStatus == "on" && modStatus == "playing") {
            return true;
        }
        return false;
    });

    Handlebars.registerHelper('opositeAction', function(status) {
        if(status == "on") {
            return 'off';
        }
        return 'on';
    });

    Handlebars.registerHelper('volumeUI', function(volume) {
        return volume * 100;
    })

    Handlebars.registerHelper('shortenString', function(str) {
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
        /*result += options.fn({
            name: "none",
            title: "Soundpad",
            code: constants.SOUNDTYPE.SOUNDPAD
        });*/
        return result;
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

});
