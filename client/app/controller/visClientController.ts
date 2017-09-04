// module that controls the client application
//define(
//  ['require', 'utility', 'socketIO', 'identification', 'conf', 'shake', 'log', 'lineChart'],
//  function (require, utility, io, identification, conf, Shake, log, lineChart) {

import * as conf from "../../conf";
import * as utility from "../../utility";
import * as identification from "../initialization/identification";
import {Scatterplot} from "../views/visualizations/scatterplot";
import {BarChart} from "../views/visualizations/barChart";
import {Table} from "../views/visualizations/table";
import {LineChart} from "../views/visualizations/lineChart";
import {ParallelCoordinates} from "../views/visualizations/parallelCoordinates";
import {Streamgraph} from "../views/visualizations/streamgraph";
import {VisSettingsMenu} from "../views/visSettingsMenu";

let socketIO = require('socket.io-client');

export enum ViewType {
  vis = 1,
  menu = 2
}

export interface IViewAttributes {
  mandatory: string[];
  optional: string[];
}

export interface IViewConfig {
  name: string;
  description?: string;
  icon: string;
  type: ViewType;
  attributes: IViewAttributes;
  characteristics: string[];
}

export interface IView {
  id: string;
  class: any;
  config?: IViewConfig;
}

export interface IAvailableViews {
  [index: string]: IView;
}

export class VisClientController {

  private _socket = socketIO.connect(window.location.host + '/visApp');
  private _socketConnected = true;
  private _activeView;
  private _loadVisualizationMethod;
  private _workspaceColor;

  private availableViews: IAvailableViews = {};

  private _updateServerStatusInterval = setInterval(() => this.updateServerStatus(), 100);

  constructor(loadVisualization) {
    this._socket.on('connect', () => setInterval(() => this.updateServerStatus(), 100));
    this._socket.on('reconnect', function() {
      location.reload();
    });

    this.registerAvailableView(Table.viewId, Table);
    this.registerAvailableView(Scatterplot.viewId, Scatterplot);
    this.registerAvailableView(BarChart.viewId, BarChart);
    this.registerAvailableView(LineChart.viewId, LineChart);
    this.registerAvailableView(ParallelCoordinates.viewId, ParallelCoordinates);
    this.registerAvailableView(Streamgraph.viewId, Streamgraph);
    this.registerAvailableView(VisSettingsMenu.viewId, VisSettingsMenu);

    this._loadVisualizationMethod = loadVisualization;

    // TODO: Reintergrate fullscreen check, probably in vistiles-server.ts
    /*if (window.localStorage['desktop'] != 'true' && !(utility.isFullScreen()))
      this.requestFullScreen(() => this.setupListeners());
    else
      this.setupListeners();*/

    this._socket.on(conf.get('events:workspace:created'), (data) => this.onWorkspaceCreated(data));
    this._socket.on(conf.get('events:workspace:joined'), (data) => this.onWorkspaceJoined(data));
    this._socket.on(conf.get('events:workspace:joinedSilent'), (data) => this.onWorkspaceJoinedSilent(data));
    this._socket.on(conf.get('events:workspace:left'), () => this.onWorkspaceLeft());
    this._socket.on(conf.get('events:workspace:getAll'), (data, device) => this.onGetAllWorkspaces(data, device));
    this._socket.on(conf.get('events:subGroup:joined'), () => this.onSubGroupJoined());
    this._socket.on(conf.get('events:subGroup:left'), () => this.onSubGroupLeft());
    this._socket.on(conf.get('events:subGroup:notPossible'), () => this.onSubGroupNotPossible());
    this._socket.on(conf.get('events:view:forceLoad'), (data) => this.onViewForceLoad(data));
    this._socket.on(conf.get('events:combinationMenu:trigger'), (data) => this.onCombinationMenuTrigger(data));
    this._socket.on(conf.get('events:combinationMenu:remove'), () => this.removeCombinationMenu());
    this._socket.on(conf.get('events:combinationMenu:toggle'), () => VisClientController.toggleCombinationMenu());
    this._socket.on(conf.get('events:view:aligned'), (data) => VisClientController.onViewAligned(data));
    this._socket.on(conf.get('events:combination:triggered'), (data) => this.onTriggeredCombination(data));

    //Todo: Reintegrate shake?
    /*let shakeRecognizer = new Shake({
     threshold: 7,
     timeout: 200
     });
     shakeRecognizer.start();
     window.addEventListener('shake', leaveWorkspace, false);*/

    this.emitEvent(conf.get('events:device:initialized'));

    let control = document.getElementById("combinationMenu").getElementsByClassName("menu-control")[0];

    control.addEventListener("click", () => {
      this.emitEvent(conf.get('events:combinationMenu:toggle'));
      VisClientController.toggleCombinationMenu();
    });
  }

