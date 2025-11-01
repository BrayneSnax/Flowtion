import requests
import sys
import json
from datetime import datetime

class NotionAPITester:
    def __init__(self, base_url="https://better-notion.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

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
                except:
                    pass
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_auth_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "password": "TestPass123!"
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
            return True
        return False

    def test_auth_login(self):
        """Test user login with existing credentials"""
        # Try to login with a test account
        test_data = {
            "email": "test@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login (existing user)",
            "POST",
            "auth/login",
            200,
            data=test_data
        )
        
        # If login fails, it's expected since we don't have existing users
        if not success:
            print("   Note: Login failed as expected (no existing user)")
        
        return True  # Don't fail the test suite for this

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Get Current User", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'id' in response:
            print(f"   User ID: {response['id']}")
            print(f"   User Name: {response.get('name', 'N/A')}")
            return True
        return False

    def test_pages_crud(self):
        """Test page CRUD operations"""
        if not self.token:
            self.log_test("Page CRUD", False, "No token available")
            return False

        # Create page
        page_data = {
            "title": "Test Page",
            "icon": "📝",
            "parent_id": None
        }
        
        success, page_response = self.run_test(
            "Create Page",
            "POST",
            "pages",
            200,
            data=page_data
        )
        
        if not success:
            return False
            
        page_id = page_response.get('id')
        if not page_id:
            self.log_test("Create Page", False, "No page ID returned")
            return False

        # Get all pages
        success, pages_response = self.run_test(
            "Get All Pages",
            "GET",
            "pages",
            200
        )
        
        if not success:
            return False

        # Get specific page
        success, get_page_response = self.run_test(
            "Get Specific Page",
            "GET",
            f"pages/{page_id}",
            200
        )
        
        if not success:
            return False

        # Update page
        update_data = {"title": "Updated Test Page"}
        success, update_response = self.run_test(
            "Update Page",
            "PATCH",
            f"pages/{page_id}",
            200,
            data=update_data
        )
        
        if not success:
            return False

        # Create nested page
        nested_page_data = {
            "title": "Nested Page",
            "icon": "📄",
            "parent_id": page_id
        }
        
        success, nested_response = self.run_test(
            "Create Nested Page",
            "POST",
            "pages",
            200,
            data=nested_page_data
        )
        
        nested_page_id = nested_response.get('id') if success else None

        # Delete nested page first
        if nested_page_id:
            success, _ = self.run_test(
                "Delete Nested Page",
                "DELETE",
                f"pages/{nested_page_id}",
                200
            )

        # Delete main page
        success, _ = self.run_test(
            "Delete Page",
            "DELETE",
            f"pages/{page_id}",
            200
        )
        
        return success

    def test_blocks_crud(self):
        """Test block CRUD operations"""
        if not self.token:
            self.log_test("Block CRUD", False, "No token available")
            return False

        # First create a page for blocks
        page_data = {
            "title": "Block Test Page",
            "icon": "🧱"
        }
        
        success, page_response = self.run_test(
            "Create Page for Blocks",
            "POST",
            "pages",
            200,
            data=page_data
        )
        
        if not success:
            return False
            
        page_id = page_response.get('id')

        # Create different types of blocks
        block_types = [
            {"type": "paragraph", "content": "Test paragraph"},
            {"type": "heading1", "content": "Test Heading 1"},
            {"type": "todo", "content": {"text": "Test todo", "checked": False}},
            {"type": "code", "content": "console.log('test');"},
            {"type": "divider", "content": None}
        ]
        
        created_blocks = []
        
        for i, block_data in enumerate(block_types):
            block_create_data = {
                "page_id": page_id,
                "type": block_data["type"],
                "content": block_data["content"],
                "order": i
            }
            
            success, block_response = self.run_test(
                f"Create {block_data['type']} Block",
                "POST",
                "blocks",
                200,
                data=block_create_data
            )
            
            if success and 'id' in block_response:
                created_blocks.append(block_response['id'])

        # Get blocks for page
        success, blocks_response = self.run_test(
            "Get Page Blocks",
            "GET",
            f"blocks/{page_id}",
            200
        )
        
        if success:
            print(f"   Found {len(blocks_response)} blocks")

        # Update a block
        if created_blocks:
            update_data = {"content": "Updated paragraph content"}
            success, _ = self.run_test(
                "Update Block",
                "PATCH",
                f"blocks/{created_blocks[0]}",
                200,
                data=update_data
            )

        # Delete blocks
        for block_id in created_blocks:
            success, _ = self.run_test(
                f"Delete Block {block_id[:8]}",
                "DELETE",
                f"blocks/{block_id}",
                200
            )

        # Clean up page
        success, _ = self.run_test(
            "Delete Block Test Page",
            "DELETE",
            f"pages/{page_id}",
            200
        )
        
        return True

    def test_ai_assist(self):
        """Test AI assistance functionality"""
        if not self.token:
            self.log_test("AI Assist", False, "No token available")
            return False

        ai_requests = [
            {"prompt": "Write a short paragraph about testing", "action": "complete"},
            {"prompt": "This is a test sentence that needs improvement", "action": "improve"},
            {"prompt": "Testing is important for software quality. It helps catch bugs early and ensures reliability. Good tests save time in the long run.", "action": "summarize"}
        ]
        
        for ai_request in ai_requests:
            success, response = self.run_test(
                f"AI Assist - {ai_request['action']}",
                "POST",
                "ai/assist",
                200,
                data=ai_request
            )
            
            if success and 'result' in response:
                print(f"   AI Result: {response['result'][:100]}...")

        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Notion-like App Backend API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)

        # Test basic connectivity
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            if response.status_code == 200:
                print("✅ API is accessible")
            else:
                print(f"⚠️  API returned status {response.status_code}")
        except Exception as e:
            print(f"❌ API connectivity failed: {str(e)}")
            return False

        # Run authentication tests
        if not self.test_auth_register():
            print("❌ Registration failed - stopping tests")
            return False

        self.test_auth_login()
        
        if not self.test_auth_me():
            print("❌ Auth verification failed - stopping tests")
            return False

        # Run CRUD tests
        self.test_pages_crud()
        self.test_blocks_crud()
        
        # Test AI functionality
        self.test_ai_assist()

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = NotionAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
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