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
const SlackNotification = require('./SlackNotification.js');

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

  if ( !!params.swap_sites ) {
    let a = params.swap_sites.site_1;
    let b = params.swap_sites.site_2;
    return swapClient.swap_sites(a, b)
    .then(function(swap_result) {
      console.log(swap_result);
      return Promise.resolve({
        a: a.id,
        b: b.id,
        status: swap_result.status
      });
    });
  } else {
    return compareScores(params, scorebook, getClient, ow);
  }
}

function compareScores(params, scorebook, getClient, ow) {
  let slack = new SlackNotification(params.slack_url);

  return new Promise(function(resolve, reject) {
    scorebook.getScores().then(function(all_scores) {
    //   return slack.swapStart(all_scores.rows.length)
    //   .then(function(){return all_scores});
    // })
    // .then(function(all_scores) {
      let promises = [];
      let stats = scorebook.findSiteSwaps(all_scores.rows);

      promises.push(slack.swapStats(
        `All sorted. Out of ${stats.non_empty} rooms: \n`
        + ` :+1: The high score was ${stats.high}\n`
        + ` :ok_hand: The first quartile score was ${stats.first_quartile}\n`
        + ` :v: The median score was ${stats.median}\n`
        + ` :point_up: The third quartile score was ${stats.third_quartile}\n`
        + ` :-1: The low score was ${stats.low}\n`
      ));

      for (let i = 0; i < stats.swaps.length; i++) {
        promises.push(new Promise(function(resolve,reject) {
          let a = stats.swaps[i][0];
          let b = stats.swaps[i][1];
          console.log("-- site " + i + `: ${a.id} and ${b.id}`);
          getClient.fetch(a.id)
          .then(function(site_1) {
            let a_path = Math.abs(site_1.coord.x) + Math.abs(site_1.coord.y);
            if ( a.value != a_path ) {
              console.log(`SKIPPED: ${a.value} != ${a_path} for ${a.id}`);
              resolve({ skip: true });
            } else {
              getClient.fetch(b.id)
              .then(function(site_2) {
                let b_path = Math.abs(site_2.coord.x) + Math.abs(site_2.coord.y);
                if ( b.value != b_path ) {
                  console.log(`SKIPPED: ${b.value} != ${b_path} for ${b.id}`);
                  resolve({ skip: true });
                } else {
                  // queue swap operation
                  let px = JSON.parse(JSON.stringify(params)); // copy / prevent mutation
                  px.swap_sites = {site_1, site_2};

                  let name_1 = !!site_1.info ? site_1.info.name : a.id;
                  let name_2 = !!site_2.info ? site_2.info.name : b.id;

                  let msg = `${name_1}[${a.key}/${a.value}] will be swapped with ${name_2}[${b.key}/${b.value}]`;
                  console.log(msg);

                  ow.actions.invoke({actionName: 'sweep/actionSwap', params: px})
                  .then(slack.swap(msg))
                  .then(function() {
                    console.log('Done');
                    resolve(true);
                  });
                }
              })
            }
          })
        }));
      }

      return Promise.all(promises).then(function (results) {
        console.log(results);
        return resolve({actions: promises.length});
      })
      .then(ow.actions.invoke({actionName: 'sweep/actionPath', params: {}}));
    })
    .catch(function(err) {
      return reject({error: err});
    });
  });
}


exports.main = siteSwap;
