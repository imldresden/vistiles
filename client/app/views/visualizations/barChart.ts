//basic chart module
import * as conf from "../../../conf";
import * as utility from "../../../utility";
import {Size, Visualization} from "./visualization";
import {VisClientController} from "../../controller/visClientController";
import {Domain} from "domain";
import * as d3 from 'd3';
import * as d3tip from 'd3-tip';
//let d3tip = require('../../../../public/static/lib/d3-tip/d3-tip')(d3);

export class BarChart extends Visualization{
  static viewId: string = 'barChart';

  private _sizePlot: Size = {width: -1, height: -1};
  private _forcedSizeInfo: any;

  private _axisXView: d3.Selection<any>;
  private _axisYView: d3.Selection<any>;
  private _axisXViewGrid: d3.Selection<any>;
  private _axisYViewGrid: d3.Selection<any>;
  private _axisXLabel: d3.Selection<any>;
  private _axisYLabel: d3.Selection<any>;

  private _scaleX: d3.scale.Ordinal<string, number>;
  private _scaleY: d3.scale.Linear<number, number>;

  private _axisX: d3.svg.Axis;
  private _axisY: d3.svg.Axis;
  private _axisXOverlay: d3.svg.Axis;
  private _axisYOverlay: d3.svg.Axis;

  private _dataAll: any[];
  private _filteredObjectIds: string[] = [];
  private _regions: string[];
  private _initiated: boolean;

  get viewId(): string { return BarChart.viewId; }

  constructor(parent: HTMLElement, dataName: string, visClientController: VisClientController, dataYear?: number) {
    super(parent, visClientController);
    // Necessary as javascript is to dump to proper resolve this at other points.
    this._eventCallbacks[conf.get('events:selection:state')] = (data) => this.updateSelection(data);
    this._eventCallbacks[conf.get('events:filter:displayExtension')] = (data) => this.updateFilter(data);
    this._eventCallbacks[conf.get('events:filter:viewportState')] = (data) => this.updateFilter(data);
    this._eventCallbacks[conf.get('events:settings:attributesUpdate')] = (data) => this.onAttributeUpdate(data);
    this._eventCallbacks[conf.get('events:view:align')] = (data) => this.onAlign(data);
    this._eventCallbacks[conf.get('events:view:aligned')] = (data) => this.onAligned(data);

    this._margin = {top: 20, right: 20, bottom: 25, left: 30};
    this._initiated = false;

    this._dataAttr = {
      'attrMappings': {
        'axisY': null
      },
      'attr': {
        'maxY': null,
        'minY': null,
        'year': 2000
      },
      'filteredRegions': []
    };

    this._dataAttr.attrMappings['axisY'] = dataName[0];
    if (dataYear)
      this._dataAttr['attr']['year'] = dataYear;

    // --> TODO allow users to select the year (see issue #58)
    this.loadData();
    this.loadAttrMeta();
    this.loadObjMeta();
  }

  loadData(): void {
    utility.apiLoad((res) => this.processData(res), 'data/times', this._dataAttr.attr['year'].toString(), {'attributes': [this._dataAttr.attrMappings['axisY']]});
  }

  loadAttrMeta(): void {
    // loads a list of all data attributes from the server
    utility.apiLoad((res) => this.processDataAttributes(res), 'data/attributes', 'meta');
  }

  loadObjMeta(): void {
    // loads a list of all data attributes from the server
    utility.apiLoad((res) => this.processDataObjects(res), 'data/objects', 'meta');
  }

  processData(res: string): void {
    let parsedData: any = JSON.parse(res);
    this._data = [];

    for (let key in parsedData) {
      if (!parsedData.hasOwnProperty(key))
        continue;
      this._data.push([key, parsedData[key][this._dataAttr.attrMappings['axisY']]]);
    }

    let dataExtent: [number, number] = d3.extent(this._data, function (d) { return d[1]; });
    this._dataAttr.attr['minY'] = dataExtent[0]-Math.abs(dataExtent[0] * .2);
    this._dataAttr.attr['maxY'] = dataExtent[1] * 1.2;

    this._dataAll = this._data;

    if (this._initiated){
      this.updateFilter(this._filteredObjectIds);
      return;
    }

    if (this._data && this._attrMeta && this._objMeta)
      this.drawVis();
  }

