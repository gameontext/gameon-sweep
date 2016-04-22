var ws = require("nodejs-websocket")
global.main = function(params) {
    console.log("Creating web socket for " + params.id + " with name " + params.name);
    
    var wsLocation = getConnectionLocation(params); 
    
    try {
    	var connection = ws.connect(wsLocation);
        connection.on("connect", function() {
            console.log("Connected");
            connection.sendText("Hello from Node", function(anything) {
                console.log("message sent");
                whisk.done();
            });
        });
    } catch (err) {
    	console.log("Got error: " + err);
    	whisk.error("Got error: " + err);
    }
    

    return whisk.async();
};

function getConnectionLocation(params) {
	return params.connectionLocation;
}

function getWsConnectOptions(params) {
	
}