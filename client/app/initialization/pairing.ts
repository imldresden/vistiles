/**
 * Created by Tom Horak on 11.05.16.
 */

import * as conf from "../../conf";
import * as utility from "../../utility";
import * as identification from "./identification";

export class Pairing{
  private _targetEl;
  private _callback;
  private _socket;

  constructor(targetEl, socket, callback) {
    this._targetEl = targetEl;
    this._socket = socket;
    this._callback = callback;

    this.loadPairingMenu();
  }

  loadPairingMenu() {
    utility.apiLoad(
      (response: string) => this.displayPairingMenu(response), 'modules', 'pairing-menu', {device: identification.getDevice()});
  }

  displayPairingMenu(content) {
    this._targetEl.innerHTML = content;
    document.getElementById('pairingBtn').addEventListener('click', () => this.initPairing());
    document.getElementById('simulateBtn').addEventListener('click', () => this.simulatePairing());
    utility.hideLoadingSpinner();
  }

  initPairing() {
    if (window.localStorage['desktop'] != 'true')
      utility.launchFullScreen();
    utility.showLoadingSpinner(conf.get('strings:initialization:requestPairing'));
    this._socket.once('pairingStarted', () => {
      this.pairingStarted();
    });
    this._socket.once('pairingResult', (data) => {
      if (data.successful)
        this.pairingSuccessful();
      else
        this.pairingFailed();
    });
    this._socket.emit('pairingRequest', identification.getDevice());
  }

  pairingFailed() {
    utility.showOverlay(
      conf.get('strings:initialization:pairingFail'), '', {
        iconCode: 'error_outline',
        iconClass: 'red-text',
        buttonText: conf.get('strings:initialization:pairingRetry')
      });
    document.getElementById('loading-button').addEventListener('click', () => this.retryPairing());
  }

  pairingStarted() {
    utility.showOverlay(
      'Pairing', conf.get('strings:initialization:pairingInfo'), {
        iconCode: 'vibration',
        iconClass: 'shake'
      });
  }

  pairingSuccessful() {
    utility.displayToast(conf.get('strings:initialization:pairingSuccess'), 'success');
    this._callback();
  }

  simulatePairing() {
    if (window.localStorage['desktop'] != 'true')
      utility.launchFullScreen();
    utility.showLoadingSpinner(conf.get('strings:initialization:requestConnection'));
    this._socket.emit('virtualPairing', identification.getDevice());
    this._callback();
  }

  retryPairing() {
    document.getElementById('loading-button').removeEventListener('click', () => this.retryPairing());
    this.loadPairingMenu();
  }
}

