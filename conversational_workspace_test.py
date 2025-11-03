import requests
import sys
import json
from datetime import datetime
import time

class ConversationalWorkspaceAPITester:
    def __init__(self, base_url="https://idea-resonance.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_nodes = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json() if response.content else {}
                    self.log_test(name, True)
                    return True, response_data
                except:
                    self.log_test(name, True)
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json().get('detail', '')
                    if error_detail:
                        error_msg += f" - {error_detail}"
                    print(f"   Response: {response.text[:200]}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        
        if success and 'message' in response:
            print(f"   Message: {response['message']}")
            return True
        return False

    def test_auth_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "name": f"Sarah Chen {timestamp}",
            "email": f"sarah.chen{timestamp}@creativestudio.com",
            "password": "CreativeFlow2024!"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            print(f"   User ID: {self.user_id}")
            print(f"   User Name: {response['user']['name']}")
            return True
        return False

    def test_auth_login(self):
        """Test user login with registered credentials"""
        if not self.user_id:
            self.log_test("User Login", False, "No registered user available")
            return False
            
        # Use the same credentials from registration
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "email": f"sarah.chen{timestamp}@creativestudio.com",
            "password": "CreativeFlow2024!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=test_data
        )
        
        if success and 'token' in response:
            print(f"   Login successful for: {response['user']['name']}")
            return True
        return False

    def test_token_verification(self):
        """Test JWT token works for protected endpoints"""
        if not self.token:
            self.log_test("Token Verification", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Token Verification (Get Nodes)",
            "GET",
            "nodes",
            200
        )
        
        if success:
            print(f"   Token verified - nodes endpoint accessible")
            return True
        return False

    def test_converse_hermes(self):
        """Test conversational building with Hermes 4"""
        if not self.token:
            self.log_test("Converse with Hermes", False, "No token available")
            return False

        test_data = {
            "text": "I want to start exploring morning rituals",
            "current_frequency": "reflect",
            "model_preference": "hermes"
        }
        
        success, response = self.run_test(
            "Converse with Hermes 4",
            "POST",
            "converse",
            200,
            data=test_data
        )
        
        if success:
            # Verify response structure
            if 'message' in response and isinstance(response['message'], str):
                print(f"   Natural language response: {response['message'][:100]}...")
                
                # Check if nodes were created
                if 'nodes' in response and len(response['nodes']) > 0:
                    print(f"   Created {len(response['nodes'])} nodes")
                    
                    # Verify spiral positioning
                    for i, node in enumerate(response['nodes']):
                        if 'position' in node and 'x' in node['position'] and 'y' in node['position']:
                            print(f"   Node {i+1} position: x={node['position']['x']:.1f}, y={node['position']['y']:.1f}")
                            self.created_nodes.append(node['id'])
                        else:
                            self.log_test("Converse with Hermes", False, "Node missing position data")
                            return False
                    
                    # Verify action type
                    if 'action' in response:
                        print(f"   Action: {response['action']}")
                    
                    return True
                else:
                    print("   No nodes created (this may be expected based on AI response)")
                    return True
            else:
                self.log_test("Converse with Hermes", False, "Response missing natural language message")
                return False
        return False

    def test_converse_openai(self):
        """Test conversational building with OpenAI"""
        if not self.token:
            self.log_test("Converse with OpenAI", False, "No token available")
            return False

        test_data = {
            "text": "I want to start exploring morning rituals",
            "current_frequency": "reflect", 
            "model_preference": "openai"
        }
        
        success, response = self.run_test(
            "Converse with OpenAI",
            "POST",
            "converse",
            200,
            data=test_data
        )
        
        if success:
            # Verify response structure
            if 'message' in response and isinstance(response['message'], str):
                print(f"   Natural language response: {response['message'][:100]}...")
                
                # Check if nodes were created
                if 'nodes' in response and len(response['nodes']) > 0:
                    print(f"   Created {len(response['nodes'])} nodes")
                    
                    # Store node IDs for later tests
                    for node in response['nodes']:
                        self.created_nodes.append(node['id'])
                    
                    return True
                else:
                    print("   No nodes created (this may be expected based on AI response)")
                    return True
            else:
                self.log_test("Converse with OpenAI", False, "Response missing natural language message")
                return False
        return False

    def test_get_all_nodes(self):
        """Test getting all nodes"""
        if not self.token:
            self.log_test("Get All Nodes", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get All Nodes",
            "GET",
            "nodes",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   Retrieved {len(response)} nodes")
                
                # Verify node structure
                if len(response) > 0:
                    node = response[0]
                    required_fields = ['id', 'user_id', 'title', 'frequency', 'position']
                    for field in required_fields:
                        if field not in node:
                            self.log_test("Get All Nodes", False, f"Node missing required field: {field}")
                            return False
                    print(f"   Sample node: {node['title'][:50]}...")
                
                return True
            else:
                self.log_test("Get All Nodes", False, "Response is not a list")
                return False
        return False

    def test_get_nodes_by_frequency(self):
        """Test getting nodes filtered by frequency"""
        if not self.token:
            self.log_test("Get Nodes by Frequency", False, "No token available")
            return False
            
        frequencies = ["reflect", "focus", "dream", "synthesize"]
        
        for frequency in frequencies:
            success, response = self.run_test(
                f"Get Nodes by Frequency ({frequency})",
                "GET",
                f"nodes/{frequency}",
                200
            )
            
            if success:
                if isinstance(response, list):
                    print(f"   Retrieved {len(response)} nodes for frequency '{frequency}'")
                    
                    # Verify all nodes have the correct frequency
                    for node in response:
                        if node.get('frequency') != frequency:
                            self.log_test(f"Get Nodes by Frequency ({frequency})", False, 
                                        f"Node has wrong frequency: {node.get('frequency')}")
                            return False
                else:
                    self.log_test(f"Get Nodes by Frequency ({frequency})", False, "Response is not a list")
                    return False
            else:
                return False
        
        return True

    def test_update_node(self):
        """Test updating a node"""
        if not self.token:
            self.log_test("Update Node", False, "No token available")
            return False
            
        if not self.created_nodes:
            self.log_test("Update Node", False, "No nodes available to update")
            return False
        
        node_id = self.created_nodes[0]
        update_data = {
            "title": "Updated Morning Ritual Exploration",
            "content": "Exploring the power of intentional morning practices",
            "tags": ["morning", "ritual", "mindfulness"]
        }
        
        success, response = self.run_test(
            "Update Node",
            "PATCH",
            f"nodes/{node_id}",
            200,
            data=update_data
        )
        
        if success:
            # Verify the update was applied
            if 'title' in response and response['title'] == update_data['title']:
                print(f"   Node updated successfully: {response['title']}")
                return True
            else:
                self.log_test("Update Node", False, "Update not reflected in response")
                return False
        return False

    def test_pattern_insights_hermes(self):
        """Test pattern insights with Hermes model"""
        if not self.token:
            self.log_test("Pattern Insights (Hermes)", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Pattern Insights (Hermes)",
            "GET",
            "patterns/insights?model=hermes",
            200
        )
        
        if success:
            if 'insights' in response:
                insights = response['insights']
                if isinstance(insights, list):
                    print(f"   Retrieved {len(insights)} insights")
                    
                    # Check for affective, warm language
                    if len(insights) > 0:
                        insight_text = insights[0]
                        print(f"   Sample insight: {insight_text[:100]}...")
                        
                        # Look for warm, embodied language patterns
                        warm_indicators = ['rhythm', 'flow', 'feel', 'sense', 'quality', 'texture', 'breath']
                        has_warm_language = any(indicator in insight_text.lower() for indicator in warm_indicators)
                        
                        if has_warm_language:
                            print("   ✓ Insight contains affective, warm language")
                        else:
                            print("   ⚠ Insight may lack expected warm, embodied language")
                    
                    return True
                else:
                    self.log_test("Pattern Insights (Hermes)", False, "Insights is not a list")
                    return False
            else:
                # Empty insights is acceptable if user has insufficient data
                print("   No insights available (may be expected for new user)")
                return True
        return False

    def test_pattern_insights_openai(self):
        """Test pattern insights with OpenAI model"""
        if not self.token:
            self.log_test("Pattern Insights (OpenAI)", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Pattern Insights (OpenAI)",
            "GET",
            "patterns/insights?model=openai",
            200
        )
        
        if success:
            if 'insights' in response:
                insights = response['insights']
                if isinstance(insights, list):
                    print(f"   Retrieved {len(insights)} insights")
                    
                    if len(insights) > 0:
                        insight_text = insights[0]
                        print(f"   Sample insight: {insight_text[:100]}...")
                    
                    return True
                else:
                    self.log_test("Pattern Insights (OpenAI)", False, "Insights is not a list")
                    return False
            else:
                # Empty insights is acceptable if user has insufficient data
                print("   No insights available (may be expected for new user)")
                return True
        return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Conversational AI Workspace Backend Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 70)

        # Test basic connectivity
        if not self.test_api_root():
            print("❌ API root failed - stopping tests")
            return False

        # Test authentication flow
        if not self.test_auth_register():
            print("❌ Registration failed - stopping tests")
            return False

        if not self.test_auth_login():
            print("❌ Login failed - continuing with other tests")

        if not self.test_token_verification():
            print("❌ Token verification failed - stopping tests")
            return False

        # Test conversational building
        print("\n🤖 Testing Conversational Building...")
        self.test_converse_hermes()
        self.test_converse_openai()

        # Test node management
        print("\n📝 Testing Node Management...")
        self.test_get_all_nodes()
        self.test_get_nodes_by_frequency()
        self.test_update_node()

        # Test pattern insights
        print("\n🔍 Testing Pattern Insights...")
        self.test_pattern_insights_hermes()
        self.test_pattern_insights_openai()

        # Print summary
        print("\n" + "=" * 70)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_tests} tests failed")
            
            # Show failed tests
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['details']}")
            
            return False

def main():
    tester = ConversationalWorkspaceAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/conversational_workspace_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())