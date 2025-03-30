// large-file-handler.js - California Counties Version
const fs = require('fs');
const path = require('path');

/**
 * Handle large GeoJSON files with a focus on California Counties format
 * @param {string} filePath - Path to the GeoJSON file
 * @param {number} maxFeatures - Maximum number of features to return
 * @returns {Promise<Object>} - GeoJSON with limited features
 */
async function handleLargeGeoJSONFile(filePath, maxFeatures = 10000) {
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

    // For very large files, use partitioned approach
    if (fileSize > 500 * 1024 * 1024) { // Over 500MB
      return await processLargeCaliforniaFile(filePath, maxFeatures);
    }
    
    // For medium to large files, read chunks
    if (fileSize > 200 * 1024 * 1024) { // Over 200MB
      return await processWithChunks(filePath, maxFeatures);
    }

    // For moderately sized files, use direct reading
    console.log("Using direct reading approach for the file");
    const startTime = Date.now();
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log(`Read file in ${(Date.now() - startTime)/1000} seconds`);
    
    const parseStart = Date.now();
    let data;
    try {
      data = JSON.parse(fileContent);
      console.log(`Parsed JSON in ${(Date.now() - parseStart)/1000} seconds`);
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr.message);
      console.log("Attempting to fix JSON before parsing...");
      const fixedContent = fixBrokenJson(fileContent);
      data = JSON.parse(fixedContent);
      console.log("Successfully parsed JSON after fixing");
    }
    
    // Handle standard GeoJSON FeatureCollection
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      console.log(`Found ${data.features.length} features in FeatureCollection`);
      
      // Take only the number of features we need
      result.features = data.features.slice(0, maxFeatures);
      result._totalFeatures = data.features.length;
      result._simplified = data.features.length > maxFeatures;
      
      // Add crs if it exists in the original
      if (data.crs) {
        result.crs = data.crs;
      }
      
      // Add name if it exists in the original
      if (data.name) {
        result.name = data.name;
      }
      
      console.log(`Returning ${result.features.length} features`);
      return result;
    }
    
    // Handle other formats as needed
    console.log("Unrecognized GeoJSON format");
    return result;
  } catch (err) {
    console.error("Error processing GeoJSON file:", err);
    
    // If the direct approach fails, try chunked reading
    try {
      console.log("Falling back to chunked reading method");
      return await processWithChunks(filePath, maxFeatures);
    } catch (chunkErr) {
      console.error("Chunked reading failed:", chunkErr);
      
      // Try one last approach - simplified feature counting and sampling
      try {
        console.log("Attempting simplified approach for very large file");
        return await processGiantFileSimplified(filePath, maxFeatures);
      } catch (simpleErr) {
        console.error("All approaches failed:", simpleErr);
        
        // Return empty feature collection with error info
        return {
          type: 'FeatureCollection',
          features: [],
          _error: `Failed to process GeoJSON: ${err.message}`
        };
      }
    }
  }
}

/**
 * Process a very large California counties file by reading it in segments
 */
