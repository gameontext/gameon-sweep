/*******************************************************************************
 * Copyright (c) 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 ******************************************************************************/
const Cloudant = require('cloudant');
const ScoreBook = require('./actions/ScoreBook.js')

/**
 * Add the new score to the DB
 */
function main(message) {
  let url = params.url || process.env.CLOUDANT_URL;
  let results = params.results || {};
  let marker = params.marker || '';

  let cloudant = Cloudant({url: url});
  let scorebook = new ScoreBook(cloudant, 'sweep_score');
  let site = new Site(1);

  // Aggregate all scores
  let finalScore = site.totalScore(results);
  finalScore.marker = marker;
  return scorebook.keepScore(site_id, finalScore);
}

module.exports.store = main;
