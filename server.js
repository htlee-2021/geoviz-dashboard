// Modified server.js - Removed uploads dependency
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Directory where pre-processed statistics are stored
const STATS_DIR = path.join(__dirname, 'processed_stats');

const CLIENT_BUILD_DIR = path.join(__dirname, 'client/build');

// Debugging information
console.log('==== Server Configuration ====');
console.log('Current directory:', __dirname);
console.log('Stats directory:', STATS_DIR);
console.log('Client build directory:', CLIENT_BUILD_DIR);
console.log('Stats directory exists:', fs.existsSync(STATS_DIR));
console.log('Client build directory exists:', fs.existsSync(CLIENT_BUILD_DIR));

if (fs.existsSync(CLIENT_BUILD_DIR)) {
  console.log('Client build directory contents:', fs.readdirSync(CLIENT_BUILD_DIR));
}

// Ensure processed_stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created processed_stats directory');
}

// CORS middleware - allow all origins for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware for parsing JSON and URL-encoded data
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));

app.use(express.static(CLIENT_BUILD_DIR));

// Function to merge statistics from multiple files
const mergeStatistics = async (statsData, newStatsData) => {
  // Merge yearly data
  const combinedYearlyData = [...statsData.yearlyData];
  
  // Add any new years from the new data
  newStatsData.yearlyData.forEach(newYearData => {
    const existingYearIndex = combinedYearlyData.findIndex(year => year.year === newYearData.year);
    if (existingYearIndex === -1) {
      // Year doesn't exist in original data, add it
      combinedYearlyData.push(newYearData);
    } else {
      // Year exists, update with combined statistics
      combinedYearlyData[existingYearIndex].fires += newYearData.fires;
      combinedYearlyData[existingYearIndex].acres += newYearData.acres;
    }
  });
  
  // Sort by year
  combinedYearlyData.sort((a, b) => parseInt(a.year) - parseInt(b.year));
  
  // Merge years array
  const combinedYears = Array.from(
    new Set([...statsData.years, ...newStatsData.years])
  ).sort();
  
  // Merge monthly data by year
  const combinedMonthlyData = { ...statsData.monthlyDataByYear };
  
  Object.entries(newStatsData.monthlyDataByYear).forEach(([year, monthlyData]) => {
    if (!combinedMonthlyData[year]) {
      // Year doesn't exist in original data, add all months
      combinedMonthlyData[year] = monthlyData;
    } else {
      // Year exists, combine monthly data
      monthlyData.forEach((newMonthData, index) => {
        combinedMonthlyData[year][index].fires += newMonthData.fires;
        combinedMonthlyData[year][index].acres += newMonthData.acres;
      });
    }
  });
  
  // Merge causes data by year
  const combinedCausesData = { ...(statsData.causesDataByYear || {}) };
  
  if (newStatsData.causesDataByYear) {
    Object.entries(newStatsData.causesDataByYear).forEach(([year, causesData]) => {
      if (!combinedCausesData[year]) {
        // Year doesn't exist in original data, add all causes data
        combinedCausesData[year] = causesData;
      } else {
        // Year exists, combine causes data
        // Merge causes array
        const existingCauses = combinedCausesData[year].causes || [];
        const newCauses = causesData.causes || [];
        
        // Create a map of existing causes for easy access
        const causesMap = new Map();
        existingCauses.forEach(cause => {
          causesMap.set(cause.causeId, cause);
        });
        
        // Add or update causes
        newCauses.forEach(newCause => {
          if (causesMap.has(newCause.causeId)) {
            // Update existing cause
            const existingCause = causesMap.get(newCause.causeId);
            existingCause.fires += newCause.fires;
            existingCause.acres += newCause.acres;
          } else {
            // Add new cause
            existingCauses.push(newCause);
          }
        });
        
        // Sort by fires in descending order
        existingCauses.sort((a, b) => b.fires - a.fires);
        
        // Update the causes array
        combinedCausesData[year].causes = existingCauses;
        
        // Merge monthly breakdown
        if (!combinedCausesData[year].monthlyBreakdown) {
          combinedCausesData[year].monthlyBreakdown = causesData.monthlyBreakdown || {};
        } else if (causesData.monthlyBreakdown) {
          Object.entries(causesData.monthlyBreakdown).forEach(([month, causes]) => {
            if (!combinedCausesData[year].monthlyBreakdown[month]) {
              // Month doesn't exist, add all causes
              combinedCausesData[year].monthlyBreakdown[month] = causes;
            } else {
              // Month exists, merge causes
              const existingMonthCauses = combinedCausesData[year].monthlyBreakdown[month];
              const monthCausesMap = new Map();
              
              existingMonthCauses.forEach(cause => {
                monthCausesMap.set(cause.causeId, cause);
              });
              
              causes.forEach(newCause => {
                if (monthCausesMap.has(newCause.causeId)) {
                  // Update existing cause
                  const existingCause = monthCausesMap.get(newCause.causeId);
                  existingCause.fires += newCause.fires;
                  existingCause.acres += newCause.acres;
                } else {
                  // Add new cause
                  existingMonthCauses.push(newCause);
                }
              });
              
              // Sort by fires in descending order
              existingMonthCauses.sort((a, b) => b.fires - a.fires);
            }
          });
        }
      }
    });
  }
  
  // Combine top causes across all data
  const combinedTopCauses = [];
  const causeMap = new Map();
  
  // Add existing top causes to the map
  if (statsData.topCauses) {
    statsData.topCauses.forEach(cause => {
      causeMap.set(cause.causeId, cause);
    });
  }
  
  // Add or update with new top causes
  if (newStatsData.topCauses) {
    newStatsData.topCauses.forEach(newCause => {
      if (causeMap.has(newCause.causeId)) {
        // Update existing cause
        const existingCause = causeMap.get(newCause.causeId);
        existingCause.fires += newCause.fires;
        existingCause.acres += newCause.acres;
      } else {
        // Add new cause
        causeMap.set(newCause.causeId, { ...newCause });
      }
    });
  }
  
  // Convert map back to array
  causeMap.forEach(cause => {
    combinedTopCauses.push(cause);
  });
  
  // Sort by fires in descending order
  combinedTopCauses.sort((a, b) => b.fires - a.fires);
  
  // Recalculate percentages
  const totalFiresTopCauses = combinedTopCauses.reduce((sum, cause) => sum + cause.fires, 0);
  combinedTopCauses.forEach(cause => {
    cause.percentage = Math.round((cause.fires / totalFiresTopCauses) * 1000) / 10;
  });
  
  // Combine cause definitions
  const combinedCauseDefinitions = {
    ...(statsData.causeDefinitions || {}),
    ...(newStatsData.causeDefinitions || {})
  };
  
  // Recalculate summary statistics
  const totalFires = combinedYearlyData.reduce((sum, year) => sum + year.fires, 0);
  const totalAcres = combinedYearlyData.reduce((sum, year) => sum + year.acres, 0);
  
  // Find worst year
  let worstYear = null;
  let maxAcres = 0;
  
  combinedYearlyData.forEach(yearData => {
    if (yearData.acres > maxAcres) {
      maxAcres = yearData.acres;
      worstYear = yearData.year;
    }
  });
  
  return {
    yearlyData: combinedYearlyData,
    years: combinedYears,
    monthlyDataByYear: combinedMonthlyData,
    causesDataByYear: combinedCausesData,
    topCauses: combinedTopCauses,
    causeDefinitions: combinedCauseDefinitions,
    summary: {
      totalFires,
      totalAcres,
      worstYear,
      worstYearAcres: maxAcres
    },
    metadata: {
      processedAt: new Date().toISOString(),
      combinedFrom: [
        statsData.metadata?.sourceFile || 'unknown',
        newStatsData.metadata?.sourceFile || 'unknown'
      ]
    }
  };
};

