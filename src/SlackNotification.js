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
const assert = require('assert');
const rp = require('request-promise');
const Promise = require("bluebird");

class SlackNotification {

  constructor(slack_url) {
    assert.ok(slack_url, 'Please provide a slack webhook (slack_url)');
    this.slack_url = slack_url;
    this.channel = '#sweep';
  }

  scoreStart() {
    let body = {
      username: 'Evaluator',
      icon_emoji: ':sleuth_or_spy:',
      channel: this.channel,
      text: 'Off to do the rounds...'
    };

    return offItGoes(body, this.slack_url);
  }

  swapStart(number) {
    let body = {
      username: 'SORTIN',
      icon_emoji: ':card_file_box:',
      channel: this.channel,
      text: 'Sorting through ' + number + ' records'
    };
    return offItGoes(body, this.slack_url);
  }

  swapStats(text) {
    let body = {
      username: 'SORTOUT',
      icon_emoji: ':bar_chart:',
      channel: this.channel,
      text: text
    };
    return offItGoes(body, this.slack_url);
  }

  swap(text) {
    let body = {
      username: 'Permutare',
      icon_emoji: ':revolving_hearts:',
      channel: this.channel,
      text: text
    };
    return offItGoes(body, this.slack_url);
  }
}

function offItGoes(body, uri) {
  let options = {
    uri: uri,
    json: true,
    method: 'post',
    body: body
  };
  return rp(options);
}

module.exports = SlackNotification;
