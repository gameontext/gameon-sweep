const assert = require('assert');

var fs = require("fs");
eval(fs.readFileSync(__dirname + '/checkSite.js')+'');
eval(fs.readFileSync(__dirname + '/../../common/fakeWhisk.js')+'');

describe('Check sites', function() {
	describe('#getConnectionLocation', function() {
		it('should get the location out of the params', function() {
			const location = 'ws://wibble';
			assert.equal(getConnectionLocation({'connectionLocation': location}), location);
		});
	});
	describe('#getWsConnectionOptions', function() {
		it('should add the protocol header', function() {
			assert.equal(getWsConnectionOptions().extraHeaders['gameon-protocol'], 'mediator,1.1');
		});
		it('should have signature headers in the options when there is a secret in the params', function() {
			var headers = getWsConnectionOptions({'connectionSecret':'a secret'}).extraHeaders;
			assert(headers);
			assert(headers['gameon-signature']);
			assert(headers['gameon-date']);
			Date.parse(headers['gameon-date']);
		});
	});
	describe('#createOnConnectHandler', function() {
		
	});
});