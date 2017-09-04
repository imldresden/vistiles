import * as express from 'express';
import * as conf from 'nconf';
export let debugRouter = express.Router();

//provides device list and reroutes to debug.pug
debugRouter.get('/', function (req, res, next) {

  var os = require('os');

  var interfaces = os.networkInterfaces();
  var addresses = [];
  for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
      var address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }

  res.render(
    'debug',
    {
      name: conf.get('strings:name'),
      ipAddress: addresses,
      port: conf.get('system:http:localPort'),
      strings: conf.get('strings:views:debug')
    });
});
