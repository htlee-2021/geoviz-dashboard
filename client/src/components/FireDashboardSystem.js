import React, { useEffect, useState } from 'react';
import { MainDashboard } from './MainDashboard';
import { YearlyAnalysisDashboard } from './YearlyAnalysisDashboard';
import { FireCauseAnalysisDashboard } from './FireCauseAnalysisDashboard';
import './FireDashboard.css';

const FireDashboardSystem = ({ containerId }) => {
  const [container, setContainer] = useState(null);
  const [activeTab, setActiveTab] = useState('main');
  const [yearlyData, setYearlyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [causesData, setCausesData] = useState({});
  const [topCauses, setTopCauses] = useState([]);
  const [causeDefinitions, setCauseDefinitions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalFires: 0,
    totalAcres: 0,
    yearlyAcres: 0,
    peakMonth: '',
    worstYear: '',
    worstYearAcres: 0,
    recentYear: '',
    recentYearFires: 0,
    recentYearAcres: 0,
    avgAnnualFires: 0,
    avgAnnualAcres: 0
  });
  
  const backendBaseUrl = 'http://localhost:8000';
  
  useEffect(() => {
    setContainer(document.getElementById(containerId));
    fetchYearlyData();
  }, [containerId]);
  
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };
  
  const fetchYearlyData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendBaseUrl}/api/stats/yearly?dataset=firep23_1`);
      
      if (!response.ok) {
        // If we get a 404, it means the statistics file isn't available
        if (response.status === 404) {
          console.warn("Statistics file not found");
          handleDataError("Statistics file not found. Please run the preprocessor script first.");
          return;
        }
        throw new Error(`Failed to fetch yearly data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setYearlyData(data.yearlyData);
      setAvailableYears(data.years);
      
      // Set fire cause data if available
      if (data.causesDataByYear) {
        setCausesData(data.causesDataByYear);
      }
      
      if (data.topCauses) {
        setTopCauses(data.topCauses);
      }
      
      if (data.causeDefinitions) {
        setCauseDefinitions(data.causeDefinitions);
      }
      
      // Calculate additional statistics
      const sortedYears = [...data.yearlyData].sort((a, b) => parseInt(b.year) - parseInt(a.year));
      const recentYearData = sortedYears.length > 0 ? sortedYears[0] : null;
      
      const totalFires = data.summary.totalFires;
      const totalAcres = data.summary.totalAcres;
      const yearCount = data.years.length;
      
      // Update summary stats
      setSummaryStats({
        totalFires: totalFires,
        totalAcres: totalAcres,
        worstYear: data.summary.worstYear,
        worstYearAcres: data.summary.worstYearAcres,
        recentYear: recentYearData ? recentYearData.year : 'N/A',
        recentYearFires: recentYearData ? recentYearData.fires : 0,
        recentYearAcres: recentYearData ? recentYearData.acres : 0,
        avgAnnualFires: yearCount > 0 ? Math.round(totalFires / yearCount) : 0,
        avgAnnualAcres: yearCount > 0 ? Math.round(totalAcres / yearCount) : 0
      });
      
      // Set the most recent year as the default selected year
      if (data.years.length > 0) {
        const maxYear = Math.max(...data.years.map(y => parseInt(y)));
        setSelectedYear(maxYear.toString());
        
        // Fetch monthly data for the selected year
        fetchMonthlyData(maxYear.toString());
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error("Error fetching yearly fire data:", err);
      handleDataError("Failed to load fire data. Please check server connection and run the preprocessor script.");
    }
  };
  
  const fetchMonthlyData = async (year) => {
    if (error || !year) {
      setEmptyMonthlyData();
      return;
    }

    try {
      // Only show loading indicator for initial data load, not for year changes
      const wasEmpty = monthlyData.length === 0;
      if (wasEmpty) {
        setLoading(true);
      }
      
      const response = await fetch(`${backendBaseUrl}/api/stats/monthly?dataset=firep23_1&year=${year}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Monthly statistics not found");
          setError("Monthly statistics for this year not found. Please run the preprocessor script first.");
          setEmptyMonthlyData();
          return;
        }
        throw new Error(`Failed to fetch monthly data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setMonthlyData(data.monthlyData);
      
      // Update summary stats for the selected year
      setSummaryStats(prevStats => ({
        ...prevStats,
        yearlyAcres: data.summary.totalAcres,
        peakMonth: data.summary.peakMonth
      }));
      
      if (wasEmpty) {
        setLoading(false);
      }
      
    } catch (err) {
      console.error(`Error fetching monthly fire data for year ${year}:`, err);
      setError(`Failed to load monthly data for ${year}. Please check server connection.`);
      setEmptyMonthlyData();
      if (monthlyData.length === 0) {
        setLoading(false);
      }
    }
  };
  
  const handleYearChange = (year) => {
    setSelectedYear(year);
    fetchMonthlyData(year);
  };
  
  const handleDataError = (errorMessage) => {
    setYearlyData([]);
    setAvailableYears([]);
    setSelectedYear(null);
    setCausesData({});
    setTopCauses([]);
    setError(errorMessage || "Failed to load fire data. Please run the preprocessor script first.");
    setLoading(false);
  };
  
  const setEmptyMonthlyData = () => {
    setMonthlyData([]);
    setSummaryStats(prevStats => ({
      ...prevStats,
      yearlyAcres: 0,
      peakMonth: 'N/A'
    }));
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <div className="loading-text">Loading fire data...</div>
          </div>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="dashboard-content">
        <div className="error-container">
          <div className="dashboard-header">
            <h2 className="dashboard-title">California Wildfire Dashboard</h2>
          </div>
          
          <div className="error-message">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="error-title">Data Loading Error</h3>
                <div className="error-details">
                  <p>{error}</p>
                </div>
                <div>
                  <p className="error-help">To fix this issue:</p>
                  <ol className="error-list">
                    <li className="error-list-item">Make sure the server is running at {backendBaseUrl}</li>
                    <li className="error-list-item">Ensure your GeoJSON files are placed in the 'uploads' directory</li>
                    <li className="error-list-item">Run the preprocessor script to generate statistics files:</li>
                  </ol>
                  <div className="error-command">
                    <code>node preprocessor.js</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <button onClick={fetchYearlyData} className="error-retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard-system-container">
      <div className="dashboard-tabs">
        <button 
          className={`dashboard-tab ${activeTab === 'main' ? 'active' : ''}`} 
          onClick={() => handleTabChange('main')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Dashboard Overview
        </button>
        <button 
          className={`dashboard-tab ${activeTab === 'yearly' ? 'active' : ''}`} 
          onClick={() => handleTabChange('yearly')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          Yearly Analysis
        </button>
        <button 
          className={`dashboard-tab ${activeTab === 'causes' ? 'active' : ''}`} 
          onClick={() => handleTabChange('causes')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
          </svg>
          Fire Causes
        </button>
        <button 
          className={`dashboard-tab ${activeTab === 'map' ? 'active' : ''}`} 
          onClick={() => handleTabChange('map')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
          </svg>
          Fire Map
        </button>
      </div>
      
      <div className="dashboard-content">
        <div id="main-dashboard" className={`dashboard-tab-content ${activeTab === 'main' ? 'active' : ''}`}>
          {activeTab === 'main' && (
            <MainDashboard 
              summaryStats={summaryStats}
              yearlyData={yearlyData}
              onRefresh={fetchYearlyData}
            />
          )}
        </div>
        <div id="yearly-dashboard" className={`dashboard-tab-content ${activeTab === 'yearly' ? 'active' : ''}`}>
          {activeTab === 'yearly' && (
            <YearlyAnalysisDashboard
              yearlyData={yearlyData}
              monthlyData={monthlyData}
              selectedYear={selectedYear}
              availableYears={availableYears}
              summaryStats={summaryStats}
              onYearChange={handleYearChange}
              onRefresh={fetchYearlyData}
            />
          )}
        </div>
        <div id="causes-dashboard" className={`dashboard-tab-content ${activeTab === 'causes' ? 'active' : ''}`}>
          {activeTab === 'causes' && (
            <FireCauseAnalysisDashboard
              causesData={causesData}
              topCauses={topCauses}
              causeDefinitions={causeDefinitions}
              selectedYear={selectedYear}
              availableYears={availableYears}
              onYearChange={handleYearChange}
              onRefresh={fetchYearlyData}
            />
          )}
        </div>
        <div id="map-dashboard" className={`dashboard-tab-content ${activeTab === 'map' ? 'active' : ''}`}>
          {activeTab === 'map' && (
            <div className="map-placeholder">
              <h3>California Fire Map</h3>
              <p>Map component would be loaded here.</p>
              <p>This tab would contain your existing CaliforniaFireMap component.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FireDashboardSystem;