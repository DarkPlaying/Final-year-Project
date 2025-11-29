# 🎓 Edu Online - Smart Education Management System

Edu Online is a comprehensive, role-based education management platform designed to streamline the interaction between Administrators, Teachers, and Students. Built with modern web technologies and powered by Firebase, it offers a secure, real-time, and AI-enhanced learning environment.

## 🚀 Features

### 🛡️ Admin Dashboard
- **User Management**: Create, update, and delete users (Students, Teachers, Admins) with secure Firebase Authentication.
- **Workspace Management**: Organize classes or departments into Workspaces.
- **Analytics**: View real-time statistics on user growth and system usage.
- **Security**: Force logout for deleted users to maintain system integrity.
- **System Logs**: Track important administrative actions.

### 👨‍🏫 Teacher Dashboard
- **Course Management**: Upload and manage Syllabi and Announcements.
- **Exam Management**: Create exams and assignments.
- **AI Test Generator**: Generate quiz questions automatically using AI.
- **Grading**: Review student submissions and assign grades.
- **Attendance**: (Integration pending) Monitor student attendance.

### 👨‍🎓 Student Dashboard
- **Personalized View**: Access assigned workspaces and courses.
- **Exam Portal**: Take exams and submit assignments online.
- **Resource Access**: Download syllabi and view announcements.
- **Progress Tracking**: View marks and feedback on submissions.
- **UNOM Report**: Submit and view University marks.

## 🛠️ Tech Stack

- **Frontend**: [React](https://reactjs.org/) (Vite), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Backend / Database**: [Firebase](https://firebase.google.com/) (Firestore, Authentication, Storage)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **State Management**: React Hooks

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
Create a `.env` file in the root directory and add your Firebase configuration keys. You can find these in your Firebase Console settings.

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Secondary Database (Attendance)
VITE_ATTENDANCE_API_KEY=your_attendance_api_key
VITE_ATTENDANCE_AUTH_DOMAIN=your_attendance_project_id.firebaseapp.com
VITE_ATTENDANCE_PROJECT_ID=your_attendance_project_id
VITE_ATTENDANCE_STORAGE_BUCKET=your_attendance_project_id.firebasestorage.app
VITE_ATTENDANCE_MESSAGING_SENDER_ID=your_attendance_sender_id
VITE_ATTENDANCE_APP_ID=your_attendance_app_id

# Google Drive Integration (Optional)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_DRIVE_FOLDER_ID=your_drive_folder_id
```

### 4. Run Locally
```bash
npm run dev
```
The application will start at `http://localhost:8080` (or similar).

## 🔐 Firebase Configuration

### Authentication
1.  Go to Firebase Console -> Authentication.
2.  Enable **Email/Password** provider.
3.  Manually create your first **Admin** account in the Authentication tab.
4.  Copy the **User UID** of the new admin.
5.  Go to Firestore Database -> `users` collection.
6.  Create a document with ID = `User UID` and fields:
    - `email`: `admin@example.com`
    - `role`: `admin`
    - `email_lower`: `admin@example.com`

### Security Rules
This project uses strict Firestore Security Rules.
1.  Copy the rules from `firestore_rules.md` in this repository.
2.  Paste them into your Firebase Console -> Firestore Database -> Rules.

## 📂 Project Structure

```
src/
├── components/     # Reusable UI components (Buttons, Cards, Layouts)
├── lib/            # Utilities (Firebase config, Security, Helper functions)
├── pages/          # Main application pages (Login, Dashboards)
├── types/          # TypeScript interface definitions
├── App.tsx         # Main routing logic
└── main.tsx        # Entry point
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
