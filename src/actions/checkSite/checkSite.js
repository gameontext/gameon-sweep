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
var DEFAULT_TIMEOUT = 20000;
const PROTOCOL = 'mediator,1.1';

global.main = function(params) {
    var commandRunner = createCommandRunner([createConnectCommand(params), 
                                             createRoomHelloCommand(params),
                                             createChatCommand(params),
                                             createRoomGoodbyeCommand(params),
                                             createCloseConnectionCommand(params)]);
    commandRunner.start();
    whisk.async();
}

function createCommandRunner(commands) {
    var commandRunner = {
            commands : commands,
            commandRunChecker : null,
            connection : undefined,
            score : 0,
            lastRunCommand: -1,
            start: function() {
                this.runNextCommandOrFinish();
            },
            runNextCommandOrFinish: function() {
                this.lastRunCommand++;
                if (this.lastRunCommand < this.commands.length) {
                    this.runCurrentCommand();
                } else {
                    this.reportDone();
                }
            },
            runCurrentCommand: function() {
                var commandToRun = this.commands[this.lastRunCommand];
                console.log("Running command to " + commandToRun.description);
                commandToRun.execute(this.connection, this.connectionCallback);
                this.waitForChecks(commandToRun);
            },
            waitForChecks: function(commandToRun) {
                var checks = commandToRun.checkText;
                if (!checks) {
                    this.runNextCommandOrFinish();
                } else if (checks instanceof Function) {
                    this.commandRunChecker.waitForTextMessageFromConnection(checks, this.messageReceivedCallback, this.timeoutCallback);
                } else {
                    for (i = 0; i < checks.length; i++) {
                        var check = checks[i];
                        this.commandRunChecker.waitForTextMessageFromConnection(check, this.messageReceivedCallback, this.timeoutCallback);
                    }
                }
            },
            reportDone: function() {
                whisk.done({score: this.score});
            },
            connectionCallback: function(connection) {
                commandRunner.connection = connection;
                connection.on('error', function(err) {
                    console.log("Have error " + err + " giving 10 point penalty");
                    commandRunner.score -= 10;
                });
                commandRunner.commandRunChecker = createCommandHasRunChecker(connection, commandRunner.allChecksDoneCallback);
            },
            messageReceivedCallback: function(time) {
                var timePenalty = Math.round(time/1000);
                var scoreToAdd = 100 - timePenalty;
                commandRunner.score += scoreToAdd;
                console.log('Received message back and scoring ' + scoreToAdd);
            },
            timeoutCallback:  function(time) {
                console.log('Check timed out so scoring -30');
                commandRunner.score -= 30;
                if (commandRunner.lastRunCommand === 0) {
                    commandRunner.lastRunCommand = commandRunner.commands.length;
                }
            },
            allChecksDoneCallback : function() {
                commandRunner.runNextCommandOrFinish();
            }
        }
    return commandRunner; 
}
function createCommandHasRunChecker(connection, checksCompleteCallback) {
    var commandHasRunChecker = {
        connection : connection,
        allChecksCompleteCallback : checksCompleteCallback,
        checks: [],
        timeout : DEFAULT_TIMEOUT,
        waitForTextMessageFromConnection : function(isThisTheRightMessage, messageFoundCallback, timeoutCallback) {
            var newCheck = {
                 callbackCalled : false,
                 isThisTheRightMessage : isThisTheRightMessage,
                 messageFoundCallback : messageFoundCallback,
                 startTime : new Date(),
                 callbackAfterCompletion(callbackFunction, params) {
                     if (!this.callbackCalled) {
                         this.callbackCalled = true;
                         callbackFunction(params);
                     }
                 },
            }
            this.checks.push(newCheck);
            newCheck.timeoutObj = setTimeout(function() {
                newCheck.callbackAfterCompletion(timeoutCallback);
                commandHasRunChecker.checkComplete(newCheck);
            }, this.timeout);
        },
        messageReceived : function (text) {
            console.log('Message received: ' + text);
            var parsedText = this.parseText(text);
            if (this.checks) {
                var checkFound = undefined;
                for(var i = 0 ; i < this.checks.length ; i++) {
                    var check = this.checks[i];
                    if (check.isThisTheRightMessage(parsedText.routingInformation, parsedText.object)) {
                        checkFound = {
                            position : i,
                            check : check
                        }
                        break;
                    }
                }
                if (checkFound) {
                    clearTimeout(check.timeoutObj);
                    check.callbackAfterCompletion(check.messageFoundCallback, new Date() - check.startTime);
                    this.checkComplete(checkFound.check);
                }
            }
        },
        checkComplete : function(checkThatIsComplete) {
            var checkPosition = -1;
            for(var i = 0 ; i < this.checks.length ; i++) {
                var check = this.checks[i];
                if (checkThatIsComplete === check) {
                    checkPosition = i;
                    break;
                }
            }
            this.checks.splice(checkPosition, 1);
            if (this.checks.length === 0) {
                this.allChecksCompleteCallback();
            }
        },
        parseText : function(text) {
            if (!text) {
                return {};
            }
            var curlyBracketIndex = text.indexOf('{');
            var routingInformation = [];
            var object;
            if (curlyBracketIndex > 0) {
                routingInformation = text.substring(0, curlyBracketIndex - 1).split(',');
                object = JSON.parse(text.substring(curlyBracketIndex));
            } else {
                object = JSON.parse(text);
            }
            return {'routingInformation' : routingInformation, 'object': object};
        }
    }
    connection.on("text", function(text) {
        commandHasRunChecker.messageReceived(text);
    });
    return commandHasRunChecker;
}

