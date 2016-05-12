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
const
assert = require('assert');

var fs = require("fs");
eval(fs.readFileSync(__dirname + '/loadSites.js') + '');
eval(fs.readFileSync(__dirname + '/../../common/fakeWhisk.js') + '');

describe('Load sites', function() {
    describe('#allSitesResponseHandler', function() {
        beforeEach(function() {
            invokedParams = [];
            doneCalled = false;
        });
        it('should invoke whisk.invoke for each site', function() {
            createAllSitesResponseHandler()(null, null, JSON.stringify([ {
                '_id' : 'first',
                'coord' : {
                    'x' : -3,
                    'y' : 4
                },
                'info' : {
                    'connectionDetails' : {}
                }
            }, {
                '_id' : 'second',
                'coord' : {
                    'x' : -2,
                    'y' : 4
                },
                'info' : {
                    'connectionDetails' : {}
                }
            } ]));
            assert.equal(invokedParams.length, 2);
        });
        it('should pass the correct params to whisk.invoke', function() {
            var testId = 'testId';
            var testName = 'testName';
            var testConnectionSecret = 'testSecret';
            var testConnectionLocation = 'ws://testlocation';
            var testConnectionType = 'websocket';
            createAllSitesResponseHandler()(null, null, JSON.stringify([ {
                '_id' : testId,
                'coord' : {
                    'x' : -3,
                    'y' : 4
                },
                'info' : {
                    'name' : testName,
                    'connectionDetails' : {
                        'type' : testConnectionType,
                        'target' : testConnectionLocation,
                        'token' : testConnectionSecret
                    }
                }
            } ]));
            var params = invokedParams[0];
            assert.equal(params.name, 'checkSite');
            assert(params.blocking);
            assert(params.next);
            assert.equal(params.parameters.id, testId);
            assert.equal(params.parameters.distanceFromCentreSquared, 25);
            assert.equal(params.parameters.name, testName);
            assert.equal(params.parameters.connectionType, testConnectionType);
            assert.equal(params.parameters.connectionSecret,
                    testConnectionSecret);
            assert.equal(params.parameters.connectionLocation,
                    testConnectionLocation);
        });
        it('should call whisk done when complete', function() {
            createAllSitesResponseHandler()(null, null, JSON.stringify([ {
                '_id' : 'first',
                'coord' : {
                    'x' : -3,
                    'y' : 4
                },
                'info' : {
                    'connectionDetails' : {}
                }
            }, {
                '_id' : 'second',
                'coord' : {
                    'x' : -2,
                    'y' : 4
                },
                'info' : {
                    'connectionDetails' : {}
                }
            } ]));
            assert(doneCalled);
        });
        it('should not invoke if there are no connection details', function() {
            createAllSitesResponseHandler()(null, null, JSON.stringify([ {
                '_id' : 'first',
                'coord' : {
                    'x' : -3,
                    'y' : 4
                },
                'info' : {
                    'connectionDetails' : {}
                }
            }, {
                '_id' : 'second',
                'info' : { }
            } ]));
            assert.equal(invokedParams.length, 1);
            assert(doneCalled);
        });
        it('should not invoke if there is no info', function() {
            createAllSitesResponseHandler()(null, null, JSON.stringify([ {
                '_id' : 'first',
                'coord' : {
                    'x' : -3,
                    'y' : 4
                },
                'info' : {
                    'connectionDetails' : {}
                }
            }, {
                '_id' : 'second'
            } ]));
            assert.equal(invokedParams.length, 1);
            assert(doneCalled);
        });
    });

    describe('#buildGetSitesOptions', function() {
        it('should add the url from params to the options', function() {
            var testUrl = 'http://example.com/sites';
            var result = buildGetSitesOptions({
                'mapSitesUrl' : testUrl,
                'sweepId' : 'sweep',
                'sweepApiKey' : 'sweepApi'
            });
            assert.equal(result.url, testUrl);
        });
        it('should use a default URL if none is provided', function() {
            var result = buildGetSitesOptions({
                'sweepId' : 'sweep',
                'sweepApiKey' : 'sweepApi'
            });
            assert.equal(result.url, 'https://game-on.org/map/v1/sites');
        });
        it('should include the HMAC header and associated information',
                function() {
                    var npcId = "testNpcId";
                    var npcApiKey = "testNpcApiKey";
                    var result = buildGetSitesOptions({
                        'sweepId' : npcId,
                        'sweepApiKey' : npcApiKey
                    });
                    assert.equal(result.headers['gameon-id'], npcId);
                    assert(result.headers['gameon-date']);
                    Date.parse(result.headers['gameon-date']);
                    assert(result.headers['gameon-signature']);
                });
        it('should not include security headers if parameters not passed in',
                function() {
                    var result = buildGetSitesOptions();
                    assert(!result.headers);
                });
    });
});
describe('shuffle array', function() {
    it ('should produce an array in a different order of the input', function() {
        var input = ["a", "b", "c", "d", "e", "f", "g", "h", "j", "k"];
        var output = ["a", "b", "c", "d", "e", "f", "g", "h", "j", "k"];
        shuffleArray(output)
        try {
            assert.deepEqual(output, input);
            fail("Arrays were equal after the shuffle. Maybe try again, this will happen once in every 3.6 million attempts");
        } catch(err) {
            // pass
        }
        input.forEach(function(item) {
            assert(output.indexOf(item) != -1);
        });
    });
});
describe('SiteScoringCallbackBuilder', function() {
    var postCalled = false;
    var options = undefined;
    var fakeHttpRequest;
    beforeEach(function() {
        postCalled = false;
        fakeHttpRequest = {
            post : function(optionsArg, callback) {
                postCalled = true;
                options = optionsArg;
            }
        }
    });
    it('should swap a low scoring room that is close to the centre for a high scoring one far from the centre', function() {
        var fakeSiteUrl = 'http://fakemap/map/v1/swapSites';
        var npcId = 'sweep';
        var testObject = new SiteScoringCallbackBuilder(2, fakeHttpRequest, {'mapSwapSitesUrl' : fakeSiteUrl,
                                                                             'sweepId' : npcId,
                                                                             'sweepApiKey' : 'sweepApi'});
        testObject.createScoringCallback(0)(undefined, {'result': {'score': 1, 'distanceFromCentreSquared': 1, 'id': 'fakeSite1'}});
        testObject.createScoringCallback(1)(undefined, {'result': {'score': 2, 'distanceFromCentreSquared': 4, 'id': 'fakeSite2'}});
        assert(postCalled);
        assert.equal(fakeSiteUrl + '?room1Id=fakeSite1&room2Id=fakeSite2', options.url);
        assert.equal(options.headers['gameon-id'], npcId);
        assert(options.headers['gameon-date']);
        Date.parse(options.headers['gameon-date']);
        assert(options.headers['gameon-signature']);
    });
    it('should not swap a low scoring room that is already further from the centre', function() {
        var fakeSiteUrl = 'http://fakemap/map/v1/swapSites';
        var npcId = 'sweep';
        var testObject = new SiteScoringCallbackBuilder(2, fakeHttpRequest);
        testObject.createScoringCallback(0)(undefined, {'result': {'score': 1, 'distanceFromCentreSquared': 4, 'id': 'fakeSite1'}});
        testObject.createScoringCallback(1)(undefined, {'result': {'score': 2, 'distanceFromCentreSquared': 1, 'id': 'fakeSite2'}});
        assert(!postCalled);
    });
});
