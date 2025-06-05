import cv2
from flask import Flask, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO
import base64
import threading
import time
import os
import numpy as np
from io import BytesIO
from datetime import datetime
import glob # For managing saved images

# --- Configuration ---
# Correctly determine the script directory and model path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "best.pt") # Assumes best.pt is in the same directory as main.py

TARGET_CLASS_NAME = "with_card"  # The class name for "without card" as defined in your model
WEBCAM_INDEX = 1  # 0 for default webcam, or update to path for a video file
CONFIDENCE_THRESHOLD = 0.5  # Minimum confidence for a detection to be considered valid

# Image Saving Configuration
SAVED_IMAGES_DIR_NAME = "saved_detections"
# Path relative to the backend script, pointing to frontend's public directory
SAVED_IMAGES_PATH = os.path.join(SCRIPT_DIR, "..", "idcard", "public", SAVED_IMAGES_DIR_NAME)
MAX_SAVED_IMAGES = 20

# --- Global Variables ---
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes, allowing frontend requests

latest_frame_with_detection_base64 = None # For the single image API
global_latest_processed_frame = None # For the video stream
frame_lock = threading.Lock() # Single lock for both frame types
model = None
camera_active = False
model_class_names = [] # To store class names from the model
saved_image_filenames = [] # List to keep track of saved image filenames (newest first)

# --- Helper Functions ---
def manage_saved_images(new_filename):
    """Manages the list of saved images, ensuring it doesn't exceed MAX_SAVED_IMAGES."""
    global saved_image_filenames
    
    # Add new image to the beginning of the list (newest first)
    saved_image_filenames.insert(0, new_filename)
    
    # If more images than allowed, remove the oldest ones
    while len(saved_image_filenames) > MAX_SAVED_IMAGES:
        oldest_filename = saved_image_filenames.pop() # Remove from the end (oldest)
        try:
            oldest_filepath = os.path.join(SAVED_IMAGES_PATH, oldest_filename)
            if os.path.exists(oldest_filepath):
                os.remove(oldest_filepath)
                print(f"Removed old image: {oldest_filename}")
        except Exception as e:
            print(f"Error removing old image {oldest_filename}: {e}")

def initial_load_saved_images():
    """Loads existing images from the save directory on startup."""
    global saved_image_filenames
    if not os.path.exists(SAVED_IMAGES_PATH):
        os.makedirs(SAVED_IMAGES_PATH, exist_ok=True)
        return

    # Get all jpg files, sort by modification time (newest first)
    try:
        files = glob.glob(os.path.join(SAVED_IMAGES_PATH, "*.jpg"))
        # Sort by modification time, newest first
        files.sort(key=os.path.getmtime, reverse=True)
        saved_image_filenames = [os.path.basename(f) for f in files]
        
        # Trim if more than max (e.g., if app was stopped and restarted with too many files)
        while len(saved_image_filenames) > MAX_SAVED_IMAGES:
            oldest_filename = saved_image_filenames.pop()
            # No need to delete file here, manage_saved_images will handle future deletions
            # This just syncs the list with the MAX_SAVED_IMAGES limit
        print(f"Initial scan: Found {len(saved_image_filenames)} existing saved images.")
    except Exception as e:
        print(f"Error during initial scan of saved images: {e}")


# --- Model Loading ---
def load_yolo_model():
    global model, model_class_names
    if not os.path.exists(MODEL_PATH):
        print(f"Error: Model file not found at {MODEL_PATH}")
        return False
    try:
        model = YOLO(MODEL_PATH)
        # Store model class names (handles different ultralytics versions)
        if hasattr(model, 'names') and isinstance(model.names, list): # Newer ultralytics
             model_class_names = model.names
        elif hasattr(model, 'names') and isinstance(model.names, dict): # Older ultralytics
            # Ensure class names are in order of class ID
            model_class_names = [model.names[i] for i in sorted(model.names.keys())]
        else:
            print("Warning: Could not automatically determine model class names structure.")
            # Fallback or error if names are crucial and not found
        
        print(f"YOLOv8 model loaded successfully from {MODEL_PATH}")
        print(f"Model class names available: {model_class_names}")
        if not model_class_names and TARGET_CLASS_NAME:
             print(f"Warning: Model class names could not be loaded, detection for '{TARGET_CLASS_NAME}' might fail.")
        return True
    except Exception as e:
        print(f"Error loading YOLOv8 model: {e}")
        return False

