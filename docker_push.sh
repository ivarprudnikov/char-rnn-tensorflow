#!/bin/bash
$(aws ecr get-login --no-include-email --region eu-west-1)
docker tag "${DOCKER_REPO}:latest" "${REGISTRY_URL}/${DOCKER_REPO}:latest"
docker push "${REGISTRY_URL}/${DOCKER_REPO}:latest"
