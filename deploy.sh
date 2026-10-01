#!/bin/bash

echo "Starting project in docker"
docker compose down
docker compose up -d --build