# --- Video Processing Thread ---
def video_processing_loop():
    global latest_frame_with_detection_base64, camera_active, global_latest_processed_frame

    if model is None:
        print("Model not loaded. Video processing cannot start.")
        return

    cap = cv2.VideoCapture(WEBCAM_INDEX)
    if not cap.isOpened():
        print(f"Error: Could not open webcam/video source index {WEBCAM_INDEX}")
        camera_active = False
        return

    print(f"Webcam/video source index {WEBCAM_INDEX} opened successfully.")
    camera_active = True

    target_class_id = -1
    if TARGET_CLASS_NAME and model_class_names:
        try:
            target_class_id = model_class_names.index(TARGET_CLASS_NAME)
            print(f"Targeting class '{TARGET_CLASS_NAME}' with ID: {target_class_id}")
        except ValueError:
            print(f"Error: Target class '{TARGET_CLASS_NAME}' not found in model names: {model_class_names}")
            cap.release()
            camera_active = False
            return
    elif TARGET_CLASS_NAME:
        print(f"Warning: Target class '{TARGET_CLASS_NAME}' specified, but model class names are not available for ID lookup.")
        # Proceeding without specific class ID filtering if names are not loaded. This might not be desired.

    while camera_active: # This loop will be controlled by the main thread or an external signal in a real app
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture frame. Attempting to reconnect or stopping.")
            # Basic retry or break logic
            cap.release()
            time.sleep(1) # Wait a bit before trying to reopen
            cap = cv2.VideoCapture(WEBCAM_INDEX)
            if not cap.isOpened():
                print("Failed to reopen camera. Stopping video processing.")
                break
            else:
                print("Camera reopened successfully.")
                continue # Try to read next frame

        # Perform inference
        results = model.predict(source=frame, verbose=False, conf=CONFIDENCE_THRESHOLD)
        
        detected_target_class_in_frame = False
        processed_frame = frame.copy()

        for result in results: # Iterating through results for the frame
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                
                current_class_name = ""
                if model_class_names and 0 <= cls_id < len(model_class_names):
                    current_class_name = model_class_names[cls_id]

                # Check if the detected class is our target
                if target_class_id != -1 and cls_id == target_class_id:
                    detected_target_class_in_frame = True
                    label = f"{current_class_name} {conf:.2f}"
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(processed_frame, (x1, y1), (x2, y2), (0, 0, 255), 2) # Red box
                    cv2.putText(processed_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    print(f"Detected '{TARGET_CLASS_NAME}' (ID: {cls_id}) with confidence {conf:.2f}")
                elif target_class_id == -1 and TARGET_CLASS_NAME: # Fallback if ID lookup failed but name is set
                     # This branch might be noisy if class names weren't loaded for ID mapping
                     pass


        # Update global frame for streaming
        with frame_lock:
            global_latest_processed_frame = processed_frame.copy()

            # Also update the base64 image if the target class was detected (for the other API endpoint)
            if detected_target_class_in_frame:
                try:
                    # Update base64 for API
                    is_success_b64, buffer_b64 = cv2.imencode('.jpg', processed_frame)
                    if is_success_b64:
                        latest_frame_with_detection_base64 = base64.b64encode(buffer_b64).decode('utf-8')
                    else:
                        print("Error: cv2.imencode for base64 failed.")

                    # Save image to file
                    if not os.path.exists(SAVED_IMAGES_PATH):
                        os.makedirs(SAVED_IMAGES_PATH, exist_ok=True)
                    
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3] # Milliseconds
                    filename = f"detection_{TARGET_CLASS_NAME.replace(' ', '_')}_{timestamp}.jpg"
                    save_path = os.path.join(SAVED_IMAGES_PATH, filename)
                    
                    is_success_save = cv2.imwrite(save_path, processed_frame)
                    if is_success_save:
                        print(f"Saved detected image: {filename}")
                        manage_saved_images(filename) # Add to list and manage old files
                    else:
                        print(f"Error: Failed to save image to {save_path}")

                except Exception as e:
                    print(f"Error processing/saving detected frame: {e}")
            # else:
                # Optionally clear latest_frame_with_detection_base64 if no target detected in this frame
                # latest_frame_with_detection_base64 = None


        # A small sleep can help reduce CPU, but might introduce slight delay.
        # For "very fast without any delay", this should be minimal or removed if CPU allows.
        time.sleep(0.01) # Adjust or remove as needed

    cap.release()
    camera_active = False
    print("Video processing thread stopped.")

