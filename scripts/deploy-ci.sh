#!/bin/bash
set -e

# Deploy newsfeed-ai bot (for GitHub Actions CI)
# This script is called after checkout and bun install

SERVICE_NAME="newsfeed-ai-bot"

echo "Deploying newsfeed-ai..."

# Restart service
echo "Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

# Check status
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Deploy complete! Service is running."
else
    echo "Service failed to start. Check logs:"
    sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi
