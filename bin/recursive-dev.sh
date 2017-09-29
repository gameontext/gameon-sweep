#!/bin/bash

packages=`find . -maxdepth 4 -name package.json -not -path '*/node_modules/*'`

export NPM_CONFIG_LOGLEVEL=info
for x in $packages
do
    specs=$(cat $x | jq -r '.devDependencies | to_entries | map([.key, .value] | join("@")) | .[]')
    echo "Installing dev dependencies globally (common between actions)"
    npm install -q -g $specs
done
