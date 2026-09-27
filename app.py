import os
import json
import uuid
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, jsonify, request, send_from_directory, session, redirect, url_for

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import pymongo
except ImportError:
    pymongo = None

from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'store.json')

app = Flask(__name__, template_folder=os.path.join(BASE_DIR, 'templates'), static_folder=os.path.join(BASE_DIR, 'static'))
app.secret_key = os.environ.get('SECRET_KEY', 'ecoloop-hackathon-super-secret-key-2026')

# MongoDB Atlas Integration
MONGODB_URI = os.environ.get('MONGODB_URI')
mongo_client = None
db = None

if pymongo and MONGODB_URI and MONGODB_URI.startswith('mongodb'):
    try:
        mongo_client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = mongo_client.get_default_database() or mongo_client['ecoloop_db']
        print("Connected to MongoDB Atlas successfully!")
    except Exception as e:
        print(f"MongoDB Atlas Connection Info: {e}")

def get_data_file():
    if os.environ.get('K_SERVICE') or not os.access(BASE_DIR, os.W_OK):
        tmp_dir = os.path.join('/tmp', 'data')
        os.makedirs(tmp_dir, exist_ok=True)
        return os.path.join(tmp_dir, 'store.json'), tmp_dir
    return DATA_FILE, DATA_DIR

DEFAULT_CATEGORIES = [
    {
        "id": "plastic",
        "name": "Recyclable Plastics",
        "icon": "fa-bottle-water",
        "color": "#10B981",
        "bg_color": "rgba(16, 185, 129, 0.1)",
        "points_per_kg": 15,
        "co2_saved_per_kg": 1.8,
        "description": "PET bottles, HDPE containers, plastic packaging & clean food containers.",
        "tips": "Rinse containers before pickup. Separate caps and compress bottles to save space."
    },
    {
        "id": "e_waste",
        "name": "E-Waste & Electronics",
        "icon": "fa-microchip",
        "color": "#8B5CF6",
        "bg_color": "rgba(139, 92, 246, 0.1)",
        "points_per_kg": 40,
        "co2_saved_per_kg": 4.5,
        "description": "Old laptops, phones, cables, circuit boards, batteries & home appliances.",
        "tips": "Wipe personal data before disposal. Wrap batteries safely in non-conductive tape."
    },
    {
        "id": "organic",
        "name": "Organic & Wet Waste",
        "icon": "fa-seedling",
        "color": "#84CC16",
        "bg_color": "rgba(132, 204, 22, 0.1)",
        "points_per_kg": 5,
        "co2_saved_per_kg": 0.8,
        "description": "Food scraps, kitchen waste, garden waste & biodegradable material.",
        "tips": "Drain liquid before packing in compostable bags. Keep separate from dry waste."
    },
    {
        "id": "paper",
        "name": "Paper & Cardboard",
        "icon": "fa-newspaper",
        "color": "#F59E0B",
        "bg_color": "rgba(245, 158, 11, 0.1)",
        "points_per_kg": 10,
        "co2_saved_per_kg": 1.2,
        "description": "Newspapers, cardboard boxes, office paper, magazines & egg cartons.",
        "tips": "Flatten boxes and bundle papers tightly. Keep dry and free from oil or grease."
    },
    {
        "id": "glass",
        "name": "Glass Containers",
        "icon": "fa-wine-bottle",
        "color": "#06B6D4",
        "bg_color": "rgba(6, 182, 212, 0.1)",
        "points_per_kg": 12,
        "co2_saved_per_kg": 1.0,
        "description": "Glass bottles, jars, glass food containers & intact glassware.",
        "tips": "Rinse clean. Do not include broken window glass or mirrors in standard recycling."
    },
    {
        "id": "metal",
        "name": "Metal Cans & Scrap",
        "icon": "fa-cubes",
        "color": "#64748B",
        "bg_color": "rgba(100, 116, 139, 0.1)",
        "points_per_kg": 25,
        "co2_saved_per_kg": 3.2,
        "description": "Aluminum soda cans, tin food cans, metal scrap & aluminum foil.",
        "tips": "Rinse beverage cans and flatten if possible. Remove food residues."
    },
    {
        "id": "hazardous",
        "name": "Hazardous & Chemicals",
        "icon": "fa-triangle-exclamation",
        "color": "#EF4444",
        "bg_color": "rgba(239, 68, 68, 0.1)",
        "points_per_kg": 30,
        "co2_saved_per_kg": 2.5,
        "description": "Paints, harsh household cleaning chemicals, medical waste, fluorescent bulbs.",
        "tips": "Keep in original labeled containers. Store securely away from heat and moisture."
    },
    {
        "id": "bulk",
        "name": "Bulk & Furniture",
        "icon": "fa-couch",
        "color": "#EC4899",
        "bg_color": "rgba(236, 72, 153, 0.1)",
        "points_per_kg": 8,
        "co2_saved_per_kg": 0.9,
        "description": "Old wooden furniture, mattresses, bulky items & large plastic items.",
        "tips": "Disassemble bulky items if possible. Ensure clear access for collection vehicle."
    }
]

