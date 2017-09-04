/**
 * Created by Tom Horak on 01.03.16.
 */

import * as conf from "nconf";
// Use standard nodejs import as typescript definitions seems not to be complete for winston
let winston = require('winston');

let formatter = function (options) {
  let prefix = options.timestamp();
  prefix += ' ' + options.level.toUpperCase();
  let msg = undefined !== options.message ? options.message : '';
  msg += options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '';

  return winston.config.colorize(options.level, prefix) + ' ' + msg;
};

export let log = new winston.Logger({
  transports: [
    new (winston.transports.Console)({
      timestamp: function () {
        return new Date().toLocaleTimeString();
      },
      formatter: formatter
    })
  ]
});

log.transports.console.colorize = true;
log.transports.console.level = conf.get('app:logging:serverLevel');

// Create a stream for passing messages to winston (used by morgan)
log.stream = {
  write: function (message, encoding) {
    // Replace statement filters line breaks (\n)
    log.verbose(message.replace(/(\r\n|\n|\r)/gm, ""));
  }
};

let clientFormatter = function (options) {
  let prefix = options.timestamp(options.meta.timestamp);
  prefix += ' ' + options.meta.clientId.split('-')[0].toUpperCase();
  prefix += ':' + options.level.toUpperCase();
  let msg = undefined !== options.message ? options.message : '';
  msg += options.meta && Object.keys(options.meta).length > 2 ? '\n\t' + JSON.stringify(options.meta) : '';

  return winston.config.colorize(options.level, prefix) + ' ' + msg;
};

let clientLog = new winston.Logger({
  transports: [
    new (winston.transports.Console)({
      timestamp: function (time) {
        return new Date(time).toLocaleTimeString();
      },
      formatter: clientFormatter
    })
  ]
});

clientLog.transports.console.colorize = true;
clientLog.transports.console.level = conf.get('app:logging:clientLevel');

log.clientStream = {
  write: function (clientId, level, timestamp, message) {
    if (conf.get('app:logging:streamClientLog'))
      clientLog.log(level, message, { clientId: clientId, timestamp: timestamp });
  }
};

export default log;