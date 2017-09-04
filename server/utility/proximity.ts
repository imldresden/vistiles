/**
 * Created by Tom Horak on 30.05.16.
 */

import * as conf from 'nconf';
import { Device } from '../models/device';

export interface CombinationMenu {
  deviceA?: CombinationMenuDevice;
  deviceB?: CombinationMenuDevice;
  visible?: boolean;
}

export interface CombinationMenuDevice {
  device?: Device,
  corners?: {},
  diagonals?: {},
  center?: {
    x?: number,
    y?: number
  },
  edges?: {},
  menuPos?: string
}

export class Proximity {
  deviceA:Device;
  deviceB:Device;
  changedCallback;
  updatedCallback;
  deviceACorners = null;
  deviceBCorners = null;
  movedDevice;
  lastPosA;
  lastPosB;
  distance: number;
  previousState: number;
  state: number;
  combinationMenu: CombinationMenu = {};

  constructor(deviceA:Device, deviceB:Device, changedCallback, updatedCallback) {
    //Todo: Determine which device was moved (more) by accessing position 1 second ago

    this.deviceA = deviceA;
    this.deviceB = deviceB;
    this.changedCallback = changedCallback;
    this.updatedCallback = updatedCallback;

    this.movedDevice = deviceB;
    this.lastPosA = deviceA.pos;
    this.lastPosB = deviceB.pos;
    this.distance = undefined;
    this.state = Proximity.state('mid');

    setInterval(() => this.validateProximity(), 500);
  }

  static getDeviceCorners(centerX:number, centerY:number, width:number, height:number, angle:number) {
    let result = Proximity.getDeviceCornersLocal(width, height, angle);

    result.topLeft.x += centerX;
    result.topLeft.y += centerY;

    result.topRight.x += centerX;
    result.topRight.y += centerY;

    result.bottomLeft.x += centerX;
    result.bottomLeft.y += centerY;

    result.bottomRight.x += centerX;
    result.bottomRight.y += centerY;

    return result;
  }

  static getDeviceCornersLocal(width:number, height:number, angle:number) {
    let result = {
      topLeft: null,
      topRight: null,
      bottomLeft: null,
      bottomRight: null
    };
    let halfWidth = width * .5;
    let halfHeight = height * .5;

    result.topLeft = {x: -halfWidth, y: -halfHeight};
    result.topLeft = Proximity.getRotatedPoint(result.topLeft.x, result.topLeft.y, angle);
    result.topRight = {x: halfWidth, y: -halfHeight};
    result.topRight = Proximity.getRotatedPoint(result.topRight.x, result.topRight.y, angle);
    result.bottomLeft = {x: -halfWidth, y: halfHeight};
    result.bottomLeft = Proximity.getRotatedPoint(result.bottomLeft.x, result.bottomLeft.y, angle);
    result.bottomRight = {x: halfWidth, y: halfHeight};
    result.bottomRight = Proximity.getRotatedPoint(result.bottomRight.x, result.bottomRight.y, angle);

    return result;
  }

  static getDistanceFromRectA2RectB(cornersA, cornersB):number {
    let result = Number.MAX_VALUE, tmpDistance;

    // calculate distances between all corners of B and the from A's corners:
    for (let key in cornersB) {
      if (!cornersB.hasOwnProperty(key))
        continue;

      // --> top-left to top-right
      //console.log(">> check top-left to top-right and point " + key);
      tmpDistance = Proximity.getDistancePoint2Line(
        cornersA.topLeft.x, cornersA.topLeft.y,
        cornersA.topRight.x, cornersA.topRight.y,
        cornersB[key].x, cornersB[key].y);
      if (result > tmpDistance)
        result = tmpDistance;

      // --> top-right to bottom-right
      //console.log(">> check top-right to bottom-right and point " + key);
      tmpDistance = Proximity.getDistancePoint2Line(
        cornersA.topRight.x, cornersA.topRight.y,
        cornersA.bottomRight.x, cornersA.bottomRight.y,
        cornersB[key].x, cornersB[key].y);
      if (result > tmpDistance)
        result = tmpDistance;

      // --> bottom-right to bottom-left
      //console.log(">> check bottom-right to bottom-left and point " + key);
      tmpDistance = Proximity.getDistancePoint2Line(
        cornersA.bottomRight.x, cornersA.bottomRight.y,
        cornersA.bottomLeft.x, cornersA.bottomLeft.y,
        cornersB[key].x, cornersB[key].y);
      if (result > tmpDistance)
        result = tmpDistance;

      // --> bottom-left to top-left
      //console.log(">> check bottom-left to top-left and point " + key);
      tmpDistance = Proximity.getDistancePoint2Line(
        cornersA.bottomLeft.x, cornersA.bottomLeft.y,
        cornersA.topLeft.x, cornersA.topLeft.y,
        cornersB[key].x, cornersB[key].y);
      if (result > tmpDistance)
        result = tmpDistance;
    }

    // return the result
    return result;
  }

