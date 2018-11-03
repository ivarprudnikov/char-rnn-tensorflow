FROM python:3.6

# replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

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

# prepare workdir
ENV APP_PATH /app
ENV SERVER_PATH /app/server
ENV GENERATOR_PATH /app/generator
RUN mkdir -p $SERVER_PATH $GENERATOR_PATH

# separate installation of python deps and copying python assets
# to make sure docker caches installation step
COPY generator/requirements.txt $GENERATOR_PATH/requirements.txt
RUN pip install -r $GENERATOR_PATH/requirements.txt

# separate installation of npm modules
# to make sure docker caches installation step
COPY server/package.json $SERVER_PATH/package.json
COPY server/package-lock.json $SERVER_PATH/package-lock.json
RUN cd $SERVER_PATH && npm install

COPY . $APP_PATH

WORKDIR $SERVER_PATH

EXPOSE 8080

CMD ["npm", "start"]
