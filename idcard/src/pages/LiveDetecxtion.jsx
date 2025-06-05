import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom'; // Import Link

const VIDEO_STREAM_URL = 'http://localhost:5000/video_feed';
const STATUS_API_URL = 'http://localhost:5000/api/status';
const STATUS_POLLING_INTERVAL_MS = 3000; // Fetch status every 3 seconds

function LiveDetection() {
  const [errorMessage, setErrorMessage] = useState('');
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
        statusMessage += ` Targeting class: '${data.target_class_name}'.`;
      }
      if (!data.model_loaded || !data.camera_active) {
        statusMessage += " Ensure backend is running correctly.";
      }
      setBackendStatus(statusMessage);
      setErrorMessage('');
    } catch (error) {
      console.error("Failed to fetch backend status:", error);
      const errorMsg = 'Error fetching backend status. Is the backend running?';
      setBackendStatus(errorMsg);
      setErrorMessage(errorMsg);
    }
  };

  useEffect(() => {
    fetchBackendStatus();
    statusPollingIntervalRef.current = setInterval(fetchBackendStatus, STATUS_POLLING_INTERVAL_MS);
    return () => {
      clearInterval(statusPollingIntervalRef.current);
    };
  }, []);

  const handleImageLoad = () => {
    setIsVideoStreamLoading(false);
    setErrorMessage('');
  };

  const handleImageError = () => {
    setIsVideoStreamLoading(false);
    setErrorMessage('Video stream failed to load. Ensure backend is running.');
    console.error('Error loading video stream.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 to-blue-800 text-white py-6">
      <header className="container mx-auto px-4 mb-8">
        <h1 className="text-3xl font-bold text-center mb-4 animate-pulse">
          <span className="block">ID Card</span>
          <span className="block text-blue-400">Live Detection Feed</span>
        </h1>
        <p className="text-center text-gray-300">
          Continuously streaming video with detections from the backend.
        </p>
        <p className="text-center text-gray-400 mt-2">
          Status updates every {STATUS_POLLING_INTERVAL_MS / 1000} seconds.
        </p>
        <div className="mt-4 p-3 rounded-md bg-gray-900 bg-opacity-50 border border-gray-700">
          <p className="font-semibold">Status:</p>
          <p className={errorMessage ? "text-red-500" : "text-green-400"}>{backendStatus}</p>
        </div>
        <div className="text-center mt-6">
          <Link
            to="/saved-images"
            className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
          >
            View Saved Detections
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 flex justify-center items-center">
        <div className="relative rounded-xl shadow-2xl overflow-hidden w-full max-w-2xl"> {/* Make video responsive */}
          {/* Animated Loading Indicator */}
          {isVideoStreamLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 z-10"> {/* Ensure loading indicator is on top */}
              <div className="lds-ring"><div></div><div></div><div></div><div></div></div>
            </div>
          )}

          {/* Error Message Overlay */}
          {errorMessage && !isVideoStreamLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-700 bg-opacity-80 text-white text-xl font-bold p-4 text-center z-10"> {/* Ensure error message is on top */}
              {errorMessage}
            </div>
          )}

          {/* Video Stream */}
          <img
            src={VIDEO_STREAM_URL}
            alt="Live video feed from backend"
            className={`block w-full h-auto object-cover transition-opacity duration-500 ${isVideoStreamLoading ? 'opacity-0' : 'opacity-100'}`} /* Responsive image and cover */
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>
      </main>

      <footer className="container mx-auto px-4 mt-8 text-center text-gray-400">
        <p>The stream will show detections based on the backend's YOLO model.</p>
      </footer>
    </div>
  );
}

export default LiveDetection;