# --- Video Streaming Generator ---
def generate_frames():
    global global_latest_processed_frame, camera_active
    while camera_active:
        with frame_lock:
            if global_latest_processed_frame is None:
                # If no frame is available yet, send a placeholder or wait
                # For simplicity, we'll just continue and wait for a frame
                # In a real app, you might send a "waiting for camera" image
                time.sleep(0.1) # Wait briefly if no frame
                continue
            
            frame_to_stream = global_latest_processed_frame.copy()

        if frame_to_stream is not None:
            ret, buffer = cv2.imencode('.jpg', frame_to_stream)
            if not ret:
                print("Error: cv2.imencode for streaming failed.")
                continue
            frame_bytes = buffer.tobytes()
            # Yield the frame in multipart format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            # If frame is None after lock, wait a bit
            time.sleep(0.01) # Small delay to prevent busy-waiting if frames are slow

# --- Flask API Endpoints ---
@app.route('/video_feed')
def video_feed():
    # Returns a streaming response
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/latest_detected_image', methods=['GET'])
def get_latest_detected_image():
    with frame_lock: # Use the unified lock
        frame_to_send = latest_frame_with_detection_base64
        # Optional: Clear frame after sending if it should be a one-time fetch per detection
        # latest_frame_with_detection_base64 = None
    
    if frame_to_send:
        return jsonify({"image_base64": frame_to_send})
    else:
        # Ensure TARGET_CLASS_NAME is used in the message if it's dynamic
        message = f"No '{TARGET_CLASS_NAME}' detection available for single image API."
        return jsonify({"image_base64": None, "message": message}), 404

@app.route('/api/status', methods=['GET'])
def get_status():
    with frame_lock: # Use the unified lock
        detection_available = latest_frame_with_detection_base64 is not None
    
    status_info = {
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
        "model_class_names_count": len(model_class_names) if model_class_names else 0,
        "camera_active": camera_active,
        "webcam_index": WEBCAM_INDEX,
        "target_class_name": TARGET_CLASS_NAME, # This will show "with_card" or "without_card" based on your setting
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "detection_available_single_api": detection_available # Renamed for clarity
    }
    return jsonify(status_info)

@app.route('/api/saved_images', methods=['GET'])
def get_saved_images():
    """Returns a list of currently saved image filenames, newest first."""
    with frame_lock: # Ensure thread safety if saved_image_filenames is modified elsewhere
        # Return a copy to avoid issues if the list is modified during iteration by another thread
        images_to_send = list(saved_image_filenames)
    return jsonify({"images": images_to_send, "base_url": f"/{SAVED_IMAGES_DIR_NAME}/"})


# --- Main Execution ---
if __name__ == '__main__':
    initial_load_saved_images() # Scan for existing images on startup
    if load_yolo_model():
        video_thread = threading.Thread(target=video_processing_loop, daemon=True)
        video_thread.start()
        
        print(f"Flask server starting on http://0.0.0.0:5000")
        print(f"Saved images will be stored in: {SAVED_IMAGES_PATH}")
        print(f"API Endpoints:")
        print(f"  GET /video_feed                      - Live video stream with detections.")
        print(f"  GET /api/latest_detected_image     - Fetches the latest frame if '{TARGET_CLASS_NAME}' was detected (for single image use).")
        print(f"  GET /api/status                      - Gets the current status of the server and detection.")
        print(f"  GET /api/saved_images                - Gets the list of saved detection images.")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True) # threaded=True can help with multiple requests
    else:
        print("Failed to load model. Flask server will not start.")