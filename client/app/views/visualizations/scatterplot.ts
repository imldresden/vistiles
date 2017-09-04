// module that represents a basic scatterplot
//define(['d3', 'd3tip', 'utility', 'conf', 'log'], function (d3, d3tip, utility, conf, log) {

import * as conf from "../../../conf";
import * as utility from "../../../utility";
import {Visualization, Size} from "./visualization";

import * as d3 from 'd3';
import * as d3tip from 'd3-tip';
//let d3tip = require('../../../../public/static/lib/d3-tip/d3-tip')(d3);

export class Scatterplot extends Visualization{
  static viewId: string = 'scatterplot';

  private _sizePlot: Size = {width: -1, height: -1};
  private _forcedSizeInfo: any;

  // references to important dom elements
  private _axesNode: d3.Selection<any>;
  private _points: d3.Selection<any>;
  private _axisXView: d3.Selection<any>;
  private _axisYView: d3.Selection<any>;
  private _axisXViewInner: d3.Selection<any>;
  private _axisYViewInner: d3.Selection<any>;
  private _axisXLabel: d3.Selection<any>;
  private _axisYLabel: d3.Selection<any>;

  // references to D3 components
  private _scaleX: d3.scale.Linear<number, number>;
  private _scaleY: d3.scale.Linear<number, number>;
  private _scaleSize: d3.scale.Linear<number, number>;
  private _plotZoom: d3.behavior.Zoom<any>;
  private _axisXInner: d3.svg.Axis;
  private _axisYInner: d3.svg.Axis;
  private _axisX: d3.svg.Axis;
  private _axisY: d3.svg.Axis;

  // data variables and containers
  private _removedData: any[] = [];
  private _externalFilteredData: any[] = [];
  private _dataLoaded: boolean = false;
  private _regions: string[];

  get viewId() { return Scatterplot.viewId; };

