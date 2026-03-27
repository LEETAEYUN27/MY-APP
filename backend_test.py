#!/usr/bin/env python3
"""
Info-Secretary Backend API Testing
Tests all backend APIs including auth, interests, sources, feed, notifications, and profile.
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, List, Optional

class InfoSecretaryAPITester:
    def __init__(self, base_url="https://info-secretary.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = None
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
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
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = self.session.headers.copy()
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if success:
                self.log_test(name, True)
                print(f"   Status: {response.status_code}")
                if response_data and isinstance(response_data, dict):
                    print(f"   Response keys: {list(response_data.keys())}")
            else:
                details = f"Expected {expected_status}, got {response.status_code}"
                if response_data:
                    details += f" - {response_data}"
                self.log_test(name, False, details)
                print(f"   Status: {response.status_code}")
                print(f"   Response: {response_data}")

            return success, response_data, response.status_code

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            print(f"   Exception: {str(e)}")
            return False, {}, 0

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION ENDPOINTS")
        print("="*50)

        # Test login with admin credentials
        success, response_data, status = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@example.com", "password": "admin123"}
        )
        
        if success:
            self.user_data = response_data
            print(f"   Logged in as: {response_data.get('name', 'Unknown')} ({response_data.get('email', 'Unknown')})")
        else:
            print("   ⚠️  Admin login failed - this will affect subsequent tests")
            return False

        # Test auth/me endpoint
        self.run_test(
            "Get Current User",
            "GET", 
            "auth/me",
            200
        )

        # Test register endpoint (with new user)
        test_email = f"test_{int(time.time())}@example.com"
        self.run_test(
            "User Registration",
            "POST",
            "auth/register", 
            200,
            data={"email": test_email, "password": "testpass123", "name": "Test User"}
        )

        # Test logout
        self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )

        # Re-login as admin for subsequent tests
        success, response_data, status = self.run_test(
            "Re-login as Admin",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@example.com", "password": "admin123"}
        )
        
        if success:
            self.user_data = response_data

        return True

    def test_interests_endpoints(self):
        """Test interests CRUD endpoints"""
        print("\n" + "="*50)
        print("TESTING INTERESTS ENDPOINTS")
        print("="*50)

        # Get initial interests
        success, interests_data, status = self.run_test(
            "Get Interests List",
            "GET",
            "interests",
            200
        )

        # Create new interest
        interest_data = {
            "category": "youth_benefits",
            "keywords": ["청년지원", "청년혜택", "청년정책"],
            "description": "청년을 위한 정부 지원 정책 정보"
        }
        
        success, created_interest, status = self.run_test(
            "Create Interest",
            "POST",
            "interests",
            200,
            data=interest_data
        )

        interest_id = None
        if success and created_interest:
            interest_id = created_interest.get("id")
            print(f"   Created interest ID: {interest_id}")

        # Get interests again to verify creation
        self.run_test(
            "Get Interests After Creation",
            "GET",
            "interests",
            200
        )

        # Update interest if we have an ID
        if interest_id:
            update_data = {
                "description": "업데이트된 청년 정책 정보"
            }
            self.run_test(
                "Update Interest",
                "PUT",
                f"interests/{interest_id}",
                200,
                data=update_data
            )

            # Delete interest
            self.run_test(
                "Delete Interest",
                "DELETE",
                f"interests/{interest_id}",
                200
            )

    def test_sources_endpoints(self):
        """Test sources endpoints"""
        print("\n" + "="*50)
        print("TESTING SOURCES ENDPOINTS")
        print("="*50)

        # Get sources list
        success, sources_data, status = self.run_test(
            "Get Sources List",
            "GET",
            "sources",
            200
        )

        # Toggle a source if available
        if success and sources_data and len(sources_data) > 0:
            source_id = sources_data[0].get("id")
            if source_id:
                print(f"   Testing toggle for source: {source_id}")
                self.run_test(
                    "Toggle Source",
                    "PUT",
                    f"sources/{source_id}",
                    200
                )

    def test_feed_endpoints(self):
        """Test feed endpoints"""
        print("\n" + "="*50)
        print("TESTING FEED ENDPOINTS")
        print("="*50)

        # Get current feed
        self.run_test(
            "Get Feed List",
            "GET",
            "feed",
            200
        )

        # Test feed refresh (this involves web scraping and AI)
        print("   ⏳ Testing feed refresh (may take 10-30 seconds due to web scraping + AI)...")
        success, refresh_data, status = self.run_test(
            "Refresh Feed",
            "POST",
            "feed/refresh",
            200
        )

        if success:
            print(f"   Feed refresh result: {refresh_data.get('message', 'Unknown')}")
            count = refresh_data.get('count', 0)
            print(f"   Articles found: {count}")

        # Get feed again after refresh
        self.run_test(
            "Get Feed After Refresh",
            "GET",
            "feed",
            200
        )

    def test_notifications_endpoints(self):
        """Test notifications endpoints"""
        print("\n" + "="*50)
        print("TESTING NOTIFICATIONS ENDPOINTS")
        print("="*50)

        # Get notifications
        success, notifications_data, status = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200
        )

        # Get unread count
        self.run_test(
            "Get Unread Count",
            "GET",
            "notifications/unread-count",
            200
        )

        # Mark all as read
        self.run_test(
            "Mark All Notifications Read",
            "PUT",
            "notifications/read-all",
            200
        )

    def test_profile_endpoints(self):
        """Test profile endpoints"""
        print("\n" + "="*50)
        print("TESTING PROFILE ENDPOINTS")
        print("="*50)

        # Update profile
        profile_data = {
            "name": "Updated Admin Name"
        }
        
        self.run_test(
            "Update Profile",
            "PUT",
            "profile",
            200,
            data=profile_data
        )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Info-Secretary Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Test authentication first
        auth_success = self.test_auth_endpoints()
        if not auth_success:
            print("\n❌ Authentication tests failed - stopping here")
            return False

        # Test other endpoints
        self.test_interests_endpoints()
        self.test_sources_endpoints()
        self.test_feed_endpoints()
        self.test_notifications_endpoints()
        self.test_profile_endpoints()

        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r["success"]]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        print(f"\n🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = InfoSecretaryAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        # Save detailed results
        with open("/app/backend_test_results.json", "w", encoding="utf-8") as f:
            json.dump({
                "summary": {
                    "tests_run": tester.tests_run,
                    "tests_passed": tester.tests_passed,
                    "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                    "timestamp": datetime.now().isoformat()
                },
                "results": tester.test_results
            }, f, indent=2, ensure_ascii=False)
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())