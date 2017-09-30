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
const should = require('should');
const Promise = require("bluebird");
const Site = require('../actions/Site.js');
const jsonBody = require('./commonJson.js');

let site = new Site(5);


describe('totalScore', function() {

  it('should create final result containing all elements', function() {
    var finalScore = site.totalScore([
      {info: {total: 0}, site: {}},
      {endpoint: {total: 6}},
      {room: {total: 6}}
    ]);

    console.log(finalScore);

  });

});
