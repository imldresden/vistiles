import * as conf from 'nconf';
import log from '../utility/logging';
import app from "../vistiles-server";
import {Device} from "../models/device";
import {Proximity} from "../utility/proximity";
import Socket = SocketIO.Socket;
import Namespace = SocketIO.Namespace;
import {DeviceManager} from "../models/deviceManager";

export class VisServerController {
  private _namespace: Namespace;
  private _workspaceIdCount: number = 0;
  private _workspaces: any = {};
  private _subGroupIdCount: number = 0;
  private _combinationChecks: any = require ('./viewCombinationChecks');
  private _deviceManager: DeviceManager;
  private _alignmentIdentifiers: any = {};

  constructor(namespace: Namespace, deviceManager: DeviceManager) {
    this._deviceManager = deviceManager;
    this._deviceManager.on('proximityChanged', (proximity: Proximity) => this.onProximityChanged(proximity));
    this._namespace = namespace;
    this.createMasterWorkspace();
  }

  createMasterWorkspace(): any {
    let workspaceId = this.generateWorkspaceId();

    this._workspaces[workspaceId] = {
      "color": VisServerController.getColorClass(workspaceId),
      "devices": [],
      "filteredViewportObjects": new Set(),
      "selectedObjects": new Set(),
      "subGroups": {}
    };
    return this._workspaces[workspaceId];
  }

  /**
   * Creates a new workspace by initializing a workspace dictionary, adding it to the
   * local workspaces dict and returning it.
   * @param devices List of devices that form the workspace
   * @returns {*}   The workspace dictionary
   */
  createWorkspace(devices: Device[]): any {
    let workspaceId = this.generateWorkspaceId();
    this._workspaces[workspaceId] = {
      "color": VisServerController.getColorClass(workspaceId),
      "devices": devices,
      "filteredViewportObjects": new Set(),
      "selectedObjects": new Set(),
      "subGroups": {}
    };

    for (let i = 0; i < devices.length; i++) {
      let deviceSocket = this.getSocketById(devices[i].socketId);
      deviceSocket.join(workspaceId);
      devices[i].workspaceId = workspaceId;
      deviceSocket.emit(VisServerController.event('workspace:created'), {color: this._workspaces[workspaceId].color, id: workspaceId});
    }
    return this._workspaces[workspaceId];
  }

  cleanUpWorkspaces(device: Device): string{
    for (let key in this._workspaces){
      if (!this._workspaces.hasOwnProperty(key)) continue;
      let devices = this._workspaces[key].devices;
      for (let index in devices){
        if (!devices.hasOwnProperty(index)) continue;
        if (device.id === devices[index].id){
          devices.splice(index, 1);
          return key;
        }
      }
    }
    return null;
  }

  joinWorkspace(device: Device, workspaceId: string): void {
    let deviceSocket = this.getSocketById(device.socketId);
    deviceSocket.join(workspaceId);
    device.workspaceId = workspaceId;
    let devices = this._workspaces[workspaceId].devices;
    let removedFromWorkspace = this.cleanUpWorkspaces(device);
    if (removedFromWorkspace) console.log("removed from: ", removedFromWorkspace);
    devices.push(device);
    deviceSocket.emit(VisServerController.event('workspace:joined'), {color: this._workspaces[workspaceId].color, id: workspaceId});
    this.emitSelectionState(device, false);
  }

  leaveWorkspace(device: Device): void {
    let workspaceId = device.workspaceId;
    device.workspaceId = undefined;

    if (device.subGroupId)
      this.leaveSubGroup(device);

    let devices = this._workspaces[workspaceId].devices;
    let deviceSocket = this.getSocketById(device.socketId);
    deviceSocket.leave(workspaceId);
    deviceSocket.emit(VisServerController.event('workspace:left'));

    devices.splice(devices.indexOf(device), 1);

    this._workspaces[workspaceId].devices = devices;
  }

  private static areInSameWorkspace(deviceA: Device, deviceB: Device): boolean {
    return deviceA.workspaceId === deviceB.workspaceId;
  }

  onWorkspaceCreate(data: Object): void {
    let device = this._deviceManager.getDevice(data["from"]);
    if (device.subGroupId) {
      this.leaveSubGroup(device);
    }
    this.leaveWorkspace(device);
    this.createWorkspace([device]);
  }

  onWorkspaceJoin(data: Object): void {
    let device = this._deviceManager.getDevice(data["from"]);
    let workspaceId = data['values']['workspaceId'];
    if (device.subGroupId) {
      this.leaveSubGroup(device);
    }
    this.leaveWorkspace(device);
    this.joinWorkspace(device, workspaceId);
  }

  onGetAllWorkspaces(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    let socket = this.getSocketById(device.socketId);
    socket.emit(VisServerController.event('workspace:getAll'), this._workspaces, device);
  }

  createSubGroup(deviceA: Device, deviceB: Device): void {
    if (deviceA.workspaceId != deviceB.workspaceId) return;
    if (deviceA.subGroupId || deviceB.subGroupId) return;

    let subGroupId = this.generateSubGroupId();
    this._workspaces[deviceA.workspaceId].subGroups[subGroupId] = {
      "devices": [deviceA, deviceB],
      "filteredViewportObjects": new Set()
    };

    this.addToSubGroup(deviceA, subGroupId);
    this.addToSubGroup(deviceB, subGroupId);
  }

