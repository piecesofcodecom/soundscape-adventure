import SoundBoardAdventureUI from './soundboard-adventure-ui.mjs';
import constants from './utils/constants.mjs';

/**
 * HOOKS
 */
Hooks.on('renderSidebarTab', (sidebar, html) => {
    if (sidebar instanceof PlaylistDirectory) {
        console.log(sidebar);
        SoundBoardAdventureUI.init(html);
    }
})


Hooks.on('SBAdventureNewMood', (moodName, mood) => {
    /*if (sidebar instanceof PlaylistDirectory) {*/
        SoundBoardAdventureUI.updateSoundboards();
    /*}*/
});

Hooks.on('SBAdventure-PlayingMood', (soundboardName, moodName, mood) => {
    /*if (sidebar instanceof PlaylistDirectory) {*/
    //alert("asd")
    SoundBoardAdventureUI.updateMoodControlsUI(soundboardName, moodName, mood);
    /*}*/
});

Hooks.on("updatePlaylist", (playlist, data, options, userId) => {
    console.log(`Playlist "${playlist.name}" has been updated`);
    console.log('Updated data:', data);
    console.log('Update options:', options);
    console.log('User ID:', userId);
    //TODO 
});

/** AFTER LOAD and Heandlebars */
Hooks.once('init', () => {

    // Register a custom helper named 'customLoop'
    Handlebars.registerHelper('eachSoundType', function (array, type, options) {
        let result = '';
        let groups = [];
        array.forEach(el => {
            if (el.type == type) {
                console.log('porItem e type',el)
                // for groups we add only a representation for all sounds
                result += options.fn(el);
            } else if (el.group != "") {
                    if( (type + 3) == el.type) { 
                        console.log('tem Group',el)
                        if (!groups.includes(el.group)) {
                            groups.push(el.group);
                            result += options.fn({
                                name: 'Group: '+el.group,
                                path: el.path,
                                _id: el._id,
                                status: el.status,
                                type: el.type,
                                volume: el.volume,
                                group: el.group
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
        if (str && str.length > 8) {
            return `${str.substring(0, 8)}...`;
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

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

});
