FROM node:alpine
RUN mkdir /indexer
WORKDIR /indexer

ADD package.json yarn.lock ./
RUN yarn

ADD . ./
ENTRYPOINT [ "node", "index.js" ]