# 📁 Student Profile Picture Google Drive Configuration

## Overview
Student profile pictures are automatically uploaded to Google Drive when students update their profile photos.

## Current Configuration
The Google Drive folder ID is configured via environment variable:
- **Variable Name**: `VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID`
- **Location**: `.env` file in project root

## 🔧 How to Update the Folder

### Step 1: Get the Folder ID
From your Google Drive URL:
```
https://drive.google.com/drive/folders/1vwD_S2ZwD7NO_p7Njv0Fnl8w8-kVXTE6?usp=sharing
```

The Folder ID is: **`1vwD_S2ZwD7NO_p7Njv0Fnl8w8-kVXTE6`**

### Step 2: Update the .env File
Open `.env` file in the project root and update:

```env
VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID=1vwD_S2ZwD7NO_p7Njv0Fnl8w8-kVXTE6
```

### Step 3: Restart Development Server
After updating the `.env` file:
```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

## 📝 Important Notes

1. **Folder Permissions**: Make sure the Google Drive folder has proper sharing permissions
   - The service account or OAuth credentials must have write access
   - Recommended: Share with "Anyone with the link can edit"

2. **Both Dashboards Use Same Variable**:
   - Student Dashboard: Uses `VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID`
   - Teacher Dashboard: Uses `VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID`
   - Both save to the SAME folder

3. **File Naming Convention**:
   - Student photos: `student_[email]_[timestamp].jpg`
   - Teacher photos: `teacher_[email]_[timestamp].jpg`

## 🔍 Where It's Used

### Student Dashboard
**File**: `src/pages/StudentDashboard.tsx`
**Line**: 78
```typescript
const PROFILE_PICTURE_DRIVE_FOLDER_ID = import.meta.env.VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID;
```

**Upload Function**: Line 2040
```typescript
const link = await uploadFileToDrive(file, PROFILE_PICTURE_DRIVE_FOLDER_ID);
```

### Teacher Dashboard
**File**: `src/pages/TeacherDashboard.tsx`
**Line**: 147
```typescript
const PROFILE_PICTURE_DRIVE_FOLDER_ID = import.meta.env.VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID;
```

**Upload Function**: Line 1288
```typescript
const link = await uploadFileToDrive(file, PROFILE_PICTURE_DRIVE_FOLDER_ID);
```

## ✅ Verification Steps

After updating the folder ID:

1. **Test Student Upload**:
   - Login as a student
   - Go to profile settings
   - Upload a profile picture
   - Check the Google Drive folder for the uploaded file

2. **Test Teacher Upload**:
   - Login as a teacher
   - Go to profile settings
   - Upload a profile picture
   - Check the Google Drive folder for the uploaded file

3. **Verify File Access**:
   - The uploaded file URL should be publicly accessible
   - The image should display in the dashboard

## 🚨 Troubleshooting

### Issue: "Failed to upload profile picture"
**Solution**: 
- Check Google Drive folder permissions
- Verify the folder ID is correct
- Ensure OAuth credentials have Drive API access

### Issue: Image not displaying after upload
**Solution**:
- Check if the Drive link is publicly accessible
- Verify the sharing settings of the folder
- Check browser console for CORS errors

### Issue: Environment variable not updating
**Solution**:
- Make sure you restarted the dev server
- Clear browser cache
- Check if `.env` file is in the correct location (project root)

## 📋 Complete .env Template

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Google Drive Folder IDs
VITE_DRIVE_FOLDER_ID=your_general_drive_folder_id
VITE_ASSIGNMENT_DRIVE_FOLDER_ID=your_assignment_folder_id
VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID=1vwD_S2ZwD7NO_p7Njv0Fnl8w8-kVXTE6

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## 🎯 Quick Action

**To update to the new folder immediately:**

1. Open `.env` file
2. Find the line with `VITE_PROFILE_PICTURE_DRIVE_FOLDER_ID`
3. Replace the value with: `1vwD_S2ZwD7NO_p7Njv0Fnl8w8-kVXTE6`
4. Save the file
5. Restart your development server

Done! ✅

---

**Last Updated**: December 27, 2025  
**Folder ID**: `1vwD_S2ZwD7NO_p7Njv0Fnl8w8-kVXTE6`
