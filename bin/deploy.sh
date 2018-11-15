#!/bin/bash

if [ -z "$SWEEP_ID" ] || [ -z "$SWEEP_SECRET" ] || [ -z "$CLOUDANT_URL" ] || [ -z ${SLACK_URL} ]; then
  echo "Check environment variables -- some are missing!"
  exit
fi

echo ${BASH_SOURCE[0]}
BIN=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ROOT=$( cd ${BIN}/.. && pwd )
SRC=${ROOT}/src
BUILD=${ROOT}/build

. .wskrc
${BIN}/wsk-login.sh

mkdir -p ${BUILD}
cd ${BUILD}

# Fresh npm install -- no test stuff
cp ${ROOT}/package.json ${BUILD}
npm install --production

# Create a nice common base zip file
zip -ruq base.zip node_modules

cd ${SRC}

# Get list of actions & triggers
actions=$(ls action* trigger*)

# Let's add the common modules
zip -u ${BUILD}/base.zip MapClient.js RoomClient.js ScoreBook.js SiteEvaluator.js SlackNotification.js SweepActions.js

cd ${BUILD}

# Common parameters
common="-p NODE_ENV production -p sweep_id ${SWEEP_ID} -p sweep_secret ${SWEEP_SECRET} -p cloudant_url ${CLOUDANT_URL} -p slack_url ${SLACK_URL}"

for x in $actions; do
  filename=$(basename $x)
  name=$(echo $filename | cut -f 1 -d '.')
  echo "*** ${name}"
  cp base.zip ${name}.zip
  cp ${SRC}/${filename} index.js
  zip -u ${name}.zip index.js

  echo "
  ibmcloud fn action update --kind nodejs:8 ${common} -t 300000 sweep/${name} ${name}.zip"
  ibmcloud fn action update --kind nodejs:8 ${common} -t 300000 sweep/${name} ${name}.zip
done
rm index.js
