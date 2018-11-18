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
const SiteEvaluator = require('../src/SiteEvaluator.js');
const jsonBody = require('./commonJson.js');

var app = express();
var port = 3000;
var server;

function verifyResult(result, total) {
  //console.log(result);
  should.exist(result);
  should.exist(result.total);
  should.equal(result.total, total, 'Should have the expected number of points');
}

function verifyGoodUrl(result, total) {
  verifyResult(result, total);
  (result.empty).should.be.false();
  (result.valid).should.be.true();
  (result.gameontext).should.be.false();
  should.equal(result.get, 'OK', 'Should summarize GET was OK');
  should.not.exist(result.get.statusCode);
  should.not.exist(result.get.statusMessage);
}

describe('checkRepository', function() {
  let params = {};
  params.score = {};
  params.interval = 5;

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
    params.site = jsonBody.site_repo('');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.empty).should.be.true();
    });
  });

  it('should not award points for an empty URL [ ]', function() {
    params.site = jsonBody.site_repo(' ');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.empty).should.be.true();
    });
  });

  it('should not award points for a bad URL [not-a-url]', function() {
    params.site = jsonBody.site_repo('not-a-url');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.empty).should.be.false();
      (result.valid).should.be.false();
    });
  });

  it('should not award points for a bad URL [http://something?else]', function() {
    params.site = jsonBody.site_repo('http://something?else');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.empty).should.be.false();
      (result.valid).should.be.false();
    });
  });

  it('should not award points for https://github.com/gameontext/sample-room-java', function() {
    params.site = jsonBody.site_repo('https://github.com/gameontext/sample-room-java');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 2); // 2 points
      (result.empty).should.be.false();
      (result.valid).should.be.true();
      (result.gameontext).should.be.true();
    });
  });

  it('should not award points for https://gameontext.org/swagger', function() {
    params.site = jsonBody.site_repo('https://gameontext.org/swagger');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 2); // 2 points
      (result.empty).should.be.false();
      (result.valid).should.be.true();
      (result.gameontext).should.be.true();
    });
  });

  it('should not award points for unreachable site [404]', function() {
    params.site = jsonBody.site_repo('http://localhost:3000/fail-not-exist/');

    app.get('/fail-not-exist/', function (req, res) {
      res.status(404)        // HTTP status 404: No results found
         .send('No results found');
    });

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 4); // 4 points
      (result.empty).should.be.false();
      (result.valid).should.be.true();
      (result.gameontext).should.be.false();
      should.exist(result.get);
      should.exist(result.get.statusCode);
      should.equal(result.get.statusCode, 404, 'Expected 404');
      should.exist(result.get.statusMessage);
    });
  });

  it('should not award points for unreachable site [503, retry]', function() {
    params.site = jsonBody.site_repo('http://localhost:3000/fail-not-available/');

    this.timeout(4000);
    app.get('/fail-not-available/', function (req, res) {
      res.status(503)        // HTTP status 503: Not Available
         .send('Not Available');
    });

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 4); // 4 points
      (result.empty).should.be.false();
      (result.valid).should.be.true();
      (result.gameontext).should.be.false();
      should.exist(result.get);
      should.equal(result.get.attempts, 3, 'Should have retried 3 times');
      should.exist(result.get.statusCode);
      should.equal(result.get.statusCode, 503, 'Expected 503');
      should.exist(result.get.statusMessage);
    });
  });

  it('should award points for reachable site -- +10', function() {
    params.site = jsonBody.site_repo('http://localhost:3000/available/');

    app.get('/available/', function (req, res) {
      res.status(200)        // HTTP status 200: OK
         .send('OK');
    });

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyGoodUrl(result, 10); // 10 points!!
    });
  });

  it('should award moar points if repo contains code (no GO ref -- +20)', function() {
    params.site = jsonBody.site_repo('https://github.com/ebullient/jshint');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyGoodUrl(result, 30); // (10) repo + (20) code
      (result.src).should.be.true(result);
      (result.GO_ref).should.be.false(result);
    });
  });

  it('should award points if gameontext is in the README.md (no code -- +20)', function() {
    params.site = jsonBody.site_repo('http://localhost:3000/redirect/');
    app.get('/redirect/', function (req, res) {
      res.redirect('https://github.com/gameontext/gameon-gitbook');
    });

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyGoodUrl(result, 30); // (10) repo + (20) readme
      (result.src).should.be.false(result);
      (result.GO_ref).should.be.true(result);
    });
  });

  it('should award moar points if gameontext is in the README.md AND src -- +40', function() {
    params.site = jsonBody.site_repo('https://github.com/ebullient/ebullient-java-room');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyGoodUrl(result, 50); // (10) repo + (20) readme + (20) src
      (result.src).should.be.true(result);
      (result.GO_ref).should.be.true(result);
    });
  });


  it('should award points for https://github.com/gameontext/sample-room-java if the owner is game-on.org', function() {
    params.site = jsonBody.site_repo('https://github.com/gameontext/sample-room-java');
    params.site.owner = 'game-on.org';

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 50); // Our own repo should have a high score (for one of our rooms)
    });
  });
});
