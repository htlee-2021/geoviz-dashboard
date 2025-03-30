import React from 'react';
import { FireDashboardSystem } from './components';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>California Wildfire Dashboard</h1>
      </header>
      <main className="App-main">
        <FireDashboardSystem containerId="fire-dashboard-container" />
        <div id="fire-dashboard-container"></div>
      </main>
      <footer className="App-footer">
        <p>Data visualization powered by D3.js</p>
      </footer>
    </div>
  );
}

export default App;