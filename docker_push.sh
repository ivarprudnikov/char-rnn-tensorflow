#!/bin/bash -e

TIMESTAMP=$(date '+%Y%m%d%H%M%S')
VERSION="${TIMESTAMP}-${TRAVIS_COMMIT}"
ZIP="${VERSION}.zip"
REGISTRY_URL=${AWS_ACCOUNT_ID}.dkr.ecr.${EB_REGION}.amazonaws.com
SOURCE_IMAGE="${DOCKER_REPO}"
TARGET_IMAGE="${REGISTRY_URL}/${DOCKER_REPO}"
TARGET_IMAGE_LATEST="${TARGET_IMAGE}:latest"
TARGET_IMAGE_VERSIONED="${TARGET_IMAGE}:${VERSION}"

aws configure set default.region ${EB_REGION}

# Push image to ECR
###################

$(aws ecr get-login --no-include-email)

# update latest version
docker tag ${SOURCE_IMAGE} ${TARGET_IMAGE_LATEST}
docker push ${TARGET_IMAGE_LATEST}

# push new version
docker tag ${SOURCE_IMAGE} ${TARGET_IMAGE_VERSIONED}
docker push ${TARGET_IMAGE_VERSIONED}

# Deploy new version to Elasticbeanstalk
########################################

# Interpolate Dockerrun.aws.json and also create backup .bak file
sed -i.bak "s#<TARGET_IMAGE>#$TARGET_IMAGE_VERSIONED#" Dockerrun.aws.json
sed -i.bak "s#<NAME>#$DOCKER_REPO#" Dockerrun.aws.json

# Zip application
zip -r ${ZIP} Dockerrun.aws.json

# Copy application version over to S3
aws s3 cp ${ZIP} s3://${S3_BUCKET}/${ZIP}

# Create a new application version with the zipped up Dockerrun file
aws elasticbeanstalk create-application-version --application-name ${EB_APP} \
    --version-label ${VERSION} --source-bundle S3Bucket=${S3_BUCKET},S3Key=${ZIP}

# Update the environment to use the new application version
aws elasticbeanstalk update-environment --environment-name ${EB_ENV} \
      --version-label ${VERSION}
