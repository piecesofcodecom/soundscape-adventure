Hooks.once('init', () => {
    // Register a setting
    game.settings.register('soundboard-adventure', 'current-playing', {
      name: "The current mood that is playing",
      hint: "The current .",
      scope: 'world',     // This specifies that the setting is stored at the world level
      config: false,       // This specifies that the setting should appear in the settings configuration UI
      type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
      default: "",  // The default value of the setting
    });

    game.settings.register('soundboard-adventure', 'root-folder', {
      name: "The root folder of the soundboards",
      hint: "The folder where the soundboards are.",
      scope: 'world',     // This specifies that the setting is stored at the world level
      config: true,       // This specifies that the setting should appear in the settings configuration UI
      type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
      default: "",  // The default value of the setting
    });
  });

  async function configureRootFolder() {
    return new Promise((resolve, reject) => {
        new FilePicker({
          type: "folder",
          callback: (path) => {
            if (path) {
              resolve(path);
             game.settings.set('soundboard-adventure', 'root-folder', this.path);
            } else {
              reject("No folder selected");
            }
          },
          top: 100,    // Position the file picker at the top
          left: 100,   // Position the file picker at the left
        }).render(true);
      });
}

// Function to open the file picker for folder selection and return a Promise
function selectFolder() {
  return new Promise((resolve, reject) => {
    new FilePicker({
      type: "folder",
      title: "Select the Root soundboard folder",
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
}

// Function to handle the folder selection process
async function handleFolderSelection() {
  try {
    const rootFolder = game.settings.get('soundboard-adventure', 'root-folder');
    if (rootFolder.trim().length == 0) {
      const selectedFolder = await selectFolder();
      game.settings.set('soundboard-adventure', 'root-folder', selectedFolder).then(updatedValue => {
        console.log("Updated value of root-folder:", updatedValue);
        location.reload();
      });
    }
  } catch (error) {
    console.error(error);
    // Handle any errors or cancellations
  }
}


Hooks.once('ready', () => {
  handleFolderSelection(); 
});