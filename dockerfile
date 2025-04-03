# Use Node.js as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for both server and client
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies for server
RUN npm install

# Install dependencies for client
WORKDIR /app/client
RUN npm install

# Go back to the root directory
WORKDIR /app

# Copy the rest of the application
COPY . .

# Set the base URL environment variable for the client build
ENV REACT_APP_BASE_URL=/wildfire-dashboard

# Build the React client
WORKDIR /app/client
RUN npm run build

# Go back to the root directory
WORKDIR /app

# Make sure processed_stats directory exists
RUN mkdir -p processed_stats

# Make sure uploads directory exists
RUN mkdir -p uploads

# Expose the port that the server uses
EXPOSE 8000

# Start the server
CMD ["node", "server.js"]