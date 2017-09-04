// module that represents a settings menu for a visualization
//TODO: Clean up file!

import * as conf from "../../conf";
import * as utility from "../../utility";
import {View} from "./view";
import {ViewType, VisClientController} from "../controller/visClientController";
import {Table} from "./visualizations/table";
declare let noUiSlider: any;

export class VisSettingsMenu extends View {
  static viewId: string = 'visSettingsMenu';
  // general variables
  //Todo: Define types
  private _cacheMeta = {};

  private _devices = {};
  private _forceLoaded: boolean = false;

  // visual properties / attributes
  private _size = {
    inner: {width: -1, height: -1},
    outer: {width: -1, height: -1}
  };
  private _padding = {top: 10, right: 10, bottom: 10, left: 10};

  // DOM elements
  private _parentNode: HTMLElement;

  get viewId(): string { return VisSettingsMenu.viewId; };

  constructor(parent: HTMLElement, visClientController: VisClientController, forceLoaded?: boolean) {
    super(parent, visClientController);

    // register application event callbacks
    this._eventCallbacks[conf.get('events:settings:attributesState')] = (d) => this.onAttributeState(d);
    this._eventCallbacks[conf.get('events:subGroup:hasLeft')] = (d) => this.onDeviceLeft(d);
    this._eventCallbacks[conf.get('events:subGroup:left')] = () => this.onSubGroupLeft();

    if (forceLoaded) this._forceLoaded = true;

    // load the template from the server
    utility.apiLoad((response) => this.onViewLoaded(response), 'modules', 'visSettingsMenu', {});

    VisSettingsMenu.initRegions(VisSettingsMenu.onRegionsLoaded);
  }

  static onRegionsLoaded(regions) {
    let targetDiv;
    targetDiv = document.getElementById('vis-settings-categories');

    if (regions.length > 0) {
      let form = document.createElement('form');
      form.action = "#";
      targetDiv.appendChild(form);
      let fieldset = document.createElement('fieldset');
      fieldset.classList.add('tab-settings-fieldset');
      form.appendChild(fieldset);

      let i = 0;
      for (let reg in regions) {
        let div = document.createElement('div');
        div.classList.add('tab-settings-checkerDiv');
        let color = document.createElement('div');
        color.classList.add('groupBackground-' + i);
        color.classList.add('color');
        div.appendChild(color);
        fieldset.appendChild(div);
        let input = document.createElement('input');
        input.classList.add('filled-in');
        input.id = 'filled-in-box' + i;
        input.type = 'checkbox';
        input.checked = true;
        input.disabled = true;
        //input.setAttribute('disabled', 'disabled');
        div.appendChild(input);
        let label = document.createElement('label');
        //label.classList.add('vis-settings-label');
        label.setAttribute('for', 'filled-in-box' + i);
        //label.for = 'filled-in-box' + i;
        div.appendChild(label);
        let p = document.createElement('p');
        p.classList.add('vis-settings-paragraph');
        label.appendChild(p);
        p.innerHTML += regions[reg];
        label.innerHTML += '</br>';
        i++;
      }
    }
  }

  static initRegions(callback) {
    let objMeta;
    let regions = [];
    // loads a list of all data attributes from the server
    utility.apiLoad(processDataObjects, 'data/objects', 'meta');
    let regionsSet = new Set();

    function processDataObjects(receivedData) {
      objMeta = JSON.parse(receivedData);
      for (let objId in objMeta) {
        regionsSet.add(objMeta[objId].Region);
      }
      regionsSet.forEach(function (reg) {
        regions.push(reg);
      });
      if (callback)
        callback(regions);
    }
  }

