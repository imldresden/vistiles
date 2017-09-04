import * as express from 'express';
import * as conf from 'nconf';
export let indexRouter = express.Router();

/* GET home page. */
indexRouter.get('/', function (req, res, next) {
  res.render('index', {strings: conf.get('strings:views:index')});
});