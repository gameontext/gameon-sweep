#!/bin/bash

# Install or update ibmcloud plugins
PLUGINS=$(ibmcloud plugin list)
echo "Installing / Upgrading IBM Cloud dev plugin"
if echo $PLUGINS | grep dev
then
  ibmcloud plugin update dev -r Bluemix
else
  ibmcloud plugin install dev -r Bluemix
fi

echo "Installing / Upgrading IBM Cloud container-service plugin"
if echo $PLUGINS | grep container-service
then
  ibmcloud plugin update container-service -r Bluemix
else
  ibmcloud plugin install container-service -r Bluemix
fi

echo 'Installing / Upgrading IBM Cloud container-registry plugin'
if echo $PLUGINS | grep container-registry
then
  ibmcloud plugin update container-registry -r Bluemix
else
  ibmcloud plugin install container-registry -r Bluemix
fi

echo 'Installing / Upgrading IBM Cloud cloud-functions plugin'
if echo $PLUGINS | grep cloud-functions
then
  ibmcloud plugin update cloud-functions -r Bluemix
else
  ibmcloud plugin install cloud-functions -r Bluemix
fi
