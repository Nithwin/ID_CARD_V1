import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const SAVED_IMAGES_API_URL = 'http://localhost:5000/api/saved_images';

function SavedImagesPage() {
  const [savedImages, setSavedImages] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [imageBaseUrl, setImageBaseUrl] = useState('');

  useEffect(() => {
    const fetchSavedImages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(SAVED_IMAGES_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSavedImages(data.images || []);
        setImageBaseUrl(data.base_url || '/'); // Default to root if not provided
        setErrorMessage('');
      } catch (error) {
        console.error("Failed to fetch saved images:", error);
        setErrorMessage('Failed to load saved images. Is the backend running?');
        setSavedImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedImages();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white py-6">
      <header className="container mx-auto px-4 mb-8">
        <h1 className="text-3xl font-bold text-center mb-4 text-teal-400 animate-fade-in-down">
          Saved Detections
        </h1>
        <p className="text-center text-gray-400">
          Showing the latest {savedImages.length} saved images with '{/* Consider dynamically getting target class name here if needed */}' detections.
        </p>
        <div className="text-center mt-4">
          <Link 
            to="/detect" 
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
          >
            Back to Live Detection
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4">
        {isLoading && (
          <div className="text-center py-10">
            <div className="lds-ring"><div></div><div></div><div></div><div></div></div>
            <p className="mt-2 text-lg">Loading saved images...</p>
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="text-center py-10 bg-red-700 bg-opacity-80 text-white text-xl font-bold p-4 rounded-md">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && savedImages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-xl text-gray-500">No images have been saved yet.</p>
            <p className="text-gray-400">Detections from the live feed will be saved here automatically.</p>
          </div>
        )}

        {!isLoading && !errorMessage && savedImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {savedImages.map((imageName) => (
              <div 
                key={imageName} 
                className="bg-gray-700 rounded-lg shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <img
                  src={`${imageBaseUrl.startsWith('/') ? '' : '/'}${imageBaseUrl}${imageName}`}
                  alt={`Detected: ${imageName}`}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.target.onerror = null; 
                    e.target.alt = "Image not found";
                    // Optionally, set a placeholder image: e.target.src="/path/to/placeholder.png";
                    console.warn(`Failed to load image: ${imageBaseUrl}${imageName}`);
                  }}
                />
                <div className="p-3">
                  <p className="text-xs text-gray-400 truncate" title={imageName}>{imageName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="container mx-auto px-4 mt-12 text-center text-gray-500">
        <p>Images are automatically managed, keeping the latest detections.</p>
      </footer>
    </div>
  );
}

export default SavedImagesPage;