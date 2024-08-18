import {
    //BaseStatusRegionBehaviorType,
    BaseStatusEventsRegionBehaviorType,
  } from "./base.js";
  import SoundscapeAdventure from "./soundscape-adventure.mjs";
  import constants from "./utils/constants.mjs";
  const { BooleanField, DocumentUUIDField, StringField } = foundry.data.fields;
  
  export function init() {
    // register the DataModel
    Object.assign(CONFIG.RegionBehavior.dataModels, {
      //"soundscape-adventure.moodPlay": StatusRegionBehaviorType,
      "soundscape-adventure.moodPlayEvents": StatusEventsRegionBehaviorType,
    });
  
    // add type icons
    Object.assign(CONFIG.RegionBehavior.typeIcons, {
      //"soundscape-adventure.moodPlay": "fa-solid fa-person-burst",
      "soundscape-adventure.moodPlayEvents": "fa-solid fa-person-burst",
    });
  
    // register the Sheet
    DocumentSheetConfig.registerSheet(
      RegionBehavior,
      "soundscape-adventure",
      foundry.applications.sheets.RegionBehaviorConfig,
      {
        types: [
          //"soundscape-adventure.moodPlay",
          "soundscape-adventure.moodPlayEvents",
        ],
        makeDefault: true,
      }
    );
  }
  
  /*****************
   * Status Effects
   ****************/
  
  function StatusMixin(Base) {
    return class Status extends Base {
      static _statusChoices() {
        const sounds = SoundscapeAdventure.soundboards;
        let obj = {};
        for (let key in sounds) {
            for (let mood in sounds[key].class.moods) {
                obj[`${key}:${mood}`] = `${sounds[key].name} -> ${sounds[key].class.moods[mood].name}`
            }
        }
        return obj;
      }
  
      async _toggleStatus(event) {
        SoundscapeAdventure.triggerEvent(this.action, this.moodId, event)
      }
    };
  }
  
  /**
   * The data model for a behavior that applies a status effect while inside the Region.
   */
  /*class StatusRegionBehaviorType extends StatusMixin(BaseStatusRegionBehaviorType) {
    static defineSchema() {
      return {
        moodId: new StringField({
          required: true,
          blank: false,
          nullable: true,
          initial: null,
          choices: this._statusChoices,
        })
      };
    }
  }*/
  
  /**
   * The data model for a behavior that toggles, adds, or removes a status effect based on the subscribed event.
   */
  class StatusEventsRegionBehaviorType extends StatusMixin(BaseStatusEventsRegionBehaviorType) {
    static defineSchema() {
      return {
        events: this._createEventsField(),
        moodId: new StringField({
          required: true,
          blank: false,
          nullable: true,
          initial: null,
          choices: this._statusChoices,
        }),
        action: this._createActionField(),
      };
    }
  }
