import * as identification from './app/initialization/identification';
var socketIO = require('socket.io-client');

let socket = socketIO.connect(window.location.host + '/log');

export function debug(message) {
  log('debug', message);
  console.log(message);
}

export function verbose(message) {
  log('verbose', message);
  console.log(message);
}

export function info(message) {
  log('info', message);
  console.info(message);
}

export function warn(message) {
  log('warn', message);
  console.warn(message);
}

export function error(message) {
  log('error', message);
  console.error(message);
}

export function log(level, message) {
  if (! identification.getDevice().id )
    return;
  socket.emit('log', {
    level: level,
    message: message,
    clientId: identification.getDevice().id,
    timestamp: (new Date()).getTime()
  })
}

window.onerror = function(msg, source, line, coloumn, error) {
  source = source.replace(window.location.origin, "");
  log('error', msg + ' (' + source + ':' + line + ':' + coloumn + ')');
};

