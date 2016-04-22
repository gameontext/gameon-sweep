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