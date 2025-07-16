import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';

export const MonthlyTemperatureBoxplot = () => {
  const containerRef = useRef(null);
  const [, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Set up the SVG dimensions
    const margin = { top: 50, right: 30, bottom: 100, left: 60 };
    const width = containerRef.current.clientWidth || 800;
    const height = 500;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Remove any existing SVG and tooltip
    d3.select(containerRef.current).selectAll('svg').remove();
    d3.select('body').selectAll('.temperature-tooltip').remove();
    
    // Create the SVG container
    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .text("Temperature vs Month Boxplot");
      
    // Add loading indicator
    const loadingText = svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .text("Loading temperature data...");
    
    // Create tooltip - create it in the body to avoid nesting issues
    // Give it a specific class name so we can find it later for cleanup
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'temperature-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border', '1px solid #333')
      .style('border-radius', '5px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 10000);  // Very high z-index to ensure it's on top
    
    // Fetch monthly temperature statistics
    fetch('http://localhost:8000/api/temperature/monthly-stats')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch monthly temperature data');
        }
        return response.json();
      })
      .then(monthlyStats => {
        // Remove loading indicator
        loadingText.remove();
        setLoading(false);
        
        // Prepare data for boxplot
        const months = monthlyStats.map(stat => stat.month);
        
        // Create X scale for months
        const xScale = d3.scaleBand()
          .domain(months)
          .range([0, chartWidth])
          .padding(0.4);
        
        // Create Y scale for temperature
        const yScale = d3.scaleLinear()
          .domain([
            d3.min(monthlyStats, stat => stat.min) * 0.95, // 5% padding below min
            d3.max(monthlyStats, stat => stat.max) * 1.05  // 5% padding above max
          ])
          .range([chartHeight, 0]);
        
        // Add X axis
        svg.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(xScale))
          .selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '.15em')
          .style('font-size', '12px');
        
        // Add Y axis
        svg.append('g')
          .call(d3.axisLeft(yScale))
          .selectAll('text')
          .style('font-size', '12px');
        
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
        
        // Add X axis label
        svg.append('text')
          .attr('x', chartWidth / 2)
          .attr('y', chartHeight + 70)
          .attr('text-anchor', 'middle')
          .style('font-size', '14px')
          .text('Month');
        
        // Add Y axis label
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -45)
          .attr('x', -chartHeight / 2)
          .attr('text-anchor', 'middle')
          .style('font-size', '14px')
          .text('Temperature (°F)');
        
        // Process and visualize data for each month
        monthlyStats.forEach((monthData) => {
          const monthX = xScale(monthData.month) + xScale.bandwidth() / 2;
          
          // Draw box
          const boxWidth = xScale.bandwidth() * 0.7;
          
          // Box background (IQR)
          svg.append('rect')
            .attr('x', monthX - boxWidth / 2)
            .attr('y', yScale(monthData.q3))
            .attr('height', yScale(monthData.q1) - yScale(monthData.q3))
            .attr('width', boxWidth)
            .attr('stroke', '#aaa')
            .attr('fill', '#f0f0f0')
            .attr('opacity', 0.8);
          
          // Add horizontal line for median
          svg.append('line')
            .attr('x1', monthX - boxWidth / 2)
            .attr('x2', monthX + boxWidth / 2)
            .attr('y1', yScale(monthData.median))
            .attr('y2', yScale(monthData.median))
            .attr('stroke', '#666')
            .attr('stroke-width', 2);
          
          // Min to Max vertical line
          svg.append('line')
            .attr('x1', monthX)
            .attr('x2', monthX)
            .attr('y1', yScale(monthData.min))
            .attr('y2', yScale(monthData.max))
            .attr('stroke', '#555')
            .attr('stroke-width', 1);
          
          // Top whisker line
          svg.append('line')
            .attr('x1', monthX - boxWidth / 3)
            .attr('x2', monthX + boxWidth / 3)
            .attr('y1', yScale(monthData.max))
            .attr('y2', yScale(monthData.max))
            .attr('stroke', '#555')
            .attr('stroke-width', 1);
          
          // Bottom whisker line
          svg.append('line')
            .attr('x1', monthX - boxWidth / 3)
            .attr('x2', monthX + boxWidth / 3)
            .attr('y1', yScale(monthData.min))
            .attr('y2', yScale(monthData.min))
            .attr('stroke', '#555')
            .attr('stroke-width', 1);
          
          // CHANGE 1: Fetch temperature data points with year information
          fetch(`http://localhost:8000/api/temperature/points/${monthData.month.toLowerCase()}`)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to fetch temperature data points for ${monthData.month}`);
              }
              return response.json();
            })
            .then(temperaturePoints => {
              // CHANGE 2: Add jittered points for data visualization
              svg.selectAll(`.temp-points-${monthData.month.toLowerCase()}`)
                .data(temperaturePoints)
                .enter()
                .append('circle')
                // CHANGE 3: Add horizontal jittering to spread points out
                .attr('cx', () => monthX + (Math.random() - 0.5) * boxWidth * 0.6)
                .attr('cy', d => yScale(d.temperature))
                .attr('r', 3)
                .attr('fill', '#4682B4')
                .attr('opacity', 0.7)
                .attr('stroke', '#2d6ca0')
                .attr('stroke-width', 0.5)
                .on('mouseover', function(event, d) {
                  // Highlight the point
                  d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', 5)
                    .attr('opacity', 1);
                  
                  // CHANGE 4: Show the tooltip with year information
                  tooltip
                    .transition()
                    .duration(200)
                    .style('opacity', 0.9);
                  
                  tooltip.html(`
                    <strong>${monthData.month} ${d.year}</strong><br>
                    Temperature: ${d.temperature.toFixed(2)}°F<br>
                    Min: ${monthData.min.toFixed(2)}°F<br>
                    Max: ${monthData.max.toFixed(2)}°F<br>
                    Median: ${monthData.median.toFixed(2)}°F
                  `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function() {
                  // Return the point to original size
                  d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', 3)
                    .attr('opacity', 0.7);
                  
                  // Hide the tooltip
                  tooltip
                    .transition()
                    .duration(500)
                    .style('opacity', 0);
                })
                .on('mousemove', function(event) {
                  // Update tooltip position as mouse moves
                  tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
                });
            })
            .catch(error => {
              console.error(`Error fetching points for ${monthData.month}:`, error);
            });
        });
      })
      .catch(error => {
        loadingText.remove();
        setError("Failed to load temperature data: " + error.message);
        setLoading(false);
        
        // Display error message in the chart area
        svg.append("text")
          .attr("x", chartWidth / 2)
          .attr("y", chartHeight / 2)
          .attr("text-anchor", "middle")
          .style("font-size", "14px")
          .style("fill", "red")
          .text("Error loading temperature data");
        
        console.error('Error creating monthly temperature boxplot:', error);
      });
      
    // Cleanup function
    return () => {
      // Remove tooltip when component unmounts
      d3.select('body').selectAll('.temperature-tooltip').remove();
    };
  }, []);
  
  return (
    <div className="chart-container">
      <h3 className="section-title">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.168 1.168a4 4 0 01-8.214 0l1.168-1.168A3 3 0 009 8.172z" clipRule="evenodd" />
        </svg>
        Monthly Temperature Distribution
      </h3>
      <div className="chart-description">
        A detailed visualization showing temperature variations across different months, 
        with individual temperature points, quartile markers, and min-max ranges.
        {/* CHANGE 5: Update description */}
        Hover over points to see the specific year and temperature value.
      </div>
      {error && (
        <div style={{ 
          color: "red", 
          padding: "10px", 
          margin: "10px 0", 
          backgroundColor: "#fff1f1", 
          borderRadius: "4px",
          border: "1px solid #ffa0a0"
        }}>
          {error}
        </div>
      )}
      <div 
        ref={containerRef} 
        className="chart-canvas" 
        style={{ 
          width: "100%", 
          height: "500px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fafafa",
          border: "1px solid #eaeaea",
          borderRadius: "4px"
        }}
      ></div>
      <div className="chart-notes" style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
        <strong>Note:</strong> Boxplots show the distribution of temperatures for each month. The box represents the 
        interquartile range (IQR) with the middle line showing the median temperature. Whiskers extend to the min and max values.
        {/* CHANGE 6: Update notes */}
        Individual points represent actual temperature readings. Hover over a point to view the specific year and temperature.
      </div>
    </div>
  );
};

export default MonthlyTemperatureBoxplot;