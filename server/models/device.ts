import * as math from "./../utility/math";
import {getNextDeviceColor} from "./colorManager";

export class Device {
  id: string;
  name: string;
  size: any;
  dpi: number;
  displayBorders: any;
  type: string;
  rb: any;
  socketId: string;
  color: string[] = getNextDeviceColor();
  workspaceId: string;
  subGroupId: string;
  view: string;
  pairedDeviceLocation: string;
  viewPortSize: any;
  dataAttr: {[key: string]: any};
  objects: string[] = [];
  filteredObjects: string[] = [];
  combinations = {};

  get pos(): number[] { return this.rb.pos; }
  get pos2D(): any { return {x: this.pos[0], y: this.pos[2]}; }
  get orientation(): number[] { return this.rb.orientation; }
  get rotation(): number { return math.quaternionToEuler(this.orientation)[0]; }

  constructor (id, name, size, dpi, displayBorders, type, rb, socketId) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.dpi = dpi;
    this.displayBorders = displayBorders;
    this.type = type;
    this.rb = rb;
    this.socketId = socketId;
  }

  calculateCornersInLocal() {
    // get half width and height in m (converted from cm)
    let hWidth = (this.size.width / 100) * .5,
      hHeight = (this.size.height / 100) * .5;

    return {
      topLeft: {x: -hWidth, y: hHeight},
      topRight: {x: hWidth, y: hHeight},
      bottomLeft: {x: -hWidth, y: -hHeight},
      bottomRight: {x: hWidth, y: -hHeight}
    };
  }

  calculateCornersInGlobal() {
    // get corners in local coordinate system
    let corners = this.calculateCornersInLocal();

    // some variables needed for the transformation
    let deviceRotation = this.rotation,
      devicePos = this.pos2D;
    let cos = Math.cos(deviceRotation),
      sin = Math.sin(deviceRotation);
    let transformMatrix = [
      [cos, -sin, devicePos.x],
      [sin, cos,  devicePos.y],
      [0,   0,    1]
    ];

    // apply local to global transformation to each corner
    for (var key in corners) {
      if (!corners.hasOwnProperty(key))
        continue;

      let cornerMatrix = [[corners[key].x], [corners[key].y], [1]];
      let resultMatrix = math.multiplyMatrices(transformMatrix, cornerMatrix);

      corners[key].x = resultMatrix[0][0];
      corners[key].y = resultMatrix[1][0];
    }

    return corners;
  }
}

export default Device;