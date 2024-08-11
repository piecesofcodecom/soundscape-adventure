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

    game.settings.register('soundscape-adventure', 'root-folder', {
      name: "The root folder of the soundscapes",
      hint: "The folder where the soundscapes are. Don't make it the soundboard folder, it needs to be a folder before, where the soundscape's folder is within.",
      scope: 'world',     // This specifies that the setting is stored at the world level
      config: true,       // This specifies that the setting should appear in the settings configuration UI
      type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
      default: "modules/soundscape-adventure/sample-root-soundscapes",  // The default value of the setting
      filePicker: "folder",
      requiresReload: true,
    });
    game.settings.register('soundscape-adventure', 'enable-logs', {
      name: "Enable module logs",
      hint: "It helps troubleshoot issues with the module.",
      scope: 'world',     // This specifies that the setting is stored at the world level
      config: true,       // This specifies that the setting should appear in the settings configuration UI
      type: Boolean,       // The type of data that is stored (String, Number, Boolean, etc.)
      default: false,  // The default value of the setting
    });
  });

  


// Function to open the file picker for folder selection and return a Promise
async function selectFolder() {
  if (!game.settings.get('soundscape-adventure', 'root-folder')) {
    const myDialogOptions = {
      width: 400,
      height: 300,
    };
    
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: "Soundscape Adventure Directory Setup" },
      content: `
        <p>Welcome to the Soundscape Adventure!</p>
        <p>Please select the root folder for your soundscapes. If you are new to this module, consider read <a href="https://github.com/piecesofcodecom/soundscape-adventure/blob/main/TUTORIAL.md">the tutorial</a> before proceed.</p>
        <br /><br />
        <div class="form-group">
          <label>Selected Folder:</label>
          <br />
          <input type="text" id="foldername" name="folder" value="" data-dtype="String" readonly>
          <br /><br />
          <button type="button" id="soundscape-picker" >Browse</button>
          <br /><br />
        </div>
      `,
      buttons: [{
          action: "choice",
          label: "Save",
          callback: (event,button, dialog) => {
            const dir = button.form.elements.folder.value;
            game.settings.set('soundscape-adventure', 'root-folder', dir);
          }
      }]
    }, myDialogOptions);
    await dialog.render(true);
    const browser = dialog.element.querySelector('#soundscape-picker');
    const input = dialog.element.querySelector('#foldername');
    browser.addEventListener('click', async () => {
      const path = await new Promise((resolve, reject) => {
        new FilePicker({
          type: "folder",
          callback: (path) => {
            if (path) {
              resolve(path);
            } else {
              reject("No folder selected");
            }
          },
          top: 100,    // Position the file picker at the top
          left: 100,   // Position the file picker at the left
        }).render(true);
      });
      input.value = path;
    });
    
  }
}

// Function to handle the folder selection process
async function handleFolderSelection() {
  try {
    const rootFolder = game.settings.get('soundscape-adventure', 'root-folder');
    if (rootFolder.trim().length == 0 || rootFolder.includes("sample-root-soundscapes")) {
      await selectFolder();
    }
  } catch (error) {
    console.error(error);
  }
}


Hooks.once('ready', () => {
  handleFolderSelection(); 
});