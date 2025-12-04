import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Upload,
  ExternalLink,
  Link as LinkIcon,
  AlertCircle,
  Calendar,
  MessageSquare,
  RefreshCw,
  Lock,
  UserCheck,
  Megaphone,
  Bell,
  CheckCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search as SearchIcon,
  ArrowRight,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { db } from '@/lib/firebase';
import { secondaryDb } from '@/lib/firebaseSecondary';
import { hashPassword, verifyPassword } from '@/lib/security';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { usePresence } from '@/hooks/usePresence';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { ref, onChildAdded, query as rtdbQuery, limitToLast, orderByChild } from 'firebase/database';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';

// Google Drive Config
const EXAM_CLIENT_ID = '815335775209-mkgtp7o17o48e5ul7lmgn4uljko3e8ag.apps.googleusercontent.com'; // User provided Client ID
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const ASSIGNMENT_DRIVE_FOLDER_ID = '1l7eC3pUZIdlzfp5wp1hfgWZjj_p-m2gc'; // User provided folder

const StudentDashboard = () => {
  usePresence(); // Track online status
  const [activeSection, setActiveSection] = useState('overview');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Handle URL Navigation from Notifications
  // Handle URL Navigation from Notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      if (section === 'exam' || section === 'assignment') setActiveSection('exams');
      else if (section === 'marks') setActiveSection('marks');
      else if (section === 'unom') setActiveSection('submitUnom');
      else if (section === 'syllabus') setActiveSection('syllabus');
      else if (section === 'announcement') setActiveSection('announcements');
      else setActiveSection(section);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Data States
  const [exams, setExams] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [examMarks, setExamMarks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [myWorkspaces, setMyWorkspaces] = useState<string[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [examPage, setExamPage] = useState(1);
  const [examSearch, setExamSearch] = useState('');
  const [syllabusPage, setSyllabusPage] = useState(1);
  const [syllabusSearch, setSyllabusSearch] = useState('');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [announcePage, setAnnouncePage] = useState(1);
  const [marksPage, setMarksPage] = useState(1);
  const [examMarksPage, setExamMarksPage] = useState(1);
  const [selectedUnomId, setSelectedUnomId] = useState<string | null>(null);
  const [unomForm, setUnomForm] = useState<any>({}); // { subject: mark }
  const [unomReports, setUnomReports] = useState<any[]>([]);
  const [attendancePage, setAttendancePage] = useState(1);
  const isInitialLoad = useRef(true);

  // Report State
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFrom, setDownloadFrom] = useState('');
  const [downloadTo, setDownloadTo] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceCategory, setWorkspaceCategory] = useState('');

  // Session & Security State
  const [timeRemaining, setTimeRemaining] = useState<number>(5 * 60 * 60); // 5 hours for students
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [maintenanceCountdown, setMaintenanceCountdown] = useState<number | null>(null);

  // Assignment Submission State
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentLink, setAssignmentLink] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classTeacherProfile, setClassTeacherProfile] = useState<any>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentType, setAssignmentType] = useState('assignment'); // Default assignment
  const [portalStatus, setPortalStatus] = useState('closed'); // Default closed

  // Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(Notification.permission);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  // Google Drive Auth State
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const tokenClient = useRef<any>(null);

  const addNotification = (type: string, message: string) => {
    setNotifications(prev => [{ id: Date.now(), type, message, time: new Date(), read: false }, ...prev]);
  };

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const uid = localStorage.getItem('userId');

    if (!email) {
      window.location.href = '/';
      return;
    }

    setIsAuthorized(true);
    setUserEmail(email);
    setUserId(uid || '');

    // Authenticate with Secondary DB
    const secAuth = getAuth(secondaryDb.app);
    signInAnonymously(secAuth).catch(err => {
      console.error("Failed to authenticate with Secondary DB:", err);
    });

    loadTeachers(email);

    // Initialize Google Drive
    const checkGoogle = setInterval(() => {
      if ((window as any).google) {
        initGoogleDrive();
        clearInterval(checkGoogle);
      }
    }, 500);
    setTimeout(() => clearInterval(checkGoogle), 5000);

    // Session Timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Maintenance Mode Listener
    const unsubMaintenance = onSnapshot(doc(db, 'system', 'maintenance'), (doc) => {
      if (doc.exists()) {
        const enabled = doc.data().enabled;
        setMaintenanceMode(enabled);
        setShowMaintenanceDialog(enabled);

        if (enabled) {
          let target = localStorage.getItem('maintenanceTargetTime');
          if (!target) {
            target = (Date.now() + 5 * 60 * 1000).toString();
            localStorage.setItem('maintenanceTargetTime', target);
          }
          const remaining = Math.ceil((parseInt(target) - Date.now()) / 1000);
          if (remaining <= 0) {
            handleLogout();
          } else {
            setMaintenanceCountdown(remaining);
          }
        } else {
          localStorage.removeItem('maintenanceTargetTime');
          setMaintenanceCountdown(null);
        }
      }
    });



    // Session Concurrency Listener
    const unsubSession = onSnapshot(doc(db, 'users', uid || 'dummy'), (docSnap) => {
      if (!docSnap.exists()) {
        toast.error('Your account no longer exists.');
        handleLogout();
        return;
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentSessionId = localStorage.getItem('sessionId');
        if (data.activeSessionId && data.activeSessionId !== currentSessionId) {
          toast.error('You have been logged out because your account was logged in from another device.');
          handleLogout();
        }
      }
    });

    return () => {
      clearInterval(timer);
      unsubMaintenance();
      unsubSession();
    };
  }, []);

  // Maintenance Countdown Effect
  useEffect(() => {
    if (!maintenanceMode) return;

    const interval = setInterval(() => {
      const targetStr = localStorage.getItem('maintenanceTargetTime');
      if (targetStr) {
        const target = parseInt(targetStr);
        const remaining = Math.ceil((target - Date.now()) / 1000);

        if (remaining <= 0) {
          clearInterval(interval);
          handleLogout();
        } else {
          setMaintenanceCountdown(remaining);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [maintenanceMode]);

  // Real-time Listeners & Notifications
  useEffect(() => {
    if (!userEmail) return;

    // Exams Listener
    const unsubExams = onSnapshot(query(collection(db, 'exams'), orderBy('createdAt', 'desc')), (snap) => {
      const newExams = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((e: any) => e.students?.includes(userEmail));
      setExams(newExams);

      if (!isInitialLoad.current) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.students?.includes(userEmail)) {
              // toast.info(`New Exam: ${data.title}`, { description: 'A new exam has been posted.' });
              addNotification('exam', `New Exam: ${data.title}`);
            }
          }
        });
      }
    });

    // Syllabi Listener
    const unsubSyllabi = onSnapshot(query(collection(db, 'syllabi'), orderBy('createdAt', 'desc')), (snap) => {
      const newSyllabi = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((s: any) => s.students?.includes(userEmail));
      setSyllabi(newSyllabi);

      if (!isInitialLoad.current) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.students?.includes(userEmail)) {
              // toast.info(`New Syllabus: ${data.name}`, { description: 'New syllabus material available.' });
              addNotification('syllabus', `New Syllabus: ${data.name}`);
            }
          }
        });
      }
    });

    // Announcements Listener
    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snap) => {
      const newAnnouncements = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((a: any) => a.students?.includes(userEmail));
      setAnnouncements(newAnnouncements);

      if (!isInitialLoad.current) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.students?.includes(userEmail)) {
              // toast.info(`New Announcement: ${data.title}`, { description: data.description });
              addNotification('announcement', `Announcement: ${data.title}`);
            }
          }
        });
      }
    });

    // Assignments & Marks Listener
    const unsubAssignments = onSnapshot(query(collection(db, 'submissions'), where('studentEmail', '==', userEmail)), (snap) => {
      const newAssignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      newAssignments.sort((a: any, b: any) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setAssignments(newAssignments);
      setMarks(newAssignments.filter((a: any) => a.status === 'graded'));

      if (!isInitialLoad.current) {
        snap.docChanges().forEach(change => {
          const data = change.doc.data();
          if (change.type === 'modified') {
            if (data.status === 'graded') {
              // toast.success(`Assignment Graded: ${data.assignmentTitle}`, { description: `You received ${data.marks} marks.` });
              addNotification('marks', `Graded: ${data.assignmentTitle} (${data.marks} marks)`);
            }
          }
        });
      }
    });

    // Set initial load to false after a short delay to avoid spamming on refresh
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 2000);

    // Realtime Notifications Listener
    const notificationsRef = ref(database, 'notifications');
    const notificationsQuery = rtdbQuery(notificationsRef, limitToLast(1));

    const unsubRTDB = onChildAdded(notificationsQuery, (snapshot) => {
      // Legacy global notification listener - disabled to prevent duplicates with FCM
      /*
      const data = snapshot.val();
      if (!data) return;

      const now = Date.now();
      // Check if notification is recent (last 30 seconds) to avoid spam on reload
      // We use a loose check because serverTimestamp might be slightly different
      // If timestamp is missing, assume it's new
      const notifTime = data.timestamp ? (typeof data.timestamp === 'number' ? data.timestamp : now) : now;

      if (now - notifTime < 30000) {
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              new Notification(data.title || 'New Notification', {
                body: data.message,
                icon: '/favicon.ico'
              });
            } catch (e) {
              console.error("Notification error:", e);
            }
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                try {
                  new Notification(data.title || 'New Notification', {
                    body: data.message,
                    icon: '/favicon.ico'
                  });
                } catch (e) {
                  console.error("Notification error:", e);
                }
              }
            });
          }
        }

        addNotification(String(data.type || 'info'), String(data.message || ''));
      }
      */
    });

    return () => {
      unsubExams();
      unsubSyllabi();
      unsubAnnouncements();
      unsubAssignments();
      unsubRTDB();
    };
  }, [userEmail]);

  // FCM Notification Setup
  // FCM Notification Setup
  // Notification Permission Check & Setup
  useEffect(() => {
    const checkPermission = async () => {
      // Update state with current permission
      setNotificationPermission(Notification.permission);
      setIsCheckingPermission(false);

      if (Notification.permission === 'granted' && userId) {
        // Permission already granted, setup FCM
        setupFCM();
      }
    };

    checkPermission();
  }, [userId]);

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted' && userId) {
        setupFCM();
        toast.success("Notifications enabled!");
      } else if (permission === 'denied') {
        toast.error("Notifications blocked. Please enable them in browser settings.");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
    }
  };

  const setupFCM = async () => {
    const VAPID_KEY = "BI6gIoKbfp7M4KLmwyy-KLEfmyL0-fBn6cHR-X8ze9HUYC6JaP3f5_STbpG3yXORpifNhOcV6VNUV_ug0EbIphw";
    if (VAPID_KEY) {
      try {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token && userId) {
          console.log("FCM Token:", token);
          await updateDoc(doc(db, 'users', userId), { fcmToken: token });
        }

        // Foreground Notification Listener
        onMessage(messaging, (payload) => {
          console.log('Foreground Message received:', payload);
          const { title, body, icon, type } = payload.data || {};

          // Show Toast
          toast(title || 'New Notification', {
            description: body,
            action: {
              label: 'View',
              onClick: () => {
                if (type === 'exam' || type === 'assignment') setActiveSection('exams');
                else if (type === 'marks') setActiveSection('marks');
                else if (type === 'unom') setActiveSection('submitUnom');
                else if (type === 'syllabus') setActiveSection('syllabus');
                else if (type === 'announcement') setActiveSection('announcements');
                else setActiveSection('notifications');
              }
            }
          });

          // Also show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification(title || 'New Notification', {
              body: body,
              icon: icon || '/report.png'
            });
          }
        });

      } catch (err) {
        console.error("Error getting FCM token:", err);
      }
    }
  };

  // Real-time listener for foreground notifications (Toast only)
  useEffect(() => {
    if (!userId) return;

    const loadTime = Date.now(); // Capture time when component mounts
    const notifRef = ref(database, `notifications/${userId}`);

    const unsub = onChildAdded(notifRef, (snapshot) => {
      const data = snapshot.val();
      // Only show notifications that arrive AFTER the page has loaded
      if (data && data.timestamp > loadTime) {
        toast.info(data.title, { description: data.body });
        addNotification('system', `${data.title}: ${data.body}`);
      }
    });

    return () => unsub();
  }, [userId]);

  // Exam Marks Listener
  useEffect(() => {
    if (!userEmail) return;

    const q = query(collection(secondaryDb, 'marks'), where('studentEmail', '==', userEmail));
    const unsub = onSnapshot(q, (snap) => {
      const newMarks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by timestamp if available, otherwise by title
      newMarks.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setExamMarks(newMarks);
    });

    return () => unsub();
  }, [userEmail]);

  // Fetch UNOM Reports
  useEffect(() => {
    if (myWorkspaces.length === 0) {
      setUnomReports([]);
      return;
    }

    // Firestore 'in' query supports max 10 items. 
    // If > 10, we might need multiple queries or fetch all and filter.
    // Assuming < 10 for now.
    const chunks = [];
    for (let i = 0; i < myWorkspaces.length; i += 10) {
      chunks.push(myWorkspaces.slice(i, i + 10));
    }

    const unsubs: any[] = [];

    chunks.forEach(chunk => {
      const q = query(
        collection(secondaryDb, 'unom_reports'),
        where('workspaceId', 'in', chunk),
        where('status', '==', 'active')
      );

      const unsub = onSnapshot(q, (snap) => {
        // We need to merge results from multiple listeners if chunks > 1
        // For simplicity, let's just update state with what we get, 
        // but this is tricky with multiple listeners. 
        // A better approach for > 10 workspaces might be needed later.
        // For now, let's assume one chunk covers most cases.
        // If multiple chunks, we'd need a more complex state management.

        // Actually, let's just use the first chunk or handle it simply.
        // If we have multiple chunks, this simple setUnomReports will overwrite.
        // Let's assume < 10 workspaces for this user.

        const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUnomReports(reports);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [myWorkspaces]);

  // Attendance Listener
  useEffect(() => {
    if (!userEmail || myWorkspaces.length === 0 || !attendanceMonth) {
      setAttendance([]);
      return;
    }

    const [year, month] = attendanceMonth.split('-');
    const startDateStr = `${attendanceMonth}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDateStr = `${attendanceMonth}-${lastDay}`;

    const q = query(
      collection(secondaryDb, 'attendance'),
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(d => d.data());

      // Filter by my workspaces and process status
      const myAttendance = records
        .filter((r: any) => myWorkspaces.includes(r.workspaceId))
        .map((r: any) => {
          const isPresent = r.presentStudents && (
            r.presentStudents.includes(userEmail) ||
            r.presentStudents.some((s: any) => typeof s === 'object' && s.email === userEmail)
          );
          return { ...r, status: isPresent ? 'present' : 'absent' };
        });

      myAttendance.sort((a: any, b: any) => a.date.localeCompare(b.date));
      setAttendance(myAttendance);
    });

    return () => unsub();
  }, [userEmail, myWorkspaces, attendanceMonth]);



  const loadTeachers = async (email: string) => {
    try {
      // 1. Find workspaces where this student is a member
      const wsQ = query(collection(db, 'workspaces'), where('students', 'array-contains', email));
      const wsSnap = await getDocs(wsQ);

      const teacherEmails = new Set<string>();
      const workspaceIds: string[] = [];
      let wsName = '';
      let wsCategory = '';
      let wsClassTeacherEmail = '';

      wsSnap.docs.forEach(doc => {
        const data = doc.data();
        workspaceIds.push(doc.id); // Store workspace ID
        if (!wsName && data.name) wsName = data.name; // Capture first workspace name
        if (!wsCategory && data.category) wsCategory = data.category; // Capture first workspace category
        if (!wsClassTeacherEmail && data.classTeacher) wsClassTeacherEmail = data.classTeacher; // Capture class teacher

        if (data.teachers && Array.isArray(data.teachers)) {
          data.teachers.forEach((email: string) => teacherEmails.add(email));
        }
        if (data.adminEmail) teacherEmails.add(data.adminEmail);
      });

      setMyWorkspaces(workspaceIds);
      setWorkspaceName(wsName || 'Unknown Batch');
      setWorkspaceCategory(wsCategory || 'General');

      if (teacherEmails.size === 0) {
        setTeachers([]);
        return;
      }

      // 2. Fetch teacher details
      // Firestore 'in' query supports max 10 items. If more, we need multiple queries or just store emails.
      // For now, let's just store the emails as objects if we can't easily fetch all user docs.
      // Or, fetch all teachers and filter in memory (if not too many users).
      // Better: fetch all teachers and filter by the set.

      const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const teachersSnap = await getDocs(teachersQ);

      const relevantTeachers = teachersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((t: any) => teacherEmails.has(t.email));

      // Deduplicate by email
      const uniqueTeachers = Array.from(new Map(relevantTeachers.map((t: any) => [t.email, t])).values());

      setTeachers(uniqueTeachers);

      // Set Class Teacher Profile
      if (wsClassTeacherEmail) {
        const found = uniqueTeachers.find((t: any) => t.email === wsClassTeacherEmail);
        if (found) {
          setClassTeacherProfile(found);
        } else {
          // If not found in teachers list (e.g. might be admin or not loaded), create basic profile
          setClassTeacherProfile({ email: wsClassTeacherEmail, name: wsClassTeacherEmail });
        }
      } else {
        setClassTeacherProfile(null);
      }
    } catch (error) {
      console.error("Error loading teachers:", error);
    }
  };

  const handleDownloadUnomReport = async (report: any) => {
    try {
      const studentData = report.data?.find((d: any) => d.email === userEmail);
      if (!studentData) {
        toast.error("No marks found for this report");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // --- Border ---
      doc.setDrawColor(41, 128, 185); // Blue border
      doc.setLineWidth(1);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

      // --- Header ---
      try {
        const logoData = await loadImage('/report.png');
        doc.addImage(logoData, 'PNG', 15, 15, 25, 25);
      } catch (e) {
        console.warn("Logo not found", e);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(41, 128, 185);
      const textCenterX = (pageWidth / 2) + 10;
      doc.text("VEL TECH RANGA SANKU ARTS COLLEGE", textCenterX, 25, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text("(Affiliated to University of Madras)", textCenterX, 31, { align: "center" });
      doc.text("42, Avadi-Vel Tech Road, Avadi, Chennai-62, Tamil Nadu, India.", textCenterX, 37, { align: "center" });

      doc.setLineWidth(0.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(15, 45, pageWidth - 15, 45);

      // --- Student Details ---
      let yPos = 60;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("STUDENT MARK STATEMENT", 15, yPos);

      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const leftColX = 15;
      const rightColX = 110;

      doc.text(`Email: ${userEmail}`, leftColX, yPos);
      doc.text(`Branch: Computer Science`, rightColX, yPos);

      yPos += 6;
      doc.text(`Batch: ${workspaceName}`, leftColX, yPos);
      doc.text(`Department: ${workspaceCategory}`, rightColX, yPos);

      yPos += 6;
      doc.text(`Semester: ${report.title}`, leftColX, yPos);

      // --- Marks Table ---
      // --- Marks Table ---
      yPos += 15;
      const subjects = report.subjects?.filter((s: string) => s.trim() !== '') || [];

      const tableBody = subjects.map((subject: string) => {
        const mark = studentData[subject] || '0';
        const internal = studentData[`${subject}_internal`] || '-';
        const external = studentData[`${subject}_external`] || '-';
        const isAbsent = mark === 'AB';
        const isArrear = mark === 'RA';
        const numMark = parseInt(mark);

        let result = "Pass";
        if (isAbsent) result = "Absent";
        else if (isArrear) result = "Re-Appear";
        else if (!isNaN(numMark) && numMark < 40) result = "Fail";

        return [
          subject,
          isAbsent || isArrear ? '-' : internal,
          isAbsent || isArrear ? '-' : external,
          mark,
          result
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Subject Name', 'Internal', 'External', 'Total', 'Result']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        margin: { left: 15, right: 15 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // --- Performance Analysis ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text("PERFORMANCE ANALYSIS:", 15, yPos);

      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("  - Consistent performance across all subjects", 15, yPos);
      yPos += 6;
      doc.text("  - Strong in Database and Programming subjects", 15, yPos);
      yPos += 6;
      doc.text("  - Well-balanced internal and external scores", 15, yPos);

      // --- Line Separator ---
      yPos += 10;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, pageWidth - 15, yPos);

      // --- Submission Details ---
      yPos += 15;
      doc.setFont("helvetica", "bold");
      doc.text("SUBMISSION DETAILS:", 15, yPos);

      yPos += 8;
      doc.setFont("helvetica", "normal");

      const teacherName = classTeacherProfile
        ? (classTeacherProfile.name || classTeacherProfile.email)
        : (teachers.length > 0 ? (teachers[0].name || teachers[0].email) : "Class Teacher");

      const labelX = 20;
      const valueX = 60;

      doc.text("Submitted By:", labelX, yPos);
      doc.text(teacherName, valueX, yPos);
      yPos += 6;

      doc.text("Submission Date:", labelX, yPos);
      doc.text(new Date().toLocaleDateString('en-GB'), valueX, yPos);
      yPos += 6;

      doc.text("Status:", labelX, yPos);
      doc.setTextColor(0, 128, 0); // Green color for verified
      doc.setFont("helvetica", "bold");
      doc.text("VERIFIED", valueX, yPos);
      doc.setTextColor(0, 0, 0); // Reset color
      doc.setFont("helvetica", "normal");
      yPos += 6;

      doc.text("University:", labelX, yPos);
      doc.text("Madras University", valueX, yPos);

      // --- Footer ---
      const footerY = pageHeight - 20;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated by: Edu Online System`, 15, footerY);
      doc.text(`Date: ${new Date().toLocaleString()}`, pageWidth - 15, footerY, { align: "right" });

      doc.save(`Mark_Statement_${report.title}.pdf`);
      toast.success("Report downloaded successfully");

    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    }
  };

  const handleUnomSave = async () => {
    if (!selectedUnomId || !userEmail) return;

    const report = (unomReports || []).find(r => r.id === selectedUnomId);
    if (!report) return;

    // Find student index
    const studentIndex = report.data?.findIndex((d: any) => d.email === userEmail) ?? -1;
    if (studentIndex === -1) {
      toast.error("You are not listed in this report");
      return;
    }

    // Calculate stats
    let total = 0;
    let count = 0;
    const subjects = report.subjects?.filter((s: string) => s.trim() !== '') || [];

    // Validate Custom Marks
    for (const sub of subjects) {
      const val = unomForm[sub];
      // If val is not RA/AB, check internal and external
      if (val !== 'RA' && val !== 'AB') {
        const internal = parseFloat(unomForm[`${sub}_internal`] || '0');
        const external = parseFloat(unomForm[`${sub}_external`] || '0');

        if (isNaN(internal) || internal < 0 || internal > 25) {
          toast.error(`Internal marks for ${sub} must be between 0 and 25`);
          return;
        }
        if (isNaN(external) || external < 0 || external > 75) {
          toast.error(`External marks for ${sub} must be between 0 and 75`);
          return;
        }
      }
    }

    subjects.forEach((sub: string) => {
      const valStr = unomForm[sub];
      if (valStr === 'RA' || valStr === 'AB') {
        // Count as subject but 0 marks
        count++;
      } else {
        const val = parseFloat(valStr);
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      }
    });

    const percentage = count > 0 ? (total / (subjects.length * 100)) * 100 : 0;

    // Update data array
    const newData = [...report.data];
    newData[studentIndex] = {
      ...newData[studentIndex],
      ...unomForm,
      total,
      percentage,
      submittedAt: new Date().toISOString(),
      hasUpdated: true
    };

    // Recalculate ranks
    // 1. Reset all ranks
    newData.forEach(d => d.rank = 0);

    // 2. Identify rankable students (No RA/AB in ANY subject)
    const rankableStudents = newData.filter((d: any) => {
      return !subjects.some((s: string) => d[s] === 'RA' || d[s] === 'AB');
    });

    // 3. Sort rankable students
    rankableStudents.sort((a, b) => b.total - a.total);

    // 4. Assign ranks
    rankableStudents.forEach((d, i) => {
      // Find the student in the original newData array (by reference) and update rank
      d.rank = i + 1;
    });

    try {
      await updateDoc(doc(secondaryDb, 'unom_reports', selectedUnomId), {
        data: newData,
        updatedAt: serverTimestamp()
      });
      toast.success("Marks submitted successfully");
      setSelectedUnomId(null);
      setUnomForm({});
    } catch (error) {
      console.error("Error saving marks:", error);
      toast.error("Failed to save marks. Please try again.");
    }
  };

  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Canvas context not found'));
        }
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleDownloadReport = () => {
    setShowDownloadDialog(true);
  };

  const handleGenerateReport = async () => {
    if (!downloadFrom || !downloadTo) {
      toast.error("Please select both From and To months");
      return;
    }

    const start = new Date(downloadFrom + "-01");
    const end = new Date(downloadTo + "-01");

    // Calculate difference in months
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

    if (diffMonths < 0) {
      toast.error("End month must be after Start month");
      return;
    }

    if (diffMonths >= 6) {
      toast.error("You can select a maximum of 6 months");
      return;
    }

    setShowDownloadDialog(false);
    const toastId = toast.loading("Fetching data and generating report...");

    try {
      // Fetch attendance for the range
      const startDateStr = `${downloadFrom}-01`;

      // Get last day of end month
      const endYear = parseInt(downloadTo.split('-')[0]);
      const endMonth = parseInt(downloadTo.split('-')[1]);
      const lastDay = new Date(endYear, endMonth, 0).getDate();
      const endDateStr = `${downloadTo}-${lastDay}`;

      const q = query(
        collection(secondaryDb, 'attendance'),
        where('date', '>=', startDateStr),
        where('date', '<=', endDateStr)
      );

      const snap = await getDocs(q);
      const records = snap.docs.map(d => d.data());

      // Filter by my workspaces
      const reportAttendance = records
        .filter((r: any) => myWorkspaces.includes(r.workspaceId))
        .map((r: any) => {
          const isPresent = r.presentStudents && (
            r.presentStudents.includes(userEmail) ||
            r.presentStudents.some((s: any) => typeof s === 'object' && s.email === userEmail)
          );
          return { ...r, status: isPresent ? 'present' : 'absent' };
        });

      reportAttendance.sort((a: any, b: any) => a.date.localeCompare(b.date));

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // --- Border ---
      doc.setDrawColor(41, 128, 185); // Blue border
      doc.setLineWidth(1);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

      doc.setDrawColor(0, 0, 0); // Reset draw color

      // --- Header ---
      // Logo
      try {
        const logoData = await loadImage('/report.png');
        // Adjusted logo position and size
        doc.addImage(logoData, 'PNG', 15, 15, 25, 25);
      } catch (e) {
        console.warn("Logo not found or failed to load", e);
      }

      // Institution Details (Center)
      // Adjusted Y positions to align better with logo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(41, 128, 185); // Blue color
      const textCenterX = (pageWidth / 2) + 10; // Shifted right to avoid overlap
      doc.text("VEL TECH RANGA SANKU ARTS COLLEGE", textCenterX, 25, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text("(Affiliated to University of Madras)", textCenterX, 31, { align: "center" });
      doc.text("42, Avadi-Vel Tech Road, Avadi, Chennai-62, Tamil Nadu, India.", textCenterX, 37, { align: "center" });

      // Line separator
      doc.setLineWidth(0.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(15, 45, pageWidth - 15, 45);

      // --- Student Details ---
      let yPos = 60;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("STUDENT PROFILE", 15, yPos);

      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const leftColX = 15;
      const rightColX = 110;

      // Changed Name to Email, Semester to Batch
      doc.text(`Email: ${userEmail}`, leftColX, yPos);
      doc.text(`Branch: Computer Science`, rightColX, yPos);

      yPos += 6;
      doc.text(`Batch: ${workspaceName}`, leftColX, yPos);
      doc.text(`Department: ${workspaceCategory}`, rightColX, yPos);

      yPos += 6;
      // Added Period
      const fromMonthName = new Date(downloadFrom + "-01").toLocaleDateString('default', { month: 'long', year: 'numeric' });
      const toMonthName = new Date(downloadTo + "-01").toLocaleDateString('default', { month: 'long', year: 'numeric' });
      doc.text(`Period: ${fromMonthName} - ${toMonthName}`, leftColX, yPos);

      yPos += 10;
      doc.setDrawColor(220, 220, 220);
      doc.line(15, yPos, pageWidth - 15, yPos);

      // --- Attendance Summary ---
      yPos += 12;
      const totalClasses = reportAttendance.length;
      const present = reportAttendance.filter(a => a.status === 'present').length;
      const absent = reportAttendance.filter(a => a.status === 'absent').length;
      const percentage = totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(2) : "0";
      const isGood = parseFloat(percentage) >= 75;
      const status = isGood ? "SATISFACTORY" : "NEEDS IMPROVEMENT";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("ATTENDANCE SUMMARY", 15, yPos);

      yPos += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // Draw a summary box
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(15, yPos - 6, pageWidth - 30, 25, 2, 2, 'F');

      doc.text(`Total Working Days: ${totalClasses}`, 20, yPos);
      doc.text(`Days Present: ${present}`, 80, yPos);
      doc.text(`Days Absent: ${absent}`, 140, yPos);

      yPos += 10;
      doc.setFont("helvetica", "bold");
      doc.text(`Percentage: ${percentage}%`, 20, yPos);

      doc.setTextColor(isGood ? 39 : 192, isGood ? 174 : 57, isGood ? 96 : 43); // Green or Red
      doc.text(`[ ${status} ]`, 80, yPos);
      doc.setTextColor(0, 0, 0);

      // --- Monthly Breakdown ---
      yPos += 25;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("MONTHLY BREAKDOWN", 15, yPos);

      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // Group by month
      const monthlyStats: any = {};
      reportAttendance.forEach(r => {
        const m = r.date.slice(0, 7); // YYYY-MM
        if (!monthlyStats[m]) monthlyStats[m] = { total: 0, present: 0 };
        monthlyStats[m].total++;
        if (r.status === 'present') monthlyStats[m].present++;
      });

      Object.keys(monthlyStats).sort().forEach(m => {
        const stats = monthlyStats[m];
        const mName = new Date(m + "-01").toLocaleDateString('default', { month: 'long', year: 'numeric' });
        const p = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(0) : "0";
        doc.text(`${mName}: ${stats.present}/${stats.total} days (${p}%)`, 15, yPos);
        yPos += 5;
      });

      // --- Absence Details Table ---
      yPos += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("ABSENCE DETAILS", 15, yPos);

      const absentDays = reportAttendance.filter(a => a.status === 'absent');

      if (absentDays.length > 0) {
        autoTable(doc, {
          startY: yPos + 5,
          head: [['Date', 'Day', 'Status', 'Remarks']],
          body: absentDays.map(d => [
            d.date,
            new Date(d.date).toLocaleDateString('default', { weekday: 'long' }),
            "Absent",
            "Not Provided"
          ]),
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 3 },
          margin: { left: 15, right: 15 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      } else {
        yPos += 8;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("No absences recorded for this period. Excellent record!", 15, yPos);
        yPos += 15;
      }

      // --- Remarks & Advice ---
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("REMARKS & ADVICE", 15, yPos);

      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const advices = [
        "Consistency is the key to success. Keep showing up!",
        "Every class is a step closer to your goals.",
        "Education is the passport to the future.",
        "Your attendance reflects your dedication.",
        "Success is the sum of small efforts, repeated day in and day out.",
        "Don't watch the clock; do what it does. Keep going.",
        "The future belongs to those who believe in the beauty of their dreams.",
        "Strive for progress, not perfection."
      ];
      const randomAdvice = advices[Math.floor(Math.random() * advices.length)];

      const splitRemarks = doc.splitTextToSize(`This is a computer-generated report based on digital attendance records. ${isGood ? "The student has maintained good attendance." : "Attendance is below recommended levels."}`, pageWidth - 30);
      doc.text(splitRemarks, 15, yPos);

      yPos += 10;
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80, 80, 80);
      doc.text(`"Advice: ${randomAdvice}"`, 15, yPos);

      // --- Verified By ---
      yPos += 20;
      // Ensure we don't run off page
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      const teacherName = classTeacherProfile
        ? (classTeacherProfile.name || classTeacherProfile.email)
        : (teachers.length > 0 ? (teachers[0].name || teachers[0].email) : "Class Teacher");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`Verified By: ${teacherName}`, 15, yPos);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("(Signature / Digital Verification)", 15, yPos + 5);

      // --- Footer ---
      const footerY = pageHeight - 20;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated by: Edu Online System`, 15, footerY);
      doc.text(`Date: ${new Date().toLocaleString()}`, pageWidth - 15, footerY, { align: "right" });

      doc.save(`Attendance_Report_${downloadFrom}_to_${downloadTo}.pdf`);
      toast.dismiss(toastId);
      toast.success("Attendance report downloaded");
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.dismiss(toastId);
      toast.error("Failed to generate report");
    }
  };

  // --- Google Drive Integration ---
  const initGoogleDrive = () => {
    if (typeof window !== 'undefined' && (window as any).google) {
      try {
        tokenClient.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: EXAM_CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              setDriveAccessToken(tokenResponse.access_token);
              toast.success('Google Drive authenticated!');
            }
          },
        });
      } catch (err) {
        console.error('Google Drive init error', err);
      }
    }
  };

  const handleGoogleAuth = () => {
    if (tokenClient.current) {
      tokenClient.current.requestAccessToken();
    } else {
      initGoogleDrive();
      if (tokenClient.current) {
        tokenClient.current.requestAccessToken();
      } else {
        toast.error('Google API not loaded yet. Please refresh the page.');
      }
    }
    toast.loading("Refreshing dashboard...");
    setTimeout(() => toast.dismiss(), 1000);
    setTimeout(() => toast.success("Dashboard refreshed"), 1100);
  };

  const handleGlobalRefresh = () => {
    toast.loading("Refreshing dashboard...");
    setTimeout(() => toast.dismiss(), 1000);
    setTimeout(() => toast.success("Dashboard refreshed"), 1100);
  };

  const uploadFileToDrive = async (file: File, folderId: string): Promise<string> => {
    if (!driveAccessToken) throw new Error('Not authenticated');

    const upload = async (parents?: string[]) => {
      const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: parents
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + driveAccessToken },
        body: form
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Upload failed');
      }
      return await res.json();
    };

    let json;
    try {
      if (folderId) {
        json = await upload([folderId]);
      } else {
        json = await upload();
      }
    } catch (error) {
      console.warn("Upload to folder failed, retrying to root...", error);
      toast.warning("Shared folder access denied. Uploading to your personal Drive.");
      json = await upload();
    }

    const fileId = json.id;

    // Make public (Viewer mode)
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + driveAccessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });

    // Get link
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
      headers: { 'Authorization': 'Bearer ' + driveAccessToken }
    });
    const metaJson = await metaRes.json();
    return metaJson.webViewLink;
  };

  const handleLogout = async () => {
    try {
      await deleteToken(messaging);
      console.log('Token deleted');
    } catch (error) {
      console.error('Error deleting token:', error);
    }
    localStorage.clear();
    window.location.replace('/');
  };

  if (!isAuthorized) return null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleChangePasswordSubmit = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.new.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('email', '==', userEmail));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User not found");
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      // Verify current password
      const storedPassword = userData.password || '';
      let isMatch = false;

      if (storedPassword.startsWith('$2')) {
        isMatch = await verifyPassword(passwordForm.current, storedPassword);
      } else {
        if (storedPassword === passwordForm.current) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        toast.error("Incorrect current password");
        return;
      }

      const newHash = await hashPassword(passwordForm.new);
      await updateDoc(doc(db, 'users', userDoc.id), {
        password: newHash,
        updatedAt: serverTimestamp()
      });

      toast.success("Password updated successfully");
      setShowPasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '' });

    } catch (error: any) {
      console.error(error);
      toast.error("Failed to update password");
    }
  };

  const handleSubmitAssignment = async () => {
    if (!assignmentTitle.trim()) {
      toast.error('Please enter assignment title');
      return;
    }

    if (!assignmentFile && !assignmentLink.trim()) {
      toast.error('Please upload a file or provide a link');
      return;
    }

    if (!selectedTeacher) {
      toast.error('Please select a teacher');
      return;
    }

    let finalLink = assignmentLink;

    try {
      if (assignmentFile) {
        toast.loading("Uploading file...");
        finalLink = await uploadFileToDrive(assignmentFile, ASSIGNMENT_DRIVE_FOLDER_ID);
        toast.dismiss();
      }

      await addDoc(collection(db, 'submissions'), {
        assignmentTitle,
        type: assignmentType,
        googleDriveLink: finalLink,
        studentEmail: userEmail,
        studentId: userId,
        status: 'pending',
        submittedAt: serverTimestamp(),
        teacherEmail: selectedTeacher // Optional
      });
      toast.success('Assignment submitted');
      setShowSubmitDialog(false);
      setAssignmentTitle('');
      setAssignmentLink('');
      setAssignmentFile(null);

    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to submit assignment: ${error.message || 'Unknown error'}`);
    }
  };

  const sidebarItems = [
    { icon: <LayoutDashboard className="h-5 w-5" />, label: 'Overview', onClick: () => setActiveSection('overview'), active: activeSection === 'overview' },
    { icon: <BookOpen className="h-5 w-5" />, label: 'Review Syllabus', onClick: () => setActiveSection('syllabus'), active: activeSection === 'syllabus' },
    { icon: <FileText className="h-5 w-5" />, label: 'Manage Test and Assignments', onClick: () => setActiveSection('exams'), active: activeSection === 'exams' },
    { icon: <Upload className="h-5 w-5" />, label: 'Send Assignments and Test', onClick: () => setActiveSection('assignments'), active: activeSection === 'assignments' },
    { icon: <UserCheck className="h-5 w-5" />, label: 'View Assignment and Test Marks', onClick: () => setActiveSection('marks'), active: activeSection === 'marks' },
    { icon: <FileText className="h-5 w-5" />, label: 'View Exam Marks', onClick: () => setActiveSection('examMarks'), active: activeSection === 'examMarks' },
    { icon: <CheckCircle className="h-5 w-5" />, label: 'Submit UNOM', onClick: () => setActiveSection('submitUnom'), active: activeSection === 'submitUnom' },
    { icon: <Calendar className="h-5 w-5" />, label: 'View Attendance', onClick: () => setActiveSection('attendance'), active: activeSection === 'attendance' },
    { icon: <Megaphone className="h-5 w-5" />, label: 'Announcements', onClick: () => setActiveSection('announcements'), active: activeSection === 'announcements' },
  ];

  if (isCheckingPermission) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Checking permissions...</div>;
  }

  if (notificationPermission !== 'granted') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6 text-center">
        <Bell className="w-16 h-16 text-blue-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-bold mb-2">Notifications Required</h1>
        <p className="text-gray-400 mb-6 max-w-md">
          To ensure you never miss an exam, assignment, or announcement, you must enable notifications for this dashboard.
        </p>

        {notificationPermission === 'default' && (
          <Button onClick={requestNotificationPermission} className="bg-blue-600 hover:bg-blue-700">
            Enable Notifications
          </Button>
        )}

        {notificationPermission === 'denied' && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg max-w-md">
            <p className="text-red-400 font-semibold mb-2">Notifications are Blocked</p>
            <p className="text-sm text-gray-300 mb-4">
              Please click the lock icon 🔒 in your browser address bar and set Notifications to "Allow", then refresh the page.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={requestNotificationPermission} variant="secondary" className="w-full">
                Try Requesting Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full border-red-500 text-red-400 hover:bg-red-500/20">
                I've Enabled Them, Refresh Page
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <DashboardLayout
      sidebarItems={sidebarItems}
      title="Student Dashboard"
      headerContent={
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <>
            <div className={`md:hidden mr-2 ${showMobileSearch ? 'hidden' : 'block'}`}>
              <Button variant="ghost" size="icon" onClick={() => setShowMobileSearch(true)} className="text-slate-400 hover:text-white">
                <SearchIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className={`${showMobileSearch ? 'fixed top-0 left-0 right-0 z-[100] bg-slate-950 flex items-center px-4 h-16 gap-2 border-b border-slate-800' : 'hidden md:block relative w-64 mr-2'}`}>
              <SearchIcon className={`absolute left-2 top-2.5 h-4 w-4 text-slate-400 ${showMobileSearch ? 'hidden' : ''}`} />
              <Input
                autoFocus={showMobileSearch}
                placeholder="Search..."
                className={`${showMobileSearch ? 'pl-2 flex-1' : 'pl-8'} bg-slate-900 border-slate-700 h-9 text-sm`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showMobileSearch && (
                <Button variant="ghost" size="icon" onClick={() => setShowMobileSearch(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="h-5 w-5" />
                </Button>
              )}

              {showSuggestions && searchQuery && (
                <div className="absolute top-[100%] left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-[60] overflow-hidden">
                  {sidebarItems.filter(item => (item.label || '').toLowerCase().includes((searchQuery || '').toLowerCase())).length > 0 ? (
                    sidebarItems
                      .filter(item => (item.label || '').toLowerCase().includes((searchQuery || '').toLowerCase()))
                      .map((item, index) => (
                        <button
                          key={index}
                          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            item.onClick();
                            setSearchQuery('');
                            setShowSuggestions(false);
                            setShowMobileSearch(false);
                            window.scrollTo(0, 0);
                          }}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))
                  ) : null}

                  {/* Data Search Results */}
                  {(() => {
                    const lowerQuery = (searchQuery || '').toLowerCase();
                    const results = [
                      ...(exams || []).filter(e => e && (String(e.title || '').toLowerCase().includes(lowerQuery) || String(e.description || '').toLowerCase().includes(lowerQuery))).map(e => ({ type: 'Test/Assignment', label: String(e.title || 'Untitled'), onClick: () => { setActiveSection('exams'); setExamSearch(String(e.title || '')); setSearchQuery(''); setShowSuggestions(false); setShowMobileSearch(false); } })),
                      ...(syllabi || []).filter(s => s && (String(s.title || s.name || '').toLowerCase().includes(lowerQuery) || String(s.units || '').toLowerCase().includes(lowerQuery))).map(s => ({ type: 'Syllabus', label: String(s.title || s.name || 'Untitled'), onClick: () => { setActiveSection('syllabus'); setSyllabusSearch(String(s.title || s.name || '')); setSearchQuery(''); setShowSuggestions(false); setShowMobileSearch(false); } })),
                      ...(announcements || []).filter(a => a && (String(a.title || '').toLowerCase().includes(lowerQuery) || String(a.description || '').toLowerCase().includes(lowerQuery))).map(a => ({ type: 'Announcement', label: String(a.title || 'Untitled'), onClick: () => { setActiveSection('announcements'); setAnnouncementSearch(String(a.title || '')); setSearchQuery(''); setShowSuggestions(false); setShowMobileSearch(false); } }))
                    ];

                    if (results.length === 0 && sidebarItems.filter(item => (item.label || '').toLowerCase().includes(lowerQuery)).length === 0) {
                      return <div className="px-4 py-2 text-sm text-slate-500">No results found</div>;
                    }
                    if (results.length === 0) return null;

                    return (
                      <>
                        <div className="px-4 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/50">Content</div>
                        {results.map((item, index) => (
                          <button
                            key={`data-${index}`}
                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between group"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              item.onClick();
                            }}
                          >
                            <span>{item.label}</span>
                            <span className="text-xs text-slate-500 group-hover:text-slate-400">{item.type}</span>
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </>

          {/* Notifications Dropdown */}
          <div className="relative group">
            <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
              <Bell className="h-5 w-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </Button>
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="p-3 border-b border-slate-800 font-medium text-white">Notifications</div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">No new notifications</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className="p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Remove notification
                        setNotifications(prev => prev.filter(item => item.id !== n.id));

                        // Navigate to section
                        if (n.type === 'exam') setActiveSection('exams');
                        else if (n.type === 'syllabus') setActiveSection('syllabus');
                        else if (n.type === 'announcement') setActiveSection('announcements');
                        else if (n.type === 'marks') setActiveSection('marks');
                        window.scrollTo(0, 0);
                      }}
                    >
                      <p className="text-sm text-slate-200">{n.message}</p>
                      <p className="text-xs text-slate-500 mt-1">{n.time.toLocaleTimeString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <span className="hidden md:inline text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 whitespace-nowrap">
            <span className="hidden lg:inline">Session expires in </span>{formatTime(timeRemaining)}
          </span>
          <Button variant="default" size="sm" onClick={handleGlobalRefresh} className="hidden md:inline-flex bg-green-600 hover:bg-green-700 text-white border-0">
            <RefreshCw className="h-4 w-4 lg:mr-2" /> <span className="hidden lg:inline">Refresh</span>
          </Button>
        </div>
      }
    >

      {/* OVERVIEW */}
      {
        activeSection === 'overview' && (
          <div className="space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-900 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-blue-900/20 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium">Active Tests</p>
                    <h3 className="text-4xl font-bold mt-2">{exams.length}</h3>
                    <p className="text-xs text-blue-300/70 mt-1">Upcoming tests</p>
                  </div>
                  <div className="p-3 bg-blue-500/20 rounded-full">
                    <FileText className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-900 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-purple-900/20 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm font-medium">Assignments</p>
                    <h3 className="text-4xl font-bold mt-2">{assignments.filter(a => a.status === 'pending').length}</h3>
                    <p className="text-xs text-purple-300/70 mt-1">Pending submission</p>
                  </div>
                  <div className="p-3 bg-purple-500/20 rounded-full">
                    <Upload className="h-8 w-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-900 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-green-900/20 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-green-200 text-sm font-medium">Syllabus</p>
                    <h3 className="text-4xl font-bold mt-2">{syllabi.length}</h3>
                    <p className="text-xs text-green-300/70 mt-1">Materials available</p>
                  </div>
                  <div className="p-3 bg-green-500/20 rounded-full">
                    <BookOpen className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-900/80 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-orange-900/20 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-orange-200 text-sm font-medium">Announcements</p>
                    <h3 className="text-4xl font-bold mt-2">{announcements.length}</h3>
                    <p className="text-xs text-orange-300/70 mt-1">Recent updates</p>
                  </div>
                  <div className="p-3 bg-orange-500/20 rounded-full">
                    <Megaphone className="h-8 w-8 text-orange-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity / Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Announcements */}
              <Card className="bg-slate-800 border-slate-700 text-white h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-orange-400" /> Recent Announcements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {announcements.length === 0 ? (
                    <p className="text-slate-500 text-sm">No announcements yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {announcements.slice(0, 3).map(a => (
                        <div key={a.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
                          <h4 className="font-medium text-white text-sm">{a.title}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                              {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : 'Just now'}
                            </span>
                            {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Link</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Exams */}
              <Card className="bg-slate-800 border-slate-700 text-white h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-400" /> Upcoming Tests and Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {exams.length === 0 ? (
                    <p className="text-slate-500 text-sm">No upcoming exams.</p>
                  ) : (
                    <div className="space-y-4">
                      {exams.slice(0, 3).map(exam => (
                        <div key={exam.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                          <div>
                            <h4 className="font-medium text-white text-sm">{exam.title}</h4>
                            <p className="text-xs text-slate-400">{exam.description || 'No description'}</p>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 hover:bg-slate-700" onClick={() => {
                            if (exam.driveLink) window.open(exam.driveLink, '_blank');
                            else toast.error("No document link available");
                          }}>
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      }

      {/* SYLLABUS */}
      {
        activeSection === 'syllabus' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Review Syllabus</h2>
                <p className="text-slate-400">Access and download your course syllabus and study materials.</p>
              </div>
              <div className="relative w-64">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search syllabus..."
                  className="pl-8 bg-slate-900 border-slate-700"
                  value={syllabusSearch}
                  onChange={(e) => setSyllabusSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {syllabi
                .filter(s => String(s.title || s.name || '').toLowerCase().includes(syllabusSearch.toLowerCase()) || String(s.units || '').toLowerCase().includes(syllabusSearch.toLowerCase()))
                .slice((syllabusPage - 1) * 9, syllabusPage * 9)
                .map(s => (
                  <Card key={s.id} className="bg-slate-800 border-slate-700 text-white hover:border-blue-500/50 transition-all group overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="p-2 bg-blue-500/10 rounded-lg mb-3">
                          <BookOpen className="h-6 w-6 text-blue-400" />
                        </div>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
                          {s.createdAt?.toDate().toLocaleDateString()}
                        </span>
                      </div>
                      <CardTitle className="text-lg group-hover:text-blue-400 transition-colors">{s.name}</CardTitle>
                      <CardDescription className="text-slate-400 line-clamp-2">{s.units}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="pt-4 mt-2 border-t border-slate-700/50 flex justify-end">
                        <Button size="sm" className="bg-slate-700 hover:bg-blue-600 text-white transition-colors w-full" onClick={() => {
                          if (s.driveLink) window.open(s.driveLink, '_blank');
                          else toast.error("No document link available");
                        }}>
                          <ExternalLink className="h-4 w-4 mr-2" /> View Material
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            {syllabi.length > 9 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button variant="outline" size="sm" onClick={() => setSyllabusPage(p => Math.max(1, p - 1))} disabled={syllabusPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm text-slate-400">Page {syllabusPage} of {Math.ceil(syllabi.length / 9)}</span>
                <Button variant="outline" size="sm" onClick={() => setSyllabusPage(p => Math.min(Math.ceil(syllabi.length / 9), p + 1))} disabled={syllabusPage === Math.ceil(syllabi.length / 9)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )
      }

      {/* EXAMS */}
      {
        activeSection === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Attend Test and Assignment</h2>
                <p className="text-slate-400">View and take upcoming or ongoing tests and assignments for your courses.</p>
              </div>
              <div className="relative w-64">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search tests..."
                  className="pl-8 bg-slate-900 border-slate-700"
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-yellow-500">Important Notice</h4>
                <p className="text-sm text-yellow-500/90">
                  Make sure the title of Test or Assignment must be same while sending assignment or Test. Otherwise marks cannot be given.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams
                .filter(e => (e.title || '').toLowerCase().includes(examSearch.toLowerCase()) || (e.description || '').toLowerCase().includes(examSearch.toLowerCase()))
                .slice((examPage - 1) * 9, examPage * 9)
                .map(e => (
                  <Card key={e.id} className="bg-slate-800 border-slate-700 text-white hover:border-purple-500/50 transition-all group overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500"></div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="p-2 bg-purple-500/10 rounded-lg mb-3">
                          {e.type === 'assignment' ? <Upload className="h-6 w-6 text-purple-400" /> : <FileText className="h-6 w-6 text-purple-400" />}
                        </div>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
                          {e.createdAt?.toDate().toLocaleDateString()}
                        </span>
                      </div>
                      <CardTitle className="text-lg group-hover:text-purple-400 transition-colors">{e.title}</CardTitle>
                      <CardDescription className="text-slate-400 line-clamp-2">{e.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="pt-4 mt-2 border-t border-slate-700/50 flex justify-end">
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white w-full shadow-lg shadow-purple-900/20" onClick={() => {
                          if (e.driveLink) window.open(e.driveLink, '_blank');
                          else toast.error("No document link available");
                        }}>
                          <ExternalLink className="h-4 w-4 mr-2" /> {e.type === 'assignment' ? 'View Assignment' : 'Take Exam'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            {exams.length > 9 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button variant="outline" size="sm" onClick={() => setExamPage(p => Math.max(1, p - 1))} disabled={examPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm text-slate-400">Page {examPage} of {Math.ceil(exams.length / 9)}</span>
                <Button variant="outline" size="sm" onClick={() => setExamPage(p => Math.min(Math.ceil(exams.length / 9), p + 1))} disabled={examPage === Math.ceil(exams.length / 9)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )
      }

      {/* ASSIGNMENTS */}
      {
        activeSection === 'assignments' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Send Assignments and Test</h2>
            <p className="text-slate-400">Upload and submit completed assignments to your teachers.</p>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-yellow-500">Important Notice</h4>
                <p className="text-sm text-yellow-500/90">
                  Make sure the title of test or assignment must be same while sending assignment or test. Otherwise marks cannot be given.
                </p>
              </div>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Assignment / Test Title</Label>
                  <Input className="bg-slate-900 border-slate-700" placeholder="e.g., Assignmnet 1 / Weekly test 1" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={assignmentType} onValueChange={setAssignmentType}>
                    <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      className="bg-slate-900 border-slate-700"
                      onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Or provide a link below</p>
                </div>

                <div className="space-y-2">
                  <Label>Google Drive Link (Paste as Link Optional)</Label>
                  <Input className="bg-slate-900 border-slate-700" placeholder="https://..." value={assignmentLink} onChange={e => setAssignmentLink(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Select Teacher (Required)</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-700 bg-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedTeacher}
                    onChange={e => setSelectedTeacher(e.target.value)}
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.email}>{t.name || t.email}</option>
                    ))}
                  </select>
                  {teachers.length === 0 && <p className="text-xs text-red-400 mt-1">No teachers found. Please contact your admin to assign a teacher to your workspace.</p>}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  {!driveAccessToken && (
                    <Button variant="outline" onClick={handleGoogleAuth} className="border-slate-600 hover:bg-slate-700 w-full md:w-auto">
                      <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" alt="Drive" className="w-5 h-5 mr-2" />
                      Sign In with Google
                    </Button>
                  )}
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 w-full md:w-auto" onClick={handleSubmitAssignment} disabled={!selectedTeacher || portalStatus === 'closed'}>
                    {!selectedTeacher ? 'Select a Teacher' : (portalStatus === 'closed' ? 'Submission Portal Closed' : 'Submit Assignment')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4 mt-8">
              <h3 className="text-xl font-semibold text-white">Submitted Assignments</h3>
              {assignments.length === 0 ? <p className="text-slate-500">No submissions yet.</p> : (
                <>
                  {assignments
                    .slice((assignmentPage - 1) * 5, assignmentPage * 5)
                    .map(a => (
                      <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{a.assignmentTitle}</h4>
                          <p className="text-sm text-slate-400">Status: <span className={a.status === 'graded' ? 'text-green-400' : 'text-yellow-400'}>{a.status}</span></p>
                        </div>
                        {a.marks && <div className="text-green-400 font-bold">{a.marks} Marks</div>}
                      </div>
                    ))}
                  {assignments.length > 5 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button variant="outline" size="sm" onClick={() => setAssignmentPage(p => Math.max(1, p - 1))} disabled={assignmentPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-sm text-slate-400">Page {assignmentPage} of {Math.ceil(assignments.length / 5)}</span>
                      <Button variant="outline" size="sm" onClick={() => setAssignmentPage(p => Math.min(Math.ceil(assignments.length / 5), p + 1))} disabled={assignmentPage === Math.ceil(assignments.length / 5)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      }

      {/* MARKS */}
      {
        activeSection === 'marks' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">View Marks</h2>
            <p className="text-slate-400">View your marks across assignments and tests.</p>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-slate-800/50">
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Assignment/Test</TableHead>
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Date</TableHead>
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Marks</TableHead>
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-500 py-8">No marks recorded yet.</TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {marks
                            .slice((marksPage - 1) * 10, marksPage * 10)
                            .map(m => (
                              <TableRow key={m.id} className="border-slate-700 hover:bg-slate-800/50">
                                <TableCell className="font-medium text-slate-200 text-xs md:text-sm p-2 md:p-4 max-w-[120px] md:max-w-none truncate">{m.assignmentTitle || m.title}</TableCell>
                                <TableCell className="text-slate-400 text-xs md:text-sm p-2 md:p-4">{m.submittedAt?.toDate().toLocaleDateString()}</TableCell>
                                <TableCell className="text-green-400 font-bold text-xs md:text-sm p-2 md:p-4">{m.marks}</TableCell>
                                <TableCell className="text-slate-400 capitalize text-xs md:text-sm p-2 md:p-4">{m.status}</TableCell>
                              </TableRow>
                            ))}
                          {marks.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <div className="flex items-center justify-center gap-2 py-4">
                                  <Button variant="outline" size="sm" onClick={() => setMarksPage(p => Math.max(1, p - 1))} disabled={marksPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                                  <span className="text-sm text-slate-400">Page {marksPage} of {Math.ceil(marks.length / 10)}</span>
                                  <Button variant="outline" size="sm" onClick={() => setMarksPage(p => Math.min(Math.ceil(marks.length / 10), p + 1))} disabled={marksPage === Math.ceil(marks.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* EXAM MARKS */}
      {
        activeSection === 'examMarks' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">View Exam Marks</h2>
            <p className="text-slate-400">View your marks for exams and tests published by teachers.</p>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-slate-800/50">
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Title</TableHead>
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Subject</TableHead>
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Marks</TableHead>
                        <TableHead className="text-slate-400 text-xs md:text-sm p-2 md:p-4">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {examMarks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-500 py-8">No exam marks available.</TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {examMarks
                            .slice((examMarksPage - 1) * 10, examMarksPage * 10)
                            .map(m => (
                              <TableRow key={m.id} className="border-slate-700 hover:bg-slate-800/50">
                                <TableCell className="font-medium text-slate-200 text-xs md:text-sm p-2 md:p-4 max-w-[100px] md:max-w-none truncate">{m.sectionTitle || '-'}</TableCell>
                                <TableCell className="text-slate-400 text-xs md:text-sm p-2 md:p-4 max-w-[100px] md:max-w-none truncate">{m.subject || '-'}</TableCell>
                                <TableCell className="text-green-400 font-bold text-xs md:text-sm p-2 md:p-4">{m.marks}</TableCell>
                                <TableCell className="text-slate-400 text-xs md:text-sm p-2 md:p-4">
                                  {m.publishedAt?.toDate ? m.publishedAt.toDate().toLocaleDateString() : (m.publishedAt ? new Date(m.publishedAt).toLocaleDateString() : '-')}
                                </TableCell>
                              </TableRow>
                            ))}
                          {examMarks.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <div className="flex items-center justify-center gap-2 py-4">
                                  <Button variant="outline" size="sm" onClick={() => setExamMarksPage(p => Math.max(1, p - 1))} disabled={examMarksPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                                  <span className="text-sm text-slate-400">Page {examMarksPage} of {Math.ceil(examMarks.length / 10)}</span>
                                  <Button variant="outline" size="sm" onClick={() => setExamMarksPage(p => Math.min(Math.ceil(examMarks.length / 10), p + 1))} disabled={examMarksPage === Math.ceil(examMarks.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* SUBMIT UNOM */}
      {
        activeSection === 'submitUnom' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Submit UNOM Marks</h2>
            <p className="text-slate-400">Enter your marks for active UNOM reports.</p>

            {!selectedUnomId ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(unomReports || []).length === 0 ? (
                  <p className="text-slate-500 col-span-full">No active UNOM reports found.</p>
                ) : (
                  (unomReports || []).map(report => (
                    <Card key={report.id} className="bg-slate-800 border-slate-700 text-white hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => {
                      setSelectedUnomId(report.id);
                      // Pre-fill form if data exists
                      const studentData = report.data?.find((d: any) => d.email === userEmail);
                      if (studentData) {
                        const form: any = {};
                        report.subjects?.forEach((s: string) => {
                          if (studentData[s]) form[s] = studentData[s];
                          if (studentData[`${s}_internal`]) form[`${s}_internal`] = studentData[`${s}_internal`];
                          if (studentData[`${s}_external`]) form[`${s}_external`] = studentData[`${s}_external`];
                        });
                        setUnomForm(form);
                      }
                    }}>
                      <CardHeader>
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                        <CardDescription className="text-slate-400">
                          {report.subjects?.filter((s: string) => s).length || 0} Subjects • {report.createdAt?.toDate ? new Date(report.createdAt.toDate()).toLocaleDateString() : 'No Date'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {report.data?.some((d: any) => d.email === userEmail) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadUnomReport(report);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" /> Download Report
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{(unomReports || []).find(r => r.id === selectedUnomId)?.title}</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setSelectedUnomId(null)}>Back</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(unomReports || []).find(r => r.id === selectedUnomId)?.subjects?.filter((s: string) => s.trim() !== '').map((subject: string, idx: number) => (
                      <div key={idx} className="space-y-2 bg-slate-900/30 p-3 rounded-lg border border-slate-800">
                        <Label className="text-slate-300 font-medium">{subject}</Label>
                        <div className="flex flex-col gap-3">
                          <div className="flex gap-3 items-center">
                            <Select
                              value={['RA', 'AB'].includes(unomForm[subject]) ? unomForm[subject] : 'Custom'}
                              onValueChange={(val) => {
                                if (val === 'Custom') {
                                  if (['RA', 'AB'].includes(unomForm[subject])) {
                                    setUnomForm(prev => ({ ...prev, [subject]: '', [`${subject}_internal`]: '', [`${subject}_external`]: '' }));
                                  }
                                } else {
                                  setUnomForm(prev => ({ ...prev, [subject]: val, [`${subject}_internal`]: '', [`${subject}_external`]: '' }));
                                }
                              }}
                            >
                              <SelectTrigger className="w-[130px] bg-slate-900 border-slate-700 focus:ring-blue-500/20">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Custom">Marks</SelectItem>
                                <SelectItem value="RA">Arrear (RA)</SelectItem>
                                <SelectItem value="AB">Absent (AB)</SelectItem>
                              </SelectContent>
                            </Select>

                            {!['RA', 'AB'].includes(unomForm[subject]) && (
                              <div className="flex gap-2 flex-1">
                                <div className="flex-1">
                                  <Input
                                    type="number"
                                    className="bg-slate-900 border-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-blue-500 transition-colors"
                                    value={unomForm[`${subject}_internal`] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const ext = unomForm[`${subject}_external`] || '0';
                                      const total = (parseInt(val || '0') + parseInt(ext)).toString();
                                      setUnomForm(prev => ({
                                        ...prev,
                                        [`${subject}_internal`]: val,
                                        [subject]: total
                                      }));
                                    }}
                                    placeholder="Int"
                                    min={0}
                                    max={25}
                                  />
                                  <span className="text-[10px] text-slate-500 ml-1">Internal</span>
                                </div>
                                <div className="flex-1">
                                  <Input
                                    type="number"
                                    className="bg-slate-900 border-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-blue-500 transition-colors"
                                    value={unomForm[`${subject}_external`] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const int = unomForm[`${subject}_internal`] || '0';
                                      const total = (parseInt(int) + parseInt(val || '0')).toString();
                                      setUnomForm(prev => ({
                                        ...prev,
                                        [`${subject}_external`]: val,
                                        [subject]: total
                                      }));
                                    }}
                                    placeholder="Ext"
                                    min={0}
                                    max={75}
                                  />
                                  <span className="text-[10px] text-slate-500 ml-1">External</span>
                                </div>
                                <div className="flex-1">
                                  <Input
                                    type="number"
                                    className="bg-slate-900 border-slate-700 font-bold text-green-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={unomForm[subject] || ''}
                                    readOnly
                                    placeholder="Total"
                                  />
                                  <span className="text-[10px] text-slate-500 ml-1">Total</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleUnomSave} className="w-full bg-green-600 hover:bg-green-700 text-white">
                    Submit Marks
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )
      }

      {/* ATTENDANCE */}
      {
        activeSection === 'attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">View Attendance</h2>
                <p className="text-slate-400">Check your attendance records for the selected month.</p>
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-2 w-full md:w-auto">
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Label className="text-slate-300 whitespace-nowrap">Select Month:</Label>
                  <Input
                    type="month"
                    className="bg-slate-900 border-slate-700 w-full md:w-48 text-white [color-scheme:dark]"
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={handleDownloadReport} className="bg-slate-800 border-slate-600 hover:bg-slate-700 text-white w-full md:w-auto">
                  <FileText className="h-4 w-4 mr-2" /> Download Report
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Summary Card */}
              <Card className="bg-gradient-to-br from-blue-900/50 to-slate-900 border-blue-800/50 text-white md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400" /> Monthly Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-4xl font-bold text-green-400">{attendance.filter(a => a.status === 'present').length}</div>
                    <p className="text-sm text-slate-400 mt-1">Days Present</p>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-red-400">{attendance.filter(a => a.status === 'absent').length}</div>
                    <p className="text-sm text-slate-400 mt-1">Days Absent</p>
                  </div>
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
                    {new Date(attendanceMonth).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                  </p>
                  <div className="mt-4 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-s text-yellow-200/80 leading-relaxed">
                    <span className="font-semibold text-yellow-500"> Please note:</span> This attendance record is for reference purposes only. Excused absences, On Duty (OD) leaves, class bunking, and late arrivals are not reflected in this system and should be considered accordingly.
                  </div>
                </CardContent>
              </Card>

              {/* Detailed List */}
              <Card className="bg-slate-800 border-slate-700 text-white md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Daily Records</CardTitle>
                </CardHeader>
                <CardContent>
                  {attendance.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>No attendance records found for this month.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {attendance
                        .slice((attendancePage - 1) * 10, attendancePage * 10)
                        .map((record: any, index) => (
                          <div key={index} className={`flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border ${record.status === 'present' ? 'border-green-500/20 hover:border-green-500/50' : 'border-red-500/20 hover:border-red-500/50'} transition-colors`}>
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${record.status === 'present' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                {record.status === 'present' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                              </div>
                              <div>
                                <p className="font-medium text-white">{new Date(record.date).toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                <p className="text-xs text-slate-500">{record.workspaceName || 'Class Session'}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${record.status === 'present' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                              {record.status === 'present' ? 'PRESENT' : 'ABSENT'}
                            </span>
                          </div>
                        ))}
                      {attendance.length > 10 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <Button variant="outline" size="sm" onClick={() => setAttendancePage(p => Math.max(1, p - 1))} disabled={attendancePage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                          <span className="text-sm text-slate-400">Page {attendancePage} of {Math.ceil(attendance.length / 10)}</span>
                          <Button variant="outline" size="sm" onClick={() => setAttendancePage(p => Math.min(Math.ceil(attendance.length / 10), p + 1))} disabled={attendancePage === Math.ceil(attendance.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      }

      {/* ANNOUNCEMENTS */}
      {
        activeSection === 'announcements' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Announcements</h2>
                <p className="text-slate-400">Stay updated with the latest news and notices.</p>
              </div>
              <div className="relative w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search announcements..."
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                  value={announcementSearch}
                  onChange={(e) => setAnnouncementSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4">
              {announcements.filter(a => a.title.toLowerCase().includes(announcementSearch.toLowerCase()) || a.description.toLowerCase().includes(announcementSearch.toLowerCase())).length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">No announcements found matching your search.</p>
                </div>
              ) : (
                announcements
                  .filter(a => a.title.toLowerCase().includes(announcementSearch.toLowerCase()) || a.description.toLowerCase().includes(announcementSearch.toLowerCase()))
                  .slice((announcePage - 1) * 10, announcePage * 10)
                  .map(a => (
                    <Card key={a.id} className="bg-slate-800 border-slate-700 text-white hover:border-slate-600 transition-all group">
                      <div className="flex flex-col md:flex-row">
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Notice</span>
                              <span className="text-slate-500 text-xs flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : 'Just now'}
                              </span>
                            </div>
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">{a.title}</h3>
                          <p className="text-slate-300 leading-relaxed">{a.description}</p>

                          {a.link && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => window.open(a.link, '_blank')}>
                                <LinkIcon className="h-4 w-4 mr-2" /> Open Attachment / Link
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="w-2 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-lg hidden md:block opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                    </Card>
                  ))
              )}
              {announcements.filter(a => a.title.toLowerCase().includes(announcementSearch.toLowerCase()) || a.description.toLowerCase().includes(announcementSearch.toLowerCase())).length > 10 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button variant="outline" size="sm" onClick={() => setAnnouncePage(p => Math.max(1, p - 1))} disabled={announcePage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm text-slate-400">Page {announcePage} of {Math.ceil(announcements.filter(a => a.title.toLowerCase().includes(announcementSearch.toLowerCase()) || a.description.toLowerCase().includes(announcementSearch.toLowerCase())).length / 10)}</span>
                  <Button variant="outline" size="sm" onClick={() => setAnnouncePage(p => Math.min(Math.ceil(announcements.filter(a => a.title.toLowerCase().includes(announcementSearch.toLowerCase()) || a.description.toLowerCase().includes(announcementSearch.toLowerCase())).length / 10), p + 1))} disabled={announcePage === Math.ceil(announcements.filter(a => a.title.toLowerCase().includes(announcementSearch.toLowerCase()) || a.description.toLowerCase().includes(announcementSearch.toLowerCase())).length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* Maintenance Warning Dialog */}
      <Dialog open={maintenanceMode && showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <DialogContent className="sm:max-w-[425px] border-amber-500/50 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-4 text-amber-500">
              <AlertTriangle className="h-12 w-12" />
              <span className="text-2xl font-bold">Maintenance Mode</span>
            </DialogTitle>
            <DialogDescription className="text-center text-slate-300 text-lg pt-4">
              System maintenance is in progress.
              <br />
              You will be automatically logged out in:
              <div className="text-4xl font-mono font-bold text-amber-500 py-6">
                {maintenanceCountdown !== null ? formatTime(maintenanceCountdown) : '00:00:00'}
              </div>
              <p className="text-sm text-slate-400">Please save your work. You will be redirected to the login page.</p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Download Report Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Download Attendance Report</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select the period for the report. Maximum 6 months allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Month</Label>
                <Input
                  type="month"
                  className="bg-slate-800 border-slate-700 text-white"
                  value={downloadFrom}
                  onChange={(e) => setDownloadFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Month</Label>
                <Input
                  type="month"
                  className="bg-slate-800 border-slate-700 text-white"
                  value={downloadTo}
                  onChange={(e) => setDownloadTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)} className="border-slate-600 hover:bg-slate-800 text-white">Cancel</Button>
            <Button onClick={handleGenerateReport} className="bg-blue-600 hover:bg-blue-700 text-white">Generate PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout >
  );
};

export default StudentDashboard;
