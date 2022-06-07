#!/bin/bash

echo "Starting project in docker"
docker-compose build
docker-compose down
docker-compose up -d