DEFAULT_USERS = [
    {
        "id": "USR-1001",
        "name": "Anushka Shinde",
        "email": "anushka@example.com",
        "phone": "+917045782996",
        "password_hash": generate_password_hash("user123"),
        "role": "user",
        "eco_points": 700,
        "level": 3,
        "badges": ["Eco Pioneer", "Plastic Crusher", "E-Waste Warrior"],
        "created_at": "2026-09-01T09:00:00"
    },
    {
        "id": "USR-1002",
        "name": "Ramesh V. (Collector Alpha)",
        "email": "collector@ecoloop.com",
        "phone": "+919876543210",
        "password_hash": generate_password_hash("collector123"),
        "role": "collector",
        "eco_points": 1200,
        "level": 4,
        "badges": ["Master Collector", "Fast Responder"],
        "created_at": "2026-09-01T09:00:00"
    },
    {
        "id": "USR-1003",
        "name": "System Admin",
        "email": "admin@ecoloop.com",
        "phone": "+919870330830",
        "password_hash": generate_password_hash("admin123"),
        "role": "admin",
        "eco_points": 5000,
        "level": 5,
        "badges": ["Planet Guardian", "Super Admin"],
        "created_at": "2026-09-01T09:00:00"
    }
]

DEFAULT_REQUESTS = [
    {
        "id": "SW-2026-00001",
        "user_id": "USR-1001",
        "user_name": "Anushka Shinde",
        "user_email": "anushka@example.com",
        "user_phone": "+917045782996",
        "category_id": "e_waste",
        "category_name": "E-Waste & Electronics",
        "estimated_weight_kg": 4.5,
        "quantity_description": "1 old laptop, 2 smartphones, assorted cables",
        "address": "Sector 125, Noida, Uttar Pradesh, 201303",
        "landmark": "Near Eco Tower",
        "lat": 28.544,
        "lng": 77.333,
        "pickup_date": "2026-09-29",
        "time_slot": "10:00 AM - 01:00 PM",
        "status": "On The Way",
        "collector_id": "USR-1002",
        "collector_assigned": "Ramesh V. (Collector Alpha)",
        "created_at": "2026-09-27T10:15:00",
        "eco_points": 180,
        "co2_saved_kg": 20.25,
        "notes": "Please call before arrival."
    },
    {
        "id": "SW-2026-00002",
        "user_id": "USR-1001",
        "user_name": "Anushka Shinde",
        "user_email": "anushka@example.com",
        "user_phone": "+917045782996",
        "category_id": "plastic",
        "category_name": "Recyclable Plastics",
        "estimated_weight_kg": 12.0,
        "quantity_description": "3 bags of plastic bottles and containers",
        "address": "Wework Galaxy, Residency Rd, Ashok Nagar, Bengaluru",
        "landmark": "Opposite Metro Station",
        "lat": 12.971,
        "lng": 77.594,
        "pickup_date": "2026-09-28",
        "time_slot": "02:00 PM - 05:00 PM",
        "status": "Scheduled",
        "collector_id": "USR-1002",
        "collector_assigned": "Ramesh V. (Collector Alpha)",
        "created_at": "2026-09-26T14:30:00",
        "eco_points": 180,
        "co2_saved_kg": 21.6,
        "notes": "Gate entry code #402"
    },
    {
        "id": "SW-2026-00003",
        "user_id": "USR-1001",
        "user_name": "Anushka Shinde",
        "user_email": "anushka@example.com",
        "user_phone": "+917045782996",
        "category_id": "paper",
        "category_name": "Paper & Cardboard",
        "estimated_weight_kg": 25.0,
        "quantity_description": "Office cardboards and stacks of newspapers",
        "address": "Baner Road, Pune, Maharashtra 411045",
        "landmark": "Behind FIT Campus",
        "lat": 18.559,
        "lng": 73.786,
        "pickup_date": "2026-09-26",
        "time_slot": "09:00 AM - 12:00 PM",
        "status": "Recycling Completed",
        "collector_id": "USR-1002",
        "collector_assigned": "Ramesh V. (Collector Alpha)",
        "created_at": "2026-09-25T09:00:00",
        "eco_points": 250,
        "co2_saved_kg": 30.0,
        "notes": "Recycled successfully at Pune Waste Facility."
    }
]

