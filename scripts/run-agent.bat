@echo off
cd /d "%~dp0..\agent"
node node_modules/@langchain/langgraph-cli/dist/cli/cli.mjs dev --port 8123 --no-browser
