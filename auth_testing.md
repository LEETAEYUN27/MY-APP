# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), login_attempts.identifier.

## Step 2: API Testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
```

## Credentials
- Admin: admin@example.com / admin123
