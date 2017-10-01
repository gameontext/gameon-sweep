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
const rp = require('request-promise');
const Promise = require("bluebird");
const RoomClient = require('./RoomClient.js')
const MapClient = require('./MapClient.js');

class Site {
  /*
   * Create a class for parsing site/room data.
   */
  constructor(interval) {
    this.interval = interval;
  }

  getActions(site_details) {
    var actions = [];

    // Additional information for checkDescription (site)
    var descParams = {};
    descParams.site = {};
    descParams.site.type = site_details.type;
    if ( site_details.owner ) {
      descParams.site.owner = site_details.owner;
      descParams.site.assigned = site_details.assignedOn;
    }
    if ( site_details.coord ) {
      descParams.site.path = Math.abs(site_details.coord.x) + Math.abs(site_details.coord.y);
    }

    // Construct appropriate sweep actions based on registration information

    // All sites have descriptions checked
    descParams.info = site_details.info || {};
    actions.push({
      actionName: 'sweep/checkDescription',
      params: descParams
    });

    // If room info is present, we do additional checks
    if ( site_details.info ) {
      if ( site_details.info.repositoryUrl ) {
        actions.push({
          actionName: 'sweep/checkRepository',
          params: {
            repositoryUrl: site_details.info.repositoryUrl,
            owner: site_details.owner }
        });
      }

      if ( site_details.info.connectionDetails ) {
        actions.push({
          actionName: 'sweep/checkEndpoint',
          params: {
            id: site_details._id,
            connectionDetails: site_details.info.connectionDetails }
        });
      }
    }

    return Promise.resolve(actions);
  }

  checkDescription(info, site) {
    var result = {};
    result.site = site;
    result.info = {
      checked: info,
      total: 0
    };

    if ( site.type === 'empty' ) {
      result.info.total = -5;
    } else {
      // name is a required attribute, if it isn't there, the end.
      result.info.empty = !(info && info.name && info.name.trim().length > 0);
      if ( !result.info.empty ) {
        // Check full name
        result.info.fullName = !!info.fullName && info.fullName.trim().length > 0;
        if ( result.info.fullName ) {
          result.info.total += 5; // Full Name is not empty -- 5
        }

        // Check description. More points for more words.
        if ( !!info.description ) {
          var numWords = info.description.trim().split(/\s+/).length;
          if ( numWords ) {
            result.info.description = numWords + ' word' + ( numWords == 1 ? '' : 's');
            result.info.total += numWords;
          } else {
            result.info.description = 'none';
          }
        } else {
          result.info.description = 'none';
        }

        // Check doors. More points for more (unique) doors
        if ( !!info.doors && Object.values(info.doors).length > 0 ) {
          var unique = Object.values(info.doors).filter(function(value, index, self) {
            return self.indexOf(value) === index;
          });

          if ( unique.length > 0 ) {
            result.info.doors = unique.length + ' unique door' + ( unique.length == 1 ? '' : 's');
            result.info.total += unique.length;
          } else {
            result.info.doors = 'none';
          }
        } else {
          result.info.doors = 'none';
        }
      }
    }

    return Promise.resolve(result);
  }

