from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import threading

app = Flask(__name__)
CORS(app)

# Store processed annotations
processed_annotations = []

# Configuration - UPDATE THESE WITH YOUR ACTUAL URLS
SIGNALING_SERVER_URL = "http://192.168.1.9:3000"  # Your signaling server URL

@app.route('/activate', methods=['POST'])
def activate_module():
    """
    Endpoint to activate Module X with annotations
    Client sends annotations here to activate the module
    """
    data = request.json
    annotations = data.get('annotations', [])
    
    print(f"Module X activated with {len(annotations)} annotations")
    print(f"Annotations: {annotations}")
    
    # Store annotations for processing
    processed_annotations.extend(annotations)
    
    # Process annotations (your ML/CV logic here)
    # For demo, we'll trigger callback and send instructions
    def process_annotations():
        time.sleep(2)
        
        # Send callback to trigger 10s video recording
        try:
            callback_response = requests.post(
                f"{SIGNALING_SERVER_URL}/module_x_callback",
                json={
                    'status': 'ready_for_video',
                    'annotations_received': len(annotations)
                }
            )
            print(f"Callback sent: {callback_response.status_code}")
        except Exception as e:
            print(f"Error sending callback: {e}")
        
        # Send some instructions via webhook
        time.sleep(1)
        send_instruction("Processing your annotations...")
        
        time.sleep(3)
        send_instruction("Turn left at the intersection")
        
        time.sleep(5)
        send_instruction("Continue straight for 200 meters")
        
        time.sleep(5)
        send_instruction("Your destination is ahead on the right")
    
    # Start processing in background thread
    thread = threading.Thread(target=process_annotations)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'status': 'activated',
        'annotations_received': len(annotations),
        'message': 'Module X is processing your request'
    }), 200

@app.route('/image', methods=['POST'])
def receive_image():
    """
    Endpoint to receive image frame from client
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    image_file = request.files['image']
    timestamp = request.form.get('timestamp')
    
    # Save image file
    filename = f"frame_{int(time.time())}.jpg"
    image_file.save(f"images/{filename}")
    
    print(f"Received image: {filename} at {timestamp}")
    
    # Process image (your ML/CV logic here)
    # For demo, we'll send some instructions based on "processing"
    def process_image():
        time.sleep(2)
        send_instruction("Image received - analyzing scene...")
        
        time.sleep(3)
        send_instruction("Detected object in view")
        
        time.sleep(4)
        send_instruction("Analysis complete - proceeding with navigation")
    
    thread = threading.Thread(target=process_image)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'status': 'received',
        'filename': filename,
        'message': 'Image processing started'
    }), 200

@app.route('/video', methods=['POST'])
def receive_video():
    """
    Endpoint to receive video from client (deprecated - using images now)
    """
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400
    
    video_file = request.files['video']
    timestamp = request.form.get('timestamp')
    
    # Save video file
    filename = f"recording_{int(time.time())}.webm"
    video_file.save(f"videos/{filename}")
    
    print(f"Received video: {filename} at {timestamp}")
    
    return jsonify({
        'status': 'received',
        'filename': filename,
        'message': 'Video received'
    }), 200

@app.route('/ack', methods=['POST'])
def receive_acknowledgment():
    """
    Endpoint to receive acknowledgment from client
    """
    data = request.json
    goal_id = data.get('goal_id')
    ack = data.get('ack')
    
    print(f"Received acknowledgment: {goal_id} - {ack}")
    
    # Send confirmation instruction
    send_instruction("Acknowledgment received - continuing navigation")
    
    return jsonify({
        'status': 'acknowledged',
        'goal_id': goal_id
    }), 200

def send_instruction(text):
    """Helper function to send instruction via webhook"""
    try:
        response = requests.post(
            f"{SIGNALING_SERVER_URL}/module_x_instruction",
            json={'instruction': text}
        )
        print(f"Instruction sent: {text} - Status: {response.status_code}")
    except Exception as e:
        print(f"Error sending instruction: {e}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'annotations_processed': len(processed_annotations)
    }), 200

if __name__ == '__main__':
    import os
    # Create directories if they don't exist
    os.makedirs('videos', exist_ok=True)
    os.makedirs('images', exist_ok=True)
    
    # Run on all interfaces, port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
