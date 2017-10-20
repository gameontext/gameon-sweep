/*******************************************************************************
 * Copyright (c) 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
const should = require('should');
const express = require('express');
const rp = require('request-promise');
const MapClient = require('../src/MapClient.js');
const jsonBody = require('./commonJson.js');

var app = express();
var port = 3000;
var server;

describe('checkSite', function() {
  let params = {};
  params.score = {}
  params.interval = 1;

  // Scope server start/stop to within this block
  before(function(){
    server = app.listen(port, function() {
      console.log("testFetch server on port " + port);
    });
  });

  after(function(){
    console.log('testFetch server stop');
    server.close();
  });

  it('should return an error when fetch fails', function() {
    app.get('/fail/firstroom', function (req, res) {
      res.status(503)        // HTTP status 503: Not Available
         .send('Not Available');
    });

    let mapClient = new MapClient('http://localhost:3000/fail/', '', '');

    return mapClient.fetchSite({ '_id': 'firstroom' })
    .should.be.rejectedWith({ statusCode: 503,
                              statusMessage: 'Service Unavailable' });
  });

  it('should return an error when the site does not exist', function() {
    app.get('/fail-not-exist/firstroom', function (req, res) {
      res.status(404)        // HTTP status 404: No results found
         .send('No results found');
    });

    let mapClient = new MapClient('http://localhost:3000/fail-not-exist/', '', '');

    return mapClient.fetchSite({ '_id': 'firstroom' })
      .should.be.rejectedWith({ statusCode: 404,
                                statusMessage: 'Not Found' });
  });

});
