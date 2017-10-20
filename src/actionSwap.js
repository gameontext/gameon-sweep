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
const assert = require('assert');
const Promise = require('bluebird');
const Cloudant = require('cloudant');
const openwhisk = require('openwhisk');

const SiteEvaluator = require('./SiteEvaluator.js');
const MapClient = require('./MapClient.js');
const ScoreBook = require('./ScoreBook.js');

function siteSwap (params) {
  let sweep_id = params.sweep_id || '';
  let sweep_secret = params.sweep_secret || '';
  assert.ok(sweep_id, 'Please provide the sweep_id');
  assert.ok(sweep_secret, 'Please provide the sweep_secret');

  let base = params.base || 'https://gameontext.org/map/v1';
  let getClient = new MapClient(base + '/sites/',sweep_id,sweep_secret);
  let swapClient = new MapClient(base + '/swapSites',sweep_id,sweep_secret);

  let cloudant_url = params.cloudant_url || process.env.CLOUDANT_URL;
  assert.ok(cloudant_url, 'Please provide the cloudant_url');

  let cloudant = Cloudant({url: cloudant_url});
  let cloudant_db = params.cloudant_db || 'sweep_score';
  let scorebook = new ScoreBook(cloudant, 'sweep_score');

  let ow = openwhisk();

  return scorebook.getScores().then(function(all_scores) {
    let swaps = scorebook.findSiteSwaps(all_scores.rows);

    let result = {};
    result.success = [];

    let promises = [];

    for (let i = 0; i < swaps.length; i++) {

      let a = swaps[i][0];
      let b = swaps[i][1];

      promises.push(new function() {
        return getClient.fetch(a.id).then(function (site_1) {
          return getClient.fetch(b.id).then(function (site_2) {
            return swapClient.swap_sites(site_1, site_2)
            .then(function(swap_result) {
              result.success.push({
                a: a.id,
                b: b.id
              });
              return true;
            });
          });
        })
        .catch(function(error) {
          result.error = result.error || [];
          result.error.push({
            a: a.id,
            b: b.id,
            error: error
          });
          return true;
        });
      });
    }

    return Promise.all(promises)
    .then(function() {
      console.log(result);

      // Someday, stop doing this. ATM: we want to reflect new paths
      // params.post_sweep = true;
      return ow.actions.invoke('sweep/actionScoreAll', params)
      .then(function() {
        return result;
      });
    })
  })
  .catch(handleError);

}

function handleError(err) {
  console.log(err);
  return Promise.reject(err);
}


exports.main = siteSwap;
