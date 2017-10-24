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
      console.log(score);
      score.path = path;
      score.marker = marker;
      return insert(cloudantDb, score);
    });
  }

  getScores() {
    let cloudantDb = this.cloudant.use(this.dbName);
    return get_view(cloudantDb, 'scores', 'all_scores', {
      // descending: true
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
    // highest score is first.

    // keep track of rooms eligible for swapping
    let swap_eligible = {};
    for(let i = 0; i < scores.length; i++) {
      swap_eligible[scores[i].id] = 1;
    }

    let swaps = [];
    let i = 0;
    let j = 0;

    // iterate by ascending score..
    for(i; i < scores.length; i++) {
      let score1 = scores[i];

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
            console.log(`SWAP: [${i}] ${score1.key} ${score1.value} --> [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);
            // remove scores from eligibility
            delete swap_eligible[score1.id];
            delete swap_eligible[score2.id];
            swaps.push([score1, score2]);
            break;
          } else {
            //console.log(`????: [${i}] ${score1.key} ${score1.value} --> [${j}] ${score2.key} ${score2.value} -- ${score1.id}, ${score2.id}`);
          }
        }
      }
    }

    return swaps;
  }
}

/**
 * Create document in database.
 */
function insert(cloudantDb, score) {
  return new Promise(function(resolve, reject) {
    console.log("insert: " + score);
    cloudantDb.insert(score, function(error, response) {
      if (!error) {
        // console.log("success", response);
        resolve(response);
      } else {
        // console.log("error", error);
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
      } else {
        // console.log("error", err);
        reject(err);
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


module.exports = ScoreBook;