  processDataAttributes(res: string): void {
    //TODO: Fix this reference
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

  initializeVis(): void {
    this._initiated = true;
    this.initializeChartArea();
    this.updateSize();
    this.updateChartArea();
    this.updateScales();
    this.initializeAxes();
    this.updateAxisLabels();

    this.updateVis();

    this._visClientController.registerView(this);
    window.addEventListener('resize', () => this.onWindowResize());
  }

  updateVis(): void {
    this.updateSize();
    this.updateChartArea();
    this.updateScales();
    this.updateAxes();
    this.updateBars();
  }

  initializeChartArea(): void {
    this._svg = d3.select(this._parent).append('svg')
      .attr('class', 'barChart');

    // creates and appends a rect node (background)
    this._visBackground = this._svg.append('rect')
      .attr('class', 'chart-area');
      // TODO: needed?
      //.attr('width', this._sizePlot.width)
      //.attr('height', this._sizePlot.height);

    // creates and appends a group container for the chart itself
    this._visNode = this._svg.append('g');
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

  updateChartArea(): void {

    // update svg container
    this._svg
      .attr('width', this._sizePlot.width + this._margin.left + this._margin.right)
      .attr('height', this._sizePlot.height + this._margin.top + this._margin.bottom);

    // update chart background
    this._visBackground
      .attr('width', this._sizePlot.width)
      .attr('height', this._sizePlot.height)
      .attr('transform', 'translate(' + this._margin.left + ', ' + this._margin.top + ')');

    // update chart container
    this._visNode
      .attr('transform', 'translate(' + this._margin.left + ', ' + this._margin.top + ')');
  }

  updateScales(): void {
    this._scaleX = d3.scale.ordinal()
      .domain(this._data.map(function (d) { return d[0]; }))
      .rangeBands([0, this._sizePlot.width], 0.25);
    this._scaleY = d3.scale.linear()
      .domain([this._dataAttr.attr['minY'], this._dataAttr.attr['maxY']])
      .range([this._sizePlot.height, 0]);

    // Defines axes of the bar chart
    this._axisX = d3.svg.axis()
      .orient('bottom')
      .scale(this._scaleX)
      .tickSize(-this._sizePlot.height, 0);
    this._axisXOverlay = d3.svg.axis()
      .orient('bottom')
      .scale(this._scaleX)
      .ticks(this._axisX.ticks())
      .tickSize(6, -this._sizePlot.height)
      .tickPadding(6);
    this._axisY = d3.svg.axis()
      .orient('left')
      .scale(this._scaleY)
      .ticks(10)
      .tickFormat('')
      .tickSize(-this._sizePlot.width, 0);
    this._axisYOverlay = d3.svg.axis()
      .orient('left')
      .scale(this._scaleY)
      .ticks(this._axisY.ticks())
      .tickFormat(d3.format(',d'))
      .tickSize(6, -this._sizePlot.width)
      .tickPadding(6);
  }

  initializeAxes(): void {
    this._visNode.append('g')
      .attr('class', 'axes');

    // creates and appends the x axis
    this._axisXViewGrid = this._visNode.append('g')
      .attr('class', 'x-axis-grid axis');
    this._axisXView = this._visNode.append('g')
      .attr('class', 'x-axis axis');
    this._axisXLabel = this._axisXView.append('text')
      .attr('id', 'x-axis-label')
      .attr('class', 'title')
      .style('text-anchor', 'end')
      .text('name x axis');

    // creates and appends the y axis
    this._axisYViewGrid = this._visNode.append('g')
      .attr('class', 'y-axis-grid axis');
    this._axisYView = this._visNode.append('g')
      .attr('class', 'y-axis axis');
    this._axisYLabel = this._axisYView.append('text')
      .attr('id', 'y-axis-label')
      .attr('class', 'title')
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'end')
      .text('name y axis');
  }

  updateAxes(): void {
    this._axisXViewGrid
      .attr('transform', 'translate(0, ' + this._sizePlot.height + ')')
      .call(this._axisX);
    this._axisXView
      .attr('transform', 'translate(0, ' + this._sizePlot.height + ')')
      .attr('class', () => {
        return this._scaleX.rangeBand() > 25 ? "x-axis axis labels" : "x-axis axis"
      })
      .call(this._axisXOverlay);
    this._axisXLabel
      .attr('x', this._sizePlot.width)
      .attr('dx', '-.4em')
      .attr('dy', '-.4em');

    // creates and appends the y axis
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

  updateAxisLabels(): void {
    if (!this._attrMeta || !this._axisXLabel)
      return;

    // Todo: Don't hard code
    this._axisXLabel.text('Country');

    if (this._axisYLabel && this._dataAttr.attrMappings['axisY'])
      this._axisYLabel.text(this._attrMeta[this._dataAttr.attrMappings['axisY']]['Name']);
  }

  updateBars(): void {
    this._visNode.selectAll('.bar')
      .data(this._data)
      .enter().append('rect')
      .attr('id', function(d: any[]) { return d[0]; })
      .attr('class', (d: any[]) => this.getClass(d));

    this._visNode.selectAll('.bar')
      .attr('x', (d: any[]) => {
        return this._scaleX(d[0]);
      })
      .attr('width', this._scaleX.rangeBand())
      .attr('y', (d: any[]) => {
        return this._scaleY(d[1]);
      })
      .attr('height', (d: any[]) => {
        return this._sizePlot.height - this._scaleY(d[1]);
      })
      .on('click', (d: any[]) => this.toggleSelection(d))
      .on('tap', (d: any[]) => this.toggleSelection(d));

    this._visNode.selectAll('.bar.selected')
      .each((d: any[]) => { this.showTooltip(d[0]); });
  }

  getClass(d: any[]): string {
    let id = d[0];
    let className = 'bar object';
    if (this._selectedObjectIds.has(id))
      className += ' selected';
    if (this._regions)
      className += ' group-' + this._regions.indexOf(this._objMeta[id].Region);
    return className;
  }

  emitCurrentState(): void {
    this.emitSelectionState();
  }

  toggleSelection (d: any[]): void {
    let obj: HTMLElement = document.getElementById(d[0]);
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
    let ids: string[] = [];
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
    let currentSelectedIds: string[] = Array.from(this._selectedObjectIds);
    let objects: HTMLElement[] = [];
    let object: HTMLElement;
    for (let i = 0; i < currentSelectedIds.length; i++) {
      if (selectedIds.indexOf(currentSelectedIds[i]) < 0)  {
        this._selectedObjectIds.delete(currentSelectedIds[i]);
        this.hideTooltip(currentSelectedIds[i]);
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
  }

  updateFilter(filteredObjectIds: string[]): void {
    // make the filter available for later
    this._filteredObjectIds = filteredObjectIds;
    // get data for available regions only
    let newData: string[] = this.filterRegions();
    newData = newData.filter(function(value) {
      return filteredObjectIds.indexOf(value[0]) < 0;
    });

    this._visNode.selectAll(".bar")
      .each((d) => { this.hideTooltip(d[0]); })
      .remove();
    this._data = newData;
    let dataExtent: [number, number] = d3.extent(this._data, function (d) { return d[1]; });
    this._dataAttr.attr['minY'] = dataExtent[0]-Math.abs(dataExtent[0] * .2);
    this._dataAttr.attr['maxY'] = dataExtent[1] * 1.2;
    this.updateVis();
  }

  filterRegions(): string[] {
    let that = this;
    // filteredRegions contains the index of _regions
    let data = this._dataAll.filter(function(value) {
      return that._dataAttr.filteredRegions.indexOf(that._regions.indexOf(that._objMeta[value[0]].Region)) < 0;
    });

    return data;
  }

  getObjects(): string[] {
    let objects: string[] = [];
    for (let i = 0; i < this._dataAll.length; i++) {
      objects.push(this._dataAll[i][0]);
    }
    return objects;
  }

  onAttributeUpdate(newDataAttr: {[id: string]: any}): void {
    this.updateDictionary(this._dataAttr, newDataAttr);

    if(newDataAttr.filteredRegions) {
      this.updateFilter(this._filteredObjectIds);
    } else {
      this.loadData();
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
      .offset([-9, 0])
      .html(this._objMeta[id].Name);
    this._svg.call(tip);
    tip.show(id, document.getElementById(id));
  }

  hideTooltip(id: string) {
    let tip: HTMLElement = document.getElementById('tip-' + id);
    if (tip) {
      tip.parentNode.removeChild(tip);
    }
  }

  updateTooltip(id: string) { }

  onWindowResize(): void {
    this.updateVis();
  }

  /**
   * Synchronizes the year of the vis with the year in the given data
   * @param data
   */
  onYearUpdate(data): void {
  	this._dataAttr.attr.year = data;
  	this.loadData();
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
    this.updateVis();
  }
}
