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
const Site = require('../actions/Site.js');
const jsonBody = require('./commonJson.js');

var rp = require('request-promise');
let site = new Site(5);

function verifyResult(result, total) {
  //console.log(result);
  should.exist(result.info);
  should.exist(result.info.total);
  should.equal(result.info.total, total, 'Should have the expected number of points');
}

describe('checkDescription', function() {

  it('should not award points for empty info ""', function() {
    return site.checkDescription('',{}).then(function(result) {
      verifyResult(result, 0); // no points
      (result.info.empty).should.be.true();
    });
  });

  it('should not award points for empty info {}', function() {
    return site.checkDescription('{}',{}).then(function(result) {
      verifyResult(result, 0); // no points
      (result.info.empty).should.be.true();
    });
  });

  it('should not award points for empty info {}', function() {
    return site.checkDescription({},{}).then(function(result) {
      verifyResult(result, 0); // no points
      (result.info.empty).should.be.true();
    });
  });

  it('Result should contain site information', function() {
    return site.checkDescription({},{
      owner: 'flippet',
      position: 6
    }).then(function(result) {
      verifyResult(result, 0); // no points
      (result.info.empty).should.be.true();
      should.exist(result.site);
    });
  });


  it('should not award points for missing full name', function() {
    return site.checkDescription(jsonBody.minimum(),{}).then(function(result) {
      verifyResult(result, 0); // no points
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.false();
      should.equal(result.info.description, 'none');
      should.equal(result.info.doors, 'none');
    });
  });

  it('should award 5 pts for full name, 0 for missing description', function() {
    return site.checkDescription(jsonBody.spareRoom(),{}).then(function(result) {
      verifyResult(result, 5); // full name (5), no description, no doors
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, 'none');
      should.equal(result.info.doors, 'none');
    });
  });

  it('should award 5 points for one-word description', function() {
    return site.checkDescription(jsonBody.verboseRoom(1),{}).then(function(result) {
      verifyResult(result, 6); // full name (5), one-word description (5)
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, '1 word');
      should.equal(result.info.doors, 'none');
    });
  });

  it('should award 30 points for six-word description', function() {
    return site.checkDescription(jsonBody.verboseRoom(6),{}).then(function(result) {
      verifyResult(result, 11); // full name (5), 6 word description (6)
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, '6 words');
      should.equal(result.info.doors, 'none');
    });
  });

  it('should award 1 point for one unique door', function() {
    return site.checkDescription(jsonBody.doorsAlone(1, false),{}).then(function(result) {
      verifyResult(result, 6); // full name (5), no description, one door
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, 'none');
      should.equal(result.info.doors, '1 unique door');
    });
  });

  it('should award 1 point for multiple doors w/ same description', function() {
    return site.checkDescription(jsonBody.doorsAlone(3, false),{}).then(function(result) {
      verifyResult(result, 6); // full name (5), no description, one unique door
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, 'none');
      should.equal(result.info.doors, '1 unique door');
    });
  });

  it('should award 2 points for two doors w/ unique descriptions', function() {
    return site.checkDescription(jsonBody.doorsAlone(2, true),{}).then(function(result) {
      verifyResult(result, 7); // full name (5), no description, two unique doors (2)
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, 'none');
      should.equal(result.info.doors, '2 unique doors');
    });
  });

  it('should award 5 points for 5 unique doors', function() {
    return site.checkDescription(jsonBody.doorsAlone(5, true),{}).then(function(result) {
      verifyResult(result, 10); // full name (5), no description, five unique doors (5)
      (result.info.empty).should.be.false();
      (result.info.fullName).should.be.true();
      should.equal(result.info.description, 'none');
      should.equal(result.info.doors, '5 unique doors');
    });
  });
});
