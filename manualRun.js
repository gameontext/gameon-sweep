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
const Promise = require('bluebird');
const Cloudant = require('cloudant');

const Site = require('./actions/Site.js');
const MapClient = require('./actions/MapClient.js');
const ScoreBook = require('./actions/ScoreBook.js');

let url = process.env['MAP_URL'] || 'https://gameontext.org/map/v1/sites/';
let sweepId = process.env['SWEEP_ID'] || '';
let sweepSecret = process.env['SWEEP_SECRET'] || '';

let cloudant = Cloudant({url: process.env.CLOUDANT_URL});
let scorebook = new ScoreBook(cloudant, 'sweep_score');
let mapClient = new MapClient(url, sweepId, sweepSecret);
let site = new Site(3000);

let marker = Date.now();

if ( process.argv.length >= 3 ) {
  let id = process.argv[2];

  console.log(`Find score for room id ${id}`);
  per_site(id, marker).catch(handleError);
} else {
  mapClient.fetchSites()
  .then(function(all_sites) {
    console.log(all_sites.length + ' sites to score... ');

    for(let i = 0; i < all_sites.length; i++ ) {
      console.log(`Checking ${i}: ${all_sites[i]._id}`);

      Promise.delay(10000*i).then(function() {
        return per_site(all_sites[i]._id, marker)
               .catch(handleError);
      });
    }
  });
}


function per_site(site_id, marker) {
  mapClient.fetchSite(site_id)
  .then(function(site_details) {
    // Find the list of actions required to create a site's score
    // based on the information present in the site definition
    site.getActions(site_details)
    .then(function (actionList) {
      // We'll construct the set of promises by decomposing the
      // action list to invoke the parts directly
      var promises = [];
      for(var i = 0; i < actionList.length; i++ ) {
        let action = actionList[i];
        let op = action.actionName.substring(6); // lop off 'sweep/'

        // x-ref to dewhisk the command arguments (See below)
        promises.push(dewhisk[op](action.params));
      }

      return Promise.all(promises)
      .then(function (results) {
        // Aggregate all scores
        var finalScore = site.totalScore(results);
        finalScore.marker = marker;
        return scorebook.keepScore(site_id, finalScore);
      })
      .catch(handleError);
    })
    .catch(handleError);
  });

  return Promise.resolve(true);
}

// Minimal unpacking of whisk-style parameters
var dewhisk = {
  checkDescription: function (params) {
    // see actionDescription
    return site.checkDescription(params.info, params.site);
  },

  checkEndpoint: function (params) {
    // see actionEndpoint
    return site.checkEndpoint(params.id, params.connectionDetails);
  },

  checkRepository: function (params) {
    // see actionRepository
    return site.checkRepository(params.repositoryUrl, params.owner);
  }
};


function handleError(err) {
  console.log(err);
  return Promise.reject(err);
}
