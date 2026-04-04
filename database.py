import sqlite3
import os

DB_PATH = 'face_recognition.db'

def init_db():
    """Initialize the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            education TEXT NOT NULL,
            iq INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("Database initialized successfully!")

def add_user(name, education, iq):
    """Add a new user to the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT INTO users (name, education, iq) VALUES (?, ?, ?)",
        (name, education, iq)
    )
    
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    
    return user_id

def get_user(user_id):
    """Get user by ID"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    conn.close()
    
    if user:
        return {
            'id': user[0],
            'name': user[1],
            'education': user[2],
            'iq': user[3],
            'created_at': user[4]
        }
    return None

def get_all_users():
    """Get all users"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    
    conn.close()
    
    return [
        {
            'id': user[0],
            'name': user[1],
            'education': user[2],
            'iq': user[3],
            'created_at': user[4]
        }
        for user in users
    ]

def delete_user(user_id):
    """Delete user and their images"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    
    conn.commit()
    conn.close()
    
    # Delete user images
    data_dir = 'data'
    if os.path.exists(data_dir):
        for filename in os.listdir(data_dir):
            if filename.startswith(f"user.{user_id}."):
                os.remove(os.path.join(data_dir, filename))
    
    return True

if __name__ == "__main__":
    init_db()