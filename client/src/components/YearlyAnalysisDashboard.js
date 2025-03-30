import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const YearlyAnalysisDashboard = ({ 
  yearlyData, 
  monthlyData, 
  selectedYear, 
  availableYears, 
  summaryStats, 
  onYearChange, 
  onRefresh 
}) => {
  const monthlyAcresChartRef = useRef(null);
  const monthlyFiresChartRef = useRef(null);
  
  useEffect(() => {
    if (monthlyData.length > 0) {
      createCharts();
    }
  }, [monthlyData, selectedYear]);
  
  // Format large numbers
  const formatLargeNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num;
  };
  
  // Get the data for the selected year
  const getSelectedYearData = () => {
    if (!yearlyData || yearlyData.length === 0 || !selectedYear) return null;
    return yearlyData.find(data => data.year === selectedYear);
  };
  
  // Get monthly data
  const getMonthByYearData = () => {
    if (!monthlyData || monthlyData.length === 0) return [];
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // For each month, find the highest acre value from all available years
    const data = [];
    
    months.forEach((month) => {
      const monthData = monthlyData.find(m => m.month === month);
      data.push({
        month,
        acres: monthData ? monthData.acres : 0,
        fires: monthData ? monthData.fires : 0
      });
    });
    
    return data;
  };
  
  const createCharts = () => {
    createMonthlyAcresChart();
    createMonthlyFiresChart();
  };
  
  const createMonthlyAcresChart = () => {
    const data = getMonthByYearData();
    if (data.length === 0 || !monthlyAcresChartRef.current) return;
    
    const margin = { top: 40, right: 30, bottom: 100, left: 60 };
    const svgElement = monthlyAcresChartRef.current;
    const width = svgElement.clientWidth || 800;
    const height = 400;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Clear any existing SVG
    d3.select(svgElement).selectAll('*').remove();
    
    // Create SVG
    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.month))
      .range([0, chartWidth])
      .padding(0.2);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.acres) * 1.1])
      .range([chartHeight, 0]);
    
    // Create axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em');
    
    svg.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => formatLargeNumber(d)));
    
    // Add grid lines
    svg.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yScale.ticks())
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('y1', d => yScale(d))
      .attr('x2', chartWidth)
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-dasharray', '3,3');
    
    // Add bars
    svg.selectAll('bars')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.month))
      .attr('y', d => yScale(d.acres))
      .attr('width', xScale.bandwidth())
      .attr('height', d => chartHeight - yScale(d.acres))
      .attr('fill', '#DC2626')
      .attr('rx', 4)
      .attr('ry', 4);
    
    // Add labels for high values
    svg.selectAll('value-labels')
      .data(data.filter(d => d.acres > 10000)) // Only label high values
      .enter()
      .append('text')
      .attr('x', d => xScale(d.month) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.acres) - 5)
      .attr('text-anchor', 'middle')
      .text(d => formatLargeNumber(d.acres))
      .style('font-size', '12px')
      .style('fill', '#6B7280');
    
    // Add title
    svg.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(`Acres Burned by Month in ${selectedYear}`);
    
    // Create tooltip
    const tooltip = d3.select('body')
      .selectAll('.tooltip')
      .data([null])
      .join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add hover effects
    svg.selectAll('rect')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.8);
        
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9);
        
        tooltip.html(`
          <strong>${d.month} ${selectedYear}</strong><br/>
          Acres Burned: ${d.acres.toLocaleString()}<br/>
          Fires: ${d.fires.toLocaleString()}<br/>
          ${d.fires > 0 ? `Acres per Fire: ${Math.round(d.acres / d.fires).toLocaleString()}` : ''}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 1);
        
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });
  };
  
  const createMonthlyFiresChart = () => {
    const data = getMonthByYearData();
    if (data.length === 0 || !monthlyFiresChartRef.current) return;
    
    const margin = { top: 40, right: 30, bottom: 100, left: 60 };
    const svgElement = monthlyFiresChartRef.current;
    const width = svgElement.clientWidth || 800;
    const height = 400;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Clear any existing SVG
    d3.select(svgElement).selectAll('*').remove();
    
    // Create SVG
    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.month))
      .range([0, chartWidth])
      .padding(0.4);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.fires) * 1.1])
      .range([chartHeight, 0]);
    
    // Create axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em');
    
    svg.append('g')
      .call(d3.axisLeft(yScale));
    
    // Add grid lines
    svg.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yScale.ticks())
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('y1', d => yScale(d))
      .attr('x2', chartWidth)
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-dasharray', '3,3');
    
    // Create line generator
    const lineGenerator = d3.line()
      .x(d => xScale(d.month) + xScale.bandwidth() / 2)
      .y(d => yScale(d.fires));
    
    // Add the line
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3B82F6')
      .attr('stroke-width', 3)
      .attr('d', lineGenerator);
    
    // Add dots
    svg.selectAll('dots')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.month) + xScale.bandwidth() / 2)
      .attr('cy', d => yScale(d.fires))
      .attr('r', 5)
      .attr('fill', '#3B82F6');
    
    // Add title
    svg.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(`Fire Counts by Month in ${selectedYear}`);
    
    // Create tooltip
    const tooltip = d3.select('body')
      .selectAll('.tooltip')
      .data([null])
      .join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add hover effects
    svg.selectAll('circle')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 7);
        
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9);
        
        tooltip.html(`
          <strong>${d.month} ${selectedYear}</strong><br/>
          Fires: ${d.fires.toLocaleString()}<br/>
          Acres Burned: ${d.acres.toLocaleString()}<br/>
          ${d.fires > 0 ? `Acres per Fire: ${Math.round(d.acres / d.fires).toLocaleString()}` : ''}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 5);
        
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });
  };
  
  const selectedYearData = getSelectedYearData();
  
  return (
    <div className="yearly-analysis-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Yearly Fire Analysis Dashboard</h2>
        <p className="dashboard-description">
          Detailed analysis of wildfire data for a specific year, showing monthly patterns
        </p>
      </div>
      
      {/* Year selector and summary */}
      <div className="year-selection-container">
        <div className="year-selector">
          <label htmlFor="year-select" className="year-selector-label">Select Year for Analysis:</label>
          <select
            id="year-select"
            className="year-selector-dropdown"
            value={selectedYear || ''}
            onChange={(e) => onYearChange(e.target.value)}
            disabled={availableYears.length === 0}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        {selectedYearData && (
          <div className="year-summary">
            <div className="year-summary-item">
              <div className="summary-label">Fires:</div>
              <div className="summary-value">{selectedYearData.fires.toLocaleString()}</div>
            </div>
            <div className="year-summary-item">
              <div className="summary-label">Acres Burned:</div>
              <div className="summary-value">{selectedYearData.acres.toLocaleString()}</div>
            </div>
            <div className="year-summary-item">
              <div className="summary-label">Peak Month:</div>
              <div className="summary-value">{summaryStats.peakMonth || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main content area with monthly visualization */}
      <div className="chart-section">
        <div className="chart-container">
          <h3 className="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
            </svg>
            Monthly Acres Burned in {selectedYear || '...'}
          </h3>
          <div className="chart-description">
            Shows acres burned by month for the selected year, highlighting peak fire season.
          </div>
          <div className="chart-canvas">
            <svg ref={monthlyAcresChartRef} width="100%" height="400"></svg>
          </div>
        </div>
      </div>
      
      {/* Second visualization */}
      <div className="chart-section">
        <div className="chart-container">
          <h3 className="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
            Fire Counts by Month in {selectedYear || '...'}
          </h3>
          <div className="chart-description">
            Shows the number of fires recorded each month for the selected year.
          </div>
          <div className="chart-canvas">
            <svg ref={monthlyFiresChartRef} width="100%" height="400"></svg>
          </div>
        </div>
      </div>
      
      {/* Monthly data table */}
      <div className="monthly-data-table-container">
        <h3 className="section-title">
          <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
          </svg>
          Monthly Breakdown for {selectedYear || '...'}
        </h3>
        <div className="data-table">
          <table className="monthly-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Fires</th>
                <th>Acres Burned</th>
                <th>Acres per Fire</th>
              </tr>
            </thead>
            <tbody>
              {getMonthByYearData().map((monthData) => (
                <tr key={monthData.month} className={monthData.month === summaryStats.peakMonth ? 'peak-month' : ''}>
                  <td>{monthData.month}</td>
                  <td>{monthData.fires.toLocaleString()}</td>
                  <td>{monthData.acres.toLocaleString()}</td>
                  <td>{monthData.fires > 0 ? Math.round(monthData.acres / monthData.fires).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>{selectedYearData ? selectedYearData.fires.toLocaleString() : 0}</th>
                <th>{selectedYearData ? selectedYearData.acres.toLocaleString() : 0}</th>
                <th>
                  {selectedYearData && selectedYearData.fires > 0 
                    ? Math.round(selectedYearData.acres / selectedYearData.fires).toLocaleString() 
                    : 'N/A'}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {/* Data Source Info - Updated to reflect new data through 2025 */}
      <div className="data-source-container">
        <h3 className="data-source-title">
          <svg xmlns="http://www.w3.org/2000/svg" className="data-source-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Data Source Information
        </h3>
        <div className="data-source-content">
          <p>
            This visualization shows detailed monthly data for the selected year from the California wildfire records.
            The dashboard includes data through 2025, with the monthly breakdown helping to identify fire patterns throughout the year and peak fire season.
          </p>
          <p className="data-source-note">
            Return to the "Dashboard Overview" tab to see trends across multiple years.
          </p>
        </div>
      </div>
      
      <div className="refresh-button-container">
        <button className="refresh-button" onClick={onRefresh}>
          <svg xmlns="http://www.w3.org/2000/svg" className="refresh-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Refresh Data
        </button>
      </div>
    </div>
  );
};