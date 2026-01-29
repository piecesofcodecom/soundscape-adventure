import Soundscape from "./soundscape.mjs";
import SoundscapeAdventure from "./soundscape-adventure.mjs";
import constants from "./utils/constants.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * SoundpadUI as a Foundry Application using Handlebars templates.
 */
export default class SoundpadUI extends HandlebarsApplicationMixin(ApplicationV2) {
    static PARTS = {
        foo: { template: 'modules/soundscape-adventure/templates/soundpad-ui.hbs' }
    }
    static DEFAULT_OPTIONS = {
        id: "soundpad-ui",
        window: {
            title: "🎛️ Soundpad UI",
        },
        classes: ["soundpad-ui"]
    }
    constructor(options = {}) {
        super(options);
        this.count = 0;
        this.isUpdating = false;
    }

    async _preparePartContext(partId, context) {
        context.partId = `${this.id}-${partId}`;
        return context;
    }
    /**
     * Prepare data for the template.
     */
    async _prepareContext(options) {
        const canModify = game.user.isGM || game.user.hasRole("ASSISTANT");
        const soundscapes = SoundscapeAdventure.soundscapes;
        let name = "";
        let sounds = [];
        for (const soundscapeId in soundscapes) {
            const soundscape = soundscapes[soundscapeId];
            if (soundscape.isPlaying) {
                const mood = soundscape.moods[soundscape.activeMoodId];
                if (mood) {
                    sounds = mood.sounds.filter(sound => sound.type === constants.SOUNDTYPE.SOUNDPADUI);
                    name = mood.name;
                    this.soundscape = soundscape;
                }
            }
        }
        const imgs = [];
        const buttonsPerColumn = 10;
        const columns = Math.ceil(sounds.length / buttonsPerColumn);
        return {
            canModify,
            sounds,
            imgs,
            buttonsPerColumn,
            columns,
            name
        };
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const buttons = this.element.querySelectorAll('.soundpad-btn');
        buttons.forEach(button => {
            button.addEventListener('click', async (event) => {
                if (!this.soundscape.activeMoodId) return;
                const btn = event.currentTarget;
                const dataset = btn.closest('.sa-dataset').dataset;
                btn.style.opacity = 1;
                //const idx = parseInt(event.currentTarget.dataset.idx);
                const sound = context.sounds.find(s => s.id === dataset.soundId);
                const playlist = this.soundscape.playlist;
                const playlistSound = await playlist.sounds.find(s => s.id === dataset.soundId);
                await playlistSound.load();
                const icon = btn.querySelector('i');
                if (!playlistSound) {
                    utils.log(utils.getCallerInfo(), `Sound not found in the playlist ${this.soundscape.playlist.name}: ${sound.path}`, constants.LOGLEVEL.WARN);
                    return;
                }
                if (sound && !playlistSound.playing) {
                    // before playing, make sure it isn't configured as a loop sound
                    await this.soundscape.playSound(sound, this.soundscape.activeMoodId);
                    btn.style.backgroundColor = "#c9593f";
                    const icon = btn.querySelector("i");
                    //icon.style.color = "#c9593f";

                    //icon.classList.toggle('fa-play', !playlistSound.playing);
                    icon.className = "fas fa-stop";
                    setTimeout(() => {
                        playlistSound.sound.addEventListener(
                            'end',
                            (event) => {
                                btn.style.backgroundColor = "";
                                icon.style.color = "";
                                icon.className = "fas fa-play";
                                btn.style.opacity = 0.5;
                            }
                        );
                        playlistSound.sound.addEventListener(
                            'stop',
                            (event) => {
                                btn.style.backgroundColor = "";
                                icon.style.color = "";
                                icon.className = "fas fa-play";
                                btn.style.opacity = 0.5;
                            }
                        )
                    }, 100);

                } else if (sound && playlistSound.playing) {
                    await this.soundscape.stopSound(sound, this.soundscape.activeMoodId);
                    btn.style.backgroundColor = "";
                    icon.className = "fas fa-play";
                }
            });
            button.addEventListener('contextmenu', async (event) => {
                if (!this.soundscape.activeMoodId) return;
                event.preventDefault(); // stop context menu

                const idx = parseInt(event.currentTarget.dataset.idx);
                const sound = context.sounds[idx];
                const playlist = this.soundscape.playlist;
                const playlistSound = playlist.sounds.find(s => s.id === sound.id);

                // Remove any existing sliders first
                //soundselected
                const currentBar = this.element.querySelector('.soundpad-volume2-slider');
                currentBar.style.display = 'flex';
                //currentBar.querySelector('.soundpad-volume-label').textContent = playlistSound.name;
                // Remove any existing slider
                let slider = currentBar.querySelector('input[type="range"]');
                if (slider) slider.remove();

                // Create and add new slider
                slider = document.createElement('input');
                slider.type = 'range';
                slider.min = 0;
                slider.max = 1;
                slider.step = 0.01;
                slider.style.marginTop = "100px";
                slider.className = 'soundpad-volume-slider-input';
                slider.style.writingMode = "bt-lr";
                slider.style.transform = "rotate(270deg)";
                slider.style.width = "200px";
                slider.style.boxShadow = "rgb(243 240 240 / 35%) 0px 0px 5px 0px";

                let volume_label = currentBar.querySelector('.soundpad-volume-label');
                if (!volume_label) {
                    volume_label = document.createElement('span');
                    volume_label.className = 'soundpad-volume-label';
                    volume_label.style.display = 'block';
                    volume_label.style.textAlign = 'center';
                    volume_label.textContent = `Volume`;
                    currentBar.appendChild(volume_label);
                }


                currentBar.appendChild(slider);
                let volume_value = currentBar.querySelector('.soundpad-volume-value');
                if (!volume_value) {
                    volume_value = document.createElement('span');
                    volume_value.className = 'soundpad-volume-value';
                    volume_value.style.display = 'block';
                    volume_value.style.textAlign = 'center';
                    volume_value.style.marginTop = "100px";
                }
                volume_value.textContent = `${parseInt(sound.volume * 100)} %`;
                currentBar.appendChild(volume_value);

                let label = this.element.querySelector('.soundpad-label');
                label.style.whiteSpace = "nowrap";
                label.style.display = 'block';
                label.style.textAlign = 'center';
                label.textContent = playlistSound.name;
                //currentBar.appendChild(label);
                const listener = async () => {
                    if (playlistSound) {
                        this.soundscape.changeSoundVolume(this.soundscape.activeMoodId, sound.id, parseFloat(slider.value));
                        await playlistSound.update({ volume: parseFloat(slider.value) });
                        volume_value.textContent = `${parseInt(slider.value * 100)} %`;
                    }
                }
                slider.value = parseFloat(sound?.volume) ?? 1;
                slider.addEventListener('input', listener, false);
            });
        });

        const volumes = this.element.querySelectorAll(".volume.sound-control");
        volumes.forEach(button => {
            button.addEventListener("click", async (event) => {
                const action = button.dataset.action;
                // Find the closest parent with data attributes
                const dataset = button.closest(".sa-dataset").dataset;
                // Call appropriate method
                switch (action) {
                    case "volume":
                        const playlist = this.soundscape.playlist;
                        const sound = await context.sounds.find(s => s.id === dataset.soundId);
                        const playlistSound = await playlist.sounds.find(s => s.id === sound.id);
                        this.soundscape.changeSoundVolume(this.soundscape.activeMoodId, sound.id, parseFloat(button.value));
                        await playlistSound.update({ volume: parseFloat(button.value) });
                        button.dataset.tooltip = `Volume ${parseInt(button.value * 100)} %`;
                        break;
                }
            });

        })
        return context;
    }
}
