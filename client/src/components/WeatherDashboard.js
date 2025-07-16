import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

export const WeatherMetricsBoxplot = ({ metric = 'precipitation' }) => {
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [, setData] = useState(null);

    const processData = (rawData) => {
        // Extract month from date
        const dateFormat = d3.timeParse('%Y-%m-%d');

        const processedData = rawData.map(d => {
            const date = dateFormat(d.DATE);
            const month = date ? date.getMonth() : null; // 0-11
            const year = date ? date.getFullYear() : null; // Get the year

            let value = null;
            if (metric === 'precipitation') {
                value = parseFloat(d.PRECIPITATION);
                value = Math.log(value + 1.5); // Log transformation to reduce skewness
            } else if (metric === 'wind_speed') {
                value = parseFloat(d.AVG_WIND_SPEED);
            }

            return {
                date,
                month,
                year, // Add year to the processed data
                value,
                rawValue: metric === 'precipitation' ? parseFloat(d.PRECIPITATION) : parseFloat(d.AVG_WIND_SPEED) // Store original value
            };
        }).filter(d => d.month !== null && !isNaN(d.value));

        // Group by month
        const dataByMonth = d3.group(processedData, d => d.month);

        // Calculate statistics for each month
        const months = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        const monthlyStats = Array.from(dataByMonth, ([month, values]) => {
            const monthValues = values.map(d => d.value);

            return {
                month: months[month],
                monthIndex: month,
                values: monthValues,
                // Keep the original data points with year information
                dataPoints: values.map(d => ({
                    value: d.value,
                    rawValue: d.rawValue,
                    year: d.year,
                    month: d.month,
                    date: d.date
                })),
                min: d3.min(monthValues),
                max: d3.max(monthValues),
                median: d3.median(monthValues),
                q1: d3.quantile(monthValues.sort(d3.ascending), 0.25),
                q3: d3.quantile(monthValues.sort(d3.ascending), 0.75)
            };
        }).sort((a, b) => a.monthIndex - b.monthIndex);

        return monthlyStats;
    };

    useEffect(() => {
        const fetchAndProcessData = async () => {
            try {
                setLoading(true);

                const response = await fetch('/api/weather-csv');
                if (!response.ok) {
                    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
                }

                const fileData = await response.text();

                // Parse the CSV
                Papa.parse(fileData, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.data && results.data.length > 0) {
                            const processedData = processData(results.data);
                            setData(processedData);
                            setLoading(false);
                            createBoxplot(processedData);
                        } else {
                            setError('No data found in CSV');
                            setLoading(false);
                        }
                    },
                    error: (error) => {
                        setError(`Error parsing CSV: ${error.message}`);
                        setLoading(false);
                    }
                });
            } catch (error) {
                setError(`Error loading data: ${error.message}`);
                setLoading(false);
            }
        };

        fetchAndProcessData();
    }, [metric]);

    const createBoxplot = (monthlyStats) => {
        console.log('Creating boxplot with data:', monthlyStats);
        if (!containerRef.current || !monthlyStats) return;

        // Set up the SVG dimensions
        const margin = { top: 50, right: 30, bottom: 100, left: 60 };
        const width = containerRef.current.clientWidth || 800;
        const height = 500;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Remove any existing SVG and tooltip
        d3.select(containerRef.current).selectAll('svg').remove();
        d3.select('body').selectAll('.weather-metrics-tooltip').remove();

        // Create the SVG container
        const svg = d3.select(containerRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Add title
        const metricTitle = metric === 'precipitation' ? 'Precipitation' : 'Average Wind Speed';
        const metricUnit = metric === 'precipitation' ? 'inches' : 'mph';

        svg.append("text")
            .attr("x", chartWidth / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-weight", "bold")
            .text(`Monthly ${metricTitle} Distribution (1984-2025)`);

        // Create tooltip
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'weather-metrics-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('border', '1px solid #333')
            .style('border-radius', '5px')
            .style('padding', '8px 12px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 10000);

        // Prepare data for boxplot
        const months = monthlyStats.map(stat => stat.month);

        // Create X scale for months
        const xScale = d3.scaleBand()
            .domain(months)
            .range([0, chartWidth])
            .padding(0.4);

        // Create Y scale - add padding above and below
        const allValues = monthlyStats.flatMap(d => d.values);
        const yMin = d3.min(allValues) * 0.95; // 5% padding below
        const yMax = d3.max(allValues) * 1.05; // 5% padding above

        const yScale = d3.scaleLinear()
            .domain([yMin < 0 ? yMin : 0, yMax]) // Start at 0 if all values are positive
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
            .text(`${metricTitle} (${metricUnit})`);

        // Color based on the metric
        const boxColor = metric === 'precipitation' ? '#4682B4' : '#F4A460';
        const boxFillColor = metric === 'precipitation' ? '#E6F0FF' : '#FFF0E0';

        // Process and visualize data for each month
        monthlyStats.forEach((monthData) => {
            if (!monthData.q1 || !monthData.q3) return; // Skip if quartiles are undefined

            const monthX = xScale(monthData.month) + xScale.bandwidth() / 2;

            // Draw box
            const boxWidth = xScale.bandwidth() * 0.7;

            // Box background (IQR)
            svg.append('rect')
                .attr('x', monthX - boxWidth / 2)
                .attr('y', yScale(monthData.q3))
                .attr('height', yScale(monthData.q1) - yScale(monthData.q3))
                .attr('width', boxWidth)
                .attr('stroke', boxColor)
                .attr('fill', boxFillColor)
                .attr('opacity', 0.8);

            // Add horizontal line for median
            svg.append('line')
                .attr('x1', monthX - boxWidth / 2)
                .attr('x2', monthX + boxWidth / 2)
                .attr('y1', yScale(monthData.median))
                .attr('y2', yScale(monthData.median))
                .attr('stroke', boxColor)
                .attr('stroke-width', 2);

            // Min to Max vertical line
            svg.append('line')
                .attr('x1', monthX)
                .attr('x2', monthX)
                .attr('y1', yScale(monthData.min))
                .attr('y2', yScale(monthData.max))
                .attr('stroke', boxColor)
                .attr('stroke-width', 1);

            // Top whisker line
            svg.append('line')
                .attr('x1', monthX - boxWidth / 3)
                .attr('x2', monthX + boxWidth / 3)
                .attr('y1', yScale(monthData.max))
                .attr('y2', yScale(monthData.max))
                .attr('stroke', boxColor)
                .attr('stroke-width', 1);

            // Bottom whisker line
            svg.append('line')
                .attr('x1', monthX - boxWidth / 3)
                .attr('x2', monthX + boxWidth / 3)
                .attr('y1', yScale(monthData.min))
                .attr('y2', yScale(monthData.min))
                .attr('stroke', boxColor)
                .attr('stroke-width', 1);

            // Create a simplified distribution of points
            // Instead of plotting all points (which could be thousands),
            // sample a smaller representative set for visualization
            const sampleSize = Math.min(20, monthData.dataPoints.length);
            const sampleStep = Math.floor(monthData.dataPoints.length / sampleSize);
            const sampledDataPoints = [];

            for (let i = 0; i < monthData.dataPoints.length && sampledDataPoints.length < sampleSize; i += sampleStep) {
                sampledDataPoints.push(monthData.dataPoints[i]);
            }

            // Add jittered points for data visualization
            svg.selectAll(`.point-${monthData.month.toLowerCase()}`)
                .data(sampledDataPoints)
                .enter()
                .append('circle')
                .attr('cx', () => monthX + (Math.random() - 0.5) * boxWidth * 0.6) // Jitter
                .attr('cy', d => yScale(d.value))
                .attr('r', 3)
                .attr('fill', boxColor)
                .attr('opacity', 0.5)
                .attr('stroke', d3.rgb(boxColor).darker())
                .attr('stroke-width', 0.5)
                .on('mouseover', function (event, d) {
                    // Highlight the point
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 5)
                        .attr('opacity', 1);

                    // Format date to display month and year
                    const dateStr = d.date ? `${monthData.month} ${d.year}` : monthData.month;
                    const displayValue = metric === 'precipitation' ? 
                        d.rawValue.toFixed(2) : // Show the actual value, not the log-transformed one for precipitation
                        d.value.toFixed(2);

                    // Show the tooltip
                    tooltip
                        .transition()
                        .duration(200)
                        .style('opacity', 0.9);

                    tooltip.html(`
                        <strong>${dateStr}</strong><br>
                        ${metricTitle}: ${displayValue} ${metricUnit}<br>
                        Min: ${monthData.min.toFixed(2)} ${metricUnit}<br>
                        Max: ${monthData.max.toFixed(2)} ${metricUnit}<br>
                        Median: ${monthData.median.toFixed(2)} ${metricUnit}
                    `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function () {
                    // Return the point to original size
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 3)
                        .attr('opacity', 0.5);

                    // Hide the tooltip
                    tooltip
                        .transition()
                        .duration(500)
                        .style('opacity', 0);
                });
        });

        // Add a legend for the boxplot elements
        const legendX = 60;
        const legendY = 10;

        // Legend box
        svg.append('rect')
            .attr('x', legendX - 10)
            .attr('y', legendY - 5)
            .attr('width', 220)
            .attr('height', 75)
            .attr('fill', 'white')
            .attr('stroke', '#ccc')
            .attr('opacity', 0.8)
            .attr('rx', 5);

        // Legend title
        svg.append('text')
            .attr('x', legendX)
            .attr('y', legendY + 10)
            .text('Boxplot Elements')
            .style('font-weight', 'bold')
            .style('font-size', '12px');

        // Legend items
        const items = [
            { y: legendY + 30, text: 'Box: Interquartile Range (IQR)' },
            { y: legendY + 45, text: 'Line: Median Value' },
            { y: legendY + 60, text: 'Whiskers: Min and Max Values' }
        ];

        items.forEach(item => {
            svg.append('text')
                .attr('x', legendX + 15)
                .attr('y', item.y)
                .text(item.text)
                .style('font-size', '10px');

            // Add symbols
            if (item.y === legendY + 30) {
                svg.append('rect')
                    .attr('x', legendX)
                    .attr('y', item.y - 9)
                    .attr('width', 10)
                    .attr('height', 10)
                    .attr('fill', boxFillColor)
                    .attr('stroke', boxColor);
            } else if (item.y === legendY + 45) {
                svg.append('line')
                    .attr('x1', legendX)
                    .attr('x2', legendX + 10)
                    .attr('y1', item.y - 4)
                    .attr('y2', item.y - 4)
                    .attr('stroke', boxColor)
                    .attr('stroke-width', 2);
            } else {
                svg.append('line')
                    .attr('x1', legendX + 5)
                    .attr('x2', legendX + 5)
                    .attr('y1', item.y - 8)
                    .attr('y2', item.y)
                    .attr('stroke', boxColor);

                svg.append('line')
                    .attr('x1', legendX + 2)
                    .attr('x2', legendX + 8)
                    .attr('y1', item.y - 8)
                    .attr('y2', item.y - 8)
                    .attr('stroke', boxColor);

                svg.append('line')
                    .attr('x1', legendX + 2)
                    .attr('x2', legendX + 8)
                    .attr('y1', item.y)
                    .attr('y2', item.y)
                    .attr('stroke', boxColor);
            }
        });
    };

    return (
        <div className="chart-container">
            <h3 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.168 1.168a4 4 0 01-8.214 0l1.168-1.168A3 3 0 009 8.172z" clipRule="evenodd" />
                </svg>
                {metric === 'precipitation' ? 'Monthly Precipitation Distribution' : 'Monthly Wind Speed Distribution'}
            </h3>
            <div className="chart-description">
                A detailed visualization showing {metric === 'precipitation' ? 'precipitation' : 'wind speed'} variations across different months,
                with quartile markers, and min-max ranges from 1984-2025.
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

            {loading && (
                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "200px"
                }}>
                    <div style={{
                        display: "inline-block",
                        width: "40px",
                        height: "40px",
                        border: "4px solid rgba(0, 0, 0, 0.1)",
                        borderLeftColor: "#3b82f6",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                    }}></div>
                    <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
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
                <strong>Note:</strong> Boxplots show the distribution of {metric === 'precipitation' ? 'precipitation' : 'wind speed'} for each month.
                The box represents the interquartile range (IQR) with the middle line showing the median value.
                Whiskers extend to the min and max values. Points represent sample data points from the dataset.
                Hover over points to see the specific year and value.
            </div>
        </div>
    );
};

// Combined component that shows both metrics with a toggle
const WeatherBoxplotDashboard = () => {
    const [activeMetric, setActiveMetric] = useState('precipitation');

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                margin: '20px 0'
            }}>
                <div style={{
                    display: 'flex',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <button
                        onClick={() => setActiveMetric('precipitation')}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: activeMetric === 'precipitation' ? '#3b82f6' : '#f9fafb',
                            color: activeMetric === 'precipitation' ? 'white' : '#4b5563',
                            border: 'none',
                            fontWeight: activeMetric === 'precipitation' ? 'bold' : 'normal',
                            cursor: 'pointer'
                        }}
                    >
                        Precipitation
                    </button>
                    <button
                        onClick={() => setActiveMetric('wind_speed')}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: activeMetric === 'wind_speed' ? '#3b82f6' : '#f9fafb',
                            color: activeMetric === 'wind_speed' ? 'white' : '#4b5563',
                            border: 'none',
                            fontWeight: activeMetric === 'wind_speed' ? 'bold' : 'normal',
                            cursor: 'pointer'
                        }}
                    >
                        Wind Speed
                    </button>
                </div>
            </div>

            <WeatherMetricsBoxplot metric={activeMetric} />
        </div>
    );
};

// Add this at the end of your WeatherDashboard.js file
export { WeatherBoxplotDashboard };
export default WeatherBoxplotDashboard;