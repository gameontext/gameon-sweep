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
const assert = require('assert');

var fs = require("fs");
eval(fs.readFileSync(__dirname + '/checkSite.js')+'');
eval(fs.readFileSync(__dirname + '/../../common/fakeWhisk.js')+'');

describe('CommandRunner', function() {
    it('runs a single command', function() {
        var hasExecutedCommand = false;
        var fakeCommand = {
                execute: function() {
                    hasExecutedCommand = true;
                }
        };
        var testObject = createCommandRunner([fakeCommand]);
        testObject.start();
        assert(hasExecutedCommand);
    });
    it('checks that there is a response after a command executes', function() {
        
    });
});
describe('CommandHasRunChecker', function() {
    var fakeConnection;
    beforeEach(function() {
        fakeConnection = {
            callback: null,
            on(eventType, callback) {
                if (eventType === "text") {
                    this.callback = callback;
                }
            }
        }
    });
    it('waits until function is called', function() {
        var testObject = createCommandHasRunChecker(fakeConnection);
        var hasReportedMessageReceived = false;
        testObject.waitForTextMessageFromConnection(function() {
            return true;
        }, function() {
            hasReportedMessageReceived = true;
        });
        fakeConnection.callback();
        assert(hasReportedMessageReceived);
    });
    it('Gives a parsed message when testing the message is correct', function() {
        var testObject = createCommandHasRunChecker(fakeConnection);
        var hasReportedMessageReceived = false;
        testObject.waitForTextMessageFromConnection(function(routingInformation, object) {
                assert.deepEqual(routingInformation, ['a', 'b']);
                assert.equal(object.property, "value");
                return true;
            }, function() {
                hasReportedMessageReceived = true;
            });
        fakeConnection.callback('a,b,{"property":"value"}');
        assert(hasReportedMessageReceived);
    });
    it('Times out if no text message is received', function(done) {
        var testObject = createCommandHasRunChecker(fakeConnection, 1000);
        testObject.waitForTextMessageFromConnection(null, null, done);
    });
    it('Does not call timeout if message is received', function(done) {
        var testObject = createCommandHasRunChecker(fakeConnection, 500);
        setTimeout(done, 1500);
        testObject.waitForTextMessageFromConnection(function() {
                return true;
            }, function(){}, function() {
                assert.fail(null, null, "Have called the timeout even though it should have received the message", null);
            });
        fakeConnection.callback();
    });
    it('Tells the message received callback how long it took in ms', function() {
        var testObject = createCommandHasRunChecker(fakeConnection);
        var hasReportedMessageReceived = false;
        testObject.waitForTextMessageFromConnection(function() {
            return true;
        }, function(time) {
            if (time === undefined || time > 1000) {
                assert.fail(time, 1000, undefined, "<");
            }
            hasReportedMessageReceived = true;
        });
        fakeConnection.callback();
        assert(hasReportedMessageReceived);
    });
});