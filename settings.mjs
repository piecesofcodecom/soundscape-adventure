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
      default: "",  // The default value of the setting
    });

    game.settings.register('soundscape-adventure', 'root-folder', {
      name: "The root folder of the soundboards",
      hint: "The folder where the soundboards are.",
      scope: 'world',     // This specifies that the setting is stored at the world level
      config: true,       // This specifies that the setting should appear in the settings configuration UI
      type: String,       // The type of data that is stored (String, Number, Boolean, etc.)
      default: "",  // The default value of the setting
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

  


  /*async function configureRootFolder() {
    return new Promise((resolve, reject) => {
        new FilePicker({
          type: "folder",
          callback: (path) => {
            if (path) {
              resolve(path);
             game.settings.set('soundscape-adventure', 'root-folder', this.path);
            } else {
              reject("No folder selected");
            }
          },
          top: 100,    // Position the file picker at the top
          left: 100,   // Position the file picker at the left
        }).render(true);
      });
}*/

// Function to open the file picker for folder selection and return a Promise
async function selectFolder() {
  if (!game.settings.get('soundscape-adventure', 'root-folder')) {
    const myDialogOptions = {
      width: 400,
      height: 300,
    };
    
    return new Dialog({
      title: "Soundscape Adventure Directory Setup",
      content: `
        <p>Welcome to the Soundscape Adventure!</p>
        <p>Please select the source folder for your soundscapes.</p>
        <br /><br />
        <div class="form-group">
          <label>Selected Folder:</label>
          <br />
          <input type="text" name="root-folder" value="" data-dtype="String">
          <br /><br />
          <button type="button" id="soundscape-picker" >Browse</button>
          <br /><br />
        </div>
      `,
      buttons: {
        ok: {
          label: "Save",
          callback: (html) => {
            const dir = html.find('input[name="root-folder"]').val();
            game.settings.set('soundscape-adventure', 'root-folder', dir);
          }
        }
      },
      default: "ok",
      render: (html) => {
        html.find('#soundscape-picker').on('click', async () => {
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
          html.find('input[name="root-folder"]').val(path);
        });
      }
    }, myDialogOptions).render(true);

    //dialog.render(true);
  }
  

  
}

// Function to handle the folder selection process
async function handleFolderSelection() {
  try {
    const rootFolder = game.settings.get('soundscape-adventure', 'root-folder');
    if (rootFolder.trim().length == 0) {
      await selectFolder();
      /*game.settings.set('soundscape-adventure', 'root-folder', selectedFolder).then(updatedValue => {
        location.reload();
      });*/
    }
  } catch (error) {
    console.error(error);
    // Handle any errors or cancellations
  }
}


Hooks.once('ready', () => {
  handleFolderSelection(); 
});