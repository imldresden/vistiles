//basic chart module
import * as conf from "../../../conf";
import * as utility from "../../../utility";
import {Visualization} from "./visualization";
import {VisClientController} from "../../controller/visClientController";

export class Table extends Visualization{

  // constants
  static viewId: string = 'table';
  private _contentDivId: string = 'tableContainer';
  private _tableId: string  = 'dataTable';
  private _thRowClass: string = 'rowHeader';

  private _columns: string[];
  private _rows: string[];
  private _dataRefresh: boolean = false;
  private _dataLoadedStep: number = 0;

  private _attrUpdateBurstTimer;

  private _regions: string[];
  private _filteredObjects: any;

  get viewId(): string { return Table.viewId; }

  constructor(parent, dataName, visClientController, dataYear?: number) {
    super(parent, visClientController);

    utility.showLoadingSpinner(conf.get('strings:ui:loadAvailableData'));

    this._eventCallbacks[conf.get('events:selection:state')] = (data) => this.updateSelection(data);
    this._eventCallbacks[conf.get('events:settings:attributesUpdate')] = (data) => this.onAttributeUpdate(data);
    this._eventCallbacks[conf.get('events:filter:viewportState')] = (data) => this.updateFilter(data);

    this._dataAttr = {
      'attrMappings': {
        'disabled': []
      },
      'attr': {
        'maxY': null,
        'minY': null,
        'year': 2000
      },
      'filteredRegions': []
    };

    if (dataYear) {
      this._dataAttr.attr.year = dataYear;
    }

    document.getElementById('visualizationDiv').innerHTML = '<div id="' + this._contentDivId + '"><table id="' + this._tableId + '" class="noSelect whiteBackground"></table></div>';

    this.loadData();
    this.loadAttrMeta();
    this.loadObjMeta();
  }

  loadData(): void {
    this._dataLoadedStep = 0;
    utility.apiLoad((res) => this.processData(res), 'data/times', this._dataAttr.attr['year'].toString());
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
    this._data = JSON.parse(res);

    this._rows = Object.keys(this._data);

    // assuming that all elements have the same attributes, else we would have to iterate and compare
    this._columns = Object.keys(this._data[this._rows[0]]);

    this._dataLoadedStep++;

    this.initializeVis();

    this._dataRefresh = false;
  }

  processDataAttributes (res: string): void {
    this._attrMeta = JSON.parse(res);

    this._dataLoadedStep++;

    this.initializeVis();
  }

  processDataObjects(res: string): void {
    this._objMeta = JSON.parse(res);

    let regionsSet: Set<string> = new Set<string>();
    for (let objId in this._objMeta) {
      regionsSet.add(this._objMeta[objId].Region);
    }

    this._regions = Array.from(regionsSet);

    this._dataLoadedStep++;

    this.initializeVis();
  }


  initializeVis(): void {

    if (this._dataLoadedStep < 3 && !this._dataRefresh)
      return;

    // generate headers
    let tableHtml = '<thead class="whiteBackground"><tr><th class="sortInverse sortedAsc noDragAndDrop"></th>'; // first element is empty

    for (let element of this._columns) {
      let hidden = '';
      if(this._dataAttr.attrMappings.disabled.indexOf(element) > -1) {
        hidden = 'hidden';
      }

      // set the correct name
      let name = this._attrMeta[element]['Name'];
      tableHtml += '<th id="' + element + '" draggable="true" class="' + hidden + '">' + name + '</th>';
    }

    // close head, next is body
    tableHtml += '</tr></thead><tbody>';

    // generate rows
    for (let rowElement of this._rows) {

      // this is used for group filtering later
      let group = 'group-' + this._regions.indexOf(this._objMeta[rowElement]['Region']).toString();
      let row = '<tr class="' + group + '">';

      // headers
      let name = this._objMeta[rowElement]['Name'];
      row += '<th id="' + rowElement + '" class="' + this._thRowClass + ' whiteBackground">' + name + '</th>';

      // all values
      for (let rowData of this._columns) {
        let hidden = '';
        if(this._dataAttr.attrMappings.disabled.indexOf(rowData) > -1) {
          hidden = 'hidden';
        }

        // only add the data-tag if we have it
        if(this._data[rowElement][rowData]) {
          row += '<td class="' + hidden + '" data-unformatted="' + this._data[rowElement][rowData] + '">';
        } else {
          row += '<td class="' + hidden + '">';
        }
        row += this.formatRowData(this._data[rowElement][rowData]) + '</td>';
      }
      tableHtml += row;
    }

    let table = document.getElementById(this._tableId);
    table.innerHTML = tableHtml;

    this.setupOnClick();
    this.setupDragging();
    document.getElementById(this._contentDivId).addEventListener('scroll', _ => this.onScroll());

    // sorting
    this.sortTable(table as HTMLTableElement, 0, false);
    (table as HTMLTableElement).tHead.addEventListener('click', (ev) => this.tableSortHandler(ev));

    // selections

    // copy old data
    let selected = Array.from(this._selectedObjectIds);
    // clear old data
    this._selectedObjectIds.clear();
    // reapply selections
    this.updateSelection(selected);


    // registers this module
    if (this._visClientController.getActiveView() != this) {
      this._visClientController.registerView(this);
    }

    // we finished, display
    utility.hideLoadingSpinner();
  }

