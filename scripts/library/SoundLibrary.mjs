import { LibraryStore } from "./LibraryStore.mjs";

/**
 * SoundLibrary — global, world-independent source of truth for sounds.
 *
 * Each sound has a stable global id (foundry.utils.randomID(16)) generated once
 * per file path. The persisted shape is deliberately simple (a flat list); fast
 * lookups are served by in-memory indexes that are rebuilt on load and kept in
 * sync on every mutation.
 *
 * Phase 1: this class is fully standalone — nothing in the existing soundscape
 * runtime depends on it, and it depends on nothing from it. Integration with
 * soundscapes happens in Phase 2.
 */

const SCHEMA_VERSION = 1;
const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|flac|opus|webm)$/i;
const SAVE_DEBOUNCE_MS = 750;
const PROBE_CONCURRENCY = 6;      // parallel metadata reads (browser per-host connection limit)
const PROBE_TIMEOUT_MS = 15000;   // give up on a file that never reports its metadata
const PROBE_FLUSH_EVERY = 500;    // persist progress periodically during a long scan

/** Fired whenever the library's data changes, so the UI can re-render. */
export const HOOK_LIBRARY_UPDATED = "SoundscapeAdventure-Library-Updated";
/** Fired while durations are being measured: (library, {done, total, running}). */
export const HOOK_LIBRARY_PROGRESS = "SoundscapeAdventure-Library-Progress";

export class SoundLibrary {
    constructor({ store } = {}) {
        this.store = store ?? new LibraryStore();
        this.version = SCHEMA_VERSION;
        this.name = "Sound Library";

        /** @type {Set<string>} folders that have been imported — searched when auto-relinking. */
        this.roots = new Set();
        /** @type {Set<string>} folders marked ignored — kept as a marker, never re-imported. */
        this.ignoredFolders = new Set();
        /** @type {Set<string>} file paths marked ignored — kept as a marker, never re-imported. */
        this.ignoredFiles = new Set();

        /** @type {Map<string, object>} id -> sound */
        this._byId = new Map();
        /** @type {Map<string, object>} path -> sound */
        this._byPath = new Map();
        /** @type {Map<string, Set<string>>} tag -> set of sound ids */
        this._tagIndex = new Map();
        /** @type {Map<string, Set<string>>} file name (name+ext, lowercased) -> set of sound ids */
        this._nameIndex = new Map();

        /** @type {Object<string,string[]>} canonical tag -> synonyms (user-curated thesaurus). */
        this.synonyms = {};
        /** @type {Map<string,string>} any term (canonical or synonym) -> canonical. */
        this._synIndex = new Map();

        // Debounced-save bookkeeping.
        this._saveTimer = null;
        this._dirty = false;
        this._saving = false;
        this._pendingSave = false;

        // When true, per-mutation change events are suppressed (bulk ops emit once).
        this._suppressEvents = false;

        /** Running duration scan, or null. @type {{done:number,total:number,cancelled:boolean}|null} */
        this._durationJob = null;
        this._durationPromise = null;
        /** Paths whose duration could not be read this session (not retried until reload). */
        this._durationFailed = new Set();
    }

    /** Fire the "library updated" hook unless we're inside a bulk operation. */
    _emitChange() {
        if (this._suppressEvents) return;
        Hooks.callAll(HOOK_LIBRARY_UPDATED, this);
    }

    /** All sounds as a plain array (insertion order). */
    get sounds() {
        return Array.from(this._byId.values());
    }

    get size() {
        return this._byId.size;
    }

    /** Serializable representation persisted to disk. */
    toJSON() {
        return {
            version: this.version,
            name: this.name,
            roots: [...this.roots],
            ignoredFolders: [...this.ignoredFolders],
            ignoredFiles: [...this.ignoredFiles],
            synonyms: this.synonyms,
            sounds: this.sounds.map(s => ({
                id: s.id,
                name: s.name,
                path: s.path,
                tags: s.tags,
                autoTags: s.autoTags,
                addedAt: s.addedAt,
                favorite: s.favorite,
                hash: s.hash,
                missing: s.missing,
                missingReason: s.missingReason,
                duration: s.duration
            }))
        };
    }

    // ---------------------------------------------------------------- load/save

    /** Load the library from disk and (re)build the in-memory indexes. */
    async load() {
        this._loadData(await this.store.read());
        return this;
    }

    /**
     * Restore the library from its backup file (library.bak.json) and persist it
     * as the current file. Use to recover from an accidental wipe.
     * @returns {Promise<boolean>} true if a backup existed and was restored.
     */
    async restoreFromBackup() {
        const data = await this.store.readBackup();
        if (!data) {
            console.warn("SoundLibrary | no backup found to restore.");
            return false;
        }
        this._loadData(data);
        this._dirty = true;
        await this.flush();
        this._emitChange();
        console.log(`SoundLibrary | restored ${this.size} sound(s) from backup.`);
        return true;
    }

    /** Rebuild all in-memory state from a parsed library object (or empty if null). */
    _loadData(data) {
        this._byId.clear();
        this._byPath.clear();
        this._tagIndex.clear();
        this._nameIndex.clear();
        this.roots = new Set();
        this.ignoredFolders = new Set();
        this.ignoredFiles = new Set();
        this.synonyms = {};

        if (!data) { this._rebuildSynIndex(); return; } // empty; created on first save.

        this.name = data.name ?? this.name;
        if (data.synonyms && typeof data.synonyms === "object") {
            for (const [canon, list] of Object.entries(data.synonyms)) {
                const c = this._normTag(canon);
                if (c && Array.isArray(list)) this.synonyms[c] = this._cleanTags(list).filter(s => s !== c);
            }
        }
        this._rebuildSynIndex();
        if (Array.isArray(data.roots)) {
            for (const r of data.roots) this.roots.add(this._normalizeDir(r));
        }
        if (Array.isArray(data.ignoredFolders)) {
            for (const f of data.ignoredFolders) this.ignoredFolders.add(this._normalizeDir(f));
        }
        if (Array.isArray(data.ignoredFiles)) {
            for (const f of data.ignoredFiles) this.ignoredFiles.add(f);
        }
        const list = Array.isArray(data.sounds) ? data.sounds : [];
        for (const raw of list) {
            const sound = this._normalize(raw);
            if (!sound) continue;
            this._index(sound);
        }
    }