  addToSubGroup(device: Device, subGroupId: string): void {
    let deviceSocket = this.getSocketById(device.socketId);
    deviceSocket.join(subGroupId);
    device.subGroupId = subGroupId;
    deviceSocket.emit(VisServerController.event('subGroup:joined'));
  }

  joinSubGroup(device: Device, subGroupId: string): void {
    let deviceSocket = this.getSocketById(device.socketId);
    deviceSocket.join(subGroupId);
    device.subGroupId = subGroupId;
    this._workspaces[device.workspaceId].subGroups[subGroupId].devices.push(device);
    deviceSocket.emit(VisServerController.event('subGroup:joined'));
  }

  leaveSubGroup(device: Device): void {
    if (!device.subGroupId) return;

    let subGroupId = device.subGroupId;
    device.subGroupId = undefined;
    let devices = this._workspaces[device.workspaceId].subGroups[subGroupId].devices;
    let deviceSocket = this.getSocketById(device.socketId);
    deviceSocket.to(subGroupId).emit(VisServerController.event('subGroup:hasLeft'), device);
    deviceSocket.leave(subGroupId);
    deviceSocket.emit(VisServerController.event('subGroup:left'));

    devices.splice(devices.indexOf(device), 1);

    this._workspaces[device.workspaceId].subGroups[subGroupId].devices = devices;
    if (devices.length == 1) {
      this.leaveSubGroup(devices[0]);
    } else if (devices.length == 0) {
      delete this._workspaces[device.workspaceId].subGroups[subGroupId];
    }
  }

  /**
   * Emits the selection state event to devices
   * @param device  The device to which workspace the data should be emitted.
   * @param workspace   Boolean, determines if the message should be emitted to the workspace (true)
   *                or only to the device itself (false).
   */
  emitSelectionState(device: Device, workspace: any): void {
    let socket = this.getSocketById(device.socketId);
    let data = Array.from(this._workspaces[device.workspaceId].selectedObjects);
    socket.emit(VisServerController.event('selection:state'), data);

    if (workspace) {
      socket = socket.to(device.workspaceId);
      socket.emit(VisServerController.event('selection:state'), data);
    }
  }

  /**
   * Helper method for an shorter access of event names from the config file.
   * @param confName      The config key without 'events' namespace.
   * @returns {*|String}  Returns the config value.
   */
  static event(confName: string): string {
    return conf.get('events:' + confName);
  }

  /**
   * Generate a workspace id based on a string and a counter. Updates counter.
   * @returns {string|*}  Returns the id.
   */
  generateWorkspaceId(): string {
    let id = 'workspace-' + this._workspaceIdCount;
    this._workspaceIdCount++;
    return id;
  }

  /**
   * Generate a sub-group id based on a string and a counter. Updates counter.
   * @returns {string|*}  Returns the id.
   */
  generateSubGroupId(): string {
    let id = 'subGroup-' + this._subGroupIdCount;
    this._subGroupIdCount++;
    return id;
  }

  /**
   * Returns a color class name based on a workspaceId. Extracts the number from the id and loads color
   * from a list (using position and modulo operation).
   * @param workspaceId The workspaceId.
   * @returns {*}   The color class name.
   */
  static getColorClass(workspaceId: string): string {
    //Remove 'workspace-' from id string
    let id = parseInt(workspaceId.slice(10));
    let colors = conf.get('app:workspaceColors');
    return colors[id % colors.length];
  }

  /**
   * Returns the socket to a given socketId.
   * @param socketId  Id of the socket.
   * @returns {*}     Socket.
   */
  getSocketById(socketId: string): Socket {
    return this._namespace.sockets[socketId];
  }

  /**
   * Called when device is initialized.
   * @param data  Dictionary, data.from is device id.
   */
  onDeviceInitialized(data: Object): void {
    let device = this._deviceManager.getDevice(data["from"]);
    device.view = undefined;

    this.joinWorkspace(device, "workspace-0");

    if (device.workspaceId) {
      let deviceSocket = this.getSocketById(device.socketId);
      deviceSocket.join(device.workspaceId);
      deviceSocket.emit(VisServerController.event('workspace:joinedSilent'), {color: this._workspaces[device.workspaceId].color});
    }
  }

  onFilterViewportState(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    if (device.subGroupId) {
      let subGroup = this._workspaces[device.workspaceId].subGroups[device.subGroupId];
      subGroup.filteredViewportObjects = new Set();
      for (let i = 0; i < data['values'].length; i++) {
        subGroup.filteredViewportObjects.add(data['values'][i]);
      }

      let socket = this.getSocketById(device.socketId);
      socket.to(device.subGroupId).emit(
        VisServerController.event('filter:viewportState'), Array.from(subGroup.filteredViewportObjects));
    }
  }

  onProximityChanged(proximity: Proximity): void {
    // if both devices are in the same workspace
    if (VisServerController.areInSameWorkspace(proximity.deviceA, proximity.deviceB)){
      // state = near
      if (proximity.state == conf.get('app:proximity:states:near')){
        this.deviceCoupling(proximity);
      } else
      // near -> mid
      if (proximity.previousState == conf.get('app:proximity:states:near')) {
        this.deviceDecoupling(proximity);
      }
    }
  }

