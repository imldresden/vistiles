import * as conf from "../../../conf";
import * as utility from "../../../utility";
declare let d3v4: any;
import * as d3 from 'd3';

import {View} from "../view";
import {VisClientController} from "../../controller/visClientController";

export interface Size {
  width: number;
  height: number;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DataAttributes {
  attrMappings: {[id: string]: any};
  attr: {[id: string]: any};
  filteredRegions: Number[];
}

export abstract class Visualization extends View {
  protected _svg: d3.Selection<any>;
  protected _visNode: d3.Selection<any>;
  protected _visBackground: d3.Selection<any>;
  protected _size: Size;
  protected _margin: Margin;
  protected _data: any[];
  protected _dataAttr: DataAttributes;
  protected _objMeta: Object;
  protected _attrMeta: Object;
  protected _selectedObjectIds: Set<string>;

  get dataAttr() { return this._dataAttr; };
  get viewPortSize() {
    let boundingRect: ClientRect = this._parent.getBoundingClientRect();
    return {width: boundingRect.width, height: boundingRect.height};
  };

  constructor(parent: HTMLElement, visClientController: VisClientController) {
    super(parent, visClientController);
    this._selectedObjectIds = new Set<string>();
  }

  drawVis(): void {
    if (this._svg)
      this.updateVis();
    else
      this.initializeVis();
  }
  abstract initializeVis(): void;
  abstract updateVis(): void;

  abstract loadData(): void;
  abstract loadAttrMeta(): void;
  abstract loadObjMeta(): void;

  abstract emitCurrentState(): void;

  abstract selectObjects(ids: HTMLElement[], emit?: boolean): void;
  abstract deselectObjects(ids: HTMLElement[], emit?: boolean): void;
  abstract toggleSelection(d: any[]): void;
  abstract updateSelection(selectedIds: string[]): void;

  abstract onWindowResize(): void;

  abstract hideTooltip(id: string): void
  abstract updateTooltip(id: string): void;
  abstract showTooltip(id: string): void;

  emitSelectionState(): void {
    this._visClientController.emitEvent(
      conf.get('events:selection:added'),
      Array.from(this._selectedObjectIds)
    );
  }

  updateDictionary(dict: {[id: string]: any}, updatedValues: {[id: string]: any}): void {
    for (let key in updatedValues) {
      if (!dict.hasOwnProperty(key))
        continue;

      // an array is an object, but we want to set it directly
      if (typeof updatedValues[key] == 'object' && !Array.isArray(updatedValues[key])) {
        this.updateDictionary(dict[key], updatedValues[key]);
      } else {
        dict[key] = updatedValues[key];
        utility.displayToast(
          utility.strFormat(conf.get('strings:views:modules:toasts:attributeChanged'), key, updatedValues[key]));
      }
    }
  }
}

export class Indicator {

  private static _indicators: Indicator[] = [];
  private _view: Visualization;
  private _device: any;

  private _indicator: any;
  private _gridLine: any;
  private _gridLineHandler: any;
  private _indicatorIcon: any;
  private _indicatorIconHandler: any;

  // compatibility mode to support deprecated d3v3
  private _compMode: boolean;

  constructor(view, device, compMode = false){
    this._view = view;
    this._device = device;
    this._compMode = compMode;
  }

  public static addIndicator(indicator){
    Indicator._indicators.push(indicator);
  }

  public static removeIndicator(index){
    Indicator._indicators[index]._indicator.remove();
    Indicator._indicators.splice(index, 1);
  }

  public static removeAllIndicators(){
    for (let i = 0; i < Indicator._indicators.length; i++){
      Indicator._indicators[i]._indicator.remove();
    }
    Indicator._indicators = [];
  }

  public static indexOfIndicator(device): number{
    for (let i = 0; i < Indicator._indicators.length; i++){
      if (device.id === Indicator._indicators[i]._device.id) {
        return i;
      }
    }
    return -1;
  }

  public getDeviceId(){
    return this._device.id;
  }

  public static getIndicators(): Indicator[]{
    return Indicator._indicators;
  }

