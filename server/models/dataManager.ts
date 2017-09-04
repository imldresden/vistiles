/**
 * Created by Tom Horak on 28.04.16.
 */

import * as fs from 'fs';
import * as parse from 'csv-parse';
import * as conf from 'nconf';
import log from '../utility/logging';
import {Database} from "sqlite3";

// Use standard nodejs import to avoid problems
var sqlite3 = require('sqlite3').verbose();

export class DataManager {
  dataName:string = conf.get('data:database:tables:data');
  attributesName:string = conf.get('data:database:tables:attributes');
  objectsName:string = conf.get('data:database:tables:objects');
  attributesSchema:any;
  objectsSchema:any;
  dataSchema:any;
  attributesColumn:string;
  objectsColumn:string;
  attributesSource:string;
  dataSource:string;
  objectsSource:string;
  db:Database;
  checkInitStateInterval:NodeJS.Timer;
  numberOfRows:number = 0;

  private _confPrefix: string;
  private _callbackOnDbReady: () => void = undefined;
  private _exactNumberOfRows: { [key: string]: number; } = { };

  constructor(dataSet:string) {
    this._confPrefix = 'data:' + dataSet + ':';

    this.attributesSchema = require(conf.get(this._confPrefix + 'attributesSchema'));
    this.dataSchema = require(conf.get(this._confPrefix + 'dataSchema'));
    this.objectsSchema = require(conf.get(this._confPrefix + 'objectsSchema'));

    this.attributesColumn = conf.get(this._confPrefix + 'attributesColumn');
    this.objectsColumn = conf.get(this._confPrefix + 'objectsColumn');

    this.attributesSource = conf.get(this._confPrefix + 'attributesSource');
    this.dataSource = conf.get(this._confPrefix + 'dataSource');
    this.objectsSource = conf.get(this._confPrefix + 'objectsSource');
  }

  public initialize(callbackOnDbReady: () => void): void {
    this._callbackOnDbReady = callbackOnDbReady;

    let dbFile = conf.get('data:database:fileName');
    let exists = fs.existsSync(dbFile);
    this.db = new sqlite3.Database(dbFile);

    this.db.serialize(() => {
      if (!exists) {
        let parseOptions = conf.get(this._confPrefix + 'parseOptions');
        this.parseToDatabase(this.dataName, this.dataSource, this.dataSchema, parseOptions);
        this.parseToDatabase(this.attributesName, this.attributesSource, this.attributesSchema, parseOptions);
        this.parseToDatabase(this.objectsName, this.objectsSource, this.objectsSchema, parseOptions);
      } else {
        log.verbose('[DB] Database already exists ... and ready to use!');
        // notification: trigger callback function
        this._callbackOnDbReady();
      }
    });
  }

  checkInitState():void {
    this.db.all('SELECT * FROM ' + this.dataName, (error, rows) => {
      if (rows.length == this.numberOfRows) {
        clearInterval(this.checkInitStateInterval);
        log.verbose('[DB] Completed filling table ' + this.dataName);
        // notification: trigger callback function
        this._callbackOnDbReady();
      } else {
        this.numberOfRows = rows.length;
        let progress = '... filling.';
        if (this._exactNumberOfRows[this.dataName])
          progress = 'Progress: ' + (rows.length / this._exactNumberOfRows[this.dataName] * 100.0).toFixed(2) + '% ...';
        log.verbose('[DB] ' + progress + ' Please wait ...');
      }
    })
  }

  resolveIds(ids:string[]):any {
    for (let i = 0; i < ids.length; i++) {
      if (!(ids[i] in this.dataSchema)) {
        for (let key in this.dataSchema) {
          if (this.dataSchema[key].appName == ids[i]) {
            ids[i] = key;
            break;
          }
        }
      }
    }
    return ids;
  }

