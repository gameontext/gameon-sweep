const assert = require('assert');
var invokedParams = [];
var asyncCalled =  false;
var doneCalled = false;
whisk = {
	'async' : function() {
		console.log("Called async");
		asyncCalled = true;
	},
	'invoke' : function(params) {
		console.log("Invoke called with " + JSON.stringify(params));
		invokedParams.push(params);
		if (params.next) {
			params.next(null, {'result': 'OK'});
		}
	},
	'done' : function() {
		doneCalled = true;
	}
}

var fs = require("fs");
eval(fs.readFileSync(__dirname + '/loadSites.js')+'');

describe('Load sites', function() {
	describe('#allSitesResponseHandler', function() {
		beforeEach(function() {
			invokedParams = [];
			doneCalled = false;
		});
		it('should invoke whisk.invoke for each site', function() {
			allSitesResponseHandler(null, null, JSON.stringify([{'_id': 'first'}, {'_id': 'second'}]));
			assert.equal(invokedParams.length, 2);
		});
		it('should pass the correct params to whisk.invoke', function() {
			var testId = 'testId';
			var testName = 'testName';
			allSitesResponseHandler(null, null, JSON.stringify([{'_id': testId, 'info': {'name': testName}}]));
			var params = invokedParams[0];
			assert.equal(params.name, 'checkSite');
			assert(params.blocking);
			assert(params.next);
			assert.equal(params.parameters.id, testId);
			assert.equal(params.parameters.name, testName);
		});
		it('should call whisk done when complete', function() {
			allSitesResponseHandler(null, null, JSON.stringify([{'_id': 'first'}, {'_id': 'second'}]));
			assert(doneCalled);
		});
	});
	
	describe('#buildGetSitesOptions', function() {
		it('should add the url from params to the options', function() {
			var testUrl = 'http://example.com/sites';
			var result = buildGetSitesOptions({'mapSitesUrl': testUrl});
			assert.equal(result.url, testUrl);
		});
		it('should use a default URL if none is provided', function() {
			var result = buildGetSitesOptions();
			assert.equal(result.url, 'https://game-on.org/map/v1/sites');
		});
		it.skip('should include the HMAC header and associated information', function() {
			
		});
	});
});
