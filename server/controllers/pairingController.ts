/**
 * Created by Tom Horak on 29.03.16.
 */
import {RigidBodyController} from "./rigidBodyController";

export class PairingController {
  private _pairingFlag: boolean = false;
  private _rigidBodyController: RigidBodyController;
  private _validationInterval;
  private _pairingTimeout;
  private _callback;
  private _rigidBodiesAtStart;
  get pairing(): boolean { return this._pairingFlag; };

  constructor(rigidBodyController: RigidBodyController) {
    this._rigidBodyController = rigidBodyController;
  }

  pair(callback) {
    this._pairingFlag = true;
    this._rigidBodiesAtStart = {};
    for (var rb in this._rigidBodyController.getUnlinkedRigidBodies()) {
      this._rigidBodiesAtStart[rb] = this._rigidBodyController.getUnlinkedRigidBodies()[rb];
    }

    this._callback = callback;
    this._validationInterval = setInterval(() => this.validateDistance(), 1000);
    this._pairingTimeout = setTimeout(() => this.timeout(), 10000);
  }

  static positionHasChanged(posOld, posNew, threshold){
    var sum = 0.;
    for (var i = 0; i < posOld.length; i++) {
      sum += Math.pow(posOld[i] - posNew[i], 2);
    }
    return Math.sqrt(sum) > threshold;
  }

  validateDistance() {
    var currentRidigBodies = this._rigidBodyController.getUnlinkedRigidBodies();

    for (var rbId in this._rigidBodiesAtStart) {
      var posOld = this._rigidBodiesAtStart[rbId].pos;
      if (currentRidigBodies[rbId] === undefined)
        return;
      var posNew = currentRidigBodies[rbId].pos;
      if (PairingController.positionHasChanged(posOld, posNew, 0.05)) {
        clearTimeout(this._pairingTimeout);
        clearInterval(this._validationInterval);
        this._pairingFlag = false;
        this._callback(currentRidigBodies[rbId]);

        this._callback = undefined;

        return;
      }
    }
  }

  timeout() {
    clearInterval(this._validationInterval);
    this._pairingFlag = false;
    this._callback(undefined);

    this._callback = undefined;
  }
}

export default PairingController;