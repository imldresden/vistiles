import * as conf from 'nconf';

/**
 * Checks if the visualizations can be aligned.
 * True if:
 *    * both devices have visualizations with an axis
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function visualizationAlignment(deviceA, deviceB) {
  return bothDevicesWithCharacteristic("hasAxis", deviceA, deviceB);
}

/**
 * Checks if a bar chart display extension can be applied.
 * True if:
 *    * one device has a bar chart, the other no view
 *    * both devices has bar charts with same y-axis, year and filter state
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function barChartDisplayExtension(deviceA, deviceB) {
  if (oneDeviceWithView(undefined, deviceA, deviceB) && oneDeviceWithView('barChart', deviceA, deviceB)) {
    return true;
  }

  if (bothDevicesWithView('barChart', deviceA, deviceB)) {
    let sameAxis = deviceA.dataAttr.attrMappings.axisY == deviceB.dataAttr.attrMappings.axisY;
    let sameYear = deviceA.dataAttr.year == deviceB.dataAttr.year;
    let sameFilteredObjects = arraysWithSameValues(deviceA.filteredObjects, deviceB.filteredObjects);
    let noneFilteredObjects = deviceA.filteredObjects.length == 0;

    if (sameAxis && sameYear && sameFilteredObjects && noneFilteredObjects) {
      return true;
    }
  }

  return false;
}

function cloneViewCombination(deviceA, deviceB){
  if (oneDeviceWithView(undefined, deviceA, deviceB) && oneDeviceWithType(1, deviceA, deviceB)) {
    return true;
  }
}

/**
 * Checks if a scatter plot + table/bar/line chart/steamgraph/parallel coordinates combination can be applied.
 * True if:
 *    * one device has a bar chart, scatterplot or table, the other a scatter plot
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function scatterPlotChartCombination(deviceA, deviceB) {
  let scatterplot = oneDeviceWithView('scatterplot', deviceA, deviceB);
  let chart = oneDeviceWithView('barChart', deviceA, deviceB)
    || oneDeviceWithView('lineChart', deviceA, deviceB)
    || oneDeviceWithView('parallelCoordinates', deviceA, deviceB)
    || oneDeviceWithView('streamgraph', deviceA, deviceB);
  return scatterplot && chart;
}

/**
 * Checks if a line chart + bar chart combination can be applied.
 * True if:
 *    * one device has a line chart, the other a bar chart
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */

function lineChartBarChartCombination(deviceA, deviceB) {
  let linechart = oneDeviceWithView('lineChart', deviceA, deviceB);
  let barchart = oneDeviceWithView('barChart', deviceA, deviceB);
  return linechart && barchart;
}

/**
 * Checks if a line chart + streamgraph combination can be applied.
 * True if:
 *    * one device has a line chart, the other a streamgraph
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */

function lineChartStreamgraphCombination(deviceA, deviceB) {
  let linechart = oneDeviceWithView('lineChart', deviceA, deviceB);
  let streamgraph = oneDeviceWithView('streamgraph', deviceA, deviceB);
  return linechart && streamgraph;
}

/**

 * Checks if a table + scatterplot/bar/line chart combination can be applied.
 * True if:
 *    * one device has a table, the other a scatter plot or bar chart or line chart
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function tableChartCombination(deviceA, deviceB) {
  let table = oneDeviceWithView('table', deviceA, deviceB);
  let chart = oneDeviceWithView('scatterplot', deviceA, deviceB) ||
    oneDeviceWithView('lineChart', deviceA, deviceB) ||
    oneDeviceWithView('streamgraph', deviceA, deviceB);
  return table && chart;
}
/*
 * Checks if a parallel coordinates and bar chart combination is possible
 *    * one device has a parallel coordinate plot, the other a bar chart
 * @param deviceA
 * @param deviceB
 * @returns {boolean}
 */
function parallelCoordinatesChartCombination(deviceA, deviceB) {
	let parallelCoordinates = oneDeviceWithView('parallelCoordinates', deviceA, deviceB);
	let chart = oneDeviceWithView('barChart', deviceA, deviceB) || oneDeviceWithView('lineChart', deviceA, deviceB);
							//|| oneDeviceWithView('scatterplot', deviceA, deviceB);
	return parallelCoordinates && chart;
}

