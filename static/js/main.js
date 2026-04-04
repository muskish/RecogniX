// Global variables
let video = null;
let canvas = null;
let currentStream = null;
let captureCount = 0;
let currentUserId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadUsers();
    setupEventListeners();
});

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active to clicked button
    event.target.classList.add('active');
    
    // Stop any active video streams when switching tabs
    stopAllStreams();
}

// Setup event listeners
function setupEventListeners() {
    // Register form
    document.getElementById('registerForm').addEventListener('submit', registerUser);
    
    // Capture controls
    document.getElementById('startCamera').addEventListener('click', startCaptureCamera);
    document.getElementById('captureBtn').addEventListener('click', captureImage);
    document.getElementById('stopCamera').addEventListener('click', stopCaptureCamera);
    
    // Train button
    document.getElementById('trainBtn').addEventListener('click', trainClassifier);
    
    // Recognize controls
    document.getElementById('startRecognizeCamera').addEventListener('click', startRecognizeCamera);
    document.getElementById('recognizeBtn').addEventListener('click', recognizeFace);
    document.getElementById('stopRecognizeCamera').addEventListener('click', stopRecognizeCamera);
    
    // Refresh users
    document.getElementById('refreshUsers').addEventListener('click', loadUsers);
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalUsers').textContent = data.stats.total_users;
            document.getElementById('totalImages').textContent = data.stats.total_images;
            document.getElementById('classifierStatus').textContent = 
                data.stats.classifier_trained ? 'Trained ✓' : 'Not Trained';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Register new user
async function registerUser(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const education = document.getElementById('education').value;
    const iq = document.getElementById('iq').value;
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, education, iq })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('registerMessage', data.message, 'success');
            document.getElementById('registerForm').reset();
            loadStats();
            loadUsers();
        } else {
            showMessage('registerMessage', data.message, 'error');
        }
    } catch (error) {
        showMessage('registerMessage', 'Error: ' + error.message, 'error');
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.success) {
            // Update user select dropdown
            const userSelect = document.getElementById('userSelect');
            userSelect.innerHTML = '<option value="">-- Select User --</option>';
            
            data.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} (ID: ${user.id})`;
                userSelect.appendChild(option);
            });
            
            // Update users list
            const usersList = document.getElementById('usersList');
            usersList.innerHTML = '';
            
            if (data.users.length === 0) {
                usersList.innerHTML = '<p>No users registered yet.</p>';
            } else {
                data.users.forEach(user => {
                    const userCard = document.createElement('div');
                    userCard.className = 'user-card';
                    userCard.innerHTML = `
                        <div class="user-info">
                            <h3>${user.name}</h3>
                            <p><strong>ID:</strong> ${user.id}</p>
                            <p><strong>Education:</strong> ${user.education}</p>
                            <p><strong>IQ:</strong> ${user.iq}</p>
                        </div>
                        <div class="user-actions">
                            <button class="btn btn-danger" onclick="deleteUser(${user.id})">Delete</button>
                        </div>
                    `;
                    usersList.appendChild(userCard);
                });
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user and all their images?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadStats();
            loadUsers();
            alert('User deleted successfully');
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Start capture camera
async function startCaptureCamera() {
    const userId = document.getElementById('userSelect').value;
    
    if (!userId) {
        showMessage('captureMessage', 'Please select a user first', 'error');
        return;
    }
    
    currentUserId = userId;
    captureCount = 0;
    updateCaptureProgress(0);
    
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        video.srcObject = currentStream;
        
        document.getElementById('startCamera').disabled = true;
        document.getElementById('captureBtn').disabled = false;
        document.getElementById('stopCamera').disabled = false;
        
        showMessage('captureMessage', 'Camera started. Click Capture to take photos.', 'info');
    } catch (error) {
        showMessage('captureMessage', 'Error accessing camera: ' + error.message, 'error');
    }
}

// Capture image
async function captureImage() {
    if (!currentUserId) {
        showMessage('captureMessage', 'Please select a user first', 'error');
        return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');
        formData.append('user_id', currentUserId);
        
        try {
            const response = await fetch('/api/capture', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                captureCount = data.image_count;
                updateCaptureProgress(captureCount);
                
                if (data.completed) {
                    showMessage('captureMessage', 'Completed! 200 images captured.', 'success');
                    stopCaptureCamera();
                } else {
                    showMessage('captureMessage', `Image ${captureCount} captured successfully`, 'success');
                }
            } else {
                showMessage('captureMessage', data.message, 'error');
            }
        } catch (error) {
            showMessage('captureMessage', 'Error: ' + error.message, 'error');
        }
    }, 'image/jpeg');
}

// Stop capture camera
function stopCaptureCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    document.getElementById('startCamera').disabled = false;
    document.getElementById('captureBtn').disabled = true;
    document.getElementById('stopCamera').disabled = true;
    
    currentUserId = null;
    loadStats();
}

// Update capture progress
function updateCaptureProgress(count) {
    document.getElementById('captureCount').textContent = count;
    const percentage = (count / 200) * 100;
    document.getElementById('progressFill').style.width = percentage + '%';
}

// Train classifier
async function trainClassifier() {
    const trainBtn = document.getElementById('trainBtn');
    trainBtn.disabled = true;
    trainBtn.textContent = 'Training...';
    
    document.getElementById('trainProgress').classList.add('show');
    document.getElementById('trainProgress').textContent = 'Training in progress... Please wait.';
    
    try {
        const response = await fetch('/api/train', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('trainMessage', data.message, 'success');
            loadStats();
        } else {
            showMessage('trainMessage', data.message, 'error');
        }
    } catch (error) {
        showMessage('trainMessage', 'Error: ' + error.message, 'error');
    } finally {
        trainBtn.disabled = false;
        trainBtn.textContent = 'Train Classifier';
        document.getElementById('trainProgress').classList.remove('show');
    }
}

// Start recognize camera
async function startRecognizeCamera() {
    const recognizeVideo = document.getElementById('recognizeVideo');
    const recognizeCanvas = document.getElementById('recognizeCanvas');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        recognizeVideo.srcObject = stream;
        
        document.getElementById('startRecognizeCamera').disabled = true;
        document.getElementById('recognizeBtn').disabled = false;
        document.getElementById('stopRecognizeCamera').disabled = false;
        
        showMessage('recognizeMessage', 'Camera started. Click Recognize to identify faces.', 'info');
    } catch (error) {
        showMessage('recognizeMessage', 'Error accessing camera: ' + error.message, 'error');
    }
}

// Recognize face
async function recognizeFace() {
    const recognizeVideo = document.getElementById('recognizeVideo');
    const recognizeCanvas = document.getElementById('recognizeCanvas');
    
    recognizeCanvas.width = recognizeVideo.videoWidth;
    recognizeCanvas.height = recognizeVideo.videoHeight;
    
    const context = recognizeCanvas.getContext('2d');
    context.drawImage(recognizeVideo, 0, 0);
    
    recognizeCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'recognize.jpg');
        
        try {
            const response = await fetch('/api/recognize', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayRecognitionResults(data.faces);
            } else {
                showMessage('recognizeMessage', data.message, 'error');
            }
        } catch (error) {
            showMessage('recognizeMessage', 'Error: ' + error.message, 'error');
        }
    }, 'image/jpeg');
}

// Display recognition results
function displayRecognitionResults(faces) {
    const resultBox = document.getElementById('recognizeResult');
    resultBox.innerHTML = '';
    
    if (faces.length === 0) {
        resultBox.innerHTML = '<p>No faces detected in the image.</p>';
        return;
    }
    
    faces.forEach((face, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        if (face.recognized) {
            resultItem.innerHTML = `
                <h3>✓ Face Recognized</h3>
                <p><strong>Name:</strong> ${face.user_name}</p>
                <p><strong>Education:</strong> ${face.user_education}</p>
                <p><strong>IQ:</strong> ${face.user_iq}</p>
                <p><strong>Confidence:</strong> ${face.confidence}%</p>
            `;
        } else {
            resultItem.innerHTML = `
                <h3>✗ Unknown Face</h3>
                <p><strong>Confidence:</strong> ${face.confidence}%</p>
                <p>This person is not in the database.</p>
            `;
        }
        
        resultBox.appendChild(resultItem);
    });
}

// Stop recognize camera
function stopRecognizeCamera() {
    const recognizeVideo = document.getElementById('recognizeVideo');
    const stream = recognizeVideo.srcObject;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    document.getElementById('startRecognizeCamera').disabled = false;
    document.getElementById('recognizeBtn').disabled = true;
    document.getElementById('stopRecognizeCamera').disabled = true;
}

// Stop all streams
function stopAllStreams() {
    stopCaptureCamera();
    stopRecognizeCamera();
}

// Show message helper
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}