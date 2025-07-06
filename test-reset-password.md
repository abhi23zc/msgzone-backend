# Reset Password Functionality - Backend Implementation

## Overview
The reset password functionality has been implemented in the backend with the following components:

### 1. User Schema Updates
- Added `resetPasswordOtp` field to store OTP for password reset
- Added bcrypt password hashing with pre-save middleware
- Added `matchPassword` method for password comparison

### 2. API Endpoints

#### POST `/api/v1/auth/forgot-password`
- **Purpose**: Request password reset OTP
- **Body**: `{ "email": "user@example.com" }`
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Password reset OTP sent to your email"
  }
  ```

#### POST `/api/v1/auth/verify-reset-otp`
- **Purpose**: Verify the OTP and get reset token
- **Body**: `{ "email": "user@example.com", "otp": "123456" }`
- **Response**:
  ```json
  {
    "success": true,
    "message": "OTP verified successfully",
    "data": {
      "resetToken": "jwt_token_here"
    }
  }
  ```

#### POST `/api/v1/auth/reset-password`
- **Purpose**: Reset password using the reset token
- **Body**: `{ "resetToken": "jwt_token_here", "newPassword": "newpassword123" }`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password reset successful"
  }
  ```

### 3. Email System
- Uses BullMQ for email queuing
- Redis for job processing
- Custom email templates for password reset
- OTP expires in 10 minutes
- Reset token expires in 15 minutes

### 4. Security Features
- Password hashing with bcrypt (salt rounds: 10)
- JWT tokens for secure password reset
- OTP expiration
- Password strength validation (minimum 6 characters)
- Rate limiting through BullMQ

## Testing the API

### Step 1: Request Password Reset
```bash
curl -X POST http://localhost:8080/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Step 2: Check Email for OTP
- Check the email inbox for the 6-digit OTP
- OTP is valid for 10 minutes

### Step 3: Verify OTP
```bash
curl -X POST http://localhost:8080/api/v1/auth/verify-reset-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp": "123456"}'
```

### Step 4: Reset Password
```bash
curl -X POST http://localhost:8080/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"resetToken": "jwt_token_from_step_3", "newPassword": "newpassword123"}'
```

## Prerequisites
1. Redis server running
2. Email configuration in `.env`:
   ```
   EMAIL=your-email@gmail.com
   PASS=your-app-password
   JWT_SECRET=your-jwt-secret
   ```
3. bcrypt package installed: `npm install bcrypt`

## Error Handling
- Invalid email: 404 User not found
- Invalid OTP: 400 Invalid OTP
- Expired OTP: 400 OTP has expired
- Invalid reset token: 401 Invalid or expired reset token
- Weak password: 400 Password must be at least 6 characters long 