// Updated server.js with support for Fire Cause Analysis
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Define the uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
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
console.log('Uploads directory path:', uploadsDir);
console.log('Uploads directory exists:', fs.existsSync(uploadsDir));

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

// Import both handlers
const { handleLargeGeoJSONFile } = require('./large-file-handler');
const { handleGeoJSONFile } = require('./universal-geojson-handler');

// Define the file size threshold for using the large file handler (700MB in bytes)
const LARGE_FILE_THRESHOLD = 700 * 1024 * 1024;

// In-memory data store for dataset metadata
const dataStore = {
    default: {
        name: 'Default Dataset',
        description: 'Sample fire data'
    }
};

// Add available GeoJSON files from the uploads directory
const geojsonFiles = [];

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

// Scan the uploads directory for GeoJSON files
try {
    const files = fs.readdirSync(uploadsDir);
    console.log('All files in uploads directory:', files);
    
    files.forEach(file => {
        console.log(`Checking file: ${file}`);
        if (file.endsWith('.geojson') || file.endsWith('.json')) {
            const filePath = path.join(uploadsDir, file);
            console.log(`Found GeoJSON file: ${file}, Size: ${Math.round(fs.statSync(filePath).size / (1024 * 1024))}MB`);
            
            const datasetId = file.replace(/\.[^/.]+$/, ""); // Remove extension
            dataStore[datasetId] = {
                name: `${datasetId} Dataset`,
                description: `GeoJSON data from ${file}`,
                filePath: filePath
            };
            geojsonFiles.push(file);
        }
    });
} catch (err) {
    console.error('Error scanning uploads directory:', err);
}

console.log(`Found ${geojsonFiles.length} GeoJSON files in uploads directory:`, geojsonFiles);

// Simple test endpoint to verify server is responding
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        datasets: Object.keys(dataStore)
    });
});

