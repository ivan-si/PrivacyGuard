from flask import Flask, request, jsonify, redirect, make_response
import sqlite3
import time
import json
import uuid
from datetime import datetime
import requests
from urllib.parse import urlencode
import hashlib  # Used to compute the fingerprint hash

app = Flask(__name__)


@app.route("/")
def home():
    return """
        <html>
        <head>
            <title>Ivan's Web Privacy Lab</title>
            <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            </style>
            <!-- Existing trackers -->
            <script src="https://ivan.wpltracker.com/tracker.js"></script>
            <script src="https://ivan.wpltracker.com/trackerbf.js"></script>
        </head>
        <body>
            <h1>Welcome to Ivan's Web Privacy Lab</h1>
            <p>This demo shows both cookie-based tracking and browser fingerprinting.</p>
        </body>
        </html>
    """

# Initialize database
def init_db():
    conn = sqlite3.connect('tracker.db')
    cursor = conn.cursor()
    # Existing tracking_data table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tracking_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        cookie_name TEXT,
        cookie_value TEXT,
        page_url TEXT
    )
    ''')
    # Existing synced_cookies table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS synced_cookies (
            timestamp TEXT,
            partner_name TEXT,
            partner_cookie_id TEXT,
            username TEXT,
            sync_direction TEXT,
            cookie_origin_url TEXT,
            page_url TEXT
        )
    ''')
    # New table for browser fingerprinting data
    cursor.execute('''
            CREATE TABLE IF NOT EXISTS fingerprint_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                user_agent TEXT,
                screen_width INTEGER,
                screen_height INTEGER,
                time_zone TEXT,
                language TEXT,
                plugin_count INTEGER,
                fingerprintID TEXT,
                canvas_hash TEXT
            )
        ''')
    conn.commit()
    conn.close()


# Initialize database on startup
init_db()


@app.route("/trackerbf.js")
def trackerbf_js():
    return """(
    function() {
        // --- ADDED LOG ---
        console.log('%c trackerbf.js: Script executing...', 'color: blue');
        // -----------------

        function getFingerprintData() {
            var userAgent = navigator.userAgent;
            var screenWidth = screen.width;
            var screenHeight = screen.height;
            var timeZone = (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'unknown';
            var language = navigator.language;
            var pluginCount = (navigator.plugins && navigator.plugins.length) || 0;
            
            // Generate canvas fingerprint
            var canvasHash = getCanvasFingerprint();
            
            return {
                userAgent: userAgent,
                screenWidth: screenWidth,
                screenHeight: screenHeight,
                timeZone: timeZone,
                language: language,
                pluginCount: pluginCount,
                canvasHash: canvasHash,
                timestamp: new Date().toISOString()
            };
        }
        
        function getCanvasFingerprint() {
            try {
             // --- ADDED LOG ---
                console.log('%c trackerbf.js: Calling document.createElement("canvas")...', 'color: blue');
                // -----------------
                // Create canvas element
                var canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 50;
                
                // Get drawing context
                 // --- ADDED LOG ---
                console.log('%c trackerbf.js: Calling canvas.getContext("2d")...', 'color: blue');
                // -----------------
                var ctx = canvas.getContext('2d');
                if (!ctx) return 'canvas-unsupported';
                
                // Draw text with different styles and colors
                ctx.textBaseline = "top";
                ctx.font = "14px 'Arial'";
                ctx.textBaseline = "alphabetic";
                ctx.fillStyle = "#f60";
                ctx.fillRect(125, 1, 62, 20);
                ctx.fillStyle = "#069";
                ctx.fillText("Canvas Fingerprint", 2, 15);
                ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
                ctx.fillText("Different Colors", 4, 37);
                
                // Add a gradient and some curves for more entropy
                var gradient = ctx.createLinearGradient(0, 0, 200, 0);
                gradient.addColorStop(0, "red");
                gradient.addColorStop(0.5, "green");
                gradient.addColorStop(1.0, "blue");
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 25, 200, 10);
                
                ctx.beginPath();
                ctx.arc(50, 30, 10, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fill();
                
                // Convert canvas to data URL and hash it
                // --- ADDED LOG ---
                console.log('%c trackerbf.js: Calling canvas.toDataURL()...', 'color: blue');
                // -----------------
                var dataURL = canvas.toDataURL();
                var hash = 0;
                
                // Simple hash function for the data URL
                for (var i = 0; i < dataURL.length; i++) {
                    hash = ((hash << 5) - hash) + dataURL.charCodeAt(i);
                    hash = hash & hash; // Convert to 32bit integer
                }
                
                return hash.toString();
            } catch (e) {
                console.error("Canvas fingerprinting failed:", e);
                return "error-" + e.message;
            }
        }

        var data = getFingerprintData();
        // --- ADDED LOG ---
        console.log('%c trackerbf.js: Fingerprint data generated, preparing fetch...', 'color: blue', data);
        // -

        fetch('https://ivan.wpltracker.com/logbf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        }).catch(function(err) {
            console.error('Fingerprinting log error:', err);
        });
         // --- ADDED LOG ---
        console.log('%c trackerbf.js: Script finished.', 'color: blue');
        // -----------------
        })();
    """

