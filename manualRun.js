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

const SiteEvaluator = require('./src/SiteEvaluator.js');
const MapClient = require('./src/MapClient.js');
const ScoreBook = require('./src/ScoreBook.js');

let url = process.env['MAP_URL'] || 'https://gameontext.org/map/v1/sites/';
let sweepId = process.env['SWEEP_ID'] || '';
let sweepSecret = process.env['SWEEP_SECRET'] || '';
let mapClient = new MapClient(url, sweepId, sweepSecret);

let cloudant = Cloudant({url: process.env.CLOUDANT_URL});
let scorebook = new ScoreBook(cloudant, 'sweep_score');
let marker = Date.now();

if ( process.argv.length >= 3 ) {
  let id = process.argv[2];

  console.log(`Find score for room id ${id}`);
  per_site({_id: id}, marker).catch(handleError);
} else {
  mapClient.fetchSites()
  .then(function(all_sites) {
    console.log(all_sites.length + ' sites to score... ');

    for(let i = 0; i < all_sites.length; i++ ) {
      console.log(`Checking ${i}: ${all_sites[i]._id}`);

      Promise.delay(10000*i).then(function() {
        return per_site(all_sites[i], marker)
               .catch(handleError);
      });
    }
  });
}

function per_site(site_info, marker) {
  return mapClient.fetchSite(site_info)
  .then(function(site_details) {
    let params = {
      site: site_details,
      marker: marker
    }

    let evaluator = new SiteEvaluator(params);
    return evaluator.checkDescription()
    .then(function(params) { return evaluator.checkRepository()})
    .then(function(params) { return evaluator.checkEndpoint()})
    .then(function(params) { return evaluator.totalScore()})
    .then(function(params) { return scorebook.keepScore(params)})
    .then(function(result) {
      console.log(result);
    })
    .catch(handleError);
  });
}

function handleError(err) {
  console.log(err);
  return Promise.reject(err);
}
