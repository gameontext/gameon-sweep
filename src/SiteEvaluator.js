/*******************************************************************************
 * Copyright (c) 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
const Promise = require("bluebird");
const assert = require('assert');
const rp = require('request-promise');
const util = require('util');
const RoomClient = require('./RoomClient.js');

class SiteEvaluator {
  /*
   * Create a class for parsing site/room data.
   */
  constructor(params) {
    this.params = params || {};
    assert.ok(this.params.site, 'Please provide a site to evaluate');

    this.params.score = params.score || {};
    this.interval = params.interval || 1000; // 1s;
  }

  evaluate() {
    return Promise.all([this.checkDescription(), this.checkEndpoint(), this.checkRepository()])
    .then(() => { return this.totalScore(); })
    .tap((data) => { console.log(util.inspect(data, { maxArrayLength: null, depth: null})); });
  }

  checkDescription() {
    let site = this.params.site;

    this.params.progress = 'desc';
    let score = this.params.score.info = {};
    score.total = 0;

    if ( site.coord ) {
      this.params.path = Math.abs(site.coord.x) + Math.abs(site.coord.y);
    }

    if ( site.type === 'empty' ) {
      score.total = -5;
    } else if ( site.info ) {
      score.checked = site.info;

      // name is a required attribute, if it isn't there, the end.
      score.nameDefined = (!!site.info.name && site.info.name.trim().length > 0);
      if ( score.nameDefined ) {
        // Check full name
        score.fullName = !!site.info.fullName && site.info.fullName.trim().length > 0;
        if ( score.fullName ) {
          score.total += 5; // Full Name is not empty -- 5
        }

        // Check description. More points for more _unique_ words.
        if ( !!site.info.description ) {
          let words = site.info.description.trim().split(/\s+/);
          let uniqueWords = words.filter(onlyUnique);
          if ( uniqueWords.length > 0 ) {
            score.description = uniqueWords.length + ' word' + ( uniqueWords.length == 1 ? '' : 's');
            score.total += uniqueWords.length;
          } else {
            score.description = 'no unique words after trim/split';
          }
        } else {
          score.description = 'none';
        }

        // Check doors. More points for more (unique) doors
        if ( !!site.info.doors ) {
          let descriptions = Object.values(site.info.doors);
          let uniqueDoors = descriptions.filter(onlyUnique);
          if ( uniqueDoors.length > 0 ) {
            score.doors = uniqueDoors.length + ' unique door' + ( uniqueDoors.length == 1 ? '' : 's');
            score.total += uniqueDoors.length;
          } else {
            score.doors = 'no unique door names';
          }
        } else {
          score.doors = 'none';
        }
      }
    }

    return Promise.resolve(score);
  }

  checkRepository() {
    this.params.progress = 'repo';
    this.params.score.repository = {};

    let site = this.params.site;
    let score = this.params.score.repository;
    score.total = 0;

    if ( !site.info || !site.info.repositoryUrl ) {
      score.empty = true;
      // no URL to check. All done.
      return Promise.resolve(score);
    }

    let url = score.checked = site.info.repositoryUrl;
    url = url.trim();

    // Test the URL itself (empty / valid)
    score.empty = ( url.length === 0 );
    if ( score.empty ) {
      return Promise.resolve(score);
    } else {
      // Only http or https, no query string or spaces
      score.valid = /^(http|https):\/\/[^ "?]+$/.test(url);
      if ( score.valid ) {
        score.total += 2; // URL is valid and not-empty -- 2
      } else {
        return Promise.resolve(this.params);
      }
    }

    // Is it a cut and paste of one of ours that isn't ours?
    score.gameontext = url.startsWith('https://github.com/gameontext/') ||
                        url.startsWith('https://gameontext.org');
    if ( score.gameontext && site.owner !== "game-on.org" ) {
      return Promise.resolve(score);  // skip our own repositories
    } else {
      score.total += 2;    // It is not a Game On! URL (or we own it) -- 4
    }

    let options = {
      uri: url,
      headers: { 'User-Agent': 'Game On! Sweep' }
    };
    score.get = {};

    // Fetch the page (retry on 503)
    return retry(options, score.get, this.interval)
    .then((body) => {
      score.get = 'OK';
      score.total += 6;    // It is not a Game On! URL -- 10

      // I give up with regex. This works.
      let pos1 = body.indexOf('<div class="repository-lang-stats-graph');
      let pos2 = body.indexOf('</div>', pos1)
      let languages = body.substring(pos1,pos2);

      // Super primitive scraping here. Relying on GitHub not to mess with this much
      score.src = ( languages.indexOf('itemprop="keywords">Java') >= 0 || // covers JavaScript
                                languages.indexOf('itemprop="keywords">Go') >= 0 ||
                                languages.indexOf('itemprop="keywords">Groovy') >= 0 ||
                                languages.indexOf('itemprop="keywords">PHP') >= 0 ||
                                languages.indexOf('itemprop="keywords">Prolog') >= 0 ||
                                languages.indexOf('itemprop="keywords">Python') >= 0 ||
                                languages.indexOf('itemprop="keywords">Ruby') >= 0 ||
                                languages.indexOf('itemprop="keywords">Scala') >= 0 ||
                                languages.indexOf('itemprop="keywords">Swift') >= 0 );

      score.GO_ref = ( body.indexOf('Game On') >= 0 ||
                                   body.indexOf('gameontext') >= 0 );

      if ( score.src ) {
        score.total += 20;    // It contains source -- max 30
      }

      if ( score.GO_ref ) {
        score.total += 20;    // It contains Game On! or gameontext -- max 50
      }

      // Resolve the promise w/ the result
      return Promise.resolve(score);
    })
    .catch((err) => {
      score.get.failed = true;
      if ( !err.response ) {
        score.get.error = handleError(err);
      } else {
        // No extra points, but include the error indicator for site issue
        score.get.statusCode = err.response.statusCode;
        score.get.statusMessage = err.response.statusMessage;
      }

      // Still a net positive! Resolve the promise, rather than rejecting
      return Promise.resolve(score);
    });
  }

  /*
   * Check the defined connection/endpoint details
   * Resolve w/ result when done or chain
   */
  checkEndpoint() {
    let self = this;
    let site = this.params.site;

    this.params.progress = 'endpoint';
    this.params.score.endpoint = {};
    let score = this.params.score.endpoint;
    score.total = 0;

    if ( !site.info || !site.info.connectionDetails ) {
      score.empty = true;
      // no connectionDetails to check. All done.
      return Promise.resolve(self.params);
    }

    let connectionDetails = site.info.connectionDetails;

    // type is a required attribute, if it isn't there, the end.
    score.empty = !(connectionDetails.type && connectionDetails.type.trim().length > 0);
    if ( score.empty ) {
      return Promise.resolve(self.params);
    }

    if ( !!connectionDetails.healthUrl ) {
      // If a health endpoint is specified, check that first, service may need to wake up!
      return self.checkHealthEndpoint(connectionDetails, score)
      .then(() => self.checkWebSocket(connectionDetails, score));
    } else {
      // no points, indicate that it wasn't here to test
      score.health = {
        valid: false
      };
    }

    // onwards to the websocket
    return self.checkWebSocket(connectionDetails, score);
  }

  /*
   * Test Health endpoint. Always resolve, never reject
   */
  checkHealthEndpoint(connectionDetails, score) {
    this.params.progress = 'health';
    score.health = {};

    // Only http or https, no query string or spaces
    let url = connectionDetails.healthUrl.trim();
    score.health.valid = /^(http|https):\/\/[^ "?]+$/.test(url);

    if ( score.health.valid ) {
      score.total += 5; // URL is valid and not-empty -- 5
      let options = {
        uri: url,
        headers: { 'User-Agent': 'Game On! Sweep' }
      };

      // Let's test the health endpoint
      return retry(options, score.health, this.interval)
      .then(function(body) {
        // health check is awesome!
        score.total += 20;
        jsonStatus(score, body, 'UP');
        return Promise.resolve(true);
      })
      .catch(function(err) {
        score.health.failed = true;
        if ( !err.response ) {
          score.health.error = handleError(err);
        } else {
          score.health.statusCode = err.response.statusCode;
          score.health.statusMessage = err.response.statusMessage;
          jsonStatus(score, err.response.body, 'DOWN');
        }
        return Promise.resolve(true);
      });
    }

    return Promise.resolve(true);
  }

  /*
   * Test the websocket endpoint url and/or token. Chained from checkEndpoint.
   * Resolve w/ result when done or chain
   */
  checkWebSocket(connectionDetails, score) {
    let self = this;
    let id = this.params.site._id || 'id';
    this.params.progress = 'target';

    if ( !!connectionDetails.target ) {
      score.target = {};

      // Is a token set?
      score.target.token = !!connectionDetails.token;
      if ( score.target.token ) {
        score.total += 5; // Token for signed handshake
      }

      // target is only ws or wss, no query string or spaces
      let url = connectionDetails.target.trim();
      score.target.valid = /^(ws|wss):\/\/[^ "?]+$/.test(url);
      if ( score.target.valid ) {
        score.total += 5; // URL is valid and not-empty -- 5

        // Try connection, test room
        let roomClient = new RoomClient(id, url, score.target.token);
        return roomClient.tryRoom(self.params);
      }
    } else {
      // no points, indicate that it wasn't here to test
      score.target = {
        valid: false
      };
    }

    return Promise.resolve(self.params);
  }

  totalScore() {
    let results = this.params.score || {};

    // Grand total
    let total = 0;
    let values = Object.values(results);
    for(let i  = 0; i < values.length; i++ ) {
      if ( values[i] && values[i].total ) {
        total += parseInt(values[i].total); // force number
      }
    }
    results._id = this.params.site._id;
    results.total = total;

    // Copy extras into the result.
    results.marker = this.params.marker;
    results.path = this.params.path;
    results.type = this.params.site.type;

    const name = this.params.site.info ? this.params.site.info.name : results._id;

    console.log(`RACK THEM UP! ${name} has earned ${total} points`);
    return results;
  }
};

function handleError(error) {
  console.log("Request error: " + error);
  if ( error.message ) {
    return error.message;
  }
  return error;
}

function retry(options, get, interval) {
  get.attempts = 1;
  get.req = "GET " + options.uri;

  function try_once() {
    return rp(options)
    .catch(function(err) {
      if ( ! err.response ) {
        return Promise.reject(err);
      } else if ( err.response.statusCode === 503 && get.attempts < 3 ) {
        get.attempts++;
        return Promise.delay(interval).then(try_once);
      }
    });
  }

  return try_once();
}

function jsonStatus(score, body, match) {
  try {
    let health = JSON.parse(body);
    score.health.json = true;
    score.total += 5; // valid json

    score.health.status = health.status;
    if ( match === health.status ) {
      score.total += 5; // status: DOWN
    }
  }
  catch(parseErr) {
    score.health.json = false;
  }
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

module.exports = SiteEvaluator;