  checkRepository(url, owner) {
    var result = {};
    result.repository = {
      checked: url,
      total: 0
    };

    url = url.trim();

    // Test the URL itself (empty / valid )
    result.repository.empty = ( url.length === 0 );
    if ( result.repository.empty ) {
      return Promise.resolve(result);
    } else {
      // Only http or https, no query string or spaces
      result.repository.valid = /^(http|https):\/\/[^ "?]+$/.test(url);
      if ( result.repository.valid ) {
        result.repository.total += 2; // URL is valid and not-empty -- 2
      } else {
        return Promise.resolve(result);
      }
    }

    // Is it a cut and paste of one of ours that isn't ours?
    result.repository.gameontext = url.startsWith('https://github.com/gameontext/') ||
                                   url.startsWith('https://gameontext.org');
    if ( result.repository.gameontext && owner !== "game-on.org" ) {
      return Promise.resolve(result);  // skip our own repositories
    } else {
      result.repository.total += 2;    // It is not a Game On! URL (or we own it) -- 4
    }

    var options = {
      uri: url,
      headers: { 'User-Agent': 'Game On! Sweep' }
    };
    result.repository.get = {};

    // Fetch the page (retry on 503)
    return retry(options, result.repository.get, this.interval)
    .then(function (body) {
      result.repository.get = 'OK';
      result.repository.total += 6;    // It is not a Game On! URL -- 10

      // I give up with regex. This works.
      var pos1 = body.indexOf('<div class="repository-lang-stats-graph');
      var pos2 = body.indexOf('</div>', pos1)
      var languages = body.substring(pos1,pos2);

      // Super primitive scraping here. Relying on GitHub not to mess with this much
      result.repository.src = ( languages.indexOf('itemprop="keywords">Java') >= 0 || // covers JavaScript
                                languages.indexOf('itemprop="keywords">Go') >= 0 ||
                                languages.indexOf('itemprop="keywords">Groovy') >= 0 ||
                                languages.indexOf('itemprop="keywords">PHP') >= 0 ||
                                languages.indexOf('itemprop="keywords">Prolog') >= 0 ||
                                languages.indexOf('itemprop="keywords">Python') >= 0 ||
                                languages.indexOf('itemprop="keywords">Ruby') >= 0 ||
                                languages.indexOf('itemprop="keywords">Scala') >= 0 ||
                                languages.indexOf('itemprop="keywords">Swift') >= 0 );

      result.repository.GO_ref = ( body.indexOf('Game On') >= 0 ||
                                   body.indexOf('gameontext') >= 0 );

      if ( result.repository.src ) {
        result.repository.total += 20;    // It contains source -- max 30
      }

      if ( result.repository.GO_ref ) {
        result.repository.total += 20;    // It contains Game On! or gameontext -- max 50
      }

      // Resolve the promise w/ the result
      return Promise.resolve(result);
    })
    .catch(function(err) {
      result.repository.get.failed = true;
      if ( !err.response ) {
        console.log(err);
      } else {
        // No extra points, but include the error indicator for site issue
        result.repository.get.statusCode = err.response.statusCode;
        result.repository.get.statusMessage = err.response.statusMessage;
      }

      // Still a net positive! Resolve the promise, rather than rejecting
      return Promise.resolve(result);
    });
  }

  /*
   * Check the defined connection/endpoint details
   * Resolve w/ result when done or chain
   */
  checkEndpoint(id, connectionDetails) {
    var self = this;
    var result = {};
    result.endpoint = {
      checked: connectionDetails,
      total: 0
    };

    // type is a required attribute, if it isn't there, the end.
    result.endpoint.empty = !(connectionDetails && connectionDetails.type && connectionDetails.type.trim().length > 0);
    if ( result.endpoint.empty ) {
      return Promise.resolve(result);
    }

    if ( !!connectionDetails.healthUrl ) {
      // If a health endpoint is specified, check that first, service may need to wake up!
      return self.checkHealthEndpoint(connectionDetails, result)
      .then(function() {
        return self.checkWebSocket(id, connectionDetails, result)
      });
    } else {
      // no points, indicate that it wasn't here to test
      result.endpoint.health = {
        valid: false
      };
    }

    // onwards to the websocket
    return self.checkWebSocket(id, connectionDetails, result);
  }

  /*
   * Test Health endpoint. Always resolve, never reject
   */
  checkHealthEndpoint(connectionDetails, result) {
    result.endpoint.health = {};

    // Only http or https, no query string or spaces
    var url = connectionDetails.healthUrl.trim();
    result.endpoint.health.valid = /^(http|https):\/\/[^ "?]+$/.test(url);

    if ( result.endpoint.health.valid ) {
      result.endpoint.total += 5; // URL is valid and not-empty -- 5
      var options = {
        uri: url,
        headers: { 'User-Agent': 'Game On! Sweep' }
      };

      // Let's test the health endpoint
      return retry(options, result.endpoint.health, this.interval)
      .then(function(body) {
        // health check is awesome!
        result.endpoint.total += 20;
        jsonStatus(result, body, 'UP');
        return Promise.resolve(result);
      })
      .catch(function(err) {
        result.endpoint.health.failed = true;
        if ( !err.response ) {
          console.log('Health check failed: ' + err);
        } else {
          result.endpoint.health.statusCode = err.response.statusCode;
          result.endpoint.health.statusMessage = err.response.statusMessage;
          jsonStatus(result, err.response.body, 'DOWN');
        }
        return Promise.resolve(result);
      });
    }

    return Promise.resolve(result);
  }

  /*
   * Test the websocket endpoint url and/or token. Chained from checkEndpoint.
   * Resolve w/ result when done or chain
   */
  checkWebSocket(id, connectionDetails, result) {
    if ( !!connectionDetails.target ) {
      result.endpoint.target = {};

      // Is a token set?
      result.endpoint.target.token = !!connectionDetails.token;
      if ( result.endpoint.target.token ) {
        result.endpoint.total += 5; // Token for signed handshake
      }

      // target is only ws or wss, no query string or spaces
      var url = connectionDetails.target.trim();
      result.endpoint.target.valid = /^(ws|wss):\/\/[^ "?]+$/.test(url);
      if ( result.endpoint.target.valid ) {
        result.endpoint.total += 5; // URL is valid and not-empty -- 5

        // Try connection, test room
        var roomClient = new RoomClient(id, url, result.endpoint.target.token);
        return roomClient.tryRoom(result);
      }
    } else {
      // no points, indicate that it wasn't here to test
      result.endpoint.target = {
        valid: false
      };
    }
    return Promise.resolve(result);
  }

  totalScore(results) {
    var finalScore = {};

    // Final scoring record
    for(var i = 0; i < results.length; i++) {
      Object.assign(finalScore, results[i]);
    }

    // Grand total
    var total = 0;
    var values = Object.values(finalScore);
    for(let i  = 0; i < values.length; i++ ) {
      if ( values[i] && values[i].total ) {
        total += parseInt(values[i].total); // force number
      }
    }
    finalScore.total = total;

    console.log("RACK THEM UP! ", total);
    return finalScore;
  }
};

function retry(options, get, interval) {
  console.log("GET " + options.uri);
  get.attempts = 1;

  function try_once() {
    return rp(options)
    .catch(function(err) {
      if ( 503 === err.response.statusCode && get.attempts < 3 ) {
        get.attempts++;
        console.log("INCREMENT " + get.attempts);
        return Promise.delay(interval).then(try_once);
      } else {
        return Promise.reject(err);
      }
    });
  };
  return try_once();
}

function jsonStatus(result, body, match) {
  try {
    var health = JSON.parse(body);
    result.endpoint.health.json = true;
    result.endpoint.total += 5; // valid json

    result.endpoint.health.status = health.status;
    if ( match === health.status ) {
      result.endpoint.total += 5; // status: DOWN
    }
  }
  catch(parseErr) {
    result.endpoint.health.json = false;
  }
}


module.exports = Site;
