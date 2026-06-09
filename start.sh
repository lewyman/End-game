#!/usr/bin/env bash
# Read ZO_CLIENT_IDENTITY_TOKEN from the host environment and start the server
export ZO_CLIENT_IDENTITY_TOKEN="${ZO_CLIENT_IDENTITY_TOKEN:-}"
cd /home/workspace/bio-sync-academy
exec bun run server.ts
