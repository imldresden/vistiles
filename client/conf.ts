/**
 * Created by blu on 31.03.16.
 */

import * as utility from "./utility";

let confValues: Object = {};

export function loaded(): boolean { return Object.keys(confValues).length > 0; }

export function init(callbackMethod) {
  let callback = callbackMethod;
  utility.apiLoad(parseValues, 'conf');

  function parseValues(response: string) {
    confValues = JSON.parse(response);
    callback();
  }
}

export function get(key: string): any {
  let keyArray = key.split(':');

  let value = confValues[keyArray[0]];
  keyArray.splice(0, 1);
  for (let i = 0; i < keyArray.length; i++) {
    value = value[keyArray[i]];
  }
  return value;
}