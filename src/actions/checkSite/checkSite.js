var ws = require("nodejs-websocket")
global.main = function(params) {
    console.log("Creating web socket for " + params.id + " with name " + params.name);
    
    // TODO get ws location from params as well
    var wsLocation = params.wsLocation ? params.wsLocation : "ws://testwebsocket.mybluemix.net/sample.javaee7.websocket/SimpleAnnotated"; 
    
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