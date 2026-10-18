import constants from './constants.mjs';

function getCallerInfo() {
    const err = new Error();
    const stackArray = err.stack.split('\n').map(line => line.trim());
  
    // Adjust index based on how deep you are in the call stack
    const stack = stackArray[2]; // This might need adjustment based on your environment
    const match = stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || stack.match(/at\s+(.*):(\d+):(\d+)/);
  
    if (match) {
        const filename = match[2] || match[1];
        const pattern = /http:\/\/.*\/modules\/soundscape-adventure\//;

      return {
        functionName: match[1],
        filename: filename.replace(pattern, ''),
        line: match[3],
        column: match[4]
      };
    }
  
    return null;
}

function log(info, message, level = constants.LOGLEVEL.INFO, error = "") {
    const init_message = "Soundscape-Adventure";
    const log_enabled = game.settings.get('soundscape-adventure', 'enable-logs');

    if (log_enabled || level == constants.LOGLEVEL.ERROR) {
        switch (level) {
            case constants.LOGLEVEL.ERROR:
                console.error(`(${init_message}) Filename: (${info.filename}):${info.line}`, message, error);
                break;
            case constants.LOGLEVEL.WARN:
                console.warn(`(${init_message}) Filename: (${info.filename}):${info.line}`, message, error);
                break;
            case constants.LOGLEVEL.INFO:
            default:
                console.info(`(${init_message}) Filename: ${info.filename}:${info.line}`, message, error);
        }
    }
}

function randomWaitTime(_from, _to) {
    const from = _from * 1000; 
    const to = _to * 1000;
    return Math.floor(Math.random() * (to - from + 1) + from)
}

/**
 * Keep the filled part of `input.sadv` range tracks in step with their value
 * (exposed to CSS as --sa-fill).
 * @param {HTMLElement} root
 */
function syncRangeFill(root) {
    root?.querySelectorAll('input[type="range"].sadv').forEach(input => {
        const update = () => {
            const min = Number(input.min) || 0;
            const max = Number(input.max) || 100;
            const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
            input.style.setProperty('--sa-fill', `${pct}%`);
        };
        update();
        input.addEventListener('input', update);
    });
}

export default {
    log,
    randomWaitTime,
    getCallerInfo,
    syncRangeFill
};