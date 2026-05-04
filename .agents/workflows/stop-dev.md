---
description: Stops the local development server
---

# Stop Dev Server

This workflow stops the local development server for the Article-Caster application by terminating the process listening on port 3000 or any running Next.js dev processes.

## 1. Stop the server

Run the following command to terminate the development server.

// turbo
```bash
lsof -t -i:3000 | xargs kill -9 || pkill -f "next dev" || echo "Server is not running."
```
