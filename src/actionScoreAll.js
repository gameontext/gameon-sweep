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
const MapClient = require('./MapClient.js');
const SlackNotification = require('./SlackNotification.js');
const openwhisk = require('openwhisk');

/**
 * Fetch information about a room (and backing site) from the map.
 * Return promise that resolves to array of further actions based
 * on what is known about the room.
 */
function scoreAll(params) {
  let url = params.url || 'https://gameontext.org/map/v1/sites/';

  let ow = openwhisk();
  let mapClient = new MapClient(url, params.sweep_id, params.sweep_secret);
  let slack = new SlackNotification(params.slack_url);

  params.marker = Date.now();
  return new Promise(function(resolve, reject) {
    let action_list = [];
    mapClient.fetchSites()
    .then(function(all_sites) {
      action_list.push(slack.scoreStart());

      // kick off a new asynchronous action for each site
      for(let i = 0; i < all_sites.length; i++ ) {
        let px = JSON.parse(JSON.stringify(params)); // copy / prevent mutation
        px.site = all_sites[i];

        action_list.push(ow.actions.invoke({
          actionName: 'sweep/actionEvaluate',
          params: px
        }));
      }

      return Promise.all(action_list).then(function (results) {
        return resolve({actions: action_list.length});
      });
    })
    .catch(function(err) {
      return reject({error: err});
    });
  });
}

exports.main = scoreAll;
