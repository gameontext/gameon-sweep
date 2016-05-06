/*******************************************************************************
 * Copyright (c) 2016 IBM Corp.
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
var doneCalled = false;
whisk = {
	'async' : function() {
		console.log("Called async");
	},
	'done' : function(output) {
		console.log("Called done " + JSON.stringify(output));
		doneCalled = true;
	}
}

var fs = require("fs")
var vm = require('vm')
eval(fs.readFileSync(__dirname + '/checkSite.js') + '');
var basement = {
	"id" : "df99a72468db3c9b03f5c85f05000f3a",
	"name" : "Basement",
	"connectionLocation" : "ws://127.0.0.1:9080/rooms/ws/Basement",
	"connectionType" : "websocket"
};
var recRoom = {
	"id" : "df99a72468db3c9b03f5c85f05001d29",
	"name" : "RecRoom",
	"connectionLocation" : "ws://127.0.0.1:9080/rooms/ws/RecRoom",
	"connectionType" : "websocket",
	"connectionSecret" : "kayleigh"
};
var mugRoom = {
	"id" : "df99a72468db3c9b03f5c85f05003699",
	"name" : "MugRoom",
	"connectionLocation" : "ws://127.0.0.1:9080/rooms/ws/MugRoom",
	"connectionType" : "websocket"
};
var createTimerFunctionToWaitBeforeCheckingRoom = function(rooms) {
    setTimeout(function() {
        if (doneCalled) {
            if (rooms.length > 0) {
                var room = rooms.pop();
                console.log('Calling main for room ' + room.name);
                doneCalled = false;
                main(room);
                createTimerFunctionToWaitBeforeCheckingRoom(rooms);
            }
        } else {
            createTimerFunctionToWaitBeforeCheckingRoom(rooms);
        }
    }, 1000);
}

main(basement);
createTimerFunctionToWaitBeforeCheckingRoom([recRoom, mugRoom]);

