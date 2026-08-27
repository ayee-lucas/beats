#!/bin/sh
set -eu

ctlptl apply -f ctlptl.yaml

if docker network inspect kind --format '{{json .Containers}}' | grep -q '"Name":"ctlptl-registry"'; then
  exit 0
fi

docker network connect kind ctlptl-registry