  getObjects(): string[] {
    let objects: string[] = [];
    for (let i = 0; i < this._data.length; i++) {
      objects.push(this._data[i][0]);
    }
    return objects;
  }

  updateVis(): void {
  }

  // ***************************
  // Object Selection
  // ***************************

  setupOnClick(): void {
    let table = document.getElementById(this._tableId);
    let cells = table.getElementsByTagName('td');

    for (let i = 0; i < cells.length; i++) {
      cells[i].addEventListener('click', (ev) => this.cellOnClick(ev))
    }
  }

  cellOnClick(ev): void {
    let cell = ev.target as HTMLTableDataCellElement;
    let row = cell.parentElement;

    if(row.className.includes('Background')) {
      this.deselectObjects([row], true);
    } else {
      this.selectObjects([row], true);
    }
  }

  getRow(objId: string): HTMLTableRowElement {
    //let col = document.getElementById(attrId) as HTMLTableHeaderCellElement;
    return document.getElementById(objId).parentElement as HTMLTableRowElement;
  }

  getRowData(row: HTMLTableRowElement): string {
    return (row.firstChild as HTMLElement).id; // tr > th
  }

  getCell(objId: string, attrId: string): HTMLTableDataCellElement {
    let col = document.getElementById(attrId) as HTMLTableHeaderCellElement;
    let row = document.getElementById(objId).parentElement as HTMLTableRowElement;

    return row.cells[col.cellIndex];
  }

  getCellData(cell: HTMLTableDataCellElement): { objId, attrId } {
    let row = cell.parentElement as HTMLTableRowElement; // td > tr
    let thead = (row.parentElement.parentElement as HTMLTableElement).tHead; // tr > tbody > table > thead
    let col = thead.children[0].children[cell.cellIndex]; // thead > tr > th

    let objId = (row.firstChild as HTMLElement).id; // tr > th
    let attrId = col.id;

    return {objId: objId, attrId: attrId};
  }


  updateSelection(selectedIds: string[]): void {
    let currentSelectedIds: string[] = Array.from(this._selectedObjectIds);
    let objects: HTMLElement[] = [];
    let object: HTMLElement;
    for (let i = 0; i < currentSelectedIds.length; i++) {
      let index = selectedIds.indexOf(currentSelectedIds[i]);
      if (index === -1)  {
        this._selectedObjectIds.delete(currentSelectedIds[i]);
        object = document.getElementById(currentSelectedIds[i]).parentElement;
        if (object) {
          objects.push(object);
        }
      } else { // element is already selected on our side, remove it from the list
        selectedIds.splice(index, 1);
      }
    }
    if (objects.length) {
      this.deselectObjects(objects);
    }

    objects = [];
    for (let i = 0; i < selectedIds.length; i++) {
      this._selectedObjectIds.add(selectedIds[i]);
      object = document.getElementById(selectedIds[i]).parentElement;
      if (object) {
        objects.push(object);
      }
    }
    if (objects.length) {
      this.selectObjects(objects);
    }
  }

