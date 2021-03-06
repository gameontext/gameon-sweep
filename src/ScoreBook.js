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
const assert = require('assert');
const nano = require('nano');

class ScoreBook {
  constructor(params) {
    params = params || {};

    this.env = params.NODE_ENV || process.env.NODE_ENV;

    const cloudant_url = params.cloudant_url || process.env.CLOUDANT_URL;
    assert.ok(cloudant_url, 'Please provide the cloudant_url');

    const dbName = params.cloudant_db || 'sweep_score';

    const opts = {
      url: cloudant_url,
      parseUrl: false
    };

    if ( this.env === 'unittest' ) {
      this.scoreDb = params.scoreDb;
    } else {
      if ( this.env !== 'production') {
        opts.requestDefaults = {
          strictSSL: false
        };
      }

      this.scoreDb = nano(opts).use(dbName);
    }
  }

  keepScore(score, marker) {
    assert.ok(typeof score === 'object', 'Score must be an object');
    assert.ok(score._id, 'Score must have an id');

    score.recorded = new Date().toISOString();

    // find a previous score for this document
    return getRevision(this.scoreDb, score._id)
    .then((revision) => {
      let status = 'score-ok';
      if ( revision ) {
        score._rev = revision;
      } else {
        status = 'score-new';
      }

      // return  inserted score
      return this.scoreDb.insert(score)
      .then(() => {
        return Promise.resolve({
          marker: marker,
          id: score._id,
          status: status,
          total: score.total
        });
      })
    })
    .catch((error) => {
      if ( error.statusCode === 404 ) {
        return Promise.resolve({
          marker: marker,
          id: score._id,
          status: 'path-deleted'
        });
      } else {
        return Promise.reject({
          marker: marker,
          id: score._id,
          status: 'score-error',
          error: parseError(error)
        });
      }
    });
  }

  getScore(id) {
    return this.scoreDb.get(id);
  }

  updatePath(id, path, marker) {
    return this.scoreDb.get(id)
    .then((score) => {
      if ( score.path !== path ) {
        console.log(`site ${id} has path ${score.path}, should have ${path}`);
        score.path = path;
        score.marker = marker;
        return this.scoreDb.insert(score)
        .then(() => {
          return Promise.resolve({
            marker: marker,
            id: id,
            status: 'path-update'
          });
        });
      } else {
        return Promise.resolve({
          marker: marker,
          id: id,
          status: 'path-ok'
        });
      }
    })
    .catch((error) => {
      if ( error.statusCode === 404 ) {
        return Promise.resolve({
          marker: marker,
          id: id,
          status: 'path-deleted'
        });
      } else {
        return Promise.reject({
          marker: marker,
          id: id,
          status: 'path-error',
          error: parseError(error)
        });
      }
    });
  }

  getScores() {
    return this.scoreDb.view('scores', 'all_scores')
    .then((view) => { return view.rows; });
  }

  getPaths(){
    return this.scoreDb.view('scores', 'by_path')
    .then((view) => { return view.rows; });
  }

  /*
   * Yes! this is some kind of deranged bubble sort.
   * Single pass, as we actually swap sites in the DB
   * when we're done. We're relying on _many subsequent
   * invocations to eventually get sites sorted-ish.
   */
  findSiteSwaps(all_scores, paths) {
    // Filter out firstRoom and rooms with unassigned/null values
    let scores = all_scores.filter(elem => elem.id !== 'firstroom' );
    // Scores come back: [ { id: id, key: score, value: path }, ... ]
    // Paths are the opposite [ { id: id, key: path, value: score }, .. ]

    // keep track of rooms eligible for swapping
    let swap_eligible = {};
    for(let i = 0; i < scores.length; i++) {
      swap_eligible[scores[i].id] = 1;
    }

    let result = {
      swaps: [],
      longest_path: (paths[paths.length - 1].key),
      high: (scores[scores.length - 1].key),
      low: 0,
      median: 0,
      first_quartile: 0,
      third_quartile: 0,
      non_empty: 0
    };

    // iterate by ascending score..
    for(let i = 0; i < scores.length; i++) {
      let score = scores[i];


      // ignore empty rooms when calculating stats
      if ( result.median === 0 && score.key >= 0 ) {
        console.log("low score", i, score);
        console.log("first non-empty i", i);
        result.non_empty = scores.length - i +1;
        console.log("number of non-empty rooms", result.non_empty);
        result.low = score.key; // first non-empty room
        console.log("scores.length", scores.length);

        let median_x = Math.floor(result.non_empty / 2) + i;
        let quart_x = Math.floor(result.non_empty / 4);
        console.log("median index", median_x, "; quartile +/-", quart_x);

        result.median = scores[median_x].key; // find the middle...
        result.first_quartile = scores[median_x - quart_x].key;
        result.third_quartile = scores[median_x + quart_x].key;
        console.log("first", result.first_quartile);
        console.log("median", result.median);
        console.log("third", result.third_quartile);
      }

      // if this score is still eligible for swapping, then..
      if ( !!swap_eligible[score.id] ) {
        //console.log(`****: [${i}] ${score.key} ${score.value}`);
        // Iterate by paths: lower paths are closer to the center
        for(let j = 1; j < paths.length; j++) {
          let path = paths[j];

          if ( score.id === path.id || score.value === path.key ) {
            continue;
          } else if ( !!swap_eligible[path.id] ) {
            if ( score.value < path.key && score.key < path.value ) {
              console.log(`SWAP: [${i}] ${score.key}pts ${score.value} <-- ${path.value}pts ${path.key} -- ${score.id}, ${path.id}`);
              delete swap_eligible[score.id];
              delete swap_eligible[path.id];
              result.swaps.push([{id: score.id, path: score.value, score: score.key},
                                 {id: path.id,  path: path.key,    score: path.value}]);
              break;
            }
          }
        }
      }
    }

    return result;
  }

  getOrphanScores(known_ids) {
    return this.scoreDb.view('scores', 'all_scores')
    .then(function(all_scores) {
      // Filter out any score that matches a site/room we know exists
      let orphans = all_scores.rows.filter( elem => !known_ids[elem.id]);
      return Promise.resolve(orphans);
    });
  }

  deleteScore(id) {
    // find a previous score for this document
    return getRevision(this.scoreDb, id)
    .then((revision) => {
      return this.scoreDb.destroy(id, revision);
    });
  }
}

function getRevision(scoreDb, id) {
  // head function returns the HTTP Headers containing a minimal amount of information about the
  // specified document. The method supports the same query arguments as the GET /{db}/{docid} method,
  // but only the header information (including document size, and the revision as an ETag), is returned.
  return scoreDb.head(id).then((headers) => {
    return Promise.resolve(JSON.parse(headers.etag));
  });
}

function parseError(error) {
  console.log(error);
  return error.message ? error.message : error;
}

module.exports = ScoreBook;
