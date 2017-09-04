import * as conf from '../../conf';
import * as log from '../../logging';
import * as util from '../../utility';
import {IAvailableViews, IView, ViewType} from "../controller/visClientController";

declare let noUiSlider: any;

export enum TileSetupMode {
  initial,
  running
}

interface TileSetupDataCache {
  availableViews?: IAvailableViews;
  availableAttributes?: util.IDataAttributes;
  availableYears?: util.IDataYears;
}

interface TileSetupRunningRequests {
  availableAttributes?: boolean;
  availableYears?: boolean;
  loadTemplate?: boolean;
  loadTemplateDataMapping?: boolean;
  loadTemplateYearSelection?: boolean;
}

interface TileSetupDocumentElements {
  dataMappingContainer?: HTMLElement;
  dataMappingMessage?: HTMLElement;
  dataMappingSelects?: NodeListOf<HTMLSelectElement>;
  parentContainer?: HTMLElement;
  selectedViewButton?: HTMLElement;
  viewButtons?: NodeListOf<HTMLButtonElement>;
  startButton?: HTMLAnchorElement;
  timeSliderContainer?: HTMLElement;
  timeSlider?: any;
  timeSliderMessage?: HTMLElement;
  timeSliderYear?: HTMLElement;
}

interface TileSetupCallbacks {
  initialSetupDone?: (viewInfo: IView, dataMapping?: string[], dataYear?: number) => void;
}

export class TileSetup {

  /**
   * This is true if the setup component has been initialized.
   */
  private _initialized: boolean;

  /**
   * The current mode of this tile setup component.
   */
  private _mode: TileSetupMode;

  /**
   * Dictionary for the most relevant elements of the document (DOM nodes).
   */
  private _el: TileSetupDocumentElements = {};

  /**
   * Dictionary for callback functions.
   */
  private _callb: TileSetupCallbacks = {};

  /**
   * Dictionary for information and data structures.
   */
  private _dataCache: TileSetupDataCache = {};

  /**
   * Dictionary for state of all the server API calls/requests.
   */
  private _finishedRequests: TileSetupRunningRequests = {};

  /**
   * The constructor loads a list of all available data dimensions as well as
   * the template (markup) from the server (per API load).
   *
   * @param parentDomNode The parent element for this component
   * @param availableViews A list of all available view
   * @param mode The for this component, initial (default) or running
   */
  constructor(parentDomNode: HTMLElement, availableViews: IAvailableViews, mode: TileSetupMode = TileSetupMode.initial) {
    // set some members
    this._initialized = false;

    // save the parent element and hide it
    this._el.parentContainer = parentDomNode;
    this._el.parentContainer.style.display = 'none';
    this._el.parentContainer.style.visibility = 'hidden';

    // save the available views
    this._dataCache.availableViews = availableViews;

    // save the mode
    this._mode = mode;
  }

  private initialize(): void {
    if (this._initialized)
      return;

    // remember that the components has been initialized
    this._initialized = true;

    // create two lists for different types of views
    let viewsVis: string[] = [];
    let viewsOther: string[] = [];

    // add available views to the lists according to their type
    let viewInfo: IView;
    for (let viewId in this._dataCache.availableViews) {
      viewInfo = this._dataCache.availableViews[viewId];
      if (viewInfo.config.type == ViewType.vis)
        viewsVis.push(viewId);
      else
        viewsOther.push(viewId);
    }

    // show the loading spinner
    util.showLoadingSpinner('Loading tile setup');

    // load a list of all available data dimensions (attributes), save it when its loaded
    this._finishedRequests.availableAttributes = false;
    util.apiLoad(
      (response: string) => this.onAttributesLoaded(response),
      'data/attributes',
      'meta'
    );

    // load a list of all available years
    this._finishedRequests.availableYears = false;
    util.apiLoad(
      (response: string) => this.onYearsLoaded(response),
      'data/times',
      'meta'
    );

    // load the template (markup), when loaded display it
    this._finishedRequests.loadTemplate = false;
    util.apiLoad(
      (response: string) => this.onTemplateLoaded(response),
      'modules',
      'tile-setup',
      {
        views: this._dataCache.availableViews,
        viewsVis: viewsVis,
        viewsOther: viewsOther
      }
    );
  }

