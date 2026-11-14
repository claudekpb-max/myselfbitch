#!/bin/sh
# Собирает комплект для сайта (deploy/manager_new и deploy/manager_new.zip)
set -e
cd "$(dirname "$0")/.."
python3 tools/make-deploy.py
