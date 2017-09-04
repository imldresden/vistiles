// Class representing a Icon Menu
//define(['utility', 'visClientController'], function (utility, visClientController) {

import * as utility from "../../utility";
import {TileSetup} from "./tileSetup";

export class Menu {

  private _parent;
  private _visClientController;

  /**
   * A reference to the tile setup menu (component).
   */
  private _tileSetup: TileSetup;

  //object holding all icons with a representing icon id and a function to handle click/taps on that icon
  private _icons = {
    refreshIcon: {
      materialIcon: 'loop',
      colorClass: 'red',
      handler: this.handleRefresh
    },
    changeChartIcon: {
      materialIcon: 'insert_chart',
      colorClass: 'green',
      handler: this.handleChartChange
    },
    showHideTileSetup: {
      materialIcon: 'settings_applications',
      colorClass: 'green',
    },
    changeWorkspaceIcon: {
      materialIcon: 'swap_horiz',
      colorClass: 'orange',
      handler: this.handleChangeWorkspace
    }
  };

  constructor(parent, visClientController) {
    this._parent = parent;
    this._visClientController = visClientController;
    utility.apiLoad((response) => this.displayMenu(response), 'modules', 'menu', {icons: this._icons});
  }

  displayMenu(content) {
    let tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = content;
    this._parent.appendChild(tmpDiv.firstElementChild);
    for (let icon in this._icons) {
      let iconBtn = document.getElementById(icon);
      iconBtn.addEventListener('click', () => this.onClick(this._icons[icon].handler));
      iconBtn.addEventListener('tap', () => this.onClick(this._icons[icon].handler));
    }

    // register click listener on tile setup button
    let btn: HTMLElement = document.getElementById('showHideTileSetup');
    //btn.addEventListener('click', (e: Event) => this.onTileSetupButtonClicked());

    let color = this._visClientController.getBorderColor();
    this._visClientController.setMenuColor(color);
  }

  onClick(handler): void{
    handler(this);
  }

  handleRefresh(menu) {
    location.reload();
  }

  handleChartChange(menu) {
    location.reload();
  }

  handleChangeWorkspace(menu) {
    menu._visClientController.changeWorkspaceMenuBtnHandler();
  }

  /**
   * This function is called when the tile setup button is clicked.
   */
  private onTileSetupButtonClicked(): void {
    if (this._tileSetup) {
      this._tileSetup.showTileSetup(!this._tileSetup.isVisible());
    }
    $('.fixed-action-btn').closeFAB();
  }

  /**
   * Sets and saves a reference to the tile setup components.
   *
   * @param tileSetup The tile setup component
   */
  public setTileSetup(tileSetup: TileSetup): void {
    this._tileSetup = tileSetup;
  }
}