---
description: Stops the local development server
---

# Stop Dev Server

This workflow stops the local development server for the Article-Caster application.

## 1. Gracefully stop the server

Try a graceful SIGTERM first, wait briefly, then force-kill anything still lingering.

// turbo
```bash
PIDS=$(lsof -t -i:3000 2>/dev/null); if [ -n "$PIDS" ]; then echo "$PIDS" | xargs kill 2>/dev/null; sleep 1; REMAINING=$(lsof -t -i:3000 2>/dev/null); if [ -n "$REMAINING" ]; then echo "$REMAINING" | xargs kill -9 2>/dev/null && echo "Force-killed remaining processes."; else echo "Server stopped gracefully."; fi; else echo "Server is not running."; fi
```
