#!/bin/bash


packages=`find . -maxdepth 4 -name package.json`

export NPM_CONFIG_LOGLEVEL=info
for x in $packages
do
    pushd $(dirname $x)
    npm install -q
    npm install -g -q --only=dev
    popd
done
