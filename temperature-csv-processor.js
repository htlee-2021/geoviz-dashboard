// temperature-fire-processor.js - Analyze correlation between temperature and fire data
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const DATA_DIR = path.join(__dirname, 'uploads');
const STATS_DIR = path.join(__dirname, 'processed_stats');
const TEMP_FILE = 'temperature-data.csv'; // Temperature data file
const FIRE_STATS_FILE = 'firep23_1-stats.json'; // Your existing fire stats file

// Ensure stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created statistics directory:', STATS_DIR);
}

// First, check if the files exist
const tempFilePath = path.join(DATA_DIR, TEMP_FILE);
const fireStatsPath = path.join(STATS_DIR, FIRE_STATS_FILE);

if (!fs.existsSync(tempFilePath)) {
  console.error(`Temperature data file not found: ${tempFilePath}`);
  process.exit(1);
}

if (!fs.existsSync(fireStatsPath)) {
  console.error(`Fire stats file not found: ${fireStatsPath}`);
  console.error('Please run the fire data processor first');
  process.exit(1);
}

console.log('Processing temperature and fire correlation...');

// Load fire statistics data
const fireStats = JSON.parse(fs.readFileSync(fireStatsPath, 'utf8'));

// Improved date parsing function for temperature data
function parseDateCode(dateCode) {
  const dateStr = dateCode.toString();
  
  // Extract year and month based on the format
  let year, month;
  
  if (dateStr.length === 6) {
    // Format: YYMMDD where YY is the last two digits of the year
    const yearPrefix = parseInt(dateStr.substring(0, 2));
    // Determine century based on the first two digits
    // 18xx for years starting with 18, 19xx for years starting with 19, etc.
    let century;
    if (yearPrefix === 18) {
      century = 1800;
    } else if (yearPrefix === 19) {
      century = 1900;
    } else if (yearPrefix === 20) {
      century = 2000;
    } else {
      // Default case - shouldn't happen with your data
      century = yearPrefix >= 50 ? 1900 : 2000;
    }
    
    // Extract the actual year and month
    year = century + parseInt(dateStr.substring(2, 4));
    month = parseInt(dateStr.substring(4, 6));
  } else {
    // If the format is different, fallback to original logic
    console.warn(`Unexpected date format: ${dateCode}. Using fallback parsing.`);
    const yearStr = dateStr.substring(0, 2);
    const monthStr = dateStr.substring(2, 4);
    year = parseInt(yearStr) >= 50 ? 1900 + parseInt(yearStr) : 2000 + parseInt(yearStr);
    month = parseInt(monthStr);
  }
  
  return {
    year,
    month
  };
}

// Process temperature data
const tempData = [];
const yearlyTempData = {};

