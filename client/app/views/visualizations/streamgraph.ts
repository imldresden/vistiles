// module that represents a basic streamgraph
//define(['d3', 'd3tip', 'utility', 'conf', 'log'], function (d3, d3tip, utility, conf, log) {

import * as conf from "../../../conf";
import * as utility from "../../../utility";
import {Visualization, Size, Indicator} from "./visualization";
import {VisClientController} from "../../controller/visClientController";
import {VisualizationMenu} from "../../ui/visualizationMenu";
import * as d3 from 'd3';
import * as d3tip from 'd3-tip';
//let d3tip = require('../../../../public/static/lib/d3-tip/d3-tip')(d3);

export class Streamgraph extends Visualization{
  static viewId: string = 'streamgraph';

  private _sizePlot: Size = {width: -1, height: -1};
  private _forcedSizeInfo: any;

  // references to important dom elements
  private _axesNode: d3.Selection<any>;
  private _streams: d3.Selection<any>;
  private _axisXView: d3.Selection<any>;
  private _axisYView: d3.Selection<any>;
  private _axisXLabel: d3.Selection<any>;
  private _axisYLabel: d3.Selection<any>;

  // references to D3 components
  private _scaleX: d3.scale.Linear<number, number>;
  private _scaleY: d3.scale.Linear<number, number>;
  private _axisX: d3.svg.Axis;
  private _axisY: d3.svg.Axis;
  private _ruler: d3.Selection<any>;

  // data variables and containers
  private _yearsMeta: Object;
  private _removedData: any[] = [];
  private _dataLoaded: boolean = false;
  private _initialized: boolean = false;
  private _regions: string[];
  private _lastFilteredObjectIds: any[] = [];

  //for streamgraph
  private _layoutStack;
  private _layers;
  private _baselineLabel;
  private _baseline = "wiggle";
  private _synchronizedYear: number;

  private _baselineNames = {
  	'wiggle': 'Streamgraph',
		'silhouette': 'ThemeRiver',
		'zero': 'Stacked Graph'
	};

  private _dataAll: any[] = [];

  private _visMenu: VisualizationMenu;
  private _menuIcons: {};


  get viewId() { return Streamgraph.viewId; };

