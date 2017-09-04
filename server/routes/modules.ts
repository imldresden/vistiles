import * as express from 'express';
import * as conf from 'nconf';
import log from '../utility/logging';
export let modulesRouter = express.Router();

/* GET home page. */
modulesRouter.get('/:module', function (req, res, next) {
  var options = {};
  for (var q in req.query) {
    try {
      let query = req.query[q].replace(/%23/g, '#');
      options[q] = JSON.parse(req.query[q]);
    } catch (e){
      log.info('Could not parse option as JSON:', q);
      options[q] = req.query[q];
    }
  }
  options['strings'] = conf.get('strings:views:modules:' + req.params.module);
  res.render('modules/' + req.params.module, options);
});