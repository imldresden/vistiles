import {VisClientController} from "../controller/visClientController";

export abstract class View {
  protected _parent: HTMLElement;
  protected _visClientController: VisClientController;
  protected _eventCallbacks: {[id: string]: Object};

  get eventCallbacks(): {[id: string]: Object} { return this._eventCallbacks; };

  constructor(parent: HTMLElement, visClientController: VisClientController) {
    this._parent = parent;
    this._visClientController = visClientController;
    this._eventCallbacks = {};
  }
}