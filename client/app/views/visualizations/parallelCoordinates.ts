// module that represents a basic parallel Coordinate
//define(['d3', 'd3tip', 'utility', 'conf', 'log'], function (d3, d3tip, utility, conf, log) {

import * as conf from "../../../conf";
import * as utility from "../../../utility";
import {Visualization, Size} from "./visualization";
import {VisClientController} from "../../controller/visClientController";
import * as d3 from 'd3';
import * as d3tip from 'd3-tip';
import values = d3.values;
//let d3tip = require('../../../../public/static/lib/d3-tip/d3-tip')(d3);

export class ParallelCoordinates extends Visualization{
  static viewId: string = 'parallelCoordinates';

  private _sizePlot: Size = {width: -1, height: -1};
  private _forcedSizeInfo: any;

  // references to important dom elements
  private _axesNode: d3.Selection<any>;
  private _brushNode: d3.Selection<any>;
  private _yAxes = {};
  private _yAxesViews = {};
  private _yAxesLabels = {};
  private _brushes = {};
  private _brushViews = {};
  private _lines: d3.Selection<any>;

  // references to D3 components
  private _plotZoom: d3.behavior.Zoom<any>;
  // used for positioning axes horizontally side by side
  private _xScale; //d3.scale.Ordinal<string, number> fix type arguments, found no correct solution
  private _yScales = {};

  // data variables and containers
  private _removedData: any[] = [];
  private _filteredData: any[] = [];
  private _dataLoaded: boolean = false;
  private _regions: string[];
  // axis sorting represented by attribute ids order
  private _attributeOrder: any[] = [];

  //important states
  private _initialized: boolean = false;
  private _brushesInitialized: boolean = false;

  //exchange later against attribute selection
  private _axesCount: number = 10;

  get viewId() { return ParallelCoordinates.viewId; };

  constructor(parent: HTMLElement, dataName: string, visClientController: VisClientController, dataYear?: number) {
    super(parent, visClientController);
    // Necessary as javascript is to dump to proper resolve this at other points.
    this._visClientController = visClientController;
    this._eventCallbacks[conf.get('events:selection:state')] = (data) => this.updateSelection(data);
    this._eventCallbacks[conf.get('events:settings:attributesUpdate')] = (data) => this.onAttributeUpdate(data);
    this._eventCallbacks[conf.get('events:filter:viewportState')] = (data) => this.updateFilter(data);
    this._eventCallbacks[conf.get('events:view:align')] = (data) => this.onAlign(data);
    this._eventCallbacks[conf.get('events:view:aligned')] = (data) => this.onAligned(data);
    //this._eventCallbacks[conf.get('events:filter:displayExtension')] = (data) => this.updateFilter(data);

    //Attribute mappings don't exist yet. First 10 attributes are taken.
    this._dataAttr = {
      'attrMappings': {
        'attributes': null,
      },
      'attr': {
        'year': 2000,
        'attributes': [], //Holds the attributes, that are picked for the Vis
      },
      'filteredRegions': []
    };

    if (dataYear)
      this._dataAttr['attr']['year'] = dataYear;

    // saves the root (main) div node
    this._parent = parent;

    // sets the width and height based on the parent node
    this._margin = {top: 60, right: 20, bottom: 20, left: 50};
    this.updateSize();


    // loads the attribute meta data first to initialize main components
    this.loadAttrMeta();

    // loads the data
    this.loadDataByYear(dataName, this._dataAttr.attr['year']);

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
    return d['id'];
  }

