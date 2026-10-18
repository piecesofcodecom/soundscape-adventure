import { HOOK_LIBRARY_UPDATED, HOOK_LIBRARY_PROGRESS } from "../SoundLibrary.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TPL = "modules/soundscape-adventure/templates/library";
const LS_VOLUME = "soundscape-library.previewVolume";
const LS_PLAYLIST = "soundscape-library.targetPlaylist";
const LS_POSITION = "soundscape-library.windowPosition";
const LS_SORT = "soundscape-library.sort";
const ITEM_TPL = `${TPL}/parts/list-item.hbs`;
const TREE_ITEM_TPL = `${TPL}/parts/tree-item.hbs`;
const ROW_HEIGHT = 46;       // fixed General-list row height (px) — required for windowing math
const TREE_ROW_HEIGHT = 32;  // fixed Folders-tree row height (px) — must match .sa-lib-tree__dir/__file
const OVERSCAN = 6;          // extra rows above/below the viewport for smooth scrolling

/** Duration buckets for the toolbar filter (seconds, [min, max)). */
const DURATION_FILTERS = {
    short: { label: "< 10s", tooltip: "One-shots: shorter than 10 seconds", min: 0, max: 10 },
    medium: { label: "10s – 1m", tooltip: "Between 10 seconds and 1 minute", min: 10, max: 60 },
    long: { label: "> 1m", tooltip: "Ambiences and music: longer than 1 minute", min: 60, max: Infinity }
};

const SORTS = {
    name: { label: "Name", compare: null }, // search() already returns name order
    "duration-asc": { label: "Shortest first", compare: (a, b) => (a.duration ?? Infinity) - (b.duration ?? Infinity) },
    "duration-desc": { label: "Longest first", compare: (a, b) => (b.duration ?? -1) - (a.duration ?? -1) },
    recent: { label: "Recently added", compare: (a, b) => b.addedAt - a.addedAt }
};

/** Compact duration label: 0.4s, 12s, 3:07, 1:02:03. */
function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return "";
    // Thresholds sit just below the boundary so rounding never prints "10.0s"/"60s".
    if (seconds < 9.95) return `${Math.round(seconds * 10) / 10}s`;
    if (seconds < 59.5) return `${Math.round(seconds)}s`;
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Human-readable path (library paths are stored URL-encoded). */
function decodePath(path) {
    try { return decodeURIComponent(path); } catch { return path; }
}

/**
 * The Sound Library window.
 *
 * Deliberately thin: it reads from `game.soundscapeLibrary` (the core) and turns
 * user actions into core calls. No library logic lives here. Templates are split
 * into small parts (toolbar, list) under templates/library/parts/.
 */
