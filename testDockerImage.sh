#!/bin/bash

DOCKER_DIR=.
DOCKER_TAG=xyz
MYSQL_DB_HOST=localhost
MYSQL_DB_USER=root
MYSQL_DB_PASS=
MYSQL_DB_NAME=rnn_generator

# build the image
docker build -t ${DOCKER_TAG} ${DOCKER_DIR}

# run in detached mode
# use host networking to access localhost
IMG=`docker run --rm -d \
        --network="host" \
        -e "MYSQL_HOST=${MYSQL_DB_HOST}" \
        -e "MYSQL_USER=${MYSQL_DB_USER}" \
        -e "MYSQL_PASSWORD=${MYSQL_DB_PASS}" \
        -e "MYSQL_DATABASE=${MYSQL_DB_NAME}" \
        -p 8080:8080 ${DOCKER_TAG}`

# wait for server to boot
sleep 5;

# Get server response
RESPONSE=`docker exec -it $IMG bash -c "curl --silent -I localhost:8080 | grep -E '^HTTP' "`

# Stop image
docker stop $IMG

# check response code
if [[ $RESPONSE == *200* ]]; then
  echo "server responds with status 200"
  exit 0
else
  echo "server failed with response $RESPONSE"
  exit 1
fi
