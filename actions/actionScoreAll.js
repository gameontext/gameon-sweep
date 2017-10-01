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
const Site = require('./Site.js');
const Cloudant = require('cloudant');
const MapClient = require('./MapClient.js');
const ScoreBook = require('./actions/ScoreBook.js');

/**
 * Fetch information about a room (and backing site) from the map.
 * Return promise that resolves to array of further actions based
 * on what is known about the room.
 */
function main (params) {
  let url = params.url || 'https://gameontext.org/map/v1/sites/';
  let interval = params.interval || 1000; // 1s
  let sweep_id = params.sweep_id || '';
  let sweep_secret = params.sweep_secret || '';
  let cloudant_url = params.cloudant_url || process.env.CLOUDANT_URL;
  let cloudant = Cloudant({url: cloudant_url});

  let site = new Site(interval);
  let scorebook = new ScoreBook(cloudant, 'sweep_score');
  let mapClient = new MapClient(url, sweepId, sweepSecret);

  return mapClient.fetchAllSites(url, sweep_id, sweep_secret)
  .then(function(all_sites) {
    console.log(all_sites.length + ' sites to score... ');

    var all_actions = [];

    // for each site in the list, we need to figure out the corresponding
    // action(s) required to generate its score
    for(let i = 0; i < all_sites.length; i++ ) {

      // Add an action to check site details.
      all_actions.push(function() {
        // Retrive site definition
        return mapClient.fetchSite(site_id)
        .then(function(site_details) {
          // Find the list of actions required to create a site's score
          // based on the information present in the site definition
          return site.getActions(site_details)
          .then(function (actionList) {

            var site_actions = actionList.map(function (item) {
              return ow.actions.invoke(item);
            });

            // Wait for all actions defined to check a given site to finish
            return Promise.all(site_actions).then(function (results) {
              var finalScore = site.totalScore(results);
              finalScore.marker = marker;
              return scorebook.keepScore(site_id, finalScore);
            });
          });
        });
      });

      // now wait for all the checks across ALL the sites to finish (kind of ew)
      return Promise.all(all_actions);
    }
  });
}

module.exports.fetch = main;