async function processLargeCaliforniaFile(filePath, maxFeatures) {
  console.log("Processing large California counties file in segments");
  
  const result = {
    type: 'FeatureCollection',
    features: [],
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4269" } },
    name: "California"
  };
  
  // Read the first portion to get file structure
  try {
    // Read first 5MB to get header info
    const headerSize = 5 * 1024 * 1024;
    const headerBuffer = Buffer.alloc(headerSize);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuffer, 0, headerSize, 0);
    fs.closeSync(fd);
    
    const headerText = headerBuffer.toString('utf8');
    const headerMatch = headerText.match(/\{\s*"type"\s*:\s*"FeatureCollection".*?"features"\s*:\s*\[/s);
    
    if (!headerMatch) {
      console.log("Could not find FeatureCollection header structure");
      throw new Error("Invalid file format");
    }
    
    console.log("Found valid FeatureCollection header");
    
    // Now extract features one by one using feature pattern matching
    const featureStart = Date.now();
    const features = await extractFeaturesFromFile(filePath, maxFeatures);
    console.log(`Extracted ${features.length} features in ${(Date.now() - featureStart)/1000} seconds`);
    
    result.features = features;
    result._totalFeatures = features.length;
    
    return result;
  } catch (err) {
    console.error("Error in segment processing:", err);
    throw err;
  }
}

/**
 * Extract features from a large file using a sliding window approach
 * FIXED version to prevent negative position values
 */
async function extractFeaturesFromFile(filePath, maxFeatures) {
  console.log("Extracting features using feature pattern matching");
  
  const features = [];
  const fileSize = fs.statSync(filePath).size;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB - reduced for better memory management
  let position = 0;
  let remainder = '';
  
  // Skip past the header to the features array
  // Read a larger header to make sure we get past all the metadata
  const smallHeaderBuffer = Buffer.alloc(10000); // 10KB header instead of 1KB
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, smallHeaderBuffer, 0, 10000, 0);
  fs.closeSync(fd);
  
  const headerText = smallHeaderBuffer.toString('utf8');
  const featuresArrayPos = headerText.indexOf('"features"');
  
  if (featuresArrayPos > 0) {
    // Find the opening bracket of the features array
    const featuresStart = headerText.indexOf('[', featuresArrayPos);
    if (featuresStart > 0) {
      // Start right at the opening bracket so we don't miss the first feature
      position = featuresStart;
      console.log(`Starting to read from position ${position} (features array start)`);
    } else {
      console.log(`Could not find features array opening bracket`);
    }
  } else {
    console.log(`Could not find features keyword in header`);
  }
  
  // Function to extract complete features from text
  const extractCompleteFeatures = (text) => {
    const extractedFeatures = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;
    
    // Log first 100 chars for debugging
    console.log(`Text starts with: ${text.substring(0, 100).replace(/\n/g, '\\n')}...`);
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Handle string literals
      if (char === '"' && !escape) {
        inString = !inString;
      }
      
      // Handle escape characters
      if (inString && char === '\\') {
        escape = !escape;
      } else {
        escape = false;
      }
      
      // Only process structural characters when not in a string
      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            start = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            // We have a complete object
            const featureText = text.substring(start, i + 1);
            try {
              const feature = JSON.parse(featureText);
              if (feature.type === 'Feature' && feature.properties && feature.geometry) {
                extractedFeatures.push(feature);
                // Log when we find a feature
                if (extractedFeatures.length % 10 === 0) {
                  console.log(`Found ${extractedFeatures.length} features so far...`);
                }
              }
            } catch (e) {
              console.log(`Failed to parse feature at position ${start}: ${e.message}`);
              // Skip invalid features
            }
            start = -1; // Reset start to mark we're looking for a new feature
          }
        }
      }
    }
    
    // For debugging
    console.log(`Extracted ${extractedFeatures.length} features from this chunk`);
    
    // Find position after the last complete feature that we extracted
    let lastFeatureEndPos = 0;
    
    if (extractedFeatures.length > 0) {
      // Simple approach: find the last closing brace of a feature
      // Scan backwards from the end to find the last complete feature's end
      let curlyCount = 0;
      for (let i = text.length - 1; i >= 0; i--) {
        const char = text[i];
        if (char === '}') {
          curlyCount++;
          if (curlyCount === 1) {
            // Found the end of a complete feature
            lastFeatureEndPos = i + 1;
            break;
          }
        } else if (char === '{') {
          curlyCount--;
        }
      }
      
      // If no proper end found, assume we need to keep all remaining text
      if (lastFeatureEndPos === 0) {
        console.log(`WARNING: Could not find end of last feature. Using conservative approach.`);
        // Don't advance position, keep all text as remainder
        lastFeatureEndPos = 0;
      } else {
        console.log(`Found last feature end at position ${lastFeatureEndPos} of chunk`);
      }
    }
      
    return {
      features: extractedFeatures,
      lastComplete: lastFeatureEndPos
    };
  };
  
  // Process the file in chunks with improved handling for large files
  let fileDescriptor = null;
  try {
    fileDescriptor = fs.openSync(filePath, 'r');
    
    // Track progress percentage for large files
    let lastProgressReport = 0;
    const reportProgressThreshold = 0.05; // Report every 5%
    
    while (position < fileSize && features.length < maxFeatures) {
      // Report progress for large files
      const progressPercentage = position / fileSize;
      if (progressPercentage - lastProgressReport >= reportProgressThreshold) {
        console.log(`Processing: ${Math.floor(progressPercentage * 100)}% complete (position: ${position}/${fileSize})`);
        lastProgressReport = progressPercentage;
      }
      
      const buffer = Buffer.alloc(CHUNK_SIZE);
      const bytesRead = fs.readSync(fileDescriptor, buffer, 0, CHUNK_SIZE, position);
      
      if (bytesRead === 0) {
        console.log("Reached end of file (0 bytes read)");
        break;
      }
      
      // Combine with any remainder from previous chunk
      const text = remainder + buffer.toString('utf8', 0, bytesRead);
      
      console.log(`Processing chunk at position ${position} (${bytesRead} bytes read, text length: ${text.length})`);
      
      // Extract complete features
      const { features: newFeatures, lastComplete } = extractCompleteFeatures(text);
      
      // Manage memory by limiting features array size
      if (newFeatures.length > 0) {
        features.push(...newFeatures);
        console.log(`Found ${newFeatures.length} features in chunk, total: ${features.length}`);
      } else {
        console.log(`No new features found in this chunk`);
      }
      
      // Calculate new position more carefully to avoid negative values and ensure progress
      if (lastComplete > 0) {
        // Found complete features, advance to after the last complete one
        const positionAdvance = Math.min(bytesRead, lastComplete); // Don't advance more than bytes read
        position += positionAdvance;
        remainder = text.substring(lastComplete); // Keep remaining text for next iteration
        console.log(`Advanced position by ${positionAdvance}, remainder length: ${remainder.length}`);
      } else {
        // If we didn't find any complete features:
        if (remainder.length > CHUNK_SIZE * 3) {
          // If remainder is getting too large, we might be stuck - move forward more aggressively
          console.log(`WARNING: Large remainder (${remainder.length} bytes) with no features found`);
          console.log(`First 100 chars of remainder: ${remainder.substring(0, 100).replace(/\n/g, '\\n')}...`);
          
          // Try to find next feature start
          const nextFeatureStart = remainder.indexOf('{"type":"Feature"', CHUNK_SIZE);
          if (nextFeatureStart > 0) {
            console.log(`Found next feature start at position ${nextFeatureStart} in remainder`);
            position += bytesRead;
            remainder = remainder.substring(nextFeatureStart);
          } else {
            // Move forward more aggressively
            const aggressive_advance = bytesRead * 0.75;
            position += aggressive_advance;
            remainder = text.substring(Math.max(text.length - CHUNK_SIZE, 0));
            console.log(`No feature start found, advanced aggressively by ${aggressive_advance}`);
          }
        } else {
          // Move forward cautiously with overlap
          const cautious_advance = Math.max(bytesRead / 2, 1024);  // At least 1KB
          position += cautious_advance;
          remainder = text.substring(Math.max(text.length - CHUNK_SIZE, 0));
          console.log(`No features found, cautiously advanced by ${cautious_advance}, remainder: ${remainder.length}`);
        }
      }
      
      // Check if we're making progress
      if (position >= fileSize) {
        console.log("Reached end of file");
        break;
      }
      
      // Stop if we've reached the maximum
      if (features.length >= maxFeatures) {
        console.log(`Reached maximum of ${maxFeatures} features`);
        break;
      }
      
      // Check for reasonable chunk size
      if (remainder.length > CHUNK_SIZE * 5) {
        console.log(`WARNING: Remainder getting very large (${remainder.length} bytes). Trimming to prevent memory issues.`);
        remainder = remainder.substring(remainder.length - CHUNK_SIZE * 2);
      }
    }
  } catch (err) {
    console.error("Error during chunk processing:", err);
    throw err;
  } finally {
    // Ensure file descriptor is closed
    if (fileDescriptor !== null) {
      fs.closeSync(fileDescriptor);
      console.log("File descriptor closed");
    }
  }
  
  return features.slice(0, maxFeatures);
}

