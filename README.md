# gameon-sweep

[![Codacy Badge](https://api.codacy.com/project/badge/grade/f803378b8e5c4bb29dd18789aab78c18)](https://www.codacy.com/app/gameontext/gameon-sweep)

A service that checks if rooms are still working and moves them if not

## Docker for local dev/test

The Docker image will contain bx plugins, node, npm modules, etc.

    docker-compose build
    docker-compose run --rm sweep-dev /bin/bash

## Notes on building:

* `bin/recursive-dev.sh` recurses project folders (avoiding node_modules) and installs those direct dependencies globally.
* `bin/recursive-npm.sh` recurses project folders (avoiding node_modules) to execute the given npm command.
* This whole thing requires bash. I'm lazy. 

## Available packages

* https://console.bluemix.net/docs/openwhisk/openwhisk_reference.html#openwhisk_ref_javascript_environments
* https://github.com/apache/incubator-openwhisk/blob/master/docs/reference.md#javascript-runtime-environments

## Whisk Actions

Sweep works by having two actions, one that interacts with the map API to load and move rooms and one that checks an individual rooms web socket.  The flow is as follows:


1.  The loadSites action calls map/v1/sites to load all the sites using Sweep's secret to include the connection details 
2.  loadSites asynchronously invokes checkSite for each non-empty site returned from the map in a random order
3.  checkSite connects to the web sockets and sends the following messages to the web socket before waiting for an appropriate response:
    1.  Connect to the web socket, either with or without the room secret depending on whether one is provided.  Wait for an ack message back from the room.
    2.  Send a roomHello message.  Wait for a "location" message and an "event" message back saying sweep has entered the room.
    3.  Send a chat message.  Wait for it to send the chat broadcast to the room.
    4.  Send a roomGoodbye message.  Wait for an "event" message saying sweep has left the room.
    5.  Close the connection.
    For each check that is succesfully received the room will be award 100 points with a 1 point penalty for every second it takes to return.  So a room that takes 5 seconds to send an ack message will receive 95 points for that check.  This means there is a maximum score of 500 points.  After 20 seconds each check will time out and the room will score -30.  There is also a -10 penalty for any errors that are sent to the web socket.  If the first check (connecting) fails no other checks will be performed so the minimum score a room could receive is -40.
4.  When the checks are complete checkSite will return the score.
5.  Each time a pair of scores have been received by loadSites they are compared, if the higher score is further from the centre then the room positions are swapped so over time higher scoring rooms will reach the centre positions.
6.  When all the sites have been checked the loadSites sends the results to whisk.

Each of the actions are setup to run mocha tests that can be executed by running the following from each action's directory:

        npm test

Whisk only allows a single JavaScript file but we need to use the nodejs-websocket node library on checkSite and crypto on loadSites which aren't included in Whisk.  Luckily there is a webpack thing that you can use in node to transform this into a single file which is done by calling in each action's directory:

        npm run build

as per the article [here.](https://developer.ibm.com/openwhisk/2016/03/17/bundling-openwhisk-actions-with-webpack/).

You can also execute both actions locally by running:

        node runInNode
  
To get these into whisk you need to setup your whisk CLI as described in the [Bluemix documentation](https://new-console.ng.bluemix.net/openwhisk/cli).  In addition you need to set the namespace to the one that Whisk will use by default (for me this was iain.duncan@uk.ibm.com) or use the Microservices_dev namespace to be shared within the whole org (although only you will be able to see the activations).  Do this with the following and then [create the actions](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_actions.html#openwhisk_create_action_js):

    wsk property set --namespace <your_namespace OR Microservices_dev>
    wsk action create loadSites src/src/loadSites/dist/bundle.js --param sweepId </npc/sweep/id from etcd> --param sweepApiKey </npc/sweep/password from etcd> --param namespace <your_namespace OR Microservices_dev>
    wsk action create checkSite src/src/checkSite/dist/bundle.js

You can then manually trigger the chain with the following:

    wsk action invoke loadSites --blocking --result

In addition you can create a trigger to [run this](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_triggers_rules.html#openwhisk_rules) every hour with the [following](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_catalog.html#openwhisk_catalog_alarm) (note this is slightly different to the docs which I believe are wrong and would run the trigger 60 times every hour, also on Windows ' give an error on the params whereas " do not):

    wsk trigger create periodic --feed /whisk.system/alarms/alarm --param cron "0 0 * * * *"
    wsk rule create --enable periodicallyRunLoadSites periodic loadSites

### Dockerisation for local testing

At present this isn't setup to run in a Docker container so it will be hard to do local integration tests with the other services.  I think that it will be easier to run this using node and the mocked out the whisk.js that is already written rather than standing up a local instance of Whisk (although this is an option as explained on their [github](https://github.com/openwhisk/openwhisk)).  Doing it this way does mean that it isn't really running what we'd run in production and will have to do some special linking code that whisk would have done for us through action invocations.

### Deployment

Dunno!  We need to work out how to get the `wsk action create/update` calls into an IDS pipeline.  I assume it wouldn't be deployed within ICS though.

## Contributing

Want to help! Pile On! 
[Contributing to Game On!](https://github.com/gameontext/gameon/blob/master/CONTRIBUTING.md)