// Debugging info for directory
console.log('Current directory:', __dirname);
console.log('Stats directory path:', STATS_DIR);
console.log('Stats directory exists:', fs.existsSync(STATS_DIR));

// Ensure processed_stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created processed_stats directory');
}

// CORS middleware before other middleware - allow all origins for troubleshooting
app.use(cors({
  origin: '*',  // Allow all origins for testing
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));
app.use(express.static(path.join(__dirname, 'client/build')));

// Simple test endpoint to verify server is responding
app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Get styling options
app.get('/api/styling/options', (req, res) => {
  const colorSchemes = [
    { id: 'viridis', name: 'Viridis', type: 'sequential' },
    { id: 'inferno', name: 'Inferno', type: 'sequential' },
    { id: 'plasma', name: 'Plasma', type: 'sequential' },
    { id: 'magma', name: 'Magma', type: 'sequential' },
    { id: 'blues', name: 'Blues', type: 'sequential' },
    { id: 'greens', name: 'Greens', type: 'sequential' },
    { id: 'reds', name: 'Reds', type: 'sequential' },
    { id: 'purples', name: 'Purples', type: 'sequential' },
    { id: 'oranges', name: 'Oranges', type: 'sequential' },
    { id: 'greys', name: 'Greys', type: 'sequential' },
    { id: 'spectral', name: 'Spectral', type: 'diverging' },
    { id: 'rdylbu', name: 'Red-Yellow-Blue', type: 'diverging' },
    { id: 'category10', name: 'Category 10', type: 'categorical' },
    { id: 'paired', name: 'Paired', type: 'categorical' },
    { id: 'set3', name: 'Set 3', type: 'categorical' }
  ];

  res.json({
    colorSchemes,
    opacityOptions: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    blendModes: ['normal', 'multiply', 'screen', 'overlay']
  });
});

// API endpoint to get yearly statistics with support for Fire Cause Analysis
app.get('/api/stats/yearly', async (req, res) => {
  try {
    const datasetId = req.query.dataset || 'firep23_1';
    
    // Build the path to the statistics file
    const statsFilePath = path.join(STATS_DIR, `${datasetId}-stats.json`);
    
    // Check if pre-processed stats exist
    if (!fs.existsSync(statsFilePath)) {
      console.error(`Statistics file not found: ${statsFilePath}`);
      return res.status(404).json({ 
        error: 'Statistics file not found',
        message: 'The pre-processed statistics for this dataset are not available. Run the preprocessor first.'
      });
    }
    
    try {
      // Read the pre-processed statistics file
      const statsData = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
      
      // Check if there are any supplementary statistics files (e.g., for 2024-2025 data)
      const supplementFiles = fs.readdirSync(STATS_DIR)
        .filter(file => file.startsWith(`${datasetId}-supplement-`) && file.endsWith('-stats.json'));
      
      let combinedStats = statsData;
      
      // If we have supplement files, merge them with the main statistics
      if (supplementFiles.length > 0) {
        console.log(`Found ${supplementFiles.length} supplementary statistics files`);
        
        for (const supplementFile of supplementFiles) {
          const supplementPath = path.join(STATS_DIR, supplementFile);
          const supplementData = JSON.parse(fs.readFileSync(supplementPath, 'utf8'));
          
          // Merge the supplement data with our combined stats
          combinedStats = await mergeStatistics(combinedStats, supplementData);
        }
      }
      
      // Return yearly statistics with cause data
      res.json({
        yearlyData: combinedStats.yearlyData,
        years: combinedStats.years,
        summary: combinedStats.summary,
        // Include cause data:
        causesDataByYear: combinedStats.causesDataByYear || {},
        topCauses: combinedStats.topCauses || [],
        causeDefinitions: combinedStats.causeDefinitions || {}
      });
      
    } catch (err) {
      console.error(`Error reading statistics file for ${datasetId}:`, err);
      res.status(500).json({ 
        error: 'Error reading statistics file',
        message: err.message 
      });
    }
  } catch (err) {
    console.error('Server error in yearly stats endpoint:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// API endpoint to get monthly statistics with support for supplementary files
app.get('/api/stats/monthly', async (req, res) => {
  try {
    const datasetId = req.query.dataset || 'firep23_1';
    const year = req.query.year;
    
    if (!year) {
      return res.status(400).json({ error: 'Year parameter required' });
    }
    
    // Build the path to the statistics file
    const statsFilePath = path.join(STATS_DIR, `${datasetId}-stats.json`);
    
    // Check if pre-processed stats exist
    if (!fs.existsSync(statsFilePath)) {
      console.error(`Statistics file not found: ${statsFilePath}`);
      return res.status(404).json({ 
        error: 'Statistics file not found',
        message: 'The pre-processed statistics for this dataset are not available. Run the preprocessor first.'
      });
    }
    
    try {
      // Read the pre-processed statistics file
      const statsData = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
      
      // Check if there are any supplementary statistics files (e.g., for 2024-2025 data)
      const supplementFiles = fs.readdirSync(STATS_DIR)
        .filter(file => file.startsWith(`${datasetId}-supplement-`) && file.endsWith('-stats.json'));
      
      let combinedStats = statsData;
      
      // If we have supplement files, merge them with the main statistics
      if (supplementFiles.length > 0) {
        console.log(`Found ${supplementFiles.length} supplementary statistics files`);
        
        for (const supplementFile of supplementFiles) {
          const supplementPath = path.join(STATS_DIR, supplementFile);
          const supplementData = JSON.parse(fs.readFileSync(supplementPath, 'utf8'));
          
          // Merge the supplement data with our combined stats
          combinedStats = await mergeStatistics(combinedStats, supplementData);
        }
      }
      
      // Get monthly data for the requested year
      const monthlyData = combinedStats.monthlyDataByYear[year] || [];
      
      // If no data for this year, return empty results
      if (monthlyData.length === 0) {
        return res.json({
          monthlyData: [],
          year,
          summary: {
            totalFires: 0,
            totalAcres: 0,
            peakMonth: null,
            peakMonthAcres: 0
          }
        });
      }
      
      // Calculate summary statistics for this year's monthly data
      const totalFires = monthlyData.reduce((sum, month) => sum + month.fires, 0);
      const totalAcres = monthlyData.reduce((sum, month) => sum + month.acres, 0);
      
      // Find peak month
      const peakMonth = monthlyData.reduce(
        (max, month) => month.acres > max.acres ? month : max, 
        { acres: 0 }
      );
      
      res.json({
        monthlyData,
        year,
        summary: {
          totalFires,
          totalAcres,
          peakMonth: peakMonth.month,
          peakMonthAcres: peakMonth.acres
        }
      });
      
    } catch (err) {
      console.error(`Error reading statistics file for ${datasetId}:`, err);
      res.status(500).json({ 
        error: 'Error reading statistics file',
        message: err.message 
      });
    }
  } catch (err) {
    console.error('Server error in monthly stats endpoint:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// API endpoint to get temperature-fire correlation data
app.get('/api/temperature-fire', (req, res) => {
  try {
    const statsFilePath = path.join(STATS_DIR, 'temperature-fire-correlation.json');
    
    if (!fs.existsSync(statsFilePath)) {
      console.error(`Temperature-fire correlation data not found: ${statsFilePath}`);
      return res.status(404).json({
        error: 'Temperature-fire correlation data not found',
        message: 'Please run the temperature-fire-processor.js script first'
      });
    }
    
    const statsData = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
    res.json(statsData);
  } catch (err) {
    console.error('Error retrieving temperature-fire correlation data:', err);
    
    res.status(500).json({
      error: 'Server error',
      message: err.message
    });
  }
});

// API endpoint to get monthly temperature statistics
app.get('/api/temperature/monthly-stats', (req, res) => {
  try {
    const statsFilePath = path.join(STATS_DIR, 'monthly-temperature-stats.json');
    
    if (!fs.existsSync(statsFilePath)) {
      console.error(`Monthly temperature statistics not found: ${statsFilePath}`);
      return res.status(404).json({
        error: 'Monthly temperature statistics not found',
        message: 'Please run the monthly-temperature-processor.js script first'
      });
    }
    
    const monthlyTempStats = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
    res.json(monthlyTempStats);
  } catch (err) {
    console.error('Error retrieving monthly temperature statistics:', err);
    
    res.status(500).json({
      error: 'Server error',
      message: err.message
    });
  }
});

// Add this endpoint to your server.js file:

// API endpoint to serve CA_Weather_Fire_Dataset CSV data
app.get('/api/weather-csv', (req, res) => {
  try {
    const csvFilePath = path.join(__dirname, 'processed_stats', 'CA_Weather_Fire_Dataset_1984-2025.csv');
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`Weather CSV file not found: ${csvFilePath}`);
      return res.status(404).json({
        error: 'Weather CSV file not found',
        message: 'The CA Weather Fire Dataset is not available.'
      });
    }
    
    // Read the CSV file
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    
    // Send the CSV data as a text response
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    console.error('Error retrieving weather CSV data:', err);
    
    res.status(500).json({
      error: 'Server error',
      message: err.message
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    config: {
      nodeEnv: process.env.NODE_ENV,
      clientBuildExists: fs.existsSync(CLIENT_BUILD_DIR)
    }
  });
});


app.get('/api/diagnose', (req, res) => {
  try {
    const statsFiles = fs.existsSync(STATS_DIR) 
      ? fs.readdirSync(STATS_DIR) 
      : 'Directory does not exist';
    
    const clientBuildFiles = fs.existsSync(CLIENT_BUILD_DIR)
      ? fs.readdirSync(CLIENT_BUILD_DIR)
      : 'Directory does not exist';
    
    let indexHtmlContent = 'File not found';
    const indexHtmlPath = path.join(CLIENT_BUILD_DIR, 'index.html');
    
    if (fs.existsSync(indexHtmlPath)) {
      indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8').slice(0, 1000) + '...';
    }
    
    res.json({
      directories: {
        currentDir: __dirname,
        statsDir: STATS_DIR,
        clientBuildDir: CLIENT_BUILD_DIR
      },
      exists: {
        statsDir: fs.existsSync(STATS_DIR),
        clientBuildDir: fs.existsSync(CLIENT_BUILD_DIR),
        indexHtml: fs.existsSync(indexHtmlPath)
      },
      contents: {
        statsFiles,
        clientBuildFiles,
        indexHtmlPreview: indexHtmlContent
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Add these lines to your server.js file
// Place them just after your existing '/api/temperature/monthly-stats' endpoint

// API endpoint to get detailed temperature data points with year information for a specific month
app.get('/api/temperature/points/:month', (req, res) => {
  try {
    const month = req.params.month;
    
    // Normalize the month name to lowercase for consistent file lookup
    const normalizedMonth = month.toLowerCase();
    
    // Build the path to the monthly detail file
    const dataPath = path.join(STATS_DIR, 'monthly_detail', `${normalizedMonth}.json`);
    
    if (!fs.existsSync(dataPath)) {
      console.error(`Temperature points data not found for ${month}: ${dataPath}`);
      return res.status(404).json({
        error: `Temperature data points for ${month} not found`,
        message: 'Please run the monthly-temperature-processor.js script first'
      });
    }
    
    // Read the data points file
    const pointsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Optional: limit number of points returned for better performance
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // If there are too many points, sample them evenly
    let result = pointsData;
    if (pointsData.length > limit) {
      result = sampleDataPoints(pointsData, limit);
    }
    
    res.json(result);
  } catch (err) {
    console.error(`Error retrieving temperature points for ${req.params.month}:`, err);
    
    res.status(500).json({
      error: 'Server error',
      message: err.message
    });
  }
});

// Helper function to sample data points evenly to reduce payload size
function sampleDataPoints(dataPoints, sampleSize) {
  const totalPoints = dataPoints.length;
  if (totalPoints <= sampleSize) return dataPoints;
  
  const step = Math.floor(totalPoints / sampleSize);
  const result = [];
  
  for (let i = 0; i < totalPoints && result.length < sampleSize; i += step) {
    result.push(dataPoints[i]);
  }
  
  return result;
}

// Catch-all handler for the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;