# gameon-sweep

[![Codacy Badge](https://api.codacy.com/project/badge/grade/f803378b8e5c4bb29dd18789aab78c18)](https://www.codacy.com/app/gameontext/gameon-sweep)

A service that checks if rooms are still working and moves them if not

## A whisk in progress

This branch contains a few thoughts about how a whisk implementation might look.

The rough plan is that there will be (at least) two actions.  The first will go to the map/mediator and load all of the available sites.  It will then iterate through these and for each site call into a second action that creates a web socket to poke the site.  Once it has been poked something (tbd - probably the same action that is creating the web socket) will assign it a score based on how the poking went then another thing (tbd - probably another action) will then do something (tbd - probably either move it closer to the centre of the map for a good score or further away/off the map for a bad score) to it based on that score.

I've started working on the action to load the rooms and connect via a web socket.  There are a few caveats with each:

* `src/actions/loadSites`: This contains the code to load the sites and connect to the other action that connects via a web socket to the site.  Currently it needs to have the following TODOs:
  * Tests
  * Doing something with the results from the invocations to the web socket
  * Add the location of the web socket to the params.  Currently the map doesn't return this so need some special auth for the NPC to say we're allowed to get it.
* `src/actions/checkSite`: This contains the code to create a web socket.  Whisk only allows a single JavaScript file but we need to use the nodejs-websocket node library.  Luckily there is a webpack thing that you can use in node to transform this into a single file which is done by calling:

        npm run build

   as per the article [here.](https://developer.ibm.com/openwhisk/2016/03/17/bundling-openwhisk-actions-with-webpack/)  TODOs:
  * Tests
  * Actually connect to the ws supplied in the params.
  * Actually do some checks on the web socket connection
  * This seems to fail regularly.  It says that it isn't returning a valid JSON object.  I'm not sure what happens here, I tried to put a try catch around the connection but that isn't being triggered.  It may be that it's the other end of the web socket that has an error or it just times out or something.  As the load sites doesn't pass in a ws address it just connects to the web socket sample that I am hosting on my own Bluemix account.
  
To get these into whisk you need to setup your whisk CLI as described in the [Bluemix documentation](https://new-console.ng.bluemix.net/openwhisk/cli).  In addition you need to set the namespace to the one that Whisk will use by default (for me this was iain.duncan@uk.ibm.com).  Do this with the following and then [create the actions](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_actions.html#openwhisk_create_action_js):

    wsk property set --namespace <your_namespace>
    wsk action create loadSites src/actions/loadSites/loadSites.js
    wsk action create checkSite src/actions/checkSite/dist/bundle.js

You can then manually trigger the chain with the following:

    wsk action invoke loadSites --blocking --result

In addition you can create a trigger to [run this](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_triggers_rules.html#openwhisk_rules) every hour with the [following](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_catalog.html#openwhisk_catalog_alarm) (note this is slightly different to the docs which I believe are wrong and would run the trigger 60 times every hour, also on Windows ' give an error on the params whereas " do not):

    wsk trigger create periodic --feed /whisk.system/alarms/alarm --param cron "0 0 * * * *"
    wsk rule create --enable periodicallyRunLoadSites periodic loadSites

### Local testing

To be able to execute these locally you'll need to mock out the whisk calls.  I think something like this may work:

    var action = requrie ('<actual_action_js_file>')
    var whisk = {
        async = function() {},
        done = function() {},
        invoke = function() {}
    }
    action.main();

Assuming this in local.js then calling:

    node local.js

Should run the action.

### Dockerisation for local testing

At present this isn't setup to run in a Docker container so it will be hard to do local integration tests with the other services.  I think that it will be easier to run this using node and mock out the whisk.js that is available when running on Bluemix rather than standing up a local instance of Whisk (although this is an option as explained on their [github](https://github.com/openwhisk/openwhisk)).  Doing it this way does mean that it isn't really running what we'd run in production and will have to do some special linking code that whisk would have done for us through action invocations.

### Deployment

Dunno!  We need to work out how to get the `wsk action create/update` calls into an IDS pipeline.  I assume it wouldn't be deployed within ICS though.

## Contributing

Want to help! Pile On! 
[Contributing to Game On!](https://github.com/gameontext/gameon/blob/master/CONTRIBUTING.md)