  private deviceCoupling(proximity: Proximity): void {
    let deviceA = proximity.deviceA;
    let deviceB = proximity.deviceB;

    // update device relations
    deviceA.pairedDeviceLocation = proximity.combinationMenu.deviceA.menuPos;
    deviceB.pairedDeviceLocation = proximity.combinationMenu.deviceB.menuPos;

    // if both devices are not in subgroups
    if (!(deviceA.subGroupId) && !(deviceB.subGroupId)) {
      let combinations = this.getCombinations(deviceA, deviceB);

      if (proximity.combinationMenu.visible && combinations.length > 0){
        this.triggerCombinations(deviceA, deviceB, combinations);
      } else {
        let socketA = this.getSocketById(deviceA.socketId);
        let socketB = this.getSocketById(deviceB.socketId);
        socketA.emit(VisServerController.event('subGroup:notPossible'));
        socketB.emit(VisServerController.event('subGroup:notPossible'));
      }

    } else if ((deviceA.subGroupId && !(deviceB.subGroupId)) || (!(deviceA.subGroupId) && deviceB.subGroupId)) { // if exactly one device is in a subgroup
      // check which device is in the subgroup and which is not
      let deviceInSubGroup = deviceA.subGroupId ? deviceA : deviceB;
      let deviceNotInSubGroup = deviceInSubGroup == deviceA ? deviceB : deviceA;

      // prevent undefined views from auto-joining the subgroup
      if (deviceNotInSubGroup.view === undefined) {
        let socketA = this.getSocketById(deviceA.socketId);
        let socketB = this.getSocketById(deviceB.socketId);
        socketA.emit(VisServerController.event('subGroup:notPossible'));
        socketB.emit(VisServerController.event('subGroup:notPossible'));
        return;
      }

      // get all devices in the subgroup
      let subGroupDevices = this._workspaces[deviceInSubGroup.workspaceId].subGroups[deviceInSubGroup.subGroupId].devices;
      for (let i=0; i < subGroupDevices.length; i++) {
        if (subGroupDevices[i].filteredObjects.length) {
          //Emit not possible
          return;
        }
      }
      // let device join the subgroup
      this.joinSubGroup(deviceNotInSubGroup, deviceInSubGroup.subGroupId);

      for (let i = 0; i < subGroupDevices.length; i++) {
        if (subGroupDevices[i] == deviceNotInSubGroup)
          continue;

        if (this._combinationChecks['visualizationAlignment'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerVisualizationAlignment(subGroupDevices[i], deviceNotInSubGroup);

        if (this._combinationChecks['settingsMenuForVis'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerSettingsMenuForVis(subGroupDevices[i], deviceNotInSubGroup);

        if (this._combinationChecks['scatterPlotChartCombination'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerScatterPlotChartCombination(subGroupDevices[i], deviceNotInSubGroup);

        if (this._combinationChecks['tableChartCombination'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerTableChartCombination(subGroupDevices[i], deviceNotInSubGroup);

        if (this._combinationChecks['lineChartBarChartCombination'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerLineChartBarChartCombination(subGroupDevices[i], deviceNotInSubGroup);

        if (this._combinationChecks['parallelCoordinatesChartCombination'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerParallelCoordinatesChartCombination(subGroupDevices[i], deviceNotInSubGroup);

        if (this._combinationChecks['parallelCoordinatesStreamgraphCombination'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerParallelCoordinatesStreamgraphCombination(subGroupDevices[i], deviceNotInSubGroup);

        if(this._combinationChecks['streamgraphBarChartCombination'](subGroupDevices[i], deviceNotInSubGroup))
          this.triggerStreamgraphBarChartCombination(subGroupDevices[i], deviceNotInSubGroup);
      }
    } else { // if both devices are in subgroups
      let socketA = this.getSocketById(deviceA.socketId);
      let socketB = this.getSocketById(deviceB.socketId);
      socketA.emit(VisServerController.event('subGroup:notPossible'));
      socketB.emit(VisServerController.event('subGroup:notPossible'));
    }
  }

  private deviceDecoupling(proximity: Proximity): void {
    let deviceA = proximity.deviceA;
    let deviceB = proximity.deviceB;

    // if both devices are in the same subgroup
    if (deviceA.subGroupId && deviceB.subGroupId && deviceA.subGroupId == deviceB.subGroupId) {
      //TODO: Check which devices has moved -> only this device leaves the sub group

      // remove devices from their subgroup if they are not near to a device
      if (!this.hasNearProximity(deviceA)) {
        this.leaveSubGroup(deviceA);
      }
      if (!this.hasNearProximity(deviceB)) {
        this.leaveSubGroup(deviceB);
      }
    }
    let socketA = this.getSocketById(deviceA.socketId);
    let socketB = this.getSocketById(deviceB.socketId);
    socketA.emit(VisServerController.event('combinationMenu:remove'));
    socketB.emit(VisServerController.event('combinationMenu:remove'));
    deviceA.combinations = {};
    deviceB.combinations = {};
    this.cleanupCombinations(deviceA, deviceB);
  }

  private hasNearProximity(device: Device): boolean {
    let hasNearProximity = false;
    let proximites = this._deviceManager.getProximities(device);
    for (let i = 0; i < proximites.length; i++) {
      if (proximites[i].state == conf.get('app:proximity:states:near')) {
        hasNearProximity = true;
      }
    }
    return hasNearProximity;
  }

  private getCombinations(deviceA: Device, deviceB: Device): string[] {
    let combinations = [];
    deviceA.combinations = {};
    deviceB.combinations = {};

    // check for each possible combination
    for (let method in this._combinationChecks) {
      if (!this._combinationChecks.hasOwnProperty(method)) continue;

      // if the combination is possible
      if (this._combinationChecks[method](deviceA, deviceB)) {
        combinations.push(method);
        deviceA.combinations[method] = {
          target: deviceB.id,
          triggered: false,
          label: conf.get('strings:views:modules:combinationMenu:' + method),
          icon: conf.get('app:ui:combinationMenu:' + method)
        };
        deviceB.combinations[method] = {
          target: deviceA.id,
          triggered: false,
          label: conf.get('strings:views:modules:combinationMenu:' + method),
          icon: conf.get('app:ui:combinationMenu:' + method)
        };
      }
    }
    return combinations;
  }

  private triggerCombinations(deviceA: Device, deviceB: Device, combinations: string[]): void {
    if (combinations.length > 0) {
      let socketA = this.getSocketById(deviceA.socketId);
      let socketB = this.getSocketById(deviceB.socketId);

      socketA.emit(VisServerController.event('combinationMenu:trigger'), {
        position: deviceA.pairedDeviceLocation,
        device: {
          source: deviceB,
          target: deviceA
        },
        devices: [deviceA.id, deviceB.id],
        combinations: combinations
      });
      socketB.emit(VisServerController.event('combinationMenu:trigger'), {
        position: deviceB.pairedDeviceLocation,
        device: {
          source: deviceA,
          target: deviceB
        },
        devices: [deviceB.id, deviceA.id],
        combinations: combinations
      });
    } else {
      // if no combination is possible (-> no subgroup)
      let socketA = this.getSocketById(deviceA.socketId);
      let socketB = this.getSocketById(deviceB.socketId);
      socketA.emit(VisServerController.event('subGroup:notPossible'));
      socketB.emit(VisServerController.event('subGroup:notPossible'));
    }
  }

  private cleanupCombinations(deviceA: Device, deviceB: Device): void {
    // Todo: better handling of 'clean up' functionality

    // reset alignment
    if (this._combinationChecks['visualizationAlignment'](deviceA, deviceB)) {
      this.getSocketById(deviceA.socketId).emit(VisServerController.event('view:aligned'), null);
      this.getSocketById(deviceB.socketId).emit(VisServerController.event('view:aligned'), null);
    }

    if (deviceA.view == 'barChart' && deviceB.view == 'barChart' && deviceA.filteredObjects.length && deviceB.filteredObjects.length) {
      deviceA.filteredObjects = deviceB.filteredObjects = [];
      this.getSocketById(deviceA.socketId).emit(VisServerController.event('filter:displayExtension'), []);
      this.getSocketById(deviceB.socketId).emit(VisServerController.event('filter:displayExtension'), []);
    }

    if(deviceA.view == 'parallelCoordinates' || deviceB.view == 'parallelCoordinates'){
      if(deviceA.view == 'parallelCoordinates'){
        deviceA.filteredObjects = [];
        this.getSocketById(deviceA.socketId).emit(VisServerController.event('filter:viewportState'), []);
      }
      if(deviceB.view == 'parallelCoordinates'){
        deviceB.filteredObjects = [];
        this.getSocketById(deviceB.socketId).emit(VisServerController.event('filter:viewportState'), []);
      }
    }

    if(deviceA.view == 'streamgraph' || deviceB.view == 'streamgraph'){
      if(deviceA.view == 'streamgraph'){
        deviceA.filteredObjects = [];
        this.getSocketById(deviceA.socketId).emit(VisServerController.event('filter:viewportState'), []);
      }
      if(deviceB.view == 'streamgraph'){
        deviceB.filteredObjects = [];
        this.getSocketById(deviceB.socketId).emit(VisServerController.event('filter:viewportState'), []);
      }
    }
  }

  /**
   * Add objects to device/workspace selection. Emit new selection state to workspace.
   * @param data  Dictionary, data.from is device id, data.values the list of selected objects
   */
  onSelectionAdded(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    if (device.workspaceId) {
      for (let i = 0; i < data['values'].length; i++) {
        this._workspaces[device.workspaceId].selectedObjects.add(data['values'][i]);
      }

      this.emitSelectionState(device, true);
    }
  }

  /**
   * Remove objects from device/workspace selection. Emit new selection state to workspace.
   * @param data  Dictionary, data.from is device id, data.values the list of deselected objects
   */
  onSelectionRemoved(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    if (device.workspaceId) {
      for (let i = 0; i < data['values'].length; i++) {
        this._workspaces[device.workspaceId].selectedObjects.delete(data['values'][i]);
      }

      this.emitSelectionState(device, true);
    }
  }

  /**
   * Handles changes of overlays on client visualizations.
   * @param data  Dictionary, data.to is device id, data.from is device id, data.type type of the connection, domain: min/max values of the changed overlay
   */
  onOverlayChanged(data: Object): void {
    if(data['values'].type === 'spatialOverlayChange'){
      let device = this._deviceManager.getDevice(data['from']);
      let deviceSocket = this.getSocketById(device.socketId);
      deviceSocket.to(device.subGroupId).emit(VisServerController.event('spatial:remoteDomainChange'), {from: data['values'].from, to:data['values'].to, domain: data['values'].domain});
    }
  }

  /**
   * Handles changes of overlays on client visualizations.
   * @param data  Dictionary, data.to is device id, data.from is device id, data.data min/max values of the changed overlay
   */
  onRemoteOverlayChange(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    let deviceSocket = this.getSocketById(device.socketId);
    deviceSocket.to(device.subGroupId).emit(VisServerController.event('spatial:remoteOverlayChange'), data);
  }

  /**
   * When device has completely loaded a visualization; update information in device and
   * emit workspace selection state.
   * @param data  Dictionary, data.from is device id, data.values the visualization id
   */
  onViewLoaded(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    device.view = data['values'].view;
    if (conf.get('app:views:' + device.view + ':type') == 1) {
      device.dataAttr = data['values'].dataAttr;
      device.objects = data['values'].objects;
      device.viewPortSize = data['values'].size;
    } else {
      device.dataAttr = undefined;
      device.objects = [];
    }

    // If device is in a workspace, emit the current selection state
    //Todo: Add check if view is a visualization
    if (device.workspaceId)
      this.emitSelectionState(device, false);

    if (device.filteredObjects) {
      let socket = this.getSocketById(device.socketId);
      socket.emit(VisServerController.event('filter:displayExtension'), device.filteredObjects);
    }

    let targetId: string;
    // if there were already possible combinations while the view was undefined
    for (let method in device.combinations){
      let combination = device.combinations[method];
      targetId = combination.target;
    }
    if (targetId){
      // set devices
      let source: Device = device;
      let target: Device = this._deviceManager.getDevice(targetId);

      // update combinations menu
      let combinations = this.getCombinations(source, target);
      this.triggerCombinations(source, target, combinations);

      if (data['values'].forceLoaded){
        this.triggerCombination("settingsMenuForVis", source, target);
        let socketA = this.getSocketById(source.socketId);
        let socketB = this.getSocketById(target.socketId);
        socketA.emit(VisServerController.event('combinationMenu:remove'));
        socketB.emit(VisServerController.event('combinationMenu:remove'));
      }
    }
  }

  onAttributesUpdate (data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);

    if (device.subGroupId) {
      let subGroupDevices = this._workspaces[device.workspaceId].subGroups[device.subGroupId].devices;
      for (let i = 0; i < subGroupDevices.length; i++) {
        if (conf.get('app:views:' + subGroupDevices[i].view + ':type') == 1 && subGroupDevices[i].id !== device.id) {
          this.updateDictionary(subGroupDevices[i].dataAttr, data['values'].dataAttr);
          let deviceSocket = this.getSocketById(subGroupDevices[i].socketId);
          deviceSocket.emit(VisServerController.event('settings:attributesUpdate'), data['values'].dataAttr);
        }
      }
    } else {
      let receiverDevice = this._deviceManager.getDevice(data['values'].deviceId);
      this.updateDictionary(receiverDevice.dataAttr, data['values'].dataAttr);

      let deviceSocket = this.getSocketById(receiverDevice.socketId);
      deviceSocket.emit(VisServerController.event('settings:attributesUpdate'), data['values'].dataAttr);
    }
  }

  onAttributesState(data: Object): void {
    let device = this._deviceManager.getDevice(data['from']);
    device.dataAttr = data['values'];

    if (device.subGroupId) {
      let subGroupDevices = this._workspaces[device.workspaceId].subGroups[device.subGroupId].devices;
      for (let i = 0; i < subGroupDevices.length; i++){
        if (conf.get('app:views:' + subGroupDevices[i].view + ':type') == 2) {
          let deviceSocket = this.getSocketById(subGroupDevices[i].socketId);
          deviceSocket.emit(VisServerController.event('settings:attributesState'), device);
        }
      }
    }
  }

  updateDictionary(dict: Object, updatedValues: Object): void {
    for (let key in updatedValues) {
      if (!dict.hasOwnProperty(key))
        continue;

      if (typeof updatedValues[key] == 'object' && !Array.isArray(updatedValues[key])) {
        this.updateDictionary(dict[key], updatedValues[key]);
      } else {
        dict[key] = updatedValues[key];
      }
    }
  }

  triggerVisualizationAlignment(deviceA: Device, deviceB: Device): void {
    // first we need to know the size of the devices, so we ask them
    // since everything is asynchonous we need a way to identify the replies of both devices,
    // because there be collisions when two pairings happen at the same time
    let rnd = 'id' + Math.random().toString().substr(2);
    this.getSocketById(deviceA.socketId).emit(
        VisServerController.event('view:align'), { identifier: rnd }
    );
    this.getSocketById(deviceB.socketId).emit(
        VisServerController.event('view:align'), { identifier: rnd }
    );
  }


  alignDevices(data): void {
    let deviceA;
    let deviceB;
    let sizeDeviceA;
    let sizeDeviceB;
    let angleDeviceA;
    let angleDeviceB;

    let id = data.values.identifier;
    if(this._alignmentIdentifiers[id]) {
      // get the data from the first device
      deviceA = this._deviceManager.getDevice(data['from']);
      sizeDeviceA = data.values.size;
      angleDeviceA = data.values.angle;
      deviceB = this._deviceManager.getDevice(this._alignmentIdentifiers[id]['from']);
      sizeDeviceB = this._alignmentIdentifiers[id].values.size;
      angleDeviceB = this._alignmentIdentifiers[id].values.angle;
      delete this._alignmentIdentifiers[id];
    } else {
      // wait for the other device
      this._alignmentIdentifiers[id] = data;
      return;
    }

    // adjust for the dpi
    let sizeDeviceAInch = {width: sizeDeviceA.width / deviceA.dpi, height: sizeDeviceA.height / deviceA.dpi};
    let sizeDeviceBInch = {width: sizeDeviceB.width / deviceB.dpi, height: sizeDeviceB.height / deviceB.dpi};

    let locationDeviceA = this.adjustOrientation(deviceA.pairedDeviceLocation, angleDeviceA);
    let locationDeviceB = this.adjustOrientation(deviceB.pairedDeviceLocation, angleDeviceB);

    let newSize = { width: 0, height: 0 };
    let offset = { top: 0, left: 0, bottom: 0, right: 0 };
    let target;

    if((locationDeviceA === 'left' && locationDeviceB === 'right') ||
        (locationDeviceA === 'right' && locationDeviceB === 'left')) {

      // calculate new size
      if(sizeDeviceAInch.height > sizeDeviceBInch.height) {
        offset.top = sizeDeviceAInch.height - sizeDeviceBInch.height;
        newSize.width = sizeDeviceAInch.width;
        newSize.height = sizeDeviceBInch.height;
        target = deviceA;
      } else if (sizeDeviceAInch.height < sizeDeviceBInch.height) {
        offset.top = sizeDeviceBInch.height - sizeDeviceAInch.height;
        newSize.width = sizeDeviceBInch.width;
        newSize.height = sizeDeviceAInch.height;
        target = deviceB;
      } else {
        // same size, nothing to do
        return;
      }
    } else if((locationDeviceA === 'top' && locationDeviceB === 'bottom') ||
        (locationDeviceA === 'bottom' && locationDeviceB === 'top')) {

      // calculate new size
      if(sizeDeviceAInch.width > sizeDeviceBInch.width) {
        offset.left = sizeDeviceAInch.width - sizeDeviceBInch.width;
        newSize.height = sizeDeviceAInch.height;
        newSize.width = sizeDeviceBInch.width;
        target = deviceA;
      } else if(sizeDeviceAInch.width < sizeDeviceBInch.width) {
        offset.left = sizeDeviceBInch.width - sizeDeviceAInch.width;
        newSize.height = sizeDeviceBInch.height;
        newSize.width = sizeDeviceAInch.width;
        target = deviceB;
      } else {
        // same size, nothing to do
        return;
      }
    } else {
      // other alignments don't make any sense
      return;
    }

    // calculate back to pixels
    offset.top = Math.round(offset.top * target.dpi);
    newSize.width = Math.round(newSize.width * target.dpi);
    newSize.height = Math.round(newSize.height * target.dpi);

    let socket = this.getSocketById(target.socketId);
    socket.emit(
      VisServerController.event('view:aligned'), { size: newSize, offset: offset }
    );
  }

  // adjust orientation depending on angle (counter clockwise)
  private adjustOrientation(position: string, angle: number): string {
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

  triggerBarChartDisplayExtension(deviceA: Device, deviceB: Device): void {
    let objects = deviceA.objects.length > 0 ? Array.from(deviceA.objects) : Array.from(deviceB.objects);
    let objectsSecond = objects.splice(
      Math.round(objects.length / 2), objects.length - Math.round(objects.length / 2));

    let socket = this.getSocketById(deviceB.socketId);
    deviceB.filteredObjects = objects;
    if (!deviceB.view) {
      socket.emit(
        VisServerController.event('view:forceLoad'), {
          view: deviceA.view,
          dataAttr: deviceA.dataAttr,
          objects: deviceA.objects
        }
      );
    } else
      socket.emit(VisServerController.event('filter:displayExtension'), objects);

    socket = this.getSocketById(deviceA.socketId);
    deviceA.filteredObjects = objectsSecond;
    if (!deviceA.view) {
      socket.emit(
        VisServerController.event('view:forceLoad'), {
          view: deviceB.view,
          dataAttr: deviceB.dataAttr,
          objects: deviceB.objects
        }
      );
    } else
      socket.emit(VisServerController.event('filter:displayExtension'), objectsSecond);
  }

  triggerCloneViewCombination(deviceA: Device, deviceB: Device): void {
    let deviceWithoutView = !deviceB.view ? deviceB : deviceA;
    let deviceWithView = !deviceB.view ? deviceA : deviceB;

    deviceWithoutView.filteredObjects = deviceWithView.filteredObjects;

    let socket = this.getSocketById(deviceWithoutView.socketId);
    socket.emit(
      VisServerController.event('view:forceLoad'), {
        view: deviceWithView.view,
        dataAttr: deviceWithView.dataAttr,
        objects: Array.from(deviceWithView.objects),
        devices: {
          source: deviceWithView,
          target: deviceWithoutView
        }
      }
    );
  }

  triggerScatterPlotChartCombination(deviceA: Device, deviceB: Device): void{
    let deviceWithoutScatterplot = deviceA.view != 'scatterplot' ? deviceA : deviceB;
    let deviceWithScatterplot = deviceA.view == 'scatterplot' ? deviceA : deviceB;
    let subGroup = this._workspaces[deviceWithoutScatterplot.workspaceId].subGroups[deviceWithoutScatterplot.subGroupId];
    let socket = this.getSocketById(deviceWithoutScatterplot.socketId);
    socket.emit(
      VisServerController.event('filter:viewportState'), Array.from(subGroup.filteredViewportObjects)
    );
    socket.emit(
      VisServerController.event('settings:attributesState'), deviceWithScatterplot
    );
  }

  triggerLineChartBarChartCombination(deviceA: Device, deviceB: Device) {
    let deviceWithLineChart = deviceA.view == 'lineChart' ? deviceA : deviceB;
    let deviceWithBarChart = deviceA.view == 'barChart' ? deviceA : deviceB;
    let socket = this.getSocketById(deviceWithLineChart.socketId);
    socket.emit(
      VisServerController.event('settings:attributesState'), deviceWithBarChart
    );
  }

  triggerLineChartStreamgraphCombination(deviceA: Device, deviceB: Device) {
    let deviceWithLineChart = deviceA.view == 'lineChart' ? deviceA : deviceB;
    let subGroup = this._workspaces[deviceWithLineChart.workspaceId].subGroups[deviceWithLineChart.subGroupId];
    let socket = this.getSocketById(deviceWithLineChart.socketId);
    socket.emit(
      VisServerController.event('filter:viewportState'), Array.from(subGroup.filteredViewportObjects)
    );
  }

  triggerTableChartCombination(deviceA: Device, deviceB: Device): void{
    let deviceWithTable = deviceA.view == 'table' ? deviceA : deviceB;
    let deviceWithoutTable = deviceA.view != 'table' ? deviceA : deviceB;
    let subGroup = this._workspaces[deviceWithoutTable.workspaceId].subGroups[deviceWithoutTable.subGroupId];
    let socket = this.getSocketById(deviceWithoutTable.socketId);
    socket.emit(
      VisServerController.event('filter:viewportState'), Array.from(subGroup.filteredViewportObjects)
    );
    socket.emit(
      VisServerController.event('settings:attributesState'), deviceWithTable
    );
  }

  triggerSettingsMenuForVis(deviceA: Device, deviceB: Device) {
    let deviceWithVis = (conf.get('app:views:' + deviceA.view + ':type') == 1) ? deviceA : deviceB;
    let deviceWithoutVis = (deviceWithVis == deviceA) ? deviceB : deviceA;
    let subgroup = this._workspaces[deviceWithVis.workspaceId].subGroups[deviceWithVis.subGroupId];

    if (deviceWithoutVis.view === undefined && subgroup.devices.length === 2) {
      this.getSocketById(deviceWithoutVis.socketId).emit(
        VisServerController.event('view:forceLoad'), {
          view: "visSettingsMenu"
        }
      );
    } else {
      this.getSocketById(deviceWithoutVis.socketId).emit(
        VisServerController.event('settings:attributesState'), deviceWithVis
      );
    }
  }

  triggerParallelCoordinatesChartCombination(deviceA: Device, deviceB: Device) {
  	let deviceWithParallelCoordinates = deviceA.view == 'parallelCoordinates' ? deviceA : deviceB;
    let deviceWithoutParallelCoordinates = deviceA.view !== 'parallelCoordinates' ? deviceA : deviceB;
		let subGroup = this._workspaces[deviceWithParallelCoordinates.workspaceId].subGroups[deviceWithParallelCoordinates.subGroupId];
		let socket = this.getSocketById(deviceWithoutParallelCoordinates.socketId);
		socket.emit(
		  VisServerController.event('filter:viewportState'), Array.from(subGroup.filteredViewportObjects)
    );
    socket.emit(
      VisServerController.event('settings:attributesState'), deviceWithParallelCoordinates
    );
	}

	triggerParallelCoordinatesStreamgraphCombination(deviceA: Device, deviceB: Device) {
		let deviceWithParallelCoordinates = deviceA.view == 'parallelCoordinates' ? deviceA : deviceB;
		let subGroup = this._workspaces[deviceWithParallelCoordinates.workspaceId].subGroups[deviceWithParallelCoordinates.subGroupId];
		let socket = this.getSocketById(deviceWithParallelCoordinates.socketId);
		socket.emit(
		  VisServerController.event('filter:viewportState'), Array.from(subGroup.filteredViewportObjects)
    );
	}

	triggerStreamgraphBarChartCombination(deviceA: Device, deviceB: Device) {
  	let streamgraph = deviceA.view == 'streamgraph' ? deviceA : deviceB;
  	let barChart = deviceA.view == 'barChart' ? deviceA : deviceB;
  	let socket = this.getSocketById(streamgraph.socketId);
  	socket.emit(VisServerController.event('settings:attributesState'), barChart);
  }

  triggerCombination(method: string, deviceA: Device, deviceB: Device) {
    switch (method) {
      case 'visualizationAlignment':
        this.triggerVisualizationAlignment(deviceA, deviceB);
        break;
      case 'cloneViewCombination':
        this.triggerCloneViewCombination(deviceA, deviceB);
        break;
      case 'barChartDisplayExtension':
        this.triggerBarChartDisplayExtension(deviceA, deviceB);
        break;
      case 'scatterPlotChartCombination':
        this.triggerScatterPlotChartCombination(deviceA, deviceB);
        break;
      case 'tableChartCombination':
        this.triggerTableChartCombination(deviceA, deviceB);
        break;
      case 'lineChartBarChartCombination':
        this.triggerLineChartBarChartCombination(deviceA, deviceB);
        break;
      case 'lineChartStreamgraphCombination':
        this.triggerLineChartStreamgraphCombination(deviceA, deviceB);
        break;
      case 'parallelCoordinatesChartCombination':
        this.triggerParallelCoordinatesChartCombination(deviceA, deviceB);
        break;
      case 'parallelCoordinatesStreamgraphCombination':
        this.triggerParallelCoordinatesStreamgraphCombination(deviceA, deviceB);
        break;
      case 'streamgraphBarChartCombination':
        this.triggerStreamgraphBarChartCombination(deviceA, deviceB);
        break;
      case 'settingsMenuForVis':
        this.triggerSettingsMenuForVis(deviceA, deviceB);
        break;
    }

    let socketA = this.getSocketById(deviceA.socketId);
    let socketB = this.getSocketById(deviceB.socketId);
    socketA.emit(VisServerController.event('combination:triggered'), {
      method: method,
      source: deviceA.id,
      target: deviceB.id,
      combinations: deviceA.combinations
    });
    socketB.emit(VisServerController.event('combination:triggered'), {
      method: method,
      source: deviceB.id,
      target: deviceA.id,
      combinations: deviceB.combinations
    });
  }

  private onCombinationTrigger(data: Object): void {
    let method = data['values'].method;
    let devices = data['values'].devices;
    let deviceA = this._deviceManager.getDevice(devices.source);
    let deviceB = this._deviceManager.getDevice(devices.target);

    // if both devices have the combination listed as a possible combination
    if (deviceA.combinations.hasOwnProperty(method) && deviceB.combinations.hasOwnProperty(method)){

      // if target ids match
      if (deviceA.combinations[method].target == deviceB.id && deviceB.combinations[method].target == deviceA.id){
        deviceA.combinations[method].triggered = true;
        deviceB.combinations[method].triggered = true;
      } else {
        console.log("target ids dont match");
        return;
      }
    } else {
      console.log("method " + method + " not found for both devices");
      return;
    }

    if (method === "visualizationAlignment" || method === "cloneViewCombination"){
      this.triggerCombination(method, deviceA, deviceB);
      return;
    }

    // if both devices are not in subgroups
    if (!(deviceA.subGroupId) && !(deviceB.subGroupId)) {
      this.createSubGroup(deviceA, deviceB);
      this.triggerCombination(method, deviceA, deviceB);
    } else  // if exactly one device is in a subgroup
    if ((deviceA.subGroupId && !(deviceB.subGroupId)) || (!(deviceA.subGroupId) && deviceB.subGroupId)) {
      // check which device is in the subgroup and which is not
      let deviceInSubGroup = deviceA.subGroupId ? deviceA : deviceB;
      let deviceNotInSubGroup = deviceInSubGroup == deviceA ? deviceB : deviceA;
      // let device join the subgroup
      this.joinSubGroup(deviceNotInSubGroup, deviceInSubGroup.subGroupId);
      this.triggerCombination(method, deviceA, deviceB);
    }
  }

  private onRemoveCombinationMenu(data: Object): void {
    let device = this._deviceManager.getDevice(data['values'].target);
    let socket = this.getSocketById(device.socketId);
    socket.emit(VisServerController.event('combinationMenu:remove'));
  }

  private onToggleCombinationMenu(data: Object): void {
    let device: Device = this._deviceManager.getDevice(data['from']);
    let targets = [];
    let combinations = device.combinations;

    // get target devices (ids)
    for (let method in combinations){
      targets.push(combinations[method].target);
    }

    // delete duplicate targets
    // https://stackoverflow.com/questions/16747798/delete-duplicate-elements-from-an-array
    targets = targets.filter(function(elem, index, self) {
      return index == self.indexOf(elem);
    });

    // emit event to target devices
    for(let index = 0; index < targets.length; index++){
      let device = this._deviceManager.getDevice(targets[index]);
      let socket = this.getSocketById(device.socketId);
      socket.emit(VisServerController.event('combinationMenu:toggle'));
    }
  }

  register(socket: Socket): void {
    socket.on(VisServerController.event('device:initialized'), (data: Object) => this.onDeviceInitialized(data));
    socket.on(VisServerController.event('workspace:getAll'), (data: Object) => this.onGetAllWorkspaces(data));
    socket.on(VisServerController.event('workspace:create'), (data: Object) => this.onWorkspaceCreate(data));
    socket.on(VisServerController.event('workspace:join'), (data: Object) => this.onWorkspaceJoin(data));
    socket.on(VisServerController.event('filter:viewportState'), (data: Object) => this.onFilterViewportState(data));
    socket.on(VisServerController.event('selection:added'), (data: Object) => this.onSelectionAdded(data));
    socket.on(VisServerController.event('selection:removed'), (data: Object) => this.onSelectionRemoved(data));
    socket.on(VisServerController.event('spatial:overlayChanged'), (data: Object) => this.onOverlayChanged(data));
    socket.on(VisServerController.event('spatial:remoteOverlayChange'), (data: Object) => this.onRemoteOverlayChange(data));
    socket.on(VisServerController.event('view:loaded'), (data: Object) => this.onViewLoaded(data));
    socket.on(VisServerController.event('settings:attributesState'), (data: Object) => this.onAttributesState(data));
    socket.on(VisServerController.event('settings:attributesUpdate'), (data: Object) => this.onAttributesUpdate(data));
    socket.on(VisServerController.event('view:align'), (data: Object) => this.alignDevices(data));
    socket.on(VisServerController.event('combination:trigger'), (data: Object) => this.onCombinationTrigger(data));
    socket.on(VisServerController.event('combinationMenu:remove'), (data: Object) => this.onRemoveCombinationMenu(data));
    socket.on(VisServerController.event('combinationMenu:toggle'), (data: Object) => this.onToggleCombinationMenu(data));
  }
}

export default VisServerController;