  private continueInitialization(): void {
    // register onclick for vis techniques buttons
    let listContainer = document.getElementById('list-of-techniques');
    this._el.viewButtons = listContainer.getElementsByTagName('button');
    for (let i = 0; i < this._el.viewButtons.length; i++)
      this._el.viewButtons[i].addEventListener('click', (e: Event) => this.onViewButtonClicked(this._el.viewButtons[i]));

    // save the parent dom node for the data mapping components
    this._el.dataMappingContainer = document.getElementById('list-of-dimensions');
    this._el.dataMappingMessage = document.getElementById('mapping-message');

    // save the parent dom node for the time slider menu
    this._el.timeSliderContainer = document.getElementById('time-slider-container');
    this._el.timeSliderMessage = document.getElementById('time-message');

    // save the start button dom node
    this._el.startButton = <HTMLAnchorElement>document.getElementById('start-button');
    this._el.startButton.addEventListener('click', (e: Event) => this.onStartButtonPressed(e));

    switch (this._mode) {
      case TileSetupMode.initial:
        // hide the spinning loader
        util.hideLoadingSpinner();

        break;
      case TileSetupMode.running:
    }
  }

  /**
   * Sets the callback that should be triggered as soon as the initial setup
   * is finished (start button pressed).
   *
   * @param callbInitialSetupDone The callback function
   */
  public setCallbInitialSetupDone(callbInitialSetupDone: (viewInfo: IView, dataMapping?: string[], dataYear?: number) => void): void {
      this._callb.initialSetupDone = callbInitialSetupDone;
  }

  /**
   * Shows (default) or hides the tile setup component.
   *
   * @param show true to show (default), false to hide
   */
  public showTileSetup(show: boolean = true): void {
    if (show && !this.isVisible()) {
      if (!this._initialized)
        this.initialize();

      this._el.parentContainer.style.display = 'block';
      this._el.parentContainer.style.visibility = 'visible';
    } else {
      this._el.parentContainer.style.display = 'none';
      this._el.parentContainer.style.visibility = 'hidden';
    }
  }

  /**
   * Hides the tile setup component.
   */
  public hideTileSetup(): void {
    this.showTileSetup(false);
  }

  /**
   * Returns whether the tile setup component is visible or not.
   *
   * @returns {boolean} true if visible, false if hidden
   */
  public isVisible(): boolean {
    return this._el.parentContainer.style.visibility == 'visible';
  }

  /**
   * Enables or disables the start button based on the selection state of all
   * the mandatory data dimensions.
   *
   * This function is called every time a user selects a data dimension.
   */
  private updateStartButton(): void {
    if (!this._el.startButton) {
      log.error('No start button defined yet!');
      return;
    }

    // save whether all mandatory dimension have been defined
    let allMandatorySelected = false;

    // check if a view is even selected
    if (this._el.dataMappingSelects) {
      // check if all mandatory dimensions are selected
      let numValidSelects = 0;
      for (let i = 0; i < this._el.dataMappingSelects.length; i++) {
        if (this._el.dataMappingSelects[i].classList.contains('mandatory-dimensions') && this._el.dataMappingSelects[i].value != '') {
          numValidSelects++;
        }
      }
      if (numValidSelects >= this.getSelectedViewNumMandatoryAttr())
        allMandatorySelected = true;
    }

    // activate or deactivate the start button
    this.enableStartButton(allMandatorySelected);
  }

  /**
   * Saves the list of all available attributes (data dimensions) as soon as
   * the server API call is finished.
   *
   * @param availableAttributes The result of the API call as a string
   */
  private onAttributesLoaded(availableAttributes: string): void {
    this._dataCache.availableAttributes = JSON.parse(availableAttributes);
    this._finishedRequests.availableAttributes = true;

    if (this._finishedRequests.availableYears && this._finishedRequests.loadTemplate)
      this.continueInitialization();
  }

  private onYearsLoaded(availableYears: string): void {
    this._dataCache.availableYears = JSON.parse(availableYears);
    this._finishedRequests.availableYears = true;

    if (this._finishedRequests.availableAttributes && this._finishedRequests.loadTemplate)
      this.continueInitialization();
  }

