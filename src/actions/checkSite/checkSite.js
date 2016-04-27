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
var ws = require("nodejs-websocket");
var crypto = require("crypto");
const PROTOCOL = 'mediator,1.1';
global.main = function(params) {
    console.log("Creating web socket for " + params.id + " with name " + params.name);
    
    var wsLocation = getConnectionLocation(params); 
    
	var connection = ws.connect(wsLocation, getWsConnectionOptions(params));
    connection.on("connect", createOnConnectHandler(connection));
    

    return whisk.async();
};

function createOnConnectHandler(connection) {
	return function() {
	    console.log("Connected");
	    connection.sendText("Hello from Node", function(anything) {
	        console.log("message sent");
	        whisk.done();
	    })
	};
}

function getConnectionLocation(params) {
	return params.connectionLocation;
}

function getWsConnectionOptions(params) {
	headers = {'gameon-protocol': PROTOCOL};
	if (params && params.connectionSecret) {
		var now = new Date()
		var timestamp = now.toISOString()
	
		var sweepId = params.sweepId;
		var allParams = sweepId + timestamp
		var hash = crypto.createHmac('sha256', params.connectionSecret).update(allParams).digest('base64');
		headers['gameon-date'] = timestamp;
		headers['gameon-signature'] = hash;
	}
	options = { 'extraHeaders': headers};
	return options;
}