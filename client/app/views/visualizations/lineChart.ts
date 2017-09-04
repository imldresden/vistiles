import * as conf from "../../../conf";
import * as utility from "../../../utility";
//import * as d3 from 'd3';
import * as d3tip from 'd3-tip';

declare let d3v4: any;

import {Visualization, Size, Indicator} from "./visualization";
import {VisClientController} from "../../controller/visClientController";
import {VisualizationMenu} from "../../ui/visualizationMenu";

export class LineChart extends Visualization{
  static viewId: string = 'lineChart';

  private _sizePlot: Size = {width: -1, height: -1};
  private _forcedSizeInfo: any;

  private _objects: any;
  private _objectsGroup: any;
  private _axesNode: any;
  private _axisXView: any;
  private _axisYView: any;
  private _axisXViewGrid: any;
  private _axisYViewGrid: any;
  private _axisXLabel: any;
  private _axisYLabel: any;

  private _scaleX: any;
  private _scaleY: any;
  private _transformedScaleX: any;
  private _transformedScaleY: any;

  private _axisX: any;
  private _axisY: any;
  private _axisXOverlay: any;
  private _axisYOverlay: any;

  private _zoom: any;

  private _dataAll: any[];
  private _filteredObjects: any[] = [];
  private _selectedPoint: {};
  private _regions: string[];
  private _zoomLevel: number;

  private _visMenu: VisualizationMenu;
  private _menuIcons: {};

  private _freezeObjectSize: boolean;

  get viewId(): string {
    return LineChart.viewId;
  }

  constructor(parent: HTMLElement, dataName: string, visClientController: VisClientController) {
    super(parent, visClientController);
    // Necessary as javascript is to dump to proper resolve this at other points.
    this._eventCallbacks[conf.get('events:selection:state')] = (data) => this.updateSelection(data);
    this._eventCallbacks[conf.get('events:filter:viewportState')] = (data) => this.updateFilter(data);
    this._eventCallbacks[conf.get('events:settings:attributesUpdate')] = (data) => this.onAttributeUpdate(data);
    this._eventCallbacks[conf.get('events:settings:attributesState')] = (data) => this.onAttributeState(data);
    this._eventCallbacks[conf.get('events:subGroup:hasLeft')] = (data) => LineChart.onDeviceLeft(data);
    this._eventCallbacks[conf.get('events:subGroup:left')] = () => LineChart.onSubgroupLeft();
    this._eventCallbacks[conf.get('events:view:align')] = (data) => this.onAlign(data);
    this._eventCallbacks[conf.get('events:view:aligned')] = (data) => this.onAligned(data);

    this._margin = {top: 50, right: 20, bottom: 25, left: 50};
    this._zoomLevel = 1;
    this._selectedPoint = { data: null, id: null };
    this._freezeObjectSize = false;
    this.updateSize();

    this._dataAttr = {
      'attrMappings': {
        'axisY': null,
        'axisX': null
      },
      'attr': {
        'maxY': null,
        'minY': null,
        'minX': null,
        'maxX': null
      },
      'filteredRegions': []
    };

    this._dataAttr.attrMappings['axisY'] = dataName[0];
    this._dataAttr.attrMappings['axisX'] = "Jahr";

    // loads the data from the server
    this.loadData();

    // loads a list of all data attributes from the server
    this.loadAttrMeta();
    this.loadObjMeta();
  }

  static getDataID (d: any[]): string {
    return d['id'];
  }

  loadData(): void {
    utility.apiLoad((res) => this.processData(res), 'data/attributes', this._dataAttr.attrMappings['axisY']);
  }

  loadAttrMeta(): void {
    utility.apiLoad((res) => this.processDataAttributes(res), 'data/attributes', 'meta');
  }

  loadObjMeta(): void {
    utility.apiLoad((res) => this.processDataObjects(res), 'data/objects', 'meta');
  }

  onAttributeUpdate(newDataAttr: {[id: string]: any}): void {
    this.updateDictionary(this._dataAttr, newDataAttr);
    if(newDataAttr.filteredRegions) {
      this.updateFilter(this._filteredObjects);
    } else {
      this.loadData();
    }
  }

