FROM davad/docker-node-babel

MAINTAINER Erin Schnabel <schnabel@us.ibm.com> (@ebullientworks)

## This image helps develop and test the Sweep.
## It contains node, npm, and the Whisk CLI.

RUN wget https://openwhisk.ng.bluemix.net/cli/go/download/linux/amd64/wsk \
 && mv wsk /usr/local/bin \
 && chmod +x /usr/local/bin/wsk

ADD . /srv/sweep
WORKDIR /srv/sweep

RUN touch /root/.bashrc \
 && echo "/srv/sweep/wsk-setup.sh" >> /root/.bashrc

CMD [ "echo", "docker-compose run sweep-dev /bin/bash" ]
