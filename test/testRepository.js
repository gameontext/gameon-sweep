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
  // console.log(JSON.stringify(result.score));
  should.exist(result.site);
  should.exist(result.score.repository);
  should.exist(result.score.repository.total);
  should.equal(result.score.repository.total, total, 'Should have the expected number of points');
}

function verifyGoodUrl(result, total) {
  verifyResult(result, total);
  (result.score.repository.empty).should.be.false();
  (result.score.repository.valid).should.be.true();
  (result.score.repository.gameontext).should.be.false();
  should.equal(result.score.repository.get, 'OK', 'Should summarize GET was OK');
  should.not.exist(result.score.repository.get.statusCode);
  should.not.exist(result.score.repository.get.statusMessage);
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
      (result.score.repository.empty).should.be.true();
    });
  });

  it('should not award points for an empty URL [ ]', function() {
    params.site = jsonBody.site_repo(' ');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.score.repository.empty).should.be.true();
    });
  });

  it('should not award points for a bad URL [not-a-url]', function() {
    params.site = jsonBody.site_repo('not-a-url');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.score.repository.empty).should.be.false();
      (result.score.repository.valid).should.be.false();
    });
  });

  it('should not award points for a bad URL [http://something?else]', function() {
    params.site = jsonBody.site_repo('http://something?else');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 0); // no points
      (result.score.repository.empty).should.be.false();
      (result.score.repository.valid).should.be.false();
    });
  });

  it('should not award points for https://github.com/gameontext/sample-room-java', function() {
    params.site = jsonBody.site_repo('https://github.com/gameontext/sample-room-java');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 2); // 2 points
      (result.score.repository.empty).should.be.false();
      (result.score.repository.valid).should.be.true();
      (result.score.repository.gameontext).should.be.true();
    });
  });

  it('should not award points for https://gameontext.org/swagger', function() {
    params.site = jsonBody.site_repo('https://gameontext.org/swagger');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyResult(result, 2); // 2 points
      (result.score.repository.empty).should.be.false();
      (result.score.repository.valid).should.be.true();
      (result.score.repository.gameontext).should.be.true();
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
      (result.score.repository.empty).should.be.false();
      (result.score.repository.valid).should.be.true();
      (result.score.repository.gameontext).should.be.false();
      should.exist(result.score.repository.get);
      should.exist(result.score.repository.get.statusCode);
      should.equal(result.score.repository.get.statusCode, 404, 'Expected 404');
      should.exist(result.score.repository.get.statusMessage);
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
      (result.score.repository.empty).should.be.false();
      (result.score.repository.valid).should.be.true();
      (result.score.repository.gameontext).should.be.false();
      should.exist(result.score.repository.get);
      should.equal(result.score.repository.get.attempts, 3, 'Should have retried 3 times');
      should.exist(result.score.repository.get.statusCode);
      should.equal(result.score.repository.get.statusCode, 503, 'Expected 503');
      should.exist(result.score.repository.get.statusMessage);
    });
  });

  it('should award points for reachable site -- +6', function() {
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
      verifyGoodUrl(result, 30); // 30 points!!
      (result.score.repository.src).should.be.true(result);
      (result.score.repository.GO_ref).should.be.false(result);
    });
  });

  it('should award points if gameontext is in the README.md (no code -- +20)', function() {
    params.site = jsonBody.site_repo('http://localhost:3000/redirect/');
    app.get('/redirect/', function (req, res) {
      res.redirect('https://github.com/gameontext/gameon-gitbook');
    });

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyGoodUrl(result, 30); // 30 points!!
      (result.score.repository.src).should.be.false(result);
      (result.score.repository.GO_ref).should.be.true(result);
    });
  });

  it('should award moar points if gameontext is in the README.md AND src -- +40', function() {
    params.site = jsonBody.site_repo('https://github.com/ebullient/ebullient-java-room');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkRepository().then(function(result) {
      verifyGoodUrl(result, 50); // 50 points!!
      (result.score.repository.src).should.be.true(result);
      (result.score.repository.GO_ref).should.be.true(result);
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
