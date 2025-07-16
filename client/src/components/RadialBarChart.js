import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const RadialBarChart = ({ 
  yearlyData, 
  monthlyDataByYear,
  availableYears,
  selectedMetric = 'fires' // 'fires' or 'acres'
}) => {
  const radialChartRef = useRef(null);
  const [focusYears, setFocusYears] = useState(5); // Default to showing 5 years
  
  useEffect(() => {
    if (monthlyDataByYear && Object.keys(monthlyDataByYear).length > 0) {
      createRadialBarChart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyDataByYear, selectedMetric, availableYears, focusYears]);
  
  const formatLargeNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num;
  };
  
  const createRadialBarChart = () => {
    if (!radialChartRef.current) return;
    
    // Clear previous chart
    d3.select(radialChartRef.current).selectAll("*").remove();
    
    // Prepare data for the radial chart
    const processedData = [];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Get the most recent years based on focus selection
    const sortedYears = [...availableYears].sort((a, b) => b - a);
    const yearsToShow = sortedYears.slice(0, focusYears);
    
    // Create data structure for the radial chart
    yearsToShow.forEach(year => {
      if (monthlyDataByYear[year]) {
        months.forEach((month, i) => {
          const monthData = monthlyDataByYear[year].find(m => m.month === month);
          if (monthData) {
            processedData.push({
              year: year,
              month: month,
              monthIndex: i,
              value: selectedMetric === 'fires' ? monthData.fires : monthData.acres
            });
          } else {
            // Add empty data point if month data is missing
            processedData.push({
              year: year,
              month: month,
              monthIndex: i,
              value: 0
            });
          }
        });
      }
    });
    
    // Set dimensions and margins
    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const width = radialChartRef.current.clientWidth || 600;
    const height = width; // Make it square for better radial visualization
    const innerRadius = 80;
    const outerRadius = Math.min(width, height) / 2 - margin.top;
    
    // Create SVG
    const svg = d3.select(radialChartRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);
    
    // Define scales
    // Angle scale for months
    const angleScale = d3.scaleLinear()
      .domain([0, 12])
      .range([0, 2 * Math.PI]);
    
    // Radius scale for values
    const maxValue = d3.max(processedData, d => d.value);
    const radiusScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([innerRadius, outerRadius]);
    
    // Year scale for color - use a more visually distinguishable color scheme
    const colorScale = d3.scaleOrdinal()
      .domain(yearsToShow)
      .range([
        '#3b82f6', // blue
        '#ef4444', // red
        '#f59e0b', // amber
        '#10b981', // emerald
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#6366f1', // indigo
        '#14b8a6', // teal
        '#f97316', // orange
        '#84cc16'  // lime
      ]);
    
    // Create month axis (circles and labels)
    const axisCircles = svg.append("g")
      .attr("class", "axis-circles");
    
    // Add concentric circles for value scale
    axisCircles.selectAll("circle")
      .data(d3.range(1, 6)) // Create 5 concentric circles
      .enter()
      .append("circle")
      .attr("r", d => innerRadius + (d * (outerRadius - innerRadius) / 5))
      .attr("fill", "none")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "2,2")
      .attr("stroke-width", 0.5);
    
    // Add value labels to circles
    axisCircles.selectAll(".radius-label")
      .data(d3.range(1, 6))
      .enter()
      .append("text")
      .attr("class", "radius-label")
      .attr("y", d => -(innerRadius + (d * (outerRadius - innerRadius) / 5)))
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#6b7280")
      .text(d => {
        const value = maxValue * (d / 5);
        return formatLargeNumber(Math.round(value));
      });
    
    // Add month segments and labels
    const monthSegments = svg.append("g")
      .attr("class", "month-segments");
    
    // Add axis lines for months
    monthSegments.selectAll("line")
      .data(months)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => Math.cos(angleScale(i)) * outerRadius)
      .attr("y2", (d, i) => Math.sin(angleScale(i)) * outerRadius)
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 0.5);
    
    // Add month labels - position slightly beyond the outer radius
    svg.selectAll(".month-label")
      .data(months)
      .enter()
      .append("text")
      .attr("class", "month-label")
      .attr("x", (d, i) => Math.cos(angleScale(i-3)) * (outerRadius + 20))
      .attr("y", (d, i) => Math.sin(angleScale(i-3)) * (outerRadius + 20))
      .attr("dy", "0.35em")
      .attr("text-anchor", (d, i) => {
        const angle = angleScale(i) % (2 * Math.PI);
        if (Math.abs(angle - Math.PI/2) < 0.1 || Math.abs(angle - Math.PI*3/2) < 0.1) return "middle";
        return (angle > Math.PI/2 && angle < Math.PI*3/2) ? "end" : "start";
      })
      .attr("font-size", "12px")
      .attr("font-weight", (d) => {
        // Highlight summer months to align with the yearly dashboard emphasis
        return (d === 'June' || d === 'July' || d === 'August' || d === 'September') ? "bold" : "normal";
      })
      .attr("fill", (d) => {
        // Highlight summer months with different color
        return (d === 'June' || d === 'July' || d === 'August' || d === 'September') ? "#d97706" : "#4b5563";
      })
      .text(d => d.substring(0, 3)); // Just show first 3 letters
    
    // Highlight summer months with subtle background
    const summerAngleStart = angleScale(4);  // June (index 5)
    const summerAngleEnd = angleScale(8); // September (index 8)
    
    const summerArc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(summerAngleStart)
      .endAngle(summerAngleEnd);
    
    svg.append("path")
      .attr("d", summerArc)
      .attr("fill", "#fef3c7") // Very light amber
      .attr("stroke", "#f59e0b") // Amber border
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("fill-opacity", 0.2);
    
    
    
    // Group data by year
    const dataByYear = d3.group(processedData, d => d.year);
    
    // Calculate bar width in radians - how wide each month segment will be
    const barWidth = (2 * Math.PI) / 12 * 0.8; // 80% of the month segment
    
    // Calculate bar spacing between years (within each month segment)
    const yearBarWidth = barWidth / yearsToShow.length;
    
    // Create radial bars - we'll use arcs to create bars
    const barsGroup = svg.append("g")
      .attr("class", "radial-bars");
    
    // For each year and month, create a radial bar
    yearsToShow.forEach((year, yearIndex) => {
      const yearData = dataByYear.get(year) || [];
      
      // Create bars for this year's data
      yearData.forEach(d => {
        if (d.value > 0) { // Only draw if there's a value
          // Calculate the starting angle for this month's segment
          const monthAngle = angleScale(d.monthIndex);
          
          // Each year's bar will be positioned within the month's segment
          // yearIndex determines the position within the segment
          const barStartAngle = monthAngle - (barWidth / 2) + (yearIndex * yearBarWidth);
          const barEndAngle = barStartAngle + yearBarWidth;
          
          // Create a custom arc for this bar
          const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(radiusScale(d.value))
            .startAngle(barStartAngle)
            .endAngle(barEndAngle);
          
          // Add the bar
          barsGroup.append("path")
            .attr("d", arc)
            .attr("fill", colorScale(year))
            .attr("stroke", "white")
            .attr("stroke-width", 0.5)
            .attr("opacity", 0.8)
            .on("mouseover", function(event) {
              // Highlight the bar on hover
              d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 1);
              
              // Show tooltip
              tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
              
              tooltip.html(`
                <strong>${d.month} ${d.year}</strong><br/>
                ${selectedMetric === 'fires' ? 'Fires' : 'Acres Burned'}: ${d.value.toLocaleString()}
              `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
              // Return to normal opacity
              d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 0.8);
              
              // Hide tooltip
              tooltip.transition()
                .duration(500)
                .style("opacity", 0);
            });
        }
      });
    });
    
    // Add central label
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(selectedMetric === 'fires' ? "Fire Count" : "Acres Burned");
    
    // Create legend with year labels
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${-width/2 + 20}, ${-height/2 + 20})`);
    
    // Add title above legend
    legend.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text("Years:");
    
    // Create legend items
    yearsToShow.forEach((year, i) => {
      // Calculate position - when more than 5 years, make two columns
      const column = i >= Math.ceil(yearsToShow.length / 2) ? 1 : 0;
      const row = i % Math.ceil(yearsToShow.length / 2);
      
      const legendItem = legend.append("g")
        .attr("transform", `translate(${column * 80}, ${row * 20})`)
        .attr("class", "legend-item");
      
      legendItem.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colorScale(year));
      
      legendItem.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text(year)
        .attr("font-size", "12px");
    });
    
    // Add title
    svg.append("text")
      .attr("x", 0)
      .attr("y", -height/2 + 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text(`${focusYears}-Year Monthly ${selectedMetric === 'fires' ? 'Fire Counts' : 'Acres Burned'} (${yearsToShow[yearsToShow.length-1]}-${yearsToShow[0]})`);
    
    // Create tooltip
    const tooltip = d3.select("body")
      .selectAll('.tooltip')
      .data([null])
      .join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Find the average max values for summer months
    const summerMaxes = {};
    months.slice(5, 9).forEach(month => { // June, July, August, September
      const monthIndex = months.indexOf(month);
      const monthData = processedData.filter(d => d.monthIndex === monthIndex);
      summerMaxes[month] = d3.max(monthData, d => d.value);
    });
    

    
    
    
    
    
  };
  
  return (
    <div className="chart-container">
      <h3 className="section-title">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Monthly Fire Patterns (Radial Bar Chart)
      </h3>
      <div className="chart-description">
        This radial bar chart shows the seasonal pattern of {selectedMetric === 'fires' ? 'fire occurrences' : 'acres burned'} 
        across multiple years. Each bar represents a month's data for a specific year, with longer bars indicating higher values.
        The highlighted section shows the peak fire season (June-September).
      </div>
      
      <div className="control-panel" style={{ marginBottom: '15px', textAlign: 'center' }}>
        <label style={{ marginRight: '10px', fontWeight: 'medium' }}>
          Years to display:
        </label>
        <select 
          value={focusYears} 
          onChange={(e) => setFocusYears(Number(e.target.value))}
          style={{ 
            padding: '5px 10px', 
            borderRadius: '4px', 
            border: '1px solid #d1d5db' 
          }}
        >
          <option value={3}>Last 3 years</option>
          <option value={5}>Last 5 years</option>
          <option value={10}>Last 10 years</option>
        </select>
      </div>
      
      <div className="chart-canvas" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={radialChartRef} width="100%" height="600"></svg>
      </div>
      
      <div className="chart-notes" style={{ marginTop: '15px', fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
        Note: This visualization shows discrete bars for each year's monthly data, making it easier to compare values accurately.
        The height of each bar directly represents the number of {selectedMetric === 'fires' ? 'fires' : 'acres burned'}.
      </div>
    </div>
  );
};

export default RadialBarChart;