  selectObjects(objects: HTMLElement[], emit?: boolean): void {

    // there can only be one object selected at a time
    // CELL
    /*let cell = objects[0] as HTMLTableDataCellElement;
    let data = this.getCellData(cell);
    let group = 'groupBackground-' + this._regions.indexOf(this._objMeta[data.objId]['Region']);

    cell.classList.add(group);

    this._selectedObjectIds.add(data.objId);*/

    // ROW
    for(let i = 0; i < objects.length; i++) {
      let row = objects[i] as HTMLTableRowElement;
      let objId = this.getRowData(row);
      let group = this._regions.indexOf(this._objMeta[objId]['Region']);
      let css = 'groupBackground-' + group;
      let lightCss = 'groupBackgroundLight-' + group;
      let rowHeader = document.getElementById(objId);

      row.classList.add(lightCss);
      rowHeader.classList.remove('whiteBackground');
      rowHeader.classList.add(css);

      this._selectedObjectIds.add(objId);
    }

    // we received an event, so we hightlight the last element
    if(!emit) {
      this.scrollToElement(objects[objects.length - 1]);
    }

    if (emit) {
      this._visClientController.emitEvent(conf.get("events:selection:added"), Array.from(this._selectedObjectIds));
    }
  }

  deselectObjects(objects: HTMLElement[], emit?: boolean): void {

    // there can only be one object selected at a time
    // CELL
    /*let cell = objects[0] as HTMLTableDataCellElement;
    let data = this.getCellData(cell);
    let group = 'groupBackground-' + this._regions.indexOf(this._objMeta[data.objId]['Region']);

    cell.classList.remove(group);

    this._selectedObjectIds.delete(data.objId);

    if (emit) {
      this._visClientController.emitEvent(conf.get("events:selection:removed"), [data.objId]);
    }*/

    // ROW
    let ids: string[] = [];
    for(let i = 0; i < objects.length; i++) {
      let row = objects[i] as HTMLTableRowElement;
      let objId = this.getRowData(row);
      let group = this._regions.indexOf(this._objMeta[objId]['Region']);
      let css = 'groupBackground-' + group;
      let lightCss = 'groupBackgroundLight-' + group;
      let rowHeader = document.getElementById(objId);

      row.classList.remove(lightCss);
      rowHeader.classList.remove(css);
      rowHeader.classList.add('whiteBackground');

      this._selectedObjectIds.delete(objId);
      ids.push(objId);
    }
    if (emit) {
      this._visClientController.emitEvent(conf.get("events:selection:removed"), ids);
    }
  }

  scrollToElement(e: HTMLElement): void {
    let table = document.getElementById(this._tableId) as HTMLTableElement;
    let container = document.getElementById(this._contentDivId) as HTMLElement;
    container.scrollTop = e.offsetTop - table.tHead.clientHeight;

    /*e.scrollIntoView(); // align top

    // offset because of the sticky header
    let table = document.getElementById(this._tableId) as HTMLTableElement;
    let container = document.getElementById(this._contentDivId) as HTMLElement;

    // don't update if we are at the bottom
    if(container.scrollTop < container.scrollHeight - container.clientHeight) {
      container.scrollTop -= table.tHead.clientHeight;
    }*/
  }


  toggleSelection (d: any[]): void {
  }

  emitCurrentState(): void {
    this.emitSelectionState();
  }

  // ***************************
  // Dragging
  // ***************************

  setupDragging(): void {
    let table = document.getElementById(this._tableId) as HTMLTableElement;
    let columns = table.tHead.children;

    for (let i = 0; i < columns.length; i++) {
      columns[i].addEventListener('dragstart', (ev) => this.onDragStart(ev));
      columns[i].addEventListener('dragover', (ev) => this.onDragOver(ev));
      columns[i].addEventListener('dragleave', (ev) => this.onDragLeave(ev));
      columns[i].addEventListener('drop', (ev) => this.onDrop(ev));
      columns[i].addEventListener('dragend', (ev) => this.onDragEnd(ev));
    }
  }

  onDragStart(ev): void {
    let obj = ev.target as HTMLTableDataCellElement;

    // save the index as data
    ev.dataTransfer.setData("text/plain", obj.cellIndex);
  }

  onDragOver(ev): void {
    if(ev.target.classList.contains("noDragAndDrop"))
      return;

    if (ev.preventDefault) {
      ev.preventDefault(); // necessary, allows us to drop
    }

    ev.target.classList.add('dragOver');
  }

