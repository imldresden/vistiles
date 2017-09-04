
import * as d3 from 'd3';

export class DebugProximityView {
  // general variables
  private _initialized = false;
  private _tableSize = {width: 0, height: 0};
  private _viewSize = {width: 0, height: 0};
  private _scale = {x: 1, y: 1};
  // DOM nodes
  private _proximityContainer = null;
  private _proximityView = null;

  // proximity data
  private proxies = null;

  constructor(data, socket) {
    // connect the proximity view with events "proximityUpdated"
    socket.on('proximityUpdated', (d) => this.onProximityUpdated(d));

    // save the size of the table
    this._tableSize.width = data.table.width;
    this._tableSize.height = data.table.height;

    // get the proximity container (dom node)
    this._proximityContainer = d3.select('#proximity-container');

    // calculate the view size
    this._viewSize.width = this._proximityContainer.node().getBoundingClientRect().width;
    this._viewSize.height = (this._tableSize.height / this._tableSize.width) * this._viewSize.width;

    // calculate the scales
    this._scale.x = this._viewSize.width / (this._tableSize.width/100);
    this._scale.y = this._viewSize.height / (this._tableSize.height/100);

    // create a new proximtity view (svg node)
    this._proximityView = this._proximityContainer.append('svg:svg')
      .attr('id', 'proximity-view')
      .attr('width', this._viewSize.width)
      .attr('height', this._viewSize.height);

    this._proximityView.append('rect')
      .attr('class', 'bg')
      .attr('width', this._viewSize.width)
      .attr('height', this._viewSize.height);

    // this view has been initialized successfully
    this._initialized = true;
  }

  updateDevice (id, corners) {
    var g = d3.select('#proxy-'+id);
    if (g.empty()) {
      g = this._proximityView.append('g')
        .attr('id', 'proxy-'+id);
      g.append('circle')
        .attr('class', 'top-left corner');
      g.append('circle')
        .attr('class', 'top-right corner');
      g.append('circle')
        .attr('class', 'bottom-left corner');
      g.append('circle')
        .attr('class', 'bottom-right corner');
      g.selectAll('.corner')
        .attr('r', 6);
    }
    g.select('.top-left')
      .attr('cx', corners.topLeft.x * this._scale.x)
      .attr('cy', this._viewSize.height - corners.topLeft.y * this._scale.y);
    g.select('.top-right')
      .attr('cx', corners.topRight.x * this._scale.x)
      .attr('cy', this._viewSize.height - corners.topRight.y * this._scale.y);
    g.select('.bottom-left')
      .attr('cx', corners.bottomLeft.x * this._scale.x)
      .attr('cy', this._viewSize.height - corners.bottomLeft.y * this._scale.y);
    g.select('.bottom-right')
      .attr('cx', corners.bottomRight.x * this._scale.x)
      .attr('cy', this._viewSize.height - corners.bottomRight.y * this._scale.y);
  }

  onProximityUpdated(proximity) {
    this.updateDevice(proximity.deviceA.id, proximity.deviceACorners);
    this.updateDevice(proximity.deviceB.id, proximity.deviceBCorners);
  }
}