// Modified server.js - Removed uploads dependency
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Directory where pre-processed statistics are stored
const STATS_DIR = path.join(__dirname, 'processed_stats');

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
      
      // Return sample data instead of failing
      return res.json({
        yearlyData: getSampleYearlyData(),
        years: ["2020", "2021", "2022", "2023", "2024", "2025"],
        summary: {
          totalFires: 42500,
          totalAcres: 2850000,
          worstYear: "2023",
          worstYearAcres: 850000
        },
        causesDataByYear: getSampleCausesData(),
        topCauses: getSampleTopCauses(),
        causeDefinitions: getSampleCauseDefinitions()
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
      
      // Return sample monthly data
      return res.json({
        monthlyData: getSampleMonthlyData(),
        year,
        summary: {
          totalFires: 7800,
          totalAcres: 485000,
          peakMonth: "August",
          peakMonthAcres: 150000
        }
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
      
      // If no data for this year, return sample results
      if (monthlyData.length === 0) {
        return res.json({
          monthlyData: getSampleMonthlyData(),
          year,
          summary: {
            totalFires: 7800,
            totalAcres: 485000,
            peakMonth: "August",
            peakMonthAcres: 150000
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
      console.log('Temperature-fire correlation data not found, returning sample data');
      
      // Return sample temperature data
      return res.json(getSampleTemperatureFireData());
    }
    
    const statsData = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
    res.json(statsData);
  } catch (err) {
    console.error('Error retrieving temperature-fire correlation data:', err);
    
    // Return sample temperature data on error
    return res.json(getSampleTemperatureFireData());
  }
});

// Catch-all handler for the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Generate sample yearly data
function getSampleYearlyData() {
  const years = ["2020", "2021", "2022", "2023", "2024", "2025"];
  const yearlyData = [];
  
  years.forEach(year => {
    yearlyData.push({
      year,
      fires: 5000 + Math.floor(Math.random() * 3000),
      acres: 350000 + Math.floor(Math.random() * 500000)
    });
  });
  
  return yearlyData;
}

// Generate sample monthly data
function getSampleMonthlyData() {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  // Use a realistic fire season pattern with peak in summer months
  const firePattern = [0.05, 0.05, 0.07, 0.08, 0.1, 0.12, 0.15, 0.2, 0.1, 0.05, 0.02, 0.01];
  const totalFires = 7800;
  const totalAcres = 485000;
  
  return months.map((month, index) => {
    const monthFires = Math.floor(totalFires * firePattern[index]);
    const monthAcres = Math.floor(totalAcres * firePattern[index]);
    
    return {
      month,
      fires: monthFires,
      acres: monthAcres
    };
  });
}

// Generate sample causes data
function getSampleCausesData() {
  const years = ["2020", "2021", "2022", "2023", "2024", "2025"];
  const causesDataByYear = {};
  
  // Define common cause IDs
  const causeIds = [1, 2, 3, 4, 5, 6, 7, 10, 11, 14];
  
  years.forEach(year => {
    const causes = causeIds.map(causeId => {
      return {
        causeId,
        causeName: getSampleCauseDefinitions()[causeId],
        fires: 100 + Math.floor(Math.random() * 1000),
        acres: 5000 + Math.floor(Math.random() * 100000)
      };
    });
    
    // Sort by fires in descending order
    causes.sort((a, b) => b.fires - a.fires);
    
    // Generate monthly breakdown
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const monthlyBreakdown = {};
    
    months.forEach(month => {
      monthlyBreakdown[month] = causeIds.map(causeId => {
        return {
          causeId,
          fires: 5 + Math.floor(Math.random() * 100),
          acres: 100 + Math.floor(Math.random() * 10000)
        };
      });
    });
    
    causesDataByYear[year] = {
      causes,
      monthlyBreakdown
    };
  });
  
  return causesDataByYear;
}

// Generate sample top causes
function getSampleTopCauses() {
  const causeIds = [2, 10, 11, 1, 14, 5, 3, 4, 6, 7];
  const totalFires = 42500;
  
  const totalFiresPerCause = {};
  causeIds.forEach(causeId => {
    totalFiresPerCause[causeId] = Math.floor(Math.random() * 10000) + 1000;
  });
  
  return causeIds.map(causeId => {
    const fires = totalFiresPerCause[causeId];
    const percentage = Math.round((fires / totalFires) * 1000) / 10;
    
    return {
      causeId,
      causeName: getSampleCauseDefinitions()[causeId],
      fires,
      acres: fires * (20 + Math.floor(Math.random() * 80)),
      percentage
    };
  }).sort((a, b) => b.fires - a.fires);
}

// Sample cause definitions
function getSampleCauseDefinitions() {
  return {
    1: "Lightning",
    2: "Equipment Use",
    3: "Smoking",
    4: "Campfire",
    5: "Debris Burning",
    6: "Railroad",
    7: "Arson",
    8: "Playing with Fire",
    9: "Miscellaneous",
    10: "Vehicle",
    11: "Power Line",
    12: "Firefighter Training",
    13: "Non-Firefighter Training",
    14: "Unknown/Unidentified",
    15: "Structure",
    16: "Aircraft",
    17: "Volcanic",
    18: "Escaped Prescribed Burn",
    19: "Illegal Alien Campfire"
  };
}

// Sample temperature-fire correlation data
function getSampleTemperatureFireData() {
  const years = ["2020", "2021", "2022", "2023", "2024", "2025"];
  const scatterplotData = [];
  
  years.forEach(year => {
    scatterplotData.push({
      year: parseInt(year),
      tempValue: 0.5 + Math.random() * 2,
      fireCount: 0.5 + Math.random() * 2,
      fires: 5000 + Math.floor(Math.random() * 3000),
      acres: 350000 + Math.floor(Math.random() * 500000)
    });
  });
  
  return {
    scatterplotData,
    correlations: {
      temperatureToFires: {
        value: 0.72,
        description: "Strong positive correlation"
      },
      temperatureToAcres: {
        value: 0.68,
        description: "Moderate positive correlation"
      }
    },
    summary: {
      totalYears: years.length,
      avgTemperature: 1.5,
      avgFires: 6500,
      avgAcres: 550000
    }
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;