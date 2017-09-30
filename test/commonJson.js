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

var firstRoom = {
  "info": {
    "name": "First Room",
    "fullName": "The First Room",
    "description": "A helpful room with doors in every possible direction.",
    "doors": {
      "n": "A knobbly wooden door with a rough carving or a friendly face",
      "w": "A fake wooden door with stickers of friendly faces plastered all over it",
      "s": "A warped wooden door with a friendly face branded on the corner",
      "e": "A polished wooden door with an inlaid friendly face",
      "u": "A scuffed and scratched oaken trap door embossed with a friendly face",
      "d": "A rough-cut particle board hatch with a friendly face scratched on it"
    }
  },
  "exits": {
    "n": {
      "name": "davicbroom",
      "fullName": "davicbroom",
      "door": "missing",
      "connectionDetails": {
        "type": "websocket",
        "target": "ws://gameon-cf-app.mybluemix.net/room"
      },
      "_id": "7fe0cb66744ba70ac307b21d67f2563e"
    },
    "w": {
      "name": "Basement",
      "fullName": "Basement",
      "door": "A very dark archway, you can't quite make out what's beyond.",
      "connectionDetails": {
        "type": "websocket",
        "target": "wss://gameontext.org/rooms/ws/Basement"
      },
      "_id": "e79a452413aded81010cb6213e187a0f"
    },
    "s": {
      "name": "GOTest1",
      "fullName": "Game On BT Presentation test 1",
      "door": "A red door",
      "connectionDetails": {
        "type": "websocket",
        "target": "ws://gotest1.eu-gb.mybluemix.net/room"
      },
      "_id": "f50cba3c54c4b210f1a2ce3c18c3be82"
    },
    "e": {
      "name": "RecRoom",
      "fullName": "Rec Room",
      "door": "The window on the wall of the Rec Room looks large enough to climb through.",
      "connectionDetails": {
        "type": "websocket",
        "target": "wss://gameontext.org/rooms/ws/RecRoom"
      },
      "_id": "658aa51512b7cbbc3ee5d0f502525545"
    }
  },
  "owner": "game-on.org",
  "createdOn": "2017-09-27T15:39:33.519Z",
  "assignedOn": "2017-09-27T15:39:33.519Z",
  "coord": {
    "x": 0,
    "y": 0
  },
  "type": "room",
  "_id": "firstroom",
  "_rev": "3-67cf483ff7099f9c7721caf9563a350d"
};

function makeDoors(number, unique) {
  var directions = ['n','s','e','w','u','d'];
  var doors = {};

  for (var i = 0; i < number && i < directions.length; i++) {
    doors[directions[i]] = 'A door ';
    if ( unique ) {
      doors[directions[i]] += 'going ' + directions[i];
    }
  }
  return doors;
}

function makeDescription(number) {
  var description = '';
  for (var i = 0; i < number; i++) {
    description += 'word '
  }
  return description;
};

module.exports.slim = function () {
  return JSON.parse(JSON.stringify(firstRoom));
};

// Repository URL
module.exports.github = function () {
  let github = module.exports.slim();
  github.info.repositoryUrl = "https://github.com/your-fork";

  return github;
};

// Connection details
module.exports.connection = function () {
  let connection = module.exports.slim();
  connection.info.connectionDetails = {
    type: "websocket"
  };

  return connection;
};

// Connection details and health endpoint
module.exports.health = function () {
  let health = module.exports.connection();
  health.info.connectionDetails.healthUrl = "http://secondroom:9008/barn/health";

  return health;
};

// All the things!
module.exports.full = function () {
  let full = module.exports.health();
  full.info.repositoryUrl = "https://github.com/your-fork";

  return full;
};

// RoomInfo
module.exports.minimum = function() {
  return { name: 'name' };
};

// RoomInfo
module.exports.spareRoom = function() {
  return {
    name: "First Room",
    fullName: "The First Room",
  };
};

// RoomInfo
module.exports.verboseRoom = function(number) {
  let described = module.exports.spareRoom();
  described.description = makeDescription(number);
  return described;
};

// RoomInfo
module.exports.doorsAlone = function(number, unique) {
  let doorsAlone = module.exports.spareRoom();
  doorsAlone.doors = makeDoors(number, unique);
  return doorsAlone;
};

// RoomInfo
module.exports.verboseDoors = function(number, unique) {
  let described = module.exports.verboseRoom(1);
  described.doors = makeDoors(number, unique);
  return described;
};

module.exports.noTarget = function() {
  return { type: 'websocket' };
};

