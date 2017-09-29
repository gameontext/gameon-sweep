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
  should.exist(result.repository);
  should.exist(result.repository.total);
  should.equal(result.repository.total, total, 'Should have the expected number of points');
}

function verifyGoodUrl(result, total) {
  verifyResult(result, total);
  (result.repository.empty).should.be.false();
  (result.repository.valid).should.be.true();
  (result.repository.gameontext).should.be.false();
  should.equal(result.repository.get, 'OK', 'Should summarize GET was OK');
  should.not.exist(result.repository.get.statusCode);
  should.not.exist(result.repository.get.statusMessage);
}

describe('checkRepository', function() {
  before(function(){
    server = app.listen(port, function() {
      console.log("checkRepository server on port " + port);
    });
  });

  after(function(){
    console.log('checkRepository server stop');
    server.close();
  });

  it('should not award points for an empty URL []', function() {
    return site.checkRepository('','').then(function(result) {
      verifyResult(result, 0); // no points
      (result.repository.empty).should.be.true();
    });
  });

  it('should not award points for an empty URL [ ]', function() {
    return site.checkRepository(' ','').then(function(result) {
      verifyResult(result, 0); // no points
      (result.repository.empty).should.be.true();
    });
  });

  it('should not award points for a bad URL [not-a-url]', function() {
    return site.checkRepository('not-a-url','').then(function(result) {
      verifyResult(result, 0); // no points
      (result.repository.empty).should.be.false();
      (result.repository.valid).should.be.false();
    });
  });

  it('should not award points for a bad URL [http://something?else]', function() {
    return site.checkRepository('http://something?else','').then(function(result) {
      verifyResult(result, 0); // no points
      (result.repository.empty).should.be.false();
      (result.repository.valid).should.be.false();
    });
  });

  it('should not award points for https://github.com/gameontext/sample-room-java', function() {
    return site.checkRepository('https://github.com/gameontext/sample-room-java','').then(function(result) {
      verifyResult(result, 2); // 2 points
      (result.repository.empty).should.be.false();
      (result.repository.valid).should.be.true();
      (result.repository.gameontext).should.be.true();
    });
  });

  it('should not award points for https://gameontext.org/swagger', function() {
    return site.checkRepository('https://gameontext.org/swagger','').then(function(result) {
      verifyResult(result, 2); // 2 points
      (result.repository.empty).should.be.false();
      (result.repository.valid).should.be.true();
      (result.repository.gameontext).should.be.true();
    });
  });

  it('should not award points for unreachable site [404]', function() {
    app.get('/fail-not-exist/', function (req, res) {
      res.status(404)        // HTTP status 404: No results found
         .send('No results found');
    });

    return site.checkRepository('http://localhost:3000/fail-not-exist/','').then(function(result) {
      verifyResult(result, 4); // 4 points
      (result.repository.empty).should.be.false();
      (result.repository.valid).should.be.true();
      (result.repository.gameontext).should.be.false();
      should.exist(result.repository.get);
      should.exist(result.repository.get.statusCode);
      should.equal(result.repository.get.statusCode, 404, 'Expected 404');
      should.exist(result.repository.get.statusMessage);
    });
  });

  it('should not award points for unreachable site [503, retry]', function() {
    this.timeout(4000);
    app.get('/fail-not-available/', function (req, res) {
      res.status(503)        // HTTP status 503: Not Available
         .send('Not Available');
    });

    return site.checkRepository('http://localhost:3000/fail-not-available/','').then(function(result) {
      verifyResult(result, 4); // 4 points
      (result.repository.empty).should.be.false();
      (result.repository.valid).should.be.true();
      (result.repository.gameontext).should.be.false();
      should.exist(result.repository.get);
      should.equal(result.repository.get.attempts, 3, 'Should have retried 3 times');
      should.exist(result.repository.get.statusCode);
      should.equal(result.repository.get.statusCode, 503, 'Expected 503');
      should.exist(result.repository.get.statusMessage);
    });
  });

  it('should award points for reachable site -- +6', function() {
    app.get('/available/', function (req, res) {
      res.status(200)        // HTTP status 200: OK
         .send('OK');
    });

    return site.checkRepository('http://localhost:3000/available/','').then(function(result) {
      verifyGoodUrl(result, 10); // 10 points!!
    });
  });

  it('should award moar points if repo contains code (no GO ref -- +20)', function() {
    return site.checkRepository('https://github.com/ebullient/jshint').then(function(result) {
      verifyGoodUrl(result, 30); // 30 points!!
      (result.repository.src).should.be.true(result);
      (result.repository.GO_ref).should.be.false(result);
    });
  });

  it('should award points if gameontext is in the README.md (no code -- +20)', function() {
    app.get('/redirect/', function (req, res) {
      res.redirect('https://github.com/gameontext/gameon-gitbook');
    });

    return site.checkRepository('http://localhost:3000/redirect/','').then(function(result) {
      verifyGoodUrl(result, 30); // 30 points!!
      (result.repository.src).should.be.false(result);
      (result.repository.GO_ref).should.be.true(result);
    });
  });

  it('should award moar points if gameontext is in the README.md AND src -- +40', function() {
    return site.checkRepository('https://github.com/ebullient/ebullient-java-room','').then(function(result) {
      verifyGoodUrl(result, 50); // 50 points!!
      (result.repository.src).should.be.true(result);
      (result.repository.GO_ref).should.be.true(result);
    });
  });


  it('should award points for https://github.com/gameontext/sample-room-java if the owner is game-on.org', function() {
    return site.checkRepository('https://github.com/gameontext/sample-room-java','game-on.org').then(function(result) {
      verifyResult(result, 50); // Our own repo should have a high score (for one of our rooms)
    });
  });
});
