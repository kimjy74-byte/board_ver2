import os
import sys
import socket
import io
import base64
import time
import re
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response
import qrcode

app = Flask(__name__, static_folder='public', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR, exist_ok=True)

PORT = 3000

# Event subscribers for real-time SSE stream
clients = []

def get_local_ip():
    """Detect local LAN IP address for QR code generation & phone connection."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def sanitize_filename(filename):
    """Sanitize original filename preserving Korean and safe characters."""
    name, ext = os.path.splitext(filename)
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\u3131-\u318D\uAC00-\uD7A3]', '_', name)
    unique_suffix = f"{int(time.time() * 1000)}"
    return f"{safe_name}_{unique_suffix}{ext if ext else '.jpg'}"

@app.route('/')
def index():
    return send_from_directory(PUBLIC_DIR, 'index.html')

@app.route('/api/info')
def get_info():
    local_ip = get_local_ip()
    url = f"http://{local_ip}:{PORT}"
    
    # Generate QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#2E5880", back_color="#FFFFFF")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    return jsonify({
        'ip': local_ip,
        'port': PORT,
        'url': url,
        'qrCode': qr_b64
    })

@app.route('/api/photos', methods=['GET'])
def list_photos():
    photos = []
    if os.path.exists(UPLOADS_DIR):
        for fname in os.listdir(UPLOADS_DIR):
            fpath = os.path.join(UPLOADS_DIR, fname)
            if os.path.isfile(fpath):
                stat = os.stat(fpath)
                photos.append({
                    'filename': fname,
                    'size': stat.st_size,
                    'uploadedAt': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'url': f"/uploads/{fname}",
                    'downloadUrl': f"/api/download/{fname}"
                })
    # Sort newest first
    photos.sort(key=lambda x: x['uploadedAt'], reverse=True)
    return jsonify(photos)

@app.route('/api/upload', methods=['POST'])
def upload_photos():
    if 'photos' not in request.files:
        return jsonify({'error': 'No photos uploaded'}), 400
    
    files = request.files.getlist('photos')
    uploaded = []
    
    for file in files:
        if file.filename:
            safe_name = sanitize_filename(file.filename)
            save_path = os.path.join(UPLOADS_DIR, safe_name)
            file.save(save_path)
            stat = os.stat(save_path)
            uploaded.append({
                'filename': safe_name,
                'originalName': file.filename,
                'size': stat.st_size,
                'uploadedAt': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'url': f"/uploads/{safe_name}",
                'downloadUrl': f"/api/download/{safe_name}"
            })

    # Broadcast to SSE clients
    notify_clients()

    return jsonify({'message': 'Success', 'photos': uploaded})

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)

@app.route('/api/download/<filename>')
def download_photo(filename):
    return send_from_directory(UPLOADS_DIR, filename, as_attachment=True)

@app.route('/api/photos/<filename>', methods=['DELETE'])
def delete_photo(filename):
    fpath = os.path.join(UPLOADS_DIR, filename)
    if os.path.exists(fpath):
        os.remove(fpath)
        notify_clients()
        return jsonify({'message': 'Deleted successfully'})
    return jsonify({'error': 'File not found'}), 404

def notify_clients():
    global clients
    for q in clients:
        try:
            q.append('reload')
        except Exception:
            pass

@app.route('/api/stream')
def sse_stream():
    """Server-Sent Events for real-time photo sync."""
    def event_generator():
        q = []
        clients.append(q)
        try:
            yield "data: connected\n\n"
            while True:
                if q:
                    q.pop(0)
                    yield "data: reload\n\n"
                time.sleep(0.5)
        except GeneratorExit:
            if q in clients:
                clients.remove(q)

    return Response(event_generator(), mimetype='text/event-stream')

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("\n==================================================")
    print(" [AoiSync Photo Transfer Server Running]")
    print(f" Local PC:     http://localhost:{PORT}")
    print(f" Mobile (WiFi): http://{local_ip}:{PORT}")
    print("==================================================\n")
    app.run(host='0.0.0.0', port=PORT, debug=False)
