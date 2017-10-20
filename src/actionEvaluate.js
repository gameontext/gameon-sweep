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

const SiteEvaluator = require('./SiteEvaluator.js');
const MapClient = require('./MapClient.js');
const ScoreBook = require('./ScoreBook.js');

/**
 * Fetch information about a room (and backing site) from the map.
 * Return promise that resolves to array of further actions based
 * on what is known about the room.
 */
function siteScore (params) {
  let site_info = params.site || { '_id': 'firstroom' };

  let sweep_id = params.sweep_id || '';
  let sweep_secret = params.sweep_secret || '';
  assert.ok(sweep_id, 'Please provide the sweep_id');
  assert.ok(sweep_secret, 'Please provide the sweep_secret');

  let url = params.url || 'https://gameontext.org/map/v1/sites/';
  let mapClient = new MapClient(url, sweep_id, sweep_secret);

  let cloudant_url = params.cloudant_url || process.env.CLOUDANT_URL;
  assert.ok(cloudant_url, 'Please provide the cloudant_url');

  let cloudant = Cloudant({url: cloudant_url});
  let cloudant_db = params.cloudant_db || 'sweep_score';

  return mapClient.fetchSite(site_info)
  .then(function(site_details) {
    params.site = site_details;
    params.progress = 'fetch';
    params.marker = params.marker || Date.now();

    let evaluator = new SiteEvaluator(params);
    let scorebook = new ScoreBook(cloudant, cloudant_db);

    return evaluator.checkDescription()
    .then(function(params) { return evaluator.checkRepository()})
    .then(function(params) { return evaluator.checkEndpoint()})
    .then(function(params) { return evaluator.totalScore()})
    .then(function(params) { return scorebook.keepScore(params)});
  })
  .catch(function(err) {
    return Promise.reject({
      _id: site_info._id,
      error: err});
  });
}

exports.main = siteScore;
