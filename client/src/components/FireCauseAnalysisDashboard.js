import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const FireCauseAnalysisDashboard = ({
    causesData,
    topCauses,
    causeDefinitions,
    selectedYear,
    availableYears,
    onYearChange,
    onRefresh
}) => {
    const topCausesChartRef = useRef(null);
    const causesByYearChartRef = useRef(null);
    const monthlyCausesChartRef = useRef(null);
    const [selectedCause, setSelectedCause] = useState(null);
    const [showAllCauses, setShowAllCauses] = useState(false);

    useEffect(() => {
        if (topCauses && topCauses.length > 0) {
            createTopCausesChart();
        }
    }, [topCauses, showAllCauses]);

    useEffect(() => {
        if (causesData && selectedYear && causesData[selectedYear]) {
            createCausesByYearChart();
            createMonthlyCausesChart();
        }
    }, [causesData, selectedYear, selectedCause]);

    // Format large numbers
    const formatLargeNumber = (num) => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num;
    };

    const getColorScale = () => {
        return d3.scaleOrdinal()
            .domain([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
            .range([
                '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4',
                '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff',
                '#9A6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075'
            ]);
    };

    const getCauseColor = (causeId) => {
        const colorScale = getColorScale();
        return colorScale(causeId);
    };

    function getResponsiveWidth(svgElement) {
        // Get the width of the container, not the SVG element itself
        const containerWidth = svgElement.parentNode.clientWidth || 
                               svgElement.parentNode.getBoundingClientRect().width || 
                               window.innerWidth - 60;
                               
        // Return the container width with a little padding
        return containerWidth - 40; // 20px padding on each side
      }

    const createTopCausesChart = () => {
        if (!topCausesChartRef.current) return;

        // Clear any existing chart
        d3.select(topCausesChartRef.current).selectAll('*').remove();

        const margin = { top: 50, right: 180, bottom: 100, left: 90 };
        const svgElement = topCausesChartRef.current;
        const width = getResponsiveWidth(svgElement);
        const height = 450;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgElement)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Determine how many causes to show
        const visibleCauses = showAllCauses ? topCauses : topCauses.slice(0, 8);

        // Define scales
        const xScale = d3.scaleBand()
            .domain(visibleCauses.map(d => d.causeId))
            .range([0, chartWidth])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(visibleCauses, d => d.fires) * 1.1])
            .range([chartHeight, 0]);

        // Create axes
        svg.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(d => {
                    const cause = visibleCauses.find(c => c.causeId === d);
                    return cause ? cause.causeId : '';
                }))
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
            .data(visibleCauses)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.causeId))
            .attr('y', d => yScale(d.fires))
            .attr('width', xScale.bandwidth())
            .attr('height', d => chartHeight - yScale(d.fires))
            .attr('fill', d => getCauseColor(d.causeId))
            .attr('rx', 4)
            .attr('ry', 4);

        // Add percentage labels above bars
        svg.selectAll('percent-labels')
            .data(visibleCauses)
            .enter()
            .append('text')
            .attr('x', d => xScale(d.causeId) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.fires) - 10)
            .attr('text-anchor', 'middle')
            .text(d => `${d.percentage}%`)
            .style('font-size', '12px')
            .style('font-weight', 'bold');

        // Add legend
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${chartWidth + 10}, 0)`);

        visibleCauses.forEach((cause, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendItem.append('rect')
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', getCauseColor(cause.causeId));

            legendItem.append('text')
                .attr('x', 20)
                .attr('y', 10)
                .text(`${cause.causeId} - ${cause.causeName}`)
                .style('font-size', '12px');
        });

        // Add title
        svg.append('text')
            .attr('x', chartWidth / 2)
            .attr('y', -30)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text('Top Fire Causes by Number of Fires');

        // Create tooltip
        const tooltip = d3.select('body')
            .selectAll('.tooltip')
            .data([null])
            .join('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        // Add hover effects with safe access to properties
        svg.selectAll('rect')
            .on('mouseover', function (event, d) {
                try {
                    if (!d) return;

                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('opacity', 0.8);

                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);

                    tooltip.html(`
            <strong>${d.causeId} - ${d.causeName}</strong><br/>
            Fires: ${d.fires.toLocaleString()}<br/>
            Acres Burned: ${d.acres.toLocaleString()}<br/>
            Percentage: ${d.percentage}%
          `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                } catch (error) {
                    console.error('Error in top causes chart hover:', error);
                }
            })
            .on('mouseout', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('opacity', 1);

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Add a button to show/hide all causes
        d3.select(svgElement.parentNode)
            .selectAll('.toggle-button')
            .data([null])
            .join('button')
            .attr('class', 'toggle-button refresh-button')
            .style('margin-top', '10px')
            .style('margin-left', '10px')
            .text(showAllCauses ? 'Show Top 8 Causes' : 'Show All Causes')
            .on('click', function () {
                setShowAllCauses(!showAllCauses);
            });
    };

    const createCausesByYearChart = () => {
        if (!causesByYearChartRef.current || !causesData || !selectedYear || !causesData[selectedYear]) return;

        // Clear any existing chart
        d3.select(causesByYearChartRef.current).selectAll('*').remove();

        const yearData = causesData[selectedYear].causes;
        if (!yearData || yearData.length === 0) return;

        const margin = { top: 50, right: 180, bottom: 100, left: 90 };
        const svgElement = causesByYearChartRef.current;
        const width = getResponsiveWidth(svgElement);
        const height = 400;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgElement)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Determine how many causes to show (show top 8 causes for this year)
        const visibleCauses = yearData.slice(0, 8);

        // Define scales
        const xScale = d3.scaleBand()
            .domain(visibleCauses.map(d => d.causeId))
            .range([0, chartWidth])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(visibleCauses, d => d.fires) * 1.1])
            .range([chartHeight, 0]);

        // Create axes
        svg.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(d => {
                    const cause = visibleCauses.find(c => c.causeId === d);
                    return cause ? cause.causeId : '';
                }))
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
            .data(visibleCauses)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.causeId))
            .attr('y', d => yScale(d.fires))
            .attr('width', xScale.bandwidth())
            .attr('height', d => chartHeight - yScale(d.fires))
            .attr('fill', d => getCauseColor(d.causeId))
            .attr('rx', 4)
            .attr('ry', 4)
            .attr('cursor', 'pointer')
            .on('click', (event, d) => {
                try {
                    if (!d) return;
                    setSelectedCause(selectedCause === d.causeId ? null : d.causeId);
                } catch (error) {
                    console.error('Error handling click:', error);
                }
            });

        // Highlight the selected cause
        if (selectedCause) {
            svg.selectAll('rect')
                .attr('opacity', d => {
                    try {
                        return d.causeId === selectedCause ? 1 : 0.3;
                    } catch (error) {
                        return 1;
                    }
                });
        }

        // Add legend
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${chartWidth + 10}, 0)`);

        visibleCauses.forEach((cause, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendItem.append('rect')
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', getCauseColor(cause.causeId));

            legendItem.append('text')
                .attr('x', 20)
                .attr('y', 10)
                .text(`${cause.causeId} - ${cause.causeName}`)
                .style('font-size', '12px');
        });

        // Add title
        svg.append('text')
            .attr('x', chartWidth / 2)
            .attr('y', -30)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(`Top Fire Causes in ${selectedYear} (click to filter monthly chart)`);

        // Create tooltip
        const tooltip = d3.select('body')
            .selectAll('.tooltip')
            .data([null])
            .join('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        // Add hover effects with defensive coding
        svg.selectAll('rect')
            .on('mouseover', function (event, d) {
                try {
                    if (!d) return;

                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('opacity', d.causeId === selectedCause ? 1 : 0.5);

                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);

                    const totalFires = yearData.reduce((sum, cause) => sum + cause.fires, 0);
                    const percentage = Math.round((d.fires / totalFires) * 1000) / 10;

                    tooltip.html(`
            <strong>${d.causeId} - ${d.causeName}</strong><br/>
            Fires: ${d.fires.toLocaleString()}<br/>
            Acres Burned: ${d.acres.toLocaleString()}<br/>
            Percentage: ${percentage}%<br/>
            Click to filter monthly chart
          `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                } catch (error) {
                    console.error('Error in yearly causes chart hover:', error);
                }
            })
            .on('mouseout', function (event, d) {
                try {
                    if (!d) return;

                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('opacity', d.causeId === selectedCause ? 1 : (selectedCause ? 0.3 : 1));

                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                } catch (error) {
                    console.error('Error in mouseout handler:', error);
                }
            });
    };

    const createMonthlyCausesChart = () => {
        if (!monthlyCausesChartRef.current || !causesData || !selectedYear || !causesData[selectedYear]) return;

        // Clear any existing chart
        d3.select(monthlyCausesChartRef.current).selectAll('*').remove();

        const yearData = causesData[selectedYear];
        if (!yearData || !yearData.monthlyBreakdown) return;

        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Prepare data for stacked bar chart
        const monthlyCausesData = months.map(month => {
            const monthData = { month };

            // Get monthly causes data
            const monthCauses = yearData.monthlyBreakdown[month] || [];

            // If a cause is selected, only include that cause
            if (selectedCause !== null) {
                const selectedCauseData = monthCauses.find(c => c.causeId === selectedCause);
                if (selectedCauseData) {
                    monthData[selectedCauseData.causeId] = selectedCauseData.fires;
                } else {
                    monthData[selectedCause] = 0;
                }
            } else {
                // Otherwise include top 5 causes for this year
                const topCausesForYear = yearData.causes.slice(0, 5).map(c => c.causeId);

                topCausesForYear.forEach(causeId => {
                    const causeData = monthCauses.find(c => c.causeId === causeId);
                    monthData[causeId] = causeData ? causeData.fires : 0;
                });
            }

            return monthData;
        });

        // Get cause IDs to stack
        const causeIds = selectedCause !== null
            ? [selectedCause]
            : yearData.causes.slice(0, 5).map(c => c.causeId);

        const margin = { top: 50, right: 180, bottom: 100, left: 90 };
        const svgElement = monthlyCausesChartRef.current;
        const width = getResponsiveWidth(svgElement);
        const height = 400;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgElement)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Define scales
        const xScale = d3.scaleBand()
            .domain(months)
            .range([0, chartWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(monthlyCausesData, d => {
                return d3.sum(causeIds, causeId => d[causeId] || 0);
            }) * 1.1])
            .range([chartHeight, 0]);

        // Create stacked data
        const stack = d3.stack()
            .keys(causeIds)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);

        const stackedData = stack(monthlyCausesData);

        // Create axes
        svg.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .style('font-size', '10px');

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

        // Add stacked bars
        const stackGroups = svg.append('g')
            .selectAll('g')
            .data(stackedData)
            .enter()
            .append('g')
            .attr('fill', d => getCauseColor(parseInt(d.key)));

        // Store the stack group key in a data attribute for easier access in event handlers
        stackGroups.each(function (d) {
            d3.select(this).attr('data-key', d.key);
        });

        stackGroups.selectAll('rect')
            .data(d => d)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.data.month))
            .attr('y', d => yScale(d[1]))
            .attr('height', d => yScale(d[0]) - yScale(d[1]))
            .attr('width', xScale.bandwidth());

        // Add legend
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${chartWidth + 10}, 0)`);

        causeIds.forEach((causeId, i) => {
            const cause = yearData.causes.find(c => c.causeId === causeId) ||
                { causeId, causeName: causeDefinitions[causeId] || `Unknown (${causeId})` };

            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendItem.append('rect')
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', getCauseColor(causeId));

            legendItem.append('text')
                .attr('x', 20)
                .attr('y', 10)
                .text(`${causeId} - ${cause.causeName}`)
                .style('font-size', '12px');
        });

        // Add title with more space
        svg.append('text')
            .attr('x', chartWidth / 2)
            .attr('y', -30)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(selectedCause
                ? `Monthly Distribution of "${causeDefinitions[selectedCause]}" Fires in ${selectedYear}`
                : `Monthly Distribution of Top Fire Causes in ${selectedYear}`);

        // Create tooltip
        const tooltip = d3.select('body')
            .selectAll('.tooltip')
            .data([null])
            .join('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        // Enhanced hover event handlers with error handling
        svg.selectAll('rect')
            .on('mouseover', function (event, d) {
                try {
                    if (!d || !d.data) return;

                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('opacity', 0.8);

                    // Get the cause ID from the parent group's data-key attribute
                    const parentGroup = this.parentNode;
                    if (!parentGroup) return;

                    const causeIdStr = d3.select(parentGroup).attr('data-key');
                    if (!causeIdStr) return;

                    const causeId = parseInt(causeIdStr);
                    const causeName = causeDefinitions[causeId] || `Unknown (${causeId})`;
                    const monthData = d.data;

                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);

                    tooltip.html(`
            <strong>${monthData.month} ${selectedYear}</strong><br/>
            Cause: ${causeId} - ${causeName}<br/>
            Fires: ${(monthData[causeId] || 0).toLocaleString()}
          `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                } catch (error) {
                    console.error('Error in monthly causes chart hover:', error);
                }
            })
            .on('mouseout', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('opacity', 1);

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Add a button to clear the selected cause filter
        if (selectedCause !== null) {
            d3.select(svgElement.parentNode)
                .selectAll('.clear-filter-button')
                .data([null])
                .join('button')
                .attr('class', 'clear-filter-button refresh-button')
                .style('margin-top', '10px')
                .style('margin-left', '10px')
                .text('Clear Cause Filter')
                .on('click', function () {
                    setSelectedCause(null);
                });
        }
    };

    // Create a table of fire causes with their descriptions
    const renderCauseDefinitionsTable = () => {
        return (
            <div className="chart-container">
                <h3 className="section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Fire Cause Reference Guide
                </h3>
                <div className="chart-description">
                    Reference of fire cause codes and their definitions as per CAL FIRE classification.
                </div>
                <div className="data-table">
                    <table className="monthly-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Cause Name</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(causeDefinitions).map(([code, name]) => (
                                <tr key={code}>
                                    <td>{code}</td>
                                    <td>{name}</td>
                                    <td>{getCauseDescription(parseInt(code))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Helper function to provide descriptions for fire causes
    const getCauseDescription = (causeId) => {
        switch (causeId) {
            case 1: return "Fires caused by natural lightning strikes.";
            case 2: return "Fires caused by equipment use, such as chainsaws, tractors, or other machinery.";
            case 3: return "Fires caused by improperly discarded cigarettes, cigars, or other smoking materials.";
            case 4: return "Fires that escape from recreational or warming campfires.";
            case 5: return "Fires from burning of yard waste or other debris that escape control.";
            case 6: return "Fires caused by railroad operations, such as sparks from train wheels or maintenance.";
            case 7: return "Fires intentionally set by individuals with malicious intent.";
            case 8: return "Fires caused by children or others playing with matches, lighters, or fire.";
            case 9: return "Fires that don't fall into other specific categories.";
            case 10: return "Fires caused by vehicles, including exhaust systems, catalytic converters, or accidents.";
            case 11: return "Fires caused by electrical power lines or related equipment.";
            case 12: return "Fires that occur during official firefighter training exercises.";
            case 13: return "Fires that occur during non-firefighter training exercises or activities.";
            case 14: return "Fires where the cause could not be determined after investigation.";
            case 15: return "Fires that start from structures and spread to wildland areas.";
            case 16: return "Fires caused by aircraft crashes or related incidents.";
            case 17: return "Fires caused by volcanic activity.";
            case 18: return "Controlled burns that escape their intended boundaries.";
            case 19: return "Fires specifically linked to campfires made by undocumented immigrants.";
            default: return "No description available.";
        }
    };

    return (
        <div className="fire-causes-dashboard">
            <div className="dashboard-header">
                <h2 className="dashboard-title">Fire Cause Analysis Dashboard</h2>
                <p className="dashboard-description">
                    Analysis of wildfire causes across years and seasons, identifying top contributors to fire ignitions
                </p>
            </div>
            <div className="chart-section">
                <div className="chart-container">
                    <h3 className="section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Top Fire Causes
                    </h3>
                    <div className="chart-description">
                        Analysis of the top fire causes based on the number of fires and acres burned.
                    </div>
                    <svg ref={topCausesChartRef} className="chart-svg"></svg>
                </div>
            </div>
{/* Year selector and summary */}
<div className="year-selection-container">
                <div className="year-selector">
                    <label htmlFor="cause-year-select" className="year-selector-label">Select Year for Analysis:</label>
                    <select
                        id="cause-year-select"
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

                <div className="year-summary">
                    <div className="year-summary-item">
                        <div className="summary-label">Selected Year:</div>
                        <div className="summary-value">{selectedYear || 'All Years'}</div>
                    </div>
                    {selectedCause && (
                        <div className="year-summary-item">
                            <div className="summary-label">Filtered Cause:</div>
                            <div className="summary-value">{selectedCause}</div>
                        </div>
                    )}
                    <div className="refresh-button-container">
                        <button className="refresh-button" onClick={onRefresh}>
                            Refresh Data
                        </button>
                    </div>
                </div>
            </div>
            <div className="chart-section">
                <div className="chart-container">
                    <h3 className="section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Top Fire Causes by Year
                    </h3>
                    <div className="chart-description">
                        Analysis of the top fire causes for the selected year.
                    </div>
                    <svg ref={causesByYearChartRef} className="chart-svg"></svg>
                </div>
            </div>
            <div className="chart-section">
                <div className="chart-container">
                    <h3 className="section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Monthly Fire Causes
                    </h3>
                    <div className="chart-description">
                        Monthly breakdown of fire causes for the selected year.
                    </div>
                    <svg ref={monthlyCausesChartRef} className="chart-svg"></svg>
                </div>
            </div>
            {renderCauseDefinitionsTable()}
        </div>
    );
}

export default FireCauseAnalysisDashboard;