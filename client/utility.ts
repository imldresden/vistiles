export function hideLoadingSpinner(): void {
  document.getElementById('loading-overlay').style.display = 'none';
}

export function showOverlay(title: string, message?: string, attr?: any): void{
  document.getElementById('loading-title').innerHTML = title;
  document.getElementById('loading-info').innerHTML = message;

  let spinner = <HTMLElement>document.getElementById('loading-overlay').getElementsByClassName('preloader-wrapper')[0];

  if (attr && attr.iconCode) {
    document.getElementById('loading-icon').innerHTML = attr.iconCode;
    document.getElementById('loading-icon').style.display = "";
    if (attr.iconClass)
      document.getElementById('loading-icon').className = "material-icons large " + attr.iconClass;
    spinner.style.display = "none";
  } else {
    document.getElementById('loading-icon').style.display = "none";
    spinner.style.display = "";
  }

  if (attr && attr.buttonText) {
    document.getElementById('loading-button').innerHTML = attr.buttonText;
    document.getElementById('loading-button').style.display = "";
  } else
    document.getElementById('loading-button').style.display = "none";


  document.getElementById('loading-overlay').style.display = 'flex';
}

export function showLoadingSpinner(info: string): void {
  showOverlay('Loading...', info);
}

export function playLinkedIndicator(colorClass: string, colorIntensity: string): void {
  document.getElementById('proximity-indicator').classList.add(colorClass);
  document.getElementById('proximity-indicator').classList.add(colorIntensity);
  document.getElementById('proximity-indicator').classList.add('blink');
  document.getElementById('proximity-indicator').style.display = '';
  if (window.navigator.vibrate)
    window.navigator.vibrate(200);

  setTimeout(hideProximityIndicator, 1500);

  function hideProximityIndicator() {
    document.getElementById('proximity-indicator').style.display = 'none';
    document.getElementById('proximity-indicator').classList.remove('blink');
    document.getElementById('proximity-indicator').classList.remove(colorClass);
    document.getElementById('proximity-indicator').classList.remove(colorIntensity);
  }
}

export function displayToast(message: string, type?: string, callback?): void {
  if (callback)
    Materialize.toast(message, 4000, type, callback);
  Materialize.toast(message, 4000, type);
}

export function apiLoad(
  callback: (res: string) => any, api: string, resource?: string, parameters?: Object): void {
  let url = '/' + api;
  if (resource)
    url += '/' + resource;
  if (parameters) {
    url += '?';
    for (let parameter in parameters) {
      url += parameter + '=' + encodeURIComponent(JSON.stringify(parameters[parameter]));
      url += '&';
    }
    url = url.slice(0, -1);
  }

  let xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState == 4)
      callback(xmlHttp.responseText);
  };
  xmlHttp.open('GET', url, true);
  xmlHttp.send(null);
}

export function isFullScreen(): boolean {
  return (document.fullscreenElement !== undefined ||
    document.webkitFullscreenElement !== undefined);
    //document.mozFullScreenElement);
}

export function launchFullScreen(element?: any): void {
  if (!element)
    element = document.documentElement;

  if (element.requestFullScreen) {
    element.requestFullScreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullScreen) {
    element.webkitRequestFullScreen();
  }
}

/**
 * via http://jsfiddle.net/prantlf/L77L9/
 */
export function strFormat(...strings: string[]) {
  var pattern = /\{\{|\}\}|\{(\d+)\}/g;
  var parameters = strings;
  return parameters[0].replace(pattern, function (match, group) {
    var value;
    if (match === "{{")
      return "{";
    if (match === "}}")
      return "}";
    value = parameters[parseInt(group, 10) + 1];
    return value ? value.toString() : "";
  });
}

export interface IDataYear {
  name: string;
}

export interface IDataYears {
  [id: number]: IDataYear;
}

export interface IDataAttribute {
  name: string;
  definition: string;
}

export interface IDataAttributes {
  [id: string]: IDataAttribute;
}
