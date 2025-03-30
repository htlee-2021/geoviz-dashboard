// preprocessor.js - Run this once to extract statistics from large GeoJSON files
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, 'uploads');
const STATS_DIR = path.join(__dirname, 'processed_stats');
const TARGET_FILES = ['firep23_1.geojson']; // List of GeoJSON files to process

// Ensure stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created statistics directory:', STATS_DIR);
}

// Process each target file
TARGET_FILES.forEach(filename => {
  const filePath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`Processing ${filename}...`);
  const fileSize = fs.statSync(filePath).size;
  console.log(`File size: ${Math.round(fileSize / (1024 * 1024))} MB`);
  
  try {
    // For files less than 500MB, process in one go
    if (fileSize < 500 * 1024 * 1024) {
      console.log('Processing file in a single operation...');
      processGeoJSONFile(filePath, filename);
    } else {
      console.log('File is too large for direct processing. Will implement streaming in next version.');
      // TODO: Implement streaming for very large files
    }
  } catch (err) {
    console.error(`Error processing ${filename}:`, err);
  }
});

function processGeoJSONFile(filePath, filename) {
  const startTime = Date.now();
  
  // Read and parse the GeoJSON file
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const geoData = JSON.parse(fileContent);
  
  if (!geoData.type === 'FeatureCollection' || !Array.isArray(geoData.features)) {
    throw new Error('Invalid GeoJSON format: Expected a FeatureCollection with features array');
  }
  
  console.log(`Parsed GeoJSON with ${geoData.features.length} features`);
  
  // Initialize data structures for statistics
  const yearlyStats = {};
  const monthlyStatsByYear = {};
  
  // Process each feature
  geoData.features.forEach((feature, index) => {
    if (index % 10000 === 0) {
      console.log(`Processed ${index} features...`);
    }
    
    if (!feature.properties) return;
    
    // Extract year from properties
    let year;
    if (feature.properties.YEAR_ !== undefined) {
      year = parseInt(feature.properties.YEAR_);
    } else if (feature.properties.ALARM_DATE) {
      const date = new Date(feature.properties.ALARM_DATE);
      year = date.getFullYear();
    } else {
      return; // Skip features without year data
    }
    
    if (!year || isNaN(year)) return;
    
    // Extract month if date is available
    let month;
    if (feature.properties.ALARM_DATE) {
      const date = new Date(feature.properties.ALARM_DATE);
      month = date.toLocaleString('default', { month: 'long' });
    }
    
    // Extract acres
    const acres = feature.properties.GIS_ACRES;
    const validAcres = acres !== undefined && !isNaN(acres) ? acres : 0;
    
    // Update yearly statistics
    if (!yearlyStats[year]) {
      yearlyStats[year] = {
        fires: 0,
        acres: 0
      };
    }
    yearlyStats[year].fires++;
    yearlyStats[year].acres += validAcres;
    
    // Update monthly statistics
    if (month) {
      if (!monthlyStatsByYear[year]) {
        monthlyStatsByYear[year] = {};
      }
      
      if (!monthlyStatsByYear[year][month]) {
        monthlyStatsByYear[year][month] = {
          fires: 0,
          acres: 0
        };
      }
      
      monthlyStatsByYear[year][month].fires++;
      monthlyStatsByYear[year][month].acres += validAcres;
    }
  });
  
  // Convert yearly stats to array format
  const yearlyData = Object.keys(yearlyStats)
    .sort()
    .map(year => ({
      year,
      fires: yearlyStats[year].fires,
      acres: Math.round(yearlyStats[year].acres * 100) / 100
    }));
  
  // Convert monthly stats to structured format
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthlyDataByYear = {};
  
  Object.keys(monthlyStatsByYear).forEach(year => {
    monthlyDataByYear[year] = months.map(month => {
      const stats = monthlyStatsByYear[year][month] || { fires: 0, acres: 0 };
      return {
        month,
        fires: stats.fires,
        acres: Math.round(stats.acres * 100) / 100
      };
    });
  });
  
  // Calculate summary statistics
  const totalFires = Object.values(yearlyStats).reduce((sum, stats) => sum + stats.fires, 0);
  const totalAcres = Object.values(yearlyStats).reduce((sum, stats) => sum + stats.acres, 0);
  
  // Find worst fire year
  let worstYear = null;
  let maxAcres = 0;
  
  Object.entries(yearlyStats).forEach(([year, stats]) => {
    if (stats.acres > maxAcres) {
      maxAcres = stats.acres;
      worstYear = year;
    }
  });
  
  // Create the final statistics object
  const statistics = {
    yearlyData,
    years: Object.keys(yearlyStats).sort(),
    monthlyDataByYear,
    summary: {
      totalFires,
      totalAcres,
      worstYear,
      worstYearAcres: yearlyStats[worstYear]?.acres || 0
    },
    metadata: {
      sourceFile: filename,
      processedAt: new Date().toISOString(),
      featureCount: geoData.features.length
    }
  };
  
  // Save the statistics to a JSON file
  const outputFilename = path.join(STATS_DIR, filename.replace('.geojson', '-stats.json'));
  fs.writeFileSync(outputFilename, JSON.stringify(statistics, null, 2));
  
  const processingTime = (Date.now() - startTime) / 1000;
  console.log(`Processed ${geoData.features.length} features in ${processingTime.toFixed(2)} seconds`);
  console.log(`Statistics saved to: ${outputFilename}`);
}

console.log('All processing jobs completed.');