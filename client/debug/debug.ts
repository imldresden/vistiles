import * as conf from "../conf";
import {DebugProximityView} from "./ui/debugProximityView";
import {DeviceMap} from "./ui/deviceMap";
import {DeviceList} from "./ui/deviceList";
let socketIO = require('socket.io-client');

export class DebugApp {
  private _socket = socketIO.connect('/debug');
  private _proximityView;

  constructor() {
    this._socket.on('debugContextData', (data) => this.onDebugContextData(data));
    this._socket.on('oscActivity', (isActive) => DebugApp.onOscActivity(isActive));

    let updateServerStatusInterval = setInterval(() => this.updateServerStatus(), 100);
    this._socket.emit('requestDebugContext');
  }

  //receiving devices and context data
  onDebugContextData(data) {
    new DeviceMap(data, this._socket);
    new DeviceList(data, this._socket);

    // > initializes the proximity view
    this._proximityView = new DebugProximityView(data, this._socket);
  }

  static onOscActivity(isActive) {
    let optitrackIndicator = document.getElementById('optitrack-status');
    if (isActive) {
      optitrackIndicator.innerHTML = conf.get('strings:views:debug:statusBar:optitrackActive');
      optitrackIndicator.className = 'active';
    } else {
      optitrackIndicator.innerHTML = conf.get('strings:views:debug:statusBar:optitrackInactive');
      optitrackIndicator.className = 'inactive';
    }
  }

  sendSimulatedPairing(device) {
    this._socket.emit('virtualPairing', device);
  }

  updateServerStatus() {
    let serverIndicator = document.getElementById('server-status');
    if (this._socket && this._socket.connected) {
      if (serverIndicator.className == 'inactive') {
        location.reload();
      }
    } else {
      serverIndicator.innerHTML = conf.get('strings:views:debug:statusBar:serverInactive');
      serverIndicator.className = 'inactive';
      DebugApp.onOscActivity(false);
    }
  }
}