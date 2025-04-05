// monthly-temperature-processor.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const DATA_DIR = path.join(__dirname, 'uploads');
const STATS_DIR = path.join(__dirname, 'processed_stats');
const TEMP_FILE = 'temperature-data.csv'; // Temperature data file

// Ensure stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created statistics directory:', STATS_DIR);
}

// Parse date code similar to the previous processor
function parseDateCode(dateCode) {
  const dateStr = dateCode.toString();
  
  let year, month;
  
  if (dateStr.length === 6) {
    const yearPrefix = parseInt(dateStr.substring(0, 2));
    let century;
    if (yearPrefix === 18) {
      century = 1800;
    } else if (yearPrefix === 19) {
      century = 1900;
    } else if (yearPrefix === 20) {
      century = 2000;
    } else {
      century = yearPrefix >= 50 ? 1900 : 2000;
    }
    
    year = century + parseInt(dateStr.substring(2, 4));
    month = parseInt(dateStr.substring(4, 6));
  } else {
    console.warn(`Unexpected date format: ${dateCode}. Using fallback parsing.`);
    const yearStr = dateStr.substring(0, 2);
    const monthStr = dateStr.substring(2, 4);
    year = parseInt(yearStr) >= 50 ? 1900 + parseInt(yearStr) : 2000 + parseInt(yearStr);
    month = parseInt(monthStr);
  }
  
  return { year, month };
}

// Months mapping
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Process and aggregate monthly temperature data
function processMonthlyTemperatures(tempData) {
  // Group temperatures by month across all years
  const monthlyTemperatures = {};
  
  MONTHS.forEach((_, monthIndex) => {
    monthlyTemperatures[monthIndex + 1] = {
      month: MONTHS[monthIndex],
      dataPoints: [] // Will store objects with temperature and year
    };
  });
  
  // Collect temperatures for each month with year information
  tempData.forEach(entry => {
    const { year, month } = parseDateCode(entry.Date);
    const tempValue = parseFloat(entry.Value);
    
    if (!isNaN(tempValue)) {
      // Store both temperature and year
      monthlyTemperatures[month].dataPoints.push({
        temperature: tempValue,
        year: year
      });
    }
  });
  
  // Calculate statistical summaries for each month
  const monthlyStats = Object.values(monthlyTemperatures).map(monthData => {
    // Extract just the temperature values for statistical calculations
    const temps = monthData.dataPoints.map(point => point.temperature);
    
    // Sort temperatures to calculate quartiles
    const sortedTemps = temps.slice().sort((a, b) => a - b);
    const n = sortedTemps.length;
    
    // Calculate quartiles
    const q1Index = Math.floor((n + 1) / 4);
    const q2Index = Math.floor((n + 1) / 2);
    const q3Index = Math.floor(3 * (n + 1) / 4);
    
    const min = sortedTemps[0];
    const q1 = sortedTemps[q1Index];
    const median = sortedTemps[q2Index];
    const q3 = sortedTemps[q3Index];
    const max = sortedTemps[n - 1];
    
    // Identify outliers
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Identify outliers with year information
    const outliers = monthData.dataPoints.filter(
      point => point.temperature < lowerBound || point.temperature > upperBound
    );
    
    return {
      month: monthData.month,
      min,
      q1,
      median,
      q3,
      max,
      outliers,
      // Keep the full dataPoints array with temperature and year
      dataPoints: monthData.dataPoints
    };
  });
  
  return monthlyStats;
}

// Create a separate file for each month's detailed data points
function saveMonthlyDataPoints(monthlyStats) {
  // Create directory for detailed data points
  const detailDir = path.join(STATS_DIR, 'monthly_detail');
  if (!fs.existsSync(detailDir)) {
    fs.mkdirSync(detailDir, { recursive: true });
  }
  
  // Save data points for each month
  monthlyStats.forEach(monthData => {
    const filename = path.join(detailDir, `${monthData.month.toLowerCase()}.json`);
    fs.writeFileSync(filename, JSON.stringify(monthData.dataPoints, null, 2));
    console.log(`Saved ${monthData.dataPoints.length} data points for ${monthData.month}`);
  });
}

// Main processing function
function processTemperatureData() {
  const tempFilePath = path.join(DATA_DIR, TEMP_FILE);
  
  if (!fs.existsSync(tempFilePath)) {
    console.error(`Temperature data file not found: ${tempFilePath}`);
    process.exit(1);
  }
  
  const tempData = [];
  
  fs.createReadStream(tempFilePath)
    .pipe(csv({
      skipLines: 4, // Skip header lines
      headers: ['Date', 'Value', 'Anomaly']
    }))
    .on('data', (row) => {
      tempData.push(row);
    })
    .on('end', () => {
      console.log(`Processed ${tempData.length} temperature data points`);
      
      // Process monthly temperatures
      const monthlyStats = processMonthlyTemperatures(tempData);
      
      // Output file path for summary statistics
      const summaryFilename = path.join(STATS_DIR, 'monthly-temperature-stats.json');
      
      // Create a clean version of the stats (without huge arrays of dataPoints)
      // This keeps the API response size reasonable
      const cleanStats = monthlyStats.map(({ month, min, q1, median, q3, max, outliers }) => ({
        month, min, q1, median, q3, max, 
        outlierCount: outliers.length
      }));
      
      // Write summary results to file
      fs.writeFileSync(summaryFilename, JSON.stringify(cleanStats, null, 2));
      console.log(`Monthly temperature statistics saved to: ${summaryFilename}`);
      
      // Save detailed data points (with year info) to separate files
      saveMonthlyDataPoints(monthlyStats);
      
      console.log('Monthly Statistics:', 
        cleanStats.map(m => `${m.month}: ${m.median.toFixed(2)}°`)
      );
    });
}

// Run the processor
processTemperatureData();