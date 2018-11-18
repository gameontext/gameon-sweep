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

function offItGoes(body, uri, env) {
  if ( env !== 'production' ) {
    console.log(`*****\n** ${body.icon_emoji} ${body.username}\n** ${body.channel}: ${body.text}\n****`);
    return Promise.resolve({ status: 'notify-fake'});
  } else {
    let options = {
      uri: uri,
      json: true,
      method: 'post',
      body: body
    };
    return rp(options)
    .then(Promise.resolve({ status: 'notify-ok'}))
    .catch((error) => {
      console.log("slack notification error: " + error);
      return Promise.resolve({
        status: 'notify-error',
        error: JSON.stringify(error)
      });
    });
  }
}

class SlackNotification {

  constructor(params) {
    params = params || {};

    this.env = params.NODE_ENV || process.env.NODE_ENV;
    this.slack_url = params.slack_url || process.env.SLACK_URL;
    assert.ok(this.slack_url, 'Please provide a slack webhook (slack_url)');

    this.channel = '#sweep';
  }

  scoring(count) {
    let body = {
      username: 'Evaluator',
      icon_emoji: ':sleuth_or_spy:',
      channel: this.channel,
      text: `Tallying scores for ${count} rooms`
    };

    return offItGoes(body, this.slack_url, this.env);
  }

  scoreSad() {
    let body = {
      username: 'Evaluator',
      icon_emoji: ':sleuth_or_spy:',
      channel: this.channel,
      text: `Something didn't go quite right with the scorekeeping. Help?`
    };

    return offItGoes(body, this.slack_url, this.env);
  }


  swapStart(number) {
    let body = {
      username: 'SORTIN',
      icon_emoji: ':card_file_box:',
      channel: this.channel,
      text: 'Sorting through ' + number + ' records'
    };
    return offItGoes(body, this.slack_url, this.env);
  }

  swapStats(text) {
    let body = {
      username: 'SORTOUT',
      icon_emoji: ':bar_chart:',
      channel: this.channel,
      text: text
    };
    return offItGoes(body, this.slack_url, this.env);
  }

  swap(text) {
    let body = {
      username: 'Permutare',
      icon_emoji: ':dizzy:',
      channel: this.channel,
      text: text
    };
    return offItGoes(body, this.slack_url, this.env);
  }

  swapFail(text) {
    let body = {
      username: 'Permutare',
      icon_emoji: ':fire:',
      channel: this.channel,
      text: text
    };
    return offItGoes(body, this.slack_url, this.env);
  }

  hole(a, b) {
    let body = {
      username: 'Permutare',
      icon_emoji: ':see_no_evil:',
      channel: this.channel,
      text: `There is a hole in the map near [${a.x},${a.y}] and [${b.x},${b.y}]`
    };
    return offItGoes(body, this.slack_url, this.env);
  }
}

module.exports = SlackNotification;
