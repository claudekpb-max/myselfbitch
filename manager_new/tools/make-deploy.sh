#!/bin/sh
# Собирает комплект для выкладки в /manager_new/ на сайте: deploy/manager_new/assets/
set -e
cd "$(dirname "$0")/.."
A=deploy/manager_new/assets
mkdir -p "$A"
cp prototype/manager-2027.css prototype/manager-2027.js "$A/"
echo "deploy/manager_new обновлён"
