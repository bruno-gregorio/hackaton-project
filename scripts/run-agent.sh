#!/bin/bash
cd "$(dirname "$0")/../agent" || exit 1
node node_modules/@langchain/langgraph-cli/dist/cli/cli.mjs dev --port 8123 --no-browser