/**
 * Checks if a parallel coordinates and streamgraph combination is possible
 *    * one device has a parallel coordinate plot, the other a streamgraph
 * @param deviceA
 * @param deviceB
 * @returns {boolean}
 */
function parallelCoordinatesStreamgraphCombination(deviceA, deviceB) {
	let parallelCoordinates = oneDeviceWithView('parallelCoordinates', deviceA, deviceB);
	let streamgraph = oneDeviceWithView('streamgraph', deviceA, deviceB);
	return parallelCoordinates && streamgraph;
}

/**
 * Checks if a streamgraph bar chart combination is possible
 *    * one device has a streamgraph, the other a bar chart
 * @param deviceA
 * @param deviceB
 * @returns {boolean}
 */
function streamgraphBarChartCombination(deviceA, deviceB) {
	let streamgraph = oneDeviceWithView('streamgraph', deviceA, deviceB);
	let barchart = oneDeviceWithView('barChart', deviceA, deviceB);
	return streamgraph && barchart;
}

/**
 * Checks if a setting menu + vis combination can be applied.
 * True if:
 *    * one device has a settings menu, the other a visualization
 *
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function settingsMenuForVis(deviceA, deviceB) {
  return oneDeviceWithType(1, deviceA, deviceB) && (oneDeviceWithType(2, deviceA, deviceB) || oneDeviceWithView(undefined, deviceA, deviceB))
}

/**
 * Checks if arrayA and arrayB contains the same values. Works only for simple arrays
 * containing primitive objects.
 * @param arrayA  Array to compare.
 * @param arrayB  Array to compare.
 * @returns {boolean} True if arrays contains same values, else false.
 */
function arraysWithSameValues(arrayA, arrayB) {
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

/**
 * Checks if exactly one device has a specific view
 * @param view        The view as string
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function oneDeviceWithView(view, deviceA, deviceB) {
  return ((deviceA.view == view && !(deviceB.view == view)) ||
  (!(deviceA.view == view) && deviceB.view == view));
}

/**
 * Checks if both devices have a specific characteristic
 * @param characteristic        The characteristic as string
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function bothDevicesWithCharacteristic(characteristic: string, deviceA, deviceB){
  if (deviceA.view && deviceB.view){
    let devA = conf.get('app:views:' + deviceA.view);
    let devB = conf.get('app:views:' + deviceB.view);
    return (devA.characteristics.indexOf(characteristic) !== -1 && devB.characteristics.indexOf(characteristic) !== -1);
  }
  return false;
}

/**
 * Checks if exactly one device has a specific view type
 * @param type        The type as number
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function oneDeviceWithType(type, deviceA, deviceB) {
  let aIsType = conf.get('app:views:' + deviceA.view + ':type') == type;
  let bIsNotType = conf.get('app:views:' + deviceB.view + ':type') != type;

  let aIsNotType = conf.get('app:views:' + deviceA.view + ':type') != type;
  let bIsType = conf.get('app:views:' + deviceB.view + ':type') == type;

  return (aIsType && bIsNotType) || (aIsNotType && bIsType);
}

/**
 * Checks if both devices have a specific view
 * @param view        The view as string
 * @param deviceA     device object
 * @param deviceB     device object
 * @returns {boolean}
 */
function bothDevicesWithView(view, deviceA, deviceB) {
  return (deviceA.view == view && deviceB.view == view);
}

/**
 * Exports the check methods. The order defines also the order of checks.
 */
module.exports = {
  visualizationAlignment: visualizationAlignment,
  barChartDisplayExtension: barChartDisplayExtension,
  scatterPlotChartCombination: scatterPlotChartCombination,
  tableChartCombination: tableChartCombination,
  lineChartBarChartCombination: lineChartBarChartCombination,
  settingsMenuForVis: settingsMenuForVis,
  parallelCoordinatesChartCombination: parallelCoordinatesChartCombination,
  parallelCoordinatesStreamgraphCombination: parallelCoordinatesStreamgraphCombination,
  streamgraphBarChartCombination: streamgraphBarChartCombination,
  cloneViewCombination: cloneViewCombination,
  lineChartStreamgraphCombination: lineChartStreamgraphCombination
};