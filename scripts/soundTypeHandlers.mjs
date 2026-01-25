/**
 * Sound Type Handlers - Strategy Pattern for sound playback
 *
 * Each handler implements play() and stop() methods for a specific sound type.
 * This eliminates the large switch statements in Soundscape.playSound() and stopSound().
 */

import constants from "./utils/constants.mjs";

/**
 * Context object passed to all handlers
 * @typedef {Object} SoundContext
 * @property {Playlist} playlist - The Foundry playlist
 * @property {string} playlistId - The playlist ID
 * @property {MoodConfig} mood - The current mood
 * @property {RandomSoundManager} randomSoundManager - The random sound manager
 * @property {Function} _playSound - Helper function to play a sound with fade
 * @property {Function} _playLoopGroup - Helper function to play loop groups
 */

/**
 * Helper to play a sound with fade in
 * @param {SoundConfig} soundConfig
 * @param {PlaylistSound} sound
 * @param {Playlist} playlist
 */
async function playSoundWithFade(soundConfig, sound, playlist) {
    await sound.load();
    sound.update({ volume: soundConfig.volume });

    const isLoop = soundConfig.type === constants.SOUNDTYPE.GROUP_LOOP ||
                   soundConfig.type === constants.SOUNDTYPE.LOOP;
    sound.update({ "repeat": isLoop });

    await playlist.playSound(sound);
    await new Promise(r => setTimeout(r, 0));

    if (soundConfig.fadeIn > 0) {
        sound.sound.fade(soundConfig.volume, { duration: soundConfig.fadeIn * 1000, from: 0 });
    }
}

/**
 * Helper to stop a sound with fade out
 * @param {SoundConfig} soundConfig
 * @param {PlaylistSound} playlistSound
 * @param {Playlist} playlist
 */
async function stopSoundWithFade(soundConfig, playlistSound, playlist) {
    if (!playlistSound) return;

    await playlistSound.load();
    if (!playlistSound.playing) return;

    await playlistSound.sound.load();

    if (soundConfig.fadeOut > 0) {
        playlistSound.sound.fade(0, {
            duration: soundConfig.fadeOut * 1000,
            from: playlistSound.sound.volume
        }).then(async () => {
            await playlist.stopSound(playlistSound);
        });
    } else {
        await playlist.stopSound(playlistSound);
    }
}

/**
 * Handler for LOOP sounds (type 1)
 */
const loopHandler = {
    async play(soundConfig, context) {
        const sound = await context.playlist.sounds.get(soundConfig.id);
        if (sound) {
            context.mood.enableSound(soundConfig.id);
            await playSoundWithFade(soundConfig, sound, context.playlist);
        }
    },

    async stop(soundConfig, context) {
        const playlistSound = await context.playlist.sounds.get(soundConfig.id);
        await stopSoundWithFade(soundConfig, playlistSound, context.playlist);
    }
};

/**
 * Handler for RANDOM sounds (type 2)
 */
const randomHandler = {
    async play(soundConfig, context) {
        context.randomSoundManager.start(
            context.playlistId,
            soundConfig.id,
            soundConfig.from,
            soundConfig.to,
            soundConfig.volume,
            soundConfig.playOnce
        );
    },

    async stop(soundConfig, context) {
        if (soundConfig.group !== "") {
            const group = context.mood.groups.find(el => el.id === soundConfig.group);
            if (group) {
                context.randomSoundManager.stop(context.playlistId, group.sounds.map(s => s.id));
            }
        } else {
            context.randomSoundManager.stop(context.playlistId, soundConfig.id);
        }
    }
};

/**
 * Handler for SOUNDPAD sounds (type 3) and SOUNDPADUI (type 7)
 */
const soundpadHandler = {
    async play(soundConfig, context) {
        const sound = await context.playlist.sounds.get(soundConfig.id);
        if (sound) {
            sound.update({ "repeat": false });
            await playSoundWithFade(soundConfig, sound, context.playlist);
        }
    },

    async stop(soundConfig, context) {
        const playlistSound = await context.playlist.sounds.get(soundConfig.id);
        await stopSoundWithFade(soundConfig, playlistSound, context.playlist);
    }
};

