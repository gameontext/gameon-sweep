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
const dummy = require('./dummyRoom.js');
const jsonBody = require('./commonJson.js');

let site = new Site(5);

function verifyResult(result, total) {
  //console.log(result);
  should.exist(result.endpoint);
  should.exist(result.endpoint.total);
  should.equal(result.endpoint.total, total, 'Should have the expected number of points');
}

describe('checkRoom', function() {

  afterEach(function() {
    console.log('----------');
  });

  it('should not award points when the target is bad', function() {
    var endpoint = jsonBody.noTarget();
    endpoint.target = 'http://gameontext.org';

    return site.checkEndpoint('',endpoint)
    .then(function(result) {
      verifyResult(result, 0); // no points
      should.exist(result.endpoint.target);
      (result.endpoint.target.valid).should.be.false();
    });
  });

  it('should award points for a valid websocket URL', function() {
    this.timeout(5000);

    var endpoint = jsonBody.noTarget();
    endpoint.target = 'ws://localhost:14000/';

    return site.checkEndpoint('',endpoint)
    .then(function(result) {
      verifyResult(result, 10); // 10 points
      should.exist(result.endpoint.target);
      (result.endpoint.target.valid).should.be.true();
    });
  });

  it('should go for broke with RecRoom', function() {
    this.timeout(30000);

    var endpoint = jsonBody.noTarget();
    endpoint.target = 'wss://gameontext.org/rooms/ws/RecRoom';

    return site.checkEndpoint('658aa51512b7cbbc3ee5d0f502525545',endpoint)
    .then(function(result) {
      verifyResult(result, 1070); // 1070 points
      should.exist(result.endpoint.target);
      (result.endpoint.target.valid).should.be.true();
    });
  });
});
