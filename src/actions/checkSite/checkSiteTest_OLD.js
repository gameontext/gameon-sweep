/*******************************************************************************
 * Copyright (c) 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
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
	describe('#parseText', function() {
	    it('should get the object and an array of routing information', function() {
	        var parsedText = parseText('a,b,{"property":"value"}');
	        assert.deepEqual(parsedText.routingInformation, ['a', 'b']);
	        assert.equal(parsedText.object.property, "value");
	    });
	    it('should accept no routing information', function() {
	        var parsedText = parseText('{"property":"value"}');
            assert(!parsedText.routingInformation);
            assert.equal(parsedText.object.property, "value");
	    });
	});
});