  onDragLeave(ev): void {
    ev.target.classList.remove('dragOver');
  }

  onDrop(ev): void {
    ev.target.classList.remove('dragOver');

    let obj = ev.target as HTMLTableDataCellElement;
    let newIndex = obj.cellIndex;
    let oldIndex = ev.dataTransfer.getData('text');
    let table = document.getElementById(this._tableId) as HTMLTableElement;

    // if the drag to the right, we get +1 higher index because our hightlight (dragOver) is on the left border
    if(newIndex > oldIndex)
      newIndex--;

    this.moveTableColumn(table, oldIndex, newIndex);
  }

  onDragEnd(ev): void {
    ev.target.classList.remove('dragOver');
  }

  moveTableColumn(table: HTMLTableElement, oldIndex: number, newIndex: number): void {
    if(oldIndex === newIndex)
      return;

    let i = table.rows.length;
    while (i--) {
      let row = table.rows[i];
      let x = row.removeChild(row.cells[oldIndex]);
      row.insertBefore(x, row.cells[newIndex]);
    }
  }

  // ***************************
  // Scrolling
  // ***************************

  onScroll(): void {
    let contentDiv = document.getElementById(this._contentDivId);
    let translateX = 'translate(' + contentDiv.scrollLeft.toString() + 'px,0)';
    let translateY = 'translate(0,' + contentDiv.scrollTop.toString() + 'px)';
    let colHeaders = document.getElementsByTagName('thead')[0];

    colHeaders.style.transform = translateY;

    let rowHeaders = document.getElementsByClassName(this._thRowClass);

    // we check if we need to update first, for some reason the type is Element, so we have to cast here
    if((rowHeaders[0] as HTMLElement).style.transform != translateX) {
      for(let i = 0; i < rowHeaders.length; i++) {
        (rowHeaders[i] as HTMLElement).style.transform = translateX;
      }
    }
  }

  // ***************************
  // Data Formatting
  // ***************************

  formatRowData(rowData: number): string {
    if(!rowData)
      return '';

    return rowData.toLocaleString(
        conf.get('app:language'), //'de-DE'
        { minimumFractionDigits: 0,
          maximumFractionDigits: 2}
    );
  }

  // ***************************
  // Sorting
  // ***************************

  tableSortHandler(ev): void {
    // check for null or undefined (NOT 0)
    if(ev.target.cellIndex == null) return; // we got the <tr> element instead of a <th>

    utility.showLoadingSpinner('');

    let table = document.getElementById(this._tableId) as HTMLTableElement;

    if(ev.target.classList.contains('sortedAsc')) {
      ev.target.classList.remove('sortedAsc');
      ev.target.classList.add('sortedDesc');
      this.sortTable(table, ev.target.cellIndex, true);
    }
    else if(ev.target.classList.contains('sortedDesc')) {
      ev.target.classList.remove('sortedDesc');
      ev.target.classList.add('sortedAsc');
      this.sortTable(table, ev.target.cellIndex, false);
    }
    else {
      // remove sorting information from all other headers
      for(let i = 0; i < ev.target.parentElement.childNodes.length; i++) {
        ev.target.parentElement.childNodes[i].classList.remove('sortedAsc');
        ev.target.parentElement.childNodes[i].classList.remove('sortedDesc');
      }
      // add the new one
      if(ev.target.classList.contains('sortInverse')) {
        ev.target.classList.add('sortedAsc');
        this.sortTable(table, ev.target.cellIndex, false);
      } else {
        ev.target.classList.add('sortedDesc');
        this.sortTable(table, ev.target.cellIndex, true);
      }
    }

    utility.hideLoadingSpinner();
  }

  sortTable(table: HTMLTableElement, col: number, desc: boolean = false): void {
    let tb = table.tBodies[0]; // we only have one body in our table
    let tr = Array.from(tb.rows); // generate array from rows
    let inversor = desc
        ? -1
        : 1;

    tr = tr.sort((a, b) => {
      // put empty elements always last
      if(a.cells[col].textContent && !b.cells[col].textContent) {
        return -1;
      } else if(!a.cells[col].textContent && b.cells[col].textContent) {
        return 1;
      }
      // sort data
      if(a.cells[col].dataset.unformatted && b.cells[col].dataset.unformatted) {
        if(!desc) {
          return Number(a.cells[col].dataset.unformatted) - Number(b.cells[col].dataset.unformatted);
        } else {
          return Number(b.cells[col].dataset.unformatted) - Number(a.cells[col].dataset.unformatted);
        }
      }
      // sort row header
      return inversor * (a.cells[col].textContent.localeCompare(b.cells[col].textContent));
    });

    for(let i = 0; i < tr.length; ++i) tb.appendChild(tr[i]); // append each row in new order
  }

