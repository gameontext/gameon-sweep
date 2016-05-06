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
whisk = {
	'async' : function() {
		console.log("Called async");
	},
	'invoke' : function(params) {
		console.log("Called invoke with: " + JSON.stringify(params));
	}
}

var fs = require("fs")
var vm = require('vm')
eval(fs.readFileSync(__dirname + '/loadSites.js') + '');
main({
	'mapSitesUrl' : 'http://127.0.0.1:9099/map/v1/sites',
	'sweepId' : 'sweep',
	'sweepApiKey' : 'sweepSecret'
});