@app.route("/tracker.js")
def tracker_js():
    # This script sets a persistent identifier cookie if one does not exist,
    # and then logs each visit. No visit counter or incrementation is done.
    return """
    (function() {
        function getCookie(name) {
            const cookieStr = document.cookie || "";
            const value = `; ${cookieStr}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }
        
        function setCookie(name, value, days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/;`;
        }
        
        // Use a persistent tracker ID (only create if not already set)
        let trackerId = getCookie('ivan_tracker_id');
        if (!trackerId) {
            trackerId = 'ivan_' + Math.random().toString(36).substr(2, 9);
            setCookie('ivan_tracker_id', trackerId, 365);
        }
        
        // Log the page visit to our tracking endpoint
        fetch('https://ivan.wpltracker.com/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                trackerId: trackerId,
                pageUrl: window.location.href,
                timestamp: new Date().toISOString()
            }),
            credentials: 'include'  // Include cookies in the request
        }).catch(err => console.error('Tracking error:', err));
        
        // Cookie sync with Dachi's tracker (outgoing sync)
        setTimeout(function() {
            const syncImg = new Image();
            syncImg.crossOrigin = "use-credentials";
            syncImg.onload = function() {
                console.log('Cookie sync with Dachi completed');
            };
            syncImg.onerror = function() {
                console.error('Cookie sync with Dachi failed');
            };
            // Prevent caching with a random parameter
            syncImg.src = `https://dachi.wpltracker.com/sync_receive?partner=ivan&partner_id=${encodeURIComponent(trackerId)}&timestamp=${new Date().getTime()}&rand=${Math.random()}`;
            
            // Log the sync attempt to our own server
            fetch('https://ivan.wpltracker.com/log_sync_attempt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    partner: 'dachi',
                    trackerId: trackerId,
                    timestamp: new Date().toISOString(),
                    direction: 'outgoing'
                }),
                credentials: 'include'
            }).catch(err => console.error('Sync logging error:', err));
        }, 500);
    })();
    """


@app.route("/log_sync_attempt", methods=['POST'])
def log_sync_attempt():
    try:
        data = request.get_json()

        partner = data.get('partner', 'unknown')
        our_cookie_id = data.get('trackerId', 'unknown')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        direction = data.get('direction', 'outgoing')

        # Store the outgoing sync attempt
        conn = sqlite3.connect('tracker.db')
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO synced_cookies (timestamp, partner_name, partner_cookie_id, username, sync_direction, cookie_origin_url) VALUES (?, ?, ?, ?, ?, ?)",
            (timestamp, partner, 'sync_attempt', our_cookie_id,
             direction, request.headers.get('Origin', 'unknown'))
        )
        conn.commit()
        conn.close()

        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/log", methods=['POST', 'GET'])