  constructor(parent, dataName, visClientController: VisClientController) {
    super(parent, visClientController);
    // Necessary as javascript is to dump to proper resolve this at other points.
    this._eventCallbacks[conf.get('events:selection:state')] = (data) => this.updateSelection(data);
    this._eventCallbacks[conf.get('events:settings:attributesUpdate')] = (data) => this.onAttributeUpdate(data);
    this._eventCallbacks[conf.get('events:filter:viewportState')] = (data) => this.updateFilter(data);
	this._eventCallbacks[conf.get('events:settings:attributesState')] = (data) => this.updateAttributeState(data);
    this._eventCallbacks[conf.get('events:view:align')] = (data) => this.onAlign(data);
    this._eventCallbacks[conf.get('events:view:aligned')] = (data) => this.onAligned(data);
    this._eventCallbacks[conf.get('events:subGroup:hasLeft')] = (data) => Streamgraph.onDeviceLeft(data);
    this._eventCallbacks[conf.get('events:subGroup:left')] = () => Streamgraph.onSubgroupLeft();

    this._dataAttr = {
      'attrMappings': {
        'axisY': null,
      },
      'attr': {
        'maxX': null,
        'minX': null,
        'maxY': null,
        'minY': 0,
      },
      'filteredRegions': []
    };

    // saves the root (main) div node
    this._parent = parent;

    // sets the width and height based on the parent node
    this._margin = {top: 60, right: 20, bottom: 25, left: 80};
    this.updateSize();

    // initializes main components
    this.initializeVis();

    // loads the data
    this.loadDataByYear(dataName);

    // register window callbacks
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Returns identifier string of a data object.
   *
   * @param d        Data that should be used
   * @returns {string}  The identifier string
   */
  static getDataID (d: any): string {
    return d.id;
  }

  /**
   * Calculates and returns the X value for an object.
   *
   * @param d       The data array of the corresponding object.
   * @param scale   If true, the value will be adjusted according
   *                to the scale used for the D3 chart.
   * @returns {*}   The calculated X value for the data object.
   */
  getX(d: any[], scale?: boolean): number {
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
  getY(d: any[], scale?: boolean): number {
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
          filtered.push(Streamgraph.getDataID(this._data[i]));
    return filtered.concat(this._removedData);
  }

  getScaleXforX(d):number {
    return this._scaleX(d.x);
  }

  getScaleX(): any {
    return this._scaleX;
  }

  /**
   * Returns the scaled y offset of a given data object
   * @param d           data object
   * @returns {number}  scaled y offset of given data object
   */
  getY0(d): number {
    return this._scaleY(d.y0);
  }

  /**
   * Returns the scaled top position of a given data object.
   * Top position is equal to the sum of y offset and height (y)
   * @param d           data object
   * @returns {number}  Scaled top position
   */
  getY0andY(d): number {
    return this._scaleY(d.y0 + d.y);
  }

  /**
   * Returns the values of a given data object
   * @param d   data object
   */
  getValues(d): any[] {
    return d.values;
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

    // *****************************************
    // D3 BEHAVIORS
    // *****************************************

    // *****************************************
    // D3 AXES
    // *****************************************

    this._axisX = d3.svg.axis()
      .orient("bottom")
      .scale(this._scaleX)
      .ticks(10)
      .tickFormat(d3.format(("d")))
      .tickPadding(6);
    this._axisY = d3.svg.axis()
      .orient("left")
      .scale(this._scaleY)
      .tickFormat(d3.format((",d")))
      .tickPadding(6);

    // *****************************************
    // OTHER D3 COMPONENTS
    // *****************************************

    this._layoutStack = d3.layout.stack()
      .offset(this._baseline)
      .values((d) => this.getValues(d));

    // *****************************************
    // DOM STRUCTURE / NODES
    // *****************************************

    // creates and appends the svg container
    this._svg = d3.select(this._parent).append("svg")
      .attr("id", "streamgraph")
      .attr("class", "vis");

    // creates a zoomable container for the actual plot
    this._visNode = this._svg.append("g")
      .attr("class", "plot");

    // creates and appends a rect node (background)
    this._visBackground = this._visNode.append("rect")
      .attr("class", "plot-bg");

    // create and append a axes container
    this._axesNode = this._svg.append("g")
      .attr("class", "axes");

    // creates and appends the x axis
    this._axisXView = this._axesNode.append("g")
      .attr("class", "x-axis axis");

    // creates and appends the x axis label
    this._axisXLabel = this._axisXView.append("text")
      .attr("id", "x-axis-label")
      .attr("class", "title")
      .style("text-anchor", "end")
      .text("name x axis");

    // creates and appends the y axis
    this._axisYView = this._axesNode.append("g")
      .attr("class", "y-axis axis");

    //creates and appends the y axis label
    this._axisYLabel = this._axisYView.append("text")
      .attr("id", "y-axis-label")
      .attr("class", "title")
      .attr("transform", "rotate(-90)")
      .style("text-anchor", "end")
      .text("name y axis");

    // creates and appends a group container for the data objects
    this._streams = this._visNode.append("g")
      .attr("top", 0)
      .attr("left", 0)
      .attr("pointer-events", "all")
      .attr("class", "data-objects");

/*    // defines drag interactions for ruler
		let drag = d3.behavior.drag()
			.on("drag", () => this.onRulerDragged())
			.on("dragend", () => this.onRulerDragEnd());

		// creates and appends a ruler to choose a year for other visualizations, adds drag interaction
		this._ruler = this._visNode.append("g")
			.attr("class", "ruler")
			.attr("height", this._sizePlot.height)
			.attr("width", 2)
			.attr("transform", "translate( + " + this._margin.left + ", " + this._margin.top + ")")
			.attr("pointer-events", "all")
			.attr("visibility", "hidden")
			.call(drag);

		// creates and appends a visual representation for the ruler
		this._ruler.append("rect")
			.attr("height", this._sizePlot.height)
			.attr("width", 2)
			.attr("top", 0)
			.attr("left", 0);

		this._ruler.append("circle")
			.attr("r", 16)
			.attr("left", -15)
			.attr("top", -16);*/


    // creates and appends button label
    this._baselineLabel = this._axesNode.append('g')
      .attr("class", "baselineLabel");

    this._baselineLabel
      .append('text')
      .attr('x', this._sizePlot.width - 20)
      .attr('y', 20)
      .attr('text-anchor', 'end')
      .text(this._baselineNames[this._baseline]);


  }

  /**
   * Returns true if a data objects is inside the view, not offscreen.
   * Allways returns true
   * If zoom and pan is added later, change this function
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

    let x = this.getX(d),
      y = this.getY(d);

    let checkX = x >= xLow && x <= xHigh,
      checkY = y >= yLow && y <= yHigh;

    return checkX && checkY;
  }

  /**
   * Loads data from the server.
   *
   * Besides the data attributes for the y axis this function can optionaly take an
   * start and end year for the x axis.
   *
   * @param dataName  Data attributes (rows) used to map objects to
   *                  visual properties.
   * @param yearStart Specifies the start of time area
   * @param yearEnd   Specifies the end of time area
   */
  loadDataByYear(dataName?: string, yearStart?: number, yearEnd?: number): void {
    // resets dataLoaded
    this._dataLoaded = false;

    if (dataName) {
      // sets selected data attributes
      this._dataAttr.attrMappings['axisY'] = dataName[0];
    }

    // loads the meta data for all years
    this.loadYearMeta();

    // loads a list of all data attributes from the server
    this.loadAttrMeta();
    this.loadObjMeta();

    // loads the data from the server
    this.loadData();
  }

  loadData(): void {
    utility.apiLoad((response) => this.processData(response), 'data/attributes/' + this._dataAttr.attrMappings['axisY']);
  }

  loadAttrMeta(): void {
    utility.apiLoad((response) => this.processDataAttributes(response), 'data/attributes', "meta");
  }

  loadObjMeta(): void {
    utility.apiLoad((response) => this.processDataObjects(response), 'data/objects', 'meta');
  }

  loadYearMeta(): void {
    utility.apiLoad((response) => this.processYearData(response), 'data/times', 'meta');
  }

  onAttributeUpdate (newDataAttr: {[id: string]: any}): void {
    this.updateDictionary(this._dataAttr, newDataAttr);
    if(newDataAttr.filteredRegions) {
      this.updateFilter(this._lastFilteredObjectIds);
    } else {
      this.loadDataByYear();
    }
  }

  /**
   * Processes the meta data for all years
   * @param res
   */
  processYearData (res: string): void {
    this._yearsMeta = JSON.parse(res);

    //updates the visualization
    this.updateVis();
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
    let tmpID;
    let maxY = null,
      maxX = null,
      minX = null;
    this._dataAttr.attr['minX'] = this._dataAttr.attr['maxX'] =
      this._dataAttr.attr['minY'] = this._dataAttr.attr['maxY'] =
      this._dataAttr.attr['minSize'] = this._dataAttr.attr['maxSize'] = null;

    for (let key in parsedData) {
      if (!parsedData.hasOwnProperty(key))
        continue;

      tmpID = key;
      let tmpMaxY = 0;
      let tmpYears = {id: tmpID, values: []};

      for(let year in parsedData[key]) {
          if (parsedData[key][year] == "") {
            parsedData[key][year] = 0;
          }
          if (parsedData[key][year] < 0) {
            parsedData[key][year] = 0;
          }

          tmpYears.values.push({x: +year, y: parsedData[key][year]});

          tmpMaxY += +parsedData[key][year];
          if (maxX == null || maxX < +year) {
            maxX = +year;
          }
          if (minX == null || minX > +year) {
            minX = +year
          }
      }
      this._data.push(tmpYears);

      if(maxY == null || maxY < tmpMaxY){
          maxY = tmpMaxY;
      }
    }
    this._dataAttr.attr['maxY'] = maxY;
    this._dataAttr.attr['minY'] = 0;
    this._dataAttr.attr['minX'] = minX;
    this._dataAttr.attr['maxX'] = maxX;

    // sort the data set by x attribute
    this._data.sort((a, b) => {
      return this.getX(a, false) - this.getX(b, false);
    });

    // sets dataLoaded
    this._dataLoaded = true;
    this._dataAll = this._data;

    // add dom elements for every data object
    this._streams.selectAll(".stream");

    // updates the visualization
    this.updateVis();
  }

  onWindowResize (): void {
    // sets the width and height based on the parent node
    this.updateSize();

    // updates the visualization
    this.updateVis();
  }

  getClass(d: any): string {
    let id = d.id;
    let className = 'stream object';
    if (this._selectedObjectIds.has(id))
      className += ' selected';
    else
      if(this._selectedObjectIds.size > 0)
        className += ' not-selected';
    if (this._regions)
      className += ' group-' + this._regions.indexOf(this._objMeta[id].Region);
    return className;
  }

  /**
   * Updates all visualization components, e.g., scales, D3 behaviors,
   * axes, DOM elements.
   */
  updateVis (): void {
    // *****************************************
    // OTHER D3 COMPONENTS
    // *****************************************

    this._layoutStack.offset(this._baseline);

    let area = d3.svg.area().interpolate("basis")
      .x((d) => this.getScaleXforX(d))
      .y0((d) => this.getY0(d))
      .y1((d) => this.getY0andY(d));

    if(this._dataLoaded) {
      this._layers = this._layoutStack(this._data);
    }

    // *****************************************
    // D3 SCALES
    // *****************************************

    this._scaleX
      .domain([this._dataAttr.attr['minX'], this._dataAttr.attr['maxX']])
      .range([0, this._sizePlot.width]);

    if(this._dataLoaded){
      this._scaleY
        .domain([d3.min(this._layers, (d) => this.getY0Unscaled(d)), d3.max(this._layers, (d) => this.getY0andYUnscaled(d))])
        .range([this._sizePlot.height, 0]);
    }

    // *****************************************
    // D3 AXES
    // *****************************************

    if(this._dataLoaded){
      this._axisY.scale(this._scaleY);
    }

    // *****************************************
    // DOM STRUCTURE / NODES
    // *****************************************

    this._svg
      .attr("width", this._size.width)
      .attr("height", this._size.height);

    this._visNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")")
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height);

    this._visBackground
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height);