  constructor(parent, dataName, visClientController, dataYear?: number) {
    super(parent, visClientController);
    // Necessary as javascript is to dump to proper resolve this at other points.
    this._visClientController = visClientController;
    this._eventCallbacks[conf.get('events:selection:state')] = (data) => this.updateSelection(data);
    this._eventCallbacks[conf.get('events:settings:attributesUpdate')] = (data) => this.onAttributeUpdate(data);
	this._eventCallbacks[conf.get('events:filter:viewportState')] = (data) => this.updateFilter(data);
    this._eventCallbacks[conf.get('events:view:align')] = (data) => this.onAlign(data);
    this._eventCallbacks[conf.get('events:view:aligned')] = (data) => this.onAligned(data);

    this._dataAttr = {
      'attrMappings': {
        'axisX': null,
        'axisY': null,
        'size': null
      },
      'attr': {
        'year': 2000,
        'maxX': null,
        'minX': null,
        'maxY': null,
        'minY': null,
        'maxSize': null,
        'minSize': null
      },
      'filteredRegions': []
    };
    if (dataYear)
      this._dataAttr.attr.year = dataYear;

    // saves the root (main) div node
    this._parent = parent;

    // sets the width and height based on the parent node
    this._margin = {top: 20, right: 20, bottom: 25, left: 100};
    this.updateSize();

    // initializes main components
    this.initializeVis();

    // loads the data
    this.loadDataByYear(dataName, this._dataAttr['attr']['year']);

    // register window callbacks
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Returns identifier string of a data object.
   *
   * @param d        Data that should be used
   * @returns {string}  The identifier string
   */
  static getDataID (d: any[]): string {
    return d[0];
  }

  /**
   * Calculates and returns the size (diameter) for an object.
   *
   * @param d       The data array of the corresponding object.
   * @param scale   If true, the value will be adjusted according
   *                to the scale used for the D3 chart.
   * @returns {*}   The calculated size (diameter) for the data object.
   */
  getDataSize(d: any[], scale?: boolean): number {
    return scale == true ? this._scaleSize(d[3]) : d[3];
  }

  /**
   * Calculates and returns the X value for an object.
   *
   * @param d       The data array of the corresponding object.
   * @param scale   If true, the value will be adjusted according
   *                to the scale used for the D3 chart.
   * @returns {*}   The calculated X value for the data object.
   */
  getDataX(d: any[], scale?: boolean): number {
    return scale == true ? this._scaleX(d[1]) : d[1];
  }

  /**
   * Calculates and returns the Y value for an object.
   *
   * @param d       The data array of the corresponding object.
   * @param scale   If true, the value will be adjusted according
   *                to the scale used for the D3 chart.
   * @returns {*}   The calculated Y value for the data object.
   */
  getDataY(d: any[], scale?: boolean): number {
    return scale == true ? this._scaleY(d[2]) : d[2];
  }

  /**
   * Returns a list of filtered, off-screen objects.
   *
   * @returns {Array} Simple array containing strings (object ids)
   */
  getFilteredObjects (): any[] {
    let filtered = [];
    if (this._dataLoaded)
      for (let i = 0; i < this._data.length; i++)
        if (!this.isObjectInView(this._data[i]))
          filtered.push(Scatterplot.getDataID(this._data[i]));
    return filtered.concat(this._removedData);
  }

  updateSize(): void {
    if(this._forcedSizeInfo) {
      this._size = this._forcedSizeInfo.size;
      this._parent.style.padding =
          this._forcedSizeInfo.offset.top + 'px ' +
          this._forcedSizeInfo.offset.right + 'px ' +
          this._forcedSizeInfo.offset.bottom + 'px ' +
          this._forcedSizeInfo.offset.left + 'px';
    } else {
      let boundingRect: ClientRect = this._parent.getBoundingClientRect();
      this._size = {width: boundingRect.width, height: boundingRect.height};
      this._parent.style.padding = '';
    }

    this._sizePlot.width = this._size.width - this._margin.left - this._margin.right;
    this._sizePlot.height = this._size.height - this._margin.top - this._margin.bottom;
  }

  /**
   * Initializes all necessary components of the visualization, e.g.,
   * scales, D3 behaviors, axes, DOM elements.
   */
  initializeVis (): void {
    // *****************************************
    // D3 SCALES
    // *****************************************

    this._scaleX = d3.scale.linear();
    this._scaleY = d3.scale.linear();
    this._scaleSize = d3.scale.linear();

    // *****************************************
    // D3 BEHAVIORS
    // *****************************************

    this._plotZoom = d3.behavior.zoom()
      .x(this._scaleX)
      .y(this._scaleY)
      .scaleExtent([1, 10])
      .on("zoom", () => this.onPlotZoom())
      .on("zoomend", () => this.onPlotZoomEnd());

    // *****************************************
    // D3 AXES
    // *****************************************

    this._axisXInner = d3.svg.axis()
      .orient("bottom")
      .scale(this._scaleX)
      .ticks(10)
      .tickFormat("");
    this._axisX = d3.svg.axis()
      .orient("bottom")
      .scale(this._scaleX)
      .ticks(this._axisXInner.ticks())
      .tickFormat(d3.format((",d")))
      .tickPadding(6);
    this._axisYInner = d3.svg.axis()
      .orient("left")
      .scale(this._scaleY)
      .ticks(10)
      .tickFormat("");
    this._axisY = d3.svg.axis()
      .orient("left")
      .scale(this._scaleY)
      .ticks(this._axisYInner.ticks())
      .tickFormat(d3.format((",d")))
      .tickPadding(6);

    // *****************************************
    // OTHER D3 COMPONENTS
    // *****************************************


    // *****************************************
    // DOM STRUCTURE / NODES
    // *****************************************

    // creates and appends the svg container
    this._svg = d3.select(this._parent).append("svg")
      .attr("id", "scatterplot")
      .attr("class", "vis");

    // creates a zoomable container for the actual plot
    this._visNode = this._svg.append("g")
      .attr("class", "plot")
      .attr("pointer-events", "all")
      .call(this._plotZoom);

    // creates and appends a rect node (background)
    this._visBackground = this._visNode.append("rect")
      .attr("class", "plot-bg");

    // create and append a axes container
    this._axesNode = this._svg.append("g")
      .attr("class", "axes");

    // creates and appends the x axis
    this._axisXViewInner = this._axesNode.append("g")
      .attr("class", "axis-grid axis");
    this._axisXView = this._axesNode.append("g")
      .attr("class", "x-axis axis");
    this._axisXLabel = this._axisXView.append("text")
      .attr("id", "x-axis-label")
      .attr("class", "title")
      .style("text-anchor", "end")
      .text("name x axis");

    // creates and appends the y axis
    this._axisYViewInner = this._axesNode.append("g")
      .attr("class", "axis-grid axis");
    this._axisYView = this._axesNode.append("g")
      .attr("class", "y-axis axis");
    this._axisYLabel = this._axisYView.append("text")
      .attr("id", "y-axis-label")
      .attr("class", "title")
      .attr("transform", "rotate(-90)")
      .style("text-anchor", "end")
      .text("name y axis");

    // creates and appends a group container for the data objects
    this._points = this._visNode.append("svg")
      .attr("top", 0)
      .attr("left", 0)
      .attr("pointer-events", "all")
      .attr("class", "data-objects");

    // *****************************************
    // CONNECT INTERACTION CALLBACKS
    // *****************************************

    /*plot
     .on("mousedown.drag", onPlotDrag)
     .on("touchstart.drag", onPlotDrag)
     .call(chartZoom);

     vis
     .on("mousemove.drag", onMouseMove)
     .on("touchmove.drag", onMouseMove)
     .on("mouseup.drag",   onMouseUp)
     .on("touchend.drag",  onMouseUp);*/
  }

  /**
   * Returns true if a data objects is inside the view, not offscreen.
   *
   * @param d             Array with object data
   * @returns {boolean}   true in inside, false if off-screen
   */
  isObjectInView (d): boolean {
    let xLow = this._scaleX.invert(this._scaleX.range()[0]),
      xHigh = this._scaleX.invert(this._scaleX.range()[1]),
      yLow = this._scaleY.invert(this._scaleY.range()[0]),
      yHigh = this._scaleY.invert(this._scaleY.range()[1]);

    //console.log(xLow, xHigh, yLow, yHigh);

    let x = this.getDataX(d),
      y = this.getDataY(d);

    let checkX = x >= xLow && x <= xHigh,
      checkY = y >= yLow && y <= yHigh;

    return checkX && checkY;
  }

  /**
   * Loads data from the server.
   *
   * Besides the data attributes for the x axis, y axis, and size,
   * this function requires a specific year.
   *
   * @param dataName  Data attributes (rows) used to map objects to
   *                  visual properties.
   * @param year      Specific year of the data.
   */
  loadDataByYear(dataName?: string, year?: number): void {
    // resets dataLoaded
    this._dataLoaded = false;

    if (dataName) {
      // sets selected data attributes
      this._dataAttr.attrMappings['axisX'] = dataName[0];
      this._dataAttr.attrMappings['axisY'] = dataName[1];
      if (dataName.length > 2 && dataName[2] != 'SKIP')
        this._dataAttr.attrMappings['size'] = dataName[2];
    }

    if (year) {
      this._dataAttr.attr['year'] = year;
    }

    // loads the data from the server
    this.loadData();

    // loads a list of all data attributes from the server
    this.loadAttrMeta();
    this.loadObjMeta();
  }

  loadData(): void {
    utility.apiLoad((response) => this.processData(response), 'data/times',
      this._dataAttr.attr['year'].toString(), {'attributes': [this._dataAttr.attrMappings['axisX'], this._dataAttr.attrMappings['axisY'], this._dataAttr.attrMappings['size']]});
  }

  loadAttrMeta(): void {
    utility.apiLoad((response) => this.processDataAttributes(response), 'data/attributes', "meta");
  }

  loadObjMeta(): void {
    utility.apiLoad((response) => this.processDataObjects(response), 'data/objects', 'meta');
  }

  onAttributeUpdate (newDataAttr: {[id: string]: any}): void {
    this.updateDictionary(this._dataAttr, newDataAttr);
    if(newDataAttr.filteredRegions) {
      this.updateFilter(this._externalFilteredData);
    } else {
      this.loadDataByYear();
    }
  }

  /**
   * Processes the list data attributes received from the application server.
   *
   * @param res
   */
  processDataAttributes (res: string): void {
    this._attrMeta = JSON.parse(res);

    // updates the visualization
    this.updateVis();
  }

  onWindowResize (): void {
    // sets the width and height based on the parent node
    this.updateSize();

    // updates the visualization
    this.updateVis();
  }

  processDataObjects(res: string): void {
    this._objMeta = JSON.parse(res);
    let regionsSet: Set<string> = new Set<string>();
    for (let objId in this._objMeta) {
      regionsSet.add(this._objMeta[objId].Region);
    }

    this._regions = Array.from(regionsSet);

    this.updateVis();
  }

  /**
   * Processes object data received from the application server.
   *
   * @param res
   */
  processData (res: string): void {
    let parsedData = JSON.parse(res);
    this._data = [];
    let tmpID, tmpX, tmpY, tmpSize;
    this._dataAttr.attr['minX'] = null;
    this._dataAttr.attr['maxX'] = null;
    this._dataAttr.attr['minY'] = null;
    this._dataAttr.attr['maxY'] = null;
    this._dataAttr.attr['minSize'] = null;
    this._dataAttr.attr['maxSize'] = null;

    for (let key in parsedData) {
      if (!parsedData.hasOwnProperty(key))
        continue;

      // reads the data, or sets default if null
      tmpID = key;
      tmpX = parsedData[key][this._dataAttr.attrMappings['axisX']];
      tmpY = parsedData[key][this._dataAttr.attrMappings['axisY']];
      if (!(this._dataAttr.attrMappings['size']))
        tmpSize = 1;
      else
        tmpSize = parsedData[key][this._dataAttr.attrMappings['size']];

      // only use object if there are x and y values
      if (tmpX !== "" && tmpY !== "") {
        // saves object values
        this._data.push([tmpID, tmpX, tmpY, tmpSize]);

        // calculates min and max for every attribute
        if (!this._dataAttr.attr['minX'] || this._dataAttr.attr['minX'] > tmpX)
          this._dataAttr.attr['minX'] = tmpX;
        if (!this._dataAttr.attr['maxX'] || this._dataAttr.attr['maxX'] < tmpX)
          this._dataAttr.attr['maxX'] = tmpX;

        if (!this._dataAttr.attr['minY'] || this._dataAttr.attr['minY'] > tmpY)
          this._dataAttr.attr['minY'] = tmpY;
        if (!this._dataAttr.attr['maxY'] || this._dataAttr.attr['maxY'] < tmpY)
          this._dataAttr.attr['maxY'] = tmpY;

        if (!this._dataAttr.attr['minSize'] || this._dataAttr.attr['minSize'] > tmpSize)
          this._dataAttr.attr['minSize'] = tmpSize;
        if (!this._dataAttr.attr['maxSize'] || this._dataAttr.attr['maxSize'] < tmpSize)
          this._dataAttr.attr['maxSize'] = tmpSize;

      } else
        this._removedData.push(tmpID);

      // resets temporary variables
      tmpID = tmpX = tmpY = tmpSize = null;
    }

    // sort the data set by x attribute
    this._data.sort((a, b) => {
      return this.getDataX(a, false) - this.getDataX(b, false);
    });

    // sets dataLoaded
    this._dataLoaded = true;

    // add dom elements for every data object
    this._points.selectAll(".dot")
      .data(this._data)
      .enter().append("circle")
      .attr("id", (d) => Scatterplot.getDataID(d))
      .attr("class", (d) => this.getClass(d))
      .on("click", (d) => this.toggleSelection(d))
      .on("tap", (d) => this.toggleSelection(d));

    // updates the visualization
    this.updateVis();
  }

  getClass(d: any[]): string {
    let id = d[0];
    let className = 'dot object';
    if (this._selectedObjectIds.has(id))
      className += ' selected';
    if (this._regions) {
      className += ' group-' + this._regions.indexOf(this._objMeta[id].Region);

      if(this._dataAttr.filteredRegions.indexOf(this._regions.indexOf(this._objMeta[id].Region)) > -1)
        className += ' hide';
    }
    if(this._externalFilteredData.indexOf(Scatterplot.getDataID(d)) > -1)
      if(!className.includes('hide')) className += ' hide';
    return className;
  }

  /**
   * Updates all visualization components, e.g., scales, D3 behaviors,
   * axes, DOM elements.
   */
  updateVis (): void {
    // *****************************************
    // D3 SCALES
    // *****************************************
    this._scaleX
      .domain([this._dataAttr.attr['minX'], this._dataAttr.attr['maxX']])
      .range([0, this._sizePlot.width]);
    this._scaleY
      .domain([this._dataAttr.attr['minY'], this._dataAttr.attr['maxY']])
      .range([this._sizePlot.height, 0]);
    this._scaleSize
      .domain([this._dataAttr.attr['minSize'], this._dataAttr.attr['maxSize']])
      .range([3, 20]);

    // *****************************************
    // D3 BEHAVIORS
    // *****************************************

    this._plotZoom.x(this._scaleX).y(this._scaleY);

    // *****************************************
    // D3 AXES
    // *****************************************

    this._axisXInner.tickSize(-this._sizePlot.height, 0);
    this._axisX.tickSize(6, -this._sizePlot.height);
    this._axisYInner.tickSize(-this._sizePlot.width, 0);
    this._axisY.tickSize(6, -this._sizePlot.width);

    // *****************************************
    // DOM STRUCTURE / NODES
    // *****************************************
    this._svg
      .attr("width", this._size.width)
      .attr("height", this._size.height);

    // update chart container
    //chartNode
    //  .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

    this._visNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")")
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height)
      .call(this._plotZoom);