  static getDistancePoint2Point(x1:number, y1:number, x2:number, y2:number):number {
    let dx = x2 - x1,
      dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static getDistancePoint2Line(lineX1:number, lineY1:number, lineX2:number, lineY2:number,
                               pointX:number, pointY:number):number {
    // the line's direction vector:  from one point to the other one
    let lineVec = {x: lineX2 - lineX1, y: lineY2 - lineY1};
    // the direction vector that is perpendicular to the line's direction
    let lineVecPerp = {x: lineVec.y, y: -lineVec.x};

    // calculate the intersection of the to lines
    // - line 1: given by the function parameters
    // - line 2: defined by the given point and the perpendicular line vector
    let intersection = this.getLineIntersection(
      lineX1, lineY1, lineX2, lineY2,
      pointX, pointY, pointX + lineVecPerp.x, pointY + lineVecPerp.y);

    // return null if the lines do not intersect
    // !! this should never happen
    if (intersection.x == null || intersection.y == null) {
      console.error("getDistancePoint2Line(): Oops, no intersection found!");
      return null;
    }

    // if the point of intersection is on line given by the function parameters,
    // return the distance between the given point and this intersection point
    if (intersection.onLine1 == true)
      return Proximity.getDistancePoint2Point(pointX, pointY, intersection.x, intersection.y);

    // if the point of intersection is outside of the given line, we need to
    // determine the distances between all three points given by the function
    // parameters and return the smallest distance
    let d1 = Proximity.getDistancePoint2Point(pointX, pointY, lineX1, lineY1),
      d2 = Proximity.getDistancePoint2Point(pointX, pointY, lineX2, lineY2);
    return Math.min(d1, d2);
  }

  static getDistanceRect2Rect(cornersA, cornersB):number {
    return Math.min(
      Proximity.getDistanceFromRectA2RectB(cornersA, cornersB),
      Proximity.getDistanceFromRectA2RectB(cornersB, cornersA));
  }

  // code adapted from: http://jsfiddle.net/justin_c_rounds/Gd2S2/
  static getLineIntersection(line1StartX: number, line1StartY: number, line1EndX: number,
                             line1EndY: number, line2StartX: number, line2StartY: number,
                             line2EndX: number, line2EndY: number) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    let denominator, a, b, numerator1, numerator2, result = {
      x: null,
      y: null,
      onLine1: false,
      onLine2: false
    };
    denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
    if (denominator == 0) {
      return result;
    }
    a = line1StartY - line2StartY;
    b = line1StartX - line2StartX;
    numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
    numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
    a = numerator1 / denominator;
    b = numerator2 / denominator;

    // if we cast these lines infinitely in both directions, they intersect here:
    result.x = line1StartX + (a * (line1EndX - line1StartX));
    result.y = line1StartY + (a * (line1EndY - line1StartY));

    // if line1 is a segment and line2 is infinite, they intersect if:
    if (a > 0 && a < 1) {
      result.onLine1 = true;
    }
    // if line2 is a segment and line1 is infinite, they intersect if:
    if (b > 0 && b < 1) {
      result.onLine2 = true;
    }
    // if line1 and line2 are segments, they intersect if both of the above are true
    return result;
  }

  static getRotatedPoint(x: number = 0, y: number = 0, angle: number = 0, pivotX: number = 0,
                         pivotY: number = 0) {
    let rad = (Math.PI / 180) * angle,
      cos = Math.cos(rad),
      sin = Math.sin(rad),
      newX = (cos * (x - pivotX)) - (sin * (y - pivotY)) + pivotX,
      newY = (sin * (x - pivotX)) + (cos * (y - pivotY)) + pivotY;

    return {x: newX, y: newY};
  }

  static state(name: string): number {
    return conf.get('app:proximity:states:' + name);
  }

  static threshold(state: string, side: string): number{
    return conf.get('app:proximity:thresholds:' + state + ':' + side);
  }