  public initIndicator(view): void {
    this._indicator = view._visNode.insert("g")
      .attr("class", "year-indicator");

    this._gridLine = this._indicator.append('path')
      .attr("class", "year-grid-line");

    this._gridLineHandler = this._indicator.append('path')
      .attr("class", "year-grid-line-handler drag-handler");

    this._indicatorIcon = this._indicator.append("image")
      .attr("height", "30px")
      .attr("width", "30px")
      .attr("id", "drag-" + this._device.id);

    this._indicatorIconHandler = this._indicator.append("image")
      .attr("height", "50px")
      .attr("width", "50px")
      .attr("class", "drag-handler");

    if (this._compMode) {
      this._gridLineHandler.call(
        d3.behavior.drag()
          .on("dragstart", () => this.onGridLineDragStart())
          .on("drag", (d) => this.onGridLineDrag(view, d))
          .on("dragend", (d) => this.onGridLineDragEnd(view))
      );

      this._indicatorIconHandler.call(
        d3.behavior.drag()
          .on("dragstart", () => this.onGridLineDragStart())
          .on("drag", (d) => this.onGridLineDrag(view, d))
          .on("dragend", (d) => this.onGridLineDragEnd(view))
      );
    } else {
      this._gridLineHandler.call(
        d3v4.drag()
          .on("start", () => this.onGridLineDragStart())
          .on("drag", (d) => this.onGridLineDrag(view, d))
          .on("end", (d) => this.onGridLineDragEnd(view))
      );

      this._indicatorIconHandler.call(
        d3v4.drag()
          .on("start", () => this.onGridLineDragStart())
          .on("drag", (d) => this.onGridLineDrag(view, d))
          .on("end", (d) => this.onGridLineDragEnd(view))
      );
    }
  }

  private onGridLineDragStart(){
    this._gridLine.attr("class", "year-grid-line dragging", true);
  }

  private onGridLineDrag(view, d){
    let scaleX = view.getScaleX();
    let xPos;

    if (this._compMode) {
      xPos = d3.mouse(d3.select('.plot').node())[0];
    } else {
      xPos = d3v4.event.x;
    }

    this.dragIndicator(view, d, xPos);

    let newYear = Math.round(scaleX.invert(xPos));

    if (view._axisXViewGrid) {
      view._axisXViewGrid.selectAll(".tick")
        .attr("class", "tick")
        .filter(function (d) {
          return d==newYear;
        })
        .attr("class", "tick highlighted");
    }
  }

  dragIndicator(view, d, xPos): void {
    let scaleX = view.getScaleX();
    if (xPos >= 0 && xPos <= view._sizePlot.width) {
      this._gridLine.attr("transform", "translate(" + (xPos - scaleX(d)) + " 0)");
      this._gridLineHandler.attr("transform", "translate(" + (xPos - scaleX(d)) + " 0)");
      this._indicatorIcon.attr("transform", "translate(" + (xPos - scaleX(d)) + " 0)");
      this._indicatorIconHandler.attr("transform", "translate(" + (xPos - scaleX(d)) + " 0)");
    }
  }

  private onGridLineDragEnd(view): void {
    let scaleX = view.getScaleX();
    let xPos;

    if (this._compMode) {
      xPos = d3.mouse(d3.select('.plot').node())[0];
    } else {
      xPos = d3v4.event.x;
    }

    if (xPos < 0) xPos = 0;
    if (xPos > view._sizePlot.width) xPos = view._sizePlot.width;

    let newYear = Math.round(scaleX.invert(xPos));
    let oldYear = this.getIndicatorData();

    this._gridLine.attr("class", "year-grid-line", true);
    this.updateIndicator(view, newYear);

    if (oldYear !== newYear){
      view.updateVisualizationAttribute(newYear, this._device.id);
    }

    if (view._axisXViewGrid) {
      view._axisXViewGrid.selectAll(".tick")
        .attr("class", "tick");
    }
  }

  public setIndicatorIcon(type: string): void {
    this._indicatorIcon.attr("xlink:href", conf.get('app:views:' + type + ':icon'));
  }

  public updateIndicator(view, year: number, animated = true): void {
    let scaleX = view.getScaleX();
    let t;

    if (this._compMode) {
      t = d3.transition()
        .duration(500);
    } else {
      t = d3v4.transition()
        .duration(500);
    }

    if (!animated){
      t.duration(0);
    }

    this._gridLine.data([year])
      .enter();

    this._gridLineHandler.data([year])
      .enter();

    this._gridLine.transition(t)
      .attr("d", "M " + scaleX(year) + " 0 L " + scaleX(year) + " " + view._sizePlot.height)
      .attr("transform", "");

    this._gridLineHandler.transition(t)
      .attr("d", "M " + scaleX(year) + " 0 L " + scaleX(year) + " " + view._sizePlot.height)
      .attr("transform", "");

    this._indicatorIcon
      .data([year])
      .enter();

    this._indicatorIcon
      .transition(t)
      .attr("x", scaleX(year) - 15)
      .attr("y", 0)
      .attr("transform", "");

    this._indicatorIconHandler
      .data([year])
      .enter();

    this._indicatorIconHandler
      .transition(t)
      .attr("x", scaleX(year) - 25)
      .attr("y", -10)
      .attr("transform", "");
  }

  public getIndicatorData(): number {
    let data = this._gridLine.data()[0];
    if (data != undefined) {
      return data;
    } else {
      return null;
    }
  }

}