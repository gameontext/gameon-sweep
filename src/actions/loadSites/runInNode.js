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
eval(fs.readFileSync(__dirname + '/loadSites.js')+'');
main();