  addDeviceTab(device) {
    // if there is no list of attributes yet
    if (!this._cacheMeta['attributes']) {
      console.warn('visSettingsMenu: Opps - there is no list of attributes yet!');
      return;
    }
    // create a select for each vis attribute
    let visAttr = conf.get('app:views:' + device.view + ':attributes');
    let visAttrArray = visAttr['mandatory'].concat(visAttr['optional']);
    let dataAttrMappingsArray = Object.keys(device.dataAttr['attrMappings']);

    let attributesName = {};
    for (let key in this._cacheMeta['attributes']) {
      attributesName[key] = this._cacheMeta['attributes'][key]['Name'];
    }

    utility.apiLoad(update, 'modules', 'visSettingsTab', {
      deviceId: device.id,
      deviceViewIsTable: device.view === Table.viewId,
      visAttr: visAttrArray,
      dataAttrMapping: dataAttrMappingsArray,
      dataAttr: attributesName,
      selectedAttr: device.dataAttr['attrMappings']
    });

    var self = this;

    function update(cnt) {
      let inputContainer = document.createElement('div');
      inputContainer.innerHTML = cnt;
      let div = inputContainer.lastElementChild;
      document.getElementById('tab-container').appendChild(div);
      let selects = div.getElementsByTagName('select');
      for (let i = 0; i < selects.length; i++) {
        selects[i].onchange = function() { self.onDataMappingSelectionChanged(selects[i], device.id) };
      }

      // initialize all selects
      $('#' + device.id).find('select').material_select();

      if (device.dataAttr.attr.year) {
        // extracts a list of all years
        let years = Object.keys(self._cacheMeta['years']);

        // finds the minimum and maximum year
        let min = Number.MAX_VALUE,
          max = 0;
        for (let i = 0; i < years.length; i++) {
          let year = parseInt(years[i]);
          min = (year < min) ? year : min;
          max = (year > max) ? year : max;
        }

        // re-configure the slider
        let slider = div.getElementsByClassName('time-slider')[0];
        self.initializeTimeSlider(slider, min, max, device.dataAttr.attr.year, device.id);
      }

      let categoriesWrapper = document.getElementById('vis-settings-categories');
      let categoryCheckboxes = categoriesWrapper.getElementsByTagName('input');
      for (let i = 0; i < categoryCheckboxes.length; i++) {
        let id = Number(categoryCheckboxes[i].id.substr('filled-in-box'.length));
        categoryCheckboxes[i].disabled = false;
        if(device.dataAttr.filteredRegions.indexOf(id) > -1) {
          categoryCheckboxes[i].checked = false;
        } else {
          categoryCheckboxes[i].checked = true;
        }
        categoryCheckboxes[i].onchange = function() { self.onDataMappingCategoryCheckboxChanged(categoryCheckboxes[i], device.id) };
      }

      let checkboxWrapper = div.getElementsByClassName('vis-settings-checkbox-wrapper');
      if(checkboxWrapper.length > 0) {
        let checkboxes = checkboxWrapper[0].getElementsByTagName('input');
        for (let i = 0; i < checkboxes.length; i++) {
          checkboxes[i].onchange = function() { self.onDataMappingCheckboxChanged(checkboxes[i], device.id) };
        }
      }

      let tab = document.createElement('li');
      tab.className = 'tab col s4';
      tab.id = 'tab-' + device.id;
      let anchor = document.createElement('a');
      anchor.setAttribute('href', '#' + device.id);
      anchor.innerHTML = conf.get('app:views:' + device.view + ':name');
      tab.appendChild(anchor);
      document.getElementById('tabs').appendChild(tab);

      // initialize tabs
      $('ul.tabs').tabs('select_tab', device.id);
    }
  }

  disableCategoryInteraction(): void {
    let categoriesWrapper = document.getElementById('vis-settings-categories');
    let categoryCheckboxes = categoriesWrapper.getElementsByTagName('input');
    for (let i = 0; i < categoryCheckboxes.length; i++) {
      categoryCheckboxes[i].checked = true;
      categoryCheckboxes[i].disabled = true;
    }
  }

  onAttributeState(device) {
    this._devices[device.id] = device;

    // updates the data mapping form
    this.addDeviceTab(device);
  }

  onSubGroupLeft() {
    for (let key in this._devices) {
      let device = this._devices[key];
      let inputContainer = document.getElementById(device.id);
      let tab = document.getElementById('tab-' + device.id);
      inputContainer.parentNode.removeChild(inputContainer);
      tab.parentNode.removeChild(tab);
    }

    this._devices = {};

    $('ul.tabs').tabs('select_tab', 'tab-default');

    this.disableCategoryInteraction();
  }

  onDeviceLeft(device) {
    let inputContainer = document.getElementById(device.id);
    let tab = document.getElementById('tab-' + device.id);
    inputContainer.parentNode.removeChild(inputContainer);
    tab.parentNode.removeChild(tab);

    delete this._devices[device.id];

    $('ul.tabs').tabs('select_tab', 'tab-default');

    this.disableCategoryInteraction();
  }

