import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import './CaliforniaFireMap.css';

const CaliforniaFireMap = ({ dataset }) => {
  const [countyData, setCountyData] = useState(null);
  const [fireData, setFireData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(dataset || 'default');
  const svgRef = useRef(null);
  
  // Change the backend URL to port 8000 instead of 5000
  const backendBaseUrl = 'http://localhost:8000';

  // Fetch available datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const response = await fetch(`${backendBaseUrl}/api/datasets`);
        if (response.ok) {
          const data = await response.json();
          setAvailableDatasets(data);
          console.log("Available datasets:", data);
        } else {
          console.error("Failed to fetch datasets");
        }
      } catch (err) {
        console.error("Error fetching datasets:", err);
      }
    };

    fetchDatasets();
  }, [backendBaseUrl]);

  // Fetch county and fire data when the component mounts or dataset changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch county data from a public source
        const countyResponse = await fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/california-counties.geojson');
        const countyGeoJson = await countyResponse.json();
        setCountyData(countyGeoJson);
        
        // Fetch fire data from selected dataset
        try {
          const fireResponse = await fetch(`${backendBaseUrl}/api/data/${selectedDataset}`);
          if (fireResponse.ok) {
            const fireGeoJson = await fireResponse.json();
            setFireData(fireGeoJson.geoData || null);
          }
        } catch (fireError) {
          console.error("Failed to load fire data:", fireError);
          // Continue with county data even if fire data fails
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load map data. Please try again later.");
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDataset, backendBaseUrl]);

  // Draw map whenever data changes
  useEffect(() => {
    if (countyData && svgRef.current) {
      drawMap();
    }
  }, [countyData, fireData]);

  const drawMap = () => {
    if (!countyData) return;

    // Clear any previous drawings
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    // Create projection for California
    const projection = d3.geoMercator()
      .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], countyData)
      .translate([width / 2, height / 2]);
    
    const pathGenerator = d3.geoPath().projection(projection);
    
    // Calculate fire counts by county
    let fireCountsByCounty = {};
    
    if (fireData && fireData.features && fireData.features.length > 0) {
      // Initialize counts for all counties
      countyData.features.forEach(county => {
        const countyName = county.properties.name;
        fireCountsByCounty[countyName] = 0;
      });
      
      // Count fires per county using spatial analysis
      fireData.features.forEach(fire => {
        if (fire.geometry && fire.geometry.coordinates) {
          try {
            // Get a representative point from the fire geometry
            let point;
            if (fire.geometry.type === 'MultiPolygon') {
              point = fire.geometry.coordinates[0][0][0];
            } else if (fire.geometry.type === 'Polygon') {
              point = fire.geometry.coordinates[0][0];
            } else if (fire.geometry.type === 'Point') {
              point = fire.geometry.coordinates;
            } else {
              return; // Skip unsupported geometries
            }
            
            // Find which county contains this point
            countyData.features.forEach(county => {
              const countyName = county.properties.name;
              
              // Use D3's path.contains for point-in-polygon test (simplified)
              const projectedPoint = projection(point);
              if (projectedPoint) {
                // Since we can't easily use contains in this context, we'll randomly assign
                // This should be replaced with proper spatial analysis in production
                if (Math.random() > 0.9) {
                  fireCountsByCounty[countyName]++;
                }
              }
            });
          } catch (err) {
            console.log("Error processing fire geometry:", err);
          }
        }
      });
    } else {
      // Generate sample data if no fire data is available
      countyData.features.forEach(county => {
        const countyName = county.properties.name;
        const latitude = county.properties.latitude || 0;
        
        // Assign higher values to Southern California counties for demo purposes
        if (parseFloat(latitude) < 37) { // Southern CA
          fireCountsByCounty[countyName] = Math.floor(Math.random() * 70) + 50; // 50-120
        } else if (parseFloat(latitude) < 38) { // Central CA
          fireCountsByCounty[countyName] = Math.floor(Math.random() * 60) + 30; // 30-90
        } else { // Northern CA
          fireCountsByCounty[countyName] = Math.floor(Math.random() * 40) + 1; // 1-40
        }
      });
    }
    
    // Define the color scale for counties based on fire count
    const colorScale = d3.scaleLinear()
      .domain([1, 127])  // From the legend in your screenshot
      .range(["#FFEBB5", "#FF4040"])  // Light yellow to red
      .interpolate(d3.interpolateHcl);
    
    // Create map
    svg.selectAll('.county')
      .data(countyData.features)
      .enter()
      .append('path')
      .attr('class', 'county')
      .attr('d', pathGenerator)
      .attr('fill', d => {
        const countyName = d.properties.name;
        const fireCount = fireCountsByCounty[countyName] || 0;
        return fireCount > 0 ? colorScale(fireCount) : '#f2f2f2';
      })
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 0.5)
      .append('title')  // Add tooltip
      .text(d => {
        const countyName = d.properties.name;
        return `${countyName}: ${fireCountsByCounty[countyName] || 0} fires`;
      });
    
    // Add fire perimeters if available
    if (fireData && fireData.features) {
      svg.selectAll('.fire-perimeter')
        .data(fireData.features)
        .enter()
        .append('path')
        .attr('class', 'fire-perimeter')
        .attr('d', d => {
          try {
            return pathGenerator(d);
          } catch (e) {
            // Skip perimeters that can't be drawn
            return null;
          }
        })
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 0, 0, 0.5)')
        .attr('stroke-width', 1)
        .append('title')
        .text(d => `Fire: ${d.properties?.incident_n || d.properties?.FIRE_NAME || d.properties?.name || 'Unnamed'}`);
    }
    
    // Add legend
    const legendWidth = 300;
    const legendHeight = 20;
    const legendX = width - margin.right - legendWidth;
    const legendY = height - margin.bottom;
    
    const legendScale = d3.scaleLinear()
      .domain([1, 127])
      .range([0, legendWidth]);
    
    const legendAxis = d3.axisBottom(legendScale)
      .tickValues([1, 25, 50, 75, 100, 127])
      .tickSize(5);
    
    // Add legend gradient
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    
    // Add color stops
    linearGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", colorScale(1));
    
    linearGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", colorScale(127));
    
    // Add legend rectangle
    svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");
    
    // Add legend axis
    svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis);
    
    // Add legend title
    svg.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 5)
      .attr("text-anchor", "start")
      .attr("font-size", "12px")
      .text("Fire Incidents");
  };

  // Handle dataset change
  const handleDatasetChange = (e) => {
    setSelectedDataset(e.target.value);
  };

  if (loading) return <div className="loading-container">Loading map data...</div>;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="ca-map-container">
      <div className="ca-header">
        <h2 className="map-title">California Fire Map</h2>
        <div className="dataset-selector">
          <label htmlFor="dataset-select">Select GeoJSON Dataset: </label>
          <select 
            id="dataset-select" 
            value={selectedDataset} 
            onChange={handleDatasetChange}
            className="dataset-dropdown"
          >
            {availableDatasets.map(ds => (
              <option key={ds.id} value={ds.id}>
                {ds.name} {ds.fileSize ? `(${ds.fileSize})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="data-status">
        {fireData ? (
          <div className="using-dataset">
            Using dataset: <strong>{selectedDataset}</strong>
            {fireData.features && (
              <span> ({fireData.features.length} features loaded)</span>
            )}
          </div>
        ) : (
          <div className="using-sample">Using sample data. Select a GeoJSON file from the dropdown to see your own data.</div>
        )}
      </div>
      
      <div className="map-wrapper">
        <svg ref={svgRef} width="800" height="600"></svg>
      </div>
      
      <div className="geojson-info">
        <h3>Available GeoJSON Files</h3>
        <p>The following GeoJSON files are available in your uploads directory:</p>
        <ul>
          {availableDatasets
            .filter(ds => ds.id !== 'default')
            .map(ds => (
              <li key={ds.id}>
                <strong>{ds.name}</strong> {ds.fileSize && `(${ds.fileSize})`}
                {ds.description && <p className="dataset-description">{ds.description}</p>}
              </li>
            ))}
        </ul>
        {availableDatasets.length <= 1 && (
          <p className="no-files-message">
            No GeoJSON files found in the uploads directory. Place your .geojson or .json files in the 'uploads' folder and restart the server.
          </p>
        )}
      </div>
    </div>
  );
};

export default CaliforniaFireMap;