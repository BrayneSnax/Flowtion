import requests
import json
from datetime import datetime

def test_login_flow():
    """Test complete registration and login flow"""
    base_url = "https://idea-resonance.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Use consistent credentials
    timestamp = datetime.now().strftime('%H%M%S')
    test_email = f"alex.rivera{timestamp}@designstudio.com"
    test_password = "DesignFlow2024!"
    test_name = f"Alex Rivera {timestamp}"
    
    print("🔐 Testing Complete Auth Flow")
    print(f"📧 Email: {test_email}")
    
    # Step 1: Register
    register_data = {
        "name": test_name,
        "email": test_email,
        "password": test_password
    }
    
    print("\n1️⃣ Testing Registration...")
    response = requests.post(f"{api_url}/auth/register", json=register_data, timeout=10)
    print(f"   Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.text}")
        return False
    
    register_result = response.json()
    print(f"✅ Registration successful")
    print(f"   User ID: {register_result['user']['id']}")
    print(f"   Token: {register_result['token'][:20]}...")
    
    # Step 2: Login with same credentials
    login_data = {
        "email": test_email,
        "password": test_password
    }
    
    print("\n2️⃣ Testing Login...")
    response = requests.post(f"{api_url}/auth/login", json=login_data, timeout=10)
    print(f"   Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return False
    
    login_result = response.json()
    print(f"✅ Login successful")
    print(f"   User ID: {login_result['user']['id']}")
    print(f"   Token: {login_result['token'][:20]}...")
    
    # Step 3: Verify tokens work
    token = login_result['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    print("\n3️⃣ Testing Token Usage...")
    response = requests.get(f"{api_url}/nodes", headers=headers, timeout=10)
    print(f"   Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Token verification failed: {response.text}")
        return False
    
    nodes = response.json()
    print(f"✅ Token works - retrieved {len(nodes)} nodes")
    
    return True

if __name__ == "__main__":
    success = test_login_flow()
    if success:
        print("\n🎉 Complete auth flow working correctly!")
    else:
        print("\n❌ Auth flow has issues")