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
                console.log("Running command " + commandToRun.description);
                commandToRun.execute(this.connection, this.connectionCallback);
                this.waitForChecks(commandToRun);
            },
            waitForChecks: function(commandToRun) {
                var checks = commandToRun.checkText;
                if (checks instanceof Function) {
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
                commandRunner.commandRunChecker = createCommandHasRunChecker(connection);
            },
            messageReceivedCallback: function(time) {
                var timePenalty = Math.round(time/1000);
                commandRunner.score += (100 - timePenalty);
                commandRunner.runNextCommandOrFinish();
            },
            timeoutCallback:  function(time) {
                commandRunner.score -= 30;
                if (commandRunner.lastRunCommand === 0) {
                    commandRunner.reportDone();
                } else {
                    commandRunner.runNextCommandOrFinish();
                }
            }
        }
    return commandRunner; 
}
function createCommandHasRunChecker(connection) {
    var commandHasRunChecker = {
        connection : connection,
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
            newCheck.timeoutObj = setTimeout(function() {
                newCheck.callbackAfterCompletion(timeoutCallback);
            }, this.timeout);
            this.checks.push(newCheck);
        },
        messageReceived : function (text) {
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
                    this.checks.splice(checkFound.position, 1);
                    clearTimeout(check.timeoutObj);
                    check.callbackAfterCompletion(check.messageFoundCallback, new Date() - check.startTime);
                }
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
        params : params,
        description : 'Connecting to web socket and waiting for ack message',
        execute : function(nullConnection, connectionCreatedCallback) {
            connection = ws.connect(wsLocation, getWsConnectionOptions());
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

// global.main = function(params) {
// createCommandRunner([connect, sayHello, chat, sayGoodbye]);
// createCommmandRunner.start();
// whisk.async();
// }
