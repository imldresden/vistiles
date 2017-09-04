import * as utility from "../../utility";

export class DeviceMap {
  private _socket;
  private _deviceList = {};
  private _virtualRigidBodies = {};

  //variables used to normalize values to browser space
  private _minX;
  private _maxX;
  private _minY;
  private _maxY;
  private _scale;

  //variables to remember anonymous functions for eventlisteners
  private _dragMouseMoveEvent;
  private _dragMouseUpEvent;
  private _rotateMouseMoveEvent;
  private _rotateMouseUpEvent;

  //id for current drag and rotate operations on virtual devices
  private _draggedId = "";

  constructor(data, debugSocket) {
    this.drawDeviceArea(data);
    if (data.devices)
      this.drawDevices(data.devices);

    this._socket = debugSocket;
    this._socket.on('devicePosChanged', (data) => this.updateDevicePos(data));
    this._socket.on('deviceAdded', (device) => this.onDeviceAdded(device));
  }

  //used to scale incoming positions on a finite div
  normalizePos(posObj) {
    posObj[0] = (posObj[0] - this._minX) / (this._maxX - this._minX);
    posObj[2] = (posObj[2] - this._minY) / (this._maxY - this._minY);
  }

  //used to revert normalization to send matching positions to the server
  deNormalizePos(posObj) {
    posObj[0] = this._minX + (posObj[0] * (this._maxX - this._minX));
    posObj[2] = -(this._minY + (posObj[2] * (this._maxY - this._minY)));
  }

  //draws the initial device area and sets variables needed to normalize positions on the area
  drawDeviceArea(data) {
    let deviceArea = document.getElementById('deviceArea');
    let maxWidth = window.innerWidth - 420;
    let maxHeight = window.innerHeight - 150;
    this._scale = maxWidth / data.table.width;
    if (data.table.height * this._scale > maxHeight)
      this._scale = maxHeight / data.table.height;
    deviceArea.style.width = data.table.width * this._scale + 'px';
    deviceArea.style.height = data.table.height * this._scale + 'px';

    let deviceAreaWrap = document.getElementById('deviceAreaWrap');
    let boundingRect = deviceAreaWrap.getBoundingClientRect();

    let widthScale = boundingRect.width / data.table.width;
    let heightScale = (window.innerHeight - boundingRect.top) / data.table.height;

    this._minX = data.valueRange.minX;
    this._maxX = data.valueRange.maxX;

    this._minY = data.valueRange.minY;
    this._maxY = data.valueRange.maxY;

    deviceArea.style.transform = ('scale3d(1, -1, 1)');
  }

  //initially iterates over all devices and calls drawDevice for each
  drawDevices(devices) {
    for (let deviceId in devices) {
      if (devices[deviceId])
        this.drawDevice(devices[deviceId]);
    }
  }

  drawDevice(device) {
    this._deviceList[device.id] = device;

    let width = device.size.width * this._scale;
    let height = device.size.height * this._scale;

    let parameters = {
      device: device,
      width: width,
      height: height
    };
    utility.apiLoad(
      (res) => this.displayDevice(res), 'modules', 'device-div', parameters
    );
  }

  displayDevice(content) {
    let deviceArea = document.getElementById('deviceArea');

    // Workaround since `deviceArea.innerHTML += content` would kill existing event listener
    // see http://stackoverflow.com/a/25046766
    let tmpNode = document.createElement('div');
    tmpNode.innerHTML = content;
    let deviceNode = tmpNode.firstElementChild;
    deviceArea.appendChild(deviceNode);

    let deviceId = deviceNode.id.replace('device-', '');
    deviceNode.setAttribute('device-id', deviceId);
    if (deviceNode.getElementsByClassName('virtual')) {
      deviceNode.addEventListener('mousedown', (e) => this.startDeviceDrag(e));

      let deviceRotateDiv = document.getElementById('handler-' + deviceId);
      deviceRotateDiv.addEventListener('mousedown', (e) => this.startDeviceRotate(e));
      deviceRotateDiv.setAttribute('device-id', deviceId);
    }
  }

  startDeviceDrag(e) {
    e.stopPropagation();
    this._draggedId = e.target.getAttribute('device-id');
    if (this._draggedId === null)
      this._draggedId = e.target.parentNode.getAttribute('device-id');

    // required to remove same event later (endDeviceDrag)
    this._dragMouseMoveEvent = (e) => this.deviceDragMove(e);
    this._dragMouseUpEvent = (e) => this.endDeviceDrag(e);

    document.addEventListener('mousemove', this._dragMouseMoveEvent);
    document.addEventListener('mouseup', this._dragMouseUpEvent);
  }

  startDeviceRotate(e) {
    e.stopPropagation();
    this._draggedId = e.target.getAttribute('device-id');
    if (this._draggedId === null)
      this._draggedId = e.target.parentNode.getAttribute('device-id');

    //required to remove same event later (endDeviceRotate)
    this._rotateMouseMoveEvent = (e) => this.deviceRotateMove(e);
    this._rotateMouseUpEvent = (e) => this.endDeviceRotate(e);

    document.addEventListener('mousemove', this._rotateMouseMoveEvent);
    document.addEventListener('mouseup', this._rotateMouseUpEvent);
  }

