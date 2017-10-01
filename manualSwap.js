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
const MapClient = require('./actions/MapClient.js');
const ScoreBook = require('./actions/ScoreBook.js')
const Cloudant = require('cloudant');
const Promise = require('bluebird');
const assert = require('assert');

var sweepId = process.env['SWEEP_ID'] || '';
var sweepSecret = process.env['SWEEP_SECRET'] || '';

var cloudant = Cloudant({url: process.env.CLOUDANT_URL});
var scorebook = new ScoreBook(cloudant, 'sweep_score');

var getClient = new MapClient('https://gameontext.org/map/v1/sites/',sweepId,sweepSecret);
var swapClient = new MapClient('https://gameontext.org/map/v1/swapSites',sweepId,sweepSecret);

if ( process.argv.length >= 4 ) {
  let result_1 = process.argv[2];
  let result_2 = process.argv[3];

  console.log(`swap ${result_1} and ${result_2}`);

  scorebook.getScore(result_1).then(function(score_1) {
    getClient.fetchSite(score_1.site_id).then(function (site_1) {
      scorebook.getScore(result_2).then(function(score_2) {
        getClient.fetchSite(score_2.site_id).then(function (site_2) {
          swapClient.swap_sites(site_1, site_2);
        });
      })
    })
  })
  .catch(handleError);
} else {
  scorebook.getScores().then(function(all_scores) {
    // Filter out firstRoom
    let scores = all_scores.rows.filter(elem => elem.id !== 'firstroom');
    // Scores come back: [ { id: id, key: score, value: path }, ... ]
    // highest score is first.

    // Sort by path length
    let by_path = JSON.parse(JSON.stringify(scores));
    by_path.sort(function(a,b) {
      return a.value - b.value;
    });

    // keep track of rooms eligible for swapping
    let swap_eligible = {};
    for(let i = 0; i < scores.length; i++) {
      swap_eligible[scores[i].id] = 1;
    }

    var swaps = [];
    let i = 0;
    let j = 0;

    for(i; i < scores.length; i++) {
      let score1 = scores[i];

      if ( !!swap_eligible[score1.id] ) {
        for(j = 0; j < by_path.length; j++) {
          let score2 = by_path[j];
          //console.log(`[${i}] ${score1.key} ${score1.value} --> [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);

          if ( !!swap_eligible[score2.id] ) {
            if ( score1.id === score2.id ) {
              delete swap_eligible[score1.id];

              let removed = by_path.splice(j,1); // remove element
              assert.equal(removed[0].id, score1.id);
              break;
            } else if ( score1.key > score2.key && score1.value !== score2.value ) {
              // This list is sorted by path. We've found two entries that should
              // switch so the larger is closer to the center.

              swaps.push([score1, score2]);

              // remove scores from eligibility
              delete swap_eligible[score1.id];
              delete swap_eligible[score2.id];

              // flat out remove from the by_path list
              let removed = by_path.splice(j,1); // remove element
              assert.equal(removed[0].id, score2.id);
              break;
            } else if ( score1.value < score2.value ) {
              break;
            }
          // } else {
          //   console.log(score2.id, ' has been swapped');
          }
        }
      // } else {
      //   console.log(score1.id, ' has been swapped');
      }
    }

    console.log(swaps);
    for (i = 0; i < swaps.length; i++) {
      let a = swaps[i][0];
      let b = swaps[i][1];
      let delay = 500*i;
      getClient.fetchSite(a.id).then(function (site_1) {
        getClient.fetchSite(b.id).then(function (site_2) {
          console.log(`queue swap of ${a.id} and ${b.id} for ${delay}`);
          Promise.delay(delay).then(function() {
            return swapClient.swap_sites(site_1, site_2)
                   .catch(handleError);
          });
        });
      })
      .catch(handleError);
    }
  })
  .catch(handleError);
}

function handleError(err) {
  console.log(err);
  return Promise.reject(err);
}
