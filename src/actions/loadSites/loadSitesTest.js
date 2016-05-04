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
            allSitesResponseHandler(null, null, JSON.stringify([ {
                '_id' : 'first'
            }, {
                '_id' : 'second'
            } ]));
            assert.equal(invokedParams.length, 2);
        });
        it('should pass the correct params to whisk.invoke', function() {
            var testId = 'testId';
            var testName = 'testName';
            var testConnectionSecret = 'testSecret';
            var testConnectionLocation = 'ws://testlocation';
            var testConnectionType = 'websocket';
            allSitesResponseHandler(null, null, JSON.stringify([ {
                '_id' : testId,
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
            assert.equal(params.parameters.name, testName);
            assert.equal(params.parameters.connectionType, testConnectionType);
            assert.equal(params.parameters.connectionSecret,
                    testConnectionSecret);
            assert.equal(params.parameters.connectionLocation,
                    testConnectionLocation);
        });
        it('should call whisk done when complete', function() {
            allSitesResponseHandler(null, null, JSON.stringify([ {
                '_id' : 'first'
            }, {
                '_id' : 'second'
            } ]));
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
