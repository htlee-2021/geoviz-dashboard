# Use Node.js as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for the server
COPY package*.json ./

# Install server dependencies with error checking
RUN npm install || (echo "Server dependency installation failed" && exit 1)

# Create necessary directories
RUN mkdir -p processed_stats uploads

# Create client/build directory if not building the client
RUN mkdir -p client/build

# Copy application files
COPY server.js .
COPY processed_stats ./processed_stats/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose the port that the server uses
EXPOSE 8000

# Health check to ensure the server is running properly
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/test || exit 1

# Start the server
CMD ["node", "server.js"]