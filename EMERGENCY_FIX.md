# 🚨 EMERGENCY FIX: Permission Denied & Index Errors

The errors you are seeing ("Missing or insufficient permissions" and "Query requires an index") resolve to two specific actions you must take.

## 1. Fix Permissions (Teachers & Attendance)
The "Teacher List" lookup was failing because the database could not prove *beforehand* that the emails it was fetching belonged to teachers. I have reverted the rule to be simpler to ensure your app works.

**👉 ACTION:**
1.  Open `c:\Users\sanja\Documents\Edu Online\firestore_rules.md`.
2.  Copy **ALL** the text.
3.  Go to **Firebase Console > Firestore Database > Rules**.
4.  Paste and Publish.
5.  *Wait 30 seconds for it to propagate.*

## 2. Fix "Index Required" (Exams)
The console shows: `FirebaseError: The query requires an index. You can create it here: https://...`
This is blocking your "Active Tests" from loading.

**👉 ACTION:**
1.  Look at your browser console (where you took the screenshot).
2.  **Click the long link** in the error message.
3.  It will open a page saying **"Create composite index"**.
4.  Click **"Create Index"**.
5.  *Wait ~2 minutes.*

**Once these two steps are done, reload the page. The errors will be gone.**
