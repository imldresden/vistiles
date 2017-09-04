import * as http from "http";
import * as express from "express";
import * as path from "path";
import * as favicon from "serve-favicon";
import * as logger from "morgan";
import * as cookieParser from "cookie-parser";
import * as bodyParser from "body-parser";
import * as conf from "nconf";
import * as sassMiddleware from "node-sass-middleware";
import {Express} from "express";

// Load command line arguments and environment variables
conf.argv().env();
// Load configs, values are not overwritten
// local.json is for local settings and not in git
conf.add("local", {type: 'file', file: 'server/config/local.json'});
// config files containing default values
conf.add("system", {type: 'file', file: 'server/config/system.json'});
conf.add("app", {type: 'file', file: 'server/config/app.json'});
conf.add("deviceData", {type: 'file', file: 'server/config/deviceData.json'});
conf.add("data", {type: 'file', file: 'server/config/data.json'});
conf.add("events", {type: 'file', file: 'server/config/events.json'});

// load strings considering language setting
let lang = conf.get('app:language');
if (lang && lang === 'de')
  conf.add("strings", {type: 'file', file: 'server/config/strings-de.json'});
else
  conf.add("strings", {type: 'file', file: 'server/config/strings-en.json'});

import log from './utility/logging';
import {Server} from "http";
import {DataManager} from "./models/dataManager";
import { DeviceManager } from './models/deviceManager';
import {SocketManager} from "./models/socketManager";
import { RigidBodyController } from "./controllers/rigidBodyController";
import { DataRouter } from './routes/data';
import {confRouter} from './routes/conf';
import {debugRouter} from './routes/debug';
import {indexRouter} from './routes/index';
import {modulesRouter} from './routes/modules';

class App {
  private _app: Express;
  private _server: Server;
  private _dataManager: DataManager;
  private _deviceManager: DeviceManager;
  private _socketManager: SocketManager;
  private _rigidBodyController: RigidBodyController;

  get app(): Express { return this._app; }
  get server(): Server { return this._server; }
  get dataManager(): DataManager { return this._dataManager; }
  get deviceManager(): DeviceManager { return this._deviceManager; }
  get socketManager(): SocketManager { return this._socketManager; }
  get rigidBodyController(): RigidBodyController { return this._rigidBodyController; }

  constructor() {
    this._app = express();
    this._server = http.createServer(this.app);

    //Initialize managers that require a separate initialization
    require('./models/deviceManager');
    require('./models/socketManager');
    this._dataManager = new DataManager(conf.get('data:dataSet'));
    this._dataManager.initialize(() => this.continueInitialization());
  }

  private continueInitialization(): void {
    this._deviceManager = new DeviceManager();
    this._rigidBodyController = new RigidBodyController(this.deviceManager);
    this._socketManager = new SocketManager(this.server, this.deviceManager, this.rigidBodyController);

    // view engine setup
    // TODO Discuss whether to link files in the src folder or not. If not, the files need to be copied to the build dir.
    this.app.set('views', './client/views');
    this.app.set('view engine', 'pug');

    // uncomment after placing your favicon in /public
    //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
    this.app.use(logger('dev', { 'stream': log.stream} ));
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({extended: false}));
    this.app.use(cookieParser());
    this.app.use(express.static('./public'));

    let dataRouter = (new DataRouter(this.dataManager)).router;

    this.app.use('/', indexRouter);
    this.app.use('/conf', confRouter);
    this.app.use('/debug', debugRouter);
    this.app.use('/modules', modulesRouter);
    this.app.use('/data', dataRouter);


    // catch 404 and forward to error handler
    this.app.use(function (req, res, next) {
      let err: any = new Error('Not Found');
      err.status = 404;
      next(err);
    });

    // error handlers

    // development error handler
    // will print stacktrace
    if (this.app.get('env') === 'development') {
      this.app.use(function (err: any, req, res, next) {
        res.status(500);
        res.render('error', {
          message: err.message,
          error: err
        });
      });
    }

    // production error handler
    // no stacktraces leaked to user
    this.app.use(function (err: any, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: {}
      });
    });
  }
}

let app = new App();

export default app;