import SoundscapeAdventure from "./soundscape-adventure.mjs";
import utils from "./utils/utils.mjs";
import constants from "./utils/constants.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class SoundscapeUI extends HandlebarsApplicationMixin(ApplicationV2) {
    soundList = [];
    soundscape = {};
    currentMood = "";
    scrollTop = 0;
    current_input = "";
    libraryIsOpen = false;

    static PARTS = {
        // header: { template: '' },
        // tabs: { template: '' },
        // description: { template: '' },
        foo: { template: 'modules/soundscape-adventure/templates/soundscape/main.hbs' },
        // bar: { template: '' },
    }

    static DEFAULT_OPTIONS = {
        id: "soundscape-ui",
        window: {
            title: "Soundscape Adventure: ",
            icon: "fas fa-volume-up"
        },
        classes: ["soundscape-ui"],
        actions: {
            reset: SoundscapeUI.test,
            viewMood: SoundscapeUI.viewMood,
        },
        dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
        position: {
            width: 1024,
            height: 920
        },
        window: {
            resizable: true
        },
    }


    // static get defaultOptions() {
    //     const options = super.defaultOptions;
    //     options.title = "Soundscape name",
    //     options.id = 'soundscape-app';
    //     options.template = 'modules/soundscape-adventure/templates/soundscape.hbs';
    //     options.width = 1050;
    //     options.height = 800;
    //     options.resizable = true;
    //     return options;
    // }

    constructor(soundscape) {
        super({ window: { title: `Soundscape Adventure: ${soundscape.name}`, icon: "fas fa-speaker" } });
        this.soundscape = soundscape;
        this.#dragDrop = this.#createDragDropHandlers();
    }

    /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
    _canDragStart(selector) {
        // game.user fetches the current user
        return this.isEditable;
    }


    /**
     * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
     * @param {string} selector       The candidate HTML selector for the drop target
     * @returns {boolean}             Can the current user drop on this selector?
     * @protected
     */
    _canDragDrop(selector) {
        // game.user fetches the current user
        return this.isEditable;
    }


    /**
     * Callback actions which occur at the beginning of a drag start workflow.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    _onDragStart(event) {
        const el = event.currentTarget;
        if ('link' in event.target.dataset) return;

        // Extract the data you need
        let dragData = null;

        if (!dragData) return;

        // Set data transfer
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    }


    /**
     * Callback actions which occur when a dragged element is over a drop target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    _onDragOver(event) { }


    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);

        // Handle different data types
        switch (data.type) {
            // write your cases
        }
    }

    /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
    #createDragDropHandlers() {
        return this.options.dragDrop.map((d) => {
            d.permissions = {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this),
            };
            d.callbacks = {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this),
            };
            return new foundry.applications.ux.DragDrop(d);
        });
    }

    #dragDrop;

    // Optional: Add getter to access the private property

    /**
     * Returns an array of DragDrop instances
     * @type {DragDrop[]}
     */
    get dragDrop() {
        return this.#dragDrop;
    }

    async myRender(force = false, options = {}) {
        if (this.element) {
            const content = await this.element.querySelector('.sa-content');
            this.scrollTop = content?.scrollTop ?? 0;
        }

        await super.render(force, options);
        const content = await this.element.querySelector('.sa-content');
        content.scrollTop = this.scrollTop;
    }

    _onDragStart(event) {
        const div = event.target.closest(".sa-dataset");
        const dragData = {
            type: "sound",
            soundId: div.dataset?.soundId,
            moodId: div.dataset?.moodId,

        };
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    _onDragOver(event) {
        event.preventDefault(); // Necessary to allow dropping
    }

    _onDrop(event, element) {
        event.preventDefault();
        const dropZone = event.target.closest('.drop-zone');
        if (dropZone.dataset.dropZoneType) {
            const data = JSON.parse(event.dataTransfer.getData("text/plain"));
            this.soundscape.moveSound(data.soundId, data.moodId, dropZone.dataset.dropZoneType, dropZone.dataset?.dropZoneCategory);
            this.soundscape.markMoodAsChanged(data.moodId);
        }
        this.myRender(true);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const content = this.element.querySelector('.mood-active');
        if (content)
            content.scrollTop = this.scrollTop;

        // Stop propagation of drag and drop in volume controls
        this.element.querySelectorAll('.soundpad-volume-container, .compact-volume-control').forEach(container => {
            // Set draggable to false
            container.setAttribute('draggable', 'false');

            container.addEventListener('mousedown', e => e.stopPropagation(), true);
            container.addEventListener('touchstart', e => e.stopPropagation(), { passive: true, capture: true });
            container.addEventListener('pointerdown', e => e.stopPropagation(), true);
            container.addEventListener('dragstart', e => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);

            // Also prevent drag on all child elements
            container.addEventListener('selectstart', e => e.preventDefault());
        });

        // Add document-level event delegation as a fallback
        document.addEventListener('mousedown', (e) => {
            if (e.target.matches('.soundpad-volume-slider, .compact-volume-slider, .compact-intensity-slider') ||
                e.target.closest('.soundpad-volume-container, .compact-volume-control')) {
                const box = e.target.closest('.soundpad-list-item, .soundscape-sound-card');
                box.draggable = false;
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);

        document.addEventListener('mouseup', (e) => {
            if (e.target.matches('.soundpad-volume-slider, .compact-volume-slider, .compact-intensity-slider') ||
                e.target.closest('.soundpad-volume-container, .compact-volume-control')) {
                const box = e.target.closest('.soundpad-list-item, .soundscape-sound-card');
                box.draggable = true;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }, true);


        // FILTER
        this.element.querySelectorAll('.sa-library').forEach(container => {
            const input = container.querySelector('.filterInput');
            input.value = this.current_input;
            const items = container.querySelectorAll('.sa-library-item');

            if (this.current_input) {
                items.forEach(item => {
                    const title = item.querySelector('.sa-sound-name')?.dataset?.fullName.toLowerCase() || '';
                    item.style.display = title.includes(this.current_input) ? '' : 'none';
                });
            }

            input.addEventListener('input', () => {
                const filter = input.value.toLowerCase();
                this.current_input = filter;

                const content = container.closest('.sa-library');
                const items = content.querySelectorAll('.sa-library-item');
                items.forEach(item => {
                    const title = item.querySelector('.sa-sound-name')?.dataset?.fullName.toLowerCase() || '';
                    item.style.display = title.includes(filter) ? '' : 'none';
                });
            });
        });
        //DRAG AND DROP
        this.element.querySelectorAll(".data-drag").forEach((el) => {
            el.setAttribute("draggable", "true");

            // Add a universal dragstart handler that checks the source
            el.addEventListener("dragstart", (event) => {
                this._onDragStart(event);
            });
        });
        // Setup drop zone
        this.element.querySelectorAll(".drop-zone").forEach((el) => {
            el.addEventListener("dragover", this._onDragOver.bind(this));
            el.addEventListener("drop", this._onDrop.bind(this));
        });
        // Mood controls
        this.element.querySelectorAll(".mood-action").forEach(async (button) => {
            button.addEventListener("click", async (event) => {
                const action = button.dataset.action;
                // Find the closest parent with data attributes
                const parent = button.closest(".sa-mood");
                const moodId = parent?.dataset.moodId;
                const soundscapeId = parent?.dataset.soundscapeId;

                //if (!moodId || !soundscapeId) return;

                // Log for debugging
                const root = button.closest(".soundboardadv");
                // Call appropriate method
                switch (action) {
                    case "playStopMood":
                        const icon = button.querySelector("i");
                        icon.className = "fa fa-spinner fa-spin mood-control soundscape-tab-button";
                        await this.soundscape.playStopMood(moodId);
                        if (this.element) {
                            const content = await this.element.querySelector('.sa-content');
                            this.scrollTop = content?.scrollTop ?? 0;
                        }
                        this.myRender(true);
                        break;
                    case "viewMood":
                        const config = await game.settings.get(constants.STORAGETRIGGERSETTINGS, "currentMoodOnUI");
                        this.currentMoodOnUI = moodId;
                        const currentMoodSOnUI = [];
                        if (Object.keys(config).length) {
                            currentMoodSOnUI.push(...(config).split(":"));
                        }

                        for (const key in this.soundscape.moods) {
                            // includes the new mood.
                            if (currentMoodSOnUI.includes(key) && key != moodId) {
                                currentMoodSOnUI.splice(currentMoodSOnUI.indexOf(key), 1);
                            }

                            if (!currentMoodSOnUI.includes(key) && key == moodId) {
                                currentMoodSOnUI.push(moodId);
                            }
                        }
                        await game.settings.set(constants.STORAGETRIGGERSETTINGS, "currentMoodOnUI", (currentMoodSOnUI.filter(el => el != "true")).join(":"));
                        break;
                    case "saveMood":
                        const save_btn = parent.querySelector(".fa-download");
                        save_btn.style.color = "";
                        this.soundscape.saveMoodsConfig();
                        break;
                    case "configMood":
                        this.moodEdit(moodId);
                        break;
                    case "createMood":
                        await this.soundscape.dialogNewMood();
                        break;
                    case "cloneMood":
                        await this.soundscape.dialogCloneMood();
                        break;
                    case "showLibrary":
                        this.libraryIsOpen = !this.libraryIsOpen;
                        break;
                    case "deleteMood":
                        if (moodId == this.currentMoodOnUI) {
                            this.currentMoodOnUI = null;
                        }
                        const deleted = await this.soundscape.dialogDeleteMood(moodId);
                        if (deleted && moodId == this.currentMoodOnUI) {
                            this.currentMoodOnUI = null;
                        }
                        break;
                    default:

                }
                this.myRender(true);
            });
        });

        // Sound controls
        this.element.querySelectorAll(".sound-control").forEach(async (button) => {
            button.addEventListener("click", async (event) => {
                const content = this.element.querySelector('.sa-content');
                this.scrollTop = content?.scrollTop ?? 0;
                const action = button.dataset.action;
                // Find the closest parent with data attributes
                const parent = button.closest(".sa-dataset");
                const moodId = parent.dataset.moodId;
                const soundscapeId = parent?.dataset.soundscapeId;
                const group = parent.dataset?.group;
                const soundId = parent?.dataset.soundId;
                const soundType = parent?.dataset.soundType;
                if (!moodId || !soundId || !action) return;
                // Log for debugging
                const root = button.closest(".soundboardadv");
                // Call appropriate method
                switch (action) {
                    // case "enableDisableAudio":
                    //     const soundConfig = this.soundscape.moods[moodId].getSound(soundId);
                    //     const box = button.closest(".music-content");
                    //     const icon = button.querySelector(".fas");
                    //     if (!this.soundscape.moods[moodId].isSoundOn(soundId)) {
                    //         if (icon)
                    //             icon.className = "fas fa-volume";
                    //         if (box)
                    //             box.className = "music-content on";
                    //         this.soundscape.enableDisableSound(moodId, soundId);
                    //     } else {

                    //         if (box)
                    //             box.className = "music-content off";
                    //         if (icon)
                    //             icon.className = "fas fa-volume-xmark";
                    //         this.soundscape.enableDisableSound(moodId, soundId);
                    //     }

                    //     break;
                    case "volume":
                        await this.soundscape.changeSoundVolume(moodId, soundId, button.value);
                        // if (
                        //     ((button.value == 0 && button.dataset.currentValue != 0) || (button.value != 0 && button.dataset.currentValue== 0))
                        //     &&
                        //     parseInt(button.dataset?.soundType) != constants.SOUNDTYPE.SOUNDPADUI
                        // ) {
                        //     this.soundscape.enableDisableSound(moodId, soundId);
                        // }
                        break;
                    case "intensity":
                        this.soundscape.changeSoundIntensity(moodId, soundId, button.value);
                        break;
                    case "edit-sound":
                        this.soundEdit(moodId, soundId, soundType);
                        return;
                        break;
                    case "play":
                        if (!this.soundscape.moods[moodId].isPlaying()) {
                            ui.notifications.warn("You need to start the mood before you can play a soundpad sound.");
                            return;
                        }
                        const sound = await this.soundscape.moods[moodId].getSound(soundId);
                        console.warn(sound);
                        if (sound.type == constants.SOUNDTYPE.SOUNDPADUI) {
                            const i = button.querySelector("i");
                            i.className = "fas fa-stop";
                            button.dataset.action = "stop";
                            const s = this.soundscape.playlist.sounds.get(sound.id);
                            await s.load();
                            await this.soundscape.playSound(sound, moodId);

                            const previewEndEvent = () => {
                                s.sound.removeEventListener('end', previewEndEvent);
                                s.sound.removeEventListener('stop', previewEndEvent);
                                i.className = "fas fa-play";
                                button.dataset.action = "play";
                                //this.soundscape.stopSound(sound, moodId);
                            };
                            s.sound.addEventListener(
                                'end', previewEndEvent
                            );
                            s.sound.addEventListener(
                                'stop', previewEndEvent
                            );
                            return;

                        }
                        break;
                    case "stop":
                        const sounds = await this.soundscape.moods[moodId].getSound(soundId);

                        const i = button.querySelector("i");
                        if (sounds.type == constants.SOUNDTYPE.SOUNDPADUI) {
                            i.className = "fas fa-play";
                            button.dataset.action = "play";
                            console.warn("Stop sound", sounds)
                            this.soundscape.stopSound(sounds, moodId);
                            return;
                        }
                        break;
                    case "preview-sound":
                        const soundToPreview = this.soundscape.moods[moodId].getSound(soundId);
                        const soundToPlay = this.soundscape.playlist.sounds.get(soundToPreview.id);
                        await soundToPlay.load();
                        const isLoop = soundToPlay.sound.loop;
                        const volume = soundToPlay.sound.volume;
                        if (soundToPlay.playing) {
                            this.soundscape.playlist.stopSound(soundToPlay);
                        } else {
                            const preview_icon = button.querySelector("i");
                            preview_icon.style.color = "orange";
                            preview_icon.className = "fas fa-stop";
                            soundToPlay.update({ "repeat": false, "volume": 0.6 });
                            await this.soundscape.playlist.playSound(soundToPlay);
                            const previewEndEvent = () => {
                                soundToPlay.sound.removeEventListener('end', previewEndEvent);
                                this.soundscape.playlist.stopSound(soundToPlay);
                            };

                            const previewStopEvent = () => {
                                soundToPlay.sound.removeEventListener('stop', previewStopEvent);
                                preview_icon.className = "fas fa-play";
                                preview_icon.style.color = "";
                                soundToPlay.update({ "repeat": isLoop, "volume": volume });
                            }
                            soundToPlay.sound.addEventListener(
                                'end',
                                previewEndEvent
                            );
                            soundToPlay.sound.addEventListener(
                                'stop',
                                previewStopEvent
                            )
                            return;
                        }

                        break;
                    default:
                        console.warn("action not found", action);

                }
                this.myRender(true);
            });
        });

        // block dragging of soundscape sounds
        this.element.querySelectorAll('.soundpad-volume-slider').forEach(slider => {
            slider.addEventListener('mousedown', e => {
                e.stopPropagation(); // Prevent drag start bubbling up
            });
            slider.addEventListener('click', e => {
                e.preventDefault(); // Disable dragging the whole element
            });
        });

        // Category controls
        this.element.querySelectorAll(".category-control").forEach(async (button) => {
            button.addEventListener('click', async (e) => {
                const dataset = e.currentTarget.closest(".sa-dataset").dataset;
                const category_name = dataset.categoryName;
                const moodId = dataset.moodId;
                const categoryId = dataset?.categoryId ? dataset.categoryId : 0;
                const action = e.currentTarget.dataset.action;
                if (action == "play" || action == "stop") {
                    this.soundscape.playStopCategory(moodId, categoryId, action)
                } else if (action == "delete") {
                    const confirm = await foundry.applications.api.DialogV2.prompt({
                        window: { title: "Confirmation" },
                        content: `<p>Confirm delete the category ${category_name}?</p>`,
                        modal: true,
                        rejectClose: false
                    });
                    if (confirm) {
                        await this.soundscape.deleteCategory(moodId, categoryId);
                        this.myRender(true);
                    }
                } else if (action == "enableAll") {
                    this.soundscape.enableSoundsinCategory(moodId, categoryId);
                    this.myRender(true);
                } else if (action == "collapse") {
                    this.soundscape.toggleCategoryCollapsed(moodId, categoryId);
                     this.myRender(true);
                }
            });
        });

        this.element.querySelectorAll(".soundboardadv-main").forEach(el => {
            el.addEventListener('dragover', (e) => {
                const rect = el.getBoundingClientRect();
                const scrollSpeed = 10;
                const threshold = 40; // distance from edge to start scrolling
                const content = this.element.querySelector('.sa-content');
                this.scrollTop = content?.scrollTop ?? 0;

                if (e.clientY < rect.top + threshold) {
                    // Near top
                    content.scrollTop -= scrollSpeed;
                } else if (e.clientY > rect.bottom - threshold) {
                    // Near bottom
                    content.scrollTop += scrollSpeed;
                }
            });
        });

        // this.element.querySelectorAll('.sound-category').forEach(el => {
        //     const button = el.querySelector(".category-title");
        //     const collapeDiv = el.querySelector(".soundscapeadv-container, .soundpad-list-container");
        //     if (button && collapeDiv) {
        //         button.addEventListener("click", (e) => {
        //             const icon = e.currentTarget.querySelector("i");
        //             if (icon.className.includes("fa-angle-down")) {
        //                 icon.className = "fa fa-angle-up";
        //             } else {
        //                 icon.className = "fa fa-angle-down";
        //             }
        //             const categoryId = e.currentTarget.dataset.categoryId;
        //             const parent = e.currentTarget.closest(".soundboardadv-main");
        //             const moodId = parent.dataset.moodId;
        //             const type = parseInt(e.currentTarget.dataset.categoryType);

        //             const mood = this.soundscape.getMood(moodId);
        //             if (mood) {
        //                 mood.toggleCategoryCollapsed(categoryId);
        //             }


        //             const content = this.element.querySelector('.sa-content');
        //             this.scrollTop = content?.scrollTop ?? 0;
        //             const isVisible = collapeDiv.style.display !== 'none';
        //             collapeDiv.style.display = isVisible ? 'none' : '';
        //         });
        //     }
        // })

        this.element.querySelectorAll(".new-category").forEach(el => {
            el.addEventListener("click", async (ev) => {
                const content = this.element.querySelector('.sa-content');
                this.scrollTop = content?.scrollTop ?? 0;
                let category_name;
                try {
                    category_name = await foundry.applications.api.DialogV2.prompt({
                        window: { title: "New Category's Name" },
                        content: '<input name="name" type="text" autofocus>',
                        ok: {
                            label: "Create",
                            callback: (event, button, dialog) => button.form.elements.name.value
                        }
                    });
                } catch {
                    return;
                }

                const dataset = ev.target.closest(".sa-group").dataset;
                const sound_group = dataset?.soundType;
                const moodid = dataset?.moodId
                if (sound_group && moodid) {
                    await this.soundscape.createCategory(moodid, sound_group, category_name);
                    this.soundscape.markMoodAsChanged(moodid);
                    const content = this.element.querySelector('.sa-content');
                    this.scrollTop = content?.scrollTop ?? 0;
                    this.myRender(true);
                }
            })

        });

        //     const side_bar_sound_library = `
        //     `;
        this.element.querySelectorAll('.soundscape-sliding-ear').forEach(element => {
            element.addEventListener('click', async (event) => {
                const slidingPanel = await this.element.querySelector('.slide-active');
                const ear = await this.element.querySelector('.soundscape-sliding-ear');
                slidingPanel.classList.toggle('open');
                this.libraryIsOpen = !this.libraryIsOpen;
                if (this.libraryIsOpen) {
                    ear.innerText = "❮";
                } else {
                    ear.innerText = "❯";
                }
            });

        });

        const window_content = this.element.querySelector('.window-content'); //.insertAdjacentHTML('afterend', side_bar_sound_library);
        window_content.style.overflow = 'visible';


    }

    async close(options = {}) {

        SoundscapeAdventure.closeUI(this.soundscape.id);

        // Call the original close method
        return super.close(options);
    }

    async moodEdit(moodId) {
        const mood = this.soundscape.moods[moodId];

        const templatePath = "/modules/soundscape-adventure/templates/editmood.hbs";
        const triggers = [];

        for (let i = 0; i < 3; i++) {
            triggers.push({
                actions: [
                    {
                        id: "play",
                        name: "Play",
                        selected: false
                    },
                    {
                        id: "stop",
                        name: "Stop",
                        selected: false
                    }],
                on: [{
                    id: "combat",
                    name: "Combat",
                    selected: false
                }],
                events: []
            })
        }

        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");

        if (triggerSettings[moodId]) {
            if (triggerSettings[moodId]["mood"]) {
                const currentTriggers = triggerSettings[moodId]["mood"];
                for (let i = 0; i < currentTriggers.length; i++) {
                    for (let j = 0; j < triggers[i].actions.length; j++) {
                        if (triggers[i].actions[j].id == currentTriggers[i].action) {
                            triggers[i].actions[j].selected = true;
                        }
                    }
                    for (let j = 0; j < triggers[i].on.length; j++) {
                        if (triggers[i].on[j].id == currentTriggers[i].on) {
                            triggers[i].on[j].selected = true;
                            if (triggers[i].on[j].id == "combat") {
                                triggers[i].events.push({
                                    id: "start",
                                    name: "Start",
                                    selected: currentTriggers[i].event == "start" ? true : false
                                })
                                triggers[i].events.push({
                                    id: "end",
                                    name: "End",
                                    selected: currentTriggers[i].event == "end" ? true : false
                                })
                            }
                        }
                    }
                }
            }
        }
        const html_content = await foundry.applications.handlebars.renderTemplate(templatePath, { mood: mood, triggers: triggers });
        const dialog = new foundry.applications.api.DialogV2({
            window: { title: `Edit ${mood.name}` },
            content: html_content,
            buttons: [
                {
                    action: "save",
                    label: "Save",
                    callback: (event, button, dialog) => this.updateMood(button.form.elements, moodId),
                    icon: "fas fa-check"
                },
                {
                    action: "cancel",
                    label: "Cancel",
                    callback: () => { },
                    icon: "fas fa-times"
                }]
        });
        await dialog.render(true);
        const browser = dialog.element.querySelectorAll('.onElement');
        const removeAllTriggers = dialog.element.querySelector('.removeAllTriggers');
        removeAllTriggers.addEventListener('click', async (event) => {
            const dataset = event.srcElement.dataset;
            this.soundscape.removeAllTriggers(dataset.moodId);
        })
        for (let i = 0; i < browser.length; i++) {
            browser[i].addEventListener('change', async (event) => {
                let eventSelect = event.target.parentNode.parentNode.querySelector(".eventElement");
                let length = eventSelect.options.length;

                for (i = length - 1; i > 0; i--) {
                    eventSelect.remove(i);
                }
                if (event.target.value == "combat") {
                    var start = document.createElement('option');
                    start.value = "start";
                    start.innerHTML = "Start";
                    eventSelect.appendChild(start);
                    var end = document.createElement('option');
                    end.value = "end";
                    end.innerHTML = "End";
                    eventSelect.appendChild(end);
                } else if (event.target.value == "scene") {
                    const scenes = Array.from(game.scenes);
                    for (let i = 0; i < scenes.length; i++) {
                        const obj = document.createElement('option');
                        obj.value = scenes[i].id;
                        obj.innerHTML = scenes[i].name;
                        eventSelect.appendChild(obj);
                    }
                }
            });
        }
    }
    async soundEdit(moodId, soundId, soundType) {
        console.warn("Editing sound", moodId, soundId, soundType);
        let soundConfig = null;
        if (soundType == constants.SOUNDTYPE.GROUP_LOOP || soundType == constants.SOUNDTYPE.GROUP_RANDOM) {
            soundConfig = await this.soundscape.moods[moodId].getGroup(soundId);
        } else {
            soundConfig = await this.soundscape.moods[moodId].getSound(soundId);
        }

        const templatePath = "/modules/soundscape-adventure/templates/editsound.hbs";
        let others = {};
        const triggers = [];
        const regionEvents = [
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
        const triggerActions = ["play", "stop"];
        let _regions = [];
        if (game.scenes.active) {
            _regions = Array.from(game.canvas?.scene?.regions);
        }
        let onElements = [];
        for (let m = 0; m < _regions.length; m++) {
            onElements.push({
                id: _regions[m].id,
                name: _regions[m].name,
                selected: false
            })
        }
        onElements.push({
            id: "combat",
            name: "Combat",
            selected: false
        })
        for (let i = 0; i < 3; i++) {
            triggers.push({
                actions: [
                    {
                        id: "play",
                        name: "Play",
                        selected: false
                    },
                    {
                        id: "stop",
                        name: "Stop",
                        selected: false
                    }],
                on: JSON.parse(JSON.stringify(onElements)),
                events: []
            })
        }

        let triggerSettings = game.settings.get(constants.STORAGETRIGGERSETTINGS, "triggerSettings");
        if (triggerSettings[moodId]) {
            if (triggerSettings[moodId][soundId]) {
                const currentTriggers = triggerSettings[moodId][soundId];
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < triggers[i].actions.length; j++) {
                        if (triggers[i].actions[j].id == currentTriggers[i].action) {
                            triggers[i].actions[j].selected = true;
                        }
                    }
                    for (let k = 0; k < triggers[i].on.length; k++) {
                        if (triggers[i].on[k].id == currentTriggers[i].on) {
                            triggers[i].on[k].selected = true;
                            if (triggers[i].on[k].id != "combat") {
                                for (let r = 0; r < regionEvents.length; r++) {
                                    triggers[i].events.push({
                                        id: regionEvents[r],
                                        name: regionEvents[r],
                                        selected: regionEvents[r] == currentTriggers[i].event ? true : false
                                    })
                                }
                            } else {
                                triggers[i].events.push({
                                    id: "start",
                                    name: "Start",
                                    selected: "start" == currentTriggers[i].event ? true : false
                                })
                                triggers[i].events.push({
                                    id: "end",
                                    name: "End",
                                    selected: "end" == currentTriggers[i].event ? true : false
                                })
                            }
                        } else {
                            triggers[i].on[k].selected = false;
                        }
                    }
                }
            }
        }


        //const sounds = this.soundscape.moods[moodId].getSoundByGroup(soundConfig.id);
        console.warn("SoundConfig", soundConfig)
        const html_content = await foundry.applications.handlebars.renderTemplate(templatePath, { sound: soundConfig, sounds: soundConfig?.sounds, triggers: triggers, groups: this.soundscape.moods[moodId].groups });
        const soundEditDialog = new foundry.applications.api.DialogV2({
            window: { title: "Edit sound" },
            content: html_content,
            buttons: [
                {
                    action: "save",
                    label: "Save",
                    callback: (event, button, dialog) => this.updateSound(button.form.elements, soundId, moodId),
                    icon: "fas fa-check"
                },
                {
                    action: "cancel",
                    label: "Cancel",
                    callback: () => { },
                    icon: "fas fa-times"
                }]
        });
        await soundEditDialog.render(true);

        const browser = soundEditDialog.element.querySelectorAll('.onElement');

        const removeSounds = soundEditDialog.element.querySelectorAll(".sound-remove-group");

        const addSound = soundEditDialog.element.querySelector(".sound-add-group");

        const fadeIn = soundEditDialog.element.querySelector(".fadeIn");
        const fadeOut = soundEditDialog.element.querySelector(".fadeOut");

        if (fadeIn) {
            const range_fadeIn = fadeIn.querySelector(".fadeIn-range");
            if (range_fadeIn) {
                range_fadeIn.addEventListener("change", async (el) => {
                    const new_value = el.target.value;
                    const fadein_element = fadeIn.querySelector('.fadeIn-value');
                    fadein_element.innerText = `${new_value}s`;

                });
            }
        }

        if (fadeOut) {
            const range_fadeOut = fadeOut.querySelector(".fadeOut-range");
            if (range_fadeOut) {
                range_fadeOut.addEventListener("change", async (el) => {
                    const new_value = el.target.value;
                    const fadeout_element = fadeOut.querySelector('.fadeOut-value');
                    fadeout_element.innerText = `${new_value}s`;

                });
            }
        }

        // Attach to your button
        const filePickerIcon = soundEditDialog.element.querySelector(".file-picker")

        if (filePickerIcon) {
            filePickerIcon.addEventListener("click", ev => {
                const picker = new FilePicker({
                    type: "image",                       // image, audio, video, etc.
                    callback: path => {
                        const input = soundEditDialog.element.querySelector("input[name='soundIcon']");
                        input.value = path;
                        let img = soundEditDialog.element.querySelector(".sound-icon");
                        if (img) {
                            img.src = path;
                        } else {
                            const element = soundEditDialog.element.querySelector(".sound-icon-button");
                            const icon = element.querySelector("i");
                            if (icon) {
                                icon.remove();
                            }
                            // Create the <img> element
                            img = document.createElement("img");
                            img.src = path;   // <-- change this
                            img.style.width = "32px";
                            img.style.height = "32px";
                            img.style.pointerEvents = "none";
                            img.className = "sound-icon";

                            // Append the image to the button
                            element.appendChild(img);
                        }
                    }
                });
                picker.render(true);
            });
        }

        if (addSound) {
            addSound.addEventListener("change", async (el) => {
                if (el.target.value == "NewGroup") {
                    const group = el.target.value;
                    const dataset = el.target.dataset;
                    const confirmation_dialog = new foundry.applications.api.DialogV2({
                        window: { title: "Add new Group" },
                        content: `<p>Select a name for the new group</p><input type="text" class="form-control" id="newGroupName" placeholder="New Group Name">`,
                        buttons: [
                            {
                                action: "yes",
                                label: "Yes",
                                callback: async (event, button) => {
                                    const group = button.form.elements.newGroupName.value;
                                    // if (dataset.soundId == "") {
                                    //     ui.notifications.error(`Not able to create the group ${group}. Sound ID is missing.`);
                                    //     return;
                                    // }
                                    await this.soundscape.addSoundToNewGroup(moodId, soundId, group);
                                    soundEditDialog.close();
                                    this.myRender(true);
                                },
                                icon: "fas fa-check"
                            },
                            {
                                action: "no",
                                label: "No",
                                callback: () => { el.target.value = "" },
                                icon: "fas fa-times"
                            }]
                    });
                    confirmation_dialog.render(true);
                } else if (el.target.value) {
                    const groupId = el.target.value;
                    const dataset = el.target.dataset;
                    const groupName = el.target.options[el.target.selectedIndex].text;
                    const confirmation_dialog = new foundry.applications.api.DialogV2({
                        window: { title: "Add sound to Group" },
                        content: `<p>Are you sure you want to add the sound <b>${dataset.soundName}?</b> to the group ${groupName}</p>`,
                        buttons: [
                            {
                                action: "yes",
                                label: "Yes",
                                callback: async () => {
                                    await this.soundscape.addSoundToGroup(moodId, dataset.soundId, groupId);
                                    soundEditDialog.close();
                                    this.myRender(true);
                                },
                                icon: "fas fa-check"
                            },
                            {
                                action: "no",
                                label: "No",
                                callback: () => { el.target.value = "" },
                                icon: "fas fa-times"
                            }]
                    });
                    confirmation_dialog.render(true);
                }

            });
        }

        for (let i = 0; i < removeSounds.length; i++) {
            removeSounds[i].addEventListener("click", async (el) => {
                const dataset = el.currentTarget.dataset;


                const confirmation_dialog = new foundry.applications.api.DialogV2({
                    window: { title: "Remove sound" },
                    content: `<p>Are you sure you want to remove the sound from the group?</p>`,
                    buttons: [
                        {
                            action: "yes",
                            label: "Yes",
                            callback: () => {
                                this.soundscape.removeSoundFromGroup(moodId, dataset.soundId, dataset.groupId);
                                const parent = el.target.closest(".group-names");
                                const toRemove = el.target.closest(".sound-remove-group");
                                parent.removeChild(toRemove);
                                soundEditDialog.close();
                                this.myRender(true);
                            },
                            icon: "fas fa-check"
                        },
                        {
                            action: "no",
                            label: "No",
                            callback: () => {
                                utils.log(utils.getCallerInfo(), `Sound not removed`, constants.LOGLEVEL.INFO);
                            },
                            icon: "fas fa-times"
                        }]
                });
                confirmation_dialog.render(true);
            });
        }
        for (let i = 0; i < browser.length; i++) {
            browser[i].addEventListener('change', async (event) => {
                let eventSelect = event.target.parentNode.parentNode.querySelector(".eventElement");
                var length = eventSelect.options.length;
                for (i = length - 1; i > 0; i--) {
                    eventSelect.remove(i);
                }
                if (event.target.value == "combat") {
                    var start = document.createElement('option');
                    start.value = "start";
                    start.innerHTML = "Start";
                    eventSelect.appendChild(start);
                    var end = document.createElement('option');
                    end.value = "end";
                    end.innerHTML = "End";
                    eventSelect.appendChild(end);
                } else if (event.target.value.length > 0) {
                    for (let i = 0; i < regionEvents.length; i++) {
                        var opt = document.createElement('option');
                        opt.value = regionEvents[i];
                        opt.innerHTML = regionEvents[i];
                        eventSelect.appendChild(opt);
                    }
                }
            })
        }

    }

    async updateMood(elements, moodId) {
        const triggers = [];
        for (let i = 0; i < elements.triggerAction.length; i++) {
            const trigger = {
                action: elements.triggerAction[i].value,
                event: elements.triggerEvent[i].value,
                on: elements.triggerOn[i].value
            }
            triggers.push(trigger)
        }
        this.soundscape.moods[moodId].name = elements.moodName.value;
        this.soundscape.saveTrigger(moodId, "mood", triggers);
        this.myRender(true);
    }
    async updateSound(elements, soundId, moodId) {

        let new_interval = {
            from: 10,
            to: 60
        };
        const from = elements.from;
        if (from) new_interval.from = from.value;
        const to = elements.to;
        if (to) new_interval.to = to.value;
        const new_fade = {
            fadeIn: parseInt(elements.fadeIn.value),
            fadeOut: parseInt(elements.fadeOut.value)
        }
        let playOnce = false;
        if (elements.playOnce) {
            playOnce = elements.playOnce.checked;
        }
        const triggers = [];
        for (let i = 0; i < elements.triggerAction.length; i++) {
            const trigger = {
                action: elements.triggerAction[i].value,
                event: elements.triggerEvent[i].value,
                on: elements.triggerOn[i].value
            }
            triggers.push(trigger)
        }
        await this.soundscape.saveExtas(moodId, soundId, new_interval, new_fade, playOnce);

        if (elements?.soundName)
            await this.soundscape.updateSoundName(soundId, elements.soundName.value);
        await this.soundscape.saveTrigger(moodId, soundId, triggers);
        if (elements?.soundIcon?.value) {
            await this.soundscape.updateSoundIcon(moodId, soundId, elements.soundIcon.value);
        }
        this.myRender(true);
    }

    updateMoodName(moodId, MoodName) {
        this.soundscape.moods[moodId].name = MoodName;
        this.soundscape.saveMoodsConfig();
        this.myRender(true);

    }

    async _prepareContext(options) {
        // Determine the current active mood
        this._determineCurrentMood();

        // Build mood list and selected mood data using MoodConfig view methods
        const moods = [];
        let selected_mood = null;

        for (const key in this.soundscape.moods) {
            const mood = this.soundscape.moods[key];
            const isSelected = this.currentMoodOnUI === mood.id;

            // Get mood summary for the list
            moods.push(mood.getMoodSummary(isSelected));

            // Get full view data for the selected mood
            if (isSelected) {
                selected_mood = mood.getViewData(true);
            }
        }

        // Get library sounds for the selected mood
        let library = [];
        if (this.currentMoodOnUI && this.soundscape.moods[this.currentMoodOnUI]) {
            library = this.soundscape.moods[this.currentMoodOnUI].getLibrarySounds();
        }

        const sound_view = await game.settings.get('soundscape-adventure', "sound-view-type");

        console.warn("Prepared context data for Soundscape UI", selected_mood);

        return {
            name: this.soundscape.name,
            moods: moods.sort((a, b) => a.name.localeCompare(b.name)),
            soundscapeId: this.soundscape.id,
            off_visible: this.soundscape.visible_off_sounds,
            activeMood: this.currentMoodOnUI,
            library: library,
            libraryIsOpen: this.libraryIsOpen,
            selected_mood: selected_mood,
            card_view: sound_view === constants.SOUNDVIEW.CARDVIEW
        };
    }

    /**
     * Determine which mood should be displayed as current
     * @private
     */
    _determineCurrentMood() {
        // Check if soundscape already has a current mood set
        if (this.soundscape.currentMoodOnUI?.length) {
            this.currentMoodOnUI = this.soundscape.currentMoodOnUI;
            return;
        }

        // Try to get from settings
        const config = game.settings.get(constants.STORAGETRIGGERSETTINGS, "currentMoodOnUI");
        if (config?.length) {
            const savedMoods = config.split(":").filter(e => e !== "");
            for (const key in this.soundscape.moods) {
                if (savedMoods.includes(key)) {
                    this.currentMoodOnUI = key;
                    return;
                }
            }
        }

        // Default to first mood if none selected
        if (!this.currentMoodOnUI) {
            const moodKeys = Object.keys(this.soundscape.moods);
            if (moodKeys.length > 0) {
                this.currentMoodOnUI = moodKeys[0];
            }
        }
    }


}