    this._axesNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")");

    this._axisXView
      .attr("transform", "translate(0, " + this._sizePlot.height+ ")")
      .call(this._axisX);

    //this._ruler.attr("height", this._sizePlot.height);

    this._axisXLabel
      .attr("x", this._sizePlot.width);

    if (this._attrMeta) {
      if (this._axisXLabel)
        this._axisXLabel.text("");

      if (this._axisYLabel && this._dataAttr.attrMappings['axisY'])
        this._axisYLabel.text(this._attrMeta[this._dataAttr.attrMappings['axisY']]['Name']);
    }

    // update data points (objects)
    if(this._dataLoaded) {

      //update y axis view
      this._axisYView
        .call(this._axisY);

      //initialize streams, if already initialized update streams
      if(!this._initialized) {
        this._streams.selectAll("path")
          .data(this._layers)
          .enter().append("path")
          .attr("d", (d: any) => area(d.values))
          .attr("class", (d) => this.getClass(d))
          .attr("id", (d) => Streamgraph.getDataID(d))
          .on("click", (d) => this.toggleSelection(d))
          .on("tap", (d) => this.toggleSelection(d));

        //update tooltips
        this._streams.selectAll("path")
          .each((d) => this.updateTooltip(d.id));
        this._initialized = true;
      }
      else{
        this._streams.selectAll("path").data(this._layers)
          .attr("d", (d: any) => area(d.values))
          .attr("class", (d) => this.getClass(d))
          .attr("id", (d) => Streamgraph.getDataID(d));

        //update tooltips
        this._streams.selectAll("path")
          .each((d) => this.updateTooltip(d.id));
      }
    }

    //Update change baseline button label text
    this._baselineLabel.select('text').text(this._baselineNames[this._baseline]);


    if (this._visClientController.getActiveView() != self && this._dataLoaded) {
      // registers this module
      this._visClientController.registerView(this);
      if (this._visMenu == undefined) {
        this.initMenu();
      }
    }
  }

  getObjectById(id): any {
    for(let i = 0; i < this._layers.length; i++){
      if(this._layers[i].id == id){
        return this._layers[i];
      }
    }
    return null;
  }

  getY0Unscaled(d) : number {
    return d3.min(d['values'], function(obj){return +obj['y0']});
  }

  getMaxYXPos(d) : any[] {
    let max = 0;
    let offsetX = 0;
    let offsetY = 0;
    for(let i = 0; i < d.values.length; i++){
      if(d.values[i].y > max){
        max = d.values[i].y;
        offsetX = d.values[i].x;
        offsetY = d.values[i].y0;
      }
    }
    return [offsetX, offsetY];
  }

  getY0andYUnscaled(d) : number {
    return d3.max(d['values'], function(obj){return obj['y0'] + obj['y']});
  }

  toggleSelection (d: any): void {
    let obj = document.getElementById(Streamgraph.getDataID(d));
    //console.log("x=" + getX(data) + " , y=" + getY(data));
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
    this._streams.selectAll("path")
      .attr("class", (d) => this.getClass(d));
  }

  selectObjects(objects: HTMLElement[], emit?: boolean): void {
    for (let i = 0; i < objects.length; i++) {
      this._selectedObjectIds.add(objects[i].id);
      this.showTooltip(objects[i].id);
      objects[i].classList.add("selected");
    }

    if (this._selectedObjectIds.size > 0) {
      this._streams.classed("selected-objects", true);
      document.getElementById("clearSelection").classList.remove("disabled");
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

    if (this._selectedObjectIds.size === 0){
      this._streams.classed("selected-objects", false);
      document.getElementById("clearSelection").classList.add("disabled");
    }


    if (emit)
      this._visClientController.emitEvent(conf.get("events:selection:removed"), ids);
  }

  updateSelection(selectedIds: string[]): void {
  	if(!this.arraysWithSameValues(this._selectedObjectIds, selectedIds)) {
      //console.log("update selection");
      let objects = <HTMLElement[]>Array.from(document.getElementsByClassName('selected'));
			this.deselectObjects(objects);
      this._selectedObjectIds.clear();
			objects = [];
			for (let i = 0; i < selectedIds.length; i++) {
				objects.push(document.getElementById(selectedIds[i]));
        this._selectedObjectIds.add(selectedIds[i]);
			}
			this.selectObjects(objects);
			this._streams.selectAll("path").attr("class", (d) => this.getClass(d));
		}

    if (this._selectedObjectIds.size === 0) {
      this._streams.classed("selected-objects", false);

      if (document.getElementById("clearSelection")) {
        document.getElementById("clearSelection").classList.add("disabled");
      }
    }

  }

  filterRegions(): any[] {
    let that = this;
    // filteredRegions contains the index of _regions
    let data = this._dataAll.filter(function(value) {
      return that._dataAttr.filteredRegions.indexOf(that._regions.indexOf(that._objMeta[value.id].Region)) < 0;
    });

    return data;
  }

  updateFilter(filteredObjects: string[]): void {
  	//console.log("Update filter ");
  	//if(!this.arraysWithSameValues(this._lastFilteredObjectIds, filteredObjects)){
      let newData: any[] = [];
      let oldData = this.filterRegions();
      for (let i = 0; i < oldData.length; i++) {
        if (filteredObjects.indexOf(oldData[i].id) == -1) {
          newData.push(oldData[i]);
        }
      }
      this._streams.selectAll("path")
        .each((d) => this.hideTooltip(d.id))
        .remove();
      this._data = newData;
      this.updateStreamsAndYAxes()
    //}
	  this._lastFilteredObjectIds = filteredObjects;
  }

	updateStreamsAndYAxes(): void {
		//console.log("update streams and axes");
		this._layers = this._layoutStack(this._data);

		this._scaleY
			.domain([d3.min(this._layers, (d) => this.getY0Unscaled(d)), d3.max(this._layers, (d) => this.getY0andYUnscaled(d))]);

		this._axisY.scale(this._scaleY);
		this._axisYView
			.call(this._axisY);

		let area = d3.svg.area().interpolate("basis")
			.x((d) => this.getScaleXforX(d))
			.y0((d) => this.getY0(d))
			.y1((d) => this.getY0andY(d));

		this._streams.selectAll("path")
			.data(this._layers)
			.enter().append("path")
			.attr("d", (d: any) => area(d.values))
			.attr("class", (d) => this.getClass(d))
			.attr("id", (d) => Streamgraph.getDataID(d))
			.on("click", (d) => this.toggleSelection(d))
			.on("tap", (d) => this.toggleSelection(d));

		this._streams.selectAll("path")
			.each((d) => this.updateTooltip(d.id));
	}

  emitCurrentState(): void {
    this.emitSelectionState();
  }

  getObjects(): any[] {
    let objects = [];
    for (let i = 0; i < this._data.length; i++) {
      objects.push(this._data[i][0]);
    }
    return objects;
  }

  updateTooltip(id: string): void {
    //console.log("update tooltip: " + id);
    let tip: any = document.getElementById('tip-' + id);
    if (tip)
      tip.parentNode.removeChild(tip);

    if (this._selectedObjectIds.has(id)) {
      let obj = this.getObjectById(id);
      let yStart = this._scaleY(obj.values[0].y0);
      let yEnd = this._scaleY(obj.values[0].y0 + obj.values[0].y);
      let yMiddle = (yStart - yEnd) / 2 + yEnd;
      let yMax = this._scaleY(this.getY0andYUnscaled(obj));
      let tipOffset = (yMiddle - yMax) + 16;

      tip = d3tip()
        .attr('class', 'd3-tip no-arrow')
        .attr('id', 'tip-' + id)
        .direction('nw')
        .offset([tipOffset, 50])
        .html(this._objMeta[id].Name);
      this._svg.call(tip);
      tip.show(id, document.getElementById(id));
    }
  }

  showTooltip(id: string): void {
    //console.log("show tooltip: " + id);
    let tip: any = document.getElementById('tip-' + id);
    if (tip) {
      this.hideTooltip(id);
    }

    let obj = this.getObjectById(id);
    let yStart = this._scaleY(obj.values[0].y0);
    let yEnd = this._scaleY(obj.values[0].y0 + obj.values[0].y);
    let yMiddle = (yStart - yEnd) / 2 + yEnd;
    let yMax = this._scaleY(this.getY0andYUnscaled(obj));
    let tipOffset = (yMiddle - yMax) + 16;

    tip = d3tip()
      .attr('class', 'd3-tip no-arrow')
      .attr('id', 'tip-' + id)
      .direction('nw')
      .offset([tipOffset, 50])
      .html(this._objMeta[id].Name);
    this._svg.call(tip);
    tip.show(id, document.getElementById(id));
  }

  hideTooltip(id: string): void {
    //console.log("hide tooltip: " + id);
    let tip = document.getElementById('tip-' + id);
    if (tip) {
      tip.parentNode.removeChild(tip);
    }
  }

	arraysWithSameValues(arrayA, arrayB): boolean {
		if (arrayA.length != arrayB.length)
			return false;

		let a = Array.from(arrayA);
		let b = Array.from(arrayB);
		a.sort();
		b.sort();
		for (let i=0; i < a.length; i++) {
			if (a[i] != b[i])
				return false;
		}
		return true;
	}

	updateAttributeState(device): void {
    let year: number = device.dataAttr.attr.year;

    if (Indicator.indexOfIndicator(device) >= 0){
      console.log("indicator already exists! exit");
      return;
    }

    let indicator = new Indicator (this, device, true);
    Indicator.addIndicator(indicator);
    indicator.initIndicator(this);
    indicator.setIndicatorIcon(device.view);
    indicator.updateIndicator(this, year, false);
	}

  updateVisualizationAttribute(data, deviceId): void {
    this._visClientController.emitEvent(conf.get('events:settings:attributesUpdate'), {
      dataAttr: {
        attr: {
          year: data
        }
      },
      deviceId: deviceId
    });
  }

  // if another device left the subgroup
  private static onDeviceLeft(device): void {
    let indicators = Indicator.getIndicators();

    for (let i = 0; i < indicators.length; i++){
      if (device.id === indicators[i].getDeviceId()){
        Indicator.removeIndicator(i);
      }
    }
  }

  // if the linechart left the subgroup
  private static onSubgroupLeft(): void {
    Indicator.removeAllIndicators();
  }

  initMenu(): void {
    this._menuIcons = {
      swapBaseline: {
        title: conf.get('strings:views:modules:visualizationMenu:buttons:swapBaseline'),
        materialIcon: 'swap_horiz',
        colorClass: 'blue',
        handler: Streamgraph.swapBaselineHandler,
        type: 'button',
        enabled: 'enabled'
      },
      clearSelection: {
        title: conf.get('strings:views:modules:visualizationMenu:buttons:clearSelection'),
        materialIcon: 'highlight_off',
        colorClass: 'cyan',
        handler: Streamgraph.clearSelectionHandler,
        type: 'button',
        enabled: 'disabled'
      },
    };

    this._visMenu = new VisualizationMenu(this._parent, this._visClientController, this._menuIcons, this.viewId);
  }

  public addMenuEvents(icons):void {
    for (let icon in icons) {
      if (icons.hasOwnProperty(icon)){
        let iconBtn = document.getElementById(icon);
        iconBtn.addEventListener('click', () => icons[icon].handler(this));
        iconBtn.addEventListener('tap', () => icons[icon].handler(this));
      }
    }
  }

  private static swapBaselineHandler(view): void {
    switch(view._baseline){
      case "wiggle" : view._baseline = "silhouette"; break;
      case "silhouette" : view._baseline = "zero"; break;
      case "zero" : view._baseline = "wiggle"; break;
    }
    view.updateVis();
  }

  private static clearSelectionHandler(view){
    // if button to clear selection is enabled
    if (!document.getElementById("clearSelection").classList.contains("disabled")){
      // remove all selected objects with other views
      view._visClientController.emitEvent(conf.get("events:selection:removed"), Array.from(view._selectedObjectIds));

      // fallback if this view is not combined
      view.updateSelection([]);
    }
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
