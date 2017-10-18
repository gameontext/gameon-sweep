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

class ScoreBook {
  /*
   * Create a class for keeping scores
   * Cloudant constructed elsewhere
   */
  constructor(cloudant, dbName) {
    this.cloudant = cloudant;
    this.dbName = dbName;
  }

  keepScore(site_id, score) {
    if (!this.dbName) {
      return Promise.reject('dbname is required.');
    }
    if (!score || typeof score !== 'object' ) {
      return Promise.reject('score object is required.');
    }

    var cloudantDb = this.cloudant.use(this.dbName);
    score.recorded = new Date().toISOString();
    score._id = site_id;

    // find a previous score for this document
    return getRevision(cloudantDb, site_id)
    .then(function(revision) {
      if ( revision ) {
        console.log(`${site_id} score revision is ${revision}`);
        score._rev = revision;
      } else {
        console.log(`New score for ${site_id}`);
      }

      // Store the new result as a new revision
      console.log(score)
      return insert(cloudantDb, score);
    })
    .catch(function(err) {
      console.log("error for ", id, " is ", err);
      Promise.reject(err);
    });
  }

  getScore(id) {
    var cloudantDb = this.cloudant.use(this.dbName);
    return get(cloudantDb, id);
  }

  getScores() {
    var cloudantDb = this.cloudant.use(this.dbName);
    return get_view(cloudantDb, 'scores', 'all_scores', {
      descending: true
    });
  }
}

/**
 * Create document in database.
 */
function insert(cloudantDb, score) {
  return new Promise(function(resolve, reject) {
    cloudantDb.insert(score, function(error, response) {
      if (!error) {
        console.log("success", response);
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
        console.log("success retrieving score for ", id);
        resolve(data);
      } else {
        console.log("error", err);
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
        console.log("error retrieving revision for ", id, err);
        reject(err);
      }
    })
  })
  .catch(function(err) {
    console.log("error working with cloudant for ", id, err);
    Promise.reject(err);
  });
}


function get_view(cloudantDb, design, view, options) {
  return new Promise(function(resolve, reject) {
    cloudantDb.view(design,view, options, function(err, data, rh) {
      if (!err) {
        resolve(data);
      } else {
        console.log("error retrieving revision for ", id, err);
        reject(err);
      }
    })
  })
  .catch(function(err) {
    console.log("error working with cloudant for ", id, err);
    Promise.reject(err);
  });
}


module.exports = ScoreBook;
