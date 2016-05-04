/*******************************************************************************
 * Copyright (c) 2016 IBM Corp.
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
var ws = require("nodejs-websocket");
var crypto = require("crypto");
const
PROTOCOL = 'mediator,1.1';
var score = 0;
var connection;
var timeoutObj = setTimeout(timeoutFunction, 20000);
var connectionOptions;
var wsLocation;
var startTime = 0;
var runningCommand;
var commandIterator = {

    positionInCommands : 0,
    commands : [
            {
                validate : function(routingInformation, object) {
                    if (routingInformation[0] == 'ack' && object.version) {
                        return 100;
                    } else {
                        return -1;
                    }
                },
                execute : function() {
                    connection = ws.connect(wsLocation, connectionOptions);
                    connection.on("text", function(text) {
                        console.log("Got back text " + text);
                        totalTime = new Date() - startTime;
                        console.log("Time to run " + totalTime);
                        var parsedText = parseText(text);
                        var commandScore = runningCommand.validate(parsedText);
                        if (commandScore > 0) {
                            score += commandScore - totalTime;
                            if (commandIterator.hasNextCommand()) {
                                runCommand(commandIterator.nextCommand());
                            }
                        }
                    });
                },
                description : "Connecting to web socket and waiting for ack message"
            },
            {
                validate : function(routingInformation, object) {
                    text.startsWith('player,*,{"type":"chat",');
                },
                execute : function() {
                    console.log("Running execute on chat message");
                    connection.send('room,'
                                    + params.id
                                    + ',{"username": "Sweep","userId": "Sweep","content": "Hello from sweep, just checking for cobwebs"}')
                },
                description : "sending chat and waiting for it to be sent back"
            } ],

    nextCommand : function() {
        command = this.commands[this.positionInCommands];
        this.positionInCommands++;
        console.log('Returning next command: ' + command.description);
        return command;
    },
    hasNextCommand : function() {
        return this.positionInCommands < this.commands.length;
    },
    timeout : function() {
        if (this.positionInCommands == 1) {
            this.positionInCommands = this.commands.length;
        }
    }
}
global.main = function(params) {
    console.log("Creating web socket for " + params.id + " with name "
            + params.name);

    wsLocation = getConnectionLocation(params);
    connectionOptions = getWsConnectionOptions(params);
    
    connection = ws.connect(wsLocation, connectionOptions);
    connection.on("text", function(text) {
        console.log("Got back text " + text);
    });
    connection.on("connect", createOnConnectHandler(connection));

    if (commandIterator.hasNextCommand()) {
        runCommand(commandIterator.nextCommand());
    }

    return whisk.async();
};

function parseText(text) {
    var curlyBracketIndex = text.indexOf('{');
    var routingInformation;
    var object;
    if (curlyBracketIndex > 0) {
        routingInformation = text.substring(0, curlyBracketIndex - 1).split(',');
        object = JSON.parse(text.substring(curlyBracketIndex));
    } else {
        object = JSON.parse(text);
    }
    return {'routingInformation' : routingInformation, 'object': object};
}

function timeoutFunction() {
    score = score - 30;
    commandIterator.timeout();
    if (commandIterator.hasNextCommand()) {
        runCommand(commandIterator.nextCommand());
    } else {
        whisk.done();
    }
}

function runCommand(commandInformation) {
    console.log("Running command " + commandInformation.description);
    clearTimeout(timeoutObj);
    startTime = new Date();
    timeoutObj = setTimeout(timeoutFunction, 20000);
    runningCommand = commandInformation;
    commandInformation.execute();
}

function createOnConnectHandler(connection) {
    return function() {
        console.log("Connected");
        sendMessage(
                connection,
                'room,df99a72468db3c9b03f5c85f05001d29,{"username": "DevUser","userId": "DevUser","content": "Hello from node"}');
        sendMessage(
                connection,
                'roomHello,df99a72468db3c9b03f5c85f05001d29,{"username": "DevUser","userId": "DevUser"}')
        sendMessage(
                connection,
                'roomGoodbye,df99a72468db3c9b03f5c85f05001d29,{"username": "DevUser","userId": "DevUser"}')

    };
}

function sendMessage(connection, message) {
    connection.sendText(message, function(anything) {
        console.log('message ' + message + ' sent');
        // connection.close();
        whisk.done();
    });
}

function getConnectionLocation(params) {
    return params.connectionLocation;
}

function getWsConnectionOptions(params) {
    headers = {
        'gameon-protocol' : PROTOCOL
    };
    if (params && params.connectionSecret) {
        var now = new Date();
        var timestamp = now.toISOString();

        var allParams = timestamp;
        var hash = crypto.createHmac('sha256', params.connectionSecret).update(
                allParams).digest('base64');
        headers['gameon-date'] = timestamp;
        headers['gameon-signature'] = hash;
    }
    options = {
        'extraHeaders' : headers
    };
    console.log(JSON.stringify(options));
    return options;
}