#!/bin/bash
if [ -z "${ROOT}" ]; then
  echo ${BASH_SOURCE[0]}
  BIN=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
  ROOT=$( cd ${BIN}/.. && pwd )
fi

if [ -f ${ROOT}/.wskrc ]; then
  source ${ROOT}/.wskrc
fi

createApiKey() {
  echo "Checking Bluemix API Key $BLUEMIX_API_KEY"
  if [ -z "$BLUEMIX_API_KEY" ]; then
    KEY_NAME="${KEY_NAME}-$(hostname)-${LOGNAME}"
    echo
    echo "Creating an API key: bluemix iam api-key-create ${KEY_NAME}"
    response=$(bluemix iam api-key-create ${KEY_NAME})
    rc=$?
    if [ $rc -eq 0 ]; then
      export BLUEMIX_API_KEY=$(echo $response | sed -e 's/.*API Key //')
      echo "BLUEMIX_API_KEY=${BLUEMIX_API_KEY}" >> ${ROOT}/.wskrc
      echo "Saved authorization key [$BLUEMIX_API_KEY] to ${ROOT}/.wskrc"
    else
      echo $response
      echo
      echo "Unable to generate API key. Try again manually"
      exit 1
    fi
  fi
}

login() {
  if bx target >/dev/null 2>/dev/null
  then
    echo "Already logged in"
  else
    COMMAND="bx login"
    if [ -n "$BLUEMIX_API_HOST" ]; then
      COMMAND="${COMMAND} -a $BLUEMIX_API_HOST"
    fi
    if [ -n "$BLUEMIX_EMAIL" ]; then
      COMMAND="${COMMAND} -u ${BLUEMIX_EMAIL}"
    fi
    if [ -n "$BLUEMIX_ACCOUNT" ]; then
      COMMAND="${COMMAND} -c ${BLUEMIX_ACCOUNT}"
    fi
    if [ -n "$BLUEMIX_ORG" ]; then
      COMMAND="${COMMAND} -o ${BLUEMIX_ORG}"
    fi
    if [ -n "$BLUEMIX_SPACE" ]; then
      COMMAND="${COMMAND} -s ${BLUEMIX_SPACE}"
    fi
    if [ -n "$BLUEMIX_API_KEY" ]; then
      COMMAND="${COMMAND} --apikey ${BLUEMIX_API_KEY}"
    fi

    echo "
    Logging into bluemix: $COMMAND
    "
    $COMMAND
    rc=$?
    if [ $rc -eq 0 ]; then
      if [ -z "$BLUEMIX_ACCOUNT" ] || [ -z "$BLUEMIX_ORG" ] || [ -z "$BLUEMIX_SPACE" ]; then
        bx target --cf
      fi
    else
      return 1
    fi
  fi
  return 0
}


if login
then
  createApiKey
fi
exit 1
