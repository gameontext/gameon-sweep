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

const MapClient = require('./MapClient.js');
const ScoreBook = require('./ScoreBook.js');

function updatePath(params) {
  let url = params.url || 'https://gameontext.org/map/v1/sites/';
  let sweep_id = params.sweep_id || '';
  let sweep_secret = params.sweep_secret || '';
  assert.ok(sweep_id, 'Please provide the sweep_id');
  assert.ok(sweep_secret, 'Please provide the sweep_secret');

  let mapClient = new MapClient(url, sweep_id, sweep_secret);

  let cloudant_url = params.cloudant_url || process.env.CLOUDANT_URL;
  assert.ok(cloudant_url, 'Please provide the cloudant_url');

  let cloudant = Cloudant({url: cloudant_url});
  let cloudant_db = params.cloudant_db || 'sweep_score';
  let scorebook = new ScoreBook(cloudant, 'sweep_score');

  let marker = Date.now();

  return  mapClient.fetchSites().then(function(all_sites) {
    let promises  = [];

    for(let i = 0; i < all_sites.length; i++ ) {
      let site = all_sites[i];
      if ( site.coord ) {
        let path = Math.abs(site.coord.x) + Math.abs(site.coord.y);
        console.log(`site ${site._id} has new path ${path}`);

        promises.push(scorebook.updatePath(site._id, path, marker));
      }
    }

    return Promise.all(promises).then(function(results) {
      console.log(results);
      return {
        marker: marker,
        count: promises.length,
        results: results
      };
    });
  })
  .catch(function(err) {
    return Promise.reject({error: err});
  });
}

exports.main = updatePath;
