//module providing functionality to pick a visualization

import * as conf from "../../conf";
import * as utility from "../../utility";

export class VisualizationPicker {

  private _targetEl;
  private _availableViews;
  private _callback;

  constructor(targetEl, availableViews, callback) {
    this._targetEl = targetEl;
    this._availableViews = availableViews;
    this._callback = callback;

    this.loadVisualizationList();
  }

  displayVisualizationItems(content) {
    this._targetEl.innerHTML = content;
    var buttons = this._targetEl.getElementsByTagName('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', (e) => this.handleVisPick(e));
    }
    utility.hideLoadingSpinner();
  }

  handleVisPick(e) {
    let targetId = e.target.id;
    if (!targetId) {
      targetId = e.target.parentNode.id;
    }
    this._callback(targetId);
  }

  loadVisualizationList() {
    utility.showLoadingSpinner(conf.get('strings:ui:loadAvailableViews'));
    let visList = {};
    let otherViews = {};
    for (let viewId in this._availableViews) {
      if (!this._availableViews.hasOwnProperty(viewId))
        continue;

      let viewConf = conf.get('app:views:'+viewId);

      // handle different types of views
      switch (viewConf.type) {
        case 1:
          visList[viewId] = {
            id: viewId,
            name: viewConf.name,
            icon: viewConf.icon,
            mandatory: viewConf.attributes.mandatory,
            optional: viewConf.attributes.optional
          };
          break;
        case 2:
          otherViews[viewId] = {
            id: viewId,
            name: viewConf.name,
            icon: viewConf.icon
          };
          break;
        default:
          // we don't know the type of view
          console.error('visualizationPicker: No type of view found for view id <'+viewId+'>!');
      }
    }
    utility.apiLoad(
      (response) => this.displayVisualizationItems(response),
      'modules',
      'visualization-list',
      {
        visualizations: visList,
        otherViews: otherViews
      }
    );
  }

}