  validateProximity(): void {
    let rotA = this.deviceA.rotation;
    this.deviceACorners = this.deviceA.calculateCornersInGlobal();
    let rotB = this.deviceB.rotation;
    this.deviceBCorners = this.deviceB.calculateCornersInGlobal();

    let distance = Proximity.getDistanceRect2Rect(this.deviceACorners, this.deviceBCorners);
    let newState = this.state;

    switch (this.state) {
      case Proximity.state('near'):
        if (distance > Proximity.threshold('near', 'upper')) {
          newState = Proximity.state('mid');
        }
        break;
      case Proximity.state('mid'):
        if (distance < Proximity.threshold('near', 'lower'))
          newState = Proximity.state('near');
        break;
    }

    let proximityChanged = this.state != newState;

    //simple movedDevice implementation
    let distA = Proximity.getDistancePoint2Point(this.lastPosA[0], this.lastPosA[1], this.deviceA.pos[0], this.deviceA.pos[1]);
    let distB = Proximity.getDistancePoint2Point(this.lastPosB[0], this.lastPosB[1], this.deviceB.pos[0], this.deviceB.pos[1]);
    if (distA > distB) {
      this.movedDevice = this.deviceA;
    } else if (distB > distA) {
      this.movedDevice = this.deviceB;
    }
    this.lastPosA = this.deviceA.pos;
    this.lastPosB = this.deviceB.pos;

    this.previousState = this.state;
    this.state = newState;
    this.distance = distance;

    this.updatedCallback(this);

    if (proximityChanged) {
      Proximity.checkCombinationMenu(this);
      this.changedCallback(this);
    }
  }

  static determineDeviceDiagonals(corners) {
    return {
      d1: {
        x1: corners.topLeft.x, x2: corners.bottomRight.x,
        y1: corners.topLeft.y, y2: corners.bottomRight.y
      },
      d2: {
        x1: corners.topRight.x, x2: corners.bottomLeft.x,
        y1: corners.topRight.y, y2: corners.bottomLeft.y
      }
    };
  }

  static determineDeviceCenter(diagonals){
    return Proximity.getLineIntersection(
      diagonals.d1.x1, diagonals.d1.y1, diagonals.d1.x2, diagonals.d1.y2,
      diagonals.d2.x1, diagonals.d2.y1, diagonals.d2.x2, diagonals.d2.y2
    );
  }

  static determineDeviceEdges(corners){
    return {
      top: {
        x1: corners.topLeft.x, x2: corners.topRight.x,
        y1: corners.topLeft.y, y2: corners.topRight.y
      },
      right: {
        x1: corners.topRight.x, x2: corners.bottomRight.x,
        y1: corners.topRight.y, y2: corners.bottomRight.y
      },
      bottom: {
        x1: corners.bottomRight.x, x2: corners.bottomLeft.x,
        y1: corners.bottomRight.y, y2: corners.bottomLeft.y
      },
      left: {
        x1: corners.bottomLeft.x, x2: corners.topLeft.x,
        y1: corners.bottomLeft.y, y2: corners.topLeft.y
      }
    };
  }

  static determineDeviceCenterlineIntersection(device, line){
    for (let key in device.edges) {
      let edge = device.edges[key];
      edge.result = Proximity.getLineIntersection(
        edge.x1, edge.y1, edge.x2, edge.y2,
        line.x1, line.y1, line.x2, line.y2
      );
      if (edge.result.onLine1 && edge.result.onLine2) {
        device.menuPos = key;
      }
    }
  }

  static checkCombinationMenu(proximity: Proximity): void {
    let cb = proximity.combinationMenu;
    cb.deviceA = {};
    cb.deviceB = {};
    cb.visible = false;

    if (proximity.state == conf.get('app:proximity:states:near')){
      cb.visible = true;

      cb.deviceA.device = proximity.deviceA;
      cb.deviceB.device = proximity.deviceB;

      cb.deviceA.corners = proximity.deviceACorners;
      cb.deviceB.corners = proximity.deviceBCorners;

      cb.deviceA.diagonals = Proximity.determineDeviceDiagonals(cb.deviceA.corners);
      cb.deviceB.diagonals = Proximity.determineDeviceDiagonals(cb.deviceB.corners);

      cb.deviceA.center = Proximity.determineDeviceCenter(cb.deviceA.diagonals);
      cb.deviceB.center = Proximity.determineDeviceCenter(cb.deviceB.diagonals);

      cb.deviceA.edges = Proximity.determineDeviceEdges(cb.deviceA.corners);
      cb.deviceB.edges = Proximity.determineDeviceEdges(cb.deviceB.corners);

      let centerLine = {
        x1: cb.deviceA.center.x, x2: cb.deviceB.center.x,
        y1: cb.deviceA.center.y, y2: cb.deviceB.center.y,
      };

      Proximity.determineDeviceCenterlineIntersection(cb.deviceA, centerLine);
      Proximity.determineDeviceCenterlineIntersection(cb.deviceB, centerLine);
    }
  }
}

export default Proximity;