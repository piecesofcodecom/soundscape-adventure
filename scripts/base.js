const { RegionBehaviorType } = foundry.data.regionBehaviors;
const { StringField } = foundry.data.fields;

/** The Region Events that operate on a token. */
const TOKEN_EVENTS = [
  CONST.REGION_EVENTS.TOKEN_ENTER,
  CONST.REGION_EVENTS.TOKEN_EXIT,
  CONST.REGION_EVENTS.TOKEN_MOVE,
  CONST.REGION_EVENTS.TOKEN_MOVE_IN,
  CONST.REGION_EVENTS.TOKEN_MOVE_OUT,
  CONST.REGION_EVENTS.TOKEN_PRE_MOVE,
  CONST.REGION_EVENTS.TOKEN_ROUND_END,
  CONST.REGION_EVENTS.TOKEN_ROUND_START,
  CONST.REGION_EVENTS.TOKEN_TURN_END,
  CONST.REGION_EVENTS.TOKEN_TURN_START,
];

/*****************
 * Status Effects
 ****************/

/**
 * The base class for the `statusEffect` Region Behavior. To use it as a Region Behavior, extend the class and add
 * the `static defineSchema` and `_toggleStatus` functions.
 */
/*export class BaseStatusRegionBehaviorType extends RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["RAE.TYPES.moodPlay"];

  static async #onTokenEnter(event) {
    // quick data verification
    const actor = event.data?.token?.actor;
    if (!actor || !this.statusId) return;

    // only run on triggering user
    if (!event.user.isSelf) return;

    this._toggleStatus(actor, true);
  }

  static async #onTokenExit(event) {
    // quick data verification
    const actor = event.data?.token?.actor;
    if (!actor || !this.statusId) return;

    // only run on triggering user
    if (!event.user.isSelf) return;

    this._toggleStatus(actor, false);
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: this.#onTokenEnter,
    [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#onTokenExit,
  };
}*/

/**
 * The base class for the `statusEffectEvents` Region Behavior. To use it as a Region Behavior, extend the class and add
 * the `static defineSchema` and `_toggleStatus` functions.
 */
export class BaseStatusEventsRegionBehaviorType extends RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["RAE.TYPES.moodPlay", "RAE.TYPES.moodPlayEvents"];

  static _createEventsField() {
    return super._createEventsField({ events: TOKEN_EVENTS });
  }

  static _createActionField() {
    return new StringField({
      required: true,
      blank: false,
      nullable: false,
      initial: "play",
      choices: {
        custom: "RAE.TYPES.moodPlayEvents.FIELDS.action.choices.custom",
        play: "RAE.TYPES.moodPlayEvents.FIELDS.action.choices.play",
        stop: "RAE.TYPES.moodPlayEvents.FIELDS.action.choices.stop",
      },
    });
  }

  async _handleRegionEvent(event) {
    // quick data verification
    if (!game.users.activeGM?.isSelf) return;

    this._toggleStatus(event);
    /*const actor = event.data?.token?.actor;
    if (!actor || !this.statusId) return;

    // only run once by active GM
    if (!game.users.activeGM?.isSelf) return;

    const active = this.action === "apply" ? true : this.action === "remove" ? false : undefined;
    this._toggleStatus(actor, active);*/
  }
}