    /** Request a debounced save and signal the change (unless in a bulk op). */
    save() {
        this._dirty = true;
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
        this._emitChange();
    }

    /** Force any pending write to disk now. Writes are serialized to avoid corruption. */
    async flush() {
        clearTimeout(this._saveTimer);
        if (!this._dirty) return;
        if (this._saving) {
            this._pendingSave = true;
            return;
        }
        this._saving = true;
        this._dirty = false;
        try {
            await this.store.write(this.toJSON());
        } catch (err) {
            console.error("SoundLibrary | save failed:", err);
            this._dirty = true; // keep the data marked dirty so a retry can pick it up
        } finally {
            this._saving = false;
            if (this._pendingSave) {
                this._pendingSave = false;
                this.save();
            }
        }
    }

    // ------------------------------------------------------------------ queries

    getById(id) {
        return this._byId.get(id) ?? null;
    }

    findByPath(path) {
        return this._byPath.get(path) ?? null;
    }

    /**
     * IDs of sounds whose name contains the given word. Names are tokenized by
     * treating ANY non-letter as a separator (after URL-decoding), so "wind"
     * matches "wind.mp3", "wind-test", "wind_test", "wind%2Ctest". This is a
     * whole-word match: glued names like "windstrong" / "windStrong" do NOT match
     * (camelCase isn't split — it's unreliable, e.g. "WinDstrong").
     */
    findByNameWord(keyword) {
        const terms = new Set(this.expandTerm(keyword));
        if (!terms.size) return [];
        return this.sounds
            .filter(s => this._nameTokens(s.name).some(t => terms.has(t)))
            .map(s => s.id);
    }

    // ------------------------------------------------------------- synonyms

    /** All synonym groups, sorted by canonical tag — for the Synonyms admin view. */
    getSynonymGroups() {
        return Object.entries(this.synonyms)
            .map(([canonical, synonyms]) => ({ canonical, synonyms: [...synonyms] }))
            .sort((a, b) => a.canonical.localeCompare(b.canonical));
    }

    /** Synonyms of a tag (the rest of its group). */
    getSynonyms(tag) {
        const canon = this._canonical(tag);
        return [...(this.synonyms[canon] ?? [])];
    }

    /** Every equivalent term for a word: itself + its synonym group. */
    expandTerm(word) {
        const w = this._normTag(word);
        if (!w) return [];
        const canon = this._synIndex.get(w) ?? w;
        return [...new Set([w, canon, ...(this.synonyms[canon] ?? [])])];
    }

    /**
     * Replace the synonym list of a (canonical) tag. An empty list is kept (not
     * deleted): it declares a brand-new umbrella tag you can attach synonyms to
     * later. Use deleteSynonymGroup() to remove a group entirely.
     */
    setSynonyms(tag, list) {
        const canon = this._normTag(tag);
        if (!canon) return;
        this.synonyms[canon] = this._cleanTags(list).filter(s => s !== canon);
        this._rebuildSynIndex();
        this.save();
    }

    /** Remove a synonym group / umbrella tag entirely. */
    deleteSynonymGroup(tag) {
        const canon = this._canonical(tag);
        if (!(canon in this.synonyms)) return;
        delete this.synonyms[canon];
        this._rebuildSynIndex();
        this.save();
    }

    addSynonym(tag, syn) {
        const canon = this._normTag(tag);
        const s = this._normTag(syn);
        if (!canon || !s || s === canon) return;
        const list = this.synonyms[canon] ?? [];
        if (!list.includes(s)) { list.push(s); this.synonyms[canon] = list; this._rebuildSynIndex(); this.save(); }
    }

    removeSynonym(tag, syn) {
        const canon = this._canonical(tag);
        const s = this._normTag(syn);
        const list = this.synonyms[canon];
        if (!list) return;
        // Keep the (now possibly empty) umbrella tag; delete it explicitly via
        // deleteSynonymGroup / the group's trash button.
        this.synonyms[canon] = list.filter(x => x !== s);
        this._rebuildSynIndex();
        this.save();
    }

    _canonical(tag) {
        const t = this._normTag(tag);
        return this._synIndex.get(t) ?? t;
    }

    _rebuildSynIndex() {
        this._synIndex = new Map();
        for (const [canon, list] of Object.entries(this.synonyms)) {
            this._synIndex.set(canon, canon);
            for (const s of list) this._synIndex.set(s, canon);
        }
    }

    /** Split a name into lowercase word tokens — every non-letter is a separator. */
    _nameTokens(name) {
        return decodeURIComponent(String(name ?? ""))
            .toLowerCase()
            .split(/[^a-z]+/)
            .filter(Boolean);
    }

    /**
     * Sorted list of all tags: those in use on sounds (tags + autoTags) plus
     * declared "umbrella" tags — canonical synonym tags that may not yet be on
     * any sound (e.g. "passaro" grouping bird/pardal/owl). Umbrella tags are
     * filterable so they can act as generic groupings.
     */
    getAllTags() {
        const set = new Set(this._tagIndex.keys());
        for (const canon of Object.keys(this.synonyms)) set.add(canon);
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }

    /** True if more than one sound shares this path's file name. */
    isDuplicateName(path) {
        const set = this._nameIndex.get(this._fileName(path));
        return !!set && set.size > 1;
    }

    /**
     * Groups of sounds that share the same file name (name + extension).
     * Cheap, name-based duplicate detection (content-hash detection comes later).
     * @returns {Array<{fileName:string, sounds:object[]}>}
     */
    findDuplicateNames() {
        const groups = [];
        for (const [fileName, ids] of this._nameIndex) {
            if (ids.size < 2) continue;
            const sounds = [...ids].map(id => this._byId.get(id)).filter(Boolean);
            groups.push({ fileName, sounds });
        }
        return groups.sort((a, b) => a.fileName.localeCompare(b.fileName));
    }

    /**
     * Groups of sounds with identical content (same SHA-256 hash). Only sounds
     * that have a computed hash are considered — run computeHashes() first.
     * @returns {Array<{hash:string, sounds:object[]}>}
     */
    findDuplicateContent() {
        const byHash = new Map();
        for (const s of this.sounds) {
            if (!s.hash) continue;
            let arr = byHash.get(s.hash);
            if (!arr) { arr = []; byHash.set(s.hash, arr); }
            arr.push(s);
        }
        const groups = [];
        for (const [hash, sounds] of byHash) {
            if (sounds.length > 1) groups.push({ hash, sounds });
        }
        return groups;
    }

    /** How many sounds still need a content hash (present files only). */
    countUnhashed() {
        return this.sounds.filter(s => !s.missing && !s.hash).length;
    }

    /**
     * Compute SHA-256 content hashes for sounds. By default only sounds without a
     * hash are processed (cached afterwards); pass {rehashAll} to recompute all.
     * Reads each file's bytes, so it can be slow — report via onProgress.
     * @param {object} [opts]
     * @param {boolean} [opts.rehashAll]
     * @param {(done:number, total:number)=>void} [opts.onProgress]
     * @returns {Promise<{hashed:number, failed:number}>}
     */
    async computeHashes({ rehashAll = false, onProgress = null } = {}) {
        if (!globalThis.crypto?.subtle) {
            console.warn("SoundLibrary | crypto.subtle unavailable (needs a secure context); cannot hash.");
            return { hashed: 0, failed: 0 };
        }
        const targets = this.sounds.filter(s => !s.missing && (rehashAll || !s.hash));
        let hashed = 0, failed = 0;
        this._suppressEvents = true;
        try {
            for (let i = 0; i < targets.length; i++) {
                const h = await this._hashFile(targets[i].path);
                if (h) { targets[i].hash = h; hashed++; } else { failed++; }
                onProgress?.(i + 1, targets.length);
            }
        } finally {
            this._suppressEvents = false;
        }
        if (hashed) this.save();
        return { hashed, failed };
    }