  onAttributeState(device): void {
    let year = device.dataAttr.attr.year;

    if (year === undefined) {
      console.log("indicator not possible! exit");
      return;
    }

    if (Indicator.indexOfIndicator(device) >= 0){
      console.log("indicator already exists! exit");
      return;
    }

    let indicator = new Indicator (this, device);
    Indicator.addIndicator(indicator);
    indicator.initIndicator(this);
    indicator.setIndicatorIcon(device.view);
    indicator.updateIndicator(this, year, false);
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

  processData(res: string): void {
    let parsedData: any = JSON.parse(res);

    this._data = d3v4.entries(parsedData).map((id) => {
      return {
        id: id['key'],
        values: d3v4.entries(id['value']).map((d) => {
          return {
            year: d['key'],
            value: d['value']
          };
        })
      };
    });

    // get min and max for data keys (years) and values
    [this._dataAttr.attr['minX'], this._dataAttr.attr['maxX']] = this.getDataExtent(this._data, "year");
    [this._dataAttr.attr['minY'], this._dataAttr.attr['maxY']] = this.getDataExtent(this._data, "value");

    this._dataAll = this._data.slice();

    if (this._data && this._attrMeta && this._objMeta)
      this.drawVis();
  }

  processDataAttributes(res: string): void {
    this._attrMeta = JSON.parse(res);

    if (this._data && this._attrMeta && this._objMeta)
      this.drawVis();
  }

  processDataObjects(res: string): void {
    this._objMeta = JSON.parse(res);

    let regionsSet: Set<string> = new Set<string>();
    for (let objId in this._objMeta) {
      regionsSet.add(this._objMeta[objId].Region);
    }

    this._regions = Array.from(regionsSet);

    if (this._data && this._attrMeta && this._objMeta)
      this.drawVis();
  }

  getObjects(): string[] {
    let objects: string[] = [];
    for (let i = 0; i < this._dataAll.length; i++) {
      objects.push(this._dataAll[i][0]);
    }
    return objects;
  }

  getLineClass(d: any[]): string {
    let id = d['id'];
    let className = "country";
    if (this._regions)
      className += " group-" + this._regions.indexOf(this._objMeta[id].Region);
    return className;
  }

  getPointClass(id: string): string {
    let className = "value";
    if (this._regions)
      className += " group-" + this._regions.indexOf(this._objMeta[id].Region);
    return className;
  }

  getDataExtent(data: any, identifier: string): any[]{
    let min = d3v4.min(data, (c:any) => {
      return d3v4.min(c.values, (d) => {
        return d[identifier];
      });
    });

    let max = d3v4.max(data, (c:any) => {
      return d3v4.max(c.values, (d) => {
        return d[identifier];
      });
    });
    return [min, max];
  }

  private static formatYear(d): number{
    // return each year only once
    if (d % 1 === 0){
      return d;
    }
  }

  initializeVis(): void {
    this.initChartArea();
    this.initScales();
    this.initZoom();
    this.initAxes();
    this.initMenu();

    this.updateVis();

    this._visClientController.registerView(this);
    window.addEventListener('resize', () => this.onWindowResize());
  }

  updateVis(): void {
    this.resetZoom();
    this.updateSize();
    this.updateChartArea();
    this.updateScales();
    this.updateAxes();
    this.initLines();
    this.updateLines();
    this.updatePoints();
    this.updateSelection(Array.from(this._selectedObjectIds));
    this.updateFilter(this._filteredObjects);
    this.updateTooltips();
    this.updatePointTooltip();
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

  initChartArea(): void {
    this._svg = d3v4.select(this._parent).append('svg')
      .attr('class', 'line-chart');

    this._visNode = this._svg.append('g')
      .attr('class', 'chart-container');

    this._visBackground = this._visNode.append('rect')
      .attr('class', 'chart-bg');

    this._objects = this._visNode.append("svg")
      .attr("class", "data-objects")
      .attr("id", "objects");

    this._objectsGroup = this._objects.append("g")
      .attr("class", "group");
  }

  updateChartArea(): void {
    this._svg
      .attr('width', this._size.width)
      .attr('height', this._size.height);

    this._visBackground
      .attr('width', this._sizePlot.width)
      .attr('height', this._sizePlot.height);

    this._visNode
      .attr('transform', 'translate(' + this._margin.left + ', ' + this._margin.top + ')');

    this._objects
      .attr("width", this._sizePlot.width)
      .attr("height", this._sizePlot.height);
  }

  initScales(): void {
    this._scaleX = d3v4.scaleLinear();
    this._scaleY = d3v4.scaleLinear();
  }

  updateScales(): void {
    this._transformedScaleX = null;
    this._transformedScaleY = null;

    let minY = this._dataAttr.attr['minY'] - Math.abs(this._dataAttr.attr['minY'] * 0.2);
    let maxY = this._dataAttr.attr['maxY'] * 1.1;

    this._scaleX
      .domain([this._dataAttr.attr['minX'], this._dataAttr.attr['maxX']])
      .range([0, this._sizePlot.width]);

    this._scaleY
      .domain([minY, maxY])
      .range([this._sizePlot.height, 0]);
  }

  getScaleX(): any {
    let scaleX = this._scaleX;

    if (this._transformedScaleX)
      scaleX = this._transformedScaleX;

    return scaleX;
  }

  initAxes(): void {
    this._axisX = d3v4.axisBottom();
    this._axisXOverlay = d3v4.axisBottom();
    this._axisY = d3v4.axisLeft();
    this._axisYOverlay = d3v4.axisLeft();

    this._axesNode = this._svg.append('g')
      .attr('class', 'axes');

    this._axisXViewGrid = this._axesNode.append('g')
      .attr('class', 'axis x-axis-grid')
      .attr("pointer-events", "none");

    this._axisXView = this._axesNode.append('g')
      .attr('class', 'axis x-axis');

    this._axisXLabel = this._axisXView.append('text')
      .attr('id', 'x-axis-label')
      .attr('class', 'title')
      .style('text-anchor', 'end')
      .text('axis name x');

    this._axisYViewGrid = this._axesNode.append('g')
      .attr('class', 'axis y-axis-grid')
      .attr("pointer-events", "none");

    this._axisYView = this._axesNode.append('g')
      .attr('class', 'axis y-axis');

    this._axisYLabel = this._axisYView.append('text')
      .attr('id', 'y-axis-label')
      .attr('class', 'title')
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'end')
      .text('axis name y');
  }

  updateAxes(): void {
    this._axisX
      .scale(this._scaleX)
      .ticks(this._dataAttr.attr['maxX'] - this._dataAttr.attr['minX'])
      .tickFormat('')
      .tickSize(-this._sizePlot.height);

    this._axisXOverlay
      .scale(this._scaleX)
      .ticks(this._dataAttr.attr['maxX'] - this._dataAttr.attr['minX'])
      .tickFormat((d) => LineChart.formatYear(d));

    if (this._transformedScaleX) {
      this._axisX.scale(this._transformedScaleX);
      this._axisXOverlay.scale(this._transformedScaleX);
    }

    this._axisY
      .scale(this._scaleY)
      .ticks(10)
      .tickFormat('')
      .tickSize(-this._sizePlot.width);

    this._axisYOverlay
      .scale(this._scaleY)
      .ticks(10)
      .tickFormat(d3v4.format(',d'));

    if (this._transformedScaleY) {
      this._axisY.scale(this._transformedScaleY);
      this._axisYOverlay.scale(this._transformedScaleY);
    }

    this._axesNode
      .attr("transform", "translate(" + this._margin.left + ", " + this._margin.top + ")");

    this._axisXViewGrid
      .attr('transform', 'translate(0, ' + this._sizePlot.height + ')')
      .call(this._axisX);

    this._axisXView
      .attr('transform', 'translate(0, ' + this._sizePlot.height + ')')
      .call(this._axisXOverlay);

    this._axisXLabel
      .attr('x', this._sizePlot.width)
      .attr('dx', '-.4em')
      .attr('dy', '-.4em');

    this._axisYViewGrid
      .call(this._axisY);

    this._axisYView
      .call(this._axisYOverlay);

    this._axisYLabel
      .attr('x', 0)
      .attr('y', '1em')
      .attr('dx', '-.4em')
      .attr('dy', '.1em');

    this.updateAxisLabels();
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

  updateAxisLabels(): void {
    if (!this._attrMeta || !this._axisXLabel)
      return;

    this._axisXLabel.text(this._dataAttr.attrMappings['axisX']);

    if (this._axisYLabel && this._dataAttr.attrMappings['axisY'])
      this._axisYLabel.text(this._attrMeta[this._dataAttr.attrMappings['axisY']]['Name']);
  }

  initZoom(): void {
    this._zoom = d3v4.zoom()
      // sets the viewport extent to the specified array of points
      .extent([[0, 0],[this._sizePlot.width, this._sizePlot.height]])
      // sets the scale extent to the specified array of numbers
      .scaleExtent([1, 10])
      // sets the translate extent to the specified array of points
      .translateExtent([[0, 0],[this._sizePlot.width, this._sizePlot.height]])
      // sets the event listener for the specified typenames and returns the zoom behavior
      .on("zoom", () => this.onZoom());

    this._visNode.call(this._zoom);
  }

  private static resetZoomHandler(view): void {
    view.resetZoom();
  }

  resetZoom(): void {
    this._zoomLevel = 1;
    this._visNode.call(this._zoom.transform, d3v4.zoomIdentity);
  }

  onZoom(): void{
    let transform = d3v4.event.transform;
    this._zoomLevel = transform.k;

    // Returns a copy of the continuous scale x/y whose domain is transformed.
    this._transformedScaleX = transform.rescaleX(this._scaleX);
    this._transformedScaleY = transform.rescaleY(this._scaleY);

    this.updateAxes();
    this.updateLines();
    this.updatePoints();
    this.updateObjectSize();
    this.updateTooltips();

    let indicators = Indicator.getIndicators();

    for (let indicator in indicators){
      if (indicators[indicator].getIndicatorData()){
        let year = indicators[indicator].getIndicatorData();
        indicators[indicator].updateIndicator(this, year, false);
      }
    }

    // if menu is created
    if ((document.getElementById("resetZoom") != null)){

      // if zoomed in
      if (this._zoomLevel > 1) {
        document.getElementById("resetZoom").classList.remove("disabled");
      } else {
        document.getElementById("resetZoom").classList.add("disabled");
      }
    }


  }

  initLines(): void {
    // select all lines within the line chart
    let countries = this._objectsGroup.selectAll(".country")
      // join lines with data items (set id as key), or update data
      .data(this._data, function(d){
        return d.id;
      });

    // create new DOM elements for added data items
    countries.enter()
      .append('path')
      .attr("id", (d) => LineChart.getDataID(d))
      .attr("class", (d) => this.getLineClass(d))
      .on("click", (d) => this.toggleSelection(d));

    // add removed elements to the exit selection and remove them
    countries.exit()
      .each((d) => {
        this.hideTooltip("tip-" + d.id);
        this._objectsGroup.selectAll(".value")
          .filter("[data-id="+d.id+"]")
          .remove();
      })
      .remove();
  }

  updateLines(): void {
    let scaleX = this._scaleX;
    let scaleY = this._scaleY;

    if (this._transformedScaleX && this._transformedScaleY) {
      scaleX = this._transformedScaleX;
      scaleY = this._transformedScaleY;
    }

    let line = d3v4.line()
      .x((d: any[]) => { return scaleX(d['year']); })
      .y((d: any[]) => { return scaleY(d['value']); });

    this._objectsGroup.selectAll(".country")
      .attr("d", (d: any) => { return line(d['values']); })
      .each((d) => this.updateTooltip(d.id));

    this.updateObjectSize();
    this.emitFilterViewportState();
  }

  initPoints(id: string): void {
    this._objectsGroup.selectAll(".value")
      .filter("[data-id="+id+"]")
      .data(this._objectsGroup.selectAll("#"+id).data()[0].values)
      .enter()
      .append('circle')
      .attr("id", (d: any[]) => { return id + "-" + d['year']})
      .attr("class", () => this.getPointClass(id))
      .attr("data-id", id)
      .attr("r", 5)
      .on("click", (d) => this.onPointClick(d, id));
    this.updatePoints();
  }

  updatePoints(): void {
    let scaleX = this._scaleX;
    let scaleY = this._scaleY;

    if (this._transformedScaleX && this._transformedScaleY) {
      scaleX = this._transformedScaleX;
      scaleY = this._transformedScaleY;
    }

    this._objectsGroup.selectAll(".value")
      .attr("cx", (d: any[]) => { return scaleX(d['year']) })
      .attr("cy", (d: any[]) => { return scaleY(d['value']) });

    this.updateObjectSize();

    if (this._selectedPoint['id']) {
      this._objectsGroup.selectAll(".value")
        .each((d) => this.showPointTooltip(this._selectedPoint['data'], this._selectedPoint['id']));
    }
  }

  onPointClick(d, id): void {
    // get clicked element
    let circle = d3v4.select("#" + id + "-" + d.year);

    // if element was already selected
    if (circle.classed("selected")){
      // deselect element and hide tooltip
      this.hidePointTooltip();
      circle.classed("selected", false);

    } else {
      // deselect any other selected element
      this._objects.selectAll(".value")
        .filter(".selected")
        .classed("selected", false);

      // show tooltip and animate selection
      this.showPointTooltip(d, id);
      LineChart.selectPoint(d, id);

      // select element
      circle.classed("selected", true);
    }
  }

  private static selectPoint(d, id) {
    // define d3 transition (0.5s)
    let t = d3v4.transition()
      .duration(500)
      .ease();

    let el: string = id + "-" + d.year;
    let oldRadius: number = parseInt(document.getElementById(el).getAttribute("r"));

    // animate radius (1s)
    d3v4.select("#" + el)
      .transition(t)
      .attr("r", oldRadius * 2)
      .transition(t)
      .attr("r", oldRadius);
  }

  updateObjectSize(): void {
    if (!this._freezeObjectSize){
      if (this._zoomLevel > 2) {
        this._objects
          .selectAll(".country")
          .attr("stroke-width", this._zoomLevel * 3);

        this._objects
          .selectAll(".value")
          .attr("r", this._zoomLevel * 3.5);

        return
      }

      this._objects
        .selectAll(".value")
        .attr("r", 5);
      this._objects
        .selectAll(".country")
        .attr("stroke-width", 1.5);
    }
  }

  initMenu(): void {
    this._menuIcons = {
      clearSelection: {
        title: conf.get('strings:views:modules:visualizationMenu:buttons:clearSelection'),
        materialIcon: 'highlight_off',
        colorClass: 'cyan',
        handler: LineChart.clearSelectionHandler,
        type: 'button',
        enabled: 'disabled'
      },
      resetZoom: {
        title: conf.get('strings:views:modules:visualizationMenu:buttons:resetZoom'),
        materialIcon: 'zoom_out',
        colorClass: 'blue',
        handler: LineChart.resetZoomHandler,
        type: 'button',
        enabled: 'disabled'
      },
      freezeObjectSize: {
        title: conf.get('strings:views:modules:visualizationMenu:checkboxes:freezeObjectSize'),
        materialIcon: 'zoom_out',
        colorClass: 'blue',
        handler: LineChart.freezeObjectSize,
        type: 'checkbox'
      }
    };

    this._visMenu = new VisualizationMenu(this._parent, this._visClientController, this._menuIcons, this.viewId);
  }

  public static freezeObjectSize(view){
    view._freezeObjectSize = !view._freezeObjectSize;
    if (!view._freezeObjectSize) view.updateObjectSize();
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

  emitCurrentState(): void {

  }

  // emit event and filteredObjects to server
  emitFilterViewportState(): void {
    // check if some countries are currently not visible
    let filteredObjects = this.getFilteredObjects();

    // emit event 'viewportState' and filteredObjects
    this._visClientController.emitEvent(conf.get('events:filter:viewportState'), filteredObjects);
  }


  // get array of filtered objects (country ids), which are currently not visible in view
  getFilteredObjects (): any[] {
    // empty array of filtered ids
    let filtered = [];

    // for each id
    for (let i = 0; i < this._data.length; i++){
      let country = this._data[i];

      // add object to array of filtered ids
      filtered.push(country.id);

      // for each object of current id
      for (let j = 0; j < country.values.length; j++){
        let point = country.values[j];

        // check if object is in view
        if (this.isObjectInView(point)) {
          // remove it from array of filtered ids
          filtered.pop();
          break;
        }
      }
    }
    return filtered;
  }

  // check if an object is currently visible in view
  isObjectInView (d): boolean {
    let x: number;
    let y: number;

    // scale x and y
    if (this._transformedScaleX && this._transformedScaleY){
      x = this._transformedScaleX(d.year);
      y = this._transformedScaleY(d.value);
    } else {
      x = this._scaleX(d.year);
      y = this._scaleY(d.value);
    }

    // return true if x and y are currently in view
    return x >= 0 && x <= this._sizePlot.width && y >= 0 && y <= this._sizePlot.height;
  }

  toggleSelection (d: any[]): void {
    this.hidePointTooltip();
    this._objects.selectAll(".value")
      .filter(".selected")
      .classed("selected", false);
    let obj = document.getElementById(LineChart.getDataID(d));

    if (obj) {
      if (obj.classList.contains("selected")) {
        this.deselectObjects([obj], true);
      }
      else {
        this.selectObjects([obj], true);
      }
    }
  }

  selectObjects(objects: HTMLElement[], emit?: boolean): void {
    for (let i = 0; i < objects.length; i++) {
      this._selectedObjectIds.add(objects[i].id);
      this.initPoints(objects[i].id);
      this.showTooltip(objects[i].id);
      objects[i].classList.add("selected");
    }

    if (this._selectedObjectIds.size > 0) {
      this._objectsGroup.classed("selected-objects", true);
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
      this.hideTooltip("tip-" + objects[i].id);
      this.hideTooltip('tip-value');
      this._objectsGroup.selectAll(".value")
        .filter("[data-id="+objects[i].id+"]")
        .remove();
      objects[i].classList.remove("selected");
    }

    if (this._selectedObjectIds.size === 0){
      this._objectsGroup.classed("selected-objects", false);
      document.getElementById("clearSelection").classList.add("disabled");
    }

    if (emit)
      this._visClientController.emitEvent(conf.get("events:selection:removed"), ids);
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

  updateSelection(selectedIds: string[]): void {
    let currentSelectedIds: string[] = Array.from(this._selectedObjectIds);
    let objects: HTMLElement[] = [];
    let object: HTMLElement;
    for (let i = 0; i < currentSelectedIds.length; i++) {
      if (selectedIds.indexOf(currentSelectedIds[i]) < 0)  {
        this._selectedObjectIds.delete(currentSelectedIds[i]);
        this.hideTooltip("tip-" + currentSelectedIds[i]);
        object = document.getElementById(currentSelectedIds[i].toString());
        if (object) {
          objects.push(object);
        }
      }
    }
    if (objects.length)
      this.deselectObjects(objects);

    objects = [];
    for (let i = 0; i < selectedIds.length; i++) {
      this._selectedObjectIds.add(selectedIds[i]);
      object = document.getElementById(selectedIds[i]);
      if (object) {
        objects.push(object);
      }
    }
    this.selectObjects(objects);

    if (this._selectedObjectIds.size === 0) {
      this._objectsGroup.classed("selected-objects", false);

      if (document.getElementById("clearSelection")) {
        document.getElementById("clearSelection").classList.add("disabled");
      }
    }
  }

  updateFilter(d): void {
    this._filteredObjects = d;
    // copy of all data objects
    this._data = this.filterRegions();
    // will contain all objects without filtered elements
    let newData = [];

    // check for each country
    for (let i = 0; i < this._data.length; i++){
      // if its not filtered
      if (!d.includes(this._data[i].id))
        // and push it to a filtered array
        newData.push(this._data[i]);
    }

    // replace data with now filtered data
    this._data = newData.slice();

    // make object updates with filtered data
    this.initLines();
    this.updateLines();

    // update selections and tooltips
    this.updateSelection(Array.from(this._selectedObjectIds));
    this.updateTooltips()
  }

  filterRegions(): string[] {
    let that = this;
    // filteredRegions contains the index of _regions
    let data = this._dataAll.filter(function(value) {
      return that._dataAttr.filteredRegions.indexOf(that._regions.indexOf(that._objMeta[value.id].Region)) < 0;
    });

    return data;
  }

  showTooltip(id: any): void {
    this.hideTooltip("tip-" + id);

    let tip = d3tip()
      .attr('class', 'd3-tip ja')
      .attr('id', 'tip-' + id)
      .offset([-40, 0])
      .html(this._objMeta[id].Name);

    this._svg.call(tip);

    // get visible center point of line
    let target = document.getElementById(this.getObjectCenterPoint(id));

    // if valid target
    if (target !== null) {
      // show tooltip attached to target
      tip.show(id, target);
    }
  }

  getObjectCenterPoint(id: string): string {
    // get data for object
    let data = d3v4.select("#" + id).data()[0];
    if (data == null)
      return null;

    let center = this._sizePlot.width / 2;
    let centerPoint: number;
    let distance: number = this._sizePlot.width;

    // get current scales
    let scaleX = this._scaleX;
    let scaleY = this._scaleY;

    // update scales after transformations
    if (this._transformedScaleX && this._transformedScaleY) {
      scaleX = this._transformedScaleX;
      scaleY = this._transformedScaleY;
    }

    // check for each data point of object
    for (let i = 0; i < data.values.length; i++) {
      // get x and y positions of data point
      let x = scaleX(data.values[i].year);
      let y = scaleY(data.values[i].value);

      // if data point is in view
      if (x >= 0 && x <= this._sizePlot.width && y >= 0 && y <= this._sizePlot.height) {
        // if data point has less distance to center (x) than previous points
        if (distance > Math.abs(center - x)) {
          // set best distance
          distance = Math.abs(center - x);
          // set best center point
          centerPoint = data.values[i].year;
        }
      }
    }

    // if there is a valid data point
    if (centerPoint !== null) {
      // return id
      return id + "-" + centerPoint;
    } else {
      // no valid data point
      return null;
    }

  };

  hideTooltip(id: any): void {
    let tip: HTMLElement = document.getElementById(id);
    if (tip) {
      tip.parentNode.removeChild(tip);
    }
  }

  updateTooltip(id: string): void {
    this.hideTooltip("tip-" + id);

    if (this._selectedObjectIds.has(id)) {
      let tip = d3tip()
        .attr('class', 'd3-tip ja')
        .attr('id', 'tip-' + id)
        .offset([-40, 0])
        .html(this._objMeta[id].Name);

      this._svg.call(tip);

      // get visible center point of line
      let target = document.getElementById(this.getObjectCenterPoint(id));

      // if valid target
      if (target !== null) {
        // show tooltip attached to target
        tip.show(id, target);
      }
    }
  }

  updateTooltips(): void {
    // get all selected objects
    let selections = Array.from(this._selectedObjectIds);

    // for each selected object
    selections.forEach((d) => {
      // if object is in DOM (=visible)
      if (document.getElementById(d))
        // update tooltip for this object
        this.updateTooltip(d)
    })
  }

  showPointTooltip(d: any, id: string): void {
    this.hideTooltip("tip-value");

    let tip = d3tip()
      .attr('class', 'd3-tip ja')
      .attr('id', 'tip-value')
      .offset([-5, 0])
      .html(d.year + ": " + Math.round(d.value * 100) / 100);

    this._svg.call(tip);
    let target = document.getElementById(id + "-" + d.year);
    if (target !== null) {
      tip.show(null, target);
      this._selectedPoint = { data: d, id: id };
    }
  }

  updatePointTooltip(): void {
    if (this._selectedPoint['id']) {
      this._selectedPoint['data'] = d3v4.select("#" + this._selectedPoint['id'] + "-" + this._selectedPoint['data'].year).data()[0];
      this.showPointTooltip(this._selectedPoint['data'], this._selectedPoint['id']);
    }
  }

  hidePointTooltip(): void {
    d3v4.selectAll("#tip-value").remove();
    this._selectedPoint = { data: null, id: null };
  }

  onWindowResize(): void {
    this.hidePointTooltip();
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
