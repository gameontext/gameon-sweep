/*******************************************************************************
 * Copyright (c) 2016, 2017 IBM Corp.
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
const openwhisk = require('openwhisk');
const Site = require('./Site.js');
const rp = require('request-promise');

function main (params) {
  var ow = openwhisk();
  var site_id = params.id || 'firstroom';
  var url = params.url || 'https://gameontext.org/map/v1/sites/';
  var site = new Site(interval);


  return site.fetchSite(url, site_id)
  .then(function (actions) {

    // Fork off all the nested actions...
    return Promise.all(actions)
    .then(function (results) {
      // All is well! rack up the points.
    })
    .catch(handleError);
  })
  .catch(handleError);
};

function handleError(err) {
  console.log(err);
  return Promise.reject(err);
}

module.exports.fetch = main;
