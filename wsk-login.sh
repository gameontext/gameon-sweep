#!/bin/bash

echo "
Setting your API host and Authorization key...
"
wsk property set --apihost $WHISK_API_HOST --auth $WHISK_API_KEY
rc=$?
if [ $rc -eq 0 ]
then
  echo "
  Successfully set API host and Authorization key, verifying connection details...
"
  wsk action invoke /whisk.system/utils/echo -p message hello --blocking --result
  if [ $rc -eq 0 ]
  then
      echo "
  All is well!
"
  else
      echo "
  Test invocation failed with return code $rc
"
  fi
else
  echo "
  Could not set API host or Authorization key, failed with return code $rc
"
fi
exit $rc
