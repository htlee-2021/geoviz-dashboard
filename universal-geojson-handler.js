// universal-geojson-handler.js
const fs = require('fs');
const path = require('path');

/**
 * Handle large GeoJSON files with a simplified approach
 * @param {string} filePath - Path to the GeoJSON file
 * @param {number} maxFeatures - Maximum number of features to return
 * @returns {Promise<Object>} - GeoJSON with limited features
 */
async function handleGeoJSONFile(filePath, maxFeatures = 1000) {
  console.log(`Processing GeoJSON file: ${filePath}`);
  console.log(`Max features to return: ${maxFeatures}`);
  
  // Initialize the result object
  const result = {
    type: 'FeatureCollection',
    features: [],
    _simplified: false
  };
  
  try {
    // Get file size
    const fileSize = fs.statSync(filePath).size;
    console.log(`File size: ${Math.round(fileSize / (1024 * 1024))} MB`);

    // For files under a certain size, use direct parse
    console.log("Attempting direct parsing...");
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    console.log("Successfully parsed GeoJSON file");
    
    // Handle standard GeoJSON FeatureCollection
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      console.log(`Found ${data.features.length} features in FeatureCollection`);
      
      // Take only the number of features we need
      result.features = data.features.slice(0, maxFeatures);
      result._totalFeatures = data.features.length;
      result._simplified = data.features.length > maxFeatures;
      
      console.log(`Returning ${result.features.length} features`);
      return result;
    }
    
    // Handle non-standard formats
    if (data.features && Array.isArray(data.features)) {
      console.log(`Found ${data.features.length} features in non-standard format`);
      
      // Process features
      for (let i = 0; i < Math.min(data.features.length, maxFeatures); i++) {
        const feature = data.features[i];
        
        // Normalize to GeoJSON Feature if needed
        if (feature.type !== 'Feature') {
          feature.type = 'Feature';
        }
        
        // Ensure properties exists
        if (!feature.properties) {
          feature.properties = {};
        }
        
        result.features.push(feature);
      }
      
      result._totalFeatures = data.features.length;
      result._simplified = data.features.length > maxFeatures;
      return result;
    }
    
    // Check for ESRI JSON format
    if (data.geometryType && data.spatialReference) {
      console.log("Detected ESRI JSON format");
      
      if (data.features && Array.isArray(data.features)) {
        console.log(`Found ${data.features.length} features in ESRI format`);
        
        // Convert ESRI features to GeoJSON
        for (let i = 0; i < Math.min(data.features.length, maxFeatures); i++) {
          const esriFeature = data.features[i];
          
          // Create GeoJSON feature
          const geoJsonFeature = {
            type: 'Feature',
            properties: esriFeature.attributes || {},
            geometry: convertEsriGeometry(esriFeature.geometry, data.geometryType)
          };
          
          result.features.push(geoJsonFeature);
        }
        
        result._totalFeatures = data.features.length;
        result._simplified = data.features.length > maxFeatures;
        return result;
      }
    }
    
    // Single Feature object
    if (data.type === 'Feature' && data.geometry) {
      console.log("Found a single Feature object");
      
      result.features.push(data);
      result._totalFeatures = 1;
      return result;
    }
    
    // Try as basic geometry
    if (data.type && (data.type === 'Polygon' || data.type === 'MultiPolygon' || 
        data.type === 'Point' || data.type === 'LineString')) {
      console.log(`Found a standalone geometry of type ${data.type}`);
      
      result.features.push({
        type: 'Feature',
        properties: {},
        geometry: data
      });
      
      result._totalFeatures = 1;
      return result;
    }
    
    // Check for layers structure (common in some exports)
    if (data.layers && Array.isArray(data.layers)) {
      console.log(`Found ${data.layers.length} layers`);
      
      let featureCount = 0;
      
      // Process each layer's features
      for (const layer of data.layers) {
        if (layer.features && Array.isArray(layer.features)) {
          console.log(`Layer has ${layer.features.length} features`);
          
          for (let i = 0; i < layer.features.length && result.features.length < maxFeatures; i++) {
            const feature = layer.features[i];
            
            // Normalize to GeoJSON Feature
            const geoJsonFeature = {
              type: 'Feature',
              properties: { 
                ...feature.attributes || feature.properties || {}, 
                _layerName: layer.name || 'unnamed'
              },
              geometry: feature.geometry || convertEsriGeometry(feature.geometry, layer.geometryType)
            };
            
            result.features.push(geoJsonFeature);
            featureCount++;
          }
        }
        
        if (result.features.length >= maxFeatures) {
          break;
        }
      }
      
      result._totalFeatures = featureCount;
      result._simplified = featureCount > maxFeatures;
      return result;
    }
    
    // If we reach here, we couldn't identify the structure
    console.log("Could not identify GeoJSON structure, searching for potential features");
    
    // Last resort: Search for anything that looks like a feature
    findPotentialFeatures(data, result, maxFeatures);
    
    if (result.features.length > 0) {
      console.log(`Found ${result.features.length} potential features`);
      result._totalFeatures = result.features.length;
      return result;
    }
    
    // Return empty result if we couldn't find any features
    console.log("No features found in the file");
    return result;
    
  } catch (err) {
    console.error("Error processing GeoJSON file:", err);
    
    // Return empty feature collection with error info
    return {
      type: 'FeatureCollection',
      features: [],
      _error: err.message
    };
  }
}

