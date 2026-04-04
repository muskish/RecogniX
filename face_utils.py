import cv2
import os
import numpy as np
from PIL import Image

def train_classifier():
    """Train the face recognition classifier"""
    data_dir = "data"
    
    if not os.path.exists(data_dir):
        return {"success": False, "message": "Data directory not found"}
    
    # Get all image files
    image_files = [f for f in os.listdir(data_dir) if f.endswith('.jpg')]
    
    if len(image_files) == 0:
        return {"success": False, "message": "No training images found"}
    
    faces = []
    ids = []
    
    for image_file in image_files:
        try:
            image_path = os.path.join(data_dir, image_file)
            img = Image.open(image_path).convert('L')
            image_np = np.array(img, 'uint8')
            
            # Extract ID from filename: user.ID.NUMBER.jpg
            user_id = int(image_file.split(".")[1])
            
            faces.append(image_np)
            ids.append(user_id)
        except Exception as e:
            print(f"Error processing {image_file}: {e}")
            continue
    
    if len(faces) == 0:
        return {"success": False, "message": "No valid faces found"}
    
    ids = np.array(ids)
    
    # Train the classifier
    clf = cv2.face.LBPHFaceRecognizer_create()
    clf.train(faces, ids)
    clf.write("classifier.xml")
    
    return {
        "success": True, 
        "message": f"Training completed! Trained on {len(faces)} images from {len(set(ids))} users"
    }

def recognize_face(image_data):
    """Recognize face from image data"""
    if not os.path.exists("classifier.xml"):
        return {"success": False, "message": "Classifier not trained yet"}
    
    try:
        # Load classifier
        clf = cv2.face.LBPHFaceRecognizer_create()
        clf.read("classifier.xml")
        
        # Load face cascade
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Convert image data to numpy array
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return {"success": False, "message": "No face detected"}
        
        results = []
        
        for (x, y, w, h) in faces:
            # Predict
            user_id, confidence = clf.predict(gray[y:y+h, x:x+w])
            confidence_score = int(100 * (1 - confidence/300))
            
            if confidence_score > 77:
                results.append({
                    "user_id": int(user_id),
                    "confidence": confidence_score,
                    "recognized": True
                })
            else:
                results.append({
                    "user_id": None,
                    "confidence": confidence_score,
                    "recognized": False
                })
        
        return {"success": True, "faces": results}
        
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def save_face_image(image_data, user_id, image_number):
    """Save a face image for training"""
    data_dir = "data"
    
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    try:
        # Load face cascade
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Convert image data to numpy array
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return {"success": False, "message": "No face detected"}
        
        # Get the first face
        (x, y, w, h) = faces[0]
        cropped_face = gray[y:y+h, x:x+w]
        
        # Resize to 200x200
        face_resized = cv2.resize(cropped_face, (200, 200))
        
        # Save image
        filename = f"user.{user_id}.{image_number}.jpg"
        filepath = os.path.join(data_dir, filename)
        cv2.imwrite(filepath, face_resized)
        
        return {"success": True, "message": "Face saved successfully"}
        
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def count_user_images(user_id):
    """Count how many images exist for a user"""
    data_dir = "data"
    
    if not os.path.exists(data_dir):
        return 0
    
    count = 0
    for filename in os.listdir(data_dir):
        if filename.startswith(f"user.{user_id}.") and filename.endswith(".jpg"):
            count += 1
    
    return count