from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from google import genai
from google.genai import types
import os
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

def generate_response(user_message: str):
    """Generator function that yields chunks of AI response"""
    client = genai.Client(
        vertexai=True,
        api_key=os.environ.get("GOOGLE_CLOUD_API_KEY"),
    )
    
    model = "gemini-3-flash-preview"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=user_message)
            ]
        )
    ]
    
    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        seed=0,
        max_output_tokens=65535,
        safety_settings=[
            types.SafetySetting(
                category="HARM_CATEGORY_HATE_SPEECH",
                threshold="OFF"
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold="OFF"
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold="OFF"
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_HARASSMENT",
                threshold="OFF"
            )
        ],
        system_instruction=[types.Part.from_text(text="Your knowledge cutoff date is January 2025.")],
        thinking_config=types.ThinkingConfig(
            thinking_level="HIGH",
        ),
    )
    
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if chunk.text:
            yield chunk.text

@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint that returns streaming response"""
    try:
        data = request.json
        message = data.get('message', '')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        def generate():
            for chunk in generate_response(message):
                # Send each chunk as Server-Sent Events
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        
        return Response(generate(), mimetype='text/event-stream')
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/simple', methods=['POST'])
def chat_simple():
    """Simple chat endpoint that returns complete response"""
    try:
        data = request.json
        message = data.get('message', '')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Collect all chunks
        full_response = ""
        for chunk in generate_response(message):
            full_response += chunk
        
        return jsonify({'response': full_response})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    if not os.environ.get("GOOGLE_CLOUD_API_KEY"):
        print("Warning: GOOGLE_CLOUD_API_KEY environment variable not set")
    
    app.run(debug=True, port=5000)
