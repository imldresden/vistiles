import { EventEmitter } from "events";
import * as conf from 'nconf';
import log from '../utility/logging';
import OscReceiver from './../utility/oscReceiver';
import RigidBody from '../utility/rigidBody';
import app from '../vistiles-server';
import {DeviceManager} from "../models/deviceManager";
import {Device} from "../models/device";

export class RigidBodyController extends EventEmitter {
  unlinkedRigidBodies: any = {};
  virtualRigidBodies: any = {};
  lastOscEvent: number;
  timeOffset: number = 0;
  oscReceiver: OscReceiver;
  private _deviceManager;

  constructor(deviceManager: DeviceManager) {
    super();

    this._deviceManager = deviceManager;
    this.oscReceiver = new OscReceiver();
    this.oscReceiver.once('rigidBody', (rb: RigidBody) => this.onFirstRigidBody(rb));
    this.oscReceiver.on('rigidBody', (rb: RigidBody) => this.onRigidBody(rb));

    this._deviceManager.on('deviceAdded', (device: Device) => this.onDeviceAdded(device));

    setInterval(() => this.triggerVirtualRigidBodies,
      conf.get('system:tracking:intervalVirtualRigidBodies') - 100);
  }

  createVirtualRigidBody(device): RigidBody {
    var id = 'V-' + device.id.substring(0, 3);
    var name = '[Virt] ' + device.name;
    var timeTag = {
      raw: [0, (new Date()).getTime() - this.timeOffset],
      native: 0
    };
    var rb = new RigidBody(
      id, [0, 0, 0], [0, 0, 0, -1], name, timeTag);
    this.virtualRigidBodies[rb.id] = rb;
    this.handleRigidBodyEvent(rb);
    return rb;
  }

  //Todo: Replace with property call
  getUnlinkedRigidBodies() {
    return this.unlinkedRigidBodies;
  }

  handleRigidBodyEvent(rb: RigidBody): void {
    let device = this._deviceManager.getDeviceByRbId(rb.id);
    if (device) {
      // directly update the device if it is a virtual device
      if (typeof rb.id === 'string' && rb.id.startsWith('V-')) {
        this._deviceManager.updateDevice(device.id, rb);
        return;
      }

      // invert z axis for real devices only
      rb.pos[2] *= -1;

      let lastPos = device.rb.pos;
      let diff = Math.sqrt(
        Math.pow(rb.pos[0] - lastPos[0], 2) +
        Math.pow(rb.pos[1] - lastPos[1], 2) +
        Math.pow(rb.pos[2] - lastPos[2], 2)
      );

      let lastOrientation = device.rb.orientation;
      let newOrientation = rb.orientation;

      // update Device if a different position is detected
      if (diff > conf.get('system:tracking:jitter')){
        this._deviceManager.updateDevice(device.id, rb);
      }

    } else {
      this.unlinkedRigidBodies[rb.id] = rb;
    }



  }

  onDeviceAdded(device: Device): void {
    if (device.rb.id in this.unlinkedRigidBodies) {
      delete this.unlinkedRigidBodies[device.rb.id];
    }
  }

  onFirstRigidBody(rb: RigidBody): void {
    this.timeOffset = (new Date()).getTime() - rb.timeStamp;
    log.debug('Received data from OscReceiver');
  }

  onRigidBody(rb: RigidBody): void {
    this.lastOscEvent = (new Date()).getTime();
    this.handleRigidBodyEvent(rb);
  }

  triggerVirtualRigidBodies(): void {
    for (let rb in this.virtualRigidBodies) {
      this.handleRigidBodyEvent(this.virtualRigidBodies[rb]);
    }
  }

  updateVirtualRigidBody(rb: RigidBody): void {
    // invert z axis
    rb.pos[2] *= -1;
    this.virtualRigidBodies[rb.id] = rb;
    this.handleRigidBodyEvent(rb);
  }
}

export default RigidBodyController;