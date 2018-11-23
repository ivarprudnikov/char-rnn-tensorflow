#!/bin/bash

# update latest image and save current version in ECR

$(aws ecr get-login --no-include-email --region eu-west-1)

SOURCE_IMAGE="${DOCKER_REPO}"
TARGET_IMAGE="${REGISTRY_URL}/${DOCKER_REPO}"

docker tag "${SOURCE_IMAGE}:latest" "${TARGET_IMAGE}:latest"
docker push "${TARGET_IMAGE}:latest"
