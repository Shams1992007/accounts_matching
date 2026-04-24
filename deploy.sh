#!/bin/bash
set -e

echo "==> Pulling latest from git..."
git pull origin main

echo "==> Installing backend dependencies..."
cd backend && npm install && cd ..

echo "==> Installing frontend dependencies..."
cd frontend && npm install

echo "==> Building frontend..."
npm run build && cd ..

echo "==> Restarting backend..."
pm2 restart accounts-backend

echo "==> Done. App is live at http://15.235.216.232:3001"
