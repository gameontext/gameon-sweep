var ws = require("nodejs-websocket");
var crypto = require("crypto");
const PROTOCOL = 'mediator,1.1';
global.main = function(params) {
    console.log("Creating web socket for " + params.id + " with name " + params.name);
    
    var wsLocation = getConnectionLocation(params); 
    
	var connection = ws.connect(wsLocation, getWsConnectOptions(params));
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