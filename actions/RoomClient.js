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
    this.status = {};

    var self = this;

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
    var self = this;
    var status = this.status;
    var client = null;

    return Promise.try(function() {
      client = makeClient(self.target, self);

      // this attempt finishes when connection is open, or it times out
      return self.open_p.timeout(10000) // 10 seconds to connect;
    })
    .then(function() {
      if ( client.readyState === 1 ) {
        // WebSocket is open! we shall go now to break, err.. check stuff

        self.ack_p.then(function() {
          var version = Math.max(self.status.ack);
          client.send(`roomHello,${self.id},{
            "username": "Jane Said",
            "userId": "sweepJane",
            "version": ${version}
          }`, {}, function() {
            self.status.sent = true;
          });
        });

        self.location_p
        .delay(1000) // wait a second
        .then(function() {
          processLocation(client, status, self.id);
          client.send(`room,${self.id},{
            "username": "Jane Said",
            "userId": "sweepJane",
            "content": "/go N"
          }`, {}, function() {
            self.status.sent = true;
          });
        });

        self.exit_p
        .delay(1000)
        .then(function() {
          client.send(`roomGoodbye,${self.id},{
            "username": "Jane Said",
            "userId": "sweepJane"
          }`, {}, function() {
            self.status.sent = true;
          });
        });

      } else {
        client.close(1000,'All done!');
      }

      // Wait for all the dust to settle..
      return Promise.all([self.open_p, self.ack_p, self.location_p, self.chat_p, self.event_p, self.exit_p])
      .timeout(15000)
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
};

function makeClient(target, promises) {
  client = new WebSocket(target);

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
    promises.status.err = err;
  });

  client.on('message', function(data) {
    // console.log(data);
    var pos = data.indexOf('{');
    var payload = JSON.parse(data.substring(pos));

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
  var payload = status.location;

  // Look for optional room content..
  if ( !!payload.commands ) {
    var keys = Object.keys(payload.commands);
    var numCommands = keys.length;
    status.commands = numCommands;

    var str = (numCommands == 1 ? '1 custom command' : numCommands + ' custom commands');
    client.send(`room,${id},{
      "username": "Jane Said",
      "userId": "sweepJane",
      "content": "Well done! You have ${str}. Love that!"
    }`);

    client.send(`room,${id},{
      "username": "Jane Said",
      "userId": "sweepJane",
      "content": "${keys[0]}"
    }`);
  }

  if ( !!payload.objects ) {
    payload.roomInventory = payload.objects;
    delete payload.objects;
  }

  if ( !!payload.roomInventory ) {
    var numItems = payload.roomInventory.length;
    status.items = numItems;

    var str = (numItems == 1 ? '1 items' : numItems + ' items');
    client.send(`room,${id},{
      "username": "Jane Said",
      "userId": "sweepJane",
      "content": "Dig it! You have ${str} to mess with in this room. So fun!"
    }`);
  }
}

function scoreRoom(status, result) {
  // console.log('Tally results: ', status, result);
  result.endpoint.room = status;

  // 5 points apiece for messages received
  var apiece = ['ack', 'chat', 'close', 'exit', 'event', 'location', 'open'];
  for(var i = 0; i < apiece.length; i++ ) {
    if ( status[apiece[1]] ) {
      result.endpoint.total += 5;
    }
  }

  // 5 points _per command_
  if ( status.commands ) {
    result.endpoint.total += status.commands * 5;
  }

  // 5 points _per item_
  if ( status.items ) {
    result.endpoint.total += status.items * 5;
  }

  // Weight Room score double because rooms are awesome
  result.endpoint.total *= 2;

  console.log('---> Room Score ', result.endpoint.total);
  return Promise.resolve(result);
}

module.exports = RoomClient;
