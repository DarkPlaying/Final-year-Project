# 🎓 Edu Online - Smart Education Management System

> **A scalable, cost-optimized, and role-based platform for modern educational institutions.**

Edu Online is a comprehensive education management platform designed to streamline the interaction between Administrators, Teachers, and Students. Built with modern web technologies and powered by a highly optimized Firebase architecture, it offers a secure, real-time, and AI-enhanced learning environment for less than **$0.20 per month** at scale.

---

## 🚀 Key Features

### 🛡️ Admin Dashboard
- **User Management**: Centralized control to create, update, and manage Students, Teachers, and Admins.
- **Workspace Management**: Organize classes and departments into isolated Workspaces.
- **Real-time Analytics**: View system usage stats and user growth in real-time.
- **Security & Logs**: Track sensitive actions and force-logout compromised accounts.

### 👨‍🏫 Teacher Dashboard
- **Attendance Management**: 
  - Mark daily attendance for classes.
  - **"Last Seen" Presence**: Real-time status indicators (Online/Offline) for students.
  - **Auto-Calculated Stats**: See attendance percentages instantly (cached for performance).
- **Course Management**: Upload Syllabi and Announcements (stored in Google Drive to save costs).
- **Assignments & Grading**: 
  - Create assignments with Google Drive attachments.
  - Bulk grading interface for efficiency.
  - 60-day rolling window optimization for fast loading.
- **Exams**: Schedule exams and notify students.
- **Reports**: Generate Excel/CSV reports for Marks, Attendance, and UNOM.

### 👨‍🎓 Student Dashboard
- **Smart Classroom**: Access assigned workspaces, assignments, and exams.
- **Submission Portal**: Submit assignments directly (files uploded to Google Drive).
- **Performance Tracking**: View graded marks, feedback, and attendance stats.
- **University Reporting**: Manage and submit UNOM marks.
- **Notifications**: Real-time alerts for new assignments and announcements.

---

## 💰 Cost Efficiency & Architecture

One of the standout features of Edu Online is its **Optimized Cloud Architecture**.

- **Monthly Operating Cost:** **~$0.14 USD** (for 2,000 students)
- **Database Reads Reduction:** **98%** (via smart caching & rolling windows)
- **Scalability:** Capable of handling **5,000+ students** for under $1/month.

### Optimization Techniques Used:
1.  **60-Day Rolling Windows:** Assignment queries are limited to recent data to prevent read spikes.
2.  **Stats Caching:** Attendance statistics are aggregated into single documents, preventing expensive "count-all" queries.
3.  **Google Drive Storage:** Heavy files (PDFs, Images) are offloaded to Google Drive API, bypassing Firebase Storage costs.
4.  **Incremental Updates:** Stats are updated in real-time increments rather than full recalculations.

---

## 🛠️ Tech Stack

- **Frontend**: [React](https://reactjs.org/) (Vite), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Backend**: [Firebase](https://firebase.google.com/) (Firestore, Auth, Realtime DB, Messaging)
- **Storage**: [Google Drive API](https://developers.google.com/drive) (Optimization)
- **Reports**: `ExcelJS` (Spreadsheets) & `jsPDF` (PDF Generation)
- **State Management**: React Hooks & Context API
- **Icons**: Lucide React

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/DarkPlaying/Final-year-Project.git
cd Final-year-Project
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory.

```env
# Primary Firebase Project (Auth & Data)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Google Drive Integration (Required for File Uploads)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_DRIVE_FOLDER_ID=your_drive_folder_id
```

### 4. Run Locally
```bash
npm run dev
```

---

## 🔐 Security & Permissions

- **Role-Based Access Control (RBAC):** Strict separation of Admin, Teacher, and Student data.
- **Firestore Rules:** Custom security rules ensure users can only access their own or their class's data.
- **Google Auth:** Secure authentication flow.

---

## 📂 Project Structure

```
src/
├── components/     # UI Components (Buttons, Dialogs, Charts)
├── hooks/          # Custom Hooks (usePresence, useAuth)
├── lib/            # Firebase & Drive Configuration
├── pages/          # Dashboards (Admin, Teacher, Student)
└── types/          # TypeScript Interfaces
```

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
