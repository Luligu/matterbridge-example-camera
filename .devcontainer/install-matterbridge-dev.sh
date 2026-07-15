#!/usr/bin/env bash

# .devcontainer/install-matterbridge-dev.sh v.1.1.0

# This script globally installs Matterbridge from the dev branch.
# To be used only inside the Dev Container with the mounted matterbridge volume.

set -euo pipefail

echo "1 - Installing Matterbridge from the dev branch..."
cd /
if [ ! -d "/workspaces" ]; then
  echo "Directory /workspaces does not exist. Exiting."
  exit 1
fi

echo "2 - Preparing Matterbridge directory..."
sudo mkdir -p /home/node/.npm
sudo chown -R node:node /home/node/.npm
sudo chown -R node:node matterbridge
sudo chmod g+s matterbridge
sudo rm -rf matterbridge/* matterbridge/.[!.]* matterbridge/..?*

echo "3 - Cloning Matterbridge from the dev branch..."
# Shallow clone for speed (history not needed inside dev container). Remove --depth if full history required.
git clone --depth 1 --single-branch --no-tags -b dev https://github.com/Luligu/matterbridge.git matterbridge
cd matterbridge

echo "4 - Setting Matterbridge version..."
SHA7=$(git rev-parse --short=7 HEAD) && BASE_VERSION=$(node -p "require('./package.json').version.split('-')[0]") && npm pkg set version="${BASE_VERSION}-git-${SHA7}"

echo "5 - Installing Matterbridge dependencies and building..."
npm ci --no-fund --no-audit && npm run build

echo "6 - Building Matterbridge frontend..."
cd apps/frontend && npm ci --no-fund --no-audit && npm run build && cd ../..

echo "7 - Installing Matterbridge globally..."
sudo npm install . --global --no-fund --no-audit
sudo rm -rf .agents .cache .claude .codex .devcontainer .git .github .vscode docker docs reflector screenshots scripts systemd

echo "8 - Matterbridge has been installed from the dev branch."
