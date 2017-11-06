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
const MapClient = require('./src/MapClient.js');
const ScoreBook = require('./src/ScoreBook.js')
const Cloudant = require('cloudant');
const Promise = require('bluebird');
const assert = require('assert');

let sweepId = process.env.SWEEP_ID || '';
let sweepSecret = process.env.SWEEP_SECRET || '';
let slack_url = process.env.SLACK_URL;

let cloudant = Cloudant({url: process.env.CLOUDANT_URL});
let scorebook = new ScoreBook(cloudant, 'sweep_score');

let getClient = new MapClient('https://gameontext.org/map/v1/sites/',sweepId,sweepSecret);
let swapClient = new MapClient('https://gameontext.org/map/v1/swapSites',sweepId,sweepSecret);

if ( process.argv.length >= 4 ) {
  let result_1 = process.argv[2];
  let result_2 = process.argv[3];

  console.log(`swap ${result_1} and ${result_2}`);

  scorebook.getScore(result_1).then(function(score_1) {
    getClient.fetch(score_1._id).then(function (site_1) {
      scorebook.getScore(result_2).then(function(score_2) {
        getClient.fetch(score_2._id).then(function (site_2) {
          swapClient.swap_sites(site_1, site_2);
        });
      })
    })
  })
  .catch(handleError);
} else {
  scorebook.getScores().then(function(all_scores) {
    let stats = scorebook.findSiteSwaps(all_scores.rows);

    console.log(
      `All sorted. Out of ${stats.non_empty} rooms: \n`
      + ` :+1: The high score was ${stats.high}\n`
      + ` :ok_hand: The third quartile score was ${stats.third_quartile}\n`
      + ` :v: The median score was ${stats.median}\n`
      + ` :point_up: The first quartile score was ${stats.first_quartile}\n`
      + ` :-1: The low score was ${stats.low}\n`
    );

  })
  .catch(handleError);
}

function handleError(err) {
  console.log(err);
  return Promise.reject(err);
}
