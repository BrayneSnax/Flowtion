import requests
import json
from datetime import datetime

def test_ai_integrations():
    """Test AI integrations with both Hermes and OpenAI"""
    base_url = "https://idea-resonance.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Register a user first
    timestamp = datetime.now().strftime('%H%M%S')
    register_data = {
        "name": f"Maya Patel {timestamp}",
        "email": f"maya.patel{timestamp}@techcorp.com",
        "password": "Innovation2024!"
    }
    
    print("🤖 Testing AI Integrations")
    
    # Register and get token
    response = requests.post(f"{api_url}/auth/register", json=register_data, timeout=10)
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.text}")
        return False
    
    token = response.json()['token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    print("✅ User registered and authenticated")
    
    # Test inputs for different scenarios
    test_scenarios = [
        {
            "name": "Morning Rituals Exploration",
            "text": "I want to start exploring morning rituals",
            "frequency": "reflect"
        },
        {
            "name": "Creative Project Planning", 
            "text": "I'm thinking about starting a creative writing project",
            "frequency": "dream"
        },
        {
            "name": "Work-Life Balance",
            "text": "How can I better balance my work and personal life?",
            "frequency": "synthesize"
        }
    ]
    
    for scenario in test_scenarios:
        print(f"\n📝 Testing Scenario: {scenario['name']}")
        
        # Test with Hermes
        hermes_data = {
            "text": scenario["text"],
            "current_frequency": scenario["frequency"],
            "model_preference": "hermes"
        }
        
        print(f"\n🔮 Testing Hermes 4...")
        response = requests.post(f"{api_url}/converse", json=hermes_data, headers=headers, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Hermes response received")
            print(f"   Message: {result.get('message', '')[:100]}...")
            print(f"   Action: {result.get('action', 'N/A')}")
            print(f"   Nodes created: {len(result.get('nodes', []))}")
            
            # Check for natural language (not JSON structure)
            message = result.get('message', '')
            if message and not message.startswith('{') and not message.startswith('['):
                print("   ✓ Response is natural language")
            else:
                print("   ⚠ Response may be structured data instead of natural language")
        else:
            print(f"❌ Hermes failed: {response.text}")
        
        # Test with OpenAI
        openai_data = {
            "text": scenario["text"],
            "current_frequency": scenario["frequency"],
            "model_preference": "openai"
        }
        
        print(f"\n🧠 Testing OpenAI...")
        response = requests.post(f"{api_url}/converse", json=openai_data, headers=headers, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ OpenAI response received")
            print(f"   Message: {result.get('message', '')[:100]}...")
            print(f"   Action: {result.get('action', 'N/A')}")
            print(f"   Nodes created: {len(result.get('nodes', []))}")
            
            # Check for natural language
            message = result.get('message', '')
            if message and not message.startswith('{') and not message.startswith('['):
                print("   ✓ Response is natural language")
            else:
                print("   ⚠ Response may be structured data instead of natural language")
        else:
            print(f"❌ OpenAI failed: {response.text}")
    
    # Test pattern insights after creating some data
    print(f"\n🔍 Testing Pattern Insights...")
    
    # Hermes insights
    response = requests.get(f"{api_url}/patterns/insights?model=hermes", headers=headers, timeout=10)
    if response.status_code == 200:
        insights = response.json().get('insights', [])
        print(f"✅ Hermes insights: {len(insights)} insights")
        if insights:
            print(f"   Sample: {insights[0][:100]}...")
    else:
        print(f"❌ Hermes insights failed: {response.text}")
    
    # OpenAI insights  
    response = requests.get(f"{api_url}/patterns/insights?model=openai", headers=headers, timeout=10)
    if response.status_code == 200:
        insights = response.json().get('insights', [])
        print(f"✅ OpenAI insights: {len(insights)} insights")
        if insights:
            print(f"   Sample: {insights[0][:100]}...")
    else:
        print(f"❌ OpenAI insights failed: {response.text}")
    
    return True

if __name__ == "__main__":
    test_ai_integrations()