  deviceDragMove(e) {
    let deviceArea = document.getElementById('deviceArea');
    let boundingRect = deviceArea.getBoundingClientRect();
    if (this._draggedId in this._deviceList) {
      let posObj = this._virtualRigidBodies[this._deviceList[this._draggedId].rb.id].pos;
      posObj[0] = posObj[0] + (e.movementX / boundingRect.width);
      posObj[2] = posObj[2] - (e.movementY / boundingRect.height);
      let normalizedPos = posObj.slice(0);
      this.deNormalizePos(normalizedPos);

      let current_rb = this._virtualRigidBodies[this._deviceList[this._draggedId].rb.id];
      current_rb.pos = posObj;

      this._socket.emit('virtualRigidBodyMoved', {
        id: this._deviceList[this._draggedId].rb.id,
        pos: normalizedPos,
        orientation: current_rb.orientation
      });
    }
  }

  //computes the current angle to the divs center in radians and translates them into orientation values of rigidbodies
  deviceRotateMove(e) {
    e.preventDefault();
    if (this._draggedId in this._deviceList) {
      let orientationObj = this._deviceList[this._draggedId].rb.orientation.slice(0);
      let posObj = this._virtualRigidBodies[this._deviceList[this._draggedId].rb.id].pos;

      let deviceDiv = document.getElementById('device-' + this._draggedId);
      let boundingRect = deviceDiv.getBoundingClientRect();
      let center = [boundingRect.left + boundingRect.width / 2, boundingRect.top + boundingRect.height / 2];

      let radians = Math.atan2(e.pageX - center[0], e.pageY - center[1]) + Math.PI;
      orientationObj[1] = Math.cos(radians / 2);
      orientationObj[3] = -Math.sin(radians / 2);

      let normalizedPos = posObj.slice(0);
      this.deNormalizePos(normalizedPos);

      this._virtualRigidBodies[this._deviceList[this._draggedId].rb.id].orientation = orientationObj;
      this._socket.emit('virtualRigidBodyMoved', {
        id: this._deviceList[this._draggedId].rb.id,
        pos: normalizedPos,
        orientation: orientationObj
      });
    }
  }

  endDeviceDrag(e) {
    this._draggedId = '';
    document.removeEventListener('mousemove', this._dragMouseMoveEvent);
    document.removeEventListener('mouseup', this._dragMouseUpEvent);
  }

  endDeviceRotate(e) {
    this._draggedId = '';
    document.removeEventListener('mousemove', this._rotateMouseMoveEvent);
    document.removeEventListener('mouseup', this._rotateMouseUpEvent);
  }

  //sizes and positions device divs by applying several transformations
  updateDevicePos(data) {
    let device = data.device;
    let deviceArea = document.getElementById('deviceArea');
    let deviceDiv = document.getElementById('device-' + device.id);

    if (deviceDiv === null)
      return false;

    let boundingRect = deviceArea.getBoundingClientRect();
    let deviceWidth = device.size.width;
    let deviceHeight = device.size.height;

    // device rotation matrix: according to orientation data
    let deviceRotation = DeviceMap.quaternionToEuler(device.rb.orientation)[0];
    let cos = Math.cos(deviceRotation),
        sin = Math.sin(deviceRotation);
    let rotationMatrix = [
      [cos, -sin, 0],
      [sin, cos, 0],
      [0, 0, 1]
    ];

    // device translation matrix: according to the pos data and mapped to the div size
    this.normalizePos(device.rb.pos);
    let deviceTranslationMatrix = [
      [1, 0, (device.rb.pos[0] * boundingRect.width) - (deviceWidth / 2)],
      [0, 1, (device.rb.pos[2] * boundingRect.height) - (deviceHeight / 2)],
      [0, 0, 1]
    ];

    //rotation need to be applied twice because the orientation values represent half the rotation
    //let deviceTransformMatrix = multiplyMatrices(positionTranslationMatrix, multiplyMatrices(deviceTranslationMatrix, multiplyMatrices(rotationMatrix, rotationMatrix)));
    let deviceTransformMatrix = DeviceMap.multiplyMatrices(deviceTranslationMatrix, rotationMatrix);

    deviceDiv.style.transform = 'matrix(' +
      deviceTransformMatrix[0][0] + ', ' + deviceTransformMatrix[1][0] + ', ' +
      deviceTransformMatrix[0][1] + ', ' + deviceTransformMatrix[1][1] + ', ' +
      deviceTransformMatrix[0][2] + ', ' + deviceTransformMatrix[1][2] + ')';
    deviceDiv.style.transformOrigin = '(' + 0 + ' ' + 0 + ')';
  }

  static multiplyMatrices(m1, m2) {
    let result = [];
    for (let i = 0; i < m1.length; i++) {
      result[i] = [];
      for (let j = 0; j < m2[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < m1[0].length; k++) {
          sum += m1[i][k] * m2[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  static quaternionToEuler(quaternion) {
    let w = quaternion[3];
    let x = quaternion[0];
    let y = quaternion[1];
    let z = quaternion[2];

    let sqx = x * x;
    let sqy = y * y;
    let sqz = z * z;

    let rotX = Math.atan2(2 * (y * w - x * z), 1 - 2 * (sqy + sqz));
    let rotY = Math.asin(2 * ( x * y + z * w));
    let rotZ = Math.atan2(2 * x * w - 2 * y * z, 1 - 2 * (sqx + sqz));

    return [rotX, rotY, rotZ];
  }

  onDeviceAdded(device) {
    if (device.type == 'virtual')
      this._virtualRigidBodies[device.rb.id] = device.rb;
    this.drawDevice(device);
  }
//TODO: handle removed/disconnected devices, dont forget removing event listeners on virtual devices

}