    this._visBackground
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height);

    this._points
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height)
      .attr("viewBox", "0 0 " + this._sizePlot.width + " " + this._sizePlot.height);

    this._axesNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")");

    // update x axis
    this._axisXViewInner
      .attr("transform", "translate(0, " + this._sizePlot.height + ")")
      .call(this._axisXInner);
    this._axisXView
      .attr("transform", "translate(0, " + this._sizePlot.height+ ")")
      .call(this._axisX);
    this._axisXLabel
      .attr("x", this._sizePlot.width)
      .attr("dx", "-.4em")
      .attr("dy", "-.4em");

    // update y axes
    this._axisYViewInner
      .call(this._axisYInner);
    this._axisYView
      .call(this._axisY);
    this._axisYLabel
      .attr("x", 0)
      .attr("y", "1em")
      .attr("dx", "-.4em")
      .attr("dy", ".1em");

    // update axis labels
    if (this._attrMeta) {
      if (this._axisXLabel && this._dataAttr.attrMappings['axisX'])
        this._axisXLabel.text(this._attrMeta[this._dataAttr.attrMappings['axisX']]["Name"]);

      if (this._axisYLabel && this._dataAttr.attrMappings['axisY'])
        this._axisYLabel.text(this._attrMeta[this._dataAttr.attrMappings['axisY']]["Name"]);
    }

    // update data points (objects)
    if (this._dataLoaded) {
      this._points.selectAll(".dot")
        .attr("r", (data) => this.getDataSize(data, true))
        .attr("cx", (data) => this.getDataX(data, true))
        .attr("cy", (data) => this.getDataY(data, true))
        .attr("id", (d) => Scatterplot.getDataID(d))
        .attr("class", (d) => this.getClass(d));

      this._points.selectAll('.dot')
        .each((d) => this.updateTooltip(d[0]));
    }

    if (this._visClientController.getActiveView() != this && this._dataLoaded) {
      // registers this module
      this._visClientController.registerView(this);
    }
  }

  toggleSelection (d: any[]): void {
    let obj = document.getElementById(Scatterplot.getDataID(d));
    //console.log("x=" + getDataX(data) + " , y=" + getDataY(data));
    if (obj) {
      if (obj.classList.contains("selected")) {
        this.hideTooltip(obj.id);
        this.deselectObjects([obj], true);
      }
      else {
        this.showTooltip(obj.id);
        this.selectObjects([obj], true);
      }
    }
  }

  selectObjects(objects: HTMLElement[], emit?: boolean): void {
    for (let i = 0; i < objects.length; i++) {
      this._selectedObjectIds.add(objects[i].id);
      this.showTooltip(objects[i].id);
      objects[i].classList.add("selected");
    }
    if (emit) {
      this._visClientController.emitEvent(conf.get("events:selection:added"), Array.from(this._selectedObjectIds));
    }
  }

  deselectObjects(objects: HTMLElement[], emit?: boolean): void {
    let ids = [];
    for (let i = 0; i < objects.length; i++) {
      ids.push(objects[i].id);
      this._selectedObjectIds.delete(objects[i].id);
      this.hideTooltip(objects[i].id);
      objects[i].classList.remove("selected");
    }

    if (emit)
      this._visClientController.emitEvent(conf.get("events:selection:removed"), ids);
  }

  updateSelection(selectedIds: string[]): void {
    let objects = <HTMLElement[]>Array.from(document.getElementsByClassName('selected'));
    this.deselectObjects(objects);
    objects = [];
    for (let i = 0; i < selectedIds.length; i++) {
      objects.push(document.getElementById(selectedIds[i]));
    }
    this.selectObjects(objects);
  }

  emitCurrentState(): void {
    this.emitSelectionState();
    this.emitFilterViewportState();
  }

  emitFilterViewportState(): void {
    let filteredObjects = this.getFilteredObjects();
    this._visClientController.emitEvent(conf.get('events:filter:viewportState'), filteredObjects);
  }

  /**
   * Handles zoom and pan on the plot.
   */
  onPlotZoom (): void {
    this._axisXView.call(this._axisX);
    this._axisYView.call(this._axisY);
    this._axisXViewInner.call(this._axisXInner);
    this._axisYViewInner.call(this._axisYInner);
    let event = <d3.ZoomEvent>d3.event;
    this._svg.selectAll(".dot")
      .attr("transform", "translate(" + event.translate + ")scale(" + event.scale + ")");

    // looks for elements outside the view
    this.emitFilterViewportState();

    this._points.selectAll('.dot')
      .each((d) => this.updateTooltip(d[0]));
  }

  onPlotZoomEnd (): void {
    let tx = this._plotZoom.translate()[0],
      ty = this._plotZoom.translate()[1];
    let xMin = this._dataAttr.attr['minX'],
      xMax = this._dataAttr.attr['maxX'],
      yMin = this._dataAttr.attr['minY'],
      yMax = this._dataAttr.attr['maxY'];
    let changed = false;


    if (this._scaleX.domain()[0] < xMin) {
      tx = this._plotZoom.translate()[0] - this._scaleX(xMin) + this._scaleX.range()[0];
      changed = true;
    } else if (this._scaleX.domain()[1] > xMax) {
      tx = this._plotZoom.translate()[0] - this._scaleX(xMax) + this._scaleX.range()[1];
      changed = true;
    }

    if (this._scaleY.domain()[0] < yMin) {
      ty = this._plotZoom.translate()[1] - this._scaleY(yMin) + this._scaleY.range()[0];
      changed = true;
    } else if (this._scaleY.domain()[1] > yMax) {
      ty = this._plotZoom.translate()[1] - this._scaleY(yMax) + this._scaleY.range()[1];
      changed = true;
    }

    if (changed) {
      this._plotZoom.translate([tx, ty]);
      this._plotZoom.event(this._visNode.transition().duration(50));
    }

    this._points.selectAll('.dot')
      .each((d) => this.updateTooltip(d[0]));
  }

  onPlotDrag (): void {
    //console.log("onPlotDrag()");
  }

  onMouseMove (): void {
    //console.log("onMouseMove()");
  }

  onMouseUp (): void {
    //console.log("onMouseUp()");
  }

  getObjects(): any[] {
    let objects = [];
    for (let i = 0; i < this._data.length; i++) {
      objects.push(this._data[i][0]);
    }
    return objects;
  }

  updateTooltip(id: string): void {
    let tip: any = document.getElementById('tip-' + id);
    if (tip)
      tip.parentNode.removeChild(tip);

    if (this._selectedObjectIds.has(id)) {
      tip = d3tip()
        .attr('class', 'd3-tip')
        .attr('id', 'tip-' + id)
        .offset([-8, 0])
        .html(this._objMeta[id].Name);
      this._svg.call(tip);
      tip.show(id, document.getElementById(id));
    }
  }

  showTooltip(id: string): void {
    let tip: any = document.getElementById('tip-' + id);
    if (tip) {
      this.hideTooltip(id);
    }

    tip = d3tip()
      .attr('class', 'd3-tip')
      .attr('id', 'tip-' + id)
      .offset([-8, 0])
      .html(this._objMeta[id].Name);
    this._svg.call(tip);
    tip.show(id, document.getElementById(id));
  }

  hideTooltip(id: string): void {
    let tip = document.getElementById('tip-' + id);
    if (tip) {
      tip.parentNode.removeChild(tip);
    }
  }

  updateFilter(filteredObjectIds): void {
    this._externalFilteredData = filteredObjectIds;
    this._points.selectAll(".dot")
      .attr("class", (d) => this.getClass(d));
  }

  onAlign(data): void {
    let boundingRect: ClientRect = this._parent.getBoundingClientRect();
    let size = {width: boundingRect.width, height: boundingRect.height};

    let angle = window.screen['orientation'].angle;

    // add the attributes and send the data back
    data['angle'] = angle;
    data['size'] = size;
    this._visClientController.emitEvent(conf.get("events:view:align"), data);
  }

  onAligned(data): void {
    this._forcedSizeInfo = data;
    this.updateSize();
    this.updateVis();
  }
}
