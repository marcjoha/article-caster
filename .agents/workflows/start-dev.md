---
description: Starts the Next.js development server
---

# Start Dev Server

This workflow starts the local development server for the Article-Caster application.

## 1. Kill any existing server on port 3000

// turbo
```bash
lsof -t -i:3000 | xargs kill 2>/dev/null; sleep 0.5; lsof -t -i:3000 | xargs kill -9 2>/dev/null; echo "Port 3000 cleared."
```

## 2. Install dependencies if needed

// turbo
```bash
npm install
```

## 3. Start the server

// turbo
```bash
npm run dev
```

You can then access the application at `http://localhost:3000`.
