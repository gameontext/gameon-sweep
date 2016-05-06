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

function main(params) {

    request.get(buildGetSitesOptions(params), allSitesResponseHandler);

    return whisk.async();
}

function allSitesResponseHandler(error, response, body) {
    var sites = JSON.parse(body);
    var output = 'Have loaded ' + sites.length + ' sites.';

    // Randomize the order so that we get different pairs to compare
    shuffleArray(sites);

    // Record what we get back from our call to the other action and
    // call done when they have all returned
    var expectedResponses = sites.length;
    var responses = new Array(sites.length);
    var lastResponse = undefined;
    var onResponse = function(i) {
        return function(error, activation) {
            console.log("Have returned from " + i);
            if (error) {
                console.log("It was an error: " + error);
                responses[i] = {
                    "error" : error
                };
            } else {
                console.log("It worked!: " + activation);
                responses[i] = (activation) ? activation.result : undefined;
            }
            expectedResponses -= 1;
            if (expectedResponses === 0) {
                console.log("Nearly done, going to return: " + {
                    "elements" : responses
                });
                whisk.done({
                    "elements" : responses
                });
            }
        }
    }

    sites.forEach(function(site, index) {
        if (site.info && site.info.connectionDetails) {
            var siteInformation = {
                id : site._id,
                name : site.info.name,
                connectionLocation : site.info.connectionDetails.target,
                connectionType : site.info.connectionDetails.type,
                connectionSecret : site.info.connectionDetails.token
            }
            whisk.invoke({
                name : 'checkSite',
                parameters : siteInformation,
                blocking : true,
                next : onResponse(index)
            });
        } else {
            onResponse(index)();
        }
    });
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
    if (params && params.sweepId && params.sweepApiKey) {
        addSecurityHeaders(options, params);
    }
    return options;
}

function addSecurityHeaders(options, params) {
    var now = new Date()
    var timestamp = now.toISOString()

    console.log("Now!: " + now)
    console.log("Timestamp: " + timestamp)

    var sweepId = params.sweepId;
    var allParams = sweepId + timestamp
    var hash = crypto.createHmac('sha256', params.sweepApiKey)
            .update(allParams).digest('base64')

    console.log("HASH : " + hash)
    options.headers = {
        'Content-Type' : 'application/json',
        'gameon-id' : sweepId,
        'gameon-date' : timestamp,
        'gameon-signature' : hash
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