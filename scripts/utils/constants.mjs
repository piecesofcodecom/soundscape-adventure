const LOGLEVEL = {
    INFO: 0,
    WARN: 1,
    ERROR: 2
}

const MOOD = {
    STATUS: {
        STOP: 1,
        PLAYING: 2
    }
}

// String-based status constants (matching actual usage in codebase)
const STATUS = {
    MOOD: {
        PLAYING: "playing",
        STOP: "stop"
    },
    SOUND: {
        ON: "on",
        OFF: "off"
    },
    SOUNDSCAPE: {
        ONLINE: "online",
        OFFLINE: "offline"
    }
}

const SOUNDTYPE = {
    AMBIENCE: 0,
    LOOP: 1,
    RANDOM: 2,
    SOUNDPAD: 3, // LIBRARY
    GROUP_LOOP: 4,
    GROUP_RANDOM: 5,
    GROUP_SOUNDPAD: 6,
    SOUNDPADUI: 7,
    INVALID: -1

}

const SOUNDVIEW = {
    CARDVIEW: 0,
    MIXERVIEW: 1
}

const SOUNDSCAPE_TYPE = {
    LOCAL: 0,
    REMOTE_S3: 1
}

const PREFIX="Soundscape";

const STORAGETRIGGERSETTINGS = "soundscape-adventure.triggerSettings";

const MODULE = {
    name: "soundscape-adventure",
    version: "0.5.0"
}

export default {
    LOGLEVEL,
    MOOD,
    STATUS,
    SOUNDTYPE,
    SOUNDSCAPE_TYPE,
    PREFIX,
    STORAGETRIGGERSETTINGS,
    MODULE,
    SOUNDVIEW
  };