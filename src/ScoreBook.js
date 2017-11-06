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

class ScoreBook {
  /*
   * Create a class for keeping scores
   * Cloudant constructed elsewhere
   */
  constructor(cloudant, dbName) {
    assert.ok(cloudant, 'Please provide Cloudant instance');
    assert.ok(dbName, 'Cloudant DB must be specified');
    this.cloudant = cloudant;
    this.dbName = dbName;
  }

  keepScore(score) {
    if (!score || typeof score !== 'object' ) {
      return Promise.reject('score object is required.');
    }

    let site_id = score._id;
    let cloudantDb = this.cloudant.use(this.dbName);

    score.recorded = new Date().toISOString();

    // find a previous score for this document
    return getRevision(cloudantDb, site_id)
    .then(function(revision) {
      if ( revision ) {
        // console.log(`${site_id} score revision is ${revision}`);
        score._rev = revision;
      } else {
        // console.log(`New score for ${site_id}`);
      }

      // Store the new result as a new revision
      // console.log(score)
      return insert(cloudantDb, score)
      .then(function() { return score; });
    })
    .catch(function(err) {
      // console.log("error for ", site_id, " is ", err);
      Promise.reject(err);
    });
  }

  getScore(id) {
    let cloudantDb = this.cloudant.use(this.dbName);
    return get(cloudantDb, id);
  }

  updatePath(id, path, marker) {
    let cloudantDb = this.cloudant.use(this.dbName);
    return get(cloudantDb, id)
    .then(function(score) {
      if ( score.path && score.path !== path ) {
        console.log(`site ${id} has path ${path}`);
        score.path = path;
        score.marker = marker;
        return insert(cloudantDb, score);
      } else {
        return Promise.resolve({
          id: id,
          path: path,
          score: score.path,
          status: "ok"
        });
      }
    });
  }

  getScores() {
    console.log("Fetch all scores");
    let cloudantDb = this.cloudant.use(this.dbName);
    return get_view(cloudantDb, 'scores', 'all_scores', {
    });
  }

