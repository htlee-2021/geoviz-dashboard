# GeoViz Dashboard

A full-stack web application for visualizing geographic and tabular data using D3.js, React, and Express.

## Features

- Visualize geographic data with interactive maps
- Create charts and graphs from tabular data
- Responsive design for desktop and mobile
- Data joining between geographic and tabular sources

## Tech Stack

- **Frontend**: React, D3.js, HTML5, CSS3
- **Backend**: Node.js, Express
- **Data Processing**: CSV-Parser, Shapefile, Turf.js

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/geoviz-dashboard.git
   cd geoviz-dashboard
   ```

2. Install backend dependencies
   ```
   npm install
   ```

3. Install frontend dependencies
   ```
   cd client
   npm install
   cd ..
   ```

4. Create a `.env` file in the root directory (see `.env.example`)

5. Start development servers
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3000`

### Building for Production

1. Build the frontend
   ```
   npm run build-client
   ```

2. Start the production server
   ```
   npm start
   ```

## File Upload Requirements

- **CSV files**: Must have headers in the first row
- **GeoJSON files**: Must follow the GeoJSON specification
- **Shapefiles**: Must include .shp, .dbf, and .shx files

## License

MIT
