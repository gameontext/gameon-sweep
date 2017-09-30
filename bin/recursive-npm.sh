#!/bin/bash
packages=`find . -maxdepth 4 -name package.json -not -path '*/node_modules/*'`

export NPM_CONFIG_LOGLEVEL=info
for x in $packages
do
    pushd $(dirname $x)
    npm install -q
    popd
done
