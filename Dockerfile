FROM python:3.6

# replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# prepare workdir
ENV APP_PATH /app
RUN mkdir -p $APP_PATH
COPY . $APP_PATH

WORKDIR $APP_PATH/server

# install generator dependencies
RUN pip install -r $APP_PATH/generator/requirements.txt

# Install node.js
ENV NODE_VERSION 10.12.0
ENV NVM_DIR /usr/local/nvm
RUN mkdir -p $NVM_DIR

# install nvm
# https://github.com/creationix/nvm#install-script
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash

# install node and npm
RUN echo "source $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use default" | bash

# add node and npm to path so the commands are available
ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# confirm installation
RUN node -v
RUN npm -v

# install server dependencies
RUN npm i

EXPOSE 8080

CMD ["npm", "start"]
