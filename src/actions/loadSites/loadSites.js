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
var request = require('request');
var crypto = require("crypto");
var DEFAULT_SITES_URL = 'https://game-on.org/map/v1/sites';
var DEFAULT_SWAP_SITES_URL = 'https://game-on.org/map/v1/swapSites'

function main(params) {

    request.get(buildGetSitesOptions(params), createAllSitesResponseHandler(params));

    return whisk.async();
}

function createAllSitesResponseHandler(params) {
    return function(error, response, body) {
        var sites = JSON.parse(body);
        var output = 'Have loaded ' + sites.length + ' sites.';
    
        // Randomize the order so that we get different pairs to compare
        shuffleArray(sites);
    
        responseHandlerBuilder = new SiteScoringCallbackBuilder(sites.length, request, params);
    
        sites.forEach(function(site, index) {
            if (site.info && site.info.connectionDetails) {
                var coord = site.coord;
                var siteInformation = {
                    id : site._id,
                    name : site.info.name,
                    distanceFromCentreSquared : coord.x * coord.x + coord.y * coord.y,
                    connectionLocation : site.info.connectionDetails.target,
                    connectionType : site.info.connectionDetails.type,
                    connectionSecret : site.info.connectionDetails.token
                }
                whisk.invoke({
                    name : 'checkSite',
                    parameters : siteInformation,
                    blocking : true,
                    next : responseHandlerBuilder.createScoringCallback(index)
                });
            } else {
                responseHandlerBuilder.createScoringCallback(index)();
            }
        });
    }
}

function SiteScoringCallbackBuilder(sitesLength, httpRequest, params) {
    var self = this; 
    this.expectedResponses = sitesLength;
    this.responses = new Array(sitesLength);
    this.lastResponse = undefined;
    this.httpRequest = httpRequest;
    this.params = params;
    this.createScoringCallback = function(index) {
        return function(error, activation) {
            if (error) {
                console.log("Result from " + index + " was an error: " + JSON.stringify(error));
                self.responses[index] = {
                    "error" : error
                };
            } else {
                console.log("Result from " + index + ": " + JSON.stringify(activation));
                var result = (activation) ? activation.result : undefined;
                self.responses[index] = result;
                if (result) {
                    if (self.lastResponse) {
                        if (self.needsSwapping(self.lastResponse, result)) {
                            console.log('Swapping site locations ' + self.lastResponse.id + ' ' + result.id);
                            var firstRoomId = self.lastResponse.id;
                            var secondRoomId = result.id;
                            httpRequest.post(buildSwapSitesOptions(self.params, firstRoomId, secondRoomId), function(error, response, body) {
                                console.log('Received response from ' + firstRoomId + ' swapping with ' + secondRoomId);
                                console.log('Error was ' + error);
                                console.log('Response was ' + JSON.stringify(response));
                                console.log('Body was ' + JSON.stringify(body));
                            });
                        } else {
                            console.log('No need to swap sites '  + self.lastResponse.id + ' ' + result.id);
                        }
                        self.lastResponse = undefined;
                    } else {
                        self.lastResponse = result;
                    }
                }
            }
            self.expectedResponses -= 1;
            if (self.expectedResponses === 0) {
                var returnObject = {
                    "sitesChecked" : self.responses
                };
                console.log('Have all responses back so return with ' + JSON.stringify(returnObject));
                whisk.done(returnObject);
            }
        }
    }
    this.needsSwapping = function(firstResult, secondResult) {
        if (firstResult.distanceFromCentreSquared > secondResult.distanceFromCentreSquared) {
            return firstResult.score > secondResult.score;
        } else {
            return secondResult.score > firstResult.score;
        }
    }
}

function buildSwapSitesOptions(params, id1, id2) {
    var url;
    if (params && params.mapSwapSitesUrl) {
        url = params.mapSwapSitesUrl;
    } else {
        url = DEFAULT_SWAP_SITES_URL;
    }
    url = url + '?room1Id=' + id1 + '&room2Id=' + id2;
    var options = {
        url : url
    };
    addSecurityHeaders(options, params);
    return options;
}

function buildGetSitesOptions(params) {
    var url;
    if (params && params.mapSitesUrl) {
        url = params.mapSitesUrl;
    } else {
        url = DEFAULT_SITES_URL;
    }
    var options = {
        url : url
    };
    addSecurityHeaders(options, params);
    return options;
}

function addSecurityHeaders(options, params) {
    if (params && params.sweepId && params.sweepApiKey) {
        var now = new Date()
        var timestamp = now.toISOString()
    
        var sweepId = params.sweepId;
        var allParams = sweepId + timestamp
        var hash = crypto.createHmac('sha256', params.sweepApiKey)
                .update(allParams).digest('base64')
    
        options.headers = {
            'Content-Type' : 'application/json',
            'gameon-id' : sweepId,
            'gameon-date' : timestamp,
            'gameon-signature' : hash
        }
    }
}

function shuffleArray(array) {
    for (var i = 0; i < array.length - 1; i++) {
        var j = i + Math.floor(Math.random() * (array.length - i));

        var temp = array[j];
        array[j] = array[i];
        array[i] = temp;
    }
}