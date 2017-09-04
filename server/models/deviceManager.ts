import { EventEmitter } from "events";
import * as fs from "fs";
import * as conf from 'nconf';

import log from '../utility/logging';
import { Device } from './device';
import { Proximity } from '../utility/proximity';
import {RigidBody} from "../utility/rigidBody";

let util = require('util');

export class DeviceManager extends EventEmitter {
  deviceList = {};
  proximities: Proximity[] = [];
  rbId_device_map = {};

  constructor() {
    super();

    this.loadRbIdToDeviceMap();
  }

  addDevice(rb: RigidBody, type: string, deviceData, socketId: string): Device {
    if (rb.id in this.rbId_device_map && this.hasDevice(this.rbId_device_map[rb.id].id))
      return;

    let device = new Device(
      deviceData.id,
      deviceData.name,
      deviceData.size,
      deviceData.dpi,
      deviceData.borders,
      type,
      rb,
      socketId
    );
    this.writeRbIdToDeviceIdMap(device);
    this.createProximities(device);
    this.deviceList[device.id] = device;
    this.emit("deviceAdded", device);
    return device;
  }

  createProximities(device: Device): void {
    for (let deviceId in this.deviceList) {
      let proximity = new Proximity(device, this.deviceList[deviceId],
        (proximity) => { this.onProximityChanged(proximity) },
        (proximity) => { this.onProximityUpdated(proximity) });
      this.proximities.push(proximity);
    }
  }

  //Todo: necessary?
  hasDevice(id: string): boolean {
    return id in this.deviceList;
  }

  //Todo: Use property
  getDevices () {
    return this.deviceList;
  }

  //Todo: Rename 'getDeviceById'
  getDevice(id: string): Device {
    if (this.hasDevice(id))
      return this.deviceList[id];
  }

  getDeviceByRbId(rbId: string): Device {
    if (rbId in this.rbId_device_map && this.getDevice(this.rbId_device_map[rbId].id))
      return this.getDevice(this.rbId_device_map[rbId].id);
  }

  //Todo: necessary?
  getDeviceIdByRbId(rbId: string): string {
    if (rbId in this.rbId_device_map)
      return this.rbId_device_map[rbId].id;
  }

  getInactiveDevices() {
    let inactiveDevices = {};
    for (let rbId in this.rbId_device_map) {
      if(!(this.rbId_device_map[rbId].id in this.deviceList)) {
        inactiveDevices[this.rbId_device_map[rbId].id] = this.rbId_device_map[rbId];
      }
    }
    return inactiveDevices;
  }

  getProximity(device1: Device, device2: Device): Proximity {
    for (let i = 0; i < this.proximities.length; i++) {
      if (
        (this.proximities[i].deviceA.id == device1.id || this.proximities[i].deviceA.id == device2.id) &&
        (this.proximities[i].deviceB.id == device1.id || this.proximities[i].deviceB.id == device2.id)) {
        return this.proximities[i];
      }
    }
  }

  getProximities(device: Device): Proximity[] {
    let selectedProximities = [];
    for (let i = 0; i < this.proximities.length; i++) {
      if (this.proximities[i].deviceA.id == device.id || this.proximities[i].deviceB.id == device.id) {
        selectedProximities.push(this.proximities[i]);
      }
    }
    return selectedProximities;
  }

  loadRbIdToDeviceMap(): void {
    fs.stat('./storage/rbID_deviceData_storage.json', (err, stat) => {
      if (err == null) {
        this.rbId_device_map = require("../../../storage/rbID_deviceData_storage.json");
      } else {
        fs.mkdir('./storage', 744, function (err) {
          if (err) {
            if (err.code != 'EEXIST')
              log.error(err.message);
          } else
            log.info('Created storage directory');
        });
      }
    });
  }

  onPairing(device: Object): void {
    this.emit('pairing', device);
  }

  onProximityChanged(proximity: Proximity): void {
    this.emit('proximityChanged', proximity);
  }

  onProximityUpdated(proximity: Proximity): void {
    this.emit('proximityUpdated', proximity);
  }

  updateDevice(id: string, rb: RigidBody): void {
    if (!this.hasDevice(id))
      return;

    this.deviceList[id].rb = rb;
    this.emit("devicePosChanged", this.deviceList[id]);
  }

  //Todo: Rename to 'writeRbIdToDeviceMap'
  writeRbIdToDeviceIdMap (device: Device | Object): void {
    if (device['type'] == 'virtual')
      return;

    for (let rbId in this.rbId_device_map) {
      if (this.rbId_device_map[rbId].id == device['id'])
        delete this.rbId_device_map[rbId];
    }
    this.rbId_device_map[device['rb'].id] = {id: device['id'], name: device['name'], rb: device['rb']};
    fs.writeFile("./storage/rbID_deviceData_storage.json", JSON.stringify(this.rbId_device_map));
  }
}

//Todo: created by AppManager
let Manager = new DeviceManager();

export default DeviceManager;