DEFAULT_REPORTS = [
    {
        "id": "REP-2026-001",
        "user_name": "Anushka Shinde",
        "problem_type": "Illegal Dumping",
        "location": "Baner Highway Underpass, Pune",
        "description": "Construction debris and plastic bags dumped near water canal.",
        "status": "Under Review",
        "created_at": "2026-09-26T11:00:00"
    }
]

DEFAULT_CHALLENGES = [
    {
        "id": "CHALL-001",
        "title": "Pune Green Sector Drive 2026",
        "target_kg": 1000,
        "current_kg": 680,
        "participants": 142,
        "days_left": 12,
        "reward_badge": "Sector Eco Champion"
    }
]

def load_data():
    # If MongoDB is connected, load from MongoDB collections
    if db is not None:
        try:
            users = list(db.users.find({}, {'_id': 0}))
            requests_list = list(db.pickup_requests.find({}, {'_id': 0}))
            reports = list(db.reports.find({}, {'_id': 0}))
            challenges = list(db.challenges.find({}, {'_id': 0}))
            categories = list(db.categories.find({}, {'_id': 0}))

            if not users:
                db.users.insert_many([u.copy() for u in DEFAULT_USERS])
                users = DEFAULT_USERS
            if not requests_list:
                db.pickup_requests.insert_many([r.copy() for r in DEFAULT_REQUESTS])
                requests_list = DEFAULT_REQUESTS
            if not reports:
                db.reports.insert_many([rp.copy() for rp in DEFAULT_REPORTS])
                reports = DEFAULT_REPORTS
            if not challenges:
                db.challenges.insert_many([c.copy() for c in DEFAULT_CHALLENGES])
                challenges = DEFAULT_CHALLENGES
            if not categories:
                db.categories.insert_many([cat.copy() for cat in DEFAULT_CATEGORIES])
                categories = DEFAULT_CATEGORIES

            return {
                "users": users,
                "requests": requests_list,
                "reports": reports,
                "challenges": challenges,
                "categories": categories
            }
        except Exception as e:
            print(f"MongoDB load exception: {e}")

    # Fallback to local JSON file storage
    file_path, dir_path = get_data_file()
    if not os.path.exists(dir_path):
        try:
            os.makedirs(dir_path, exist_ok=True)
        except Exception:
            pass
    
    if not os.path.exists(file_path):
        data = {
            "requests": DEFAULT_REQUESTS,
            "categories": DEFAULT_CATEGORIES,
            "users": DEFAULT_USERS,
            "reports": DEFAULT_REPORTS,
            "challenges": DEFAULT_CHALLENGES
        }
        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass
        return data
    
    try:
        with open(file_path, 'r') as f:
            d = json.load(f)
            if "users" not in d: d["users"] = DEFAULT_USERS
            if "reports" not in d: d["reports"] = DEFAULT_REPORTS
            if "challenges" not in d: d["challenges"] = DEFAULT_CHALLENGES
            return d
    except Exception:
        return {
            "requests": DEFAULT_REQUESTS,
            "categories": DEFAULT_CATEGORIES,
            "users": DEFAULT_USERS,
            "reports": DEFAULT_REPORTS,
            "challenges": DEFAULT_CHALLENGES
        }

