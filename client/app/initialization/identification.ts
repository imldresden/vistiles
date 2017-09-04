//module managing the storage of userids and device information in local storage

let storage = window.localStorage['desktop'] == 'true' ? window.sessionStorage : window.localStorage;

export function setDevice(deviceData) {
  if (!(deviceData.id))
    deviceData.id = generateId();
  storage['deviceData'] = JSON.stringify(deviceData);
}

export function getDevice() {
  if (storage['deviceData']) {
    return JSON.parse(storage['deviceData']);
  }
  return false
}

export function generateId() {
  // GUID-like random number; taken from http://stackoverflow.com/a/105074
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

