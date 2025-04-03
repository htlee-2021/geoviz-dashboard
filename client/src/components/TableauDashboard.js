import React, { useEffect, useRef, useState } from 'react';
import './FireDashboard.css';

const TableauDashboard = ({
  title = 'California Wildfire Dashboard Overview',
  description = 'Interactive visualization showing wildfire trends, causes, and geographical distribution across California.'
}) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    // This effect initializes the Tableau visualization
    if (!containerRef.current) return;
    
    // Clear container first
    containerRef.current.innerHTML = '';
    setDebugInfo({status: 'Starting initialization...'});
    
    const init = async () => {
      try {
        // Add a simple visible element to confirm container is working
        const debugElement = document.createElement('div');
        debugElement.style.padding = '10px';
        debugElement.style.borderBottom = '1px solid #ccc';
        debugElement.style.backgroundColor = '#f0f0f0';
        debugElement.style.color = '#333';
        debugElement.style.marginBottom = '10px';
        debugElement.innerHTML = 'Initializing Tableau visualization...';
        containerRef.current.appendChild(debugElement);
        
        setDebugInfo(prev => ({...prev, containerId: containerRef.current.id}));
        
        // Create the placeholder div
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'tableauPlaceholder';
        placeholderDiv.id = 'wildfire-tableau-viz';
        placeholderDiv.style.position = 'relative';
        placeholderDiv.style.border = '2px dashed #999'; // Visual indicator
        placeholderDiv.style.minHeight = '400px';
        placeholderDiv.style.width = '100%';
        placeholderDiv.style.backgroundColor = '#f9f9f9';
        
        setDebugInfo(prev => ({...prev, placeholderId: placeholderDiv.id}));
        
        // Create object element
        const vizObject = document.createElement('object');
        vizObject.className = 'tableauViz';
        vizObject.style.display = 'block'; // Changed from 'none' to 'block'
        vizObject.style.width = '100%';
        vizObject.style.height = '827px';
        
        // Add parameters
        const params = [
          { name: 'host_url', value: 'https%3A%2F%2Fpublic.tableau.com%2F' },
          { name: 'embed_code_version', value: '3' },
          { name: 'site_root', value: '' },
          { name: 'name', value: 'DataConsolidation_FinalDraft_2/WildFireDashboardOverview' },
          { name: 'tabs', value: 'no' },
          { name: 'toolbar', value: 'yes' },
          { name: 'static_image', value: 'https://public.tableau.com/static/images/Da/DataConsolidation_FinalDraft_2/WildFireDashboardOverview/1.png' },
          { name: 'animate_transition', value: 'yes' },
          { name: 'display_static_image', value: 'yes' },
          { name: 'display_spinner', value: 'yes' },
          { name: 'display_overlay', value: 'yes' },
          { name: 'display_count', value: 'yes' },
          { name: 'language', value: 'en-US' },
          { name: 'filter', value: 'publish=yes' }
        ];
        
        params.forEach(param => {
          const paramElement = document.createElement('param');
          paramElement.name = param.name;
          paramElement.value = param.value;
          vizObject.appendChild(paramElement);
        });
        
        placeholderDiv.appendChild(vizObject);
        containerRef.current.appendChild(placeholderDiv);
        
        // Update debug message
        debugElement.innerHTML = 'Loading Tableau API...';
        setDebugInfo(prev => ({...prev, step: 'API script creation'}));
        
        // Create the script element
        const scriptElement = document.createElement('script');
        scriptElement.src = 'https://public.tableau.com/javascripts/api/viz_v1.js';
        scriptElement.async = true;
        
        // This is a simpler approach - inject script and let it handle the viz
        scriptElement.onload = () => {
          debugElement.innerHTML = 'Tableau API loaded successfully!';
          setDebugInfo(prev => ({...prev, apiLoaded: true}));
          
          // Give it a moment to initialize
          setTimeout(() => {
            setLoading(false);
            debugElement.innerHTML = 'Tableau visualization should now be visible below:';
          }, 2000);
        };
        
        scriptElement.onerror = (err) => {
          debugElement.innerHTML = 'Error loading Tableau API!';
          setDebugInfo(prev => ({...prev, apiError: true, error: err}));
          setError('Failed to load Tableau visualization API. Please check your internet connection and try again.');
          setLoading(false);
        };
        
        // Add the script to the document
        document.body.appendChild(scriptElement);
        
      } catch (err) {
        console.error('Error initializing Tableau:', err);
        setDebugInfo(prev => ({...prev, error: err.message}));
        setError('Error initializing visualization: ' + err.message);
        setLoading(false);
      }
    };
    
    init();
    
    // Cleanup function
    return () => {
      // Remove any scripts we added to the body
      const scripts = document.querySelectorAll('script[src*="tableau"]');
      scripts.forEach(script => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      });
    };
  }, []);

  // Check if Tableau API is being blocked
  useEffect(() => {
    const checkTableauAPIAccess = async () => {
      try {
        const response = await fetch('https://public.tableau.com/javascripts/api/viz_v1.js', {
          method: 'HEAD',
          mode: 'no-cors' // This allows us to at least try the request
        });
        setDebugInfo(prev => ({...prev, apiAccessible: 'Attempted'}));
      } catch (err) {
        setDebugInfo(prev => ({...prev, apiAccessible: 'Error', apiAccessError: err.message}));
      }
    };
    
    checkTableauAPIAccess();
  }, []);

  const forceRefresh = () => {
    // Force a complete refresh
    setLoading(true);
    setError(null);
    
    // Clear the container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    // Force React to run the effect again
    const temp = containerRef.current;
    containerRef.current = null;
    setTimeout(() => {
      containerRef.current = temp;
      // Reload the page - sometimes needed for Tableau
      window.location.reload();
    }, 100);
  };

  return (
    <div className="chart-container">
      <h3 className="section-title">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {title}
      </h3>
      <div className="chart-description">
        {description}
      </div>
      
      <div className="tableau-container" style={{ position: 'relative', minHeight: '827px' }}>
        {loading && !error && (
          <div className="loading-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100px', zIndex: 5 }}>
            <div className="loading-spinner">
              <div className="spinner"></div>
              <div className="loading-text">Loading visualization...</div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="error-title">Visualization Error</h3>
                <div className="error-details">
                  <p>{error}</p>
                  <p style={{ marginTop: '10px', fontStyle: 'italic' }}>
                    This might happen if your browser is blocking access to Tableau Public
                    or if your internet connection is interrupted.
                  </p>
                </div>
                <button 
                  className="refresh-button" 
                  style={{ marginTop: '10px' }}
                  onClick={forceRefresh}
                >
                  Refresh Visualization
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div 
          ref={containerRef} 
          id="tableau-dashboard-container"
          style={{ 
            width: '100%', 
            minHeight: '827px',
            display: error ? 'none' : 'block',
            position: 'relative'
          }}
        ></div>
      </div>
      
      {/* Debug Information */}
      <details style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>Visualization Troubleshooting</summary>
        <div style={{ padding: '10px' }}>
          <p>If you cannot see the visualization above, try these steps:</p>
          <ol style={{ marginLeft: '20px' }}>
            <li>Check if you have an active internet connection</li>
            <li>Ensure your browser is not blocking content from public.tableau.com</li>
            <li>Try refreshing the page</li>
            <li>Check browser console for any errors</li>
          </ol>
          <button 
            className="refresh-button" 
            style={{ marginTop: '10px' }}
            onClick={forceRefresh}
          >
            Force Refresh
          </button>
          <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
            <strong>Debug Info:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '5px' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
};

export default TableauDashboard;