  /**
   * Returns a list of filtered, out of brush areas objects.
   *
   * @returns {Array} Simple array containing strings (object ids)
   */
  getFilteredObjects (): any[] {
    let filtered = [];
    if (this._dataLoaded)
      for (let i = 0; i < this._data.length; i++)
        if (!this.isObjectInView(this._data[i])) {
          filtered.push(ParallelCoordinates.getDataID(this._data[i]));
        }
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

    this._xScale = d3.scale.ordinal()
      .domain(this._attributeOrder)
      .rangePoints([0, this._sizePlot.width], 1);

    // *****************************************
    // D3 BEHAVIORS
    // *****************************************

    this._plotZoom = d3.behavior.zoom()
      .x(this._xScale)
      .scaleExtent([1,1])
      .on("zoom", () => this.onPlotZoom())
      .on("zoomend", () => this.onPlotZoomEnd());

    // *****************************************
    // D3 AXES
    // *****************************************

    for(let key in this._attrMeta){
      let axis: d3.svg.Axis = null;
      axis = d3.svg.axis()
        .orient("left")
        .tickFormat(d3.format((",d")));
      this._yAxes[key] = axis;
    }

    // *****************************************
    // OTHER D3 COMPONENTS
    // *****************************************


    // *****************************************
    // DOM STRUCTURE / NODES
    // *****************************************

    // creates and appends the svg container
    this._svg = d3.select(this._parent).append("svg")
      .attr("id", "parallelCoordinates")
      .attr("class", "vis")
      .attr("width", this._size.width)
      .attr("height", this._size.height);

    // creates a zoomable container for the actual plot
    this._visNode = this._svg.append("g")
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")")
      .attr("class", "plot")
      .call(this._plotZoom);

