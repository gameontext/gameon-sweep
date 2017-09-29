#!/bin/bash

# Install or update bx plugins
PLUGINS=$(bx plugin list)
echo "Installing / Upgrading bluemix dev plugin"
if echo $PLUGINS | grep dev
then
  bx plugin update dev -r Bluemix
else
  bx plugin install dev -r Bluemix
fi

echo "Installing / Upgrading bluemix container-service plugin"
if echo $PLUGINS | grep container-service
then
  bx plugin update container-service -r Bluemix
else
  bx plugin install container-service -r Bluemix
fi

echo 'Installing / Upgrading Bluemix container-registry plugin'
if echo $PLUGINS | grep container-registry
then
  bx plugin update container-registry -r Bluemix
else
  bx plugin install container-registry -r Bluemix
fi

echo 'Installing / Upgrading Bluemix cloud-functions plugin'
if echo $PLUGINS | grep cloud-functions
then
  bx plugin update cloud-functions -r Bluemix
else
  bx plugin install cloud-functions -r Bluemix
fi
