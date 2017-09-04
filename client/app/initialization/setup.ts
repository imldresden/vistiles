/**
 * Created by Tom Horak on 11.05.16.
 */

import * as conf from "../../conf";
import * as utility from "../../utility";
import * as identification from "./identification";

export class Setup {
  private _targetEl;
  private _callback;

  constructor(targetEl, callback) {
    this._targetEl = targetEl;
    this._callback = callback;

    this.loadDeviceSelection();
  }

  loadDeviceSelection() {
    let deviceData = conf.get('deviceData');
    let deviceList = {};
    for (let device in deviceData) {
      deviceList[device] = deviceData[device].name;
    }
    deviceList['custom'] = 'Custom';
    utility.apiLoad((response: string) => this.displayDeviceSelection(response), 'modules', 'device-selection', {devices: deviceList});
  }

  displayDeviceDataForm(content) {
    this._targetEl.innerHTML = content;

    document.getElementById('wizardButton').addEventListener('click', (e) => this.onDeviceDataFormSubmitted(e));

    utility.hideLoadingSpinner();
  }

  onDeviceDataFormSubmitted(e) {
    e.preventDefault();
    if (!(<HTMLSelectElement>document.getElementById('deviceForm')).checkValidity()) {
      utility.displayToast(conf.get('strings:initialization:deviceDataMissingFields'), 'success');
      return;
    }

    document.getElementById('wizardButton').removeEventListener('click', (e) => this.onDeviceDataFormSubmitted(e));

    let deviceData = {};
    let size = {};
    let borders = {};

    let formElement = <HTMLSelectElement>document.getElementById('deviceForm');
    for (let i = 0; i < formElement.length; i++) {
      if (formElement[i] instanceof HTMLInputElement) {
        if (formElement[i].id == "width" || formElement[i].id == "height") {
          size[formElement[i].id] = formElement[i].value;
        } else if (formElement[i].id.indexOf('border') != -1) {
          if (formElement[i].id.indexOf('Top') != -1)
            borders['top'] = formElement[i].value;
          else if (formElement[i].id.indexOf('Right') != -1)
            borders['right'] = formElement[i].value;
          else if (formElement[i].id.indexOf('Bottom') != -1)
            borders['bottom'] = formElement[i].value;
          else if (formElement[i].id.indexOf('Left') != -1)
            borders['left'] = formElement[i].value;
        }
        else {
          deviceData[formElement[i].id] = formElement[i].value;
        }
      }
    }
    deviceData['size'] = size;
    deviceData['borders'] = borders;

    utility.showLoadingSpinner(conf.get('strings:initialization:requestConnection'));
    this._targetEl.innerHTML = '';
    identification.setDevice(deviceData);

    this._callback();
  }

  displayDeviceSelection(content) {
    this._targetEl.innerHTML = content;

    //Required by Materialize Framework for select-list formatting
    $('select').material_select();

    document.getElementById('wizardButton').addEventListener('click', (e) => this.onDeviceSelected(e));

    utility.hideLoadingSpinner();
  }

  onDeviceSelected(e) {
    e.preventDefault();
    document.getElementById('wizardButton').removeEventListener('click', (e) => this.onDeviceSelected(e));
    let selectionField = <HTMLSelectElement>document.getElementById('deviceSelectionField');
    let value = (<HTMLOptionElement>selectionField.options[selectionField.selectedIndex]).value;

    if (value == 'custom') {
      utility.showLoadingSpinner(conf.get('strings:initialization:loadDeviceData'));
      this._targetEl.innerHTML = '';
      utility.apiLoad((response: string) => this.displayDeviceDataForm(response), 'device-data');
      return;
    }

    utility.showLoadingSpinner(conf.get('strings:initialization:requestConnection'));
    this._targetEl.innerHTML = '';
    identification.setDevice(conf.get('deviceData')[value]);

    this._callback();
  }

}
