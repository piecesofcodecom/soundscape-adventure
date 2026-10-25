/**
 * Player Audio - send soundboard sounds to specific players over the module socket.
 *
 * Playlist playback is global (every client syncs the PlaylistSound document), so
 * targeted audio uses a client-side Sound on each recipient instead. The GM keeps
 * track of what it sent so the soundboard button can toggle into a "stop" state.
 *
 * Messages: { action: "play" | "stop" | "ended", key, userIds, senderId, ... }
 */
import utils from "./utils.mjs";
import constants from "./constants.mjs";

const SOCKET = "module.soundscape-adventure";

/** GM side: soundId -> { key, userIds: Set<string>, loop } */
const active = new Map();

/** Recipient side: key -> Sound */
const playing = new Map();

/* -------------------------------------------- */
/*  Socket                                      */
/* -------------------------------------------- */

function registerSocket() {
    game.socket.on(SOCKET, onMessage);
}

function emit(message) {
    game.socket.emit(SOCKET, { ...message, senderId: game.user.id });
}

async function onMessage(message) {
    switch (message.action) {
        case "play":
            if (!isForMe(message)) return;
            await playLocal(message);
            break;
        case "stop":
            if (!isForMe(message)) return;
            await stopLocal(message.key, message.fadeOut);
            break;
        case "ended":
            if (message.targetId !== game.user.id) return;
            onRemoteEnded(message.key, message.senderId);
            break;
    }
}

function isForMe(message) {
    if (!message.userIds?.includes(game.user.id)) return false;
    // only accept playback commands from a GM
    return !!game.users.get(message.senderId)?.isGM;
}

/* -------------------------------------------- */
/*  Recipient                                   */
/* -------------------------------------------- */

async function playLocal({ key, src, volume, loop, channel, fadeIn, senderId }) {
    await stopLocal(key, 0);
    const context = game.audio[channel] ?? game.audio.environment;
    const sound = new foundry.audio.Sound(src, { context });
    playing.set(key, sound);
    try {
        await sound.load();
    } catch (error) {
        playing.delete(key);
        utils.log(utils.getCallerInfo(), `Unable to load sound sent by the GM: ${src}`, constants.LOGLEVEL.ERROR, error);
        emit({ action: "ended", key, targetId: senderId });
        return;
    }
    // a stop may have arrived while loading
    if (playing.get(key) !== sound) return;

    const finished = () => {
        if (playing.get(key) !== sound) return;
        playing.delete(key);
        emit({ action: "ended", key, targetId: senderId });
    };
    sound.addEventListener("end", finished, { once: true });
    sound.addEventListener("stop", finished, { once: true });
    await sound.play({ volume, loop, fade: fadeIn > 0 ? fadeIn * 1000 : undefined });
}

async function stopLocal(key, fadeOut = 0) {
    const sound = playing.get(key);
    if (!sound) return;
    playing.delete(key);
    await sound.stop({ fade: fadeOut > 0 ? fadeOut * 1000 : 0, volume: 0 });
}

/* -------------------------------------------- */
/*  GM                                          */
/* -------------------------------------------- */

/**
 * Play a soundboard sound for the given players.
 * @param {Soundscape} soundscape
 * @param {SoundConfig} soundConfig
 * @param {string[]} userIds
 * @param {object} [options]
 * @param {boolean} [options.loop=false]
 */
function sendToPlayers(soundscape, soundConfig, userIds, { loop = false } = {}) {
    if (!game.user.isGM || !userIds.length) return;
    stopForPlayers(soundConfig);

    const playlistSound = soundscape.playlist.sounds.get(soundConfig.id);
    const src = playlistSound?.path ?? soundConfig.path;
    if (!src) {
        utils.log(utils.getCallerInfo(), `Sound ${soundConfig.name} has no path`, constants.LOGLEVEL.WARN);
        return;
    }
    const key = foundry.utils.randomID();
    active.set(soundConfig.id, { key, userIds: new Set(userIds), loop, fadeOut: soundConfig.fadeOut });
    emit({
        action: "play",
        key,
        userIds,
        src,
        loop,
        volume: Number(soundConfig.volume ?? 1),
        fadeIn: Number(soundConfig.fadeIn ?? 0),
        channel: playlistSound?.channel || soundscape.playlist.channel || "environment"
    });
    refreshButtons();
}

