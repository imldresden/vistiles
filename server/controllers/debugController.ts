import * as conf from 'nconf';
import Namespace = SocketIO.Namespace;
import {DeviceManager} from "../models/deviceManager";
import Socket = SocketIO.Socket;
import {Device} from "../models/device";
import {Proximity} from "../utility/proximity";
import {RigidBodyController} from "./rigidBodyController";
import {RigidBody} from "../utility/rigidBody";

export class DebugController {
  deviceAreaWidth: number = conf.get('system:tracking:areaSize:width');
  deviceAreaHeight: number = conf.get('system:tracking:areaSize:height');
  minX: number = 0.;
  maxX: number = conf.get('system:tracking:areaSize:width') / 100.;
  minY: number = 0;
  maxY: number = conf.get('system:tracking:areaSize:height') / 100.;
  private _namespace: Namespace;
  private _deviceManager: DeviceManager;
  private _rigidBodyController: RigidBodyController;

  constructor(namespace: Namespace, deviceManager: DeviceManager,
              rigidBodyController: RigidBodyController) {
    this._namespace = namespace;
    this._deviceManager = deviceManager;
    this._rigidBodyController = rigidBodyController;
  }

  checkOscActivity(socket) {
    var lastEvent = this._rigidBodyController.lastOscEvent;
    var now = (new Date()).getTime();
    if(lastEvent !== undefined && now - lastEvent < 1000)
      socket.emit('oscActivity', true);
    else
      socket.emit('oscActivity', false);
  }

  onContextReceived(socket) {
    socket.emit('debugContextData', {
        devices: this._deviceManager.getDevices(),
        inactive_devices: this._deviceManager.getInactiveDevices(),
        table: {width: this.deviceAreaWidth, height: this.deviceAreaHeight},
        valueRange: {minX: this.minX, maxX: this.maxX, minY: this.minY, maxY: this.maxY}
      }
    )
  }

  static onDeviceAdded(socket, device) {
    socket.emit('deviceAdded', device);
  }

  static onDevicePosChanged(socket, device) {
    socket.emit('devicePosChanged', {device: device});
  }

  static onPairing(socket, deviceData) {
    socket.emit('devicePairingStarted', deviceData);
  }

  static onProximityUpdated(socket, proximity) {
    socket.emit('proximityUpdated', proximity);
  }

  onVirtualPairing(deviceData: Object) {
    let rb = this._rigidBodyController.createVirtualRigidBody(deviceData);
    deviceData['rb'] = rb;
    this._deviceManager.writeRbIdToDeviceIdMap(deviceData);
  }

  onVirtualRigidBodyMoved(virtualRigidBody: RigidBody) {
    this._rigidBodyController.updateVirtualRigidBody(virtualRigidBody);
  }

  register(socket: Socket): void {
    socket.on('requestDebugContext', () => this.onContextReceived(socket));
    socket.on(
      'virtualPairing', (deviceData: Object) => this.onVirtualPairing(deviceData)
    );
    socket.on(
      'virtualRigidBodyMoved',
      (virtualRigidBody: RigidBody) => this.onVirtualRigidBodyMoved(virtualRigidBody)
    );

    this._deviceManager.on(
      'devicePosChanged', (device: Device) => DebugController.onDevicePosChanged(socket, device));
    this._deviceManager.on(
      'deviceAdded', (device: Device) => DebugController.onDeviceAdded(socket, device)
    );
    this._deviceManager.on(
      'pairing', (deviceData: Object) => DebugController.onPairing(socket, deviceData)
    );
    this._deviceManager.on(
      'proximityUpdated', (proximity: Proximity) => DebugController.onProximityUpdated(socket, proximity)
    );

    setInterval(() => this.checkOscActivity(socket), 1000);
  }
}