  onViewLoaded(content) {
    // Workaround since `deviceArea.innerHTML += content` would kill existing event listener
    // see http://stackoverflow.com/a/25046766
    let tmpNode = document.createElement('div');
    tmpNode.innerHTML = content;
    this._parent.appendChild(tmpNode.firstElementChild);

    // initialize tabs
    $('ul.tabs').tabs();

    // server requests: years, attributes
    utility.apiLoad((data) => this.onYearsLoaded(data), 'data/times', 'meta');
    utility.apiLoad((data) => this.onAttributesLoaded(data), 'data/attributes', "meta");

    // register window callbacks
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onAttributesLoaded(receivedData) {
    // parses the JSON and saves the data (cache)
    this._cacheMeta['attributes'] = JSON.parse(receivedData);
    if (!this._cacheMeta['years']) return;
    this.registerView();
  }

  onYearsLoaded(receivedData) {
    // parses the JSON and saves the data (cache)
    this._cacheMeta['years'] = JSON.parse(receivedData);
    if (!this._cacheMeta['attributes']) return;
    this.registerView();
  }

  registerView(){
    // registers this module
    this._visClientController.registerView(this);
  }

  initializeTimeSlider(slider, min, max, year, deviceId) {
    // configure time slider
    noUiSlider.create(slider, {
      start: year,
      connect: 'lower',
      step: 1,
      range: {'min': min, 'max': max},
      format: wNumb({decimals: 0})
    });
    slider.noUiSlider.on('update', () => this.onTimeSliderChanged(slider, deviceId));
  }

  onDataMappingCategoryCheckboxChanged(checkbox, deviceId) {
    let device = this._devices[deviceId];
    if (!device.dataAttr)
      return;

    // format of the id is 'filled-in-box' + index;
    let id:Number = Number(checkbox.id.substr('filled-in-box'.length));

    if(checkbox.checked) {
      // remove element from array
      let index = device.dataAttr.filteredRegions.indexOf(id, 0);
      if (index > -1) {
        device.dataAttr.filteredRegions.splice(index, 1);
      }
    } else {
      device.dataAttr.filteredRegions.push(id);
    }

    let changedDataAttr = { filteredRegions: [] };
    changedDataAttr.filteredRegions = device.dataAttr.filteredRegions;

    // notify connected views: send updated data attributes
    this._visClientController.emitEvent(conf.get('events:settings:attributesUpdate'), {
      dataAttr: changedDataAttr,
      deviceId: deviceId
    });
  }

  onDataMappingCheckboxChanged(checkbox, deviceId) {
    let device = this._devices[deviceId];
    if (!device.dataAttr)
      return;

    if(checkbox.checked) {
      // remove element from array
      let index = device.dataAttr.attrMappings['disabled'].indexOf(checkbox.id, 0);
      if (index > -1) {
        device.dataAttr.attrMappings['disabled'].splice(index, 1);
      }
    } else {
      device.dataAttr.attrMappings['disabled'].push(checkbox.id);
    }

    let changedDataAttr = { attrMappings: { } };
    changedDataAttr.attrMappings['disabled'] = device.dataAttr.attrMappings['disabled'];

    // notify connected views: send updated data attributes
    this._visClientController.emitEvent(conf.get('events:settings:attributesUpdate'), {
      dataAttr: changedDataAttr,
      deviceId: deviceId
    });
  }

  onDataMappingSelectionChanged(select, deviceId) {
    let device = this._devices[deviceId];
    if (!device.dataAttr)
      return;

    let dataAttrName = select.getAttribute('data-attr');
    let currentValue = device.dataAttr.attrMappings[dataAttrName],
      newValue = select.value;

    // notify connected views: send updated data attributes
    if (currentValue != newValue) {
      device.dataAttr.attrMappings[dataAttrName] = newValue;
      let changedDataAttr = {attrMappings: {}};
      changedDataAttr.attrMappings[dataAttrName] = newValue;
      this._visClientController.emitEvent(conf.get('events:settings:attributesUpdate'), {
        dataAttr: changedDataAttr,
        deviceId: deviceId
      });
    }
  }

  onTimeSliderChanged(slider, deviceId) {
    // get the current year
    let year = slider.noUiSlider.get();

    let device = this._devices[deviceId];
    // notify connected views: send updated data attributes (incl. new year)
    if (device.dataAttr && device.dataAttr.attr.year != year) {
      device.dataAttr.attr.year = year;
      this._visClientController.emitEvent(conf.get('events:settings:attributesUpdate'), {
        dataAttr: {
          attr: {
            year: year
          }
        },
        deviceId: deviceId
      });
    }

    // update the UI to show the current year
    this.updateCurrentYearNode(year, deviceId);
  }

  updateCurrentYearNode(year, deviceId) {
    let currYearNode = document.getElementById('time-current-year-' + deviceId);
    if (!currYearNode)
      console.error('visSettingsMenu: Oops, no dom node for current year found. This is strange!');


    currYearNode.innerHTML = year;
  }

  onWindowResize() {
    // sets the width and height based on the parent node
    let boundingRect = this._parent.getBoundingClientRect();
    this._size.outer.width = boundingRect.width;
    this._size.outer.height = boundingRect.height;
    this._size.inner.width = this._size.outer.width - this._padding.left - this._padding.right;
    this._size.inner.height = this._size.outer.height - this._padding.top - this._padding.bottom;

    // updates the view
    this.updateView();
  }

  updateView() {
    // TODO update the setting menu
  }
}
