//script initiating identification and coupling processes and represents the app module

import * as conf from "../conf";
import * as utility from "../utility";
import * as log from "../logging";
import {Initialization} from "./initialization/initialization";
import {IView, ViewType, VisClientController} from "./controller/visClientController";
import {Menu} from "./ui/menu";
import {VisualizationPicker} from "./ui/visualizationPicker";
import {DataPicker} from "./ui/dataPicker";
import {TileSetup, TileSetupMode} from "./ui/tileSetup";

export class App {
  private _parent;
  private _visualizationParent;
  private _visualizationContainer;
  private _dataSource;
  private _viewId;
  private _visClientController: VisClientController;

  private _menuParent;
  private _menu: Menu;

  private _compTileSetup: TileSetup;
  private _domNodeTileSetup: HTMLElement;

  constructor() {
    // Combine with config value
    if (conf.get('app:detectDesktop'))
      window.localStorage['desktop'] = window.location.hostname == 'localhost';
    else
      window.localStorage['desktop'] = 'false';

    // find and save all relevant dom nodes as parents
    // for the different components
    this._parent = document.getElementById('app');
    this._domNodeTileSetup = document.getElementById('tile-setup');

    new Initialization(this._parent, () => this.initializationDone());
  }

  //consumes an element and returns an completely empty element at the same position
  static getClearedDiv(div) {
    let cNode = div.cloneNode(false);
    div.parentNode.replaceChild(cNode, div);
    return cNode;
  }

  //callback to be called if the coupling process has succeed
  initializationDone() {
    this._menuParent = document.getElementById('menuDiv');
    this._visClientController = new VisClientController((dataName, viewModule, dataYear) => this.loadView(dataName, viewModule, dataYear));

    // removes old content from the parent
    this._parent = App.getClearedDiv(this._parent);

    // loads and adds the global menu (floating menu button) to the view
    this._menu = new Menu(this._menuParent, this._visClientController);

    // loads and shows the tile setup component (menu)
    this._compTileSetup = new TileSetup(this._domNodeTileSetup, this._visClientController.getAvailableViews(), TileSetupMode.initial);
    this._compTileSetup.setCallbInitialSetupDone((viewInfo: IView, dataMapping?, dataYear?: number) => this.callbOnTileSetupDone(viewInfo, dataMapping, dataYear));
    this._menu.setTileSetup(this._compTileSetup);
    this._compTileSetup.showTileSetup();
  }

  private callbOnTileSetupDone(viewInfo: IView, dataMapping: string[] = [], dataYear?: number): void {
    this._viewId = viewInfo.id;
    this._dataSource = dataMapping;

    this._parent = App.getClearedDiv(this._parent);

    this._visualizationContainer = document.createElement('div');
    this._visualizationContainer.id = 'visualizationDivWrap';
    this._parent.appendChild(this._visualizationContainer);

    this._visualizationParent = document.createElement('div');
    this._visualizationParent.id = 'visualizationDiv';
    this._visualizationContainer.appendChild(this._visualizationParent);

    this._compTileSetup.hideTileSetup();

    if (viewInfo.config.type == ViewType.menu) {
      new viewInfo.class(this._visualizationParent, this._visClientController);
    } else if(viewInfo.config.type == ViewType.vis) {
      new viewInfo.class(this._visualizationParent, dataMapping, this._visClientController, dataYear);
    }
  }

  /* This function only exists for the automatic display extension and clone view combination, which
  kinda forces a tile to load a specific view. */
  loadView(dataName?, newViewModule?, dataYear?) {
    if (newViewModule)
      this._viewId = newViewModule;
    this._dataSource = dataName;
    this._parent = App.getClearedDiv(this._parent);

    this._visualizationContainer = document.createElement('div');
    this._visualizationContainer.id = 'visualizationDivWrap';
    this._parent.appendChild(this._visualizationContainer);

    this._visualizationParent = document.createElement('div');
    this._visualizationParent.id = 'visualizationDiv';
    this._visualizationContainer.appendChild(this._visualizationParent);

    this._compTileSetup.hideTileSetup();

    let viewInfo: IView = this._visClientController.getAvailableViews()[this._viewId];
    if (viewInfo.config.type == ViewType.vis) { // visualization view
      if (viewInfo.config.characteristics.indexOf("time-based") >= 0) { // time-based
        new viewInfo.class(this._visualizationParent, this._dataSource, this._visClientController);
      } else { // not time-based, year needed
        new viewInfo.class(this._visualizationParent, this._dataSource, this._visClientController, dataYear);
      }
    }
    else if (viewInfo.config.type == ViewType.menu) // settings view
      new viewInfo.class(this._visualizationParent, this._visClientController, true);
  }
}