def log_visit():
    try:
        data = {}

        if request.method == 'POST':
            if request.is_json:
                data = request.get_json()
            else:
                data = request.form.to_dict()
        else:  # GET request
            data = request.args.to_dict()

        # Use the persistent trackerId sent from the client
        cookie_value = data.get('trackerId', 'unknown')
        page_url = data.get('pageUrl', 'unknown')
        timestamp = data.get('timestamp', datetime.now().isoformat())

        # Check if we already have this cookie ID for diagnostic purposes
        conn = sqlite3.connect('tracker.db')
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM tracking_data WHERE cookie_value = ?", (cookie_value,))
        exists_count = cursor.fetchone()[0]

        # Log the visit in the database
        cursor.execute(
            "INSERT INTO tracking_data (timestamp, cookie_name, cookie_value, page_url) VALUES (?, ?, ?, ?)",
            (timestamp, 'ivan_tracker_id', cookie_value, page_url)
        )
        conn.commit()
        conn.close()

        # Respond and (re)set the persistent cookie
        response = jsonify({
            "status": "success",
            "cookie_exists": exists_count > 0,
            "cookie_value": cookie_value
        })
        response.set_cookie(
            'ivan_tracker_id',
            cookie_value,
            max_age=60*60*24*365,
            domain='ivan.wpltracker.com',
            secure=True,
            samesite='None'
        )

        return response
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/logbf", methods=['POST'])
def log_fingerprint():
    try:
        data = request.get_json() or {}
        user_agent = data.get('userAgent', 'unknown')
        screen_width = data.get('screenWidth', 0)
        screen_height = data.get('screenHeight', 0)
        time_zone = data.get('timeZone', 'unknown')
        language = data.get('language', 'unknown')
        plugin_count = data.get('pluginCount', 0)
        canvas_hash = data.get('canvasHash', 'unknown')  # Get canvas hash from request
        timestamp = data.get('timestamp', datetime.now().isoformat())

        # Create a hashed fingerprintID from the collected attributes (excluding canvas hash)
        hash_input = f"{user_agent}|{screen_width}|{screen_height}|{time_zone}|{language}|{plugin_count}"
        fingerprintID = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        conn = sqlite3.connect('tracker.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO fingerprint_data (
                timestamp, user_agent, screen_width, screen_height, 
                time_zone, language, plugin_count, fingerprintID, canvas_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (timestamp, user_agent, screen_width, screen_height, time_zone, language, plugin_count, fingerprintID, canvas_hash))
        conn.commit()
        conn.close()

        return jsonify({"status": "success", "fingerprintID": fingerprintID, "canvasHash": canvas_hash}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/dbbf")
def get_fingerprint_db():
    try:
        conn = sqlite3.connect('tracker.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fingerprint_data ORDER BY id DESC")
        fp_data = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({"fingerprint_data": fp_data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/db")
def get_db():
    try:
        conn = sqlite3.connect('tracker.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Retrieve tracking data
        cursor.execute("SELECT * FROM tracking_data ORDER BY id DESC")
        tracking_data = [dict(row) for row in cursor.fetchall()]

        # Retrieve synced cookies data
        cursor.execute("SELECT * FROM synced_cookies ORDER BY timestamp DESC")
        synced_cookies = [dict(row) for row in cursor.fetchall()]

        # Gather some statistics
        cursor.execute(
            "SELECT COUNT(DISTINCT cookie_value) FROM tracking_data")
        unique_users = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM synced_cookies WHERE sync_direction = 'incoming'")
        incoming_syncs = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM synced_cookies WHERE sync_direction = 'outgoing'")
        outgoing_syncs = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            "tracking_data": tracking_data,
            "synced_cookies": synced_cookies,
            "stats": {
                "unique_users": unique_users,
                "incoming_syncs": incoming_syncs,
                "outgoing_syncs": outgoing_syncs
            }
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500



@app.route("/sync_receive", methods=['GET', 'POST'])
def sync_receive():
    try:
        # Get parameters from GET or POST, including page_url
        if request.method == 'GET':
            partner = request.args.get('partner', 'unknown')
            partner_id = request.args.get('partner_id', 'unknown')
            page_url = request.args.get('page_url', 'unknown')
        else:
            data = request.get_json() if request.is_json else request.form
            partner = data.get('partner', 'unknown')
            partner_id = data.get('partner_id', 'unknown')
            page_url = data.get('page_url', 'unknown')

        timestamp = datetime.now().isoformat()

        # Check if we have an existing mapping for this partner_id
        conn = sqlite3.connect('tracker.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Look for previous syncs with the same partner and partner_id
        cursor.execute(
            "SELECT username FROM synced_cookies WHERE partner_name = ? AND partner_cookie_id = ? AND sync_direction = 'incoming' ORDER BY timestamp DESC LIMIT 1",
            (partner, partner_id)
        )
        result = cursor.fetchone()

        # Use our persistent cookie value from request, or use existing mapping, or create a new one
        our_cookie_id = request.cookies.get('ivan_tracker_id')
        if not our_cookie_id:
            if result:
                # Use the previously mapped username for this partner_id
                our_cookie_id = result['username']
            else:
                # Create a new ID only if we don't have a previous mapping
                our_cookie_id = 'ivan_' + str(uuid.uuid4())[:8]

        # Log the incoming sync in the database
        cursor.execute(
            "INSERT INTO synced_cookies (timestamp, partner_name, partner_cookie_id, username, sync_direction, cookie_origin_url, page_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (timestamp, partner, partner_id, our_cookie_id, 'incoming',
             request.headers.get('Origin', 'unknown'), page_url)
        )
        conn.commit()
        conn.close()

        # Respond with a 1x1 transparent GIF
        response = make_response(
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b')
        response.headers.set('Content-Type', 'image/gif')
        response.set_cookie(
            'ivan_tracker_id',
            our_cookie_id,
            max_age=60*60*24*365,
            domain='ivan.wpltracker.com',
            secure=True,
            samesite='None'
        )

        return response
    except Exception as e:
        with open('sync_error.log', 'a') as f:
            f.write(f"{datetime.now().isoformat()} - Error: {str(e)}\n")
        response = make_response(
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b')
        response.headers.set('Content-Type', 'image/gif')
        return response
# Endpoint for testing the sync receiver


@app.route("/test_sync_receive")
def test_sync_receive():
    html = """
    <html>
        <head>
            <title>Test Sync Receiver</title>
        </head>
        <body>
            <h1>Test Sync Receiver</h1>
            <p>This page simulates receiving a cookie sync from a partner.</p>
            <button onclick="simulateSync()">Simulate Sync</button>
            
            <div id="result" style="margin-top: 20px;"></div>
            
            <script>
                function simulateSync() {
                    const img = new Image();
                    const trackerId = 'faisal_test_' + Math.random().toString(36).substring(2, 10);
                    
                    img.onload = function() {
                        document.getElementById('result').innerHTML = 
                            '<p style="color: green;">Sync successful! Sent test ID: ' + trackerId + '</p>' +
                            '<p>Check the /db endpoint to see if the sync was recorded.</p>';
                    };
                    
                    img.onerror = function() {
                        document.getElementById('result').innerHTML = 
                            '<p style="color: red;">Sync failed! Check server logs.</p>';
                    };
                    
                    img.src = '/sync_receive?partner=faisal_test&partner_id=' + trackerId + '&timestamp=' + Date.now();
                    document.getElementById('result').innerHTML = '<p>Sending sync request...</p>';
                }
            </script>
        </body>
    </html>
    """
    return html

# Allow cross-origin requests for the tracking script and API


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5011)