export default class LibraryApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static PARTS = {
        nav: { template: `${TPL}/parts/nav.hbs` },
        tags: { template: `${TPL}/parts/tags.hbs` },
        toolbar: { template: `${TPL}/parts/toolbar.hbs` },
        list: { template: `${TPL}/parts/list.hbs` },
        tree: { template: `${TPL}/parts/tree.hbs` },
        synonyms: { template: `${TPL}/parts/synonyms.hbs` },
        tutorial: { template: `${TPL}/parts/tutorial.hbs` }
    };

    static DEFAULT_OPTIONS = {
        id: "soundscape-library",
        classes: ["soundscape-library"],
        window: { title: "Sound Library", icon: "fas fa-music", resizable: true },
        position: { width: 720, height: 640 }
    };

    constructor(options = {}) {
        // Restore the last window size/position.
        try {
            const saved = JSON.parse(localStorage.getItem(LS_POSITION));
            if (saved && typeof saved === "object") options.position = Object.assign({}, saved, options.position);
        } catch { /* ignore malformed */ }
        super(options);
    }

    /** @type {"general"|"folders"|"synonyms"|"tutorial"} the visible tab */
    #activeTab = "general";
    /** @type {Set<string>} currently active tag filters */
    #activeTags = new Set();
    /** @type {Set<string>} collapsed folder paths in the Folders tab */
    #collapsed = new Set();
    /** When true, only favorited sounds are shown. */
    #favoritesOnly = false;
    /** @type {""|"short"|"medium"|"long"} active duration bucket ("" = all) */
    #durationFilter = "";
    /** @type {keyof SORTS} list order */
    #sort = SORTS[localStorage.getItem(LS_SORT)] ? localStorage.getItem(LS_SORT) : "name";
    /** Set when the user cancels the duration scan, so it isn't auto-restarted this session. */
    #durationScanDeclined = false;
    #progressHookId = null;
    /** When true, the Folders tab shows ignored folders/files (red markers). */
    #showIgnored = false;
    /** Target playlist id for "add to playlist"; "" means ask each time. */
    #targetPlaylistId = localStorage.getItem(LS_PLAYLIST) ?? "";
    /** @type {Set<string>} ids selected for batch actions */
    #selected = new Set();
    /** @type {string} current sound text filter (applied in-DOM, no re-render) */
    #search = "";
    /** @type {string} current tag-name filter (applied in-DOM, no re-render) */
    #tagSearch = "";
    /** @type {foundry.audio.Sound|null} the sound currently previewing */
    #preview = null;
    /** @type {string|null} id of the sound currently previewing */
    #previewId = null;
    #hookId = null;
    /** Stable handlers so re-renders don't stack duplicate listeners. */
    #clickHandler = (ev) => this.#onClick(ev);
    #dblClickHandler = (ev) => {
        const name = ev.target.closest(".sa-lib-item__name[data-action='rename']");
        if (name) this.#startRename(name);
    };
    /** Right-click a tag chip to edit its synonyms. */
    #contextMenuHandler = (ev) => {
        const tag = ev.target.closest(".sa-lib-tag");
        if (!tag) return;
        ev.preventDefault();
        this.#editSynonyms(tag.dataset.tag);
    };
    /** Drag a library sound out to a soundscape mood (cross-window). */
    #dragStartHandler = (ev) => {
        const row = ev.target.closest("[data-id]");
        if (!row) return;
        ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "library", libraryId: row.dataset.id }));
        ev.dataTransfer.effectAllowed = "copy";
    };
    /** Last known scroll position, kept so re-renders don't jump to the top. */
    #scrollTop = 0;
    #scrollHandler = (ev) => { this.#scrollTop = ev.target.scrollTop; };
    #searchTimer = null;
    /** Filtered sounds backing the virtualized General list. */
    #listData = [];
    /** Compiled list-item template (loaded once). */
    #itemTpl = null;
    /** rAF token to throttle window re-renders on scroll. */
    #listRaf = null;
    #listScrollHandler = () => {
        if (this.#listRaf) return;
        this.#listRaf = requestAnimationFrame(() => { this.#listRaf = null; this.#renderListWindow(); });
    };
    /** Filtered sounds backing the virtualized Folders tree (built lazily). */
    #filteredSounds = [];
    /** Full flat tree rows (folders + files); rebuilt only when data changes. */
    #treeData = [];
    /** Tree rows currently visible (i.e. not under a collapsed folder). */
    #treeVisible = [];
    /** True when #treeData must be rebuilt before the next tree paint. */
    #treeDirty = true;
    /** Compiled tree-item template (loaded once). */
    #treeTpl = null;
    /** Last known Folders-tree scroll position. */
    #treeScrollTop = 0;
    /** rAF token to throttle tree window re-renders on scroll. */
    #treeRaf = null;
    #treeScrollHandler = (ev) => {
        this.#treeScrollTop = ev.target.scrollTop;
        if (this.#treeRaf) return;
        this.#treeRaf = requestAnimationFrame(() => { this.#treeRaf = null; this.#renderTreeWindow(); });
    };
    // Stable input/change handlers — toolbar elements survive partial renders, so
    // these are attached with remove-then-add to avoid stacking duplicates.
    #searchHandler = () => {
        const el = this.element?.querySelector(".sa-lib-search");
        this.#search = (el?.value ?? "").toLowerCase();
        clearTimeout(this.#searchTimer);
        // Re-render only the content parts so the search input keeps focus.
        this.#searchTimer = setTimeout(() => this.render({ parts: ["list", "tree"] }), 150);
    };
    #tagFilterHandler = () => {
        const el = this.element?.querySelector(".sa-lib-tagfilter");
        this.#tagSearch = (el?.value ?? "").toLowerCase();
        this.#applyTagFilter();
    };
    #volumeHandler = () => {
        const el = this.element?.querySelector(".sa-lib-volume__slider");
        if (!el) return;
        this.#onVolume(el.value);
        this.#syncVolumeFill(el);
    };

    // Filled part of the slider track, exposed to CSS as --sa-fill.
    #syncVolumeFill(el) {
        const max = Number(el.max) || 1;
        el.style.setProperty("--sa-fill", `${(Number(el.value) / max) * 100}%`);
    }
    #playlistHandler = () => {
        const el = this.element?.querySelector(".sa-lib-playlist");
        if (!el) return;
        this.#targetPlaylistId = el.value;
        localStorage.setItem(LS_PLAYLIST, el.value);
    };
    #sortHandler = () => {
        const el = this.element?.querySelector(".sa-lib-sort");
        if (!el || !SORTS[el.value]) return;
        this.#sort = el.value;
        localStorage.setItem(LS_SORT, el.value);
        this.render({ parts: ["list", "tree"] });
    };
    #showIgnoredHandler = () => {
        const el = this.element?.querySelector(".sa-lib-showignored");
        this.#showIgnored = !!el?.checked;
        this.render({ parts: ["tree"] });
    };
    /** Global preview volume (0–1), persisted in localStorage. */
    #volume = (() => {
        const v = parseFloat(localStorage.getItem(LS_VOLUME));
        return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0.7;
    })();

    get library() {
        return game.soundscapeLibrary;
    }

    /**
     * The sounds matching every active filter (text + tags + favorites +
     * duration), in the chosen order. Shared by both tabs — the General tab
     * renders it as a flat list, the Folders tab as a tree — and by "Add N".
     */
    #filtered() {
        let sounds = this.library.search({
            text: this.#search,
            tags: [...this.#activeTags],
            matchAll: true,
            favorite: this.#favoritesOnly
        });
        const bucket = DURATION_FILTERS[this.#durationFilter];
        if (bucket) sounds = sounds.filter(s => s.duration !== null && s.duration >= bucket.min && s.duration < bucket.max);
        const compare = SORTS[this.#sort]?.compare;
        if (compare) sounds.sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
        return sounds;
    }

    async _prepareContext() {
        const lib = this.library;
        const sounds = this.#filtered();

        // Back the virtualized General list with the filtered, view-shaped data.
        this.#itemTpl ??= await foundry.applications.handlebars.getTemplate(ITEM_TPL);
        this.#treeTpl ??= await foundry.applications.handlebars.getTemplate(TREE_ITEM_TPL);
        // The Folders tree is virtualized too: keep the filtered set and defer the
        // (potentially large) tree build until the tab is actually painted.
        this.#filteredSounds = sounds;
        this.#treeDirty = true;
        this.#listData = sounds.map(s => ({
            id: s.id,
            name: s.name,
            lname: s.name.toLowerCase(),
            path: s.path,
            pathLabel: decodePath(s.path),
            duration: formatDuration(s.duration),
            favorite: s.favorite,
            userTags: [...s.tags],
            autoTags: [...s.autoTags],
            missing: s.missing,
            missingReason: s.missingReason
        }));

        return {
            listHeight: this.#listData.length * ROW_HEIGHT,
            total: lib.size,
            shown: sounds.length,
            missing: lib.sounds.filter(s => s.missing).length,
            favoritesOnly: this.#favoritesOnly,
            durationFilters: [
                { id: "", label: "All", tooltip: "Any duration", active: !this.#durationFilter },
                ...Object.entries(DURATION_FILTERS).map(([id, f]) => ({ id, label: f.label, tooltip: f.tooltip, active: this.#durationFilter === id }))
            ],
            sorts: Object.entries(SORTS).map(([id, s]) => ({ id, label: s.label, selected: this.#sort === id })),
            unmeasured: lib.countUnmeasured(),
            volume: this.#volume,
            roots: lib.getRoots(),
            playlists: game.playlists.contents.map(p => ({ id: p.id, name: p.name, selected: p.id === this.#targetPlaylistId })),
            tabs: [
                { id: "general", label: "General", icon: "fa-list", active: this.#activeTab === "general" },
                { id: "folders", label: "Folders", icon: "fa-folder-tree", active: this.#activeTab === "folders" },
                { id: "synonyms", label: "Synonyms", icon: "fa-diagram-project", active: this.#activeTab === "synonyms" },
                { id: "tutorial", label: "Tutorial", icon: "fa-circle-question", active: this.#activeTab === "tutorial" }
            ],
            showIgnored: this.#showIgnored,
            synonymGroups: lib.getSynonymGroups(),
            allTagsList: lib.getAllTags(),
            hasActiveTags: this.#activeTags.size > 0,
            activeTagCount: this.#activeTags.size,
            tags: lib.getAllTags()
                .map(name => ({ name, active: this.#activeTags.has(name) }))
                .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name))
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;

        // Sound text filter (re-renders only list+tree, keeping input focus).
        const search = root.querySelector(".sa-lib-search");
        if (search) {
            search.value = this.#search;
            search.removeEventListener("input", this.#searchHandler);
            search.addEventListener("input", this.#searchHandler);
        }

        // Tag-name filter (in-DOM chip toggling).
        const tagFilter = root.querySelector(".sa-lib-tagfilter");
        if (tagFilter) {
            tagFilter.value = this.#tagSearch;
            tagFilter.removeEventListener("input", this.#tagFilterHandler);
            tagFilter.addEventListener("input", this.#tagFilterHandler);
        }
        this.#applyTagFilter();

        // Target playlist selector.
        const pl = root.querySelector(".sa-lib-playlist");
        if (pl) {
            pl.removeEventListener("change", this.#playlistHandler);
            pl.addEventListener("change", this.#playlistHandler);
        }

        // List order.
        const sort = root.querySelector(".sa-lib-sort");
        if (sort) {
            sort.removeEventListener("change", this.#sortHandler);
            sort.addEventListener("change", this.#sortHandler);
        }

        // "Show ignored" toggle (Folders tab).
        const showIgn = root.querySelector(".sa-lib-showignored");
        if (showIgn) {
            showIgn.removeEventListener("change", this.#showIgnoredHandler);
            showIgn.addEventListener("change", this.#showIgnoredHandler);
        }

        // Global preview volume.
        const vol = root.querySelector(".sa-lib-volume__slider");
        if (vol) {
            vol.value = this.#volume;
            this.#syncVolumeFill(vol);
            vol.removeEventListener("input", this.#volumeHandler);
            vol.addEventListener("input", this.#volumeHandler);
        }

        // Delegated clicks: tag chips, toolbar actions, row actions.
        // The root element persists across re-renders, so remove-then-add keeps a
        // single listener instead of stacking one per render.
        root.removeEventListener("click", this.#clickHandler);
        root.addEventListener("click", this.#clickHandler);
        root.removeEventListener("dblclick", this.#dblClickHandler);
        root.addEventListener("dblclick", this.#dblClickHandler);
        root.removeEventListener("dragstart", this.#dragStartHandler);
        root.addEventListener("dragstart", this.#dragStartHandler);
        root.removeEventListener("contextmenu", this.#contextMenuHandler);
        root.addEventListener("contextmenu", this.#contextMenuHandler);

        // Show only the active tab's pane.
        this.#applyTab();

        // Preserve scroll position across re-renders. Capture phase catches the
        // scroll regardless of which element actually scrolls; restoring to every
        // candidate is safe (non-scrollers ignore it).
        root.removeEventListener("scroll", this.#scrollHandler, true);
        root.addEventListener("scroll", this.#scrollHandler, true);
        for (const sel of [".window-content"]) {
            const el = root.querySelector(sel);
            if (el) el.scrollTop = this.#scrollTop;
        }

        // Virtualized Folders tree: re-window on scroll, restore position, paint.
        const tree = root.querySelector(".sa-vtree");
        if (tree) {
            tree.removeEventListener("scroll", this.#treeScrollHandler);
            tree.addEventListener("scroll", this.#treeScrollHandler);
            tree.scrollTop = this.#treeScrollTop;
            this.#renderTreeWindow();
        }

        // Virtualized General list: re-window on scroll, restore position, paint.
        const list = root.querySelector(".sa-lib-list");
        if (list) {
            list.removeEventListener("scroll", this.#listScrollHandler);
            list.addEventListener("scroll", this.#listScrollHandler);
            list.scrollTop = this.#scrollTop; // sizer height comes from the template
            this.#renderListWindow();
        }

        // Keep the stop icon on the row that is still previewing after a re-render.
        if (this.#previewId) this.#setPlayIcon(this.#previewId, "stop");

        this.#updateBatchBar();

        // Re-render when the library changes elsewhere.
        if (this.#hookId === null) {
            this.#hookId = Hooks.on(HOOK_LIBRARY_UPDATED, () => this.render(false));
        }

        // Duration scan: show its progress in place, and start it in the background
        // when sounds still lack a duration.
        if (this.#progressHookId === null) {
            this.#progressHookId = Hooks.on(HOOK_LIBRARY_PROGRESS, (lib, p) => this.#updateProgress(p));
        }
        this.#updateProgress(this.library.durationProgress);
        if (!this.#durationScanDeclined && context.unmeasured > 0) this.#measureDurations();
    }

    /** Start the background duration scan (no-op while one is already running). */
    async #measureDurations() {
        if (this.library.durationProgress) return;
        const result = await this.library.measureDurations();
        if (result.measured || result.failed) {
            const failed = result.failed ? `, ${result.failed} unreadable` : "";
            ui.notifications.info(`Library: measured ${result.measured} duration(s)${failed}.`);
        }
    }

    /** Reflect the duration scan state in the toolbar without re-rendering. */
    #updateProgress(progress) {
        const el = this.element?.querySelector(".sa-lib-progress");
        if (!el) return;
        const running = !!progress && progress.done < progress.total;
        el.toggleAttribute("hidden", !running);
        if (!running) return;
        const pct = progress.total ? (progress.done / progress.total) * 100 : 0;
        el.style.setProperty("--sa-progress", `${pct}%`);
        const label = el.querySelector(".sa-lib-progress__label");
        if (label) label.textContent = `Measuring durations ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`;
    }

    _onClose(options) {
        if (this.#hookId !== null) {
            Hooks.off(HOOK_LIBRARY_UPDATED, this.#hookId);
            this.#hookId = null;
        }
        // The scan itself keeps running in the library; only the UI stops listening.
        if (this.#progressHookId !== null) {
            Hooks.off(HOOK_LIBRARY_PROGRESS, this.#progressHookId);
            this.#progressHookId = null;
        }
        this.#stopPreview();
        // Remember the window size/position for next time.
        try {
            const p = this.position ?? {};
            localStorage.setItem(LS_POSITION, JSON.stringify({ width: p.width, height: p.height, left: p.left, top: p.top }));
        } catch { /* ignore */ }
        super._onClose(options);
    }

    /** Add a synonym group from the Synonyms tab's "new group" inputs. */
    #synAddGroup() {
        const canonEl = this.element?.querySelector(".sa-syn__new-canon");
        const synsEl = this.element?.querySelector(".sa-syn__new-syns");
        const canon = (canonEl?.value ?? "").trim();
        const syns = (synsEl?.value ?? "").split(",").map(s => s.trim()).filter(Boolean);
        if (!canon) {
            ui.notifications.warn("Enter a tag.");
            return;
        }
        // Synonyms are optional: a tag on its own declares a new umbrella tag
        // (it need not match any sound) that you can attach synonyms to later.
        const merged = [...new Set([...this.library.getSynonyms(canon), ...syns])];
        this.library.setSynonyms(canon, merged);
        if (canonEl) canonEl.value = "";
        if (synsEl) synsEl.value = "";
    }

    /** Prompt for a synonym to add to a group (the + button on the Synonyms tab). */
    async #synAddTerm(canon) {
        if (!canon) return;
        let value;
        try {
            value = await foundry.applications.api.DialogV2.prompt({
                window: { title: `Add synonym to "${canon}"` },
                content: `<input type="text" name="syn" placeholder="synonym…" autofocus>`,
                ok: { label: "Add", icon: "fas fa-plus", callback: (ev, btn) => btn.form.elements.syn.value },
                rejectClose: false
            });
        } catch {
            return;
        }
        const s = (value ?? "").trim();
        if (s) this.library.addSynonym(canon, s);
    }

    /** Edit the synonyms of a tag (comma-separated). */
    async #editSynonyms(tag) {
        if (!tag) return;
        const esc = foundry.utils.escapeHTML;
        const current = this.library.getSynonyms(tag).join(", ");
        let value;
        try {
            value = await foundry.applications.api.DialogV2.prompt({
                window: { title: `Synonyms for "${tag}"` },
                content: `<p style="opacity:.8;font-size:.85em">Comma-separated. A sound matching any synonym
                    (by name or tag) counts as "<b>${esc(tag)}</b>" in filters and auto-tagging.</p>
                    <input type="text" name="syns" value="${esc(current)}" placeholder="e.g. raining, rainy, shower" autofocus>`,
                ok: { label: "Save", icon: "fas fa-check", callback: (ev, btn) => btn.form.elements.syns.value },
                rejectClose: false
            });
        } catch {
            return;
        }
        if (value === undefined || value === null) return;
        const list = value.split(",").map(s => s.trim()).filter(Boolean);
        this.library.setSynonyms(tag, list);
        ui.notifications.info(`Synonyms updated for "${tag}".`);
    }

    /** Add a tag to every sound whose file name contains that word (with confirm). */
    async #applyAutoTag() {
        const input = this.element?.querySelector(".sa-lib-autotag__input");
        const word = (input?.value ?? "").trim();
        if (!word) return;

        const ids = this.library.findByNameWord(word);
        if (!ids.length) {
            ui.notifications.warn(`No sounds have "${word}" in their name.`);
            return;
        }
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Auto-tag by name" },
            content: `<p>Add the tag <b>${foundry.utils.escapeHTML(word.toLowerCase())}</b> to
                <b>${ids.length}</b> sound(s) whose name contains "${foundry.utils.escapeHTML(word)}"?</p>`,
            rejectClose: false,
            modal: true
        });
        if (!ok) return;

        const n = this.library.addTagToMany(ids, word);
        if (input) input.value = "";
        ui.notifications.info(`Tagged ${n} sound(s) with "${word.toLowerCase()}".`);
    }

    /** Show only tag chips matching the tag filter; active tags always stay visible. */
    #applyTagFilter() {
        const chips = this.element.querySelectorAll(".sa-lib-tag");
        for (const chip of chips) {
            const name = chip.dataset.tagname ?? "";
            const visible = chip.classList.contains("is-active") || name.includes(this.#tagSearch);
            chip.style.display = visible ? "" : "none";
        }
    }

    async #onClick(ev) {
        const el = ev.target.closest("[data-action], [data-tag], [data-tab]");
        if (!el) return;

        if (el.dataset.tab !== undefined) {
            this.#activeTab = el.dataset.tab;
            return this.#applyTab();
        }

        if (el.dataset.tag !== undefined) {
            const tag = el.dataset.tag;
            this.#activeTags.has(tag) ? this.#activeTags.delete(tag) : this.#activeTags.add(tag);
            return this.render(false);
        }

        switch (el.dataset.action) {
            case "toggle-dir": {
                const p = el.dataset.path;
                this.#collapsed.has(p) ? this.#collapsed.delete(p) : this.#collapsed.add(p);
                this.#recomputeTreeVisible();
                return this.#renderTreeWindow();
            }
            case "import": return this.#importFolder();
            case "roots": return this.#openRoots();
            case "duplicates": return this.#findDuplicates();
            case "refresh": return this.#refresh();
            case "preview": return this.#togglePreview(el.closest("[data-id]")?.dataset.id);
            case "add-to-playlist": return this.#addToPlaylist(el.closest("[data-id]")?.dataset.id);
            case "add-results": return this.#addFilteredToPlaylist();
            case "favorite": return void this.library.toggleFavorite(el.closest("[data-id]")?.dataset.id);
            case "toggle-favorites":
                this.#favoritesOnly = !this.#favoritesOnly;
                return this.render(false);
            case "duration-filter":
                this.#durationFilter = el.dataset.duration ?? "";
                return this.render(false);
            case "measure-durations":
                this.#durationScanDeclined = false;
                return this.#measureDurations();
            case "cancel-durations":
                this.#durationScanDeclined = true;
                return this.library.cancelDurations();
            case "copy-path": return this.#copyPath(el.closest("[data-id]")?.dataset.id);
            case "remove": return this.#removeSound(el.closest("[data-id]")?.dataset.id);
            case "remove-folder": return this.#removeFolder(el.dataset.path);
            case "folder-to-playlist": return this.#folderToPlaylist(el.dataset.path);
            case "restore-folder": return this.#restoreFolder(el.dataset.path);
            case "restore-file": return this.#restoreFile(el.dataset.full);
            case "untag": return void this.library.removeTag(el.closest("[data-id]")?.dataset.id, el.dataset.tagValue);
            case "add-tag": return this.#startAddTag(el);
            case "clean-missing": return this.#cleanMissing();
            case "select": return this.#toggleSelect(el);
            case "select-all": return this.#selectAll();
            case "select-none": return this.#selectNone();
            case "batch-favorite": return this.#batchFavorite(true);
            case "batch-unfavorite": return this.#batchFavorite(false);
            case "batch-tag": return this.#batchTag();
            case "batch-untag": return this.#batchUntag();
            case "batch-playlist": return this.#batchPlaylist();
            case "batch-remove": return this.#batchRemove();
            case "apply-autotag": return this.#applyAutoTag();
            case "syn-add-group": return this.#synAddGroup();
            case "syn-del-group": return void this.library.deleteSynonymGroup(el.dataset.canon);
            case "syn-remove": return void this.library.removeSynonym(el.dataset.canon, el.dataset.syn);
            case "syn-add": return this.#synAddTerm(el.dataset.canon);
            case "edit-synonyms": return this.#editSynonyms(el.dataset.tag);
            case "clear-tags":
                this.#activeTags.clear();
                return this.render(false);
        }
    }

    async #importFolder() {
        const FP = foundry.applications.apps.FilePicker.implementation;
        new FP({
            type: "folder",
            callback: async (path) => {
                const summary = await this.library.importFolder(path);
                ui.notifications.info(`Library: imported ${summary.added}, skipped ${summary.skipped}.`);
            }
        }).render(true);
    }

    /** Add a sound to a Foundry playlist (the selected one, or ask which). */
    async #addToPlaylist(id) {
        const sound = this.library.getById(id);
        if (!sound) return;
        if (sound.missing) {
            ui.notifications.warn(`"${sound.name}" is missing on disk.`);
            return;
        }

        let playlist = this.#targetPlaylistId ? game.playlists.get(this.#targetPlaylistId) : null;
        if (!playlist) {
            playlist = await this.#pickPlaylist();
            if (!playlist) return;
        }
        await this.#createPlaylistSound(playlist, sound);
    }

    async #createPlaylistSound(playlist, sound) {
        if (playlist.sounds.find(s => s.path === sound.path)) {
            ui.notifications.info(`"${sound.name}" is already in "${playlist.name}".`);
            return;
        }
        await playlist.createEmbeddedDocuments("PlaylistSound", [
            { name: sound.name, path: sound.path, volume: 0.8, repeat: false }
        ]);
        ui.notifications.info(`Added "${sound.name}" to "${playlist.name}".`);
    }

    /** Bulk-add sounds to a playlist, skipping missing files and existing paths. */
    async #addSoundsToPlaylist(playlist, sounds) {
        const existing = new Set(playlist.sounds.map(s => s.path));
        const toAdd = sounds.filter(s => !s.missing && !existing.has(s.path));
        if (!toAdd.length) {
            ui.notifications.info(`Nothing new to add to "${playlist.name}".`);
            return;
        }
        await playlist.createEmbeddedDocuments("PlaylistSound",
            toAdd.map(s => ({ name: s.name, path: s.path, volume: 0.8, repeat: false })));
        ui.notifications.info(`Added ${toAdd.length} sound(s) to "${playlist.name}".`);
    }

    /** Add the current filtered results (text + tags + favorites) to a playlist. */
    async #addFilteredToPlaylist() {
        const sounds = this.#filtered();
        if (!sounds.length) {
            ui.notifications.warn("No sounds match the current filters.");
            return;
        }

        let playlist = this.#targetPlaylistId ? game.playlists.get(this.#targetPlaylistId) : null;
        if (!playlist) {
            playlist = await this.#pickPlaylist();
            if (!playlist) return;
        }

        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Add results to playlist" },
            content: `<p>Add the <b>${sounds.length}</b> filtered sound(s) to <b>${foundry.utils.escapeHTML(playlist.name)}</b>?</p>
                <p style="opacity:.8;font-size:.85em">Sounds already in the playlist are skipped.</p>`,
            rejectClose: false,
            modal: true
        });
        if (!ok) return;
        await this.#addSoundsToPlaylist(playlist, sounds);
    }

    /** Add every sound in a folder to a playlist; ask about subfolders if any. */
    async #folderToPlaylist(folderPath) {
        if (!folderPath) return;
        const prefix = decodeURIComponent(folderPath) + "/";
        const all = this.library.sounds.filter(s => decodeURIComponent(s.path).startsWith(prefix));
        if (!all.length) {
            ui.notifications.warn("This folder has no sounds.");
            return;
        }
        const direct = all.filter(s => !decodeURIComponent(s.path).slice(prefix.length).includes("/"));

        let sounds = all;
        if (all.length > direct.length) { // there are sounds in subfolders
            let choice;
            try {
                choice = await foundry.applications.api.DialogV2.wait({
                    window: { title: "Add folder to playlist" },
                    content: `<p>This folder contains sounds in subfolders. Include them?</p>`,
                    buttons: [
                        { action: "all", label: `Include subfolders (${all.length})`, icon: "fas fa-sitemap", default: true },
                        { action: "direct", label: `Only this folder (${direct.length})`, icon: "fas fa-folder" },
                        { action: "cancel", label: "Cancel", icon: "fas fa-xmark" }
                    ],
                    rejectClose: false
                });
            } catch {
                return;
            }
            if (!choice || choice === "cancel") return;
            sounds = choice === "all" ? all : direct;
        }

        let playlist = this.#targetPlaylistId ? game.playlists.get(this.#targetPlaylistId) : null;
        if (!playlist) {
            playlist = await this.#pickPlaylist();
            if (!playlist) return;
        }
        await this.#addSoundsToPlaylist(playlist, sounds);
    }

    /** Ask which playlist to use (existing or a new one). @returns {Playlist|null} */
    async #pickPlaylist() {
        const esc = foundry.utils.escapeHTML;
        const options = game.playlists.contents
            .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
            .join("");
        const content = `
            <div class="sa-pick">
                <label class="sa-pick__field">Playlist
                    <select name="playlist">${options || `<option value="" disabled>(none yet)</option>`}</select>
                </label>
                <label class="sa-pick__field">or create new
                    <input type="text" name="newname" placeholder="New playlist name…">
                </label>
            </div>`;
        let result;
        try {
            result = await foundry.applications.api.DialogV2.wait({
                window: { title: "Add to playlist", icon: "fas fa-list-music" },
                content,
                buttons: [
                    {
                        action: "ok", label: "Add", icon: "fas fa-plus", default: true,
                        callback: (ev, btn) => ({
                            id: btn.form.elements.playlist?.value ?? "",
                            name: btn.form.elements.newname?.value?.trim() ?? ""
                        })
                    },
                    { action: "cancel", label: "Cancel", icon: "fas fa-xmark" }
                ],
                rejectClose: false
            });
        } catch {
            return null;
        }
        if (!result || result === "cancel") return null;

        if (result.name) {
            return Playlist.create({ name: result.name });
        }
        return game.playlists.get(result.id) ?? null;
    }

    // ----------------------------------------------------------- batch actions

    #toggleSelect(input) {
        const id = input.closest("[data-id]")?.dataset.id;
        if (!id) return;
        if (input.checked) this.#selected.add(id);
        else this.#selected.delete(id);
        input.closest(".sa-lib-item")?.classList.toggle("is-selected", input.checked);
        this.#updateBatchBar();
    }

    #selectAll() {
        for (const it of this.#listData) this.#selected.add(it.id);
        this.#renderListWindow();
        this.#updateBatchBar();
    }

    #selectNone() {
        this.#selected.clear();
        this.#renderListWindow();
        this.#updateBatchBar();
    }

    /** Show/hide the batch bar and update its count. */
    #updateBatchBar() {
        const bar = this.element?.querySelector(".sa-lib-batch");
        if (!bar) return;
        const n = this.#selected.size;
        bar.toggleAttribute("hidden", n === 0);
        const count = bar.querySelector(".sa-lib-batch__count");
        if (count) count.textContent = `${n} selected`;
    }

    #selectedIds() {
        return [...this.#selected];
    }

    #batchFavorite(value) {
        const n = this.library.setFavoriteMany(this.#selectedIds(), value);
        ui.notifications.info(`${value ? "Favorited" : "Unfavorited"} ${n} sound(s).`);
    }

    async #batchTag() {
        const tag = await this.#promptTag("Add tag to selected");
        if (!tag) return;
        const n = this.library.addTagToMany(this.#selectedIds(), tag);
        ui.notifications.info(`Tagged ${n} sound(s) with "${tag}".`);
    }

    async #batchUntag() {
        const tag = await this.#promptTag("Remove tag from selected");
        if (!tag) return;
        const n = this.library.removeTagFromMany(this.#selectedIds(), tag);
        ui.notifications.info(`Removed "${tag}" from ${n} sound(s).`);
    }

    async #batchPlaylist() {
        const sounds = this.#selectedIds().map(id => this.library.getById(id)).filter(Boolean);
        if (!sounds.length) return;
        let playlist = this.#targetPlaylistId ? game.playlists.get(this.#targetPlaylistId) : null;
        if (!playlist) {
            playlist = await this.#pickPlaylist();
            if (!playlist) return;
        }
        await this.#addSoundsToPlaylist(playlist, sounds);
    }

    async #batchRemove() {
        const ids = this.#selectedIds();
        if (!ids.length) return;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Remove selected" },
            content: `<p>Remove <b>${ids.length}</b> selected sound(s) from the library?</p>
                <p style="opacity:.8;font-size:.85em">Files on disk are not touched.</p>`,
            rejectClose: false,
            modal: true
        });
        if (!ok) return;
        if (this.#previewId && this.#selected.has(this.#previewId)) this.#stopPreview();
        const n = this.library.removeMany(ids);
        this.#selected.clear();
        ui.notifications.info(`Removed ${n} sound(s).`);
    }

    /** Small text-input dialog returning the trimmed value, or null. */
    async #promptTag(title) {
        try {
            return await foundry.applications.api.DialogV2.prompt({
                window: { title },
                content: `<input type="text" name="tag" placeholder="tag…" autofocus>`,
                ok: { label: "OK", icon: "fas fa-check", callback: (ev, btn) => btn.form.elements.tag.value.trim() },
                rejectClose: false
            });
        } catch {
            return null;
        }
    }

    /** Scan files by content (SHA-256) and show duplicate groups. */
    async #findDuplicates() {
        const lib = this.library;
        const pending = lib.countUnhashed();
        if (pending > 0) {
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Find duplicate audio" },
                content: `<p>Scan <b>${pending}</b> file(s) by content to detect duplicates?</p>
                    <p style="opacity:.8;font-size:.85em">Each file is read once; the hash is cached for next time.</p>`,
                rejectClose: false,
                modal: true
            });
            if (!ok) return;
            const btn = this.element.querySelector('[data-action="duplicates"]');
            await lib.computeHashes({
                onProgress: (done, total) => { if (btn) btn.textContent = ` Scanning ${done}/${total}…`; }
            });
        }
        this.#showDuplicates();
    }

    async #showDuplicates() {
        const esc = foundry.utils.escapeHTML;
        // Each copy gets a checkbox: checked = remove, unchecked = keep. By default
        // all but the first are checked (the common "keep one" case), but the user
        // is free to keep several or remove all.
        const groupsHtml = () => {
            const groups = this.library.findDuplicateContent();
            if (!groups.length) return `<p class="sa-dup__empty">No duplicate audio found.</p>`;
            return groups.map(g => `
                <div class="sa-dup__group">
                    <div class="sa-dup__head">${g.sounds.length} identical files — check the ones to remove</div>
                    ${g.sounds.map((s, i) => `
                        <label class="sa-dup__item">
                            <input type="checkbox" class="sa-dup__check" data-id="${s.id}" ${i > 0 ? "checked" : ""}>
                            <div class="sa-dup__main">
                                <span class="sa-dup__name">${esc(s.name)}</span>
                                <span class="sa-dup__path">${esc(s.path)}</span>
                            </div>
                        </label>`).join("")}
                </div>`).join("");
        };

        const dialog = new foundry.applications.api.DialogV2({
            window: { title: "Duplicate audio", icon: "fas fa-clone" },
            content: `<div class="sa-dup">
                    <div class="sa-dup__bar">
                        <button type="button" class="sa-dup__apply" data-act="remove-checked">
                            <i class="fas fa-trash"></i> Remove checked
                        </button>
                        <label class="sa-dup__ignoreopt" data-tooltip="Marked files won't be re-imported on scan/refresh">
                            <input type="checkbox" class="sa-dup__ignore" checked> Ignore (don't re-import)
                        </label>
                        <span class="sa-dup__hint">Check the copies to remove; unchecked stay. Files on disk are not
                            deleted — only removed from the library.</span>
                    </div>
                    <div class="sa-dup__list">${groupsHtml()}</div>
                </div>`,
            buttons: [{ action: "close", label: "Close", icon: "fas fa-xmark" }],
            rejectClose: false
        });
        await dialog.render(true);

        dialog.element.addEventListener("click", (ev) => {
            if (!ev.target.closest("[data-act='remove-checked']")) return;
            const ids = [...dialog.element.querySelectorAll(".sa-dup__check:checked")].map(c => c.dataset.id);
            if (!ids.length) {
                ui.notifications.warn("No copies are checked for removal.");
                return;
            }
            const ignore = dialog.element.querySelector(".sa-dup__ignore")?.checked;
            const n = ignore ? this.library.ignoreFilesMany(ids) : this.library.removeMany(ids);
            ui.notifications.info(`${ignore ? "Ignored" : "Removed"} ${n} duplicate(s).`);
            const list = dialog.element.querySelector(".sa-dup__list");
            if (list) list.innerHTML = groupsHtml();
        });
    }

    /** Dialog listing the imported roots, each removable. */
    async #openRoots() {
        const esc = foundry.utils.escapeHTML;
        const rowsHtml = () => {
            const roots = this.library.getRoots();
            if (!roots.length) return `<li class="sa-roots__empty">No roots yet. Use “Import” to add one.</li>`;
            return roots.map(r => `
                <li class="sa-roots__item">
                    <i class="fas fa-folder"></i>
                    <span class="sa-roots__path">${esc(r)}</span>
                    <button type="button" class="sa-roots__remove" data-root="${esc(r)}" data-tooltip="Remove root">
                        <i class="fas fa-trash"></i>
                    </button>
                </li>`).join("");
        };

        const dialog = new foundry.applications.api.DialogV2({
            window: { title: "Library roots", icon: "fas fa-folder-open" },
            content: `<ul class="sa-roots">${rowsHtml()}</ul>
                <p class="sa-roots__hint">Removing a root deletes the sounds imported from it and stops scanning it.
                Files on disk are never touched, and the folder can be re-imported later.</p>`,
            buttons: [{ action: "close", label: "Close", icon: "fas fa-xmark" }]
        });
        await dialog.render(true);

        dialog.element.addEventListener("click", async (ev) => {
            const btn = ev.target.closest(".sa-roots__remove");
            if (!btn) return;
            const root = btn.dataset.root;
            const prefix = decodeURIComponent(root) + "/";
            const count = this.library.sounds.filter(s => decodeURIComponent(s.path).startsWith(prefix)).length;

            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Remove root" },
                content: `<p>Remove root <b>${esc(root)}</b> and its <b>${count}</b> sound(s) from the library?</p>
                    <p style="opacity:.8;font-size:.85em">Files on disk are not touched; the folder can be re-imported later.</p>`,
                rejectClose: false,
                modal: true
            });
            if (!ok) return;

            this.library.removeFolder(root); // delete the sounds under this root
            this.library.removeRoot(root);   // stop scanning it
            const list = dialog.element.querySelector(".sa-roots");
            if (list) list.innerHTML = rowsHtml();
        });
    }

    async #refresh() {
        const s = await this.library.refresh();
        if (s.aborted) {
            ui.notifications.warn(`Refresh aborted: ${s.reason}`);
            return;
        }
        ui.notifications.info(
            `Library refreshed — added ${s.added}, relinked ${s.relinked}, missing ${s.missing}, auto-tagged ${s.autoTagged ?? 0}.`
        );
        // Call out moved files by name — the relinked count alone doesn't say which.
        if (s.relinked) {
            const names = s.relinkedDetails.map(d => d.name);
            const shown = names.slice(0, 5).join(", ");
            const more = names.length > 5 ? ` (+${names.length - 5} more)` : "";
            ui.notifications.info(`Moved files relinked: ${shown}${more}.`);
        }
    }

    /** Copy a sound's file path to the clipboard. */
    async #copyPath(id) {
        if (!id) return;
        const sound = this.library.getById(id);
        if (!sound?.path) return;
        game.clipboard.copyPlainText(sound.path);
        ui.notifications.info(`Path copied: ${sound.path}`);
    }

    async #removeSound(id) {
        if (!id) return;
        const sound = this.library.getById(id);
        if (!sound) return;
        const choice = await this.#removalDialog("sound", sound.name);
        if (!choice) return;
        if (this.#previewId === id) this.#stopPreview();
        if (choice === "ignore") this.library.ignoreFile(id);
        else this.library.removeSound(id);
        // mutations emit the change hook, which re-renders.
    }

    async #removeFolder(path) {
        if (!path) return;
        const choice = await this.#removalDialog("folder", path);
        if (!choice) return;
        if (choice === "ignore") {
            const n = this.library.ignoreFolder(path);
            ui.notifications.info(`Folder ignored — ${n} sound(s) removed.`);
        } else {
            const n = this.library.removeFolder(path);
            ui.notifications.info(`Removed ${n} sound(s) from the library.`);
        }
    }

    async #restoreFolder(path) {
        if (!path) return;
        this.library.unignoreFolder(path);
        const s = await this.library.refresh(); // re-import its files now that it's allowed
        ui.notifications.info(`Folder restored — ${s.added ?? 0} sound(s) re-imported.`);
    }

    async #restoreFile(path) {
        if (!path) return;
        this.library.unignoreFile(path);
        const s = await this.library.refresh();
        ui.notifications.info(`File restored — ${s.added ?? 0} re-imported.`);
    }

    /**
     * Ask how to remove a folder/sound.
     * @returns {Promise<"ignore"|"remove"|null>}
     */
    async #removalDialog(type, name) {
        const label = type === "folder" ? "folder" : "sound";
        try {
            const result = await foundry.applications.api.DialogV2.wait({
                window: { title: `Remove ${label}` },
                content: `<p>Remove <b>${foundry.utils.escapeHTML(String(name))}</b>?</p>
                    <p style="opacity:.8;font-size:.85em">
                    <b>Ignore</b> keeps it marked (in red) and prevents it from being re-imported.<br>
                    <b>Just remove</b> deletes it from the library, but it may return on the next import/refresh.<br>
                    Files on disk are never touched.</p>`,
                buttons: [
                    { action: "ignore", label: "Ignore (keep marked)", icon: "fas fa-ban" },
                    { action: "remove", label: "Just remove", icon: "fas fa-trash" },
                    { action: "cancel", label: "Cancel", icon: "fas fa-xmark" }
                ],
                rejectClose: false
            });
            return (!result || result === "cancel") ? null : result;
        } catch {
            return null;
        }
    }

    /** Turn a sound's name into an inline text input to rename it. */
    #startRename(nameEl) {
        const id = nameEl.closest("[data-id]")?.dataset.id;
        const sound = this.library.getById(id);
        if (!sound) return;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "sa-lib-edit";
        input.value = sound.name;
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        let done = false;
        const commit = () => {
            if (done) return;
            done = true;
            const v = input.value.trim();
            if (v && v !== sound.name) this.library.renameSound(id, v); // re-renders via hook
            else this.render(false);
        };
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); done = true; this.render(false); }
        });
        input.addEventListener("blur", commit);
    }

    /** Replace the "+" button with an inline input to add a tag to a sound. */
    #startAddTag(btn) {
        const id = btn.closest("[data-id]")?.dataset.id;
        if (!id) return;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "sa-lib-edit sa-lib-edit--tag";
        input.placeholder = "tag…";
        btn.replaceWith(input);
        input.focus();

        let done = false;
        const commit = () => {
            if (done) return;
            done = true;
            const v = input.value.trim();
            if (v) this.library.addTag(id, v); // re-renders via hook
            else this.render(false);
        };
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); done = true; this.render(false); }
        });
        input.addEventListener("blur", commit);
    }

    async #cleanMissing() {
        const groups = this.library.getMissing();
        const total = groups.duplicate.length + groups.ambiguous.length + groups.gone.length;
        if (!total) return;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Clean missing sounds" },
            content: `<p>Remove <b>${total}</b> missing sound(s) from the library?</p>
                <p style="opacity:.8">${groups.gone.length} gone, ${groups.duplicate.length} duplicate, ${groups.ambiguous.length} ambiguous. Files on disk are not touched.</p>`,
            rejectClose: false,
            modal: true
        });
        if (!ok) return;
        const n = this.library.removeMissing();
        ui.notifications.info(`Removed ${n} missing sound(s).`);
    }

    /** Toggle preview: play the sound, or stop it if it (or another) is playing. */
    async #togglePreview(id) {
        if (!id) return;
        // Clicking the one that's already playing stops it.
        if (this.#previewId === id) return this.#stopPreview();
        // Otherwise stop whatever was playing and start this one.
        this.#stopPreview();

        const sound = this.library.getById(id);
        if (!sound) return;
        try {
            const playing = await foundry.audio.AudioHelper.play(
                { src: sound.path, volume: this.#volume, loop: false, autoplay: true },
                false
            );
            this.#preview = playing;
            this.#previewId = id;
            this.#setPlayIcon(id, "stop");
            // The sound is loaded now, so its duration is free to record.
            if (sound.duration === null && Number.isFinite(playing.duration)) this.library.setDuration(id, playing.duration);
            const revert = () => { if (this.#previewId === id) this.#stopPreview(); };
            playing.addEventListener("end", revert);
            playing.addEventListener("stop", revert);
        } catch (err) {
            ui.notifications.warn(`Could not preview ${sound.name}.`);
            console.warn("SoundLibrary | preview failed:", err);
        }
    }

    /** Set the global preview volume; applies live to a sound already playing. */
    #onVolume(value) {
        const v = Math.min(Math.max(parseFloat(value) || 0, 0), 1);
        this.#volume = v;
        localStorage.setItem(LS_VOLUME, String(v));
        try { this.#preview?.fade(v, { duration: 50 }); } catch { /* not fadeable */ }
    }

    #stopPreview() {
        try { this.#preview?.stop(); } catch { /* already stopped */ }
        if (this.#previewId) this.#setPlayIcon(this.#previewId, "play");
        this.#preview = null;
        this.#previewId = null;
    }

    /** Swap a row's play button icon between play and stop (works in list and tree). */
    #setPlayIcon(id, kind) {
        const icons = this.element?.querySelectorAll(`[data-id="${id}"] [data-action="preview"] i`);
        icons?.forEach(i => { i.className = kind === "stop" ? "fas fa-stop" : "fas fa-play"; });
    }

    /**
     * Render only the list rows currently in view (windowing). Rows are absolutely
     * positioned inside a full-height sizer; a translateY offsets the rendered slice.
     */
    #renderListWindow() {
        const container = this.element?.querySelector(".sa-lib-list");
        const rowsEl = container?.querySelector(".sa-vlist__rows");
        if (!container || !rowsEl || !this.#itemTpl) return;

        const data = this.#listData;
        const total = data.length;
        const viewport = container.clientHeight || 1;
        const start = Math.max(0, Math.floor(container.scrollTop / ROW_HEIGHT) - OVERSCAN);
        const count = Math.ceil(viewport / ROW_HEIGHT) + OVERSCAN * 2;
        const end = Math.min(total, start + count);

        let html = "";
        for (let i = start; i < end; i++) {
            data[i].selected = this.#selected.has(data[i].id);
            html += this.#itemTpl(data[i]);
        }
        rowsEl.style.transform = `translateY(${start * ROW_HEIGHT}px)`;
        rowsEl.innerHTML = html;

        if (this.#previewId) this.#setPlayIcon(this.#previewId, "stop");
    }

    /** Show the active tab's content and mark the active tab button. */
    #applyTab() {
        const root = this.element;
        if (!root) return;
        const tab = this.#activeTab;
        const general = tab === "general";
        // Synonyms and Tutorial are full-width panes (no tag panel / toolbar).
        const fullWidth = tab === "synonyms" || tab === "tutorial";
        root.querySelector(".sa-lib-list")?.toggleAttribute("hidden", tab !== "general");
        root.querySelector(".sa-lib-tree")?.toggleAttribute("hidden", tab !== "folders");
        root.querySelector(".sa-lib-synonyms")?.toggleAttribute("hidden", tab !== "synonyms");
        root.querySelector(".sa-lib-tutorial")?.toggleAttribute("hidden", tab !== "tutorial");
        root.querySelector(".sa-lib-tagpanel")?.toggleAttribute("hidden", fullWidth);
        root.querySelector(".sa-lib-toolbar")?.toggleAttribute("hidden", fullWidth);
        root.querySelectorAll(".sa-lib-tab").forEach(b =>
            b.classList.toggle("is-active", b.dataset.tab === this.#activeTab)
        );
        // A virtualized pane may have been measured at height 0 while hidden —
        // repaint whichever one just became visible.
        if (general) this.#renderListWindow();
        else if (tab === "folders") this.#renderTreeWindow();
    }

    /** Rebuild the full flat tree from the current filtered set, if marked dirty. */
    #rebuildTreeIfDirty() {
        if (!this.#treeDirty) return;
        this.#treeData = this.#buildTree(this.#filteredSounds, this.#showIgnored);
        this.#treeDirty = false;
        this.#recomputeTreeVisible();
    }

    /** Recompute which tree rows are visible given the current collapse state. */
    #recomputeTreeVisible() {
        const collapsed = [...this.#collapsed];
        const isHidden = (path, isDir) =>
            collapsed.some(c => path.startsWith(c + "/") || (!isDir && path === c));
        this.#treeVisible = this.#treeData.filter(r => !isHidden(r.path, r.isDir));
    }

    /**
     * Render only the tree rows currently in view (windowing). Mirrors
     * #renderListWindow: rows are absolutely positioned inside a full-height sizer,
     * offset by translateY. Without this a 16k-sound library would put every row in
     * the DOM at once (hundreds of MB of nodes).
     */
    #renderTreeWindow() {
        const scroller = this.element?.querySelector(".sa-vtree");
        const sizer = scroller?.querySelector(".sa-vtree__sizer");
        const rowsEl = scroller?.querySelector(".sa-vtree__rows");
        if (!scroller || !rowsEl || !this.#treeTpl) return;

        this.#rebuildTreeIfDirty();
        const data = this.#treeVisible;
        const total = data.length;
        if (sizer) sizer.style.height = `${total * TREE_ROW_HEIGHT}px`;

        if (total === 0) {
            rowsEl.style.transform = "translateY(0)";
            rowsEl.innerHTML = `<div class="sa-lib-empty">No sounds. Use “Import” to add your audio library.</div>`;
            return;
        }

        const viewport = scroller.clientHeight || 1;
        const start = Math.max(0, Math.floor(scroller.scrollTop / TREE_ROW_HEIGHT) - OVERSCAN);
        const count = Math.ceil(viewport / TREE_ROW_HEIGHT) + OVERSCAN * 2;
        const end = Math.min(total, start + count);

        let html = "";
        for (let i = start; i < end; i++) {
            const row = data[i];
            // Chevron direction comes from the live collapse set (toggles don't rebuild).
            if (row.isDir && !row.ignored) row.collapsed = this.#collapsed.has(row.path);
            html += this.#treeTpl(row);
        }
        rowsEl.style.transform = `translateY(${start * TREE_ROW_HEIGHT}px)`;
        rowsEl.innerHTML = html;

        if (this.#previewId) this.#setPlayIcon(this.#previewId, "stop");
    }

    /**
     * Build a flat, depth-indented list of rows representing the folder tree of
     * every sound's path. Directories first (alphabetical) with a file count,
     * then files. Flattening avoids Handlebars partial recursion.
     */
    #buildTree(sounds, showIgnored = false) {
        const newNode = (name) => ({ name, dirs: new Map(), files: [], ignoredFiles: [], ignored: false });
        const root = newNode("");
        const ensure = (segs) => {
            let node = root;
            for (const seg of segs) {
                if (!node.dirs.has(seg)) node.dirs.set(seg, newNode(seg));
                node = node.dirs.get(seg);
            }
            return node;
        };

        for (const s of sounds) {
            const segs = decodeURIComponent(s.path).split("/").filter(Boolean);
            segs.pop(); // drop the filename
            ensure(segs).files.push(s);
        }
        // Ignored markers are hidden by default; shown only via "Show ignored".
        if (showIgnored) {
            for (const folder of this.library.getIgnoredFolders()) {
                ensure(decodeURIComponent(folder).split("/").filter(Boolean)).ignored = true;
            }
            for (const fpath of this.library.getIgnoredFiles()) {
                const segs = decodeURIComponent(fpath).split("/").filter(Boolean);
                const name = segs.pop();
                ensure(segs).ignoredFiles.push({ name, fullPath: fpath });
            }
        }

        const countFiles = (node) => {
            let n = node.files.length;
            for (const d of node.dirs.values()) n += countFiles(d);
            return n;
        };

        const rows = [];
        const walk = (node, depth, prefix) => {
            const indent = 8 + depth * 14;
            for (const d of [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
                const path = prefix ? `${prefix}/${d.name}` : d.name;
                if (d.ignored) {
                    rows.push({ isDir: true, ignored: true, name: d.name, indent, path });
                    continue; // ignored folder is a leaf marker
                }
                rows.push({ isDir: true, name: d.name, count: countFiles(d), indent, path, collapsed: this.#collapsed.has(path) });
                walk(d, depth + 1, path);
            }
            for (const f of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
                rows.push({ isDir: false, id: f.id, name: f.name, duration: formatDuration(f.duration), favorite: f.favorite, missing: f.missing, missingReason: f.missingReason, indent, path: prefix });
            }
            for (const f of node.ignoredFiles.sort((a, b) => a.name.localeCompare(b.name))) {
                rows.push({ isDir: false, ignored: true, name: f.name, fullPath: f.fullPath, indent, path: prefix });
            }
        };
        walk(root, 0, "");
        return rows;
    }
}