    async _hashFile(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) return "";
            const buffer = await response.arrayBuffer();
            const digest = await crypto.subtle.digest("SHA-256", buffer);
            return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
        } catch {
            return "";
        }
    }

    // ---------------------------------------------------------------- durations

    /** Sounds that still need a duration (present files not already failed this session). */
    _unmeasured() {
        return this.sounds.filter(s => !s.missing && s.duration === null && !this._durationFailed.has(s.path));
    }

    countUnmeasured() {
        return this._unmeasured().length;
    }

    /** Progress of the running duration scan, or null when idle. */
    get durationProgress() {
        const job = this._durationJob;
        return job ? { done: job.done, total: job.total } : null;
    }

    /** Record a duration learned elsewhere (e.g. from a sound that just played). */
    setDuration(id, seconds) {
        const sound = this._byId.get(id);
        if (!sound || !Number.isFinite(seconds) || seconds < 0) return false;
        const value = Math.round(seconds * 100) / 100;
        if (sound.duration === value) return false;
        sound.duration = value;
        this.save();
        return true;
    }

    /**
     * Measure the duration of every sound that lacks one, reading only the audio
     * metadata (the same `preload="metadata"` probe Foundry's Sound#load starts
     * with — no full download, no decoding). Runs a small worker pool in the
     * background; progress is reported through HOOK_LIBRARY_PROGRESS. Calling it
     * while a scan is running returns that scan's promise.
     * @returns {Promise<{measured:number, failed:number, cancelled:boolean}>}
     */
    measureDurations() {
        if (this._durationPromise) return this._durationPromise;
        const targets = this._unmeasured();
        if (!targets.length) return Promise.resolve({ measured: 0, failed: 0, cancelled: false });

        const job = this._durationJob = { done: 0, total: targets.length, cancelled: false };
        const progress = () => Hooks.callAll(HOOK_LIBRARY_PROGRESS, this, { ...this.durationProgress, running: !!this._durationJob });
        let measured = 0, failed = 0, next = 0;

        const worker = async () => {
            while (!job.cancelled && next < targets.length) {
                const sound = targets[next++];
                const seconds = await this._probeDuration(sound.path);
                if (seconds === null) {
                    this._durationFailed.add(sound.path);
                    failed++;
                } else if (this._byId.get(sound.id) === sound) { // still in the library
                    sound.duration = Math.round(seconds * 100) / 100;
                    this._dirty = true;
                    measured++;
                }
                job.done++;
                if (job.done % PROBE_FLUSH_EVERY === 0) this.flush();
                progress();
            }
        };

        this._durationPromise = (async () => {
            progress();
            try {
                await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, worker));
            } finally {
                this._durationJob = null;
                this._durationPromise = null;
                await this.flush();
                progress();
                if (measured) this._emitChange();
            }
            return { measured, failed, cancelled: job.cancelled };
        })();
        return this._durationPromise;
    }

    /** Stop the running duration scan after the files currently being read. */
    cancelDurations() {
        if (this._durationJob) this._durationJob.cancelled = true;
    }

    /**
     * Read a file's duration from its metadata via a detached <audio> element.
     * @returns {Promise<number|null>} seconds, or null if unreadable.
     */
    _probeDuration(path) {
        return new Promise(resolve => {
            const el = new Audio();
            let timer = null;
            const done = (value) => {
                clearTimeout(timer);
                el.onloadedmetadata = el.onerror = null;
                el.removeAttribute("src");
                el.load(); // abort the request and release the connection
                resolve(value);
            };
            el.preload = "metadata";
            el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
            el.onerror = () => done(null);
            timer = setTimeout(() => done(null), PROBE_TIMEOUT_MS);
            el.src = path;
        });
    }

    /**
     * Search the library.
     * @param {object} [opts]
     * @param {string} [opts.text]        Substring match against name (case-insensitive).
     * @param {string[]} [opts.tags]      Tags to filter by (matched against tags + autoTags).
     * @param {boolean} [opts.matchAll]   If true, a sound must have ALL given tags; otherwise ANY.
     * @param {boolean} [opts.favorite]   If true, only return favorited sounds.
     * @returns {object[]}
     */
    search({ text = "", tags = [], matchAll = true, favorite = false } = {}) {
        let ids = null;

        if (tags.length) {
            // Each requested tag is expanded to its synonym group; a sound matches
            // the tag if it has ANY term in that group (union), then matchAll/any
            // applies across the requested tags.
            const sets = tags.map(t => {
                const union = new Set();
                for (const term of this.expandTerm(t)) {
                    const set = this._tagIndex.get(this._normTag(term));
                    if (set) for (const id of set) union.add(id);
                }
                return union;
            });
            if (matchAll) {
                ids = sets.reduce((acc, set) => {
                    if (acc === null) return new Set(set);
                    return new Set([...acc].filter(id => set.has(id)));
                }, null) ?? new Set();
            } else {
                ids = new Set();
                for (const set of sets) for (const id of set) ids.add(id);
            }
        }

        let results = ids ? [...ids].map(id => this._byId.get(id)).filter(Boolean) : this.sounds;

        if (favorite) results = results.filter(s => s.favorite);

        const needle = text.trim().toLowerCase();
        if (needle) {
            results = results.filter(s => s.name.toLowerCase().includes(needle));
        }
        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    // ---------------------------------------------------------------- mutations

    /**
     * Add a sound. Deduplicates by path: if a sound with the same path already
     * exists, the existing entry is returned unchanged (no new id is generated).
     * @returns {object} The added (or existing) sound.
     */
    addSound({ name, path, tags = [], autoTags = [] }) {
        const existing = this._byPath.get(path);
        if (existing) return existing;

        const sound = this._normalize({
            id: foundry.utils.randomID(16),
            name: name || this._nameFromPath(path),
            path,
            tags,
            autoTags,
            addedAt: Date.now()
        });
        this._index(sound);
        this.save();
        return sound;
    }

    removeSound(id) {
        const sound = this._byId.get(id);
        if (!sound) return false;
        this._unindex(sound);
        this.save();
        return true;
    }

    /** Remove many sounds at once, emitting a single change event. @returns {number} removed */
    removeMany(ids) {
        let n = 0;
        this._suppressEvents = true;
        try {
            for (const id of ids) if (this.removeSound(id)) n++;
        } finally {
            this._suppressEvents = false;
        }
        if (n) this.save();
        return n;
    }

    renameSound(id, name) {
        const sound = this._byId.get(id);
        if (!sound) return null;
        sound.name = String(name ?? "").trim() || sound.name;
        this.save();
        return sound;
    }

    /** Set the favorite flag on many sounds at once. @returns {number} changed */
    setFavoriteMany(ids, value) {
        let n = 0;
        this._suppressEvents = true;
        try {
            for (const id of ids) {
                const s = this._byId.get(id);
                if (s && s.favorite !== (value === true)) { s.favorite = value === true; n++; }
            }
        } finally {
            this._suppressEvents = false;
        }
        if (n) this.save();
        return n;
    }

    /** Toggle (or set) the favorite flag of a sound. @returns {object|null} the sound */
    toggleFavorite(id, value = null) {
        const sound = this._byId.get(id);
        if (!sound) return null;
        sound.favorite = value === null ? !sound.favorite : value === true;
        this.save();
        return sound;
    }

    /** Replace the user tags of a sound (autoTags are managed by import). */
    setTags(id, tags) {
        const sound = this._byId.get(id);
        if (!sound) return null;
        this._unindexTags(sound);
        sound.tags = this._cleanTags(tags);
        this._indexTags(sound);
        this.save();
        return sound;
    }

    /** Add a single user tag to a sound (no-op if already present). */
    addTag(id, tag) {
        const sound = this._byId.get(id);
        if (!sound) return null;
        const t = this._normTag(tag);
        if (!t || sound.tags.includes(t)) return sound;
        return this.setTags(id, [...sound.tags, t]);
    }

    /** Remove a single user tag from a sound. autoTags cannot be removed this way. */
    removeTag(id, tag) {
        const sound = this._byId.get(id);
        if (!sound) return null;
        const t = this._normTag(tag);
        if (!sound.tags.includes(t)) return sound;
        return this.setTags(id, sound.tags.filter(x => x !== t));
    }

    /**
     * Rename a user tag across the whole library.
     * @returns {number} How many sounds were affected.
     */
    renameTag(oldTag, newTag) {
        const from = this._normTag(oldTag);
        const to = this._normTag(newTag);
        if (!from || !to || from === to) return 0;

        const ids = [...(this._tagIndex.get(from) ?? [])];
        let affected = 0;
        for (const id of ids) {
            const sound = this._byId.get(id);
            if (!sound || !sound.tags.includes(from)) continue;
            const next = sound.tags.map(t => (t === from ? to : t));
            this._unindexTags(sound);
            sound.tags = this._cleanTags(next);
            this._indexTags(sound);
            affected++;
        }
        if (affected) this.save();
        return affected;
    }

    /**
     * Remove a user tag from every sound that has it.
     * @returns {number} How many sounds were affected.
     */
    deleteTag(tag) {
        const t = this._normTag(tag);
        const ids = [...(this._tagIndex.get(t) ?? [])];
        let affected = 0;
        for (const id of ids) {
            const sound = this._byId.get(id);
            if (!sound || !sound.tags.includes(t)) continue;
            this._unindexTags(sound);
            sound.tags = sound.tags.filter(x => x !== t);
            this._indexTags(sound);
            affected++;
        }
        if (affected) this.save();
        return affected;
    }

    /** Batch: add a tag to many sounds at once. @returns {number} affected */
    addTagToMany(ids, tag) {
        const t = this._normTag(tag);
        if (!t) return 0;
        let affected = 0;
        for (const id of ids) {
            const sound = this._byId.get(id);
            if (!sound || sound.tags.includes(t)) continue;
            this._unindexTags(sound);
            sound.tags = this._cleanTags([...sound.tags, t]);
            this._indexTags(sound);
            affected++;
        }
        if (affected) this.save();
        return affected;
    }

    /** Batch: remove a tag from many sounds at once. @returns {number} affected */
    removeTagFromMany(ids, tag) {
        const t = this._normTag(tag);
        let affected = 0;
        for (const id of ids) {
            const sound = this._byId.get(id);
            if (!sound || !sound.tags.includes(t)) continue;
            this._unindexTags(sound);
            sound.tags = sound.tags.filter(x => x !== t);
            this._indexTags(sound);
            affected++;
        }
        if (affected) this.save();
        return affected;
    }

    // ------------------------------------------------------------------- import

    /**
     * Import every audio file under a folder into the library.
     * Subfolder names (relative to rootPath) become autoTags. Existing paths are
     * skipped (dedupe). Returns a summary.
     *
     * @param {string} rootPath              Folder to scan (under the data source).
     * @param {object} [opts]
     * @param {boolean} [opts.recursive]     Recurse into subfolders (default true).
     * @returns {Promise<{added:number, skipped:number, scanned:number}>}
     */
    async importFolder(rootPath, { recursive = true } = {}) {
        const root = this._normalizeDir(rootPath);
        this.roots.add(root);
        const summary = { added: 0, skipped: 0, scanned: 0 };
        const queue = [root];
        const FilePicker = foundry.applications.apps.FilePicker;

        this._suppressEvents = true;
        try {
            while (queue.length) {
                const dir = queue.shift();
                let result;
                try {
                    result = await FilePicker.browse(this.store.source, dir);
                } catch (err) {
                    console.warn(`SoundLibrary | browse failed for ${dir}:`, err);
                    continue;
                }

                for (const file of result.files) {
                    if (!AUDIO_EXT.test(file)) continue;
                    summary.scanned++;
                    if (this._byPath.has(file) || this.isIgnored(file)) {
                        summary.skipped++;
                        continue;
                    }
                    this.addSound({
                        name: this._nameFromPath(file),
                        path: file,
                        autoTags: this._autoTagsFor(root, file)
                    });
                    summary.added++;
                }

                if (recursive) {
                    for (const sub of result.dirs) queue.push(sub);
                }
            }
        } finally {
            this._suppressEvents = false;
        }

        await this.flush();
        if (summary.added) this._emitChange();
        return summary;
    }

    /**
     * Full library refresh in a single disk scan: imports new files found under
     * the roots, then reconciles existing entries (auto-relink + classify missing).
     * This is the "Refresh" action the UI exposes — it matches the user's mental
     * model of "re-read the folder".
     *
     * @param {object} [opts]
     * @param {boolean} [opts.autoRelink]   Recover moved files (default true).
     * @param {boolean} [opts.prune]        Remove still-missing sounds (default false).
     * @param {boolean} [opts.force]        Allow a large prune (>50%).
     * @returns {Promise<object>} reconcile summary plus `added`.
     */
    async refresh({ autoRelink = true, prune = false, force = false } = {}) {
        const { paths, byName } = await this._scanRoots();

        // Reconcile FIRST so a moved file is relinked onto its existing entry
        // (keeping the stable libraryId) before we import anything. If we imported
        // first, the moved file's new path would be adopted as a brand-new sound;
        // the original entry would then stay stuck `missing` with a dead path, and
        // any soundscape that references its libraryId would drop the sound on the
        // next consistence() pass. The tradeoff: a genuinely new file that happens
        // to share a name with a missing sound is treated as that sound moving
        // (relinked) rather than a separate entry — the right call for this module,
        // where files move far more often than names collide by accident.
        const summary = this._reconcileScan(paths, byName, { autoRelink, prune, force });

        // Then import whatever is genuinely new — every scanned path not already
        // owned (relink above may have just claimed some of them).
        let added = 0;
        this._suppressEvents = true;
        try {
            for (const path of paths) {
                if (this._byPath.has(path) || this.isIgnored(path)) continue;
                const root = this._rootFor(path);
                this.addSound({
                    name: this._nameFromPath(path),
                    path,
                    autoTags: root ? this._autoTagsFor(root, path) : []
                });
                added++;
            }
        } finally {
            this._suppressEvents = false;
        }
        summary.added = added;
        // Re-apply synonym groups as name-based tag rules (so new/renamed files get
        // tagged, matching the canonical tag OR any of its synonyms).
        summary.autoTagged = this.applySynonymTagsByName();
        await this.flush();
        this._emitChange();
        return summary;
    }

    /**
     * For every synonym group, tag the sounds whose file name contains the
     * canonical word or any synonym with the canonical tag. Idempotent.
     * @returns {number} how many tag assignments were made.
     */
    applySynonymTagsByName() {
        const canons = Object.keys(this.synonyms);
        if (!canons.length) return 0;
        let total = 0;
        this._suppressEvents = true;
        try {
            for (const canon of canons) {
                total += this.addTagToMany(this.findByNameWord(canon), canon);
            }
        } finally {
            this._suppressEvents = false;
        }
        if (total) this.save();
        return total;
    }

    // -------------------------------------------------------------------- roots

    /** Folders searched during auto-relink. */
    getRoots() {
        return [...this.roots];
    }

    /** Register a folder as a search root (without importing its files). */
    addRoot(path) {
        const root = this._normalizeDir(path);
        if (!root || this.roots.has(root)) return false;
        this.roots.add(root);
        this.save();
        return true;
    }

    removeRoot(path) {
        const removed = this.roots.delete(this._normalizeDir(path));
        if (removed) this.save();
        return removed;
    }

    // ------------------------------------------------------------------ ignore

    getIgnoredFolders() { return [...this.ignoredFolders]; }
    getIgnoredFiles() { return [...this.ignoredFiles]; }

    /** True if a path is an ignored file or sits under an ignored folder. */
    isIgnored(path) {
        const p = decodeURIComponent(String(path));
        for (const f of this.ignoredFiles) {
            if (decodeURIComponent(f) === p) return true;
        }
        for (const folder of this.ignoredFolders) {
            const fp = decodeURIComponent(folder);
            if (p === fp || p.startsWith(fp + "/")) return true;
        }
        return false;
    }

    /**
     * Remove every sound under a folder (does NOT ignore — they can return on a
     * future import/refresh). @returns {number} how many were removed.
     */
    removeFolder(folderPath) {
        const prefix = decodeURIComponent(this._normalizeDir(folderPath)) + "/";
        const targets = this.sounds.filter(s => decodeURIComponent(s.path).startsWith(prefix));
        this._suppressEvents = true;
        try {
            for (const s of targets) this.removeSound(s.id);
        } finally {
            this._suppressEvents = false;
        }
        if (targets.length) this.save();
        return targets.length;
    }

    /** Remove a folder's sounds AND mark it ignored so it is never re-imported. */
    ignoreFolder(folderPath) {
        this.ignoredFolders.add(this._normalizeDir(folderPath));
        const n = this.removeFolder(folderPath);
        this.save(); // persist the ignore flag even when nothing was removed
        return n;
    }

    /** Stop ignoring a folder (its files can be re-imported via refresh/import). */
    unignoreFolder(folderPath) {
        const removed = this.ignoredFolders.delete(this._normalizeDir(folderPath));
        if (removed) this.save();
        return removed;
    }

    /** Remove a sound AND mark its path ignored so it is never re-imported. */
    ignoreFile(id) {
        const sound = this._byId.get(id);
        if (!sound) return false;
        this.ignoredFiles.add(sound.path);
        this.removeSound(id); // saves (persists the ignore set too)
        return true;
    }

    /** Ignore many sounds at once (remove + mark their paths ignored). @returns {number} */
    ignoreFilesMany(ids) {
        let n = 0;
        this._suppressEvents = true;
        try {
            for (const id of ids) {
                const s = this._byId.get(id);
                if (!s) continue;
                this.ignoredFiles.add(s.path);
                this.removeSound(id);
                n++;
            }
        } finally {
            this._suppressEvents = false;
        }
        if (n) this.save();
        return n;
    }

    /** Stop ignoring a file path. */
    unignoreFile(path) {
        let removed = this.ignoredFiles.delete(path);
        if (!removed) {
            const p = decodeURIComponent(path);
            for (const f of this.ignoredFiles) {
                if (decodeURIComponent(f) === p) { this.ignoredFiles.delete(f); removed = true; break; }
            }
        }
        if (removed) this.save();
        return removed;
    }

    // ------------------------------------------------------------ reconciliation

    /**
     * Check that every sound's file still exists on disk and flag the ones that
     * don't via `sound.missing`. Does NOT download audio — only HEAD requests.
     *
     * When a file is missing, it tries to find it again automatically by scanning
     * the imported roots for a file with the same name (auto-relink). A unique
     * match is relinked silently; an ambiguous match (same name in several places)
     * is left missing for the user / future content-hash resolution.
     *
     * @param {object} [opts]
     * @param {boolean} [opts.autoRelink]   Search roots to recover moved files (default true).
     * @param {boolean} [opts.prune]        Remove still-missing sounds (default false).
     * @param {boolean} [opts.force]        Allow a large prune (>50% of the library).
     * @returns {Promise<{checked:number, missing:number, recovered:number, relinked:number, ambiguous:number, pruned:number, aborted?:boolean, reason?:string}>}
     */
    async reconcile(opts = {}) {
        const { paths, byName } = await this._scanRoots();
        const summary = this._reconcileScan(paths, byName, opts);
        await this.flush();
        if (!summary.aborted) this._emitChange();
        return summary;
    }

    /**
     * In-memory reconcile against an already-collected scan. Shared by reconcile()
     * and refresh() so the disk is browsed only once. Does not flush or emit —
     * callers handle persistence and events.
     * @returns {object} reconcile summary
     */
    _reconcileScan(paths, byName, { autoRelink = true, prune = false, force = false } = {}) {
        const summary = { checked: 0, missing: 0, recovered: 0, relinked: 0, ambiguous: 0, duplicate: 0, gone: 0, pruned: 0, relinkedDetails: [] };

        // SAFEGUARD 1: an empty scan means the roots are missing/inaccessible, NOT
        // that every sound vanished. Abort instead of flagging the whole library
        // as missing (which a prune would then wipe).
        if (this.size > 0 && paths.size === 0) {
            summary.aborted = true;
            summary.reason = "scan returned no files (roots empty or inaccessible); nothing changed";
            console.warn(`SoundLibrary | reconcile aborted: ${summary.reason}`);
            return summary;
        }

        const missingSounds = [];

        // Pass 1: a sound exists iff its path was found on disk.
        for (const sound of this.sounds) {
            summary.checked++;
            if (paths.has(sound.path)) {
                if (sound.missing) {
                    sound.missing = false;
                    sound.missingReason = "";
                    summary.recovered++;
                }
            } else {
                sound.missing = true;
                missingSounds.push(sound);
            }
        }

        // Pass 2: try to recover each missing sound and classify the rest.
        // Categories (mutually exclusive):
        //  - relinked  : a unique same-named file (not owned by another entry) was found.
        //  - ambiguous : several unowned same-named files exist — can't pick safely.
        //  - duplicate : a same-named file exists but is already owned — this entry is
        //                redundant (e.g. a copy whose file was deleted). Safe to remove.
        //  - gone      : no same-named file anywhere — the sound is truly lost.
        for (const sound of missingSounds) {
            const sameName = byName.get(this._fileName(sound.path)) ?? [];
            const candidates = sameName.filter(p => !this._byPath.has(p));

            if (autoRelink && candidates.length === 1) {
                const from = sound.path;
                this._unindex(sound);
                sound.path = candidates[0];
                sound.missing = false;
                sound.missingReason = "";
                this._index(sound);
                summary.relinked++;
                summary.relinkedDetails.push({ name: sound.name, from, to: sound.path });
            } else if (candidates.length > 1) {
                sound.missingReason = "ambiguous";
                summary.ambiguous++;
            } else if (sameName.length > 0) {
                sound.missingReason = "duplicate";
                summary.duplicate++;
            } else {
                sound.missingReason = "gone";
                summary.gone++;
            }
        }

        // `missing` is the total still flagged missing (duplicate + ambiguous + gone).
        const stillMissing = this.sounds.filter(s => s.missing);
        summary.missing = stillMissing.length;

        if (prune && stillMissing.length) {
            // SAFEGUARD 2: refuse to delete more than half the library in one go
            // unless explicitly forced. Catches "everything looks missing" mistakes.
            const ratio = stillMissing.length / this.size;
            if (ratio > 0.5 && !force) {
                summary.aborted = true;
                summary.reason = `prune skipped: would remove ${stillMissing.length}/${this.size} sounds (>50%); pass {force:true} to confirm`;
                console.warn(`SoundLibrary | ${summary.reason}`);
            } else {
                this._suppressEvents = true;
                try {
                    for (const s of stillMissing) this.removeSound(s.id);
                } finally {
                    this._suppressEvents = false;
                }
                summary.pruned = stillMissing.length;
            }
        }

        return summary;
    }

    /**
     * Browse every imported root recursively (one pass) and return:
     *  - `paths`: a Set of every audio file path currently on disk (canonical form);
     *  - `byName`: a Map of file name (lowercased) -> paths, for auto-relink.
     *
     * This is browse-based on purpose: HEAD requests are unreliable against
     * Foundry's static server (they abort / 404 even when the file exists), so we
     * never use fetch to test existence.
     * @returns {Promise<{paths:Set<string>, byName:Map<string,string[]>}>}
     */
    async _scanRoots() {
        const paths = new Set();
        const byName = new Map();
        const FilePicker = foundry.applications.apps.FilePicker;
        const queue = [...this.roots];
        const visited = new Set();

        while (queue.length) {
            const dir = queue.shift();
            if (visited.has(dir)) continue;
            visited.add(dir);

            let result;
            try {
                result = await FilePicker.browse(this.store.source, dir);
            } catch {
                continue;
            }
            for (const file of result.files) {
                if (!AUDIO_EXT.test(file)) continue;
                paths.add(file);
                const key = this._fileName(file);
                let arr = byName.get(key);
                if (!arr) {
                    arr = [];
                    byName.set(key, arr);
                }
                arr.push(file);
            }
            for (const sub of result.dirs) queue.push(sub);
        }
        return { paths, byName };
    }

    /**
     * Missing sounds grouped by reason (as classified by the last reconcile()).
     * @returns {{duplicate:object[], ambiguous:object[], gone:object[]}}
     */
    getMissing() {
        const groups = { duplicate: [], ambiguous: [], gone: [] };
        for (const sound of this.sounds) {
            if (!sound.missing) continue;
            (groups[sound.missingReason] ?? (groups.gone)).push(sound);
        }
        return groups;
    }

    /**
     * Remove missing sounds, optionally limited to specific reasons.
     * @param {object} [opts]
     * @param {string[]} [opts.reasons]  e.g. ["duplicate"] to only drop redundant
     *                                   copies; omit to remove every missing sound.
     * @returns {number} How many were removed.
     */
    removeMissing({ reasons = null } = {}) {
        const targets = this.sounds.filter(s =>
            s.missing && (!reasons || reasons.includes(s.missingReason))
        );
        for (const s of targets) this.removeSound(s.id);
        return targets.length;
    }

    /**
     * Point an existing sound at a new path (e.g. the file was moved/renamed on
     * disk) while preserving its id, tags and user-edited name. Verifies the new
     * file actually exists before accepting, so it can't silently point a sound
     * at a non-existent path.
     * @param {object} [opts]
     * @param {boolean} [opts.verify]   Check the file exists at newPath (default true).
     * @returns {Promise<object|null>} The updated sound, or null on failure/collision.
     */
    async relink(id, newPath, { verify = true } = {}) {
        const sound = this._byId.get(id);
        if (!sound) {
            console.warn(`SoundLibrary | relink: no sound with id ${id}.`);
            return null;
        }
        if (newPath === sound.path) return sound;
        if (this._byPath.has(newPath)) {
            console.warn(`SoundLibrary | relink: ${newPath} is already in the library.`);
            return null;
        }
        if (verify && !(await this._fileExists(newPath))) {
            console.warn(`SoundLibrary | relink: no file found at ${newPath}; nothing changed.`);
            return null;
        }
        this._unindex(sound);
        sound.path = newPath;
        sound.missing = false;
        this._index(sound);
        this.save();
        return sound;
    }

    /**
     * Check a single file exists by browsing its directory (never HEAD — see
     * _scanRoots). Encoding-tolerant so hand-typed and browsed paths both match.
     */
    async _fileExists(path) {
        const decoded = decodeURIComponent(String(path));
        const slash = decoded.lastIndexOf("/");
        const dir = slash >= 0 ? decoded.slice(0, slash) : "";
        try {
            const result = await foundry.applications.apps.FilePicker.browse(this.store.source, dir);
            return result.files.some(f => decodeURIComponent(f) === decoded);
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------- index utils

    _index(sound) {
        this._byId.set(sound.id, sound);
        this._byPath.set(sound.path, sound);
        this._indexName(sound);
        this._indexTags(sound);
    }

    _unindex(sound) {
        this._byId.delete(sound.id);
        this._byPath.delete(sound.path);
        this._unindexName(sound);
        this._unindexTags(sound);
    }

    _indexName(sound) {
        const key = this._fileName(sound.path);
        let set = this._nameIndex.get(key);
        if (!set) {
            set = new Set();
            this._nameIndex.set(key, set);
        }
        set.add(sound.id);
    }

    _unindexName(sound) {
        const key = this._fileName(sound.path);
        const set = this._nameIndex.get(key);
        if (!set) return;
        set.delete(sound.id);
        if (set.size === 0) this._nameIndex.delete(key);
    }

    _indexTags(sound) {
        for (const tag of this._allTagsOf(sound)) {
            let set = this._tagIndex.get(tag);
            if (!set) {
                set = new Set();
                this._tagIndex.set(tag, set);
            }
            set.add(sound.id);
        }
    }

    _unindexTags(sound) {
        for (const tag of this._allTagsOf(sound)) {
            const set = this._tagIndex.get(tag);
            if (!set) continue;
            set.delete(sound.id);
            if (set.size === 0) this._tagIndex.delete(tag);
        }
    }

    _allTagsOf(sound) {
        return new Set([...sound.tags, ...sound.autoTags]);
    }

    // ------------------------------------------------------------ normalization

    /** Coerce a raw (persisted or input) object into a well-formed sound, or null. */
    _normalize(raw) {
        if (!raw || !raw.path) return null;
        return {
            id: raw.id || foundry.utils.randomID(16),
            name: raw.name || this._nameFromPath(raw.path),
            path: raw.path,
            tags: this._cleanTags(raw.tags),
            autoTags: this._cleanTags(raw.autoTags),
            addedAt: Number.isFinite(raw.addedAt) ? raw.addedAt : Date.now(),
            favorite: raw.favorite === true,
            hash: typeof raw.hash === "string" ? raw.hash : "",
            missing: raw.missing === true,
            missingReason: typeof raw.missingReason === "string" ? raw.missingReason : "",
            // Seconds; null = not measured yet.
            duration: Number.isFinite(raw.duration) && raw.duration >= 0 ? raw.duration : null
        };
    }

    _cleanTags(tags) {
        if (!Array.isArray(tags)) return [];
        const seen = new Set();
        const out = [];
        for (const t of tags) {
            const tag = this._normTag(t);
            if (tag && !seen.has(tag)) {
                seen.add(tag);
                out.push(tag);
            }
        }
        return out;
    }

    _normTag(tag) {
        return String(tag ?? "").trim().toLowerCase();
    }

    _normalizeDir(path) {
        return decodeURIComponent(String(path ?? "")).replace(/\/+$/, "");
    }

    _nameFromPath(path) {
        const file = decodeURIComponent(path).split("/").pop() ?? path;
        return file.replace(AUDIO_EXT, "");
    }

    /** The on-disk file name (name + extension), lowercased — used for name-based dedup. */
    _fileName(path) {
        return (decodeURIComponent(path).split("/").pop() ?? path).toLowerCase();
    }

    /** Find the imported root that contains a given path (longest match), or null. */
    _rootFor(path) {
        const decoded = decodeURIComponent(String(path));
        let best = null;
        for (const root of this.roots) {
            const prefix = decodeURIComponent(root) + "/";
            if (decoded.startsWith(prefix) && (!best || root.length > best.length)) {
                best = root;
            }
        }
        return best;
    }

    /** Folder segments between root and the file become autoTags. */
    _autoTagsFor(root, filePath) {
        const decoded = decodeURIComponent(filePath);
        const rootDecoded = decodeURIComponent(root);
        let rel = decoded;
        if (decoded.startsWith(rootDecoded)) {
            rel = decoded.slice(rootDecoded.length);
        }
        const parts = rel.split("/").filter(Boolean);
        parts.pop(); // drop the filename
        return this._cleanTags(parts);
    }
}
