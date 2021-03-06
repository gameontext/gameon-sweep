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
const WebSocket = require('ws');

class RoomClient {

  constructor(id, target, token) {

    this.id = id;
    this.target = target;
    this.token = token;
    this.status = {};
    this.sent = [];
    this.received = [];

    let self = this;

    // Set up promises so we can count if stuff happened
    this.open_p = new Promise((resolve, reject) => {
      self.open_r = resolve;
    }).then(function(data) {
      self.status.open = data;
    });

    this.close_p = new Promise((resolve, reject) => {
      self.close_r = resolve;
    }).then(function(data) {
      self.status.close = data;
    });

    this.ack_p = new Promise((resolve, reject) => {
      self.ack_r = resolve;
    }).then(function(data) {
      self.status.ack = data.version;
    });

    this.location_p = new Promise((resolve, reject) => {
      self.location_r = resolve;
    }).then(function(data) {
      self.status.location = data;
    });

    this.chat_p = new Promise((resolve, reject) => {
      self.chat_r = resolve;
    }).then(function(data) {
      self.status.chat = data;
    });

    this.event_p = new Promise((resolve, reject) => {
      self.event_r = resolve;
    }).then(function(data) {
      self.status.event = data;
    });

    this.exit_p = new Promise((resolve, reject) => {
      self.exit_r = resolve;
    }).then(function(data) {
      self.status.exit = data;
    });
  }

  tryRoom(result) {
    console.log('tryRoom: ', this.id, this.target, this.token);
    result.progress = 'room';

    let client = null;
    let self = this;
    let status = this.status;
    status.received = this.received;
    status.sent = this.sent;

    return Promise.try(function() {
      client = makeClient(self.target, self);

      // this attempt finishes when connection is open, or it times out
      return self.open_p.timeout(5000); // 5 seconds to connect;
    })
    .then(function() {
      if ( client.readyState === 1 ) {
        // WebSocket is open! we shall go now to break, err.. check stuff

        self.ack_p.then(function() {
          let version = Math.max.apply(Math, self.status.ack);
          let msg = makeMessage('roomHello', self.id, {
            username: "Jane Said",
            userId: "sweepJane",
            version: version
          });

          client.send(msg, {}, function() {
            self.sent.push(msg);
          });
        });

        self.location_p
        .delay(1000) // wait a second
        .then(function() {
          processLocation(client, status, self.id);
          let msg = makeMessage('room', self.id, {
            username: "Jane Said",
            userId: "sweepJane",
            content: "/go N"
          });
          client.send(msg, {}, function() {
            self.sent.push(msg);
          });
        });

        self.exit_p
        .delay(1000)
        .then(function() {
          let msg = makeMessage('roomGoodbye', self.id, {
            username: "Jane Said",
            userId: "sweepJane",
          });
          client.send(msg, {}, function() {
            self.sent.push(msg);
          });
        });

      } else {
        client.close(1000,'All done!');
      }

      // Wait for all the dust to settle..
      return Promise.all([self.open_p, self.ack_p, self.location_p, self.chat_p, self.event_p, self.exit_p])
      .timeout(10000)
      .then(function() {
        status.timeout = false;
        client.close(1000,'All done!');
        return self.close_p;
      })
      .catch(Promise.TimeoutError, function(error) {
        status.timeout = true;
        client.close(1000,'All done!');
        return self.close_p;
      });
    })
    .then(function() {
      // console.log('All ended well, scoring');
      return scoreRoom(status, result);
    })
    .catch(function(err) {
      // console.log('Catch error working with websocket: ', err);
      return scoreRoom(status, result);
    })
    .finally(function() {
      // Make sure we clean up (for the server's sake, too)
      if ( !!self.client ) {
        client.terminate();
      }
    });
  }
}

function makeMessage(prefix, id, content) {
  return prefix +',' + id + ',' + JSON.stringify(content);
}

function makeClient(target, promises) {
  let client = new WebSocket(target);

  client.on('open', function() {
    promises.open_r(true);
  });

  client.on('close', function(code, reason) {
    promises.close_r(true);
    if ( closeAll(code, reason) ) {
      promises.open_r(false);
      promises.ack_r(false);
      promises.location_r(false);
      promises.chat_r(false);
      promises.event_r(false);
      promises.exit_r(false);
    }
  });

  client.on('error', function(err) {
    if ( err.message ) {
      promises.status.err = err.message;
    } else {
      promises.status.err = err;
    }
  });

  client.on('message', function(data) {
    promises.received.push(data);
    let pos = data.indexOf('{');
    let payload = JSON.parse(data.substring(pos));

    if ( data.startsWith('ack,') ) {
      promises.ack_r(payload);
    } else if ( payload.type === "location" ) {
      promises.location_r(payload);
    } else if ( payload.type === "chat" ) {
      promises.chat_r(true);
    } else if ( payload.type === "event" ) {
      promises.event_r(true);
    } else if ( payload.type === "exit" ) {
      promises.exit_r(data.startsWith('playerLocation') ? promises.exit_r(payload) : promises.exit_r(false));
    }
  });

  return client;
}

function closeAll(code, reason) {
  return true;
}

function processLocation(client, status, id) {
  let payload = status.location;

  // Look for optional room content..
  if ( !!payload.commands ) {
    let keys = Object.keys(payload.commands);
    let numCommands = keys.length;
    status.commands = numCommands;

    let str = (numCommands === 1 ? '1 custom command' : numCommands + ' custom commands');
    let yay1 = makeMessage('room',id,{
      "username": "Jane Said",
      "userId": "sweepJane",
      "content": `Well done! You have ${str}. Love that!`
    });
    client.send(yay1, {}, function() {
      status.sent.push(yay1);
    });

    let cmd1 = makeMessage('room',id,{
      "username": "Jane Said",
      "userId": "sweepJane",
      "content": keys[0]
    });
    client.send(cmd1, {}, function() {
      status.sent.push(cmd1);
    });
  }

  if ( !!payload.objects ) {
    payload.roomInventory = payload.objects;
    delete payload.objects;
  }

  if ( !!payload.roomInventory ) {
    let numItems = payload.roomInventory.length;
    status.items = numItems;

    let str = (numItems === 1 ? '1 items' : numItems + ' items');
    let yay2 = makeMessage('room',id,{
      "username": "Jane Said",
      "userId": "sweepJane",
      "content": `Dig it! You have ${str} to mess with in this room. So fun!`
    });
    client.send(yay2, {}, function() {
      status.sent.push(yay2);
    });
  }
}

function scoreRoom(status, result) {
  let score = result.score.endpoint;
  // console.log('Tally results: ', status, result);
  score.room = status;
  score.room.sent = score.room.sent;
  score.room.received = score.room.received;

  // 50 points apiece for messages received
  let apiece = ['ack', 'chat', 'close', 'exit', 'event', 'location', 'open'];
  for(let i = 0; i < apiece.length; i++ ) {
    if ( status[apiece[1]] ) {
      score.total += 50;
    }
  }

  // 5 points _per command_
  if ( status.commands ) {
    score.total += status.commands * 15;
  }

  // 5 points _per item_
  if ( status.items ) {
    score.total += status.items * 15;
  }

  // Weight Room score double because _LIVE_ rooms are awesome
  score.total *= 2;

  // console.log('---> Room Score ', score.total);
  return Promise.resolve(score);
}

module.exports = RoomClient;
