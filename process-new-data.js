// process-new-data.js - Process new fire data (2024-2025) and create supplement stats
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, 'uploads');
const STATS_DIR = path.join(__dirname, 'processed_stats');
const NEW_DATA_FILE = 'CA_Perimeters_CAL_FIRE.geojson'; // The actual file name of your new data

// Ensure stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created statistics directory:', STATS_DIR);
}

const filePath = path.join(DATA_DIR, NEW_DATA_FILE);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`Processing ${NEW_DATA_FILE}...`);
const fileSize = fs.statSync(filePath).size;
console.log(`File size: ${Math.round(fileSize / (1024 * 1024))} MB`);

try {
  processGeoJSONFile(filePath, NEW_DATA_FILE);
} catch (err) {
  console.error(`Error processing ${NEW_DATA_FILE}:`, err);
}

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
    
    // Extract year from FireDiscov field
    let year;
    let dateString;
    
    if (feature.properties.FireDiscov) {
      dateString = feature.properties.FireDiscov;
    } else if (feature.properties.ALARM_DATE) {
      dateString = feature.properties.ALARM_DATE;
    } else {
      return; // Skip features without date data
    }
    
    // Parse year from date string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return; // Skip features with invalid dates
    }
    
    year = date.getFullYear();
    
    // Only process 2024 and 2025 data
    if (year < 2024) {
      return;
    }
    
    // Extract month
    const month = date.toLocaleString('default', { month: 'long' });
    
    // Extract acres
    let acres = 0;
    if (feature.properties.area_acres !== undefined && !isNaN(feature.properties.area_acres)) {
      acres = feature.properties.area_acres;
    } else if (feature.properties.GIS_ACRES !== undefined && !isNaN(feature.properties.GIS_ACRES)) {
      acres = feature.properties.GIS_ACRES;
    }
    
    // Update yearly statistics
    if (!yearlyStats[year]) {
      yearlyStats[year] = {
        fires: 0,
        acres: 0
      };
    }
    yearlyStats[year].fires++;
    yearlyStats[year].acres += acres;
    
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
      monthlyStatsByYear[year][month].acres += acres;
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
      featureCount: geoData.features.length,
      yearRange: '2024-2025'
    }
  };
  
  // Save the statistics to a JSON file - use a special naming for the supplement
  const baseDatasetId = 'CA_Perimeters_CAL_FIRE'; // Match the file name without extension
  const outputFilename = path.join(STATS_DIR, `${baseDatasetId.replace('.geojson', '')}-supplement-2024-2025-stats.json`);
  fs.writeFileSync(outputFilename, JSON.stringify(statistics, null, 2));
  
  const processingTime = (Date.now() - startTime) / 1000;
  console.log(`Processed ${geoData.features.length} features in ${processingTime.toFixed(2)} seconds`);
  console.log(`Statistics saved to: ${outputFilename}`);
  console.log(`Years found: ${Object.keys(yearlyStats).join(', ')}`);
  console.log(`Total fires: ${totalFires}, Total acres: ${Math.round(totalAcres).toLocaleString()}`);
}

console.log('Processing completed.');