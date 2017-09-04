import * as identification from "./identification";
import {Setup} from "./setup";
import {Pairing} from "./pairing";
var socketIO = require('socket.io-client');

export class Initialization {
  private _callback;
  private _targetEl;
  private _socket = socketIO.connect(window.location.host + '/coupling');

  constructor(targetEl, callback) {
    this._targetEl = targetEl;
    this._callback = callback;

    if (identification.getDevice())
      this.connect();
    else
      new Setup(targetEl, () => this.connect());
  }

  connect() {
    this._socket.once('connectionResponse', (response) => this.connectResponse(response));
    this._socket.emit('connectionRequest', identification.getDevice());
  }

  connectResponse(data) {
    if (data.paired) {
      let device = identification.getDevice();
      device['color'] = data.color;
      identification.setDevice(device);
      this._callback();
    } else {
      new Pairing(this._targetEl, this._socket, () => this.connect());
    }
  }
}