/**
 * Handler for GROUP_LOOP sounds (type 4)
 */
const groupLoopHandler = {
    async play(soundConfig, context) {
        // Set all sounds in group to repeat
        for (let i = 0; i < soundConfig.sounds.length; i++) {
            const sound = await context.playlist.sounds.get(soundConfig.sounds[i].id);
            if (sound) {
                sound.update({ "repeat": true });
            }
        }
        // Play the current sound based on intensity
        await context.playFromGroup(soundConfig.id, context.moodId);
    },

    async stop(soundConfig, context) {
        const playlistSound = await context.playlist.sounds.get(soundConfig.current);
        await stopSoundWithFade(soundConfig, playlistSound, context.playlist);
    }
};

/**
 * Handler for GROUP_RANDOM sounds (type 5)
 */
const groupRandomHandler = {
    async play(soundConfig, context) {
        // Set all sounds in group to not repeat
        for (let i = 0; i < soundConfig.sounds.length; i++) {
            const sound = await context.playlist.sounds.get(soundConfig.sounds[i].id);
            if (sound) {
                sound.update({ "repeat": false });
            }
        }
        // Start random sound manager for the group
        const groupOfSounds = soundConfig.sounds.map(sound => sound.id);
        context.randomSoundManager.start(
            context.playlistId,
            groupOfSounds,
            soundConfig.random.from,
            soundConfig.random.to,
            soundConfig.volume,
            soundConfig.playOnce
        );
    },

    async stop(soundConfig, context) {
        const soundIds = soundConfig.sounds.map(s => s.id);
        context.randomSoundManager.stop(context.playlistId, soundIds);
        // Also stop any playing sounds
        for (const soundId of soundIds) {
            await context.playlist.stopSound({ id: soundId });
        }
    }
};

/**
 * Handler for GROUP_SOUNDPAD sounds (type 6)
 */
const groupSoundpadHandler = {
    async play(soundConfig, context) {
        const sound = await context.playlist.sounds.get(soundConfig.id);
        if (sound) {
            sound.update({ "repeat": false });
            await playSoundWithFade(soundConfig, sound, context.playlist);
        }
    },

    async stop(soundConfig, context) {
        const sounds = context.mood.getSoundByGroup(soundConfig.id);
        for (let i = 0; i < sounds.length; i++) {
            await context.playlist.stopSound({ id: sounds[i].id });
        }
    }
};

/**
 * Registry of handlers by sound type
 */
const handlers = {
    [constants.SOUNDTYPE.AMBIENCE]: loopHandler,  // Treat ambience like loop
    [constants.SOUNDTYPE.LOOP]: loopHandler,
    [constants.SOUNDTYPE.RANDOM]: randomHandler,
    [constants.SOUNDTYPE.SOUNDPAD]: soundpadHandler,
    [constants.SOUNDTYPE.GROUP_LOOP]: groupLoopHandler,
    [constants.SOUNDTYPE.GROUP_RANDOM]: groupRandomHandler,
    [constants.SOUNDTYPE.GROUP_SOUNDPAD]: groupSoundpadHandler,
    [constants.SOUNDTYPE.SOUNDPADUI]: soundpadHandler,  // Same as soundpad
};

/**
 * Get the handler for a sound type
 * @param {number} soundType - The sound type constant
 * @returns {Object} Handler with play() and stop() methods
 */
export function getHandler(soundType) {
    return handlers[soundType] || soundpadHandler;  // Default to soundpad handler
}

/**
 * Check if a sound type is a group type
 * @param {number} soundType - The sound type constant
 * @returns {boolean}
 */
export function isGroupType(soundType) {
    return soundType === constants.SOUNDTYPE.GROUP_LOOP ||
           soundType === constants.SOUNDTYPE.GROUP_RANDOM ||
           soundType === constants.SOUNDTYPE.GROUP_SOUNDPAD;
}

export default {
    getHandler,
    isGroupType,
    playSoundWithFade,
    stopSoundWithFade
};
