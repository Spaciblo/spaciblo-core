#/bin/bash
set -e
export PGPASSWORD=$2
psql -h "127.0.0.1" -p 5432 -U "$1"
