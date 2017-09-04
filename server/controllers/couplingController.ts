import log from '../utility/logging';
import {DeviceManager} from "../models/deviceManager";
import {RigidBodyController} from "./rigidBodyController";
import {RigidBody} from "../utility/rigidBody";
import {Device} from "../models/device";
import Namespace = SocketIO.Namespace;
import Socket = SocketIO.Socket;
import app from "../vistiles-server";
import {PairingController} from "./pairingController";

export class CouplingController {
  private _deviceManager: DeviceManager;
  private _rigidBodyController: RigidBodyController;
  private _namespace: Namespace;
  private _pairingController: PairingController;

  constructor(namespace: Namespace, deviceManager: DeviceManager, rigidBodyController: RigidBodyController) {
    this._deviceManager = deviceManager;
    this._rigidBodyController = rigidBodyController;
    this._namespace = namespace;
    this._pairingController = new PairingController(rigidBodyController);
  }

  getSocketById(socketId: string): Socket {
    return this._namespace.sockets[socketId];
  }

  onPairing(socket: Socket, rb: RigidBody, device: Object): void {
    if (rb) {
      this.createDevice(socket, rb, device);
      socket.emit('pairingResult', {successful: true});
    }
    else {
      socket.emit('pairingResult', {successful: false});
    }
  }

  initPairing(socket: Socket, device: Object) {
    if (!this._pairingController.pairing) {
      this._deviceManager.onPairing(device);
      socket.emit('pairingStarted');
      this._pairingController.pair((rb) => this.onPairing(socket, rb, device));
    } else {
      setTimeout(() => this.initPairing(socket, device), 2000);
    }
  }

  createDevice(socket: Socket, rb: RigidBody, device: Object) {
    var type;
    if (typeof rb.id === 'string' && rb.id.indexOf('V-') > -1)
      type = 'virtual';
    else
      type = 'tracked';

    //Todo: Change namespace to a config value
    var socketId = '/visApp#' + socket.client.conn.id;
    this._deviceManager.addDevice(rb, type, device, socketId);
  }

  onConnectionRequest(socket: Socket, deviceData: Object) {
    if (this._deviceManager.getDevice(deviceData['id'])) {
      let device = this._deviceManager.getDevice(deviceData['id']);
      device.socketId = '/visApp#' + socket.client.conn.id;
      socket.emit('connectionResponse', {paired: true, color: device.color});
      return;
    }
    var unlinkedRigidBodies = this._rigidBodyController.getUnlinkedRigidBodies();
    for (let rbId in unlinkedRigidBodies) {
      if (this._deviceManager.getDeviceIdByRbId(rbId) == deviceData['id']) {
        this.createDevice(socket, unlinkedRigidBodies[rbId], deviceData);
        socket.emit('connectionResponse', {paired: true, color: this._deviceManager.getDevice(deviceData['id']).color});
        return;
      }
    }
    socket.emit('connectionResponse', {paired: false});
  }

  onVirtualPairing(deviceData: Object) {
    deviceData['rb'] = this._rigidBodyController.createVirtualRigidBody(deviceData);
    this._deviceManager.writeRbIdToDeviceIdMap(deviceData);
  }

  register(socket: Socket): void {
    socket.on('connectionRequest', (deviceData) => this.onConnectionRequest(socket, deviceData));
    socket.on('pairingRequest', (deviceData) => this.initPairing(socket, deviceData));
    socket.on('virtualPairing', (deviceData) => this.onVirtualPairing(deviceData));
  }
}

export default CouplingController;