  /*
   * Yes! this is some kind of deranged bubble sort.
   * Single pass, as we actually swap sites in the DB
   * when we're done. We're relying on _many subsequent
   * invocations to eventually get sites sorted-ish.
   */
  findSiteSwaps(all_scores) {
    // Filter out firstRoom and rooms with unassigned/null values
    let scores = all_scores.filter(elem => elem.id !== 'firstroom' );
    // Scores come back: [ { id: id, key: score, value: path }, ... ]

    // keep track of rooms eligible for swapping
    let swap_eligible = {};
    for(let i = 0; i < scores.length; i++) {
      swap_eligible[scores[i].id] = 1;
    }

    let result = {
      swaps: [],
      high: (scores[scores.length - 1].key),
      low: 0,
      median: 0,
      first_quartile: 0,
      third_quartile: 0,
      non_empty: 0
    };

    let i = 0;
    let j = 0;

    // iterate by ascending score..
    for(i; i < scores.length; i++) {
      let score1 = scores[i];

      // ignore empty rooms when calculating stats
      if ( result.median === 0  && score1.key >= 0 ) {
        result.low = score1.key; // first non-empty room
        result.non_empty = scores.length - i +1;
        console.log("scores.length", scores.length);
        console.log("first non-empty i", i);
        console.log("number of non-empty rooms", result.non_empty);

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
      if ( !!swap_eligible[score1.id] ) {
        // iterate from high score to low score: favor big jumps
        for(let j = scores.length - 1; j >= 0; j--) {
          let score2 = scores[j];

          if ( score1.key >= score2.key ) {
            // done with this. We're now looking at scores smaller than ours.
            //console.log(`LAST: [${i}] ${score1.key} ${score1.value} --> [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);
            break;
          } else if ( !swap_eligible[score2.id] ) {
            continue;
          } else if ( score1.value == score2.value ) {
            //console.log(`SKIP: [${i}] ${score1.key} ${score1.value} --> [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);
            continue;
          } else if ( score1.value < score2.value ) {
            console.log(`SWAP: [${i}] ${score1.key} ${score1.value} <-- [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);
            // remove scores from eligibility
            delete swap_eligible[score1.id];
            delete swap_eligible[score2.id];
            result.swaps.push([score1, score2]);
            break;
          } else {
            //console.log(`????: [${i}] ${score1.key} ${score1.value} --> [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);
          }
        }
      }
    }

    return result;
  }

  getOrphanScores(known_ids) {
    let cloudantDb = this.cloudant.use(this.dbName);
    // console.log("Clear deleted sites, but definitely not these: ", Object.keys(known_ids).length);

    return get_view(cloudantDb, 'scores', 'all_scores', {})
    .then(function(all_scores) {
      // console.log("Comparing sites against known scores: ", all_scores.rows.length);

      // Filter out any score that matches a site/room we know exists
      let scores = all_scores.rows.filter( elem => !known_ids[elem.id]);
      console.log('Orphan scores: ', scores.length);

      return Promise.resolve(scores);
    })
    .catch(function(err) {
      console.log("error: ", err)
    });
  }

  deleteScore(id) {
    let cloudantDb = this.cloudant.use(this.dbName);
    // find a previous score for this document
    return getRevision(cloudantDb, id)
    .then(function(revision) {
      return destroy(cloudantDb, id, revision);
    });
  }
}

/**
 * Create document in database.
 */
function insert(cloudantDb, score) {
  return new Promise(function(resolve, reject) {
    // console.log("insert: " + score);
    cloudantDb.insert(score, function(error, response) {
      if (!error) {
        // console.log("success", response);
        resolve(response);
      } else {
        console.log("error", error);
        reject(error);
      }
    });
  })
  .catch(function(err) {
    Promise.reject(err);
  });
}

function get(cloudantDb, id) {
  return new Promise(function(resolve, reject) {
    cloudantDb.get(id, function(err, data) {
      if (!err) {
        // console.log("success retrieving score for ", id);
        resolve(data);
      } else if ( err.statusCode === 404 ) {
        // New site, no score. All is well.
        resolve({
          _id: id
        });
      } else {
        console.log("error", err);
        return reject(err);
      }
    })
  })
  .catch(function(err) {
    Promise.reject(err);
  });
}

function getRevision(cloudantDb, id) {
  // head function returns the HTTP Headers containing a minimal amount of information about the
  // specified document. The method supports the same query arguments as the GET /{db}/{docid} method,
  // but only the header information (including document size, and the revision as an ETag), is returned.
  return new Promise(function(resolve, reject) {
    cloudantDb.head(id, function(err, data, rh) {
      if (!err) {
        resolve(JSON.parse(rh.etag));
      } else if (err.statusCode === 404) {
        resolve('');
      } else {
        // console.log("error retrieving revision for ", id, err);
        reject(err);
      }
    })
  })
  .catch(function(err) {
    // console.log("error working with cloudant for ", id, err);
    Promise.reject(err);
  });
}

function get_view(cloudantDb, design, view, options) {
  return new Promise(function(resolve, reject) {
    cloudantDb.view(design,view, options, function(err, data, rh) {
      if (!err) {
        resolve(data);
      } else {
        // console.log("error retrieving revision for ", id, err);
        reject(err);
      }
    })
  })
  .catch(function(err) {
    // console.log("error working with cloudant for ", id, err);
    Promise.reject(err);
  });
}

function destroy(cloudantDb, id, rev) {
  return new Promise(function(resolve, reject) {
    cloudantDb.destroy(id, rev, function(err, data) {
      if (!err) {
        // console.log("success retrieving score for ", id);
        resolve(data);
      } else {
        console.log("error", err);
        return reject(err);
      }
    })
  })
  .catch(function(err) {
    Promise.reject(err);
  });
}

module.exports = ScoreBook;