fs.createReadStream(tempFilePath)
  .pipe(csv({
    skipLines: 4, // Skip the header lines
    headers: ['Date', 'Value', 'Anomaly']
  }))
  .on('data', (row) => {
    // Make sure we have a valid date and temperature value
    if (row.Date && row.Value && !isNaN(parseFloat(row.Value))) {
      const dateCode = parseInt(row.Date);
      const dateInfo = parseDateCode(dateCode);
      const tempValue = parseFloat(row.Value);
      const anomaly = parseFloat(row.Anomaly || 0);
      
      // Store individual data point
      tempData.push({
        dateCode,
        year: dateInfo.year,
        month: dateInfo.month,
        tempValue,
        anomaly
      });
      
      // Aggregate temperatures by year
      if (!yearlyTempData[dateInfo.year]) {
        yearlyTempData[dateInfo.year] = {
          tempValues: [],
          anomalyValues: []
        };
      }
      
      yearlyTempData[dateInfo.year].tempValues.push(tempValue);
      yearlyTempData[dateInfo.year].anomalyValues.push(anomaly);
    }
  })
  .on('end', () => {
    console.log(`Processed ${tempData.length} temperature data points`);
    console.log(`Years with temperature data: ${Object.keys(yearlyTempData).sort().join(', ')}`);
    
    // Calculate yearly temperature averages
    const yearlyAverages = {};
    Object.entries(yearlyTempData).forEach(([year, data]) => {
      if (data.tempValues.length > 0) {
        yearlyAverages[year] = {
          avgTemp: data.tempValues.reduce((sum, val) => sum + val, 0) / data.tempValues.length,
          avgAnomaly: data.anomalyValues.reduce((sum, val) => sum + val, 0) / data.anomalyValues.length
        };
      }
    });
    
    // Get fire data by year from the fire stats
    const yearlyFireData = {};
    fireStats.yearlyData.forEach(yearData => {
      // Make sure we're using strings consistently for year comparison
      yearlyFireData[yearData.year.toString()] = {
        fires: yearData.fires,
        acres: yearData.acres
      };
    });
    
    console.log(`Years with fire data: ${Object.keys(yearlyFireData).sort().join(', ')}`);
    
    // Merge temperature and fire data
    const mergedYearlyData = [];
    
    // Find years present in both datasets
    const commonYears = Object.keys(yearlyAverages).filter(year => yearlyFireData[year]);
    
    console.log(`Years common to both datasets: ${commonYears.sort().join(', ')}`);
    
    commonYears.forEach(year => {
      mergedYearlyData.push({
        year: parseInt(year),
        avgTemp: yearlyAverages[year].avgTemp,
        avgAnomaly: yearlyAverages[year].avgAnomaly,
        fires: yearlyFireData[year].fires,
        acres: yearlyFireData[year].acres,
        acresPerFire: yearlyFireData[year].acres / yearlyFireData[year].fires
      });
    });
    
    // Sort by year
    mergedYearlyData.sort((a, b) => a.year - b.year);
    
    // Normalize values for correlation analysis
    const normalizedData = normalizeData(mergedYearlyData);
    
    // Calculate correlations
    const tempToFiresCorrelation = calculateCorrelation(
      normalizedData.map(d => d.normalizedTemp),
      normalizedData.map(d => d.normalizedFires)
    );
    
    const tempToAcresCorrelation = calculateCorrelation(
      normalizedData.map(d => d.normalizedTemp),
      normalizedData.map(d => d.normalizedAcres)
    );
    
    const anomalyToFiresCorrelation = calculateCorrelation(
      normalizedData.map(d => d.normalizedAnomaly),
      normalizedData.map(d => d.normalizedFires)
    );
    
    // Generate visualization data
    const scatterplotData = normalizedData.map(d => ({
      year: d.year,
      tempValue: d.normalizedTemp,
      fireCount: d.normalizedFires,
      acres: d.normalizedAcres,
      anomaly: d.normalizedAnomaly
    }));
    
    // Calculate regression lines
    const tempToFiresRegression = calculateRegression(
      normalizedData.map(d => d.normalizedTemp),
      normalizedData.map(d => d.normalizedFires)
    );
    
    // Create output statistics
    const statistics = {
      correlations: {
        temperatureToFires: {
          value: tempToFiresCorrelation,
          interpretation: getCorrelationInterpretation(tempToFiresCorrelation)
        },
        temperatureToAcres: {
          value: tempToAcresCorrelation,
          interpretation: getCorrelationInterpretation(tempToAcresCorrelation)
        },
        anomalyToFires: {
          value: anomalyToFiresCorrelation,
          interpretation: getCorrelationInterpretation(anomalyToFiresCorrelation)
        }
      },
      mergedYearlyData,
      normalizedData,
      years: commonYears.map(y => parseInt(y)),
      scatterplotData,
      regressionData: {
        tempToFires: tempToFiresRegression
      },
      metadata: {
        temperatureSource: TEMP_FILE,
        fireDataSource: FIRE_STATS_FILE,
        processedAt: new Date().toISOString(),
        yearsAnalyzed: commonYears.length,
        yearRange: `${Math.min(...commonYears.map(y => parseInt(y)))}-${Math.max(...commonYears.map(y => parseInt(y)))}`
      }
    };
    
    // Save to output file
    const outputFilename = path.join(STATS_DIR, 'temperature-fire-correlation.json');
    fs.writeFileSync(outputFilename, JSON.stringify(statistics, null, 2));
    
    console.log(`Found ${commonYears.length} years of overlap between temperature and fire data`);
    console.log(`Temperature to Fires correlation: ${tempToFiresCorrelation.toFixed(3)} (${getCorrelationInterpretation(tempToFiresCorrelation)})`);
    console.log(`Temperature to Acres correlation: ${tempToAcresCorrelation.toFixed(3)} (${getCorrelationInterpretation(tempToAcresCorrelation)})`);
    console.log(`Anomaly to Fires correlation: ${anomalyToFiresCorrelation.toFixed(3)} (${getCorrelationInterpretation(anomalyToFiresCorrelation)})`);
    console.log(`Results saved to: ${outputFilename}`);
  });

// Normalize data for meaningful correlation analysis
function normalizeData(data) {
  // Extract arrays of values
  const temps = data.map(d => d.avgTemp);
  const anomalies = data.map(d => d.avgAnomaly);
  const fires = data.map(d => d.fires);
  const acres = data.map(d => d.acres);
  
  // Calculate min and max for each metric
  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const anomalyMin = Math.min(...anomalies);
  const anomalyMax = Math.max(...anomalies);
  const firesMin = Math.min(...fires);
  const firesMax = Math.max(...fires);
  const acresMin = Math.min(...acres);
  const acresMax = Math.max(...acres);
  
  // Normalize each data point
  return data.map(d => ({
    ...d,
    normalizedTemp: normalizeValue(d.avgTemp, tempMin, tempMax),
    normalizedAnomaly: normalizeValue(d.avgAnomaly, anomalyMin, anomalyMax),
    normalizedFires: normalizeValue(d.fires, firesMin, firesMax),
    normalizedAcres: normalizeValue(d.acres, acresMin, acresMax)
  }));
}

// Simple min-max normalization
function normalizeValue(value, min, max) {
  if (max === min) return 0; // Avoid division by zero
  return (value - min) / (max - min);
}

// Calculate Pearson correlation coefficient
function calculateCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  
  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate covariance and standard deviations
  let numerator = 0;
  let xDev = 0;
  let yDev = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = y[i] - yMean;
    numerator += xDiff * yDiff;
    xDev += xDiff * xDiff;
    yDev += yDiff * yDiff;
  }
  
  if (xDev === 0 || yDev === 0) return 0;
  return numerator / (Math.sqrt(xDev) * Math.sqrt(yDev));
}

// Calculate linear regression
function calculateRegression(x, y) {
  const n = x.length;
  
  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  
  return {
    slope,
    intercept,
    equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
    points: [
      { x: 0, y: intercept },
      { x: 1, y: slope + intercept }
    ]
  };
}

// Get a human-readable interpretation of the correlation coefficient
function getCorrelationInterpretation(correlation) {
  const absCorrelation = Math.abs(correlation);
  if (absCorrelation >= 0.8) return "Very strong";
  if (absCorrelation >= 0.6) return "Strong";
  if (absCorrelation >= 0.4) return "Moderate";
  if (absCorrelation >= 0.2) return "Weak";
  return "Very weak or no correlation";
}