  // ***************************
  // Filtering headers
  // ***************************

  onAttributeUpdate(newDataAttr: {[id: string]: any}): void {
    if(newDataAttr.filteredRegions) {
      //this._dataAttr.filteredRegions = newDataAttr.filteredRegions;
      this.updateDictionary(this._dataAttr, newDataAttr);
      this.updateFilteredRegions();
    } else if(newDataAttr.attrMappings && newDataAttr.attrMappings.disabled) {
      //this._dataAttr.attrMappings.disabled = newDataAttr.attrMappings.disabled;
      this.updateDictionary(this._dataAttr, newDataAttr);
      this.updateHeadersVisibility();
    } else {
      // load new data with 1 second delay to handle rapid updates
      if(this._attrUpdateBurstTimer) clearTimeout(this._attrUpdateBurstTimer);

      this._attrUpdateBurstTimer = setTimeout(() => {
        utility.showLoadingSpinner(conf.get('strings:ui:loadAvailableData'));
        this.updateDictionary(this._dataAttr, newDataAttr);
        this._dataRefresh = true;
        this.loadData();
      }, 1000);
    }
  }

  updateFilteredRegions(): void {
    let old = document.getElementsByClassName('filteredRegion');

    // old is a live array (gets updated), so we need to use a while loop
    while (old.length > 0) {
      old[0].classList.remove('filteredRegion');
    }

    for(let j = 0; j < this._dataAttr.filteredRegions.length; j++) {
      let elements = document.getElementsByClassName('group-' + this._dataAttr.filteredRegions[j]);
      for(let k = 0; k < elements.length; k++) {
        elements[k].classList.add('filteredRegion');
      }
    }
  }

  updateHeadersVisibility(): void {
    let newData: string[] = this._dataAttr.attrMappings.disabled;
    let table: HTMLTableElement = document.getElementById(this._tableId) as HTMLTableElement;

    let visible: number[] = [];
    let hidden: number[] = [];

    // first update the headers
    // skip the first header because the colum is all row headers
    for(let i = 1; i < table.tHead.rows[0].cells.length; i++) {
      let th = table.tHead.rows[0].cells[i];

      // new visible element
      if(th.classList.contains('hidden') && newData.indexOf(th.id) === -1) {
        visible.push(i); // adjust index because we skipped the first header
        th.classList.remove('hidden');
      }
      // new hidden element
      else if(!th.classList.contains('hidden') && newData.indexOf(th.id) !== -1) {
        hidden.push(i); // adjust index because we skipped the first header
        th.classList.add('hidden');
      }
    }

    // update cells
    for(let i = 0; i < table.rows.length; i++) {
      let row = table.rows[i];

      for(let j = 0; j < visible.length; j++) {
        row.cells[visible[j]].classList.remove('hidden');
      }
      for(let j = 0; j < hidden.length; j++) {
        row.cells[hidden[j]].classList.add('hidden');
      }
    }

  }

  // ***************************
  // Filtering rows
  // ***************************

  updateFilter(d): void {
    this._filteredObjects = d;
    this.updateRowsVisibility();
  }

  updateRowsVisibility(): void {

    let table = document.getElementById(this._tableId) as HTMLTableElement;

    for(let i = 0; i < table.rows.length; i++) {
      let id = (table.rows[i].firstChild as HTMLElement).id; // first child = th
      if(this._filteredObjects.indexOf(id) > -1) {
        table.rows[i].classList.add('hidden');
      } else {
        table.rows[i].classList.remove('hidden');
      }
    }
  }

  // ***************************
  // Unused
  // ***************************

  showTooltip(id: string): void {
  }

  hideTooltip(id: string) {
  }

  updateTooltip(id: string) { }


  onWindowResize(): void {
  }
}