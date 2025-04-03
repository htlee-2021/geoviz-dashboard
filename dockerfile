# Use Node.js as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for both server and client
COPY package*.json ./

# Install server dependencies
RUN npm install

# Copy client package files and update homepage
COPY client/package*.json ./client/

# Modify client package.json to include homepage
RUN node -e "const fs = require('fs'); \
    const pkgPath = './client/package.json'; \
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); \
    pkg.homepage = '/'; \
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));"

# Install client dependencies
WORKDIR /app/client
RUN npm install

# Go back to the root directory
WORKDIR /app

# Copy the rest of the application
COPY . .

# Build the React client
WORKDIR /app/client
RUN npm run build

# Verify the build output
RUN ls -la build
RUN cat build/index.html | grep -o "src=\"[^\"]*\"" || echo "No src attributes found"
RUN cat build/index.html | grep -o "href=\"[^\"]*\"" || echo "No href attributes found"

# Go back to the root directory
WORKDIR /app

# Make sure processed_stats directory exists
RUN mkdir -p processed_stats
RUN mkdir -p uploads

# Expose the port that the server uses
EXPOSE 8000

# Start the server
CMD ["node", "server.js"]