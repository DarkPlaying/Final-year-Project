# 🔔 **Notification Troubleshooting Guide**

## ✅ **What I Added:**

### 1. **Test Notification Button** 
- **Location**: Header (next to Refresh button)
- **Visibility**: Only shows if notifications are enabled
- **Function**: Sends a test browser notification

---

## 🧪 **How to Test:**

### Step 1: **Check Permission Status**
1. Open Student Dashboard
2. Press **F12** → **Console** tab
3. Type: `Notification.permission`
4. Press **Enter**

**Expected Results**:
- `"granted"` ✅ - Notifications allowed
- `"default"` ⚠️ - Not set (prompt will appear)
- `"denied"` ❌ - Blocked (need to fix manually)

---

### Step 2: **Enable Notifications**
If status is `"default"` or `"denied"`:

1. Click the **🔒 lock icon** in browser address bar
2. Find **"Notifications"**
3. Change to **"Allow"**
4. **Refresh the page** (F5)

---

### Step 3: **Test the Button**
Once notifications are enabled (`"granted"`):

1. Look for **"Test"** button in the header (blue, with bell icon)
2. Click **"Test"** button
3. You should see:
   - ✅ Toast message: "Test notification sent!"
   - ✅ **System notification** popup: "🔔 Test Notification"

**If you see both** → Notifications are working! ✅

---

## 🐛 **Common Issues & Fixes:**

### Issue 1: **No Test Button Visible**
**Cause**: Notifications not enabled

**Fix**:
1. Check browser permissions (Step 1 above)
2. Enable notifications (Step 2 above)
3. Refresh page
4. Button should appear

---

### Issue 2: **Toast Shows But No System Notification**
**Cause**: Browser notification blocked by OS or browser

**Fix**:

#### **Windows**:
1. Open **Settings** → **Notifications**
2. Ensure browser (Chrome/Edge) is allowed
3. Check "Focus Assist" is off

#### **Mac**:
1. **System Preferences** → **Notifications**
2. Find your browser
3. Enable "Allow Notifications"

#### **Chrome/Edge**:
1. **Settings** → **Privacy and security** → **Site settings**
2. **Notifications**
3. Find your site (localhost:8080)
4. Ensure it's "Allow"

---

### Issue 3: **"Notifications are blocked" Error**
**Cause**: Permission denied in browser

**Fix**:
1. Click 🔒 **lock icon** in address bar
2. **Reset permissions** for the site
3. **Refresh page** (F5)
4. Click **"Enable Notifications"** when prompted
5. Select **"Allow"**

---

### Issue 4: **Background Notifications Not Working**
**Cause**: Service worker not registered

**Fix**:
1. Press **F12** → **Application** tab
2. Left sidebar → **Service Workers**
3. Check if `firebase-messaging-sw.js` is registered
4. If not, try:
   ```javascript
   // In console:
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.unregister());
   });
   // Then refresh page
   ```

---

## 🔍 **Debugging Steps:**

### Check 1: **FCM Token Saved?**
```javascript
// In console:
firebase.firestore().collection('users').doc('YOUR_USER_ID').get()
  .then(doc => console.log('FCM Token:', doc.data().fcmToken));
```

Should show a long token string. If null, token not saved.

---

### Check 2: **RTDB Token Saved?**
```javascript
// In console:
firebase.database().ref('users/YOUR_USER_ID/fcmToken').once('value')
  .then(snap => console.log('RTDB Token:', snap.val()));
```

Should match Firestore token.

---

### Check 3: **Service Worker Active?**
```javascript
// In console:
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log('Service Workers:', regs.length));
```

Should show `1` or more.

---

### Check 4: **Message Listener Active?**
```javascript
// Check console logs when test button is clicked
// Should see: "Test notification sent!"
```

---

## 📋 **Checklist:**

Before reporting an issue, verify:

- [ ] Browser notifications enabled (not "denied")
- [ ] Test button visible in header
- [ ] Test button shows toast message
- [ ] System notification appears
- [ ] FCM token saved in Firestore
- [ ] FCM token saved in RTDB
- [ ] Service worker registered
- [ ] No console errors

---

## 🎯 **Expected Behavior:**

### **Foreground (Tab Open)**:
- ✅ Toast notification (in-app)
- ❌ System notification (only if tab hidden)

### **Background (Tab Closed/Hidden)**:
- ✅ System notification popup
- ✅ Clicking notification opens app

---

## 🔥 **Production Checklist:**

When deploying:

1. ✅ Service worker in `/public/`
2. ✅ VAPID key configured
3. ✅ Firebase config correct
4. ✅ HTTPS enabled (required for notifications)
5. ✅ Notification service running on Render
6. ✅ RTDB rules allow write to `/users/{userId}/fcmToken`

---

## 🚨 **Emergency Fix:**

If nothing works:

```javascript
// Reset everything:
localStorage.clear();
sessionStorage.clear();
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
// Then refresh page and try again
```

---

## 📊 **Logs to Check:**

### Render Dashboard:
- Check if notification service is processing messages
- Look for: `"Successfully sent message: ..."`
- Look for: `"No FCM token found..."` (means token not saved)

### Browser Console:
- `"FCM Token: ..."` - Token generated
- `"Foreground Message received: ..."` - Message received
- `"Test notification sent!"` - Test button working

---

## ✅ **Success Indicators:**

**You know notifications are working when**:

1. ✅ Test button visible
2. ✅ Test button sends notification
3. ✅ Console shows FCM token
4. ✅ Render logs show "Successfully sent message"
5. ✅ System notification appears

---

**Generated**: 2025-12-08  
**Status**: Test button added - Use it to verify notifications!

---

## 🎯 **Quick Test:**

1. Open Student Dashboard
2. Look for blue **"Test"** button in header
3. Click it
4. See notification? ✅ Working!
5. No notification? ❌ Check steps above

**The test button will tell you immediately if notifications are working!** 🔔
