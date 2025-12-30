from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import ListSortOrder

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Check if variables loaded
if not os.getenv("AZURE_CLIENT_SECRET"):
    print("Error: Could not find .env file or AZURE_CLIENT_SECRET is missing.")
    exit()

# Initialize the client using variables from .env
project = AIProjectClient(
    credential=DefaultAzureCredential(),
    endpoint=os.getenv("AZURE_PROJECT_ENDPOINT")
)

# Get the agent using the variable from .env
agent_id = os.getenv("AZURE_AGENT_ID")
agent = project.agents.get_agent(agent_id)

@app.route('/activate', methods=['POST'])
def activate():
    try:
        # Get content from request body
        data = request.json
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        # Create thread
        thread = project.agents.threads.create()
        print(f"Created thread, ID: {thread.id}")
        
        # Create message with content from request
        message = project.agents.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"your goal is {content}"
        )
        
        # Run agent
        run = project.agents.runs.create_and_process(
            thread_id=thread.id,
            agent_id=agent.id
        )
        
        if run.status == "failed":
            print(f"Run failed: {run.last_error}")
            return jsonify({'error': f'Run failed: {run.last_error}'}), 500
        else:
            messages = project.agents.messages.list(
                thread_id=thread.id, 
                order=ListSortOrder.ASCENDING
            )
            
            # Extract response
            response_text = ""
            for message in messages:
                if message.text_messages:
                    print(f"{message.role}: {message.text_messages[-1].text.value}")
                    if message.role == "assistant":
                        response_text = message.text_messages[-1].text.value
            
            return jsonify({
                'response': response_text,
                'thread_id': thread.id
            })
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
