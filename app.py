from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import database as db
import face_utils

app = Flask(__name__)
CORS(app)

# Initialize database on startup
db.init_db()

# Create necessary directories
os.makedirs('data', exist_ok=True)
os.makedirs('uploads', exist_ok=True)

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all users"""
    users = db.get_all_users()
    return jsonify({"success": True, "users": users})

@app.route('/api/users', methods=['POST'])
def add_user():
    """Add a new user"""
    data = request.json
    
    name = data.get('name')
    education = data.get('education')
    iq = data.get('iq')
    
    if not name or not education or not iq:
        return jsonify({"success": False, "message": "All fields are required"}), 400
    
    try:
        user_id = db.add_user(name, education, int(iq))
        return jsonify({
            "success": True, 
            "message": "User added successfully",
            "user_id": user_id
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    try:
        db.delete_user(user_id)
        return jsonify({"success": True, "message": "User deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/capture', methods=['POST'])
def capture_image():
    """Capture and save a face image"""
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image provided"}), 400
    
    user_id = request.form.get('user_id')
    
    if not user_id:
        return jsonify({"success": False, "message": "User ID required"}), 400
    
    try:
        user_id = int(user_id)
        image_file = request.files['image']
        image_data = image_file.read()
        
        # Count existing images for this user
        image_count = face_utils.count_user_images(user_id)
        
        if image_count >= 200:
            return jsonify({
                "success": False, 
                "message": "Maximum 200 images reached for this user"
            }), 400
        
        # Save the face image
        result = face_utils.save_face_image(image_data, user_id, image_count + 1)
        
        if result['success']:
            new_count = image_count + 1
            return jsonify({
                "success": True,
                "message": result['message'],
                "image_count": new_count,
                "completed": new_count >= 200
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/train', methods=['POST'])
def train():
    """Train the classifier"""
    try:
        result = face_utils.train_classifier()
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/recognize', methods=['POST'])
def recognize():
    """Recognize a face"""
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image provided"}), 400
    
    try:
        image_file = request.files['image']
        image_data = image_file.read()
        
        result = face_utils.recognize_face(image_data)
        
        if result['success']:
            # Get user details for recognized faces
            faces = result['faces']
            for face in faces:
                if face['recognized']:
                    user = db.get_user(face['user_id'])
                    if user:
                        face['user_name'] = user['name']
                        face['user_education'] = user['education']
                        face['user_iq'] = user['iq']
            
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics"""
    try:
        users = db.get_all_users()
        total_users = len(users)
        
        # Count total images
        data_dir = 'data'
        total_images = 0
        if os.path.exists(data_dir):
            total_images = len([f for f in os.listdir(data_dir) if f.endswith('.jpg')])
        
        # Check if classifier exists
        classifier_trained = os.path.exists('classifier.xml')
        
        return jsonify({
            "success": True,
            "stats": {
                "total_users": total_users,
                "total_images": total_images,
                "classifier_trained": classifier_trained
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)