  requestFullScreen(callback) {
    utility.showOverlay(
      conf.get('strings:controller:requestFullScreen:title'),
      conf.get('strings:controller:requestFullScreen:info'), {
        iconCode: 'fullscreen',
        iconClass: 'light-green-text',
        buttonText: conf.get('strings:controller:requestFullScreen:button')
      });
    document.getElementById('loading-button').addEventListener('click', launchFullScreen);

    function launchFullScreen() {
      document.getElementById('loading-button').removeEventListener('click', launchFullScreen);
      utility.launchFullScreen();
      utility.hideLoadingSpinner();
      callback();
    }
  }

  emitEvent(name, values?) {
    this._socket.emit(name, {values: values, from: identification.getDevice().id});
  }

  /**
   * Returns a dictionary containing all available views. The key is the ID of
   * a view. The value is the view itself.
   *
   * @returns {{}} Dictionary with available views, viewID (key) to view (value)
   */
  getAvailableViews (): IAvailableViews {
    return this.availableViews;
  }

  registerView(view) {
    this._activeView = view;

    for (let eventName in this._activeView.eventCallbacks) {
      if (!this._activeView.eventCallbacks.hasOwnProperty(eventName))
        continue;

      this._socket.on(eventName, this._activeView.eventCallbacks[eventName]);
    }

    // Inform server about loaded visualization
    let data;
    if (conf.get('app:views:' + this._activeView.viewId + ':type') == 1) {
      data = {
        view: this._activeView.viewId,
        dataAttr: this._activeView.dataAttr,
        objects: this._activeView.getObjects(),
        size: this._activeView.viewPortSize
      };
    } else {
      data = {
        view: this._activeView.viewId,
        forceLoaded: this._activeView._forceLoaded
      };
    }

    this.emitEvent(conf.get('events:view:loaded'), data);
  }

  private onCombinationMenuTrigger(data): void {
    // angle should be screen.orientation.angle, but doesn't seem to be valid with typescript 2.3.4
    let angle = window.screen['orientation'].angle;
    let adjusted = VisClientController.adjustOrientation(data.position, angle);
    let menu: HTMLElement = document.getElementById("combinationMenu");
    data.labels = {};

    // display the menu
    menu.classList.remove("position-left", "position-top", "position-right", "position-bottom", "is-visible");
    menu.classList.add("position-" + adjusted, "is-visible");

    this.updateCombinationMenu(data.device.source.combinations, data.device.source.id, adjusted);
  }

  private updateCombinationMenu(combinations, from: string, position: string): void {
    // vars needed for the menu
    let info = {
      combinations: combinations,
      from: from, // this device id
      position: position // menu position [top, left, bottom, right]
    };

    // get HTML content for the menu
    utility.apiLoad(
      (response) => this.setCombinationMenuContent(response), 'modules', 'combination-list', { data: info }
    );
  }

  private setCombinationMenuContent(response): void {
    let menu: HTMLElement = document.getElementById("combinationMenu");
    let content = menu.querySelector(".menu-content");
    content.innerHTML = response;

    //attach event handlers
    let menuListElements = content.querySelectorAll(".combination");
    for (let i = 0; i < menuListElements.length; i++){
      let element = menuListElements[i];
      element.addEventListener('click', (e) => this.triggerCombination(<HTMLElement>e.target));
    }
  }

  private triggerCombination(target: HTMLElement): void {
    // if label was clicked, set list element as target
    if (!target.classList.contains("combination")){
      target = target.parentElement;
    }

    // prevent trigger if list element is disabled
    if (!target.classList.contains("disabled")){
      let data = {
        method: target.dataset.combination,
        devices: {
          target: target.dataset.target,
          source: target.dataset.source
        }
      };
      this.emitEvent(conf.get('events:combination:trigger'), data);
    }
  }

  private static toggleCombinationMenu(): void {
    let menu = document.getElementById("combinationMenu");
    if (menu.classList.contains("is-closed")){
      menu.classList.remove("is-closed");
    } else {
      menu.classList.add("is-closed");
    }
  }

  private removeCombinationMenu(data?: Object): void {
    let menu: HTMLElement = document.getElementById("combinationMenu");
    let content = menu.querySelector(".menu-content");

    if (data){
      if(data['source'] === "onWorkspaceLeft"){
        let deviceId = identification.getDevice().id;
        let combinations = menu.getElementsByClassName("combination");
        let targets = [];

        // get target devices (ids)
        for (let index = 0; index < combinations.length; index++){
          let id = combinations[index].getAttribute("data-target");
          if (id === deviceId) {
            targets.push(combinations[index].getAttribute("data-source"));
          } else {
            targets.push(id);
          }
        }

        // delete duplicate targets
        // https://stackoverflow.com/questions/16747798/delete-duplicate-elements-from-an-array
        targets = targets.filter(function(elem, index, self) {
          return index == self.indexOf(elem);
        });

        // emit event to target devices
        for(let index = 0; index < targets.length; index++){
          this.emitEvent(conf.get('events:combinationMenu:remove'), { target: targets[index] });
        }
      }
    }
    content.innerHTML = "";
    menu.className = "";
  }