    // creates and appends a rect node (background)
    this._visBackground = this._visNode.append("rect")
      .attr("class", "plot-bg")
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height);

    // creates and appends an axes container
    this._axesNode = this._svg.append("g")
      .attr("class", "axes")
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")");

    // creates and appends a brush container
    this._brushNode = this._svg.append("g")
      .attr("class", "brushes")
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")");

    // creates and appends y axes, labels and scale swap buttons for all attributes
    let count = 0;
    for(let key in this._attrMeta){
      // creates and appends an axis view
      let axisView: d3.Selection<any> = this._axesNode.append("g").data([key])
        .attr("transform", "translate(" + this._xScale(key) + ", 0)")
        .attr("class", "y-axis axis")
        .call(this._yAxes[key]);

      // creates and appends a label for the axis
      let axisLabel: d3.Selection<any> = axisView.append("text").data([key])
        .attr("id", key)
        .attr("class", "label")
        .attr("text-anchor", "start")
        .attr("transform", "translate(-3, -5) rotate(-30)")
        .text("label");

      // creates a drag interaction
      let drag: d3.behavior.Drag<any> = d3.behavior.drag()
        .on("drag", (d) => this.moveAxis(d))
        .on("dragend", (d) => this.swapAxis(d));

      // adds drag interaction to the axis view
      axisView.call(drag);

      // creates and appends a button for possible swapping of the axis scale
      axisView.append("text").data([key])
				.attr("id", key)
				.attr("class", "button")
				.attr("text-anchor", "start")
				.attr("transform", "translate(-12, -5) rotate(-90)")
				.text("\u21D4")
				.on("click", (key) => this.swapAxisScale(key));

      // add yAxes labels to the map
      this._yAxesLabels[key] = axisLabel;
      // add yAxes to the map
      this._yAxesViews[key] = axisView;
      count++;
    }

    // creates and appends a group container for the data objects
    this._lines = this._visNode.append("g")
      .attr("top", 0)
      .attr("left", 0)
      .attr("class", "data-objects");

  }

  /**
   * Returns true if a data objects is inside the brush areas, not outside brush areas.
   *
   * @param d             Array with object data
   * @returns {boolean}   true if inside brush areas, false if outside brush areas
   */
  isObjectInView (d): boolean {
    for(let key in this._attrMeta){
      let brush = this._brushes[key];
      let attributeValue = d['attributes'][key];
      if(!brush.empty()) {
        let min = brush.extent()[0];
        let max = brush.extent()[1];
        if (attributeValue < min || attributeValue > max) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Loads data from the server.
   *
   * This function requires a specific year.
   * Optional data names later should be used to load given attributes for the
   * parallel axes.
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
      // load only data for this attributes
    }

    if (year) {
      this._dataAttr.attr['year'] = year;
    }

    this.loadObjMeta();

    // loads the data from the server
    this.loadData();
  }

  loadData(): void {
    utility.apiLoad((response) => this.processData(response), 'data/times',
      this._dataAttr.attr['year'].toString());
    // use this statement if swapped to manual selection of attributes
    // utility.apiLoad((response) => this.processData(response), 'data/times',
    // this._dataAttr.attr['year'].toString(), {'attributes': [----Insert atrribute names from attribute mappings here----]} );
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
      this.updateFilter(this._removedData);
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
    let attributes = JSON.parse(res);
    this._attrMeta = {};
    for(let i = 0; i < this._axesCount; i++){
      let key = Object.keys(attributes)[i];
      this._attrMeta[key] = attributes[key];
      this._attributeOrder.push(key);
    }

    // initializes or updates the visualization
    // data attributes needed for visualization initialization
    if(this._initialized) {
      this.updateVis();
    }
    else {
      this.initializeVis();
    }
  }

  processDataObjects(res: string): void {
    this._objMeta = JSON.parse(res);
    let regionsSet: Set<string> = new Set<string>();
    for (let objId in this._objMeta) {
      regionsSet.add(this._objMeta[objId].Region);
    }

    this._regions = Array.from(regionsSet);
  }

  /**
   * Processes object data received from the application server.
   *
   * @param res
   */
  processData (res: string): void {
    let parsedData = JSON.parse(res);
    this._data = [];

    let tmpID;
    let attributes = {};

    for(let key in parsedData){
      if(!parsedData.hasOwnProperty(key))
        continue;

      tmpID = key;
      let tmpAttributes = {'id': tmpID, 'attributes': []};
      for(let attrKey in this._attrMeta) {
        if (attributes[attrKey] == undefined) {
          //if key doesn't exist
          attributes[attrKey] = [];
        }
        //if attribute is null, sets default to zero
        let value = parsedData[tmpID][attrKey] == "" ? 0 : parsedData[tmpID][attrKey];
        attributes[attrKey].push(value);

        tmpAttributes['attributes'][attrKey] = value;
      }
      this._data.push(tmpAttributes);
      tmpAttributes = null;
    }

    for(let attrKey in this._attrMeta){
      attributes[attrKey].sort((a,b) => {
        return a - b;
      });
    }
    //adds all attributes with all values sorted to dataAttr
    this._dataAttr.attr['attributes'] = attributes;

    // sets dataLoaded
    this._dataLoaded = true;

    // add dom elements for every data object
    this._lines.selectAll(".line")
      .data(this._data)
      .enter().append("path")
      .attr("id", (d) => ParallelCoordinates.getDataID(d))
      .attr("class", "line");

    // updates the visualization
    this.updateVis();
  }

  onWindowResize (): void {
    // sets the width and height based on the parent node
    this.updateSize();

    // updates the visualization
    this.updateVis();
  }

  getClass(d: any[]): string {
    let id = d['id'];
    let className = 'line object';
    if(this._selectedObjectIds.size > 0 && !this._selectedObjectIds.has(id))
      className += ' not-selected';
    if (this._selectedObjectIds.has(id))
      className += ' selected';
    if (this._regions) {
      className += ' group-' + this._regions.indexOf(this._objMeta[id].Region) + '-stroke';

      if(this._dataAttr.filteredRegions.indexOf(this._regions.indexOf(this._objMeta[id].Region)) > -1)
        className += ' hide';
    }
    if (this._filteredData.indexOf(id) > -1 || this._removedData.indexOf(id) > -1)
      if(!className.includes('hide')) className += ' hide';
    return className;
  }

  /**
   * Updates all visualization components, e.g., scales, D3 behaviors,
   * axes, DOM elements.
   */
  updateVis (): void {
    // *****************************************
    // D3 SCALES and D3 BRUSHES
    // *****************************************

    this._xScale = d3.scale.ordinal()
      .domain(this._attributeOrder)
      .rangePoints([0, this._sizePlot.width], 1);

    //update all yScales and brushes
    if(this._dataLoaded) {
      for (let key in this._attrMeta) {
      	let oldYScale = this._yScales[key];
        let yScale: d3.scale.Linear<number, number> = d3.scale.linear()
          .domain([d3.min(this._dataAttr.attr['attributes'][key]), d3.max(this._dataAttr.attr['attributes'][key])]);
        this._yScales[key] = yScale;

        //check old axis scale (asc or dsc) and apply to updated axis
        if(oldYScale != undefined && oldYScale.range() != undefined){
					let range = oldYScale.range();
					if(range[0] != undefined){
						if(range[0] == 0){
							this._yScales[key].range([0, this._sizePlot.height]);
						}
						else{
							this._yScales[key].range([this._sizePlot.height, 0]);
						}
					}
					else{
						this._yScales[key].range([this._sizePlot.height, 0]);
					}
				}
				else{
        	this._yScales[key].range([this._sizePlot.height, 0]);
				}

        //if brush not initialized, initialize it
        if (this._brushes[key] == undefined) {
          let brush: d3.svg.Brush<any> = null;
          brush = d3.svg.brush()
            .y(yScale)
            .on("brush", (d) => this.brushed(d));
          this._brushes[key] = brush;
        }
        else{
          this._brushes[key].y(yScale);
        }
      }
    }

    //initialize brush views if they are not initialized already
    if(!this._brushesInitialized){
      for(let key in this._attrMeta){
        let brushView: d3.Selection<any> = this._brushNode.append("g").data([key])
          .attr("class", "y-brush brush")
          .call(this._brushes[key]);
        this._brushViews[key] = brushView;
        brushView.selectAll("rect")
          .attr("width", "40")
          .attr("x", this._xScale(key) - 20);
        brushView.selectAll('resize').selectAll('rect').attr("y", 0);
      }
      this._brushesInitialized = true;
    }

    // update brushes
    for(let key in this._attrMeta){
      this._brushViews[key].selectAll("rect")
        .attr("width", "40")
        .attr("x", this._xScale(key) - 20);
    }

    // *****************************************
    // D3 BEHAVIORS
    // *****************************************

    this._plotZoom = d3.behavior.zoom()
      .x(this._xScale)
      .scaleExtent([1,1])
      .on("zoom", () => this.onPlotZoom())
      .on("zoomend", () => this.onPlotZoomEnd());

    // *****************************************
    // D3 AXES
    // *****************************************

    // update y axes
    for(let key in this._attrMeta){
      let axis: d3.svg.Axis = d3.svg.axis()
        .orient("left")
        .tickFormat(d3.format((",d")));
      this._yAxes[key] = axis;
      if(this._dataLoaded){
        this._yAxes[key].scale(this._yScales[key]);
      }
    }

    // *****************************************
    // DOM STRUCTURE / NODES
    // *****************************************
    this._svg
      .attr("width", this._size.width)
      .attr("height", this._size.height);

    // update chart container

    this._visNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")")
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height)
      .call(this._plotZoom);

    this._visBackground
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height);

    this._axesNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")");

    // update all y axis views and labels
    for(let key in this._attrMeta){
      this._yAxesViews[key]
        .attr("class", "y-axis axis")
        .attr("transform", "translate(" + this._xScale(key) + ", 0)")
        .call(this._yAxes[key]);

      this._yAxesLabels[key].text("" + this._attrMeta[key].Name);
    }

    // update axis labels

    // update data lines (objects)
    if (this._dataLoaded) {

      this._lines.selectAll('.line')
        .attr("d", (d) => this.getPath(d))
        .attr("class", (d) => this.getClass(d))
        .attr("id", (d) => ParallelCoordinates.getDataID(d))
        .attr("fill", "none")
        .on("click", (d) => this.toggleSelection(d))
        .on("tap", (d) => this.toggleSelection(d));

			this._lines.selectAll('.dot')
				.each((d) => this.updateTooltip(d.id));
    }

    if (this._visClientController.getActiveView() === undefined && this._dataLoaded) {
      // registers this module
      this._visClientController.registerView(this);
    }
  }

  /**
   * Calculates the path of the given data object
   *
   * @param d
   */
  getPath (d: any[]): string {
    let path: string = "M ";
    let count: number = 0;
    for(let key of this._attributeOrder){
      let yScale = this._yScales[key];
      let xScale = this._xScale;
      let y = yScale(d['attributes'][key]);
      let x = xScale(key);
        path += x + ", " + y + ", ";
      count++;
    }
    //console.log(path);
    return path;
  }

  /**
   * Switches y-axes as soon as the dragged axis x position is smaller or higher
   * then the previous or next axis x position
   * Updates all necessary components after switching
   *
   * @param key   attribute id of moved axis
   */
  moveAxis(key: any): void {
    // If event is type of event, server will not start because event.dx is not known as property of event
    let event: any = d3.event;
    let axis: d3.Selection<any> = this._yAxesViews[key];
    let axisXPos = this.getAxisXPos(axis);
    axis.attr("transform", "translate(" + event.x + ", 0)");
    this._brushViews[key].selectAll("rect")
      .attr("x", event.x - 20);

    let index = this._attributeOrder.indexOf(key);
    if(index > 1){
      let previousXPos = this._xScale(this._attributeOrder[index - 1]);
      if(previousXPos > axisXPos){
        let tmp = this._attributeOrder[index];
        this._attributeOrder[index] = this._attributeOrder[index -1];
        this._attributeOrder[index - 1] = tmp;
        this.updateXScale();
        this.updateAxis(this._attributeOrder[index]);
        this.updateLines();
        this.updateBrush(this._attributeOrder[index]);
      }
    }
    if(index < this._attributeOrder.length - 1){
      let nextXPos = this._xScale(this._attributeOrder[index + 1]);
      if(nextXPos < axisXPos){
        let tmp = this._attributeOrder[index];
        let swapKey = this._attributeOrder[index + 1];
        this._attributeOrder[index] = this._attributeOrder[index + 1];
        this._attributeOrder[index + 1] = tmp;
        this.updateXScale();
        this.updateAxis(swapKey);
        this.updateLines();
        this.updateBrush(swapKey);
      }
    }
  }

  /**
   * Called if the drag of an axis ends and updates vis.
   *
   * @param d     Key of dragged y axis
   */
  swapAxis(d: any): void {
    this.updateVis();
  }

  /**
   * Updates the x scale
   */
  updateXScale(): void {
    this._xScale.domain(this._attributeOrder)
      .rangePoints([0, this._sizePlot.width], 1);
  }

  /**
   * Updates position of the axis with the given key
   * @param key
   */
  updateAxis(key: any): void {
    this._yAxesViews[key].attr("transform", "translate(" + this._xScale(key) + ", 0)");
  }

  /**
   * Updates all data lines (objects)
   */
  updateLines(): void {
    this._lines.selectAll('.line')
      .attr("d", (d) => this.getPath(d))
  }

  /**
   * Updates position of the brush with the given key
   *
   * @param key
   */
  updateBrush(key: any): void {
    this._brushViews[key].selectAll("rect")
      .attr("width", "40")
      .attr("x", this._xScale(key) - 20);
  }

  /**
   * Returns x position of a given y axis
   * @param d           Y Axis from which the x position is calculated
   * @returns {number}  X position of given y axis
   */
  getAxisXPos(d: any): number {
    let transform: string = d.attr("transform");
    let axisXPos: number = + transform.substr(transform.indexOf("(") + 1,
      transform.indexOf(",") - transform.indexOf("(") - 1);
    return axisXPos;
  }

  toggleSelection (d: any[]): void {
    let obj = document.getElementById(ParallelCoordinates.getDataID(d));
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
    this._lines.selectAll('.line')
      .attr("class", (d) => this.getClass(d));
  }

  selectObjects(objects: HTMLElement[], emit?: boolean): void {
    console.log("select objects " + objects);

    for (let i = 0; i < objects.length; i++) {
      this._selectedObjectIds.add(objects[i].id);
      this.showTooltip(objects[i].id);
      objects[i].classList.add("selected");
      objects[i].parentNode.appendChild(objects[i]);
    }
    this._lines.selectAll('.line')
      .attr("class", (d) => this.getClass(d));
    if (emit) {
      this._visClientController.emitEvent(conf.get("events:selection:added"), Array.from(this._selectedObjectIds));
    }
  }

  deselectObjects(objects: HTMLElement[], emit?: boolean): void {
  	console.log("deselect objects " + objects);
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
    this.updateLineClassNames();
  }

  updateFilter(filteredObjectIds: string[]): void {
  	this._removedData = filteredObjectIds;
      this.updateLineClassNames();
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
    // Maybe later implemented for zoom and pan in P.C.
  }

  onPlotZoomEnd (): void {
    // Maybe later implemented for zoom and pan in P.C.
  }

  onPlotDrag (): void {
    // Maybe later implemented for zoom and pan in P.C.
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
      let obj = this.getObjectById(id);
      let yScale = this._yScales[this._attributeOrder[0]];
      let yValue = obj['attributes'][this._attributeOrder[0]];
      let yPos = yScale(yValue);
      let maxYPos = this.getMaxYPosition(obj);
      let offset = yPos - maxYPos;

      tip = d3tip()
        .attr('class', 'd3-tip')
        .attr('id', 'tip-' + id)
        .direction("nw")
        .offset([offset + 16, 50])
        .html(this._objMeta[id].Name);
      this._svg.call(tip);
      tip.show(id, document.getElementById(id));
    }
  }

  showTooltip(id: string): void {
    let tip: any = document.getElementById('tip-' + id);
		if (tip)
			tip.parentNode.removeChild(tip);

    let obj = this.getObjectById(id);
    let yScale = this._yScales[this._attributeOrder[0]];
    let yValue = obj['attributes'][this._attributeOrder[0]];
    let yPos = yScale(yValue);
    let maxYPos = this.getMaxYPosition(obj);
    let offset = yPos - maxYPos;

    tip = d3tip()
      .attr('class', 'd3-tip no-arrow')
      .attr('id', 'tip-' + id)
      .direction("nw")
      .offset([offset + 16, 50])
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

  getMaxYPosition(d: any): number {
    let keys = Object.keys(d.attributes);
    let max = this._sizePlot.height;
    for(let i = 0; i < keys.length; i++){
      let key = keys[i];
      if(this._yScales[key](d.attributes[key]) < max){
        max = this._yScales[key](d.attributes[key]);
      }
    }
    return max;
  }

  getObjectById(id: string): any {
    for(let i = 0; i < this._data.length; i++){
      if(this._data[i].id == id){
        return this._data[i];
      }
    }
    return null;
  }

  /**
   * After a brush all Objects are filtered and all data lines class names updated
   * @param key
   */
  brushed(key: string): void {
    this._filteredData = this.getFilteredObjects();
    this.updateLineClassNames();
    this.emitFilterViewportState();
  }

  /**
   *  Updates class names from all data line attributes.
   */
  updateLineClassNames(): void{
    this._lines.selectAll('.line')
      .attr("class", (d) => this.getClass(d));
  }

  swapAxisScale(key): void{
  	let range = this._yScales[key].range();
  	if(range[0] == 0){
      this._yScales[key].range([range[1], range[0]]);
    }
    else {
      this._yScales[key].range([range[1], range[0]]);
    }
    this.brushed(key);
    this.updateVis();
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