  getAttributes(callback:(results:any) => any, attributeIds:string[]):void {
    let sqlStmt = 'SELECT * FROM ' + this.attributesName;
    if (attributeIds && attributeIds.length > 0) {
      sqlStmt += ' WHERE ';
      for (let i = 0; i < attributeIds.length; i++) {
        sqlStmt += this.attributesColumn + '="' + attributeIds[i] + '" OR '
      }
      // cut off trailing ' OR '
      sqlStmt = sqlStmt.slice(0, -4);
    }
    this.queryDatabase(sqlStmt, this.attributesColumn, undefined, callback);
  }

  getObjects(callback:(results:any) => any, objectIds:string[]):void {
    let sqlStmt = 'SELECT * FROM ' + this.objectsName;
    if (objectIds && objectIds.length > 0) {
      sqlStmt += ' WHERE ';
      for (let i = 0; i < objectIds.length; i++) {
        sqlStmt += this.objectsColumn + '="' + objectIds[i] + '" OR '
      }
      // cut off trailing ' OR '
      sqlStmt = sqlStmt.slice(0, -4);
    }
    this.queryDatabase(sqlStmt, this.objectsColumn, undefined, callback);
  }

  getTimes(callback:(results:any) => any, timeIds:string[]):void {
    let times = {};
    for (let key in this.dataSchema) {
      if (this.dataSchema[key].type == 'REAL') {
        if (timeIds.length > 0 && timeIds.indexOf(key) < 0)
          continue;
        times[this.dataSchema[key].appName] = {name: this.dataSchema[key].appName};
      }
    }
    callback(times);
  }

  getData(callback:(results:any) => any, rowType:string, propertyType:string, propertyId:string, rowIds:string[], columnIds:string[]):void {
    var sqlStmt = 'SELECT ';

    if (columnIds && columnIds.length > 0) {
      sqlStmt += rowType + ',';
      for (var i = 0; i < columnIds.length; i++)
        sqlStmt += columnIds[i] + ',';
      // cut off trailing ','
      sqlStmt = sqlStmt.slice(0, -1);
    } else
      sqlStmt += '*';

    sqlStmt += ' FROM ' + this.dataName + ' WHERE ' + propertyType + '="' + propertyId + '"';

    if (rowIds && rowIds.length > 0) {
      sqlStmt += ' AND (';
      for (i = 0; i < rowIds.length; i++) {
        sqlStmt += rowType + '="' + rowIds[i] + '" OR ';
      }
      // cut off trailing ' OR '
      sqlStmt = sqlStmt.slice(0, -4);
      sqlStmt += ')';
    }

    this.queryDatabase(sqlStmt, rowType, propertyType, callback);
  }

  getDataByAttribute(attributeId:string, callback:(results:any) => any, timeIds:string[], objectIds:string[]):void {
    this.getData(callback, this.objectsColumn, this.attributesColumn, attributeId, objectIds, timeIds);
  }

  getDataByObject(objectId:string, callback:(results:any) => any, timeIds:string[], attributeIds:string[]):void {
    this.getData(callback, this.attributesColumn, this.objectsColumn, objectId, attributeIds, timeIds);
  }

  getDataByTime(timeId:string, callback:(results:any) => any, attributeIds:string[], objectIds:string[]):void {
    var sqlStmt = 'SELECT ' + this.attributesColumn + ',' + this.objectsColumn + ',' + timeId;

    sqlStmt += ' FROM ' + this.dataName;

    if (attributeIds && attributeIds.length > 0) {
      sqlStmt += ' WHERE (';
      for (let i = 0; i < attributeIds.length; i++) {
        sqlStmt += this.attributesColumn + '="' + attributeIds[i] + '" OR ';
      }
      // cut off trailing ' OR '
      sqlStmt = sqlStmt.slice(0, -4);
      sqlStmt += ')';
    }

    if (objectIds && objectIds.length > 0) {
      if (sqlStmt[sqlStmt.length - 1] == ')')
        sqlStmt += ' AND (';
      else
        sqlStmt += ' WHERE (';
      for (let i = 0; i < objectIds.length; i++) {
        sqlStmt += this.objectsColumn + '="' + objectIds[i] + '" OR ';
      }
      // cut off trailing ' OR '
      sqlStmt = sqlStmt.slice(0, -4);
      sqlStmt += ')';
    }

    this.queryDatabase(sqlStmt, this.objectsColumn, timeId, callback, this.attributesColumn, timeId);
  }