  private onTriggeredCombination(data: Object): void {
    let menu: HTMLElement = document.getElementById("combinationMenu");
    let position: string;
    if (menu.classList.contains("position-left")) position = "left";
    if (menu.classList.contains("position-top")) position = "top";
    if (menu.classList.contains("position-bottom")) position = "bottom";
    if (menu.classList.contains("position-right")) position = "right";
    this.updateCombinationMenu(data['combinations'], data['source'], position);
  }

  // adjust orientation depending on angle (counter clockwise)
  private static adjustOrientation(position: string, angle: number): string {
    if (angle === 0) return position;

    switch (position){
      case "top":
        if (angle === 90) return "left";
        if (angle === 180) return "bottom";
        if (angle === 270) return "right";
        break;
      case "left":
        if (angle === 90) return "bottom";
        if (angle === 180) return "right";
        if (angle === 270) return "top";
        break;
      case "bottom":
        if (angle === 90) return "right";
        if (angle === 180) return "top";
        if (angle === 270) return "left";
        break;
      case "right":
        if (angle === 90) return "top";
        if (angle === 180) return "left";
        if (angle === 270) return "bottom";
        break;
    }

    return undefined;
  }

  onWorkspaceCreated(data) {
    let msg: string;
    this._workspaceColor = data.color;
    this.setBorderColor(this._workspaceColor);
    if (data.id === "workspace-0") {
      msg = conf.get('strings:controller:masterWorkspace:created');
    } else {
      msg = conf.get('strings:controller:workspace:created');
    }
    utility.displayToast(utility.strFormat(msg, data.color));
    utility.playLinkedIndicator(this._workspaceColor, 'lighten-3');

    if (this._activeView && this._activeView.emitCurrentState) {
      this._activeView.emitCurrentState();
    }
  }

  onWorkspaceJoined(data) {
    let msg: string;
    this._workspaceColor = data.color;
    this.setBorderColor(this._workspaceColor);
    if (data.id === "workspace-0") {
      msg = conf.get('strings:controller:masterWorkspace:joined');
    } else {
      msg = conf.get('strings:controller:workspace:joined');
    }
    utility.displayToast(
      utility.strFormat(msg, this._workspaceColor));
    utility.playLinkedIndicator(this._workspaceColor, 'lighten-3');
  }

  onWorkspaceJoinedSilent(data) {
    this._workspaceColor = data.color;
    this.setBorderColor(data.color);
    utility.playLinkedIndicator(this._workspaceColor, 'lighten-3');
  }

  onWorkspaceLeft() {
    let colorClass = this.getBorderColor();
    this.setBorderColor();

    if (colorClass)
      utility.displayToast(
        utility.strFormat(conf.get('strings:controller:workspace:left'), colorClass));

    if(document.getElementById("combinationList")){
      let data = {
        source: "onWorkspaceLeft"
      };
      this.removeCombinationMenu(data);
    }
  }

  onSubGroupJoined() {
    this.setBorderIntensityStrong();
    utility.playLinkedIndicator(this._workspaceColor, 'lighten-1');
    utility.displayToast('Applied device combination.', 'success');

    if (this._activeView && this._activeView.emitCurrentState) {
      this._activeView.emitCurrentState();
    }
  }

  onSubGroupLeft() {
    this.setBorderIntensityDefault();
    utility.displayToast('End device combination.');
    this.removeCombinationMenu();
  }

  onSubGroupNotPossible() {
    utility.displayToast('Device combination not possible.', 'warn')
  }

  onViewForceLoad(data) {
    switch(data.view){
      // x-axis, y-axis, (size) and year
      case "scatterplot":
        this._loadVisualizationMethod([data.dataAttr.attrMappings.axisX, data.dataAttr.attrMappings.axisY, data.dataAttr.attrMappings.size],
          data.view, data.dataAttr.attr.year);
        break;

      // y-axis and year
      case "barChart":
        this._loadVisualizationMethod([data.dataAttr.attrMappings.axisY], data.view, data.dataAttr.attr.year);
        break;

      // y-axis selected, no year
      case "lineChart":
      case "streamgraph":
        this._loadVisualizationMethod([data.dataAttr.attrMappings.axisY], data.view);
        break;

      // no attributes selected, but year
      case "table":
      case "parallelCoordinates":
        this._loadVisualizationMethod([], data.view, data.dataAttr.attr.year);
        break;

      case "visSettingsMenu":
        this._loadVisualizationMethod([], data.view);
        break;

      default:
        utility.displayToast('Force-loaded ' + data.view + " failed", 'warn');
        return;
    }
    utility.displayToast('Force-loaded ' + data.view);
  }