/**
 * Stop a sound previously sent to players.
 * @param {SoundConfig} soundConfig
 */
function stopForPlayers(soundConfig) {
    const entry = active.get(soundConfig.id);
    if (!entry) return;
    active.delete(soundConfig.id);
    emit({ action: "stop", key: entry.key, userIds: [...entry.userIds], fadeOut: Number(entry.fadeOut ?? 0) });
    refreshButtons();
}

function isActive(soundId) {
    return active.has(soundId);
}

function onRemoteEnded(key, userId) {
    for (const [soundId, entry] of active) {
        if (entry.key !== key) continue;
        entry.userIds.delete(userId);
        if (!entry.userIds.size) active.delete(soundId);
        refreshButtons();
        return;
    }
}

// a recipient that disconnects will never report "ended"
function onUserConnected(user, connected) {
    if (connected || !game.user.isGM) return;
    for (const [soundId, entry] of active) {
        if (!entry.userIds.delete(user.id)) continue;
        if (!entry.userIds.size) active.delete(soundId);
    }
    refreshButtons();
}

/* -------------------------------------------- */
/*  UI                                          */
/* -------------------------------------------- */

/**
 * Ask which players should hear the sound, then send it.
 * Clicking again while it is still playing for players stops it instead.
 * @param {Soundscape} soundscape
 * @param {SoundConfig} soundConfig
 */
async function toggleDialog(soundscape, soundConfig) {
    if (!game.user.isGM) return;
    if (isActive(soundConfig.id)) {
        stopForPlayers(soundConfig);
        return;
    }
    const players = game.users.filter(u => u.active && !u.isSelf);
    if (!players.length) {
        ui.notifications.warn("There are no other connected users to send the sound to.");
        return;
    }
    const esc = foundry.utils.escapeHTML;
    const content = `
        <p>Send <strong>${esc(soundConfig.name ?? "")}</strong> to:</p>
        <div class="sa-send-players">
            ${players.map(u => `
            <label class="checkbox">
                <input type="checkbox" name="users" value="${u.id}">
                <span style="color: ${u.color?.css ?? "inherit"}">&#9679;</span> ${esc(u.name)}
            </label>`).join("")}
        </div>
        <hr>
        <label class="checkbox">
            <input type="checkbox" name="loop"> Loop (until stopped)
        </label>`;

    const result = await foundry.applications.api.DialogV2.wait({
        window: { title: "Send sound to players" },
        content,
        rejectClose: false,
        buttons: [
            {
                action: "send",
                label: "Send",
                icon: "fas fa-paper-plane",
                default: true,
                callback: (event, button) => {
                    const form = button.form;
                    return {
                        userIds: [...form.querySelectorAll('input[name="users"]:checked')].map(i => i.value),
                        loop: form.elements.loop.checked
                    };
                }
            },
            { action: "cancel", label: "Cancel", icon: "fas fa-times" }
        ]
    });
    if (!result?.userIds) return;
    if (!result.userIds.length) {
        ui.notifications.warn("Select at least one player.");
        return;
    }
    sendToPlayers(soundscape, soundConfig, result.userIds, { loop: result.loop });
}

/**
 * Sync every "send to players" button on screen with the current GM state.
 */
function refreshButtons(root = document) {
    root.querySelectorAll('button[data-action="send-to-players"]').forEach(button => {
        const soundId = button.closest(".sa-dataset")?.dataset.soundId;
        const entry = active.get(soundId);
        const icon = button.querySelector("i");
        button.classList.toggle("active", !!entry);
        if (icon) icon.className = entry ? "fas fa-stop" : "fas fa-paper-plane";
        if (entry) {
            const names = [...entry.userIds].map(id => game.users.get(id)?.name).filter(Boolean).join(", ");
            button.dataset.tooltip = `Stop for ${names}${entry.loop ? " (loop)" : ""}`;
        } else {
            button.dataset.tooltip = "Send to players";
        }
    });
}

function init() {
    registerSocket();
    Hooks.on("userConnected", onUserConnected);
}

export default {
    init,
    sendToPlayers,
    stopForPlayers,
    isActive,
    toggleDialog,
    refreshButtons
};
