const fs = require('fs');
const path = require('path');

// Configuration
const STATS_DIR = path.join(__dirname, 'processed_stats');
const SOURCE_FILE = path.join(STATS_DIR, 'CA_Perimeters_CAL_FIRE-stats.json');
const TARGET_FILE = path.join(STATS_DIR, 'firep23_1-supplement-2024-2025-stats.json');

console.log('Creating supplementary statistics file...');

// Ensure stats directory exists
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  console.log('Created statistics directory:', STATS_DIR);
}

// Check if source file exists
if (!fs.existsSync(SOURCE_FILE)) {
  console.error(`Source file not found: ${SOURCE_FILE}`);
  process.exit(1);
}

try {
  // Read the source statistics
  const sourceData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  
  // Filter only 2024-2025 data (or whatever new years you have)
  const filteredYearlyData = sourceData.yearlyData.filter(yearData => 
    yearData.year === "2024" || yearData.year === "2025"
  );
  
  const filteredYears = sourceData.years.filter(year => 
    year === "2024" || year === "2025"
  );
  
  // Only keep monthly data for the filtered years
  const filteredMonthlyDataByYear = {};
  filteredYears.forEach(year => {
    if (sourceData.monthlyDataByYear[year]) {
      filteredMonthlyDataByYear[year] = sourceData.monthlyDataByYear[year];
    }
  });
  
  // Create the supplement statistics
  const supplementData = {
    yearlyData: filteredYearlyData,
    years: filteredYears,
    monthlyDataByYear: filteredMonthlyDataByYear,
    summary: {
      totalFires: filteredYearlyData.reduce((sum, year) => sum + year.fires, 0),
      totalAcres: filteredYearlyData.reduce((sum, year) => sum + year.acres, 0),
      worstYear: filteredYearlyData.length > 0 ? 
        filteredYearlyData.reduce((worst, year) => 
          year.acres > worst.acres ? year : worst
        ).year : null,
      worstYearAcres: filteredYearlyData.length > 0 ? 
        filteredYearlyData.reduce((worst, year) => 
          year.acres > worst.acres ? year : worst
        ).acres : 0
    },
    metadata: {
      sourceFile: 'CA_Perimeters_CAL_FIRE.geojson',
      processedAt: new Date().toISOString(),
      supplementFor: 'firep23_1',
      yearRange: '2024-2025'
    }
  };
  
  // Save the supplement statistics file
  fs.writeFileSync(TARGET_FILE, JSON.stringify(supplementData, null, 2));
  
  console.log(`Successfully created supplement file: ${TARGET_FILE}`);
  console.log(`Added data for years: ${filteredYears.join(', ')}`);
  console.log(`Total fires in supplement: ${supplementData.summary.totalFires}`);
  console.log(`Total acres in supplement: ${Math.round(supplementData.summary.totalAcres).toLocaleString()}`);
  
} catch (err) {
  console.error('Error creating supplement file:', err);
}