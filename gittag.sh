#!/bin/bash
set -ev
if [ -n "${OVERRIDE_GIT_TAG}" ]; then
    echo "${OVERRIDE_GIT_TAG}"
    exit 0
fi
TAG=$(git describe --tags --exact-match 2> /dev/null || git symbolic-ref -q --short HEAD || git rev-parse --short HEAD)
if [[ "master" = "$TAG" ]]; then
  echo master #the original version of this script uses "latest" since it ties in with the github tagging/CI
  # We'll keep this here as a placeholder for now until it is resolved properly
else
  echo $TAG
fi