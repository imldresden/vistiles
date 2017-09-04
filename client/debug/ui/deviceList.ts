/**
 * Created by Tom Horak on 17.05.16.
 */

import * as utility from "../../utility";

export class DeviceList {
  private _socket;
  private _device_map = {};

  constructor(data, debugSocket) {
    if (data.inactive_devices)
      this.loadDeviceList(data.inactive_devices, 'inactive');
    if (data.devices)
      this.loadDeviceList(data.devices, 'active');

    this._socket = debugSocket;
    this._socket.on('deviceAdded', (device) => this.onDeviceAdded(device));
    this._socket.on('virtualDeviceCreated', (data) => this.onVirtualDeviceCreated(data));
    this._socket.on('devicePairingStarted', (device) => this.onDevicePairingStarted(device));
  }

  loadDeviceList(deviceList, status) {
    for (let deviceId in deviceList) {
      if (document.getElementById(deviceId) !== null) {
        let el = document.getElementById(deviceId);
        el.parentElement.removeChild(el);
      }
      this._device_map[deviceId] = deviceList[deviceId];
    }
    let parameters = {
      status: status,
      devices: deviceList
    };
    utility.apiLoad((res) => this.updateDeviceList(res), 'modules', 'device-list', parameters);
  }

  updateDeviceList(content) {
    let list = document.getElementById('device-list-ul');
    list.innerHTML += content;

    let buttons = list.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
      let id = buttons[i].id;
      buttons[i].addEventListener('click', () => this.createVirtualRigidBody(id));
    }
  }

  createVirtualRigidBody(btnId) {
    let id = btnId.replace('sim-', '');
    this._socket.emit('virtualPairing', this._device_map[id]);
  }

  onDeviceAdded(device) {
    this._device_map[device.id] = device;
    let list = {};
    list[device.id] = device;
    this.loadDeviceList(list, 'active');
  }

  onVirtualDeviceCreated(data) {
    this._device_map[data.deviceId] = data.rbId;
  }

  onDevicePairingStarted(device) {
    let list = {};
    list[device.id] = device;
    this.loadDeviceList(list, 'connecting');
  }
}