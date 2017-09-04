/**
 * Created by horak on 09.02.16.
 */

import { EventEmitter } from "events";
import * as conf from 'nconf';

import log from './logging';
import RigidBody from './rigidBody';

// Use standard nodejs import as typescript definitions are not available for osc
let osc = require('osc');

export class OscReceiver extends EventEmitter {
  constructor() {
    super();

    let udpPort = new osc.UDPPort({
      localAddress: conf.get('system:osc:localAddress'),
      localPort: conf.get('system:osc:localPort')
    });

    udpPort.open();
    log.info('Listening on port ' + conf.get('system:osc:localPort') + ' for OSC messages');

    udpPort.on("bundle", (bundle, timeTag) => this.onBundle(bundle, timeTag));
  }

  onBundle(bundle, timeTag): void {
    let packet = bundle.packets[0];
    if (packet.address === undefined || packet.address !== '/tracking/optitrack/rigidbodies') {
      return;
    }
    let args = packet.args;

    let rb = new RigidBody(args[0], args.slice(1, 4), args.slice(7, 11), args[11], timeTag);
    this.emit("rigidBody", rb);
  }
}

export default OscReceiver;