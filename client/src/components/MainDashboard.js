import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const MainDashboard = ({ summaryStats, yearlyData, onRefresh }) => {
  const recentYearsChartRef = useRef(null);
  const fireIntensityChartRef = useRef(null);
  const topYearsChartRef = useRef(null);
  
  // Format large numbers
  const formatLargeNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num;
  };
  
  // Get data for the overview chart (last 10 years)
  const getRecentYearsData = () => {
    if (!yearlyData || yearlyData.length === 0) return [];
    
    // Sort years in ascending order
    const sortedData = [...yearlyData].sort((a, b) => parseInt(a.year) - parseInt(b.year));
    
    // Take the last 10 years or all if less than 10
    return sortedData.slice(Math.max(0, sortedData.length - 10));
  };
  
  // Data for acres by fire ratio pie chart
  const getAcresByFireData = () => {
    // Calculate average acres per fire for the 5 worst years
    const sortedByAcres = [...yearlyData]
      .sort((a, b) => b.acres - a.acres)
      .slice(0, 5)
      .map(year => ({
        name: year.year,
        value: Math.round(year.acres / year.fires),
        acres: year.acres,
        fires: year.fires
      }));
    
    return sortedByAcres;
  };
  
  const createRecentYearsChart = () => {
    const data = getRecentYearsData();
    if (data.length === 0 || !recentYearsChartRef.current) return;
    
    const margin = { top: 40, right: 80, bottom: 60, left: 60 };
    const svgElement = recentYearsChartRef.current;
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
      .domain(data.map(d => d.year))
      .range([0, chartWidth])
      .padding(0.1);
    
    const yScaleLeft = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.fires) * 1.1])
      .range([chartHeight, 0]);
    
    const yScaleRight = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.acres) * 1.1])
      .range([chartHeight, 0]);
    
    // Create axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    svg.append('g')
      .call(d3.axisLeft(yScaleLeft).tickFormat(d => formatLargeNumber(d)));
    
    svg.append('g')
      .attr('transform', `translate(${chartWidth},0)`)
      .call(d3.axisRight(yScaleRight).tickFormat(d => formatLargeNumber(d)));
    
    // Add grid lines
    svg.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yScaleLeft.ticks())
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('y1', d => yScaleLeft(d))
      .attr('x2', chartWidth)
      .attr('y2', d => yScaleLeft(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-dasharray', '3,3');
    
    // Create line generators
    const lineGeneratorFires = d3.line()
      .x(d => xScale(d.year) + xScale.bandwidth() / 2)
      .y(d => yScaleLeft(d.fires));
    
    const lineGeneratorAcres = d3.line()
      .x(d => xScale(d.year) + xScale.bandwidth() / 2)
      .y(d => yScaleRight(d.acres));
    
    // Add the fire count line
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 3)
      .attr('d', lineGeneratorFires);
    
    // Add the acres burned line
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f97316')
      .attr('stroke-width', 3)
      .attr('d', lineGeneratorAcres);
    
    // Add dots for data points - Fires
    svg.selectAll('.dot-fires')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-fires')
      .attr('cx', d => xScale(d.year) + xScale.bandwidth() / 2)
      .attr('cy', d => yScaleLeft(d.fires))
      .attr('r', 5)
      .attr('fill', '#3b82f6');
    
    // Add dots for data points - Acres
    svg.selectAll('.dot-acres')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-acres')
      .attr('cx', d => xScale(d.year) + xScale.bandwidth() / 2)
      .attr('cy', d => yScaleRight(d.acres))
      .attr('r', 5)
      .attr('fill', '#f97316');
    
    // Add legend
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${chartWidth / 2 - 100}, -20)`);
    
    // Fire Count legend
    legend.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 5)
      .attr('fill', '#3b82f6');
    
    legend.append('text')
      .attr('x', 10)
      .attr('y', 5)
      .text('Fire Count')
      .style('font-size', '12px');
    
    // Acres Burned legend
    legend.append('circle')
      .attr('cx', 100)
      .attr('cy', 0)
      .attr('r', 5)
      .attr('fill', '#f97316');
    
    legend.append('text')
      .attr('x', 110)
      .attr('y', 5)
      .text('Acres Burned')
      .style('font-size', '12px');
    
    // Create tooltip
    const tooltip = d3.select('body')
      .selectAll('.tooltip')
      .data([null])
      .join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add event listeners for tooltips
    svg.selectAll('.dot-fires, .dot-acres')
      .on('mouseover', function(event, d) {
        const isFireDot = d3.select(this).classed('dot-fires');
        const value = isFireDot ? d.fires : d.acres;
        const label = isFireDot ? 'Fire Count' : 'Acres Burned';
        
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9);
        
        tooltip.html(`
          <strong>Year: ${d.year}</strong><br/>
          ${label}: ${isFireDot ? value : value.toLocaleString()}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });
  };
  
  const createFireIntensityChart = () => {
    const data = getAcresByFireData();
    if (data.length === 0 || !fireIntensityChartRef.current) return;
    
    // Clear any existing SVG
    d3.select(fireIntensityChartRef.current).selectAll('*').remove();
    
    const svgElement = fireIntensityChartRef.current;
    const width = svgElement.clientWidth || 500;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 40;
    
    // Create SVG
    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    // Colors for the pie chart
    const colors = ['#e03131', '#f08c00', '#2b8a3e', '#1971c2', '#5f3dc4'];
    
    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(data.map(d => d.name))
      .range(colors);
    
    // Compute the position of each group on the pie
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);
    
    const dataReady = pie(data);
    
    // Build the pie chart
    const arcGenerator = d3.arc()
      .innerRadius(0)
      .outerRadius(radius);
    
    // Add the arcs
    svg.selectAll('slices')
      .data(dataReady)
      .enter()
      .append('path')
      .attr('d', arcGenerator)
      .attr('fill', d => colorScale(d.data.name))
      .attr('stroke', 'white')
      .style('stroke-width', '2px')
      .style('opacity', 0.8);
    
    // Add labels
    const labelArc = d3.arc()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);
    
    svg.selectAll('labels')
      .data(dataReady)
      .enter()
      .append('text')
      .text(d => d.data.name)
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .style('text-anchor', 'middle')
      .style('font-size', 12)
      .style('font-weight', 'bold');
    
    // Add value labels
    const valueArc = d3.arc()
      .innerRadius(radius * 0.9)
      .outerRadius(radius * 0.9);
    
    svg.selectAll('values')
      .data(dataReady)
      .enter()
      .append('text')
      .text(d => `${d.data.value}`)
      .attr('transform', d => `translate(${valueArc.centroid(d)})`)
      .style('text-anchor', 'middle')
      .style('font-size', 10)
      .style('fill', '#555');
    
    // Create tooltip
    const tooltip = d3.select('body')
      .selectAll('.tooltip')
      .data([null])
      .join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add hover effects
    svg.selectAll('path')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 1);
        
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9);
        
        tooltip.html(`
          <strong>Year: ${d.data.name}</strong><br/>
          ${d.data.value.toLocaleString()} acres per fire<br/>
          Total Acres: ${d.data.acres.toLocaleString()}<br/>
          Total Fires: ${d.data.fires.toLocaleString()}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 0.8);
        
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });
  };
  
  const createTopYearsChart = () => {
    const data = getAcresByFireData();
    if (data.length === 0 || !topYearsChartRef.current) return;
    
    const margin = { top: 40, right: 30, bottom: 50, left: 60 };
    const svgElement = topYearsChartRef.current;
    const width = svgElement.clientWidth || 500;
    const height = 300;
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
    
    // Colors for the bars
    const colors = ['#e03131', '#f08c00', '#2b8a3e', '#1971c2', '#5f3dc4'];
    
    // Define scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, chartWidth])
      .padding(0.3);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.acres) * 1.1])
      .range([chartHeight, 0]);
    
    // Create axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
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
    
    // Add the bars
    svg.selectAll('bars')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.name))
      .attr('y', d => yScale(d.acres))
      .attr('width', xScale.bandwidth())
      .attr('height', d => chartHeight - yScale(d.acres))
      .attr('fill', (d, i) => colors[i])
      .attr('rx', 4)
      .attr('ry', 4);
    
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
          <strong>Year: ${d.name}</strong><br/>
          Acres Burned: ${d.acres.toLocaleString()}<br/>
          Fires: ${d.fires.toLocaleString()}<br/>
          Acres per Fire: ${d.value.toLocaleString()}
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
  
  const createCharts = () => {
    createRecentYearsChart();
    createFireIntensityChart();
    createTopYearsChart();
  };
  
  useEffect(() => {
    if (yearlyData.length > 0) {
      createCharts();
    }
  }, [yearlyData]);
  
  return (
    <div className="main-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">California Wildfire Dashboard</h2>
        <p className="dashboard-description">
          Overview of California wildfire data with focus on recent trends and key metrics
        </p>
      </div>
      
      {/* Key Statistics Cards */}
      <div className="key-stats-container">
        <div className="key-stat-grid">
          <div className="key-stat-card primary">
            <div className="key-stat-title">Most Recent Year ({summaryStats.recentYear})</div>
            <div className="key-stat-value-container">
              <div className="key-stat-value-group">
                <div className="key-stat-value">{summaryStats.recentYearFires.toLocaleString()}</div>
                <div className="key-stat-label">Fires</div>
              </div>
              <div className="key-stat-value-group">
                <div className="key-stat-value">{summaryStats.recentYearAcres.toLocaleString()}</div>
                <div className="key-stat-label">Acres Burned</div>
              </div>
            </div>
          </div>
          
          <div className="key-stat-card danger">
            <div className="key-stat-title">Worst Fire Year ({summaryStats.worstYear})</div>
            <div className="key-stat-value">{summaryStats.worstYearAcres.toLocaleString()}</div>
            <div className="key-stat-label">Acres Burned</div>
          </div>
          
          <div className="key-stat-card warning">
            <div className="key-stat-title">Historical Totals</div>
            <div className="key-stat-value-container">
              <div className="key-stat-value-group">
                <div className="key-stat-value">{summaryStats.totalFires.toLocaleString()}</div>
                <div className="key-stat-label">Total Fires</div>
              </div>
              <div className="key-stat-value-group">
                <div className="key-stat-value">{summaryStats.totalAcres.toLocaleString()}</div>
                <div className="key-stat-label">Total Acres</div>
              </div>
            </div>
          </div>
          
          <div className="key-stat-card info">
            <div className="key-stat-title">Annual Averages</div>
            <div className="key-stat-value-container">
              <div className="key-stat-value-group">
                <div className="key-stat-value">{summaryStats.avgAnnualFires.toLocaleString()}</div>
                <div className="key-stat-label">Fires per Year</div>
              </div>
              <div className="key-stat-value-group">
                <div className="key-stat-value">{summaryStats.avgAnnualAcres.toLocaleString()}</div>
                <div className="key-stat-label">Acres per Year</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Years Chart */}
      <div className="chart-section">
        <div className="chart-container">
          <h3 className="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            Fire Trends: Recent 10 Years
          </h3>
          <div className="chart-description">
            Shows the number of fires and acres burned in recent years, highlighting the increasing trend.
          </div>
          <div className="chart-canvas">
            <svg ref={recentYearsChartRef} width="100%" height="400"></svg>
          </div>
        </div>
      </div>
      
      {/* Two-column charts section */}
      <div className="two-column-chart-section">
        <div className="chart-container half-width">
          <h3 className="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
            Fire Intensity (Acres per Fire)
          </h3>
          <div className="chart-description">
            Comparison of acres burned per fire for the worst 5 years, indicating fire severity.
          </div>
          <div className="chart-canvas">
            <svg ref={fireIntensityChartRef} width="100%" height="300"></svg>
          </div>
        </div>
        
        <div className="chart-container half-width">
          <h3 className="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Top 5 Years by Acres Burned
          </h3>
          <div className="chart-description">
            The five years with the most acres burned, showing extreme fire seasons.
          </div>
          <div className="chart-canvas">
            <svg ref={topYearsChartRef} width="100%" height="300"></svg>
          </div>
        </div>
      </div>
      
      {/* Data Source Info */}
      <div className="data-source-container">
        <h3 className="data-source-title">
          <svg xmlns="http://www.w3.org/2000/svg" className="data-source-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Data Source Information
        </h3>
        <div className="data-source-content">
          <p>
            This visualization uses data from the firep23_1.geojson file, which contains California wildfire records.
            The dashboard presents an overview with focus on recent trends, key statistics, and most notable fire years.
          </p>
          <p className="data-source-note">
            Switch to the "Yearly Analysis" tab to explore data for specific years and view monthly breakdowns.
          </p>
        </div>
      </div>
      
      <div className="refresh-button-container">
        <button id="refresh-button" className="refresh-button" onClick={onRefresh}>
          <svg xmlns="http://www.w3.org/2000/svg" className="refresh-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Refresh Data
        </button>
      </div>
    </div>
  );
};