  /**
   * Displays the tile setup component as soon as the server API call id done
   * and the template is loaded.
   *
   * @param htmlContent The result of the API call as a string
   */
  private onTemplateLoaded(htmlContent: string): void {
    if (this._el.parentContainer) {
      // append the content to the target dom node
      this._el.parentContainer.innerHTML = htmlContent;

      // remember that the request is finished
      this._finishedRequests.loadTemplate = true;

      if (this._finishedRequests.availableAttributes && this._finishedRequests.availableYears)
        this.continueInitialization();
    }
  }

  private onTemplateDataMappingLoaded(htmlContent: string): void {
    // append the content to the target dom node
    this._el.dataMappingContainer.innerHTML = htmlContent;

    // initialize the select fields
    $('#list-of-dimensions select').material_select();

    // register event listener in each select node
    this._el.dataMappingSelects = this._el.dataMappingContainer.getElementsByTagName('select');
    for (let i = 0; i < this._el.dataMappingSelects.length; i++) {
      this._el.dataMappingSelects[i].onchange = () => this.onDataMappingChanged(this._el.dataMappingSelects[i]);
    }

    // activate start button if there are no mandatory data attributes
    if (this._el.dataMappingSelects.length == 0)
      this.enableStartButton();

    // remember that the request is finished
    this._finishedRequests.loadTemplateDataMapping = true;
  }

  private onTemplateTimeSelectionLoaded(htmlContent: string): void {
    // append the content to the corresponding element
    this._el.timeSliderContainer.innerHTML = htmlContent;

    // save reference to the year label
    this._el.timeSliderYear = document.getElementById('year-selector-current-year');

    // extracts a list of all years
    let years = Object.keys(this._dataCache.availableYears);

    // finds the minimum and maximum year
    let minYear = Number.MAX_VALUE;
    let maxYear = 0;
    for (let i = 0; i < years.length; i++) {
      let year = parseInt(years[i]);
      minYear = (year < minYear) ? year : minYear;
      maxYear = (year > maxYear) ? year : maxYear;
    }

    // initialize the slider
    this._el.timeSlider = document.getElementById('year-selector');
    noUiSlider.create(this._el.timeSlider, {
      start: 2000,
      connect: 'lower',
      step: 1,
      range: {'min': minYear, 'max': maxYear},
      format: wNumb({decimals: 0})
    });
    this._el.timeSlider.noUiSlider.on('update', () => this.onTimeSliderChanged());

    // remember that the request is finished
    this._finishedRequests.loadTemplateYearSelection = true;
  }

  /**
   * Enables (default) or disables the start button.
   *
   * @param enable true to enable, false to disable
   */
  private enableStartButton(enable: boolean = true): void {
    if (enable)
      this._el.startButton.classList.remove('disabled')
    else
      this._el.startButton.classList.add('disabled')
  }

  /**
   * Returns the view id based on the currently selected view button.
   *
   * @returns {string} The id as a string
   */
  private getSelectedViewID(): string {
    if (!this._el.selectedViewButton)
      return undefined;

    return <string>this._el.selectedViewButton.getAttribute('data-view-id');
  }

  private getSelectedViewNumMandatoryAttr(): number {
    if (!this._el.selectedViewButton)
      return undefined;

    let viewId = this.getSelectedViewID();
    let viewInfo: IView = this._dataCache.availableViews[viewId];

    return viewInfo.config.attributes.mandatory.length;
  }

  private getSelectedYear(): number {
    if (!this._el.timeSlider)
      return undefined;

    return this._el.timeSlider.noUiSlider.get();
  }

