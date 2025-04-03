#!/bin/bash
# Script to start development servers

# Start the backend server
node server.js &
SERVER_PID=$!

# Start the frontend development server
cd client && npm start &
CLIENT_PID=$!

# Handle cleanup on exit
cleanup() {
  echo "Shutting down servers..."
  kill $SERVER_PID $CLIENT_PID
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait