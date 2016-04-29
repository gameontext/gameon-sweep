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

var fakeConnection;
fakeConnection = {
    callback: null,
    on(eventType, callback) {
        if (eventType === "text") {
            this.callback = callback;
        }
    }
}
describe('CommandRunner', function() {
    var testObject;
    var hasExecutedCommand;
    var fakeCommandThatRegistersConnection = {
            execute: function(connection, connectionCreatedCallback) {
                connectionCreatedCallback(fakeConnection);
                hasExecutedCommand = true;
            },
            checkText: function() {
                return true;
            }
        };
    
    beforeEach(function() {
        DEFAULT_TIMEOUT = 1000;
        hasExecutedCommand = false;
        doneParams = {};
    });
    var checkScore = function(expectedScore) {
        assert(doneParams);
        assert(doneParams.score);
        assert.equal(doneParams.score, expectedScore);
    }
    describe('Single command running', function() {
        beforeEach(function() {
            testObject = createCommandRunner([fakeCommandThatRegistersConnection]);
        });
        it('runs a single command', function() {
            testObject.start();
            assert(hasExecutedCommand);
        });
        it('gives a score of 100 for a successfully executed command', function() {
            testObject.start();
            fakeConnection.callback();
            checkScore(100);
        });
        it('Does not double count', function() {
            testObject.start();
            fakeConnection.callback();
            fakeConnection.callback();
            checkScore(100);
        });
        it('gives a score of 99 if the command takes a second to run', function(done) {
            DEFAULT_TIMEOUT = 1500;
            testObject.start();
            setTimeout(function() {
                fakeConnection.callback();
                checkScore(99);
                done();
            }, 1000);
        });
        it('only calls one command complete callback called it is triggered at the same time as the timeout', function(done) {
            testObject.start();
            setTimeout(function() {
                fakeConnection.callback();
                assert(doneParams);
                assert(doneParams.score);
                assert(!(doneParams.score === 69));
                done();
            }, 1000);
        });
        it('Gives a score of -30 for a dead command', function(done) {
            testObject.start();
            setTimeout(function() {
                checkScore(-30);
                done();
            }, 1500);
        });
    });
    describe('Two commands running', function() {
        var hasRunSecondCommand = false;
        var connectionPassedToSecondCommand = undefined;
        beforeEach(function() {
            hasRunSecondCommand = false;
            connectionPassedToSecondCommand = undefined;
            var fakeCommandThatJustReturnsTrue = {
                    execute: function(connection) {
                        hasRunSecondCommand = true;
                        connectionPassedToSecondCommand = connection;
                    },
                    checkText: function() {
                        return true;
                    }
            }
            testObject = createCommandRunner([fakeCommandThatRegistersConnection, fakeCommandThatJustReturnsTrue]);
        });
       it('Runs two valid commands and returns a score of 200', function() {
           testObject.start();
           fakeConnection.callback();
           fakeConnection.callback();
           assert(hasExecutedCommand);
           assert(hasRunSecondCommand);
           assert.equal(connectionPassedToSecondCommand, fakeConnection);
           checkScore(200);
       });
       it('Gives a score of 70 if second command fails', function(done) {
           testObject.start();
           fakeConnection.callback();
           setTimeout(function() {
               assert(hasExecutedCommand);
               assert(hasRunSecondCommand);
               checkScore(70);
               done();
           }, 1500);
       });
       it('Does not call second command if first does not complete', function(done){
           testObject.start();
           setTimeout(function() {
               assert(hasExecutedCommand);
               assert(!hasRunSecondCommand);
               checkScore(-30);
               done();
           }, 1500);
       });
    });
    describe('A command with two expected messages', function() {
        var hasRunSecondCommand = false;
        beforeEach(function() {
            hasRunSecondCommand = false;
            var fakeCommandThatHasTwoExpectedTextMessages = {
                    execute: function() {
                        hasRunSecondCommand = true;
                    },
                    checkText: [function(routingInformation, object) {
                        return object && "wibble" === object.value;
                    }, function(routingInformation, object) {
                        return object && "fish" === object.value;
                    }]
            }
            testObject = createCommandRunner([fakeCommandThatRegistersConnection, fakeCommandThatHasTwoExpectedTextMessages]);
        });
        it('Gives a score for each check', function() {
            testObject.start();
            fakeConnection.callback();
            fakeConnection.callback('{"value": "wibble"}');
            fakeConnection.callback('{"value": "fish"}');
            assert(hasExecutedCommand);
            assert(hasRunSecondCommand);
            checkScore(300);
        });
        it('Does not allow double counting of scores', function(done) {
            testObject.start();
            fakeConnection.callback();
            fakeConnection.callback('{"value": "wibble"}');
            fakeConnection.callback('{"value": "wibble"}');
            assert(hasExecutedCommand);
            assert(hasRunSecondCommand);
            setTimeout(function() {
                checkScore(170);
                done();
            }, 1500);
        });
    });
});

describe('CommandHasRunChecker', function() {
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
        DEFAULT_TIMEOUT = 1000;
        var testObject = createCommandHasRunChecker(fakeConnection);
        testObject.waitForTextMessageFromConnection(null, null, done);
    });
    it('Does not call timeout if message is received', function(done) {
        DEFAULT_TIMEOUT = 500;
        var testObject = createCommandHasRunChecker(fakeConnection);
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
    it('Does not callback if the wrong message is received', function(done) {
        DEFAULT_TIMEOUT = 1000;
        var testObject = createCommandHasRunChecker(fakeConnection);
        var timeoutCalled = false;
        testObject.waitForTextMessageFromConnection(function() {
            return false;
        }, function() {
            assert.fail(null, null, "Should not callback for the wrong message", null);
        }, function() {timeoutCalled = true;});
        setTimeout(function() {
            assert(timeoutCalled);
            done();
        }, 1500)
    });
});
describe('connectCommand', function() {
    it('describes itself', function() {
        assert(createConnectCommand().description);
    });
    it('Has a hard to test execute function that creates a web socket', function() {
        assert(createConnectCommand().execute);
    });
    describe('#checkText', function() {
        it('Is true for a valid ack message', function() {
            var testObject = createConnectCommand();
            assert(testObject.checkText(['ack'], {version: '1.0'}));
        });
        it('Is false for an invalid ack message', function() {
            var testObject = createConnectCommand();
            assert(!testObject.checkText(['ack'], {}));
        });
        it('Is false for a message with no routing information', function() {
            var testObject = createConnectCommand();
            assert(!testObject.checkText(undefined, {version: '1.0'}));
        });
    });
    
    describe('#getWsConnectionOptions', function() {
        it('should add the protocol header', function() {
            var testObject = createConnectCommand();
            assert.equal(testObject.getWsConnectionOptions().extraHeaders['gameon-protocol'], 'mediator,1.1');
        });
        it('should have signature headers in the options when there is a secret in the params', function() {
            var testObject = createConnectCommand({'connectionSecret':'a secret'});
            var headers = testObject.getWsConnectionOptions().extraHeaders;
            assert(headers);
            assert(headers['gameon-signature']);
            assert(headers['gameon-date']);
            Date.parse(headers['gameon-date']);
        });
    });
    describe('#getConnectionLocation', function() {
        it('should get the location out of the params', function() {
            const location = 'ws://wibble';
            var testObject = createConnectCommand({'connectionLocation': location});
            var calculatedLocation = testObject.getConnectionLocation();
            assert.equal(calculatedLocation, location);
        });
    });
});