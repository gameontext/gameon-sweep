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

function verifyScore(result, total) {
  // console.log(JSON.stringify(result.score));
  should.exist(result.total);
  should.equal(result.total, total, 'Should have the expected number of points');
}

describe('totalScore', function() {
  let params = {};
  params.site = { info: { name: 'test '} };

  it('should return 0 for empty result', function() {
    let evaluator = new SiteEvaluator(params);
    let finalScore = evaluator.totalScore();
    verifyScore(finalScore, 0);
  });

  it('should sum results from multiple sections', function() {
    params.score = {
      info: { total: 1 },
      info1: { total: 1 },
      info2: { total: 1 },
      info3: { total: 1 }
    }
    let evaluator = new SiteEvaluator(params);
    let finalScore = evaluator.totalScore();
    verifyScore(finalScore, 4);
  });

  it('should skip sections without totals', function() {
    params.score = {
      info: { total: 1 },
      info1: { },
      info2: { total: 1 },
      info3: { total: 1 }
    }
    let evaluator = new SiteEvaluator(params);
    let finalScore = evaluator.totalScore();
    verifyScore(finalScore, 3);
  });

});
