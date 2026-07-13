# .devcontainer/Dockerfile v.1.1.0

# This Dockerfile is used to build a development container for Node.js applications.

FROM node:24-trixie-slim

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git sudo \
  && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node \
  && rm -rf /var/lib/apt/lists/*
