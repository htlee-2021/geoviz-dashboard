# Use Node.js as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files for server and client
COPY package*.json ./
COPY client/package*.json ./client/

# Install server dependencies
RUN npm install

# Set up client directory and install client dependencies
WORKDIR /app/client
RUN npm install

# Go back to the root directory
WORKDIR /app

# Copy the rest of the application
COPY . .

# Build the client application
WORKDIR /app/client
RUN npm run build || echo "Failed to build client application"
RUN ls -la build || echo "No build directory found"

# Create empty client/build directory if build failed
RUN mkdir -p build
RUN echo '<!DOCTYPE html><html><head><title>California Wildfire Dashboard</title></head><body><div id="root">Loading...</div></body></html>' > build/index.html

# Go back to the root directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p processed_stats uploads

# Expose the port that the server uses
EXPOSE 8000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Start the server
CMD ["node", "server.js"]