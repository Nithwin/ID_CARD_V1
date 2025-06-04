import React, { useState, useEffect, useRef } from 'react';


import './App.css'; // Assuming you might have some global styles

const VIDEO_STREAM_URL = 'http://localhost:5000/video_feed';
const STATUS_API_URL = 'http://localhost:5000/api/status';
const STATUS_POLLING_INTERVAL_MS = 3000; // Fetch status every 3 seconds

function App() {
  const [errorMessage, setErrorMessage] = useState(''); // For status errors or general messages
  const [backendStatus, setBackendStatus] = useState('Checking backend status...');
  const statusPollingIntervalRef = useRef(null);
  const [isVideoStreamLoading, setIsVideoStreamLoading] = useState(true);


  const fetchBackendStatus = async () => {
    try {
      const response = await fetch(STATUS_API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      let statusMessage = `Backend: Model ${data.model_loaded ? 'Loaded' : 'Not Loaded'}, Camera ${data.camera_active ? 'Active' : 'Inactive'}.`;
      if (data.model_loaded && data.target_class_name) {
        statusMessage += ` Targeting class for specific alerts: '${data.target_class_name}'.`;
      }
      if (!data.model_loaded || !data.camera_active) {
        statusMessage += " Please ensure the backend is running correctly for the video stream.";
      }
      setBackendStatus(statusMessage);
      setErrorMessage(''); // Clear previous status errors
    } catch (error) {
      console.error("Failed to fetch backend status:", error);
      const errorMsg = 'Error fetching backend status. Is the backend server running on port 5000?';
      setBackendStatus(errorMsg);
      setErrorMessage(errorMsg); // Show error in main message area too
    }
  };

  useEffect(() => {
    // Fetch initial status
    fetchBackendStatus();

    // Set up polling for status
    statusPollingIntervalRef.current = setInterval(fetchBackendStatus, STATUS_POLLING_INTERVAL_MS);

    // Clean up interval on component unmount
    return () => {
      if (statusPollingIntervalRef.current) {
        clearInterval(statusPollingIntervalRef.current);
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  const handleImageLoad = () => {
    setIsVideoStreamLoading(false);
    setErrorMessage(''); // Clear loading/error messages once stream loads
  };

  const handleImageError = () => {
    setIsVideoStreamLoading(false);
    setErrorMessage('Video stream failed to load. Ensure the backend is running and accessible.');
    console.error('Error loading video stream.');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>ID Card Live Detection Feed</h1>
        <p className="status-message"><strong>Status:</strong> {backendStatus}</p>
      </header>
      <main>
        {errorMessage && !isVideoStreamLoading && ( // Show error only if not actively trying to load
          <div className="error-message">
            <p>{errorMessage}</p>
          </div>
        )}
        <div className="video-stream-container">
          {isVideoStreamLoading && <p>Loading video stream...</p>}
          <img
            src={VIDEO_STREAM_URL}
            alt="Live video feed from backend"
            style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ccc', display: isVideoStreamLoading ? 'none' : 'block' }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>
      </main>
      <footer>
        <p>Continuously streaming video from the backend. Status updates every {STATUS_POLLING_INTERVAL_MS / 1000} seconds.</p>
        <p>The stream will show detections based on the backend's YOLO model.</p>
      </footer>
    </div>
  );
}

export default App;