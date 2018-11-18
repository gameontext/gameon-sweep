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
const Promise = require("bluebird");
const crypto = require('crypto');
const rp = require('request-promise');
const assert = require('assert');

function signRequest(options, sweepId, sweepSecret) {
  options.headers = {
    'User-Agent': 'Game On! Sweep',
    'Content-Type': 'application/json'
  };

  if (sweepId && sweepSecret) {
    if ( !options.method ) {
      options.method = 'GET';
    }

    let pos = options.uri.indexOf('/', 8); // skip https://
    let uri = options.uri.substring(pos);

    options.headers['gameon-id'] = sweepId;

    let now = new Date();
    let dateString = now.toUTCString();
    options.headers['gameon-date'] = dateString;

    let fullHmac = crypto.createHmac('sha256', sweepSecret)
                  .update(options.method)
                  .update(uri)
                  .update(sweepId)
                  .update(dateString);

    if ( options.body ) {
      let hash = crypto.createHash('sha256')
                       .update(options.body).digest('base64');
      options.headers['gameon-sig-body'] = hash;
      fullHmac.update(hash);
    }

    let hash = fullHmac.digest('base64');
    options.headers['gameon-signature'] = hash;
  }

  return options;
}

function handleError(error) {
  if ( error.response ) {
    return Promise.reject({
      statusCode: error.response.statusCode,
      statusMessage: error.response.statusMessage,
      message: error.message
    });
  } else {
    return Promise.reject(error);
  }
}

class MapClient {
  constructor(params) {
    params = params || {};

    let base = params.base || process.env.MAP_URL || 'https://gameontext.org/map/v1/';
    this.base = base.replace(/\/?$/, '/');

    this.sites_url = base + 'sites/';
    this.swap_url = base + 'swapSites';

    this.sweepId = params.sweep_id || process.env.SWEEP_ID;
    assert.ok(this.sweepId, 'Please provide the sweep_id');

    this.sweepSecret = params.sweep_secret || process.env.SWEEP_SECRET;
    assert.ok(this.sweepSecret, 'Please provide the sweep_secret');
  }

  fetchSites() {
    let options = {
      uri: this.sites_url,
      json: true,
    };
    signRequest(options, this.sweepId, this.sweepSecret);

    // Fetch the site description from the Map
    return rp(options)
    .catch((error) => { return handleError(error); });
  }

  fetch(id) {
    return this.fetchSite({ _id: id });
  }

  /*
   * Fetch Room/Site information from the map service
   */
  fetchSite(site) {
    if ( site.info && site.info.connectionDetails ) {
      return Promise.resolve(site);
    }

    let options = {
      uri: this.sites_url + site._id,
      json: true,
    };
    signRequest(options, this.sweepId, this.sweepSecret);

    // Fetch the site description from the Map
    return rp(options)
    .catch(handleError);
  }

  swap_sites(site_1, site_2) {
    let options = {
      uri: this.swap_url,
      json: false,
      method: 'PUT',
      body: JSON.stringify({
        site1 : {
          id: site_1._id,
          coord:  site_1.coord
        },
        site2: {
          id: site_2._id,
          coord:  site_2.coord
        }
      })
    };
    signRequest(options, this.sweepId, this.sweepSecret);

    return rp.put(options)
    .catch(handleError);
  }
}

module.exports = MapClient;