def save_data(data):
    # If MongoDB connected, sync to MongoDB
    if db is not None:
        try:
            if "users" in data:
                for u in data["users"]:
                    db.users.replace_one({"id": u["id"]}, u, upsert=True)
            if "requests" in data:
                for r in data["requests"]:
                    db.pickup_requests.replace_one({"id": r["id"]}, r, upsert=True)
            if "reports" in data:
                for rp in data["reports"]:
                    db.reports.replace_one({"id": rp["id"]}, rp, upsert=True)
        except Exception as e:
            print(f"MongoDB save exception: {e}")

    # Fallback to JSON file storage
    file_path, dir_path = get_data_file()
    try:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to persist data to {file_path}: {e}")

def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    data = load_data()
    for u in data.get('users', []):
        if u['id'] == user_id:
            return u
    return None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            if request.path.startswith('/api/'):
                return jsonify({"status": "error", "message": "Authentication required"}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

# ROUTE HANDLERS
@app.route("/")
@app.route("/index")
@app.route("/index.html")
def home():
    return render_template("index.html")

@app.route("/login")
def login_page():
    return render_template("index.html")

@app.route("/register")
def register_page():
    return render_template("index.html")

@app.route("/dashboard")
@login_required
def dashboard_page():
    return render_template("index.html")

@app.route("/profile")
@login_required
def profile_page():
    return render_template("index.html")

@app.route("/my-requests")
@login_required
def my_requests_page():
    return render_template("index.html")

@app.route("/logout")
def logout():
    session.pop('user_id', None)
    return redirect(url_for('login_page'))

@app.route('/health')
@app.route('/ping')
def health():
    return jsonify({"status": "healthy", "service": "EcoLoop Smart Waste Platform"}), 200

@app.errorhandler(404)
def page_not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({"status": "error", "message": "API endpoint not found"}), 404
    return render_template('index.html'), 200

@app.route('/poster.png')
def serve_poster():
    return send_from_directory(BASE_DIR, 'poster.png')

# AUTH REST API ENDPOINTS
@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    user = get_current_user()
    if user:
        u_clean = {k: v for k, v in user.items() if k != 'password_hash'}
        return jsonify({"status": "success", "authenticated": True, "user": u_clean})
    return jsonify({"status": "success", "authenticated": False, "user": None})

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    req_data = request.json or {}
    name = req_data.get('name')
    email = req_data.get('email')
    password = req_data.get('password')
    confirm_password = req_data.get('confirm_password')
    phone = req_data.get('phone', '')

    if not name or not email or not password:
        return jsonify({"status": "error", "message": "All required fields must be provided"}), 400

    if '@' not in email or '.' not in email:
        return jsonify({"status": "error", "message": "Please enter a valid email address"}), 400

    if confirm_password and password != confirm_password:
        return jsonify({"status": "error", "message": "Password and Confirm Password do not match"}), 400

    data = load_data()
    users = data.get('users', [])

    for u in users:
        if u['email'].lower() == email.lower():
            return jsonify({"status": "error", "message": "An account with this email already exists"}), 400

    user_id = f"USR-{len(users) + 1005}"
    new_user = {
        "id": user_id,
        "name": name,
        "email": email.lower(),
        "phone": phone,
        "password_hash": generate_password_hash(password),
        "role": "user",
        "eco_points": 50,
        "level": 1,
        "badges": ["Eco Pioneer"],
        "created_at": datetime.now().isoformat()
    }

    data.setdefault('users', []).append(new_user)
    save_data(data)

    session['user_id'] = new_user['id']
    u_clean = {k: v for k, v in new_user.items() if k != 'password_hash'}

    return jsonify({"status": "success", "message": "Registration successful!", "user": u_clean})

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    req_data = request.json or {}
    email = req_data.get('email', '').strip()
    password = req_data.get('password', '')

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required"}), 400

    data = load_data()
    users = data.get('users', [])

    target_user = None
    for u in users:
        if u['email'].lower() == email.lower():
            target_user = u
            break

    if not target_user or not check_password_hash(target_user.get('password_hash', ''), password):
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

    session['user_id'] = target_user['id']
    u_clean = {k: v for k, v in target_user.items() if k != 'password_hash'}

    return jsonify({"status": "success", "message": f"Welcome back, {target_user['name']}!", "user": u_clean})

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout_api():
    session.pop('user_id', None)
    return jsonify({"status": "success", "message": "Logged out successfully"})

@app.route('/api/auth/profile', methods=['PATCH'])
@login_required
def update_profile():
    current_user = get_current_user()
    req_data = request.json or {}
    
    new_name = req_data.get('name')
    new_phone = req_data.get('phone')

    data = load_data()
    for u in data.get('users', []):
        if u['id'] == current_user['id']:
            if new_name: u['name'] = new_name
            if new_phone: u['phone'] = new_phone
            save_data(data)
            u_clean = {k: v for k, v in u.items() if k != 'password_hash'}
            return jsonify({"status": "success", "message": "Profile updated successfully!", "user": u_clean})

    return jsonify({"status": "error", "message": "User not found"}), 404

# CATEGORIES API
@app.route('/api/categories', methods=['GET'])
def get_categories():
    data = load_data()
    return jsonify({"status": "success", "categories": data.get("categories", DEFAULT_CATEGORIES)})

# REQUESTS API
@app.route('/api/requests', methods=['GET'])
def get_requests():
    data = load_data()
    requests_list = data.get("requests", [])
    
    current_user = get_current_user()
    
    status_filter = request.args.get('status')
    category_filter = request.args.get('category')
    search_query = request.args.get('search')
    user_filter = request.args.get('user_id')
    my_requests_only = request.args.get('my_requests')

    filtered = requests_list

    # Filter for logged-in user requests if my_requests flag is set or non-admin user
    if my_requests_only == 'true' and current_user:
        filtered = [r for r in filtered if r.get('user_id') == current_user['id'] or r.get('user_email') == current_user['email']]
    elif user_filter:
        filtered = [r for r in filtered if r.get('user_id') == user_filter]

    if status_filter and status_filter.lower() != 'all':
        filtered = [r for r in filtered if r.get('status', '').lower().replace(' ', '') == status_filter.lower().replace(' ', '')]
    
    if category_filter and category_filter.lower() != 'all':
        filtered = [r for r in filtered if r.get('category_id', '').lower() == category_filter.lower()]
        
    if search_query:
        sq = search_query.lower()
        filtered = [
            r for r in filtered
            if sq in r.get('id', '').lower()
            or sq in r.get('user_name', '').lower()
            or sq in r.get('address', '').lower()
            or sq in r.get('category_name', '').lower()
        ]
        
    return jsonify({
        "status": "success",
        "count": len(filtered),
        "requests": filtered
    })

@app.route('/api/requests', methods=['POST'])
@login_required
def create_request():
    req_data = request.json or {}
    
    if not req_data.get('category_id') or not req_data.get('address'):
        return jsonify({"status": "error", "message": "Category and address are required"}), 400
        
    data = load_data()
    categories = {c['id']: c for c in data.get('categories', DEFAULT_CATEGORIES)}
    
    cat_info = categories.get(req_data.get('category_id'), {})
    weight = float(req_data.get('estimated_weight_kg', 1.0))
    pts_per_kg = cat_info.get('points_per_kg', 10)
    co2_per_kg = cat_info.get('co2_saved_per_kg', 1.5)
    
    current_user = get_current_user()
    user_id = current_user['id']
    user_name = current_user['name']
    user_email = current_user['email']
    user_phone = current_user['phone'] or req_data.get('user_phone', '')

    existing = data.get("requests", [])
    pickup_date = req_data.get('pickup_date', datetime.now().strftime('%Y-%m-%d'))
    time_slot = req_data.get('time_slot', '09:00 AM - 12:00 PM')
    address = req_data.get('address')

    for r in existing:
        if r.get('address', '').strip().lower() == address.strip().lower() \
           and r.get('pickup_date') == pickup_date \
           and r.get('time_slot') == time_slot \
           and r.get('status') not in ['Recycling Completed', 'Cancelled']:
            return jsonify({"status": "error", "message": "A pickup request already exists for this address, date and time slot!"}), 400
    
    req_num = len(existing) + 1
    req_id = f"SW-2026-{req_num:05d}"
    
    earned_pts = int(weight * pts_per_kg)
    co2_saved = round(weight * co2_per_kg, 2)

    new_request = {
        "id": req_id,
        "user_id": user_id,
        "user_name": user_name,
        "user_email": user_email,
        "user_phone": user_phone,
        "category_id": req_data.get('category_id'),
        "category_name": cat_info.get('name', req_data.get('category_id')),
        "estimated_weight_kg": weight,
        "quantity_description": req_data.get('quantity_description', f"{weight} kg items"),
        "address": address,
        "landmark": req_data.get('landmark', ''),
        "lat": float(req_data.get('lat', 18.559)),
        "lng": float(req_data.get('lng', 73.786)),
        "pickup_date": pickup_date,
        "time_slot": time_slot,
        "status": "Submitted",
        "collector_id": None,
        "collector_assigned": "Unassigned",
        "created_at": datetime.now().isoformat(),
        "eco_points": earned_pts,
        "co2_saved_kg": co2_saved,
        "notes": req_data.get('notes', ''),
        "photo_url": req_data.get('photo_url', '')
    }

    if current_user:
        for u in data.get('users', []):
            if u['id'] == current_user['id']:
                u['eco_points'] = u.get('eco_points', 0) + earned_pts
                u['level'] = (u['eco_points'] // 200) + 1
                break

    data.setdefault("requests", []).insert(0, new_request)
    save_data(data)
    
    return jsonify({
        "status": "success",
        "message": "Pickup request submitted successfully!",
        "request": new_request
    }), 201

@app.route('/api/requests/<req_id>', methods=['PATCH'])
@login_required
def update_request_status(req_id):
    req_data = request.json or {}
    new_status = req_data.get('status')
    collector_assigned = req_data.get('collector_assigned')
    collector_id = req_data.get('collector_id')
    
    data = load_data()
    requests_list = data.get("requests", [])
    
    target = None
    for r in requests_list:
        if r['id'] == req_id:
            target = r
            break
            
    if not target:
        return jsonify({"status": "error", "message": "Request ID not found"}), 404
        
    if new_status:
        target['status'] = new_status
    if collector_assigned:
        target['collector_assigned'] = collector_assigned
    if collector_id:
        target['collector_id'] = collector_id
    if 'notes' in req_data:
        target['notes'] = req_data['notes']
        
    save_data(data)
    
    return jsonify({
        "status": "success",
        "message": f"Request {req_id} updated successfully",
        "request": target
    })

@app.route('/api/requests/<req_id>', methods=['DELETE'])
@login_required
def cancel_request(req_id):
    data = load_data()
    requests_list = data.get("requests", [])
    
    updated_list = [r for r in requests_list if r['id'] != req_id]
    if len(updated_list) == len(requests_list):
        return jsonify({"status": "error", "message": "Request ID not found"}), 404
        
    data['requests'] = updated_list
    save_data(data)
    
    return jsonify({
        "status": "success",
        "message": f"Request {req_id} cancelled"
    })

# REPORTS & ASSISTANT & STATS
@app.route('/api/reports', methods=['GET', 'POST'])
def handle_reports():
    data = load_data()
    if request.method == 'GET':
        return jsonify({"status": "success", "reports": data.get("reports", [])})
    
    req_data = request.json or {}
    problem_type = req_data.get('problem_type')
    location = req_data.get('location')
    description = req_data.get('description')
    
    if not problem_type or not location:
        return jsonify({"status": "error", "message": "Problem type and location are required"}), 400

    current_user = get_current_user()
    user_name = current_user['name'] if current_user else 'Anushka Shinde'

    report_id = f"REP-2026-00{len(data.get('reports', [])) + 3}"
    new_report = {
        "id": report_id,
        "user_name": user_name,
        "problem_type": problem_type,
        "location": location,
        "description": description,
        "status": "Under Review",
        "created_at": datetime.now().isoformat()
    }
    
    data.setdefault("reports", []).insert(0, new_report)
    save_data(data)
    
    return jsonify({"status": "success", "message": "Waste problem report submitted!", "report": new_report}), 201

@app.route('/api/challenges', methods=['GET'])
def get_challenges():
    data = load_data()
    return jsonify({"status": "success", "challenges": data.get("challenges", DEFAULT_CHALLENGES)})

@app.route('/api/assistant/recommend', methods=['POST'])
def assistant_recommend():
    req_data = request.json or {}
    item_type = req_data.get('item_type', '').lower()
    condition = req_data.get('condition', '').lower()

    if 'battery' in item_type or 'phone' in item_type or 'laptop' in item_type or 'wire' in item_type:
        cat_id = 'e_waste'
        disp = "Segregate in non-conductive box. Do not puncture or expose to high temperatures."
        coll = "Doorstep Special E-Waste Pickup"
        safety = "Tape exposed battery terminals with electrical tape."
    elif 'food' in item_type or 'vegetable' in item_type or 'organic' in item_type:
        cat_id = 'organic'
        disp = "Drain excess liquid and pack in biodegradable bags for composting."
        coll = "Daily Municipal Wet Waste Pickup"
        safety = "Keep separate from dry plastic items."
    elif 'paint' in item_type or 'chemical' in item_type or 'cleaner' in item_type:
        cat_id = 'hazardous'
        disp = "Store in original sealed chemical container."
        coll = "Hazardous Waste Specialist Dispatch"
        safety = "Wear gloves during handling. Keep away from heat."
    elif 'box' in item_type or 'paper' in item_type or 'cardboard' in item_type:
        cat_id = 'paper'
        disp = "Flatten boxes and bundle with string."
        coll = "Standard Recyclable Pickup"
        safety = "Ensure paper is dry and oil-free."
    else:
        cat_id = 'plastic'
        disp = "Rinse containers and separate caps."
        coll = "Standard Recyclable Doorstep Pickup"
        safety = "Compress plastic bottles to minimize volume."

    data = load_data()
    cat_info = next((c for c in data.get('categories', DEFAULT_CATEGORIES) if c['id'] == cat_id), DEFAULT_CATEGORIES[0])

    return jsonify({
        "status": "success",
        "recommendation": {
            "category_id": cat_id,
            "category_name": cat_info['name'],
            "disposal_method": disp,
            "collection_type": coll,
            "safety_instructions": safety,
            "eco_points_per_kg": cat_info['points_per_kg'],
            "co2_saved_per_kg": cat_info['co2_saved_per_kg']
        }
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    data = load_data()
    reqs = data.get("requests", [])
    users = data.get("users", [])
    
    total_requests = len(reqs)
    total_weight_kg = sum(r.get('estimated_weight_kg', 0) for r in reqs)
    total_co2_saved = sum(r.get('co2_saved_kg', 0) for r in reqs)
    total_eco_points = sum(r.get('eco_points', 0) for r in reqs)
    
    status_counts = {
        "Submitted": 0,
        "Scheduled": 0,
        "Collector Assigned": 0,
        "On The Way": 0,
        "Collected": 0,
        "Recycling Completed": 0,
        "Cancelled": 0
    }
    
    category_weights = {}
    
    for r in reqs:
        st = r.get('status', 'Submitted')
        status_counts[st] = status_counts.get(st, 0) + 1
        
        cat = r.get('category_name', 'Other')
        w = r.get('estimated_weight_kg', 0)
        category_weights[cat] = round(category_weights.get(cat, 0) + w, 1)

    completed_count = status_counts.get("Collected", 0) + status_counts.get("Recycling Completed", 0)
    recycling_rate = round((completed_count / max(total_requests, 1)) * 100, 1)

    trees_saved = round(total_weight_kg * 0.015, 1)
    kwh_energy_saved = round(total_weight_kg * 4.2, 1)
    water_liters_saved = round(total_weight_kg * 12.5, 1)

    return jsonify({
        "status": "success",
        "stats": {
            "total_requests": total_requests,
            "total_users": len(users),
            "total_weight_kg": round(total_weight_kg, 1),
            "total_weight_tonnes": round(total_weight_kg / 1000.0, 3),
            "total_co2_saved_kg": round(total_co2_saved, 1),
            "total_eco_points": total_eco_points,
            "recycling_rate_percent": recycling_rate,
            "trees_saved_estimate": trees_saved,
            "kwh_energy_saved_estimate": kwh_energy_saved,
            "water_liters_saved_estimate": water_liters_saved,
            "status_counts": status_counts,
            "category_weights": category_weights
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
