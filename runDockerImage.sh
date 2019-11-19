#!/bin/bash

DOCKER_DIR=.
DOCKER_TAG=xyz
MYSQL_DB_HOST=docker.for.mac.localhost
MYSQL_DB_USER=root
MYSQL_DB_PASS=
MYSQL_DB_NAME=rnn_generator

mysql -u${MYSQL_DB_USER} -e "drop database if exists ${MYSQL_DB_NAME}; create database ${MYSQL_DB_NAME};"
mysql -u${MYSQL_DB_USER} -D ${MYSQL_DB_NAME} < mysql_setup/V1__init.sql
mysql -u${MYSQL_DB_USER} -D ${MYSQL_DB_NAME} < mysql_setup/bootstrap.sql

# build the image
docker build -t ${DOCKER_TAG} ${DOCKER_DIR}

# run image
docker run --rm -it \
        -e "MYSQL_HOST=${MYSQL_DB_HOST}" \
        -e "MYSQL_USER=${MYSQL_DB_USER}" \
        -e "MYSQL_PASSWORD=${MYSQL_DB_PASS}" \
        -e "MYSQL_DATABASE=${MYSQL_DB_NAME}" \
        -p 8080:8080 ${DOCKER_TAG}
