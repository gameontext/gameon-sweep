#!/bin/bash
BIN=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ROOT=$( cd ${BIN}/.. && pwd )

echo "HI THERE! Let's set up your environment for Whisk actions."

if [ ! -f ${ROOT}/.wskrc ]; then
    echo "
  Let's set up an.wskrc file to make this easier.
  The.wskrc file is excluded from commits to git. Delete it at will.
"
    bluemix regions
    echo
    read -p "Choose a CF API Endpoint [api.eu-gb.bluemix.net]: " apihost
    export BLUEMIX_API_HOST=${apihost:-api.eu-gb.bluemix.net}

    if ${BIN}/wsk-login.sh
    then
      echo "BLUEMIX_API_HOST=${BLUEMIX_API_HOST}" >> ${ROOT}/.wskrc

      TARGET=$(bx target)
      BLUEMIX_EMAIL=$(echo $TARGET | cut -d ':' -f6 | awk '{print $1}')
      BLUEMIX_ACCOUNT=$(echo $TARGET | cut -d '(' -f3 | cut -d ')' -f1)
      BLUEMIX_ORG=$(echo $TARGET | cut -d ':' -f8 | awk '{print $1}')
      BLUEMIX_SPACE=$(echo $TARGET | cut -d ':' -f9 | awk '{print $1}')
      echo "BLUEMIX_EMAIL=$BLUEMIX_EMAIL" >> ${ROOT}/.wskrc
      echo "BLUEMIX_ACCOUNT=$BLUEMIX_ACCOUNT" >> ${ROOT}/.wskrc
      echo "BLUEMIX_ORG=$BLUEMIX_ORG" >> ${ROOT}/.wskrc
      echo "BLUEMIX_SPACE=$BLUEMIX_SPACE" >> ${ROOT}/.wskrc
    fi
else
    ${BIN}/wsk-login.sh
fi

echo "Testing whisk action:
bx wsk action invoke /whisk.system/utils/echo -p message hello --blocking --result

Response: "
bx wsk action invoke /whisk.system/utils/echo -p message hello --blocking --result
rc=$?
if [ $rc -eq 0 ]; then
  echo "All is well!"
  exit 0
else
  echo "Test invocation failed with return code $rc"
fi

HAS_NYC=$(which nyc)
if [ -z "$HAS_NYC"]; then
  echo "Installing istanbul command line: npm install -g nyc"
  npm install -g nyc
fi

npm install
