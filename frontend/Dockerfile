FROM node:alpine
RUN mkdir /indexer
WORKDIR /indexer

ADD package.json yarn.lock ./
RUN yarn

ADD . ./
ARG BACKEND
RUN yarn build

ENTRYPOINT [ "yarn", "start" ]