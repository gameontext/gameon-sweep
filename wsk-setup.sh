#!/bin/sh

echo "HI THERE!
This container provides a development envionment for Whisk actions."

cd /srv/sweep

if [ -n $USE_COMPOSE ] && [ ! -f .env ]
then
    echo "
  Let's set up an .env file to make this easier.
  The .env file is excluded from commits to git. Delete it at will.
"
    read -p "OpenWhisk API host [openwhisk.ng.bluemix.net]: " apihost
    export WHISK_API_HOST=${apihost:-openwhisk.ng.bluemix.net}

    read -p "Authorization Key: " apikey
    export WHISK_API_KEY=${apikey}

    if ./wsk-login.sh
    then
        echo "WHISK_API_HOST=${WHISK_API_HOST}" > .env
        echo "WHISK_API_KEY=${WHISK_API_KEY}" >> .env
    fi
elif [ -n "${WHISK_API_HOST}" ] && [ -n "${WHISK_API_KEY}" ]
then
    ./wsk-login.sh
else
    echo "
  Please set both WHISK_API_HOST and WHISK_API_KEY environment variables.
  Consider launching with 'docker-compose run sweep-dev /bin/bash' to have some
  help setting them.
"
fi

echo "** Build/install of nested whisk actions: recursive-npm.sh"

./recursive-npm.sh
