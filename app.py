from flask import Flask, render_template, request, jsonify, session
from flask_session import Session
import openai
import os

app = Flask(__name__)

# Session configuration
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

openai.api_key = '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'
app.secret_key = 'supersecretkey'


# Home route
@app.route('/')
def home():
    return render_template('index.html')


# Chat route - handles the conversation with the LLM
@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    posture_status = request.json['postureStatus']
    if 'conversation' not in session:
        session['conversation'] = []

    # Append the user's message to the conversation
    session['conversation'].append({"role": "user", "content": user_message})

    # Read the initial prompt from the file
    text_file_path = 'topic_prompts/initial_prompt.txt'
    if not os.path.exists(text_file_path):
        return jsonify({'response': 'Initial prompt file not found.'})

    with open(text_file_path, 'r') as file:
        initial_prompt = file.read()

    system_message = f"""
    You are an AI assistant that helps people improve their posture.
    The user's current posture is: {posture_status}.
    Based on this posture, give friendly advice or feedback.
    """
    
    # The messages structure for the API call
    messages = [{
        "role": "system",
        "content": initial_prompt
    }, {
        "role": "system",
        "content": system_message
    }] + session['conversation']

    try:
        # Make API call to OpenAI using the messages
        response = openai.chat.completions.create(model="gpt-3.5-turbo-1106",
                                                  messages=messages)
        # Extract the content from the response
        gpt_response = response.choices[0].message.content

        # Append the GPT response to the conversation history
        session['conversation'].append({
            "role": "assistant",
            "content": gpt_response
        })

        # Return the GPT response
        return jsonify({'response': gpt_response})
    except Exception as e:
        # Log the error and return a message
        app.logger.error(f"An error occurred: {e}")
        return jsonify({'error': str(e)}), 500


# Clear session route
@app.route('/clear_session', methods=['GET'])
def clear_session():
    # Clear the session
    session.clear()
    return jsonify({'status': 'session cleared'})

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']

    try:
        transcript = openai.Audio.transcribe("whisper-1", audio_file)
        return jsonify({'transcript': transcript['text']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080)
