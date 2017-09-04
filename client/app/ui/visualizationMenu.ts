/**
 * Created by Daniel on 19.05.2017.
 */

import * as utility from "../../utility";
import * as conf from "../../conf";

export class VisualizationMenu {
  private _parent;
  private _visClientController;
  private _viewId;

  public _icons;

  constructor(parent, visClientController, icons, viewId) {
    this._parent = parent;
    this._visClientController = visClientController;
    this._icons = icons;
    this._viewId = viewId;
    utility.apiLoad((response) => this.displayMenu(response), 'modules', 'visualization-menu', {icons: this._icons, viewIcon: conf.get('app:views:' + viewId + ':icon')});
  }

  displayMenu(content){
    let tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = content;
    this._parent.appendChild(tmpDiv.firstElementChild);
    this._visClientController.getActiveView().addMenuEvents(this._icons);
  }
}
