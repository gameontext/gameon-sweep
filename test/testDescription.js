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
const SiteEvaluator = require('../src/SiteEvaluator.js');
const jsonBody = require('./commonJson.js');

var rp = require('request-promise');

function verifyResult(result, total) {
  // console.log(JSON.stringify(result.score));
  should.exist(result.site);
  should.exist(result.score.info);
  should.exist(result.score.info.total);
  should.equal(result.score.info.total, total, 'Should have the expected number of points');
}

describe('checkDescription', function() {
  let params = {};
  params.score = {}
  params.interval = 1;

  it('should have -5 points for empty room', function() {
    params.site = jsonBody.site_empty();

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, -5);
    });
  });

  it('should not award points for sparse room definition', function() {
    params.site = jsonBody.site_wrong();

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 0); // no points
      (result.score.info.nameDefined).should.be.false();
    });
  });

  it('should not award points for missing full name', function() {
    params.site = jsonBody.site_min();

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 0); // no points
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.false();
      should.equal(result.score.info.description, 'none');
      should.equal(result.score.info.doors, 'none');
    });
  });

  it('should award 5 pts for full name, 0 for missing description', function() {
    params.site = jsonBody.spareRoom();

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 5); // full name (5), no description, no doors
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, 'none');
      should.equal(result.score.info.doors, 'none');
    });
  });

  it('should award 5 points for one-word description', function() {
    params.site = jsonBody.verboseRoom(1, false);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 6); // full name (5), one-word description (5)
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, '1 word');
      should.equal(result.score.info.doors, 'none');
    });
  });

  it('should award 5 points for one repeated word description', function() {
    params.site = jsonBody.verboseRoom(6, false);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 6); // full name (5), one-word description (5)
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, '1 word');
      should.equal(result.score.info.doors, 'none');
    });
  });

  it('should award 30 points for six-word description', function() {
    params.site = jsonBody.verboseRoom(6, true);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 11); // full name (5), 6 word description (6)
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, '6 words');
      should.equal(result.score.info.doors, 'none');
    });
  });

  it('should award 1 point for one unique door', function() {
    params.site = jsonBody.doorsAlone(1, false);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 6); // full name (5), no description, one door
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, 'none');
      should.equal(result.score.info.doors, '1 unique door');
    });
  });

  it('should award 1 point for multiple doors w/ same description', function() {
    params.site = jsonBody.doorsAlone(3, false);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 6); // full name (5), no description, one unique door
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, 'none');
      should.equal(result.score.info.doors, '1 unique door');
    });
  });

  it('should award 2 points for two doors w/ unique descriptions', function() {
    params.site = jsonBody.doorsAlone(2, true);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 7); // full name (5), no description, two unique doors (2)
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, 'none');
      should.equal(result.score.info.doors, '2 unique doors');
    });
  });

  it('should award 5 points for 5 unique doors', function() {
    params.site = jsonBody.doorsAlone(5, true);

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription().then(function(result) {
      verifyResult(result, 10); // full name (5), no description, five unique doors (5)
      (result.score.info.nameDefined).should.be.true();
      (result.score.info.fullName).should.be.true();
      should.equal(result.score.info.description, 'none');
      should.equal(result.score.info.doors, '5 unique doors');
    });
  });

    it('should remember path when coordinates are present', function() {
      params.site = jsonBody.slim();

      let evaluator = new SiteEvaluator(params);
      return evaluator.checkDescription().then(function(result) {
        should.exist(result.path);
      });
    });
});
