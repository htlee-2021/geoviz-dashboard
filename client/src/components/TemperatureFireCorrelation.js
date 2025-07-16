import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const TemperatureFireCorrelation = ({ onRefresh }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [correlationValue, setCorrelationValue] = useState(null);
  
  const scatterplotRef = useRef(null);
  const heatmapRef = useRef(null);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get data from the server API
      const response = await fetch('http://localhost:8000/api/temperature-fire');
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Temperature-fire correlation data not found. Please run the temperature-fire-processor.js script on the server first.");
        } else {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        setLoading(false);
        return;
      }
      
      const responseData = await response.json();
      
      // Check if we have valid data
      if (responseData && responseData.scatterplotData && responseData.scatterplotData.length > 0) {
        // Set the data for visualization
        setData(responseData.scatterplotData);
        
        // Set correlation value
        if (responseData.correlations && responseData.correlations.temperatureToFires) {
          setCorrelationValue(responseData.correlations.temperatureToFires.value);
        }
        
        setLoading(false);
      } else {
        setError("No valid temperature and fire count data found in the server response");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading data from server:", error);
      setError("Failed to load temperature and fire count data. Please check your server connection.");
      setLoading(false);
    }
  };

  
  useEffect(() => {
    if (data.length > 0) {
      createScatterplot();
      createHeatmap();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  
  const createScatterplot = () => {
    if (!scatterplotRef.current) return;
    
    // Clear previous chart
    d3.select(scatterplotRef.current).selectAll("*").remove();
    
    // Set dimensions and margins
    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const width = scatterplotRef.current.clientWidth || 600;
    const height = 400;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(scatterplotRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Add background grid
    svg.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(d3.range(0, chartWidth, 50))
      .enter()
      .append("line")
      .attr("x1", d => d)
      .attr("y1", 0)
      .attr("x2", d => d)
      .attr("y2", chartHeight)
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "3,3");
    
    svg.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(d3.range(0, chartHeight, 50))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("y1", d => d)
      .attr("x2", chartWidth)
      .attr("y2", d => d)
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "3,3");
    
    // Calculate domains for scales
    const xExtent = d3.extent(data, d => d.tempValue);
    const yExtent = d3.extent(data, d => d.fireCount);
    
    // Add some padding to the domains
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
    
    // Create scales
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, chartWidth]);
    
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([chartHeight, 0]);
    
    // Create and add axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
    
    svg.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis);
    
    svg.append("g")
      .call(yAxis);
    
    // Add regression line if we have enough data points
    if (data.length > 2) {
      // Calculate regression line
      const xSeries = data.map(d => d.tempValue);
      const ySeries = data.map(d => d.fireCount);
      
      const xMean = d3.mean(xSeries);
      const yMean = d3.mean(ySeries);
      
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < data.length; i++) {
        numerator += (xSeries[i] - xMean) * (ySeries[i] - yMean);
        denominator += Math.pow(xSeries[i] - xMean, 2);
      }
      
      const slope = numerator / denominator;
      const intercept = yMean - slope * xMean;
      
      // Function to calculate y-value for regression line
      const regressionLine = x => slope * x + intercept;
      
      // Draw regression line
      svg.append("line")
        .attr("x1", xScale(xExtent[0] - xPadding))
        .attr("y1", yScale(regressionLine(xExtent[0] - xPadding)))
        .attr("x2", xScale(xExtent[1] + xPadding))
        .attr("y2", yScale(regressionLine(xExtent[1] + xPadding)))
        .attr("stroke", "#f43f5e")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");
    }
    
    // Create a color scale for points based on year
    const yearExtent = d3.extent(data, d => d.year);
    const colorScale = d3.scaleSequential()
      .domain(yearExtent)
      .interpolator(d3.interpolateViridis);
    
    // Add data points
    svg.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.tempValue))
      .attr("cy", d => yScale(d.fireCount))
      .attr("r", 5)
      .attr("fill", d => colorScale(d.year))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("opacity", 0.7);
    
    // Add tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000);
    
    // Add tooltip behavior
    svg.selectAll("circle")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 8)
          .attr("opacity", 1);
        
        tooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        
        tooltip.html(`
          <strong>Year: ${d.year}</strong><br>
          Temperature: ${d.tempValue.toFixed(2)}<br>
          Fire Count: ${d.fireCount.toFixed(2)}
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 5)
          .attr("opacity", 0.7);
        
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });
    
    // Add axis labels
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#4b5563")
      .text("Temperature (Normalized)");
    
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#4b5563")
      .text("Count of Fires (Normalized)");
    
    // Add title
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Temperature vs. Fire Count Correlation");
  };
  
  const createHeatmap = () => {
    if (!heatmapRef.current || data.length < 5) return;
    
    // Clear previous chart
    d3.select(heatmapRef.current).selectAll("*").remove();
    
    // Get min and max values - use the same ranges as the scatterplot for consistency
    const xExtent = d3.extent(data, d => d.tempValue);
    const yExtent = d3.extent(data, d => d.fireCount);
    
    const tempMin = xExtent[0];
    const tempMax = xExtent[1];
    const fireMin = yExtent[0];
    const fireMax = yExtent[1];
    
    // Add some padding to the domains, matching the scatterplot
    const xPadding = (tempMax - tempMin) * 0.1;
    const yPadding = (fireMax - fireMin) * 0.1;
    
    // Create bins for temperature and fire counts
    const tempBinCount = 10;
    const fireBinCount = 10;
    
    const tempStep = ((tempMax + xPadding) - (tempMin - xPadding)) / tempBinCount;
    const fireStep = ((fireMax + yPadding) - (fireMin - yPadding)) / fireBinCount;
    
    // Create bin ranges
    const tempBins = Array.from({ length: tempBinCount }, (_, i) => ({
      min: (tempMin - xPadding) + i * tempStep,
      max: (tempMin - xPadding) + (i + 1) * tempStep
    }));
    
    const fireBins = Array.from({ length: fireBinCount }, (_, i) => ({
      min: (fireMin - yPadding) + i * fireStep,
      max: (fireMin - yPadding) + (i + 1) * fireStep
    }));
    
    console.log("Bins created:", { tempBins, fireBins });
    
    // Create heatmap data with proper indexing
    const heatmapData = [];
    
    for (let i = 0; i < tempBinCount; i++) {
      for (let j = 0; j < fireBinCount; j++) {
        // Find all data points in this bin
        const pointsInBin = data.filter(d => 
          d.tempValue >= tempBins[i].min && 
          d.tempValue < tempBins[i].max && 
          d.fireCount >= fireBins[j].min && 
          d.fireCount < fireBins[j].max
        );
        
        const count = pointsInBin.length;
        
        // Add as a data point with y-index inverted to match scatterplot orientation
        heatmapData.push({
          tempIndex: i,
          fireIndex: fireBinCount - 1 - j, // Invert to match scatterplot orientation
          count: count,
          tempMin: tempBins[i].min.toFixed(2),
          tempMax: tempBins[i].max.toFixed(2),
          fireMin: fireBins[j].min.toFixed(2),
          fireMax: fireBins[j].max.toFixed(2),
          points: pointsInBin
        });
        
        if (count > 0) {
          console.log(`Bin [${i},${j}]: temp=${tempBins[i].min.toFixed(2)}-${tempBins[i].max.toFixed(2)}, fire=${fireBins[j].min.toFixed(2)}-${fireBins[j].max.toFixed(2)}, count=${count}`);
        }
      }
    }
    
    // Set dimensions and margins
    const margin = { top: 40, right: 30, bottom: 80, left: 60 };
    const width = heatmapRef.current.clientWidth || 500;
    const height = 400;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Cell size
    const cellWidth = chartWidth / tempBinCount;
    const cellHeight = chartHeight / fireBinCount;
    
    // Create SVG
    const svg = d3.select(heatmapRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Color scale - use a sequential scale that shows intensity well
    const maxCount = d3.max(heatmapData, d => d.count) || 1;
    const colorScale = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateYlOrRd);
    
    // Create heatmap cells
    svg.selectAll("rect")
      .data(heatmapData)
      .enter()
      .append("rect")
      .attr("x", d => d.tempIndex * cellWidth)
      .attr("y", d => d.fireIndex * cellHeight)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", d => d.count > 0 ? colorScale(d.count) : "#f9fafb")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .append("title")
      .text(d => `Temp: ${d.tempMin}-${d.tempMax}\nFires: ${d.fireMin}-${d.fireMax}\nCount: ${d.count}`);
    
    // Add text for counts
    svg.selectAll("text.cell-text")
      .data(heatmapData.filter(d => d.count > 0))
      .enter()
      .append("text")
      .attr("class", "cell-text")
      .attr("x", d => d.tempIndex * cellWidth + cellWidth / 2)
      .attr("y", d => d.fireIndex * cellHeight + cellHeight / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("fill", d => d.count > maxCount / 2 ? "#fff" : "#000")
      .attr("font-size", "10px")
      .text(d => d.count);
    
    // Add diagonal correlation line to match the regression line in scatterplot
    if (data.length > 2) {
      // Get the same regression line parameters as used in scatterplot
      const xSeries = data.map(d => d.tempValue);
      const ySeries = data.map(d => d.fireCount);
      
      const xMean = d3.mean(xSeries);
      const yMean = d3.mean(ySeries);
      
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < data.length; i++) {
        numerator += (xSeries[i] - xMean) * (ySeries[i] - yMean);
        denominator += Math.pow(xSeries[i] - xMean, 2);
      }
      
      const slope = numerator / denominator;
      const intercept = yMean - slope * xMean;
      
      // Function to calculate y-value for regression line
      const regressionLine = x => slope * x + intercept;
      
      // Convert the regression line to heatmap coordinates
      const heatmapX1 = 0;
      const heatmapY1 = chartHeight - (chartHeight * (regressionLine(tempMin - xPadding) - (fireMin - yPadding)) / ((fireMax + yPadding) - (fireMin - yPadding)));
      const heatmapX2 = chartWidth;
      const heatmapY2 = chartHeight - (chartHeight * (regressionLine(tempMax + xPadding) - (fireMin - yPadding)) / ((fireMax + yPadding) - (fireMin - yPadding)));
      
      // Draw regression line
      svg.append("line")
        .attr("x1", heatmapX1)
        .attr("y1", heatmapY1)
        .attr("x2", heatmapX2)
        .attr("y2", heatmapY2)
        .attr("stroke", "#f43f5e")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");
    }
    
    // Create axes with correct labeling
    // For x-axis (temperature), create labels at specific points for clarity
    const tempTickValues = [];
    for (let i = 0; i <= tempBinCount; i += 2) {
      const value = (tempMin - xPadding) + (i * tempStep);
      tempTickValues.push({
        value: i,
        label: value.toFixed(1)
      });
    }
    
    // For y-axis (fire count), create labels at specific points
    const fireTickValues = [];
    for (let i = 0; i <= fireBinCount; i += 2) {
      const value = (fireMin - yPadding) + (i * fireStep);
      fireTickValues.push({
        value: fireBinCount - i, // Invert to match the visual layout
        label: value.toFixed(1)
      });
    }
    
    // Create scale bands for the axes
    const xScale = d3.scaleBand()
      .domain(d3.range(tempBinCount + 1))
      .range([0, chartWidth]);
    
    const yScale = d3.scaleBand()
      .domain(d3.range(fireBinCount + 1).reverse()) // Reverse domain for correct orientation
      .range([0, chartHeight]);
    
    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(tempTickValues.map(t => t.value))
      .tickFormat((d, i) => {
        const tick = tempTickValues.find(t => t.value === d);
        return tick ? tick.label : '';
      });
    
    const yAxis = d3.axisLeft(yScale)
      .tickValues(fireTickValues.map(t => t.value))
      .tickFormat((d, i) => {
        const tick = fireTickValues.find(t => t.value === d);
        return tick ? tick.label : '';
      });
    
    svg.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em");
    
    svg.append("g")
      .call(yAxis);
    
    // Add axis labels
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 60)
      .attr("text-anchor", "middle")
      .attr("fill", "#4b5563")
      .text("Temperature (Normalized)");
    
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#4b5563")
      .text("Count of Fires (Normalized)");
    
    // Add title
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Temperature vs. Fire Count Correlation");
      
  };
  
  // Calculate the correlation interpretation
  const getCorrelationInterpretation = (correlation) => {
    const absCorrelation = Math.abs(correlation);
    if (absCorrelation >= 0.8) return "Very strong";
    if (absCorrelation >= 0.6) return "Strong";
    if (absCorrelation >= 0.4) return "Moderate";
    if (absCorrelation >= 0.2) return "Weak";
    return "Very weak or no correlation";
  };
  
  // Get correlation color based on strength
  const getCorrelationColor = (correlation) => {
    const absCorrelation = Math.abs(correlation);
    if (absCorrelation >= 0.8) return "#dc2626"; // Strong red
    if (absCorrelation >= 0.6) return "#ea580c"; // Orange
    if (absCorrelation >= 0.4) return "#eab308"; // Yellow
    if (absCorrelation >= 0.2) return "#84cc16"; // Light green
    return "#22c55e"; // Green
  };
  
  return (
    <div className="temp-fire-correlation-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Temperature-Fire Correlation Analysis</h2>
        <p className="dashboard-description">
          Analysis of the relationship between normalized temperature values and wildfire counts
        </p>
      </div>
      
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <div className="loading-text">Loading data...</div>
          </div>
        </div>
      ) : error ? (
        <div className="error-message">
          <div className="flex">
            <div className="ml-3">
              <h3 className="error-title">Data Loading Error</h3>
              <div className="error-details">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="key-stats-container">
            <div className="key-stat-grid">
              <div className="key-stat-card primary">
                <div className="key-stat-title">Correlation Coefficient</div>
                <div className="key-stat-value" style={{ color: getCorrelationColor(correlationValue) }}>
                  {correlationValue !== null ? correlationValue.toFixed(3) : "N/A"}
                </div>
                <div className="key-stat-label">
                  {correlationValue !== null 
                    ? `${getCorrelationInterpretation(correlationValue)} ${correlationValue > 0 ? "positive" : "negative"} correlation` 
                    : "Not enough data"}
                </div>
              </div>
              
              <div className="key-stat-card info">
                <div className="key-stat-title">Data Points</div>
                <div className="key-stat-value">{data.length}</div>
                <div className="key-stat-label">Years of data analyzed</div>
              </div>
              
              <div className="key-stat-card danger">
                <div className="key-stat-title">Temperature Range</div>
                <div className="key-stat-value">
                  {data.length > 0 
                    ? `${d3.min(data, d => d.tempValue).toFixed(2)} to ${d3.max(data, d => d.tempValue).toFixed(2)}` 
                    : "N/A"}
                </div>
                <div className="key-stat-label">Normalized scale</div>
              </div>
              
              <div className="key-stat-card warning">
                <div className="key-stat-title">Fire Count Range</div>
                <div className="key-stat-value">
                  {data.length > 0 
                    ? `${d3.min(data, d => d.fireCount).toFixed(2)} to ${d3.max(data, d => d.fireCount).toFixed(2)}` 
                    : "N/A"}
                </div>
                <div className="key-stat-label">Normalized scale</div>
              </div>
            </div>
          </div>
          
          <div className="two-column-chart-section">
            <div className="chart-container half-width">
              <h3 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
                Temperature vs. Fire Count Scatterplot
              </h3>
              <div className="chart-description">
                Each point represents a year, showing the relationship between normalized temperature and fire counts.
                {correlationValue !== null && (
                  <span> The dashed line shows the trend with a correlation of {correlationValue.toFixed(3)}.</span>
                )}
              </div>
              <div className="chart-canvas">
                <svg ref={scatterplotRef} width="100%" height="400"></svg>
              </div>
            </div>
            
            <div className="chart-container half-width">
              <h3 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
                </svg>
                Temperature-Fire Distribution Heatmap
              </h3>
              <div className="chart-description">
                Shows the frequency distribution of data points across temperature and fire count ranges.
                Darker colors indicate more years with that combination.
              </div>
              <div className="chart-canvas">
                <svg ref={heatmapRef} width="100%" height="400"></svg>
              </div>
            </div>
          </div>
          
          <div className="data-source-container">
            <h3 className="data-source-title">
              <svg xmlns="http://www.w3.org/2000/svg" className="data-source-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Interpretation Guide
            </h3>
            <div className="data-source-content">
              <p>
                This dashboard visualizes the relationship between normalized temperature values and wildfire counts.
                The scatterplot shows each data point (year) with temperature on the x-axis and fire count on the y-axis.
                The Pearson correlation coefficient quantifies the strength and direction of this relationship:
              </p>
              <ul style={{ marginLeft: "20px", listStyleType: "disc" }}>
                <li>Values close to +1 indicate a strong positive correlation (as temperature increases, fire count increases)</li>
                <li>Values close to -1 indicate a strong negative correlation (as temperature increases, fire count decreases)</li>
                <li>Values close to 0 indicate little to no correlation between the variables</li>
              </ul>
              <p className="data-source-note">
                Note: Correlation does not necessarily imply causation. Other factors may influence wildfire occurrence.
              </p>
            </div>
          </div>
        </>
      )}
      
      <div className="refresh-button-container">
        <button className="refresh-button" onClick={fetchData}>
          <svg xmlns="http://www.w3.org/2000/svg" className="refresh-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Update Temperature-Fire Data
        </button>
      </div>
    </div>
  );
};