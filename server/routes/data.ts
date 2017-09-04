/**
 * Created by blu on 31.03.16.
 */

/**
 * Created by Tom Horak on 30.03.16.
 */

import * as express from "express";
import {DataManager} from "../models/dataManager";

export class DataRouter {
  router;
  dataManager;

  constructor(dataManager: DataManager) {
    this.dataManager = dataManager;
    this.router = express.Router();
    this.router.get('/:type/:id', (req, res, next) => this.response(req, res));
  }

  response(req, res) {
    var type = req.params.type;
    var id = req.params.id;
    var attributes = req.query.attributes ? JSON.parse(req.query.attributes) : [];
    var objects = req.query.objects ? JSON.parse(req.query.objects) : [];
    var times = req.query.times ? JSON.parse(req.query.times) : [];
    times = this.dataManager.resolveIds(times);
    id = this.dataManager.resolveIds([id])[0];

    if (type == 'attributes') {
      if (id == 'meta')
        this.dataManager.getAttributes(sendResponse, attributes);
      else
        this.dataManager.getDataByAttribute(id, sendResponse, times, objects);
    } else if (type == 'objects') {
      if (id == 'meta')
        this.dataManager.getObjects(sendResponse, objects);
      else
        this.dataManager.getDataByObject(id, sendResponse, times, attributes);
    } else if (type == 'times') {
      if (id == 'meta')
        this.dataManager.getTimes(sendResponse, times);
      else
        this.dataManager.getDataByTime(id, sendResponse, attributes, objects);
    } else {
      sendResponse('Unknown type ' + type);
    }

    function sendResponse(data) {
      res.send(data);
    }
  }
}

export default DataRouter;