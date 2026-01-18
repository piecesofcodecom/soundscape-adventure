import constants from "./utils/constants.mjs";
Hooks.once('init', () => {
  // Register a setting
  game.settings.register('soundscape-adventure', 'current-playing', {
    name: "The current mood that is playing in the world",
    hint: "The current mood that is playing in the world",
    scope: 'world',     // This specifies that the setting is stored at the world level
    config: false,       // This specifies that the setting should appear in the settings configuration UI
    type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
    default: "",  // The default value of the setting
  });

  game.settings.register('soundscape-adventure', 'soundscapes', {
    name: "The current list of soundscapes in the world",
    hint: "The current list of soundscapes in the world",
    scope: 'world',     // This specifies that the setting is stored at the world level
    config: false,       // This specifies that the setting should appear in the settings configuration UI
    type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
    default: "", // The default value of the setting
  });

  // game.settings.register('soundscape-adventure', 'token-server', {
  //   name: "Token required to authenticate to the server",
  //   hint: "Token required to authenticate to the server",
  //   scope: 'world',     // This specifies that the setting is stored at the world level
  //   config: true,       // This specifies that the setting should appear in the settings configuration UI
  //   type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
  //   default: "", // The default value of the setting
  // });

  game.settings.register('soundscape-adventure', 'enable-logs', {
    name: "Enable module logs",
    hint: "It helps troubleshoot issues with the module.",
    scope: 'world',     // This specifies that the setting is stored at the world level
    config: true,       // This specifies that the setting should appear in the settings configuration UI
    type: Boolean,       // The type of data that is stored (String, Number, Boolean, etc.)
    default: false,  // The default value of the setting
  });

  game.settings.register('soundscape-adventure', 'sound-view-type', {
    name: "Sound view",
    hint: "You can see the sounds as cards or as Mixer.",
    scope: 'world',     // This specifies that the setting is stored at the world level
    config: true,       // This specifies that the setting should appear in the settings configuration UI
    type: Number,       // The type of data that is stored (String, Number, Boolean, etc.)
    default: 0,  // The default value of the setting
    requiresReload: true, // true if you want to prompt the user to reload
    choices: {
      0: "Card View",
      1: "Mixer View",
    },
  });

  game.settings.register(constants.STORAGETRIGGERSETTINGS, "triggerSettings", {
    name: "Trigger Settings",
    scope: "world",  // Can be "world" or "client" depending on whether the data should be global or per-user
    config: false,  // Set to true if you want this setting to be accessible via the Foundry UI
    default: {},
    type: Object
  });

  game.settings.register(constants.STORAGETRIGGERSETTINGS, "currentMoodOnUI", {
    name: "Current active moods on the UI",
    scope: "world",  // Can be "world" or "client" depending on whether the data should be global or per-user
    config: false,  // Set to true if you want this setting to be accessible via the Foundry UI
    default: {},
    type: Object
  });

  game.settings.register('soundscape-adventure', "newsDialog", {
    name: "News Dialog",
    scope: "world",  // Can be "world" or "client" depending on whether the data should be global or per-user
    config: false,  // Set to true if you want this setting to be accessible via the Foundry UI
    default: "",
    type: String
  });

  game.settings.register(`soundscape-adventure`, "regionSoundscapes", {
    name: "Soundscapes for regions",
    scope: "world",
    config: false,
    default: {},
    type: Object
  });

  //   game.settings.register('soundscape-adventure', "configCategory", {
  //     name: "Soundpad UI Category",
  //     hint: "The category of soundpad sounds to use in the UI.",
  //     scope: "world",
  //     config: true,
  //     type: String,
  // });
});


async function newsDialog() {
  const version = game.settings.get('soundscape-adventure', "newsDialog");
  if (version != constants.MODULE.version) {
    const templatePath = "/modules/soundscape-adventure/templates/news.html";
    const html_content = await foundry.applications.handlebars.renderTemplate(templatePath, {});

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: "Soundscape Adventure NEWS", classes: ["my-package"] },
      position: { width: 800, height: 600 },
      content: html_content,
      buttons: [{
        action: "choice",
        label: "Confirm",
        callback: (event, button, dialog) => {
          game.settings.set('soundscape-adventure', "newsDialog", constants.MODULE.version);
        }
      }]
    });
    await dialog.render(true);
    dialog.classList.add("my-package-news");
    const content = dialog.element.querySelector(".window-content");
    content.style.overflowY = "scroll";
  }
}

Hooks.once('ready', () => {
  foundry.applications.handlebars.loadTemplates([
    'modules/soundscape-adventure/templates/soundscape/parts/left-menu.hbs',
    'modules/soundscape-adventure/templates/soundscape/parts/sound-library.hbs',
    'modules/soundscape-adventure/templates/soundscape/parts/sound-group.hbs',
    'modules/soundscape-adventure/templates/soundscape/parts/sound-card.hbs',
    'modules/soundscape-adventure/templates/soundscape/parts/sound-mixer.hbs',
    'modules/soundscape-adventure/templates/soundscape/parts/sound-list.hbs',
    'modules/soundscape-adventure/templates/soundscape/parts/sound-category.hbs'
  ]);
  newsDialog();
});