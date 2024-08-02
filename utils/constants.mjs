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

const SOUNDTYPE = {
    AMBIENCE: 0,
    LOOP: 1,
    RANDOM: 2,
    SOUNDPAD: 3,
    GROUP_LOOP: 4,
    GROUP_RANDOM: 5,
    INVALID: -1

}

const SOUNDSCAPE_TYPE = {
    LOCAL: 0,
    REMOTE_S3: 1
}

const PREFIX="Soundscape";

export default {
    LOGLEVEL,
    MOOD,
    SOUNDTYPE,
    SOUNDSCAPE_TYPE,
    PREFIX
    // Add other constants here
  };