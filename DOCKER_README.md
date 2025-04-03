# Docker Setup for California Wildfire Dashboard

This document explains how to run the California Wildfire Dashboard application using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

## Running the Application

### 1. Using Docker Compose (Recommended)

The easiest way to start the application is using Docker Compose:

```bash
docker-compose up
```

This will:
- Build the Docker image if it doesn't exist
- Start the container with the Node.js server running
- Map port 8000 to your host machine
- Mount the processed_stats and uploads folders as volumes

To run it in the background:

```bash
docker-compose up -d
```

To stop the application:

```bash
docker-compose down
```

### 2. Building and Running Manually

If you prefer not to use Docker Compose, you can build and run the Docker container manually:

```bash
# Build the Docker image
docker build -t wildfire-dashboard .

# Run the container
docker run -p 8000:8000 -v $(pwd)/processed_stats:/app/processed_stats -v $(pwd)/uploads:/app/uploads wildfire-dashboard
```

## Data Files

The application expects data files to be in the following locations:

- `processed_stats/`: Contains pre-processed statistics files
- `uploads/`: Contains GeoJSON files for visualization

These folders are mounted as volumes, so files added to these directories on your host machine will be accessible inside the Docker container.

## Development

For development, you may want to run the frontend React dev server separately. The included `start-dev.sh` script helps with this:

```bash
chmod +x start-dev.sh
./start-dev.sh
```

This will start both the backend server and the React development server with hot reloading.

## Troubleshooting

1. **Server not starting**: Make sure port 8000 is not already in use on your host machine.

2. **Data not loading**: If the dashboard doesn't show any data, check if your processed_stats directory contains the required statistics files. You may need to run the preprocessor:

```bash
# Enter the running container
docker exec -it <container_id> /bin/bash

# Run the preprocessor
node preprocessor.js
```

3. **Container stops immediately**: Check the logs to see what error occurred:

```bash
docker-compose logs
```