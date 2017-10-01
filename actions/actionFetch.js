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

/**
 * Fetch information about a room (and backing site) from the map.
 * Return promise that resolves to array of further actions based
 * on what is known about the room.
 */
function main (params) {
  let site_id = params.id || 'firstroom';
  let url = params.url || 'https://gameontext.org/map/v1/sites/';
  let sweep_id = params.sweep_id || '';
  let sweep_secret = params.sweep_secret || '';

  let mapClient = new MapClient(url, sweep_id, sweep_secret);
  return mapClient.fetchSite(site_id);
}

module.exports.fetch = main;
