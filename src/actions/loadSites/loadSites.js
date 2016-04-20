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

	// Record what we get back from our call to the other action and
	// call done when they have all returned
	var expectedResponses = sites.length;
	var responses = new Array(sites.length);
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
				responses[i] = activation.result;
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
		var siteInformation = {
			id : site._id
		}
		if (site.info != null) {
			siteInformation.name = site.info.name;
		}
		whisk.invoke({
			name : 'checkSite',
			parameters : siteInformation,
			blocking : true,
			next : onResponse(index)
		});
	});
}

function buildGetSitesOptions(params) {
	var url;
	if (params && params.mapSitesUrl) {
		url = params.mapSitesUrl;
	} else {
		url = DEFAULT_SITES_URL;
	}
	var options = { url : url };
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
	var hash = crypto.createHmac('sha256', params.sweepApiKey).update(allParams)
			.digest('base64')

	console.log("HASH : " + hash)
	options.headers = {
		'Content-Type' : 'application/json',
		'gameon-id' : sweepId,
		'gameon-date' : timestamp,
		'gameon-signature' : hash
	}
}