// Get processed data - load directly from file
app.get('/api/data/:dataset', async (req, res) => {
    const { dataset } = req.params;
    const { maxFeatures } = req.query;
    const maxFeatureCount = parseInt(maxFeatures) || 100000;

    console.log(`Request for dataset: ${dataset}`);
    console.log(`Available datasets: ${Object.keys(dataStore).join(', ')}`);

    if (!dataStore[dataset]) {
        console.log(`Dataset ${dataset} not found`);
        return res.status(404).json({ error: 'Dataset not found' });
    }
    
    try {
        const datasetInfo = dataStore[dataset];
        console.log(`Loading dataset: ${dataset}`, datasetInfo);
        
        // If this is a default dataset with no file, return sample data
        if (dataset === 'default' && !datasetInfo.filePath) {
            console.log('Returning sample data for default dataset');
            return res.json({
                ...datasetInfo,
                geoData: {
                    type: 'FeatureCollection',
                    features: [
                        // Sample feature
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'Polygon',
                                coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
                            },
                            properties: { name: 'Sample Region', value: 100 }
                        }
                    ]
                }
            });
        }
        
        // For datasets with a file path, load the GeoJSON
        if (datasetInfo.filePath) {
            const filePath = datasetInfo.filePath;
            console.log(`Loading GeoJSON from ${filePath}`);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.error(`File does not exist: ${filePath}`);
                return res.status(404).json({ 
                    error: 'GeoJSON file not found',
                    details: `The file ${path.basename(filePath)} could not be found in the uploads directory`
                });
            }
            
            // Get file size
            const fileSize = fs.statSync(filePath).size;
            console.log(`File size: ${Math.round(fileSize / (1024 * 1024))} MB`);
            
            // Process with timeout to prevent hanging
            let processingTimeout;
            const timeoutPromise = new Promise((_, reject) => {
                processingTimeout = setTimeout(() => {
                    reject(new Error('GeoJSON processing timed out'));
                }, 60000); // 60 second timeout
            });
            
            try {
                // Decide which handler to use based on file size
                let geoJsonData;
                const startTime = Date.now();
                
                if (fileSize >= LARGE_FILE_THRESHOLD) {
                    // Use large file handler for files 700MB or larger
                    console.log(`Using large file handler for ${Math.round(fileSize / (1024 * 1024))}MB file (≥ 700MB threshold)`);
                    geoJsonData = await Promise.race([
                        handleLargeGeoJSONFile(filePath, maxFeatureCount),
                        timeoutPromise
                    ]);
                } else {
                    // Use universal handler for smaller files
                    console.log(`Using universal GeoJSON handler for ${Math.round(fileSize / (1024 * 1024))}MB file (< 700MB threshold)`);
                    geoJsonData = await Promise.race([
                        handleGeoJSONFile(filePath, maxFeatureCount),
                        timeoutPromise
                    ]);
                }
                
                // Clear timeout since processing completed
                clearTimeout(processingTimeout);
                
                console.log(`Processed GeoJSON in ${(Date.now() - startTime)/1000} seconds`);
                
                // Send the processed data
                return res.json({
                    ...datasetInfo,
                    geoData: geoJsonData,
                    simplified: geoJsonData._simplified || false,
                    totalFeatures: geoJsonData._totalFeatures || geoJsonData.features.length,
                    processingTime: `${(Date.now() - startTime)/1000} seconds`
                });
            } catch (timeoutErr) {
                clearTimeout(processingTimeout);
                console.error("GeoJSON processing timed out or failed:", timeoutErr);
                
                // Fall back to emergency sample approach
                console.log("Using emergency sampling approach");
                
                // Take a very basic sample of the file
                const emergencySample = {
                    type: 'FeatureCollection',
                    features: [],
                    _error: "Processing timed out - showing limited sample",
                    _emergency: true
                };
                
                try {
                    // Read the first 5MB to extract some features
                    const sampleBuffer = Buffer.alloc(5 * 1024 * 1024);
                    const fd = fs.openSync(filePath, 'r');
                    fs.readSync(fd, sampleBuffer, 0, 5 * 1024 * 1024, 0);
                    fs.closeSync(fd);
                    
                    const sample = sampleBuffer.toString('utf8');
                    const featureStart = sample.indexOf('"features"');
                    
                    if (featureStart > 0) {
                        const arrayStart = sample.indexOf('[', featureStart);
                        if (arrayStart > 0) {
                            let pos = arrayStart;
                            let featuresFound = 0;
                            
                            while (featuresFound < 50) {
                                const nextFeature = sample.indexOf('{"type":"Feature"', pos);
                                if (nextFeature === -1) break;
                                
                                // Find a complete feature with basic balancing
                                let balance = 0;
                                let end = -1;
                                
                                for (let i = nextFeature; i < sample.length; i++) {
                                    if (sample[i] === '{') balance++;
                                    if (sample[i] === '}') {
                                        balance--;
                                        if (balance === 0) {
                                            end = i + 1;
                                            break;
                                        }
                                    }
                                }
                                
                                if (end !== -1) {
                                    try {
                                        const feature = JSON.parse(sample.substring(nextFeature, end));
                                        if (feature.type === 'Feature' && feature.geometry) {
                                            emergencySample.features.push(feature);
                                            featuresFound++;
                                        }
                                    } catch (e) {
                                        // Skip invalid features
                                    }
                                }
                                
                                pos = Math.max(end, nextFeature + 10);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Emergency sampling failed:", err);
                }
                
                emergencySample._totalFeatures = emergencySample.features.length;
                
                // Return whatever we could extract
                return res.json({
                    ...datasetInfo,
                    geoData: emergencySample,
                    simplified: true,
                    emergency: true,
                    totalFeatures: emergencySample.features.length,
                    processingTime: "timed out"
                });
            }
        }
        
        // For datasets that are already in memory (like the default one)
        console.log('Dataset has no file path, returning dataset info directly');
        res.json(datasetInfo);
    }
    catch (err) {
        console.error(`Error retrieving dataset ${dataset}:`, err);
        res.status(500).json({ 
            error: 'Error retrieving dataset',
            message: err.message 
        });
    }
});

// Get list of available datasets
app.get('/api/datasets', (req, res) => {
    const datasets = Object.entries(dataStore).map(([id, dataset]) => ({
        id,
        name: dataset.name || id,
        description: dataset.description || '',
        fileSize: dataset.filePath ? 
            `${Math.round(fs.statSync(dataset.filePath).size / (1024 * 1024))}MB` : 
            undefined
    }));

    res.json(datasets);
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

// UPDATED: API endpoint to get yearly statistics with support for Fire Cause Analysis
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

// UPDATED: API endpoint to get monthly statistics with support for supplementary files
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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Available datasets: ${Object.keys(dataStore).join(', ')}`);
});

module.exports = app;