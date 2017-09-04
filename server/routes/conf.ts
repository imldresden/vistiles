import * as express from 'express';
import * as conf from 'nconf';
export let confRouter = express.Router();

/* GET home page. */
confRouter.get('/', function (req, res, next) {
  var values = {};
  values['app'] = conf.get('app');
  values['deviceData'] = conf.get('deviceData');
  values['strings'] = conf.get('strings');
  values['events'] = conf.get('events');
  res.send(values);
});