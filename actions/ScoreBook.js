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
    score.site_id = site_id;

    return insert(cloudantDb, score);
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

module.exports = ScoreBook;
