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
const dummy = require('./dummyRoom.js');
const jsonBody = require('./commonJson.js');

function verifyResult(result, total) {
  // console.log(JSON.stringify(result.score));
  should.exist(result.site);
  should.exist(result.score.endpoint);
  should.exist(result.score.endpoint.total);
  should.equal(result.score.endpoint.total, total, 'Should have the expected number of points');
}

describe('checkRoom', function() {
  let params = {};
  params.score = {};
  params.interval = 5;

  it('should not award points when the target is bad', function() {
    params.site = jsonBody.target_url('http://gameontext.org');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkEndpoint()
    .then(function(result) {
      verifyResult(result, 0); // no points
      should.exist(result.score.endpoint.target);
      (result.score.endpoint.target.valid).should.be.false();
    });
  });

  it('should award points for a valid websocket URL', function() {
    this.timeout(5000);
    params.site = jsonBody.target_url('ws://localhost:14000/');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkEndpoint()
    .then(function(result) {
      verifyResult(result, 10); // 10 points
      should.exist(result.score.endpoint.target);
      (result.score.endpoint.target.valid).should.be.true();
    });
  });

  it('should go for broke with RecRoom', function() {
    this.timeout(30000);
    params.site = jsonBody.target_url('wss://gameontext.org/rooms/ws/RecRoom');

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkEndpoint()
    .then(function(result) {
      verifyResult(result, 1070); // 1070 points
      should.exist(result.score.endpoint.target);
      (result.score.endpoint.target.valid).should.be.true();
    });
  });
});
