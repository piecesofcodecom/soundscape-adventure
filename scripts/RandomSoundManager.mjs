import utils from './utils/utils.mjs';
import constants from './utils/constants.mjs';

export class RandomSoundManager {
  constructor() {
    this.jobs = new Map();
  }

  _makeKey(playlistId, soundKey) {
    return `${playlistId}-${soundKey}`;
  }

  _getRandomDelay(from, to) {
    const num_random = Math.random();
    utils.log(utils.getCallerInfo(),`Random time from ${from} to ${to}: ${num_random}`, constants.LOGLEVEL.INFO);
    const minCeiled = Math.ceil(from);
    const maxFloored = Math.floor(to);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled) * 1000;
    //return delay;
  }

  _getRandomIndexExcluding(max, excludeIndex) {
    if (max <= 1) return 0;
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * max);
    } while (newIndex === excludeIndex);
    return newIndex;
  }

  async _playSound(playlistId, soundKey) {
    const key = this._makeKey(playlistId, soundKey);
    const job = this.jobs.get(key);
    if (!job) return;
    const { from, to, volume, playOnce, soundIds, lastPlayedIndex } = job.config;
    const playlist = game.playlists.get(playlistId);
    if (!playlist) return;

    let nextSoundId;
    let nextIndex = 0;

    if (Array.isArray(soundIds)) {
      nextIndex = this._getRandomIndexExcluding(soundIds.length, lastPlayedIndex);
      nextSoundId = soundIds[nextIndex];
      job.config.lastPlayedIndex = nextIndex;
    } else {
      nextSoundId = soundIds;
    }

    const playlistSound = playlist.sounds.get(nextSoundId);
    if (!playlistSound) return;

    // Play the sound

    await playlistSound.update({ volume: parseFloat(volume) })
    await playlist.playSound(playlistSound);

    // Wait for the internal Sound instance to be ready
    const audioSound = playlistSound.sound;
    if (!audioSound) {
      // Fallback to polling
      await this._waitForSoundToStop(playlistSound);
    } else {
      // Wait for the "end" event
      await new Promise(resolve => {
        const done = () => {
          audioSound.removeEventListener('end', done);
          resolve();
        };
        audioSound.addEventListener('end', done);
      });
    }

    if (playOnce) {
      
      this.stop(playlistId, soundKey);
    } else {
      const delay = this._getRandomDelay(from, to);
      
      const timeoutId = setTimeout(() => this._playSound(playlistId, soundKey), delay);
      job.timeoutId = timeoutId;
    }
  }


  /**
   * Inicia um som ou grupo de sons aleatórios.
   * @param {string} playlistId 
   * @param {string|string[]} soundIds 
   * @param {number} from 
   * @param {number} to 
   * @param {number} volume 
   * @param {boolean} playOnce 
   */
  start(playlistId, soundIds, from, to, volume = 1.0, playOnce = false) {
    const isGroup = Array.isArray(soundIds);
    const soundKey = isGroup ? soundIds.join(',') : soundIds;
    const key = this._makeKey(playlistId, soundKey);
    if (isGroup && this.jobs.has(key)) {
      return;
    }
    this.stop(playlistId, soundKey);

    const config = {
      from, to, volume, playOnce,
      soundIds,
      lastPlayedIndex: -1
    };

    const delay = this._getRandomDelay(from, to);
    const timeoutId = setTimeout(() => this._playSound(playlistId, soundKey), delay);

    this.jobs.set(key, { timeoutId, config });

    

  }

  stop(playlistId, soundKeyOrId) {
    const isGroup = Array.isArray(soundKeyOrId);
    const key = this._makeKey(playlistId, soundKeyOrId);
    const job = this.jobs.get(key);
    
    if (job) {
      const { from, to, volume, playOnce, soundIds, lastPlayedIndex } = job.config;
      clearTimeout(job.timeoutId);
      this.jobs.delete(key);
      const playlist = game.playlists.get(playlistId);
      if (!isGroup) {
        const playlistSound = playlist.sounds.get(soundIds); 
        playlist.stopSound(playlistSound);
        
      } else {
        soundIds.forEach(element => {
          const playlistSound = playlist.sounds.get(element); 
        playlist.stopSound(playlistSound);
          
        });
      }
      
    }
  }

  stopAll() {
    for (const { timeoutId } of this.jobs.values()) {
      clearTimeout(timeoutId);
    }
    this.jobs.clear();
  }
}
