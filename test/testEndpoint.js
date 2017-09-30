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
const Promise = require("bluebird");
const express = require('express');
const rp = require('request-promise');
const Site = require('../actions/Site.js');
const jsonBody = require('./commonJson.js');

var app = express();
var port = 3000;
var server;

let site = new Site(5);

function verifyResult(result, total) {
  //console.log(result);
  should.exist(result.endpoint);
  should.exist(result.endpoint.total);
  should.equal(result.endpoint.total, total, 'Should have the expected number of points');
}

function verifyHealthResult(result, total) {
  verifyResult(result, total);
  (result.endpoint.empty).should.be.false();
  should.exist(result.endpoint.health);
  (result.endpoint.health.valid).should.be.true();
}

describe('checkEndpoint', function() {
  before(function(){
    server = app.listen(port, function() {
      console.log("testEndpoint server on port " + port);
    });
  });

  after(function(){
    console.log('testEndpoint server stop');
    server.close();
  });

  it('should not award points for empty connectionDetails ""', function() {
    return site.checkEndpoint('','').then(function(result) {
      verifyResult(result, 0); // no points
      (result.endpoint.empty).should.be.true();
    });
  });

  it('should not award points for empty connectionDetails {}', function() {
    return site.checkEndpoint('','{}').then(function(result) {
      verifyResult(result, 0); // no points
      (result.endpoint.empty).should.be.true();
    });
  });

  it('should not award points for missing target { type: websocket } and empty Health Check', function() {
    return site.checkEndpoint('',jsonBody.noTarget()).then(function(result) {
      verifyResult(result, 0); // no points
      should.exist(result.endpoint.health);
      (result.endpoint.health.valid).should.be.false();
    });
  });

  it('should award points for valid Health Check', function() {
    app.get('/fail-not-exist/', function (req, res) {
      res.status(404)        // HTTP status 404: No results found
         .send('No results found');
    });

    var endpoint = jsonBody.noTarget();
    endpoint.healthUrl = 'http://localhost:3000/fail-not-exist/';
    return site.checkEndpoint('',endpoint).then(function(result) {
      verifyHealthResult(result, 5); // health check url (5)
      should.exist(result.endpoint.health.statusCode);
      should.equal(result.endpoint.health.statusCode, 404, 'Expected 404');
      should.exist(result.endpoint.health.statusMessage);
    });
  });

  it('should retry Health Check 3 times for 503', function() {
    this.timeout(4000);
    app.get('/fail-not-available/', function (req, res) {
      res.status(503)        // HTTP status 503: Not Available
         .send('Not Available');
    });

    var endpoint = jsonBody.noTarget();
    endpoint.healthUrl = 'http://localhost:3000/fail-not-available/';
    return site.checkEndpoint('',endpoint).then(function(result) {
      verifyHealthResult(result, 5);  // health check url (5)
      should.equal(result.endpoint.health.attempts, 3, 'Should have retried 3 times');
      should.exist(result.endpoint.health.statusCode);
      should.equal(result.endpoint.health.statusCode, 503, 'Expected 503');
      should.exist(result.endpoint.health.statusMessage);
    });
  });

  it('should award 20 points for a 200 return code from Health Check', function() {
    app.get('/ok-no-json/', function (req, res) {
      res.status(200)
         .send('OK');
    });

    var endpoint = jsonBody.noTarget();
    endpoint.healthUrl = 'http://localhost:3000/ok-no-json/';
    return site.checkEndpoint('',endpoint).then(function(result) {
      verifyHealthResult(result, 25);  // health check url (5), Good response (20)
      should.not.exist(result.endpoint.health.statusCode);
      should.not.exist(result.endpoint.health.statusMessage);
      (result.endpoint.health.json).should.be.false();
    });
  });

  it('should award 5 more points for json content in good Health Check', function() {
    app.get('/ok-json/', function (req, res) {
      res.status(200)
         .send('{"status": "UP"}');
    });

    var endpoint = jsonBody.noTarget();
    endpoint.healthUrl = 'http://localhost:3000/ok-json/';
    return site.checkEndpoint('',endpoint).then(function(result) {
      verifyHealthResult(result, 35);  // health check url (5), Good response (20), JSON (5), UP (5)
      should.not.exist(result.endpoint.health.statusCode);
      should.not.exist(result.endpoint.health.statusMessage);
      (result.endpoint.health.json).should.be.true();
    });
  });

  it('should award 5 more points for json content in bad Health Check', function() {
    app.get('/fail-json/', function (req, res) {
      res.status(503)
         .send('{"status": "DOWN"}');
    });

    var endpoint = jsonBody.noTarget();
    endpoint.healthUrl = 'http://localhost:3000/fail-json/';
    return site.checkEndpoint('',endpoint).then(function(result) {
      verifyHealthResult(result, 15);  // health check url (5), JSON (5), DOWN (5)
      should.exist(result.endpoint.health.statusCode);
      should.equal(result.endpoint.health.statusCode, 503, 'Expected 503');
      should.exist(result.endpoint.health.statusMessage);
      (result.endpoint.health.json).should.be.true();
    });
  });
});