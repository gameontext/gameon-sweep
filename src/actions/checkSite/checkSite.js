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
function createCommandRunner(commands) {
    return {
        commands : commands,
        start: function() {
            this.commands[0].execute();
        }
    }
}
function createCommandHasRunChecker(connection, timeout) {
    var commandHasRunChecker = {
        connection : connection,
        isThisTheRightMessage : null,
        messageFoundCallback : null,
        timeoutObj : null,
        timeout : timeout ? timeout : 20000,
        startTime : null,
        waitForTextMessageFromConnection : function(isThisTheRightMessage, messageFoundCallback, timeoutCallback) {
            this.isThisTheRightMessage = isThisTheRightMessage;
            this.messageFoundCallback = messageFoundCallback;
            this.timeoutObj = setTimeout(timeoutCallback, timeout);
            this.startTime = new Date();
        }
    }
    var parseText = function(text) {
        if (!text) {
            return {};
        }
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
    connection.on("text", function(text) {
        var parsedText = parseText(text);
        if (commandHasRunChecker.isThisTheRightMessage && commandHasRunChecker.isThisTheRightMessage(parsedText.routingInformation, parsedText.object)) {
            clearTimeout(commandHasRunChecker.timeoutObj);
            commandHasRunChecker.messageFoundCallback(new Date() - commandHasRunChecker.startTime);
        }
    });
    return commandHasRunChecker;
}