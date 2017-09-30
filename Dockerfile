FROM node:7.5
MAINTAINER Erin Schnabel <schnabel@us.ibm.com> (@ebullientworks)

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update \
  && apt-get install -y \
     bzip2 \
     curl  \
     jq \
     sudo \
  && apt-get autoremove \
  && apt-get clean \
  && rm -rf /tmp/* /var/lib/apt/lists/*

#  Root user profile
RUN touch /root/.bashrc \
  && echo "/srv/sweep/bin/wsk-setup.sh" >> /root/.bashrc \
  && echo "if [ ! -f /srv/sweep/.wskrc ]; then source /srv/sweep/.wskrc; fi" >> /root/.bashrc \
  && echo 'export PATH=/srv/sweep/bin/:$PATH' >> /root/.bashrc

#  Installing Bluemix plugins (take updates w/o invalidating above layers)
RUN curl -fssSL https://clis.ng.bluemix.net/install/linux | bash \
  && /usr/local/bin/bx plugin install dev -r Bluemix \
  && /usr/local/bin/bx plugin install container-service -r Bluemix \
  && /usr/local/bin/bx plugin install container-registry -r Bluemix \
  && /usr/local/bin/bx plugin install cloud-functions -r Bluemix

ADD . /srv/sweep
WORKDIR /srv/sweep

CMD [ "echo", "docker-compose run sweep-dev /bin/bash" ]
