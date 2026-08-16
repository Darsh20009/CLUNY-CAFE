#!/bin/bash
# Test login
curl -s -c /tmp/cookies.txt -X POST https://cluny.ma3k.online/api/employees/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"1234","gateway":"1802009"}' | jq .
