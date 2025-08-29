#!/bin/bash
set -ev
if [ -n "${OVERRIDE_GIT_TAG}" ]; then
    echo "${OVERRIDE_GIT_TAG}"
    exit 0
fi
TAG=$(git describe --tags --exact-match 2> /dev/null || git symbolic-ref -q --short HEAD || git rev-parse --short HEAD)
if [[ "master" = "$TAG" ]]; then
  echo latest
else
  echo $TAG
fi