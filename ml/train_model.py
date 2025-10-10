import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import numpy as np
import os

def create_training_data():
    """Create comprehensive training data with realistic patterns"""
    np.random.seed(42)  # For reproducible results
    
    data = []
    
    # Easy difficulty patterns (low performance)
    # Pattern 1: Low score, high time
    for _ in range(30):
        score = np.random.randint(20, 50)
        time_taken = np.random.randint(700, 1200)
        data.append([score, time_taken, 'Easy'])
    
    # Pattern 2: Moderate score, very high time
    for _ in range(20):
        score = np.random.randint(50, 70)
        time_taken = np.random.randint(900, 1500)
        data.append([score, time_taken, 'Easy'])
    
    # Medium difficulty patterns (moderate performance)
    # Pattern 1: Good score, moderate time
    for _ in range(35):
        score = np.random.randint(60, 80)
        time_taken = np.random.randint(400, 700)
        data.append([score, time_taken, 'Medium'])
    
    # Pattern 2: Average score, average time
    for _ in range(25):
        score = np.random.randint(55, 75)
        time_taken = np.random.randint(500, 800)
        data.append([score, time_taken, 'Medium'])
    
    # Hard difficulty patterns (high performance)
    # Pattern 1: High score, low time
    for _ in range(25):
        score = np.random.randint(80, 95)
        time_taken = np.random.randint(180, 350)
        data.append([score, time_taken, 'Hard'])
    
    # Pattern 2: Very high score, moderate time
    for _ in range(20):
        score = np.random.randint(85, 100)
        time_taken = np.random.randint(300, 500)
        data.append([score, time_taken, 'Hard'])
    
    # Add some edge cases for better model robustness
    edge_cases = [
        [100, 120, 'Hard'],    # Perfect score, very fast
        [95, 180, 'Hard'],     # Near perfect, fast
        [15, 1800, 'Easy'],    # Very low score, very slow
        [25, 1500, 'Easy'],    # Low score, slow
        [70, 600, 'Medium'],   # Exactly medium
        [75, 400, 'Medium'],   # Good score, decent time
    ]
    
    data.extend(edge_cases)
    
    return pd.DataFrame(data, columns=['score', 'time_taken', 'difficulty'])

def main():
    print("🚀 Starting ML model training...")
    
    # Create training data
    print("📊 Generating training data...")
    data = create_training_data()
    
    # Display data info
    print(f"Total samples: {len(data)}")
    print(f"Difficulty distribution:")
    print(data['difficulty'].value_counts())
    
    # Convert labels to numeric
    label_map = {'Easy': 0, 'Medium': 1, 'Hard': 2}
    data['difficulty_numeric'] = data['difficulty'].map(label_map)
    
    # Prepare features and target
    X = data[['score', 'time_taken']]
    y = data['difficulty_numeric']
    
    # Split for validation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"Training samples: {len(X_train)}")
    print(f"Testing samples: {len(X_test)}")
    
    # Train the model with better parameters
    print("🤖 Training Decision Tree model...")
    model = DecisionTreeClassifier(
        random_state=42,
        max_depth=8,           # Prevent overfitting
        min_samples_split=5,   # Minimum samples to split
        min_samples_leaf=3,    # Minimum samples in leaf
        class_weight='balanced' # Handle class imbalance
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate the model
    print("📈 Evaluating model performance...")
    train_accuracy = accuracy_score(y_train, model.predict(X_train))
    test_accuracy = accuracy_score(y_test, model.predict(X_test))
    
    print(f"Training accuracy: {train_accuracy:.3f}")
    print(f"Testing accuracy: {test_accuracy:.3f}")
    
    # Detailed classification report
    y_pred = model.predict(X_test)
    print("\n📋 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['Easy', 'Medium', 'Hard']))
    
    # Feature importance
    print("🎯 Feature Importance:")
    feature_names = ['score', 'time_taken']
    for i, importance in enumerate(model.feature_importances_):
        print(f"  {feature_names[i]}: {importance:.3f}")
    
    # Save the model
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'difficulty_predictor.pkl')
    
    joblib.dump(model, model_path)
    print(f"\n✅ Model trained and saved as {model_path}")
    
    # Test with sample predictions
    print("\n🧪 Testing with sample data:")
    test_cases = [
        [90, 200, "Expected: Hard"],
        [45, 800, "Expected: Easy"],
        [70, 500, "Expected: Medium"],
        [95, 150, "Expected: Hard"],
        [30, 1200, "Expected: Easy"]
    ]
    
    reverse_label_map = {0: 'Easy', 1: 'Medium', 2: 'Hard'}
    
    for score, time_taken, expected in test_cases:
        prediction = model.predict([[score, time_taken]])[0]
        predicted_label = reverse_label_map[prediction]
        try:
            confidence = max(model.predict_proba([[score, time_taken]])[0]) * 100
            print(f"  Score: {score}, Time: {time_taken}s → {predicted_label} ({confidence:.1f}% confidence) | {expected}")
        except:
            print(f"  Score: {score}, Time: {time_taken}s → {predicted_label} | {expected}")

if __name__ == "__main__":
    main()