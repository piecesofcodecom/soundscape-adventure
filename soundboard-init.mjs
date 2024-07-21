import SoundBoardAdventureUI from './soundboard-adventure-ui.mjs';

/**
 * HOOKS
 */
Hooks.on('renderSidebarTab', (sidebar, html) => {
    if (sidebar instanceof PlaylistDirectory) {
        SoundBoardAdventureUI.init(html);
    }
})

Hooks.on("updatePlaylist", (playlist, data, options, userId) => {
    console.log(`Playlist "${playlist.name}" has been updated`);
    console.log('Updated data:', data);
    console.log('Update options:', options);
    console.log('User ID:', userId);
});

/** AFTER LOAD and Heandlebars */
Hooks.once('init', () => {

    // Register a custom helper named 'customLoop'
    Handlebars.registerHelper('eachSoundType', function (array, type, options) {
        console.log("eachSoundType init", array, type)
        let result = '';
        array.forEach(el => {
            //console.log("include", el)
            if (el.type ==type) {
                result += options.fn(el);
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
            title: "Ambience"
        });
        result += options.fn({
            name: "loop",
            title: "Loop"
        });
        result += options.fn({
            name: "random",
            title: "Random"
        });
        result += options.fn({
            name: "none",
            title: "Soundpad"
        });
        return result;
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

});