/**
 * Process a file using chunked reading
 */
async function processWithChunks(filePath, maxFeatures) {
  console.log("Processing with chunked reading");
  
  const result = {
    type: 'FeatureCollection',
    features: [],
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4269" } },
    name: "California"
  };
  
  // Read the file in chunks
  const fileSize = fs.statSync(filePath).size;
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
  let content = '';
  
  // Read the first part to find the header
  let headerFound = false;
  let featuresStarted = false;
  let bracketDepth = 0;
  
  // Read first chunk to get header
  const headerBuffer = Buffer.alloc(CHUNK_SIZE);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, headerBuffer, 0, CHUNK_SIZE, 0);
  fs.closeSync(fd);
  
  const headerText = headerBuffer.toString('utf8');
  
  // Extract the header up to features array
  const headerMatch = headerText.match(/\{\s*"type"\s*:\s*"FeatureCollection".*?"features"\s*:\s*\[/s);
  if (headerMatch) {
    headerFound = true;
    content = headerMatch[0];
    featuresStarted = true;
  } else {
    // If we couldn't find the header, start from the beginning
    content = headerText;
  }
  
  // First, see if we can find a small number of complete features in the first chunk
  if (featuresStarted) {
    const features = [];
    let inFeature = false;
    let featureStart = 0;
    let depth = 1; // We're already inside the features array
    let inString = false;
    let escape = false;
    
    // Process the rest of the header text after the features array start
    const featuresArrayStart = content.indexOf('[', content.indexOf('"features"')) + 1;
    const remainingHeader = headerText.substring(featuresArrayStart);
    
    for (let i = 0; i < remainingHeader.length; i++) {
      const char = remainingHeader[i];
      
      // Handle string literals
      if (char === '"' && !escape) {
        inString = !inString;
      }
      
      // Handle escape characters
      if (inString && char === '\\') {
        escape = !escape;
      } else {
        escape = false;
      }
      
      // Only process structural characters when not in a string
      if (!inString) {
        if (char === '{') {
          if (!inFeature) {
            inFeature = true;
            featureStart = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 1 && inFeature) {
            // We have a complete feature
            const featureText = remainingHeader.substring(featureStart, i + 1);
            try {
              const feature = JSON.parse(featureText);
              if (feature.type === 'Feature' && feature.properties && feature.geometry) {
                features.push(feature);
                if (features.length >= maxFeatures) break;
              }
            } catch (e) {
              // Skip invalid features
            }
            inFeature = false;
          }
        }
      }
    }
    
    if (features.length > 0) {
      console.log(`Found ${features.length} complete features in first chunk`);
      result.features = features;
      result._totalFeatures = features.length;
      return result;
    }
  }
  
  // If we couldn't find features in the first chunk, fall back to processing the whole file
  console.log("Falling back to full file processing");
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      console.log(`Found ${data.features.length} features in full file`);
      result.features = data.features.slice(0, maxFeatures);
      result._totalFeatures = data.features.length;
      
      // Copy other properties
      if (data.crs) result.crs = data.crs;
      if (data.name) result.name = data.name;
      
      return result;
    }
  } catch (err) {
    console.error("Error in full file processing:", err);
    throw err;
  }
  
  // If we reach here, something went wrong
  throw new Error("Failed to extract features");
}

