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
var DEFAULT_TIMEOUT = 20000;
function createCommandRunner(commands) {
    var commandRunner = {
            commands : commands,
            commandRunChecker : null,
            score : 0,
            lastRunCommand: -1,
            start: function() {
                this.runNextCommandOrFinish();
            },
            runNextCommandOrFinish: function() {
                console.log("Previously ran " + this.lastRunCommand);
                this.lastRunCommand++;
                console.log("Working out if there is a command in position " + this.lastRunCommand + " in " + this.commands);
                if (this.lastRunCommand < this.commands.length) {
                    this.runCurrentCommand();
                } else {
                    this.reportDone();
                }
            },
            runCurrentCommand: function() {
                var commandToRun = this.commands[this.lastRunCommand];
                commandToRun.execute(this.connectionCallback);
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
                commandRunner.commandRunChecker = createCommandHasRunChecker(connection);
            },
            messageReceivedCallback: function(time) {
                console.log("Message received correctly");
                var timePenalty = Math.round(time/1000);
                commandRunner.score += (100 - timePenalty);
                commandRunner.runNextCommandOrFinish();
            },
            timeoutCallback:  function(time) {
                console.log("Message timed out");
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
        isThisTheRightMessage : null,
        messageFoundCallback : null,
        timeoutObj : null,
        timeout : DEFAULT_TIMEOUT,
        startTime : null,
        callbackCalled : false,
        waitForTextMessageFromConnection : function(isThisTheRightMessage, messageFoundCallback, timeoutCallback) {
            console.log("Waiting for message with checker " + isThisTheRightMessage);
            this.callbackCalled = false;
            this.isThisTheRightMessage = isThisTheRightMessage;
            this.messageFoundCallback = messageFoundCallback;
            this.timeoutObj = setTimeout(function() {
                commandHasRunChecker.callbackAfterCompletion(timeoutCallback);
            }, this.timeout);
            this.startTime = new Date();
        },
        callbackAfterCompletion(callbackFunction, params) {
            if (!this.callbackCalled) {
                this.callbackCalled = true;
                callbackFunction(params);
            }
        }
    }
    var parseText = function(text) {
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
    connection.on("text", function(text) {
        console.log("Have text message")
        var parsedText = parseText(text);
        if (commandHasRunChecker.isThisTheRightMessage && commandHasRunChecker.isThisTheRightMessage(parsedText.routingInformation, parsedText.object)) {
            console.log("This is the right message");
            clearTimeout(commandHasRunChecker.timeoutObj);
            commandHasRunChecker.callbackAfterCompletion(commandHasRunChecker.messageFoundCallback, new Date() - commandHasRunChecker.startTime);
        }
    });
    return commandHasRunChecker;
}

// global.main = function(params) {
// createCommandRunner([connect, sayHello, chat, sayGoodbye]);
// createCommmandRunner.start();
// whisk.async();
// }
