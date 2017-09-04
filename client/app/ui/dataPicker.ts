//module providing functionality to pick a dataFile as source
//define(['conf', 'utility'], function (conf, utility) {

import * as conf from "../../conf";
import * as utility from "../../utility";

export class DataPicker {
  private _targetEl;
  private _callback;
  private _viewConf;
  private _selectedAttributes = [];
  private _attributes;

  constructor(targetEl, callback, viewId) {
    this._targetEl = targetEl;
    this._callback = callback;

    this._viewConf = conf.get('app:views:' + viewId);

    utility.showLoadingSpinner(conf.get('strings:ui:loadAvailableData'));
    utility.apiLoad((response) => this.availableAttributesReceived(response), 'data/attributes', 'meta');
  }

  availableAttributesReceived(availableAttributes) {
    this._attributes = JSON.parse(availableAttributes);
    this.loadDataList();
  }

  loadDataList() {
    let attr;
    let optional = true;
    if (this._selectedAttributes.length < this._viewConf['attributes']['mandatory'].length) {
      attr = this._viewConf['attributes']['mandatory'][this._selectedAttributes.length];
      optional = false;
    } else
      attr = this._viewConf['attributes']['optional'][this._selectedAttributes.length - this._viewConf['attributes']['mandatory'].length];
    utility.apiLoad(
      (response) => this.displayDataItems(response), 'modules', 'data-list', {
        dataItems: this._attributes,
        attribute: {
          name: attr,
          optional: optional
        },
        visualization: {
          name: this._viewConf['name'],
          icon: this._viewConf['icon']
        }
      });
  }

  displayDataItems(content) {
    this._targetEl.innerHTML += content;
    var buttons = this._targetEl.getElementsByTagName('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', (e) => this.handleDataPick(e));
    }
    utility.hideLoadingSpinner();
  }

  handleDataPick(e) {
    let targetId = e.target.id;
    if (!targetId)
      targetId = e.target.parentNode.id;
    this._selectedAttributes.push(targetId);
    this._targetEl.innerHTML = '';
    if (this._selectedAttributes.length < this._viewConf['attributes']['mandatory'].length) {
      this.loadDataList();
    } else if (this._selectedAttributes.length < this._viewConf['attributes']['mandatory'].length + this._viewConf['attributes']['optional'].length
      && targetId != 'SKIP') {
      this.loadDataList();
    } else {
      this._callback(this._selectedAttributes);
    }
  }
}