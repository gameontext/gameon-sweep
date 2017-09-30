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
const Site = require('../actions/Site.js');
const jsonBody = require('./commonJson.js');

var app = express();
var port = 3000;
var server;

let site = new Site(5);

function verifyDescriptionAction(action) {
  should.exist(action.actionName);
  should.equal(action.actionName, 'sweep/checkDescription');
  should.exist(action.params, 'There should be parameters');
  should.exist(action.params.info, 'Room info should be in parameters');
  should.exist(action.params.info.name, 'Required room name should exist');
}

function verifyGitHubAction(action) {
  should.exist(action.actionName);
  should.equal(action.actionName, 'sweep/checkRepository');
  should.exist(action.params, 'There should be parameters');
  should.exist(action.params.repositoryUrl, 'Repository URL should be in parameters');
}

function verifyEndpointAction(action) {
  should.exist(action.actionName);
  should.equal(action.actionName, 'sweep/checkEndpoint');
  should.exist(action.params, 'There should be parameters');
  should.exist(action.params.connectionDetails, 'Connection details should be in parameters');
}

describe('checkSite', function() {
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

  describe('should handle error responses', function() {

    it('should return an error when fetch fails', function() {
      app.get('/fail/firstroom', function (req, res) {
        res.status(503)        // HTTP status 503: Not Available
           .send('Not Available');
      });

      return site.fetchSite('http://localhost:3000/fail/','firstroom')
      .should.be.rejectedWith({ statusCode: 503,
                                statusMessage: 'Service Unavailable' });
    });

    it('should return an error when the site does not exist', function() {
      app.get('/fail-not-exist/firstroom', function (req, res) {
        res.status(404)        // HTTP status 404: No results found
           .send('No results found');
      });

      return site.fetchSite('http://localhost:3000/fail-not-exist/','firstroom')
        .should.be.rejectedWith({ statusCode: 404,
                                  statusMessage: 'Not Found' });
    });
  });

  describe('should return list of actions', function() {
    it('should include github and connection detail actions', function() {
      app.get('/ok-full/firstroom', function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200)        // HTTP status 200: OK
           .send(JSON.stringify(jsonBody.full()));
      });

      return site.fetchSite('http://localhost:3000/ok-full/','firstroom')
      .then(function (actions) {
        should.equal(actions.length, 3, "should have 3 actions: " + actions.length + "\n " + JSON.stringify(actions, null, 2));

        verifyDescriptionAction(actions[0]);
        verifyGitHubAction(actions[1]);
        verifyEndpointAction(actions[2]);

        return true;
      });
    });

    it('should include connection detail action', function() {
      app.get('/ok-connection/firstroom', function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200)        // HTTP status 200: OK
           .send(JSON.stringify(jsonBody.connection()));
      });

      return site.fetchSite('http://localhost:3000/ok-connection/','firstroom')
      .then(function (actions) {
        should.equal(actions.length, 2, "should have 2 actions: " + actions.length + "\n " + JSON.stringify(actions, null, 2));

        verifyDescriptionAction(actions[0]);
        verifyEndpointAction(actions[1]);

        return true;
      });
    });

    it('should include github action', function() {
      app.get('/ok-github/firstroom', function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200)        // HTTP status 200: OK
           .send(JSON.stringify(jsonBody.github()));
      });

      return site.fetchSite('http://localhost:3000/ok-github/','firstroom')
      .then(function (actions) {
        should.equal(actions.length, 2, "should have 2 actions: " + actions.length + "\n " + JSON.stringify(actions, null, 2));

        verifyDescriptionAction(actions[0]);
        verifyGitHubAction(actions[1]);

        return true;
      });
    });

    it('should not include additional checks', function() {
      app.get('/ok-slim/firstroom', function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200)        // HTTP status 200: OK
           .send(JSON.stringify(jsonBody.slim()));
      });

      return site.fetchSite('http://localhost:3000/ok-slim/','firstroom')
      .then(function (actions) {
        should.equal(actions.length, 1, "should have 1 action: " + actions.length + "\n " + JSON.stringify(actions, null, 2));

        verifyDescriptionAction(actions[0]);

        return true;
      });
    });
  });
});