  queryDatabase(sqlStmt:string, rowId:string, propertyId:string, callback:(results:any) => any, keyName?:string, valueName?:string):void {
    new DatabaseQuery(this.dataSchema, this.db, sqlStmt, rowId, propertyId, callback, keyName, valueName);
  }

  createTable(tableName:string, schema:any):void {
    var sqlStmt = 'CREATE TABLE ' + tableName + ' (';
    for (var key in schema) {
      sqlStmt += key + ' ' + schema[key].type + ',';
    }
    sqlStmt = sqlStmt.slice(0, -1);
    sqlStmt += ')';
    this.db.run(sqlStmt);
  }

  parseToDatabase(tableName:string, source:string, schema:any, parseOptions:any):void {
    this.createTable(tableName, schema);

    let parser = parse(parseOptions, (raw, error) => this.parseMethod(raw, error, tableName, source, schema));
    fs.createReadStream(source).pipe(parser);
  }

  parseMethod(err:Error, rawData:any, tableName:string, source:string, schema:any):void {
    if (err) {
      log.error(source, err);
      return;
    }
    let sqlStmt = 'INSERT INTO ' + tableName + ' VALUES (';
    let keys = [];
    for (let key in schema) {
      keys.push(key);
      sqlStmt += '?,';
    }
    sqlStmt = sqlStmt.slice(0, -1);
    sqlStmt += ')';
    let stmt = this.db.prepare(sqlStmt);

    // save the intended number of rows
    this._exactNumberOfRows[tableName] = rawData.length;

    for (let rowNumber in rawData) {
      let row = rawData[rowNumber];
      let parameters = [];
      for (let i = 0; i < keys.length; i++) {
        parameters.push(row[schema[keys[i]].csvName]);
      }
      if (row[schema[keys[0]].csvName]) {
        stmt.run.apply(stmt, parameters);
      }
    }
    stmt.finalize();
    log.verbose('[DB] Start filling table ' + tableName + ' ...');
    if (tableName == this.dataName) {
      log.verbose('[DB] ... filling table ' + tableName + ' takes a while. Please wait ...');
      this.checkInitStateInterval = setInterval(() => this.checkInitState(), 2000);
    }
  }
}

class DatabaseQuery {
  result = {};
  sqlStmt:string;
  rowId:string;
  propertyId:string;
  callback;
  keyName:string;
  valueName:string;
  db:Database;
  dataSchema:any;

  constructor(dataSchema:any, db:Database, sqlStmt:string, rowId:string, propertyId:string, callback:(result:any) => any, keyName?:string, valueName?:string) {
    this.dataSchema = dataSchema;
    this.db = db;
    this.sqlStmt = sqlStmt;
    this.rowId = rowId;
    this.propertyId = propertyId;
    this.callback = callback;
    if (keyName)
      this.keyName = keyName;
    if (valueName)
      this.valueName = valueName;

    this.db.each(this.sqlStmt, (err, entry) => this.onEach(err, entry), () => this.onComplete());
  }

  onEach(err, entry):void {
    if (err) {
      log.error(this.sqlStmt, err);
      return;
    }

    var values = {};
    if (this.keyName && this.valueName)
      values[entry[this.keyName]] = entry[this.valueName];
    else {
      for (var key in entry) {
        if (key != this.rowId && key != this.propertyId) {
          if (this.dataSchema[key] && this.dataSchema[key].appName)
            values[this.dataSchema[key].appName] = entry[key];
          else
            values[key] = entry[key];
        }
      }
    }
    if (entry[this.rowId] in this.result) {
      for (var valueKey in values) {
        this.result[entry[this.rowId]][valueKey] = values[valueKey];
      }
    } else
      this.result[entry[this.rowId]] = values;
  }

  onComplete():void {
    this.callback(this.result);
  }
}

export default DataManager;