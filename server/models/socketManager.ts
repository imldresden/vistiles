import * as socketIO from 'socket.io';
import log from '../utility/logging';
import {VisServerController} from "../controllers/visServerController";
import {CouplingController} from "../controllers/couplingController";
import {DebugController} from "../controllers/debugController";

export class SocketManager {
  visIO;
  debugIO;
  loggingIO;
  couplingIO;
  io;
  debugController;
  couplingController;
  visController;

  constructor(server, deviceManager, rigidBodyController) {
    this.io = socketIO.listen(server);

    this.couplingIO = this.io.of('/coupling');
    this.debugIO = this.io.of('/debug');
    this.loggingIO = this.io.of('/log');
    this.visIO = this.io.of('/visApp');


    this.debugController = new DebugController(this.debugIO, deviceManager, rigidBodyController);
    this.couplingController = new CouplingController(this.couplingIO, deviceManager, rigidBodyController);
    this.visController = new VisServerController(this.visIO, deviceManager);

    this.couplingIO.on('connection', (socket) => {
      this.couplingController.register(socket);
    });

    this.debugIO.on('connection', (socket) => {
      this.debugController.register(socket);
    });

    this.loggingIO.on('connection', function (socket) {
      socket.on('log', function (data) {
        log.clientStream.write(
          data.clientId, data.level, data.timestamp, data.message);
      })
    });

    this.visIO.on('connection', (socket) => {
      this.visController.register(socket);
    });
  }
}