function createConnectCommand(params) {
    return {
        description : 'connect to web socket and waiting for ack message',
        params : params,
        execute : function(nullConnection, connectionCreatedCallback) {
            connection = ws.connect(this.getConnectionLocation(), this.getWsConnectionOptions());
            connectionCreatedCallback(connection);
        },
        getWsConnectionOptions : function() {
            headers = {
                'gameon-protocol' : PROTOCOL
            };
            if (this.params && this.params.connectionSecret) {
                var now = this.getCurrentDate();
                var timestamp = now.toISOString();

                var hash = crypto.createHmac('sha256', this.params.connectionSecret).update(
                        timestamp).digest('base64');
                headers['gameon-date'] = timestamp;
                headers['gameon-signature'] = hash;
            }
            options = {
                'extraHeaders' : headers
            };
            return options;
        },
        getConnectionLocation : function() {
            return this.params.connectionLocation;
        },
        checkText : function(routingInformation, object) {
            return routingInformation && object && routingInformation[0] === 'ack' && object.version;
        },
        getCurrentDate : function() {
            return new Date();
        }
    }
}

function createRoomHelloCommand(params) {
    return {
        description : 'enter a room and checking for two message: a "location" message and an "event" message',
        params : params,
        execute : function(connection) {
            sendMessage(connection, 'roomHello', this.params, { version: 1});
        },
        checkText : [function(routingInformation, object) {
            if (isPlayerMessageOfType(routingInformation, object, 'Sweep', 'location') ) {
                return true;
            } else {
                return false;
            }
        }, function(routingInformation, object) {
            if (isPlayerMessageOfType(routingInformation, object, '*', 'event') && doesContentMessageContainStrings(object, ['Sweep', 'enters'])) {
                return true;
            } else {
                return false;
            }
        }]
    }
}

var isPlayerMessage = function(routingInformation, recipient) {
    return routingInformation.length === 2 && 'player' === routingInformation[0] && recipient === routingInformation[1];
}
var isPlayerMessageOfType = function(routingInformation, object, recipient, expectedType) {
    return isPlayerMessage(routingInformation, recipient) && object && expectedType === object.type;
}

var doesContentMessageContainStrings = function(object, stringsToLookFor) {
    if (object.content && object.content['*']) {
        var contentMessage = object.content['*'];
        for (var i = 0; i < stringsToLookFor.length; i++) {
            var stringToLookFor = stringsToLookFor[i];
            if (contentMessage.indexOf(stringToLookFor) === -1) {
                return false;
            }
        }
    } else {
        return false;
    }
    return true;
}

function sendMessage(connection, messageType, params, object) {
    if (!object) {
        object = {};
    }
    object.username = "Sweep";
    object.userId = "Sweep";
    var message = messageType + ',' + params.id + ',' + JSON.stringify(object);
    console.log("Sending message to room " + message);
    connection.send(message);
}

function createChatCommand(params) {
    return {
        params : params,
        description : 'chat to the room saying hello',
        execute : function(connection) {
            sendMessage(connection, 'room', this.params, {content: 'Hello, Sweep here.  Just checking for cobwebs...'})
        },
        checkText : function(routingInformation, object) {
            return isPlayerMessageOfType(routingInformation, object, '*', 'chat') && 'Hello, Sweep here.  Just checking for cobwebs...' === object.content;
        }
    }
}

function createRoomGoodbyeCommand(params) {
    return {
        description : 'send roomGoodbye message and expect an "event" message',
        params : params,
        execute : function(connection) {
            sendMessage(connection, 'roomGoodbye', this.params);
        },
        checkText : function(routingInformation, object) {
            if (isPlayerMessageOfType(routingInformation, object, '*', 'event') && doesContentMessageContainStrings(object, ['Sweep', 'leaves'])) {
                return true;
            } else {
                return false;
            }
        }
    }
}

function createCloseConnectionCommand(params) {
    return {
        description : 'close the connection',
        execute : function(connection) {
            connection.close(0, 'Sweep has finished checks so leaving room');
        }
    }
}