/**
 * Recursively search for objects that look like features in complex objects
 */
function findPotentialFeatures(obj, result, maxFeatures) {
  if (result.features.length >= maxFeatures) return;
  
  if (typeof obj !== 'object' || obj === null) return;
  
  // Check if this object looks like a feature
  if (obj.geometry && typeof obj.geometry === 'object' && 
     (obj.properties || obj.attributes)) {
    
    const feature = {
      type: 'Feature',
      properties: obj.properties || obj.attributes || {},
      geometry: obj.geometry
    };
    
    result.features.push(feature);
    return;
  }
  
  // If it has a type property that matches a GeoJSON geometry type
  if (obj.type && obj.coordinates && 
     ['Point', 'LineString', 'Polygon', 'MultiPoint', 
      'MultiLineString', 'MultiPolygon'].includes(obj.type)) {
    
    result.features.push({
      type: 'Feature',
      properties: {},
      geometry: obj
    });
    return;
  }
  
  // Recursively check all properties
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      findPotentialFeatures(obj[key], result, maxFeatures);
      
      // Also check arrays
      if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          if (typeof item === 'object' && item !== null) {
            findPotentialFeatures(item, result, maxFeatures);
          }
        }
      }
    }
  }
}

/**
 * Convert ESRI geometry to GeoJSON geometry
 */
function convertEsriGeometry(esriGeometry, geometryType) {
  // If we already have type, assume it's GeoJSON format
  if (esriGeometry && esriGeometry.type) {
    return esriGeometry;
  }
  
  if (!esriGeometry) {
    return {
      type: 'Polygon',
      coordinates: [[]]
    };
  }
  
  // Handle different ESRI geometry types
  if (geometryType === 'esriGeometryPolygon' || esriGeometry.rings) {
    return {
      type: 'Polygon',
      coordinates: esriGeometry.rings || [[]]
    };
  } else if (geometryType === 'esriGeometryPolyline' || esriGeometry.paths) {
    return {
      type: 'MultiLineString',
      coordinates: esriGeometry.paths || [[]]
    };
  } else if (geometryType === 'esriGeometryPoint' || 
            (esriGeometry.x !== undefined && esriGeometry.y !== undefined)) {
    return {
      type: 'Point',
      coordinates: [esriGeometry.x || 0, esriGeometry.y || 0]
    };
  } else if (geometryType === 'esriGeometryMultiPoint' || esriGeometry.points) {
    return {
      type: 'MultiPoint',
      coordinates: esriGeometry.points || []
    };
  }
  
  // Default to empty polygon if we can't determine type
  return {
    type: 'Polygon',
    coordinates: [[]]
  };
}

// Export the handler function
module.exports = {
  handleGeoJSONFile
};