  /**
   * This function is called when the user selects a view.
   *
   * If the selected view is a visualization, the client requests the
   * data mapping template. Instead, if the view is a menu or option menu,
   * it is activated directly.
   *
   * @param btn The selected (clicked) view button
   */
  private onViewButtonClicked(btn: Element): void {
    // deactivate the start button
    this.enableStartButton(false);

    // force fullscreen after user gesture (button click)
    // https://stackoverflow.com/questions/29281986/run-a-website-in-fullscreen-mode
    if (window.localStorage['desktop'] != 'true') {
      util.launchFullScreen(document.documentElement);
    }

    if (this._el.selectedViewButton && this._el.selectedViewButton == btn) {
      // remove selection highlight from the clicked button
      this._el.selectedViewButton.classList.remove('selected');

      // unset the currently selected button
      this._el.selectedViewButton = undefined;

      // remove the data mapping components
      this._el.dataMappingContainer.innerHTML = '';
      this._el.dataMappingContainer.appendChild(this._el.dataMappingMessage);
      this._el.dataMappingSelects = undefined;

      // remove the time selection components
      this._el.timeSliderContainer.innerHTML = '';
      this._el.timeSliderContainer.appendChild(this._el.timeSliderMessage);
      this._el.timeSlider = undefined;

      return;
    }

    // remove selection highlight from all buttons
    for (let i = 0; i < this._el.viewButtons.length; i++)
      this._el.viewButtons[i].classList.remove('selected');

    // save the currently selected button and highlight it
    this._el.selectedViewButton = <HTMLElement>btn;
    this._el.selectedViewButton.classList.add('selected');

    // get the viewId and information regarding this view
    let viewId: string = this.getSelectedViewID();
    let viewInfo: IView = this._dataCache.availableViews[viewId];

    // if view is a vis, load data mapping template
    this._el.dataMappingContainer.innerHTML = '';
    if (viewInfo.config.type == ViewType.vis) {
      // load the template (markup), when loaded display it
      if(this._dataCache.availableAttributes) {
        this._finishedRequests.loadTemplateDataMapping = false;
        util.apiLoad(
          (response: string) => this.onTemplateDataMappingLoaded(response),
          'modules',
          'tile-setup-datamapping',
          {
            'availableDataDimensions': this._dataCache.availableAttributes,
            'mandatoryMappings': viewInfo.config.attributes.mandatory,
            'optionalMappings': viewInfo.config.attributes.optional
          }
        );


        if(TileSetup.isTimeBased(viewInfo)) {
          this._finishedRequests.loadTemplateYearSelection = false;
          util.apiLoad(
            (response: string) => this.onTemplateTimeSelectionLoaded(response),
            'modules',
            'tile-setup-timeselection'
          );
        } else {
          // remove the time selection components
          this._el.timeSliderContainer.innerHTML = '';
          this._el.timeSliderContainer.appendChild(this._el.timeSliderMessage);
          this._el.timeSlider = undefined;
        }

      }
    } else if (viewInfo.config.type == ViewType.menu) {
      // if the view is a menu, continue and open it
      if (this._callb.initialSetupDone)
        this._callb.initialSetupDone(viewInfo);
    }
  }

  /**
   * This function is called when one of the data mapping select nodes
   * has been changed.
   *
   * @param select  The corresponding dom element (select node)
   */
  private onDataMappingChanged(select: HTMLSelectElement): void {
    // enable or disable the start button
    this.updateStartButton();
  }

  private onTimeSliderChanged(): void {
    // get the current year and show it in the label
    let year: number = this.getSelectedYear();
    this._el.timeSliderYear.innerHTML = year.toString();
  }

  /**
   * Loads the selected view when the start button has been pressed (clicked).
   */
  private onStartButtonPressed(e: Event): void {
    let target = e.target as HTMLElement;

    // prevent click event if button is disabled
    if (target.classList.contains("disabled")){
      return;
    }
    
    // get the viewId and information regarding this view
    let viewId: string = this.getSelectedViewID();
    let viewInfo: IView = this._dataCache.availableViews[viewId];

    // get user-defined data mapping
    let dataMapping: string[] = [];
    for (let i = 0; i < this._el.dataMappingSelects.length; i++) {
      dataMapping.push(this._el.dataMappingSelects[i].value);
    }

    // get the selected year
    let dataYear = this.getSelectedYear();

    // trigger callback: continue and open the selected view
    if (this._callb.initialSetupDone)
      this._callb.initialSetupDone(viewInfo, dataMapping, dataYear);
  }

  private static isTimeBased(view: IView): boolean {
    let index: number = view.config.characteristics.indexOf("time-based");
    return index === -1;
  }
}
