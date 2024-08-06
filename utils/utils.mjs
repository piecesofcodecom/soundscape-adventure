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
    if (log_enabled) {
        switch (level) {
            case constants.LOGLEVEL.ERROR:
                console.error(`(${init_message}) Filename: (${info.filename}), Line: ${info.line}, Column: ${info.column}`, message, error);
                break;
            case constants.LOGLEVEL.WARN:
                console.warn(`(${init_message}) Filename: ${info.filename}, Line: ${info.line}, Column: ${info.column}`, message, error);
                break;
            case constants.LOGLEVEL.INFO:
            default:
                console.info(`(${init_message}) Filename: ${info.filename}, Line: ${info.line}, Column: ${info.column}`, message, error);
        }
    }
}

function randomWaitTime() {
    //const from = 1000; // 1 sec 
    const from = 10000; // 10 sec 
    const to = 60000; // 60 sec
    return from;
    return Math.floor(Math.random() * (to - from + 1) + from)
}

export default {
    log,
    randomWaitTime,
    getCallerInfo
};