/*******************************************************************************
 * Copyright (c) 2018 IBM Corp.
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

const openwhisk = require('openwhisk');

const MapClient = require('./MapClient.js');
const ScoreBook = require('./ScoreBook.js');
const SiteEvaluator = require('./SiteEvaluator.js');
const SlackNotification = require('./SlackNotification.js');

function action(ow, env, action, px, promise) {
  if ( env === 'production' ) {
    console.log(`Action ${action}`);
    return ow.actions.invoke({
      actionName: action,
      params: px
    });
  } else {
    return promise;
  }
}

function parseError(error) {
  console.log(error);
  return error.message ? error.message : error;
}

class SweepActions {
  constructor(params) {
    this.params = params || {};
    this.params.marker = this.params.marker || Date.now();
    this.slack = new SlackNotification(this.params);
    this.scorebook = new ScoreBook(this.params);
    this.mapClient = new MapClient(this.params);
    this.env = this.params.NODE_ENV || process.env.NODE_ENV;
    this.debug = this.params.debug || false;

    if ( this.env === 'production' ) {
      this.ow = openwhisk();
    } else {
      this.ow = {};
    }
  }

  invoke() {
    assert.ok(this.params.invoke, 'Specify action to invoke');

    switch(this.params.invoke) {
      case 'traverseSwap':
        return this.traverse()
        .then((result1) => {
          return this.compareAll()
          .then((result2) => Promise.resolve({
            traverse: result1,
            compare: result2
          }));
        });
      default:
        throw new Error(`Unkown invoke target ${this.params.invoke}`);
    }
  }

  scoreAll() {
    return this.mapClient.fetchSites()
    .then((all_sites) => {
      let action_list = [];

      // kick off a new asynchronous action for each site
      for(let i = 0; i < all_sites.length; i++ ) {
        let px = JSON.parse(JSON.stringify(this.params)); // copy / prevent mutation
        px.site = all_sites[i];
        action_list.push(action(this.ow, this.env, 'sweep/actionEvaluate', px,
          Promise.delay(10000*i)
          .then(() => { return this.evaluate(px.site); })));
      }

      // Note how many actions
      action_list.unshift(Promise.resolve({status: `${action_list.length} actions`}));
      action_list.push(this.slack.scoring(action_list.length));

      return Promise.all(action_list);
    })
    .then((result) => { return this.filterResult(result); })
    .then((result) => Promise.resolve({
      status: 'scoreall-ok',
      actions: result
    }))
    .catch((error) => Promise.reject({
      status: 'scoreall-error',
      error: parseError(error),
      params: this.params
    }));
  }

  evaluate(site) {
    let site_info = site || this.params.site || { '_id': 'firstroom' };

    return this.mapClient.fetchSite(site_info)
    .then((site_details) => {
      let score_info = {
        site: site_details,
        marker: this.params.marker
      };

      return new SiteEvaluator(score_info).evaluate()
      .then((results) => {
        //console.log(results);
        return this.scorebook.keepScore(results, this.params.marker);
      });
    })
    .catch((err) => {
      return {
        status: 'evaluate-error',
        _id: site_info._id,
        marker: this.params.marker,
        error: parseError(err)
      };
    });
  }

  compareAll() {
    return this.scorebook.getScores()
    .then((all_scores) => {
      return this.scorebook.getPaths()
      .then((all_paths) => {
        let action_list = [];
        let stats = this.scorebook.findSiteSwaps(all_scores, all_paths);

        action_list.push(this.slack.swapStats(
          `All sorted. Out of ${stats.non_empty} rooms: \n`
          + ` :+1: The high score was ${stats.high}\n`
          + ` :ok_hand: The third quartile score was ${stats.third_quartile}\n`
          + ` :v: The median score was ${stats.median}\n`
          + ` :point_up: The first quartile score was ${stats.first_quartile}\n`
          + ` :-1: The low score was ${stats.low}\n`
          + ` :running: The longest path is ${stats.longest_path}`
        ));

        for (let i = 0; i < stats.swaps.length; i++) {
          let px = JSON.parse(JSON.stringify(this.params)); // copy / prevent mutation
          px.compare = {
            a: stats.swaps[i][0],
            b: stats.swaps[i][1]
          };
          action_list.push(action(this.ow, this.env, 'sweep/actionCompare', px, this.compare(px.compare.a, px.compare.b)));
        }

        // Note how many actions
        action_list.unshift(Promise.resolve({status: `${action_list.length} actions`}));
        return Promise.all(action_list);
      });
    })
    .then((result) => { return this.filterResult(result); })
    .then((result) => Promise.resolve({
      status: 'compareAll-ok',
      actions: result
    }))
    .catch((error) => Promise.reject({
      status: 'compareAll-error',
      error: parseError(error),
      params: this.params
    }));
  }

  compare(a, b) {
    a = a || this.params.compare.a;
    b = b || this.params.compare.b;
    assert.ok(a && b, 'Specify two sites to swap');

    return this.mapClient.fetch(a.id)
    .then((a_site) => {
      a.site = a_site;
      let path = Math.abs(a.site.coord.x) + Math.abs(a.site.coord.y);
      if ( path !== a.path ) {
        return Promise.resolve({ id: a.id, status: 'compare-ok', skip: true,
          msg: `SKIPPED: ${path} != ${a.path} for ${a.id}` });
      }
      return this.mapClient.fetch(b.id)
      .then((b_site) => {
        b.site = b_site;
        let path = Math.abs(b.site.coord.x) + Math.abs(b.site.coord.y);
        if ( path !== b.path ) {
          return Promise.resolve({ id: b.id, status: 'compare-ok', skip: true,
            msg: `SKIPPED: ${path} != ${b.path} for ${b.id}` });
        }

        let a_name = !!a.site.info ? a.site.info.name : a.id;
        let b_name = !!b.site.info ? b.site.info.name : b.id;
        let msg = `${a_name}[score=${a.score}/path=${a.path}] swapped with ${b_name}[score=${b.score}/path=${b.path}]`;

        return Promise.try(() => {
          if ( this.env !== 'unittest' ) {
            return this.mapClient.swap_sites(a.site, b.site);
          } else {
            return Promise.resolve([a.site, b.site]);
          }
        })
        .then(() => this.slack.swap(msg))
        .then(() => Promise.resolve({
            marker: this.params.marker,
            status: 'swap-ok',
            a: a.id,
            b: b.id,
        }));
      });
    })
    .catch((error) => {
      let result = {
        marker: this.params.marker,
        a: a.id,
        b: b.id,
        error: parseError(error)
      };

      if ( error.statusCode && error.statusCode === 404 ) {
        result.status = 'swap-skip';
        result.msg = 'skipped, site not found';
        return Promise.resolve(result);
      } else {
        result.status = 'swap-error';
        return Promise.reject(result);
      }
    });
  }

  traverse() {
    return this.mapClient.fetchSites()
    .then((all_sites) => {
      let action_list = [];
      let known_ids = {};

      // invoke action: find gaps
      let px = JSON.parse(JSON.stringify(this.params)); // copy / prevent mutation
      px.all_sites = all_sites;
      action_list.push(action(this.ow, this.env, 'sweep/actionHoles', px, this.holes(all_sites)));

      // Update scores with accurate paths
      for(let i = 0; i < all_sites.length; i++ ) {
        let site = all_sites[i];
        if ( site.coord ) {
          let path = Math.abs(site.coord.x) + Math.abs(site.coord.y);
          action_list.push(this.scorebook.updatePath(site._id, path, this.params.marker));
        }
        known_ids[site._id] = 1;
      }

      // invoke action: clean up orphans
      px = JSON.parse(JSON.stringify(this.params)); // copy / prevent mutation
      px.known_ids = known_ids;
      action_list.push(action(this.ow, this.env, 'sweep/actionOrphans', px, this.orphans(known_ids)));

      // Note how many actions
      action_list.unshift(Promise.resolve({status: `${action_list.length} actions`}));
      return Promise.all(action_list);
    })
    .then((result) => { return this.filterResult(result); })
    .then((result) => Promise.resolve({
      status: 'traverse-ok',
      actions: result
    }))
    .catch((error) => Promise.reject({
      status: 'traverse-error',
      error: parseError(error),
      params: this.params
    }));
  }

  orphans(known_ids) {
    known_ids = known_ids || this.params.known_ids;
    assert.ok(known_ids, 'Specify known_ids');

    return this.scorebook.getOrphanScores(known_ids)
    .then((orphans) => {
      let action_list = [];
      action_list.push(Promise.resolve({status: `${orphans.length} orphans`}));

      for(let i = 0; i < orphans.length; i++ ) {
        action_list.push(
          this.scorebook.deleteScore(orphans[i].id)
          .then(() => Promise.resolve({
            id: orphans[i].id,
            status: 'destroyed'
          }))
          .catch((error) => Promise.resolve({
            id: orphans[i].id,
            error: parseError(error)
          }))
        );
      }

      return Promise.all(action_list)
      .then(() => Promise.resolve({
        status: 'orphans-ok',
        results: action_list
      }));
    })
    .catch((error) => Promise.reject({
      status: 'orphans-error',
      error: parseError(error),
      params: this.params
    }));
  }

  holes(all_sites) {
    all_sites = all_sites || this.params.all_sites;
    assert.ok(all_sites, 'Specify all_sites');

    all_sites.sort((a, b) => {
      // sort on x
      if ( a.coord.x < b.coord.x ) {
        return -1;
      }
      if ( a.coord.x > b.coord.x ) {
        return 1;
      }
      // sort on y
      if ( a.coord.y < b.coord.y ) {
        return -1;
      }
      if ( a.coord.y > b.coord.y ) {
        return 1;
      }
      return 0;
    });

    let action_list = [];

    let prev = all_sites.shift();
    all_sites.forEach(i => {
      if ( prev.coord.x !== i.coord.x ) {
        // don't check y when x is different
        if (( prev.coord.x + 1) !== i.coord.x ) {
          action_list.push(this.slack.hole(prev.coord, i.coord));
        }
      } else if ( (prev.coord.y + 1) !== i.coord.y ) {
        action_list.push(this.slack.hole(prev.coord, i.coord));
      }
      prev = i;
    });

    return Promise.all(action_list)
    .then(() => Promise.resolve({
      status: 'holes-ok',
      holes: action_list.length
    }));
  }

  filterResult(result) {
    if ( Array.isArray(result) ) {
      return result.filter((x) => {
        return this.debug ? true : (x.status && (x.status.indexOf('ok') < 0));
      });
    }
    return result;
  }
}

module.exports = SweepActions;
