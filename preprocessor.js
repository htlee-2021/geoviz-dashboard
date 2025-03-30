// preprocessor.js - Run this once to extract statistics from large GeoJSON files
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, 'uploads');
const STATS_DIR = path.join(__dirname, 'processed_stats');
const TARGET_FILES = ['firep23_1.geojson', 'CA_Perimeters_CAL_FIRE.geojson']; // List of GeoJSON files to process
// Add your new data file to this list if it has a different name

// Fire cause mapping (based on the PDF documentation)
const causesMap = {
  1: 'Lightning',
  2: 'Equipment Use',
  3: 'Smoking',
  4: 'Campfire',
  5: 'Debris',
  6: 'Railroad',
  7: 'Arson',
  8: 'Playing with fire',
  9: 'Miscellaneous',
  10: 'Vehicle',
  11: 'Powerline',
  12: 'Firefighter Training',
  13: 'Non-Firefighter Training',
  14: 'Unknown/Unidentified',
  15: 'Structure',
  16: 'Aircraft',
  17: 'Volcanic',
  18: 'Escaped Prescribed Burn',
  19: 'Illegal Alien Campfire'
};

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
      console.log('File is too large for direct processing. Using streaming approach...');
      processLargeGeoJSONFile(filePath, filename);
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
  const causesStatsByYear = {}; // New structure for fire causes
  
  // Process each feature
  geoData.features.forEach((feature, index) => {
    if (index % 10000 === 0) {
      console.log(`Processed ${index} features...`);
    }
    
    processFeature(feature, yearlyStats, monthlyStatsByYear, causesStatsByYear);
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
  
  // Convert causes stats to structured format
  const causesDataByYear = {};
  
  Object.keys(causesStatsByYear).forEach(year => {
    // All causes for the year
    const yearCauses = Object.keys(causesStatsByYear[year])
      .filter(key => key !== 'byMonth') // Skip byMonth metadata
      .map(causeId => ({
        causeId: parseInt(causeId),
        causeName: causesMap[causeId] || `Unknown (${causeId})`,
        fires: causesStatsByYear[year][causeId].fires,
        acres: Math.round(causesStatsByYear[year][causeId].acres * 100) / 100
      }))
      .sort((a, b) => b.fires - a.fires); // Sort by fire count in descending order
    
    // Monthly breakdown of causes
    const monthlyBreakdown = {};
    
    if (causesStatsByYear[year].byMonth) {
      months.forEach(month => {
        if (!causesStatsByYear[year].byMonth[month]) {
          monthlyBreakdown[month] = [];
          return;
        }
        
        monthlyBreakdown[month] = Object.keys(causesStatsByYear[year].byMonth[month])
          .map(causeId => ({
            causeId: parseInt(causeId),
            causeName: causesMap[causeId] || `Unknown (${causeId})`,
            fires: causesStatsByYear[year].byMonth[month][causeId].fires,
            acres: Math.round(causesStatsByYear[year].byMonth[month][causeId].acres * 100) / 100
          }))
          .sort((a, b) => b.fires - a.fires); // Sort by fire count in descending order
      });
    }
    
    causesDataByYear[year] = {
      causes: yearCauses,
      monthlyBreakdown
    };
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
  
  // Analyze top causes overall
  const causesCounts = {};
  const causesAcres = {};
  
  Object.values(causesStatsByYear).forEach(yearData => {
    Object.entries(yearData).forEach(([causeId, data]) => {
      if (causeId === 'byMonth') return; // Skip byMonth metadata
      
      if (!causesCounts[causeId]) {
        causesCounts[causeId] = 0;
        causesAcres[causeId] = 0;
      }
      
      causesCounts[causeId] += data.fires;
      causesAcres[causeId] += data.acres;
    });
  });
  
  const topCauses = Object.keys(causesCounts)
    .map(causeId => ({
      causeId: parseInt(causeId),
      causeName: causesMap[causeId] || `Unknown (${causeId})`,
      fires: causesCounts[causeId],
      acres: Math.round(causesAcres[causeId] * 100) / 100,
      percentage: Math.round((causesCounts[causeId] / totalFires) * 1000) / 10
    }))
    .sort((a, b) => b.fires - a.fires);
  
  // Create the final statistics object
  const statistics = {
    yearlyData,
    years: Object.keys(yearlyStats).sort(),
    monthlyDataByYear,
    causesDataByYear,
    topCauses,
    causeDefinitions: causesMap,
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

function processLargeGeoJSONFile(filePath, filename) {
  const startTime = Date.now();
  console.log("Starting streaming process for large file...");
  
  // Initialize data structures for statistics
  const yearlyStats = {};
  const monthlyStatsByYear = {};
  const causesStatsByYear = {}; // New structure for fire causes
  
  // Create a read stream for the file
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  
  let buffer = '';
  let featureCount = 0;
  let inFeatures = false;
  let openBraces = 0;
  
  fileStream.on('data', chunk => {
    // Add chunk to buffer
    buffer += chunk;
    
    // Process buffer for complete features
    let featureStart = buffer.indexOf('"features":[');
    if (featureStart !== -1 && !inFeatures) {
      inFeatures = true;
      buffer = buffer.slice(featureStart + 12); // Move past '"features":['
    }
    
    if (inFeatures) {
      let pos = 0;
      
      while (pos < buffer.length) {
        if (buffer[pos] === '{') {
          openBraces++;
        } else if (buffer[pos] === '}') {
          openBraces--;
          
          // If we've completed a feature object
          if (openBraces === 0) {
            const featureStr = buffer.slice(0, pos + 1);
            try {
              const feature = JSON.parse(featureStr);
              processFeature(feature, yearlyStats, monthlyStatsByYear, causesStatsByYear);
              featureCount++;
              
              if (featureCount % 10000 === 0) {
                console.log(`Processed ${featureCount} features...`);
              }
            } catch (err) {
              // Skip malformed features
              console.warn(`Skipping malformed feature at position ${pos}`);
            }
            
            // Remove processed feature from buffer
            buffer = buffer.slice(pos + 1);
            pos = 0;
            continue;
          }
        }
        pos++;
      }
    }
  });
  
  fileStream.on('end', () => {
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
    
    // Convert causes stats to structured format
    const causesDataByYear = {};
    
    Object.keys(causesStatsByYear).forEach(year => {
      // All causes for the year
      const yearCauses = Object.keys(causesStatsByYear[year])
        .filter(key => key !== 'byMonth') // Skip byMonth metadata
        .map(causeId => ({
          causeId: parseInt(causeId),
          causeName: causesMap[causeId] || `Unknown (${causeId})`,
          fires: causesStatsByYear[year][causeId].fires,
          acres: Math.round(causesStatsByYear[year][causeId].acres * 100) / 100
        }))
        .sort((a, b) => b.fires - a.fires); // Sort by fire count in descending order
      
      // Monthly breakdown of causes
      const monthlyBreakdown = {};
      
      if (causesStatsByYear[year].byMonth) {
        months.forEach(month => {
          if (!causesStatsByYear[year].byMonth[month]) {
            monthlyBreakdown[month] = [];
            return;
          }
          
          monthlyBreakdown[month] = Object.keys(causesStatsByYear[year].byMonth[month])
            .map(causeId => ({
              causeId: parseInt(causeId),
              causeName: causesMap[causeId] || `Unknown (${causeId})`,
              fires: causesStatsByYear[year].byMonth[month][causeId].fires,
              acres: Math.round(causesStatsByYear[year].byMonth[month][causeId].acres * 100) / 100
            }))
            .sort((a, b) => b.fires - a.fires); // Sort by fire count in descending order
        });
      }
      
      causesDataByYear[year] = {
        causes: yearCauses,
        monthlyBreakdown
      };
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
    
    // Analyze top causes overall
    const causesCounts = {};
    const causesAcres = {};
    
    Object.values(causesStatsByYear).forEach(yearData => {
      Object.entries(yearData).forEach(([causeId, data]) => {
        if (causeId === 'byMonth') return; // Skip byMonth metadata
        
        if (!causesCounts[causeId]) {
          causesCounts[causeId] = 0;
          causesAcres[causeId] = 0;
        }
        
        causesCounts[causeId] += data.fires;
        causesAcres[causeId] += data.acres;
      });
    });
    
    const topCauses = Object.keys(causesCounts)
      .map(causeId => ({
        causeId: parseInt(causeId),
        causeName: causesMap[causeId] || `Unknown (${causeId})`,
        fires: causesCounts[causeId],
        acres: Math.round(causesAcres[causeId] * 100) / 100,
        percentage: Math.round((causesCounts[causeId] / totalFires) * 1000) / 10
      }))
      .sort((a, b) => b.fires - a.fires);
    
    // Create the final statistics object
    const statistics = {
      yearlyData,
      years: Object.keys(yearlyStats).sort(),
      monthlyDataByYear,
      causesDataByYear,
      topCauses,
      causeDefinitions: causesMap,
      summary: {
        totalFires,
        totalAcres,
        worstYear,
        worstYearAcres: yearlyStats[worstYear]?.acres || 0
      },
      metadata: {
        sourceFile: filename,
        processedAt: new Date().toISOString(),
        featureCount: featureCount
      }
    };
    
    // Save the statistics to a JSON file
    const outputFilename = path.join(STATS_DIR, filename.replace('.geojson', '-stats.json'));
    fs.writeFileSync(outputFilename, JSON.stringify(statistics, null, 2));
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Processed ${featureCount} features in ${processingTime.toFixed(2)} seconds`);
    console.log(`Statistics saved to: ${outputFilename}`);
  });
  
  fileStream.on('error', err => {
    console.error('Error reading file:', err);
  });
}

function processFeature(feature, yearlyStats, monthlyStatsByYear, causesStatsByYear) {
  if (!feature.properties) return;
  
  // Extract year from properties - accommodate both old and new formats
  let year;
  let dateString;
  let cause = feature.properties.CAUSE;
  
  // Try different date fields in order of preference
  if (feature.properties.FireDiscov) {
    dateString = feature.properties.FireDiscov;
  } else if (feature.properties.ALARM_DATE) {
    dateString = feature.properties.ALARM_DATE;
  } else if (feature.properties.YEAR_ !== undefined) {
    year = parseInt(feature.properties.YEAR_);
  }
  
  // Parse year from date string if available
  if (dateString && !year) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      year = date.getFullYear();
    }
  }
  
  if (!year || isNaN(year)) return; // Skip features without valid year data
  
  // Extract month if date is available
  let month;
  if (dateString) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      month = date.toLocaleString('default', { month: 'long' });
    }
  }
  
  // Extract acres - accommodate both old and new formats
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
  
  // Update cause statistics if available
  if (cause !== undefined && !isNaN(cause)) {
    if (!causesStatsByYear[year]) {
      causesStatsByYear[year] = {};
    }
    
    if (!causesStatsByYear[year][cause]) {
      causesStatsByYear[year][cause] = {
        fires: 0,
        acres: 0
      };
    }
    
    causesStatsByYear[year][cause].fires++;
    causesStatsByYear[year][cause].acres += acres;
    
    // Also track by month if available
    if (month) {
      if (!causesStatsByYear[year].byMonth) {
        causesStatsByYear[year].byMonth = {};
      }
      
      if (!causesStatsByYear[year].byMonth[month]) {
        causesStatsByYear[year].byMonth[month] = {};
      }
      
      if (!causesStatsByYear[year].byMonth[month][cause]) {
        causesStatsByYear[year].byMonth[month][cause] = {
          fires: 0,
          acres: 0
        };
      }
      
      causesStatsByYear[year].byMonth[month][cause].fires++;
      causesStatsByYear[year].byMonth[month][cause].acres += acres;
    }
  }
}

console.log('All processing jobs completed.');