  private static onViewAligned(data: Object): void {
    if (data !== null) {
      utility.displayToast('View aligned');
    }
  }

  changeWorkspaceMenuBtnHandler() {
    this.emitEvent(conf.get('events:workspace:getAll'));
  }

  onGetAllWorkspaces(data: Object, device): void {
    utility.apiLoad(
      (response) => this.displayWorkspaceModal(response), 'modules', 'workspace-menu', {data: data, device: device}
    )
  }

  displayWorkspaceModal(content: any): void {
    document.getElementById("workspaceMenu").innerHTML = content;
    $("#workspaceMenu").openModal();
    document.getElementById("workspaceRadioList").addEventListener('click', (e) => this.onWorkspaceRadioListClickHandler(<HTMLElement>e.target));
    document.getElementById("changeWorkspaceBtn").addEventListener('click', (e) => this.changeWorkspaceModalBtnHandler(<HTMLElement>e.target));
    document.getElementById("createWorkspaceBtn").addEventListener('click', () => this.createWorkspaceModalBtnHandler());
  }

  onWorkspaceRadioListClickHandler(target: HTMLElement): void {
    let selected = document.querySelector('input[name="group"]:checked');
    if (target.tagName === "LABEL"){
      let disabled = target.previousElementSibling.getAttribute("disabled") === "disabled";
      if (!disabled || selected){
        document.getElementById("changeWorkspaceBtn").classList.remove("disabled");
      }
    }
  }

  changeWorkspaceModalBtnHandler(button: HTMLElement): void {
    if (!button.classList.contains("disabled")){
      let selected = document.querySelector('input[name="group"]:checked');
      let workspaceId = selected.id;
      this.emitEvent(conf.get('events:workspace:join'), {workspaceId: workspaceId});
      $("#workspaceMenu").closeModal();
    }
  }

  createWorkspaceModalBtnHandler(): void {
    this.emitEvent(conf.get('events:workspace:create'));
    $("#workspaceMenu").closeModal();
  }

  setBorderIntensityStrong() {
    let border = document.getElementById('border');
    border.classList.remove('lighten-3');
    border.classList.add('lighten-1');
    let menu = document.getElementById('menuDiv');
    let button = menu.getElementsByClassName('btn-floating')[0];
    button.classList.remove('lighten-3');
    button.classList.add('lighten-1');
  }

  setBorderIntensityDefault() {
    let border = document.getElementById('border');
    border.classList.remove('lighten-1');
    border.classList.add('lighten-3');
    let menu = document.getElementById('menuDiv');
    let button = menu.getElementsByClassName('btn-floating')[0];
    button.classList.remove('lighten-1');
    button.classList.add('lighten-3');
  }

  setBorderColor(color?) {
    let border = document.getElementById('border');
    if (color) {
      border.className = color + ' lighten-3';
    }
    else {
      border.className = '';
    }
    this.setMenuColor(color);
  }

  private setMenuColor(color?): void {
    let menu = document.getElementById('menuDiv');
    let button = menu.getElementsByClassName('btn-floating')[0];

    if (button !== null){
      if (color) {
        button.className = 'btn-floating btn-large toggle';
        button.classList.add(color);
        button.classList.add('lighten-3');
        //document.getElementById('menuIcon').style.display = 'none';
        //document.getElementById('syncIcon').style.display = 'inherit';
      } else {
        button.className = 'btn-floating btn-large toggle teal';
        //document.getElementById('menuIcon').style.display = '';
        //document.getElementById('syncIcon').style.display = '';
      }
    }
  }

  getBorderColor() {
    return document.getElementById('border').className.replace(' lighten-3', '');
  }

  updateServerStatus() {
    if (!(conf.loaded()))
      return;

    if (!this._socket.connected && this._socketConnected) {
      this._socketConnected = this._socket.connected;
      utility.showOverlay(
        conf.get('strings:controller:lostConnection:title'),
        conf.get('strings:controller:lostConnection:info'), {
          iconCode: 'sync_problem',
          iconClass: 'red-text'
        });
    }
  }

  // Todo: Think about an unregister method to reset socket listeners (issue #68).

  /**
   * Registers an available view for clients.
   *
   * @param view The view itself
   */
  private registerAvailableView (viewId: string, view: any) {
    if (viewId in this.availableViews) {
      console.warn('Trying to register two visualization modules with the same name');
    } else {
      this.availableViews[viewId] = {
        id: viewId,
        class: view,
        config: conf.get('app:views:'+viewId)
      };
    }
  }

  getActiveView() {
    return this._activeView;
  }
}
