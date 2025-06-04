import React, { useState, useEffect, useRef } from 'react';


const BACKEND_API_URL = 'http://localhost:5000/api/latest_detected_image';
const POLLING_INTERVAL_MS = 100; // Fetch image every 2 seconds

function App() {
  const [detectedImage, setDetectedImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [backendStatus, setBackendStatus] = useState('Checking status...');
  const pollingIntervalRef = useRef(null);

  const fetchLatestImage = async () => {
    try {
      const response = await fetch(BACKEND_API_URL);
      if (!response.ok) {
        if (response.status === 404) {
          // This is expected if no new detection is available
          // console.log('No new "without_card" detection available.');
          // Optionally clear the image if you only want to show the *latest* new one
          // setDetectedImage(null); 
          setErrorMessage(''); // Clear previous errors
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return; // Don't proceed if not OK or 404
      }
      const data = await response.json();
      if (data.image_base64) {
        setDetectedImage(`data:image/jpeg;base64,${data.image_base64}`);
        setErrorMessage('');
        console.log('New image received from backend.');
      } else {
        // No image in the response, but request was successful (e.g. 200 OK with no image)
        // This case might not happen with the current backend which returns 404 if no image
        // setDetectedImage(null); 
      }
    } catch (error) {
      console.error("Failed to fetch image:", error);
      setErrorMessage('Failed to connect to the backend or fetch image. Is the backend server running?');
      // Consider stopping polling if there are persistent errors, or implement backoff
    }
  };

  const fetchBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      let statusMessage = `Backend: Model ${data.model_loaded ? 'Loaded' : 'Not Loaded'}, Camera ${data.camera_active ? 'Active' : 'Inactive'}.`;
      if (data.model_loaded && data.target_class_name) {
        statusMessage += ` Targeting: '${data.target_class_name}'.`;
      }
      if (!data.model_loaded || !data.camera_active) {
        statusMessage += " Please ensure the backend is running correctly.";
      }
      setBackendStatus(statusMessage);
    } catch (error) {
      console.error("Failed to fetch backend status:", error);
      setBackendStatus('Error fetching backend status. Ensure backend is running on port 5000.');
    }
  };

  useEffect(() => {
    // Fetch initial status
    fetchBackendStatus();
    // Fetch initial image
    fetchLatestImage();

    // Set up polling
    pollingIntervalRef.current = setInterval(() => {
      fetchLatestImage();
      fetchBackendStatus(); // Also periodically update status
    }, POLLING_INTERVAL_MS);

    // Clean up interval on component unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  return (
    <div className="App">
      <header className="App-header">
        <h1>ID Card Detection System</h1>
        <p className="status-message"><strong>Backend Status:</strong> {backendStatus}</p>
      </header>
      <main>
        {errorMessage && (
          <div className="error-message">
            <p>{errorMessage}</p>
          </div>
        )}
        {detectedImage ? (
          <div className="image-container">
            <h2>Detected Individual (Without Card):</h2>
            <img src={detectedImage} alt="Detected without card" style={{ maxWidth: '100%', height: 'auto', border: '2px solid red' }} />
          </div>
        ) : (
          <div className="no-detection-message">
            <p>No "without_card" detection to display currently. Waiting for backend...</p>
            <p>Ensure the backend server is running and the camera can see the target area.</p>
          </div>
        )}
      </main>
      <footer>
        <p>Polling for new detections every {POLLING_INTERVAL_MS / 1000} seconds.</p>
      </footer>
    </div>
  );
}

export default App;