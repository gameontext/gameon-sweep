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

${BIN}/wsk-login.sh

mkdir -p ${BUILD}
cd ${BUILD}

# Fresh npm install -- no test stuff
cp ${ROOT}/package.json ${BUILD}
npm install --production

# Create a nice common base zip file
zip -ruq base.zip node_modules

cd ${SRC}
actions=$(find -name 'action*')

# Let's add the common modules
zip -u ${BUILD}/base.zip MapClient.js RoomClient.js ScoreBook.js SiteEvaluator.js SlackNotification.js

cd ${BUILD}

# Common parameters
common="-p sweep_id ${SWEEP_ID} -p sweep_secret ${SWEEP_SECRET} -p cloudant_url ${CLOUDANT_URL} -p slack_url ${SLACK_URL}"

# Coordinated timeouts for sequence
# actionScoreAll
# | --> actionFetch (parallel / async)
# |     | --> sweep/evaluate (internal / sequential)
# |     |     +-> actionDescription (30s == 30000) -- 30000
# |     |         +-> actionRepository (30s == 30000) -- 60000
# |     |             +-> actionEndpoint (3 min == 180000) -- 240000
# |     |                 +-> actionRecord (30s == 30000)  -- 270000
# |     | <-- promise (timeout  -- 280000)
# | <-- all promises (timeout -- 300000, max 5 minutes)

for x in $actions; do
  filename=$(basename $x)
  name=$(echo $filename | cut -f 1 -d '.')
  echo "*** ${name}"
  cp base.zip ${name}.zip
  cp ${SRC}/${filename} index.js
  zip -u ${name}.zip index.js

  case $name in
    actionEvaluate)
      wsk_args="-t 280000"
    ;;
    *)
      wsk_args='-t 300000'
    ;;
  esac

  bx wsk action update --kind nodejs:6 ${common} ${wsk_args} sweep/${name} ${name}.zip
done
rm index.js
