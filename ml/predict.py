import sys
import json
import joblib
import os

try:
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'difficulty_predictor.pkl')
    
    # Check if model file exists
    if not os.path.exists(model_path):
        print(json.dumps({"error": "Model file not found. Please run train_model.py first."}))
        sys.exit(1)
    
    # Load the model
    model = joblib.load(model_path)
    label_map = {0: 'Easy', 1: 'Medium', 2: 'Hard'}
    
    # Get input from JS via command line argument
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input data provided"}))
        sys.exit(1)
        
    user_input = json.loads(sys.argv[1])
    score = user_input.get('score')
    time_taken = user_input.get('time_taken')
    
    # Validate input
    if score is None or time_taken is None:
        print(json.dumps({"error": "Missing score or time_taken in input"}))
        sys.exit(1)
        
    if not isinstance(score, (int, float)) or not isinstance(time_taken, (int, float)):
        print(json.dumps({"error": "Score and time_taken must be numbers"}))
        sys.exit(1)
        
    # Make prediction
    prediction = model.predict([[score, time_taken]])[0]
    predicted_difficulty = label_map[prediction]
    
    # Get prediction probabilities for confidence
    try:
        probabilities = model.predict_proba([[score, time_taken]])[0]
        confidence = round(max(probabilities) * 100, 2)
    except:
        # Fallback if predict_proba is not available
        confidence = 75.0
    
    # Calculate additional metrics
    performance_ratio = score / max(1, time_taken / 60)
    
    result = {
        'success': True,
        'predicted_difficulty': predicted_difficulty,
        'confidence': confidence,
        'model_prediction': int(prediction),
        'performance_ratio': round(performance_ratio, 2)
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        'success': False,
        'error': str(e),
        'type': 'prediction_error'
    }
    print(json.dumps(error_result))
    sys.exit(1)