/**
 * Attempt to fix broken JSON by fixing common issues
 */
function fixBrokenJson(jsonString) {
  let fixed = jsonString;
  
  // Fix missing closing braces/brackets
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    fixed = fixed.trim() + '}';
  }
  
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    fixed = fixed.trim() + ']';
  }
  
  return fixed;
}

/**
 * Last resort approach for extremely large files - just find some sample features
 */
async function processGiantFileSimplified(filePath, maxFeatures) {
  console.log(`Using simplified approach for giant file (${filePath})`);
  
  const result = {
    type: 'FeatureCollection',
    features: [],
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4269" } },
    name: "California",
    _simplified: true
  };
  
  const fileSize = fs.statSync(filePath).size;
  const SAMPLE_SIZE = 2 * 1024 * 1024; // 2MB
  const features = [];
  
  // Take samples from different parts of the file
  const samplePoints = [
    0, // Start of file
    Math.floor(fileSize * 0.25), // 25% mark
    Math.floor(fileSize * 0.5),  // 50% mark
    Math.floor(fileSize * 0.75)  // 75% mark
  ];
  
  for (const startPos of samplePoints) {
    if (features.length >= maxFeatures) break;
    
    console.log(`Taking sample at position ${startPos} (${Math.round(startPos/fileSize*100)}% of file)`);
    
    try {
      const buffer = Buffer.alloc(SAMPLE_SIZE);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, SAMPLE_SIZE, startPos);
      fs.closeSync(fd);
      
      if (bytesRead === 0) continue;
      
      const text = buffer.toString('utf8', 0, bytesRead);
      
      // Find feature starts in this sample
      let pos = 0;
      while (pos < text.length) {
        const featureStart = text.indexOf('{"type":"Feature"', pos);
        if (featureStart === -1) break;
        
        // Try to find a complete feature
        let bracketCount = 0;
        let inString = false;
        let escape = false;
        let featureEnd = -1;
        
        for (let i = featureStart; i < text.length; i++) {
          const char = text[i];
          
          // Handle string literals
          if (char === '"' && !escape) {
            inString = !inString;
          }
          
          // Handle escape characters
          if (inString && char === '\\') {
            escape = !escape;
          } else {
            escape = false;
          }
          
          // Count brackets when not in string
          if (!inString) {
            if (char === '{') {
              bracketCount++;
            } else if (char === '}') {
              bracketCount--;
              if (bracketCount === 0) {
                featureEnd = i + 1;
                break;
              }
            }
          }
        }
        
        if (featureEnd !== -1) {
          try {
            const featureText = text.substring(featureStart, featureEnd);
            const feature = JSON.parse(featureText);
            
            if (feature.type === 'Feature' && feature.geometry) {
              features.push(feature);
              console.log(`Found feature at position ${startPos + featureStart}, total: ${features.length}`);
              
              if (features.length >= maxFeatures) break;
            }
          } catch (e) {
            console.log(`Error parsing feature at position ${startPos + featureStart}: ${e.message}`);
          }
        }
        
        // Move past this feature
        pos = featureEnd !== -1 ? featureEnd : featureStart + 20;
      }
    } catch (err) {
      console.error(`Error processing sample at position ${startPos}:`, err);
      // Continue with next sample
    }
  }
  
  console.log(`Simplified approach found ${features.length} sample features`);
  result.features = features;
  result._totalFeatures = features.length;
  result._note = "This is a sample of features from across the file";
  
  return result;
}

// Export the handler function
module.exports = {
  handleLargeGeoJSONFile
};