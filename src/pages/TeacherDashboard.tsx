import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  FileText,
  Upload,
  BookOpen,
  Plus,
  ExternalLink,
  Trash2,
  Edit,
  AlertCircle,
  MessageSquare,
  Send,
  RefreshCw,
  Sparkles,
  CheckSquare,
  ClipboardList,
  UserCheck,
  Users,
  Lock,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  PlusCircle,
  ArrowRight,
  AlertTriangle,
  Eye,
  X,
  Unlock,
  Download,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { secondaryDb } from '@/lib/firebaseSecondary';
import { hashPassword, verifyPassword } from '@/lib/security';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  limit,
  writeBatch,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { database } from '@/lib/firebase';
import { ref, onValue, push, set, serverTimestamp as rtdbServerTimestamp, update } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { AITestGenerator } from '@/components/AITestGenerator';
import { DatePicker } from '@/components/ui/date-picker';

// Google Drive Config
const EXAM_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const EXAM_DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID;
const SYLLABUS_DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID; // Using same folder for now as per snippet
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const TeacherDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Realtime Presence State
  const [studentPresence, setStudentPresence] = useState<Record<string, any>>({});

  // Dashboard Stats
  const [stats, setStats] = useState({
    students: 0,
    exams: 0,
    pendingReviews: 0,
    syllabi: 0
  });

  // Data States
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [studentMap, setStudentMap] = useState<Map<string, string>>(new Map());
  const [studentIdMap, setStudentIdMap] = useState<Map<string, string>>(new Map());

  // Form States
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [workspaceStudents, setWorkspaceStudents] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Exam Form
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examLink, setExamLink] = useState('');
  const [examType, setExamType] = useState('exam');
  const [editingExam, setEditingExam] = useState<any>(null);

  // Syllabus Form
  const [syllabusName, setSyllabusName] = useState('');
  const [syllabusUnits, setSyllabusUnits] = useState('');
  const [syllabusLink, setSyllabusLink] = useState('');
  const [editingSyllabus, setEditingSyllabus] = useState<any>(null);

  // Announcement Form
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceDesc, setAnnounceDesc] = useState('');
  const [announceLink, setAnnounceLink] = useState('');
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

  // Query Form
  const [newQuery, setNewQuery] = useState('');

  // Assignment Portal & Filters
  const [portalStatus, setPortalStatus] = useState<'open' | 'closed'>('closed');
  const [filterFrom, setFilterFrom] = useState<Date | undefined>(undefined);
  const [filterTo, setFilterTo] = useState<Date | undefined>(undefined);
  const [bulkMark, setBulkMark] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [selectAllAssignments, setSelectAllAssignments] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);

  const [assignmentFilterType, setAssignmentFilterType] = useState<'all' | 'exam' | 'assignment'>('all');
  const [assignmentFilterWorkspace, setAssignmentFilterWorkspace] = useState('all');

  // View Marks State
  const [viewMarksWorkspace, setViewMarksWorkspace] = useState('');
  const [selectedStudentMarks, setSelectedStudentMarks] = useState<any>(null);
  const [studentMarksData, setStudentMarksData] = useState<any[]>([]);

  // Attendance State
  const [attendanceWorkspace, setAttendanceWorkspace] = useState('');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [viewAttendanceWorkspace, setViewAttendanceWorkspace] = useState('');
  const [viewAttendanceDate, setViewAttendanceDate] = useState('');
  const [viewAttendanceList, setViewAttendanceList] = useState<any[]>([]);
  const [overallAttendanceStats, setOverallAttendanceStats] = useState<Map<string, { present: number, total: number }>>(new Map());
  const [deletedBackup, setDeletedBackup] = useState<{ type: 'single' | 'all', data: any[] } | null>(null);
  const [monthAttendanceData, setMonthAttendanceData] = useState<Map<string, Set<string>>>(new Map());
  const [deletedAssignmentsBackup, setDeletedAssignmentsBackup] = useState<any[]>([]);

  // Assign Marks State
  const [assignMarksSubject, setAssignMarksSubject] = useState('');
  const [assignMarksSectionTitle, setAssignMarksSectionTitle] = useState('');
  const [assignMarksWorkspace, setAssignMarksWorkspace] = useState('');
  const [assignMarksData, setAssignMarksData] = useState<any[]>([]);
  const [assignMarksPage, setAssignMarksPage] = useState(1);
  const [markBatches, setMarkBatches] = useState<any[]>([]);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [viewingBatchMarks, setViewingBatchMarks] = useState<any[]>([]);
  const [viewingBatchPage, setViewingBatchPage] = useState(1);

  // UNOM State
  const [unomTitle, setUnomTitle] = useState('');
  const [unomSubjects, setUnomSubjects] = useState<string[]>(['', '', '', '']);
  const [unomLink, setUnomLink] = useState('');
  const [unomWorkspace, setUnomWorkspace] = useState('');
  const [unomData, setUnomData] = useState<any[]>([]);
  const [unomPage, setUnomPage] = useState(1);
  const [unomReports, setUnomReports] = useState<any[]>([]);
  const [viewingUnomId, setViewingUnomId] = useState<string | null>(null);
  const [viewingUnomData, setViewingUnomData] = useState<any[]>([]);
  const [viewingUnomPage, setViewingUnomPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [unomSearch, setUnomSearch] = useState('');
  const [unomSortConfig, setUnomSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Filters & History Search
  const [examFilterWorkspace, setExamFilterWorkspace] = useState('all');
  const [syllabusFilterWorkspace, setSyllabusFilterWorkspace] = useState('all');
  const [announceFilterWorkspace, setAnnounceFilterWorkspace] = useState('all');
  const [marksHistoryFilterWorkspace, setMarksHistoryFilterWorkspace] = useState('all');
  const [unomHistoryFilterWorkspace, setUnomHistoryFilterWorkspace] = useState('all');
  const [marksHistorySearch, setMarksHistorySearch] = useState('');

  useEffect(() => {
    // Authenticate with Secondary DB
    const secAuth = getAuth(secondaryDb.app);
    signInAnonymously(secAuth).catch(err => {
      console.error("Failed to authenticate with Secondary DB:", err);
    });
  }, []);
  const [unomHistorySearch, setUnomHistorySearch] = useState('');

  // Pagination & Search States
  const [examPage, setExamPage] = useState(1);
  const [examSearch, setExamSearch] = useState('');
  const [syllabusPage, setSyllabusPage] = useState(1);
  const [syllabusSearch, setSyllabusSearch] = useState('');
  const [announcePage, setAnnouncePage] = useState(1);
  const [announceSearch, setAnnounceSearch] = useState('');
  const [queryPage, setQueryPage] = useState(1);
  const [querySearch, setQuerySearch] = useState('');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [marksPage, setMarksPage] = useState(1);
  const [marksSearch, setMarksSearch] = useState('');
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceMarkingPage, setAttendanceMarkingPage] = useState(1);
  const [attendanceMarkingSearch, setAttendanceMarkingSearch] = useState('');
  const [bulkAttendanceStatus, setBulkAttendanceStatus] = useState<'present' | 'absent'>('present');
  const [bulkAttendanceInput, setBulkAttendanceInput] = useState('');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  // Google Drive Auth State
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const tokenClient = useRef<any>(null);

  // Session & Security State
  const [timeRemaining, setTimeRemaining] = useState<number>(8 * 60 * 60); // 8 hours in seconds
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [maintenanceCountdown, setMaintenanceCountdown] = useState<number | null>(null);

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const uid = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');

    if (!email || role !== 'teacher') {
      window.location.href = '/';
      return;
    }

    setIsAuthorized(true);
    setUserEmail(email);
    setUserId(uid || '');

    loadDashboardData(email);
    loadWorkspaces(email, uid || '');

    // Authenticate with Secondary DB for Attendance/Marks access
    const secAuth = getAuth(secondaryDb.app);
    signInAnonymously(secAuth).catch(err => {
      console.error("Failed to authenticate with Secondary DB:", err);
      toast.error("Database connection failed. Some features may not work.");
    });

    // Real-time listeners
    const unsubExams = subscribeExams(email);
    const unsubSyllabi = subscribeSyllabi(email);
    const unsubQueries = subscribeQueries(email);
    const unsubAssignments = subscribeAssignments(email);
    const unsubAnnouncements = subscribeAnnouncements(email);

    // Listen to Student Presence
    const statusRef = ref(database, '/status');
    const unsubPresence = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStudentPresence(data);
      } else {
        setStudentPresence({});
      }
    });

    // Init Google Drive
    initGoogleDrive();

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
      unsubExams();
      unsubSyllabi();
      unsubQueries();
      unsubAssignments();
      unsubAnnouncements();
      unsubMaintenance();
      unsubSession();
      unsubPresence();
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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleGlobalRefresh = () => {
    if (userEmail) {
      toast.loading("Refreshing dashboard...");
      loadDashboardData(userEmail);
      loadWorkspaces(userEmail, userId);
      // Re-triggering subscriptions isn't strictly necessary as they are real-time, 
      // but we can simulate a refresh by just showing the toast or re-fetching static data.
      setTimeout(() => toast.dismiss(), 1000);
      setTimeout(() => toast.success("Dashboard refreshed"), 1100);
    }
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
      // 1. Get current user doc
      const q = query(collection(db, 'users'), where('email', '==', userEmail));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User not found");
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      // 2. Verify current password
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

      // 3. Update password
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

  useEffect(() => {
    if (!userEmail) return;
    const unsubPortal = onSnapshot(doc(db, 'settings', `assignment_portal_${userEmail}`), (d) => {
      if (d.exists()) {
        setPortalStatus(d.data().status);
      }
    });
    return () => unsubPortal();
  }, [userEmail]);

  useEffect(() => {
    if (filterFrom && filterTo && filterFrom > filterTo) {
      const temp = filterFrom;
      setFilterFrom(filterTo);
      setFilterTo(temp);
      toast.info("Date range corrected: 'From' date was after 'To' date");
    }
  }, [filterFrom, filterTo]);

  const togglePortal = async () => {
    const newStatus = portalStatus === 'open' ? 'closed' : 'open';
    try {
      await setDoc(doc(db, 'settings', `assignment_portal_${userEmail}`), {
        status: newStatus,
        teacherEmail: userEmail,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success(`Portal ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update portal status');
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkMark) return;
    const mark = Number(bulkMark);
    if (isNaN(mark)) {
      toast.error('Invalid mark');
      return;
    }

    if (selectedAssignments.length === 0) {
      toast.error("Please select assignments to grade");
      return;
    }

    // Filter assignments to only those selected
    const targets = assignments.filter(a => selectedAssignments.includes(a.id));

    if (targets.length === 0) {
      toast.error("No valid assignments selected");
      return;
    }

    try {
      const batch = writeBatch(db);
      targets.forEach(a => {
        const ref = doc(db, 'submissions', a.id);
        batch.update(ref, {
          marks: mark,
          status: 'graded',
          gradedAt: serverTimestamp()
        });
      });
      await batch.commit();

      // Send Notification to students whose assignments were graded
      const studentEmails = targets.map(a => a.studentEmail).filter(email => email);
      // Deduplicate emails
      const uniqueEmails = [...new Set(studentEmails)];
      await sendNotificationToStudents(uniqueEmails, "Assignment Graded", `Your assignment has been graded. Score: ${mark}`);

      toast.success(`Assigned ${mark} marks to ${targets.length} assignments`);
      setBulkMark('');
      setSelectedAssignments([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to assign grades');
    }
  };

  const handleAssignAndDelete = async () => {
    if (!confirm('Are you sure you want to DELETE all displayed assignments? This action cannot be undone and grades will be lost.')) return;

    const filtered = assignments.filter(a => {
      const matchesSearch = (a.assignmentTitle || '').toLowerCase().includes(assignmentSearch.toLowerCase()) ||
        (a.studentEmail || '').toLowerCase().includes(assignmentSearch.toLowerCase());

      let matchesDate = true;
      if (filterFrom && a.createdAt?.toDate) {
        matchesDate = matchesDate && a.createdAt.toDate() >= filterFrom;
      }
      if (filterTo && a.createdAt?.toDate) {
        const endDate = new Date(filterTo);
        endDate.setDate(endDate.getDate() + 1);
        matchesDate = matchesDate && a.createdAt.toDate() < endDate;
      }

      return matchesSearch && matchesDate;
    });

    if (filtered.length === 0) {
      toast.error("No assignments match current filters");
      return;
    }

    try {
      // Backup before delete
      setDeletedAssignmentsBackup(filtered);

      const batch = writeBatch(db);
      filtered.forEach(a => {
        const ref = doc(db, 'submissions', a.id);
        batch.delete(ref);
      });
      await batch.commit();
      toast.success(`Deleted ${filtered.length} assignments`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete assignments');
    }
  };

  const handleUndoDeleteAssignment = async () => {
    if (deletedAssignmentsBackup.length === 0) {
      toast.info("Nothing to undo");
      return;
    }

    try {
      const batch = writeBatch(db);
      deletedAssignmentsBackup.forEach(a => {
        const ref = doc(db, 'submissions', a.id);
        batch.set(ref, a);
      });
      await batch.commit();
      toast.success(`Restored ${deletedAssignmentsBackup.length} assignments`);
      setDeletedAssignmentsBackup([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to restore assignments");
    }
  };

  const handleTogglePortal = async () => {
    const newStatus = portalStatus === 'open' ? 'closed' : 'open';
    try {
      await setDoc(doc(db, 'settings', `assignment_portal_${userEmail}`), {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setPortalStatus(newStatus);
      toast.success(`Assignment portal ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update portal status');
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
      // Try to re-init if google is now available
      initGoogleDrive();
      if (tokenClient.current) {
        tokenClient.current.requestAccessToken();
      } else {
        toast.error('Google API not loaded yet. Please refresh the page.');
      }
    }
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
      // Try uploading to specified folder
      if (folderId) {
        json = await upload([folderId]);
      } else {
        json = await upload();
      }
    } catch (error) {
      console.warn("Upload to folder failed, retrying to root...", error);
      // Fallback: Upload to root
      json = await upload();
    }

    const fileId = json.id;

    // Make public
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setLink: (l: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!driveAccessToken) {
      toast.error('Please sign in with Google first');
      return;
    }

    try {
      toast.loading('Uploading file...');
      const link = await uploadFileToDrive(file, EXAM_DRIVE_FOLDER_ID);
      setLink(link);
      toast.dismiss();
      toast.success('File uploaded successfully');
    } catch (err) {
      toast.dismiss();
      toast.error('Upload failed');
      console.error(err);
    }
  };

  // --- Data Loading ---
  const loadDashboardData = async (email: string) => {
    try {
      // Students (fetch all to map names)
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const sMap = new Map<string, string>();
      const idMap = new Map<string, string>();
      studentsSnap.forEach(doc => {
        const d = doc.data();
        if (d.email) {
          sMap.set(d.email, d.name || '');
          // Prefer the 'uid' field if it exists (Auth UID), otherwise use document ID
          idMap.set(d.email, d.uid || doc.id);
        }
      });
      setStudentMap(sMap);
      setStudentIdMap(idMap);
      console.log("Student ID Map:", Object.fromEntries(idMap));

      // Exams
      const examsSnap = await getDocs(query(collection(db, 'exams'), where('teacherEmail', '==', email)));

      // Pending Reviews
      // Pending Reviews
      const reviewsSnap = await getDocs(query(collection(db, 'submissions'), where('teacherEmail', 'in', [email, '']), where('status', '==', 'pending')));

      // Syllabi
      const syllabiSnap = await getDocs(query(collection(db, 'syllabi'), where('owner', '==', email)));

      setStats({
        students: studentsSnap.size,
        exams: examsSnap.size,
        pendingReviews: reviewsSnap.size,
        syllabi: syllabiSnap.size
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadWorkspaces = async (email: string, uid: string) => {
    try {
      const wsMap = new Map();

      // 1. Teachers array-contains
      const q1 = query(collection(db, 'workspaces'), where('teachers', 'array-contains', email));
      const s1 = await getDocs(q1);
      s1.forEach(d => wsMap.set(d.id, { id: d.id, ...d.data() }));

      // 2. Admin checks
      const q2 = query(collection(db, 'workspaces'), where('adminEmail', '==', email));
      const s2 = await getDocs(q2);
      s2.forEach(d => wsMap.set(d.id, { id: d.id, ...d.data() }));

      setWorkspaces(Array.from(wsMap.values()));
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const loadWorkspaceStudents = async (wsId: string) => {
    if (!wsId) {
      setWorkspaceStudents([]);
      return;
    }
    const ws = workspaces.find(w => w.id === wsId);
    if (ws && ws.students) {
      setWorkspaceStudents(ws.students);
    } else {
      setWorkspaceStudents([]);
    }
  };

  // --- Subscriptions ---
  const subscribeExams = (email: string) => {
    // Removed orderBy to avoid missing index issues. Sorting client-side.
    const q = query(collection(db, 'exams'), where('teacherEmail', '==', email));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setExams(data);
    }, (error) => {
      console.error("Error fetching exams:", error);
    });
  };

  const subscribeSyllabi = (email: string) => {
    const q = query(collection(db, 'syllabi'), where('owner', '==', email));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSyllabi(data);
    }, (error) => {
      console.error("Error fetching syllabi:", error);
    });
  };

  const subscribeQueries = (email: string) => {
    // Queries are global or user-specific? Keeping existing logic but adding sort safety.
    const q = query(collection(db, 'queries'), limit(100));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setQueries(data);
    }, (error) => {
      console.error("Error fetching queries:", error);
    });
  };

  const subscribeAssignments = (email: string) => {
    const q = query(collection(db, 'submissions'), where('teacherEmail', 'in', [email, '']));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAssignments(data);
    }, (error) => {
      console.error("Error fetching assignments:", error);
    });
  };

  const subscribeAnnouncements = (email: string) => {
    const q = query(collection(db, 'announcements'), where('teacherEmail', '==', email));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAnnouncements(data);
    }, (error) => {
      console.error("Error fetching announcements:", error);
    });
  };

  // --- Actions ---

  const sendNotificationToStudents = async (studentEmails: string[], title: string, body: string, link: string = '/', type: string = 'info') => {
    if (studentEmails.length === 0) return;

    // Find user IDs for these emails
    // Optimization: We need a map of email -> userId. We can build this when loading students.
    // For now, let's assume we can query or have it.
    // In loadDashboardData, we loaded students. Let's ensure we have userId map.

    // We need to fetch userIds if we don't have them. 
    // Let's assume we update loadDashboardData to store email -> uid map.

    const updates: Record<string, any> = {};

    studentEmails.forEach(email => {
      // Find UID from studentMap (which currently stores name). 
      // We need to update studentMap to store object or have a separate map.
      // Let's use a new map `studentIdMap` which we will add.
      const uid = studentIdMap.get(email);
      if (uid) {
        const newNotifKey = push(ref(database, `notifications/${uid}`)).key;
        if (newNotifKey) {
          updates[`notifications/${uid}/${newNotifKey}`] = {
            title,
            body,
            link,
            type, // Add type here
            timestamp: rtdbServerTimestamp(),
            sender: userEmail,
            read: false
          };
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await update(ref(database), updates);
        console.log(`Notifications sent to ${Object.keys(updates).length} students`);
      } catch (e) {
        console.error("Error sending notifications:", e);
      }
    }
  };
  const handleCreateExam = async () => {
    if (!examTitle || !selectedWorkspace) {
      toast.error('Title and Workspace are required');
      return;
    }

    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    try {
      const examData = {
        title: examTitle,
        description: examDesc,
        driveLink: examLink,
        type: examType,
        workspaceId: selectedWorkspace,
        students: selectedStudents,
        teacherEmail: userEmail,
        createdAt: serverTimestamp()
      };

      if (editingExam) {
        await updateDoc(doc(db, 'exams', editingExam.id), examData);
        toast.success('Exam updated');
        setEditingExam(null);
      } else {
        await addDoc(collection(db, 'exams'), examData);

        // Notify via teacher_uploads
        await addDoc(collection(db, 'teacher_uploads'), {
          type: 'test',
          title: examTitle,
          description: examDesc,
          url: examLink,
          workspaceId: selectedWorkspace,
          teacherEmail: userEmail,
          timestamp: serverTimestamp()
        });


        // Send Push Notification
        const notifTitle = examType === 'assignment' ? "New Assignment" : "New Test";
        const notifBody = `${notifTitle}: ${examTitle}`;
        await sendNotificationToStudents(selectedStudents.length > 0 ? selectedStudents : workspaceStudents, notifTitle, notifBody, examLink, examType);

        toast.success(`${examType === 'assignment' ? 'Assignment' : 'Test'} created`);
      }

      // Reset form
      setExamTitle('');
      setExamDesc('');
      setExamLink('');
      setExamType('exam');
      setSelectedStudents([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save exam');
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Delete this exam?')) return;
    try {
      await deleteDoc(doc(db, 'exams', id));
      toast.success('Exam deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleCreateSyllabus = async () => {
    if (!syllabusName || !selectedWorkspace) {
      toast.error('Name and Workspace are required');
      return;
    }

    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    try {
      const data = {
        name: syllabusName,
        units: syllabusUnits.split(',').map(s => s.trim()).filter(Boolean),
        driveLink: syllabusLink,
        workspaceId: selectedWorkspace,
        students: selectedStudents,
        owner: userEmail,
        createdAt: serverTimestamp()
      };

      if (editingSyllabus) {
        await updateDoc(doc(db, 'syllabi', editingSyllabus.id), data);
        toast.success('Syllabus updated');
        setEditingSyllabus(null);
      } else {
        await addDoc(collection(db, 'syllabi'), data);

        // Notify
        await addDoc(collection(db, 'teacher_uploads'), {
          type: 'syllabus',
          title: syllabusName,
          description: '',
          url: syllabusLink,
          workspaceId: selectedWorkspace,
          teacherEmail: userEmail,
          timestamp: serverTimestamp()
        });

        // Send Push Notification
        // Send Push Notification
        await sendNotificationToStudents(selectedStudents.length > 0 ? selectedStudents : workspaceStudents, "New Syllabus", `New Syllabus Uploaded: ${syllabusName}`, syllabusLink, 'syllabus');

        toast.success('Syllabus uploaded');
      }

      setSyllabusName('');
      setSyllabusUnits('');
      setSyllabusLink('');
      setSelectedStudents([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save syllabus');
    }
  };

  const handleDeleteSyllabus = async (id: string) => {
    if (!confirm('Delete this syllabus?')) return;
    try {
      await deleteDoc(doc(db, 'syllabi', id));
      toast.success('Syllabus deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Announcement Form

  const handleSendAnnouncement = async () => {
    if (!announceTitle || !selectedWorkspace) {
      toast.error('Title and Workspace are required');
      return;
    }

    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    try {
      const data = {
        title: announceTitle,
        description: announceDesc,
        link: announceLink,
        workspaceId: selectedWorkspace,
        students: selectedStudents,
        teacherEmail: userEmail,
        createdAt: serverTimestamp()
      };

      if (editingAnnouncement) {
        await updateDoc(doc(db, 'announcements', editingAnnouncement.id), data);
        toast.success('Announcement updated');
        setEditingAnnouncement(null);
      } else {
        await addDoc(collection(db, 'announcements'), data);

        // Notify via teacher_uploads for student visibility
        await addDoc(collection(db, 'teacher_uploads'), {
          type: 'announcement',
          title: announceTitle,
          description: announceDesc,
          url: announceLink,
          workspaceId: selectedWorkspace,
          teacherEmail: userEmail,
          timestamp: serverTimestamp()
        });

        // Send Push Notification
        // Send Push Notification
        await sendNotificationToStudents(selectedStudents.length > 0 ? selectedStudents : workspaceStudents, "New Announcement", `New Announcement: ${announceTitle}`, announceLink, 'announcement');

        toast.success('Announcement sent');
      }

      setAnnounceTitle('');
      setAnnounceDesc('');
      setAnnounceLink('');
      setSelectedStudents([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save announcement');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast.success('Announcement deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleDeleteAllAnnouncements = async () => {
    if (announcements.length === 0) return;
    if (!confirm('Are you sure you want to delete ALL announcements? This cannot be undone.')) return;

    try {
      const batch = writeBatch(db);
      announcements.forEach(a => {
        batch.delete(doc(db, 'announcements', a.id));
      });
      await batch.commit();
      toast.success('All announcements deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete all announcements');
    }
  };

  const handleDeleteAllExams = async () => {
    if (exams.length === 0) return;
    if (!confirm('Are you sure you want to delete ALL exams? This cannot be undone.')) return;

    try {
      const batch = writeBatch(db);
      exams.forEach(e => {
        batch.delete(doc(db, 'exams', e.id));
      });
      await batch.commit();
      toast.success('All exams deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete all exams');
    }
  };

  const handleDeleteAllSyllabi = async () => {
    if (syllabi.length === 0) return;
    if (!confirm('Are you sure you want to delete ALL syllabi? This cannot be undone.')) return;

    try {
      const batch = writeBatch(db);
      syllabi.forEach(s => {
        batch.delete(doc(db, 'syllabi', s.id));
      });
      await batch.commit();
      toast.success('All syllabi deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete all syllabi');
    }
  };

  const handleSendQuery = async () => {
    if (!newQuery.trim()) return;
    try {
      await addDoc(collection(db, 'queries'), {
        question: newQuery,
        userEmail: userEmail,
        status: 'pending',
        createdAt: serverTimestamp(),
        fromBot: false
      });
      setNewQuery('');
      toast.success('Query sent');
    } catch (error) {
      toast.error('Failed to send query');
    }
  };

  const handleRefreshQueries = async () => {
    try {
      const q = query(collection(db, 'queries'), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setQueries(data);
      toast.success("Queries refreshed");
    } catch (error) {
      console.error("Error refreshing queries:", error);
      toast.error("Failed to refresh queries");
    }
  };

  const handleUpdateMarks = async (id: string, marks: number) => {
    try {
      await updateDoc(doc(db, 'submissions', id), {
        marks: marks,
        status: 'graded',
        gradedAt: serverTimestamp()
      });

      // Fetch submission to get student email for notification
      // Optimization: We could pass studentEmail to this function or look it up from assignments list
      const submission = assignments.find(a => a.id === id);
      if (submission && submission.studentEmail) {
        await sendNotificationToStudents([submission.studentEmail], "Assignment Graded", `Your assignment has been graded. Score: ${marks}`, '/', 'marks');
      }

      toast.success('Marks updated');
    } catch (error) {
      toast.error('Failed to update marks');
    }
  };

  const handleFetchStudentMarks = async (studentEmail: string) => {
    try {
      // Fetch assignments
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('studentEmail', '==', studentEmail),
        where('status', '==', 'graded')
      );
      const submissionsSnap = await getDocs(submissionsQuery);
      const submissions = submissionsSnap.docs.map(d => ({
        id: d.id,
        type: 'Assignment',
        title: d.data().assignmentTitle || 'Untitled Assignment',
        marks: d.data().marks,
        date: d.data().gradedAt
      }));

      // Fetch exam results (assuming there's a collection for this, or using submissions with type 'exam')
      // For now, let's assume exams are also in submissions or a separate collection.
      // If exams are separate:
      // const examsQuery = query(collection(db, 'exam_results'), where('studentEmail', '==', studentEmail)); ...

      setStudentMarksData(submissions);
      setSelectedStudentMarks({ email: studentEmail });
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch marks');
    }
  };

  const handleFetchAttendance = async (workspaceId: string, date: string, isViewMode: boolean = false) => {
    if (!workspaceId || !date) return;

    try {
      // Check if attendance record exists
      // Optimization: Fetch by workspaceId only to avoid composite index requirement, then filter by date
      const q = query(
        collection(secondaryDb, 'attendance'),
        where('workspaceId', '==', workspaceId)
      );
      const snap = await getDocs(q);

      // Filter for the specific date in memory
      const targetDoc = snap.docs.find(d => d.data().date === date);

      const workspace = workspaces.find(w => w.id === workspaceId);
      const allStudents = workspace?.students || [];

      if (targetDoc) {
        // Record exists
        const data = targetDoc.data();
        const presentStudents = new Set(data.presentStudents || []);

        const list = allStudents.map((email: string) => ({
          email,
          status: presentStudents.has(email) ? 'present' : 'absent'
        }));

        if (isViewMode) {
          setViewAttendanceList(list);
        } else {
          setAttendanceList(list);
        }
      } else {
        // No record, default to all absent (or present)
        const list = allStudents.map((email: string) => ({
          email,
          status: 'absent'
        }));

        if (isViewMode) {
          setViewAttendanceList([]); // Or show "No record found"
          toast.info('No attendance record found for this date');
        } else {
          setAttendanceList(list);
        }
      }
    } catch (error: any) {
      console.error("Attendance fetch error:", error);
      if (error.code === 'permission-denied') {
        toast.error("Access denied. Please update Firestore Security Rules.");
      } else {
        toast.error(`Failed to fetch attendance: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const fetchOverallAttendance = async (workspaceId: string) => {
    if (!workspaceId) return;
    try {
      const q = query(collection(secondaryDb, 'attendance'), where('workspaceId', '==', workspaceId));
      const snap = await getDocs(q);

      const totalDays = snap.size;
      const studentCounts = new Map<string, number>(); // email -> days present

      snap.docs.forEach(doc => {
        const present = doc.data().presentStudents || [];
        present.forEach((email: string) => {
          studentCounts.set(email, (studentCounts.get(email) || 0) + 1);
        });
      });

      const finalStats = new Map();
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace && workspace.students) {
        workspace.students.forEach((email: string) => {
          finalStats.set(email, {
            present: studentCounts.get(email) || 0,
            total: totalDays
          });
        });
      }
      setOverallAttendanceStats(finalStats);
    } catch (e) {
      console.error("Error fetching overall stats", e);
    }
  };

  const handleFetchMonthAttendance = async (workspaceId: string, month: string) => {
    if (!workspaceId || !month) return;

    // month format: YYYY-MM
    const [year, monthStr] = month.split('-');
    const startDate = `${month}-01`;
    // Calculate last day of month
    const lastDay = new Date(parseInt(year), parseInt(monthStr), 0).getDate();
    const endDate = `${month}-${lastDay}`;

    try {
      // Fetch all for workspace to avoid composite index requirement
      const q = query(
        collection(secondaryDb, 'attendance'),
        where('workspaceId', '==', workspaceId)
      );

      const snap = await getDocs(q);
      const data = new Map<string, Set<string>>();

      snap.docs.forEach(doc => {
        const d = doc.data();
        // Filter in memory
        if (d.date >= startDate && d.date <= endDate) {
          data.set(d.date, new Set(d.presentStudents || []));
        }
      });

      setMonthAttendanceData(data);
    } catch (error: any) {
      console.error("Error fetching month attendance:", error);
      if (error.code === 'permission-denied') {
        toast.error("Access denied (Month View). Update Firestore Rules.");
      } else {
        toast.error(`Failed to fetch month attendance: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleBulkAttendanceUpdate = () => {
    if (!bulkAttendanceInput.trim()) return;

    const identifiers = bulkAttendanceInput.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
    if (identifiers.length === 0) return;

    setAttendanceList(prev => prev.map(student => {
      const email = student.email.toLowerCase();
      const name = (studentMap.get(student.email) || '').toLowerCase();

      // Check if email or name contains any of the identifiers
      const isMatch = identifiers.some(id => email.includes(id) || name.includes(id));

      if (isMatch) {
        return { ...student, status: bulkAttendanceStatus };
      }
      return student;
    }));

    toast.success(`Updated attendance for matching students to ${bulkAttendanceStatus}`);
    setBulkAttendanceInput('');
  };

  const handleDeleteAttendance = async () => {
    const wsId = activeSection === 'view-attendance' ? viewAttendanceWorkspace : attendanceWorkspace;
    const date = activeSection === 'view-attendance' ? viewAttendanceDate : attendanceDate;

    if (!wsId || !date) {
      toast.error("Select workspace and date");
      return;
    }

    if (!confirm("Are you sure you want to delete the entire attendance for this date? This cannot be undone.")) return;

    try {
      // Optimization: Fetch by workspaceId only
      const q = query(
        collection(secondaryDb, 'attendance'),
        where('workspaceId', '==', wsId)
      );
      const snap = await getDocs(q);
      const targetDoc = snap.docs.find(d => d.data().date === date);

      if (!targetDoc) {
        toast.error("No attendance record found to delete");
        return;
      }

      // Backup
      const backupData = [targetDoc.data()];
      setDeletedBackup({ type: 'single', data: backupData });

      const batch = writeBatch(secondaryDb);
      batch.delete(targetDoc.ref);
      await batch.commit();

      toast.success("Attendance record deleted");

      if (activeSection === 'view-attendance') {
        if (viewAttendanceDate) handleFetchMonthAttendance(wsId, viewAttendanceDate);
        fetchOverallAttendance(wsId);
      } else {
        handleFetchAttendance(wsId, date, false);
        fetchOverallAttendance(wsId);
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to delete attendance");
    }
  };

  const handleSaveAttendance = async () => {
    if (!attendanceWorkspace || !attendanceDate) {
      toast.error('Please select workspace and date');
      return;
    }

    try {
      const presentEmails = attendanceList
        .filter(s => s.status === 'present')
        .map(s => s.email);

      // Optimization: Fetch by workspaceId only
      const q = query(
        collection(secondaryDb, 'attendance'),
        where('workspaceId', '==', attendanceWorkspace)
      );
      const snap = await getDocs(q);
      const targetDoc = snap.docs.find(d => d.data().date === attendanceDate);

      if (targetDoc) {
        // Update existing
        await updateDoc(targetDoc.ref, {
          presentStudents: presentEmails,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        await addDoc(collection(secondaryDb, 'attendance'), {
          workspaceId: attendanceWorkspace,
          date: attendanceDate,
          presentStudents: presentEmails,
          teacherEmail: userEmail,
          createdAt: serverTimestamp()
        });
      }
      toast.success('Attendance saved');
      fetchOverallAttendance(attendanceWorkspace);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save attendance');
    }
  };

  const handleDeleteAllAttendance = async () => {
    if (!attendanceWorkspace) {
      toast.error("Please select a workspace first");
      return;
    }

    if (!confirm("WARNING: This will delete ALL attendance records for ALL DATES in this workspace. This action cannot be undone. Are you sure?")) return;

    try {
      const q = query(
        collection(secondaryDb, 'attendance'),
        where('workspaceId', '==', attendanceWorkspace)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.info("No attendance records found to delete.");
        return;
      }

      // Backup
      const backupData = snap.docs.map(d => d.data());
      setDeletedBackup({ type: 'all', data: backupData });

      const batch = writeBatch(secondaryDb);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      toast.success("All attendance records deleted for this workspace");

      // Refresh UI
      if (attendanceDate) {
        handleFetchAttendance(attendanceWorkspace, attendanceDate, false);
      }
      fetchOverallAttendance(attendanceWorkspace);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete all attendance");
    }
  };

  const handleUndoDelete = async () => {
    if (!deletedBackup) return;

    try {
      const batch = writeBatch(secondaryDb);
      deletedBackup.data.forEach(item => {
        const ref = doc(collection(secondaryDb, 'attendance'));
        batch.set(ref, item);
      });
      await batch.commit();
      toast.success("Undo successful");
      setDeletedBackup(null);

      // Refresh
      if (attendanceWorkspace) {
        fetchOverallAttendance(attendanceWorkspace);
        if (attendanceDate) handleFetchAttendance(attendanceWorkspace, attendanceDate, false);
      }
      if (viewAttendanceWorkspace && viewAttendanceDate) {
        handleFetchMonthAttendance(viewAttendanceWorkspace, viewAttendanceDate);
      }
    } catch (e) {
      console.error(e);
      toast.error("Undo failed");
    }
  };

  const handleMarksCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const parsedData: any[] = [];

      // Skip header if present (assuming email,marks)
      let startIndex = 0;
      if (lines[0].toLowerCase().includes('email')) startIndex = 1;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [email, marks] = line.split(',');
        if (email && marks) {
          parsedData.push({ email: email.trim(), marks: marks.trim() });
        }
      }
      setAssignMarksData(parsedData);
      toast.success(`Loaded ${parsedData.length} records`);
    };
    reader.readAsText(file);
  };

  const handlePublishMarks = async () => {
    if (!assignMarksSubject) {
      toast.error('Please enter a subject name');
      return;
    }
    if (!assignMarksSectionTitle) {
      toast.error('Please enter a section title');
      return;
    }
    if (assignMarksData.length === 0) {
      toast.error('No data to publish');
      return;
    }

    try {
      const batch = writeBatch(secondaryDb);
      const batchId = doc(collection(secondaryDb, 'mark_batches')).id;
      const matchedCount = assignMarksData.length; // Assuming all data is matched for now

      // Create Batch Record
      const batchDocRef = doc(secondaryDb, 'mark_batches', batchId);
      batch.set(batchDocRef, {
        subject: assignMarksSubject,
        sectionTitle: assignMarksSectionTitle,
        teacherEmail: userEmail,
        createdAt: serverTimestamp(),
        count: matchedCount,
        status: 'active',
        workspaceId: assignMarksWorkspace || 'unknown'
      });

      assignMarksData.forEach(item => {
        const docRef = doc(collection(secondaryDb, 'marks'));
        batch.set(docRef, {
          studentEmail: item.email,
          subject: assignMarksSubject,
          sectionTitle: assignMarksSectionTitle,
          marks: item.marks,
          teacherEmail: userEmail,
          publishedAt: serverTimestamp(),
          type: 'csv_upload',
          batchId: batchId,
          deleted: false
        });
      });

      await batch.commit();

      // Send Notification
      const studentEmails = assignMarksData.map(item => item.email);
      await sendNotificationToStudents(studentEmails, "Marks Published", `Marks published for ${assignMarksSubject} (${assignMarksSectionTitle})`);

      toast.success(`Published marks for ${matchedCount} students`);
      setAssignMarksData([]);
      setAssignMarksSubject('');
      setAssignMarksSectionTitle('');
      // Refresh batches
      fetchMarkBatches();
    } catch (error) {
      console.error('Error publishing marks:', error);
      toast.error('Failed to publish marks');
    }
  };

  const fetchMarkBatches = async () => {
    try {
      // Removed orderBy to avoid index requirement issues
      const q = query(collection(secondaryDb, 'mark_batches'), where('teacherEmail', '==', userEmail));
      const snap = await getDocs(q);
      console.log(`Fetched ${snap.size} batches for ${userEmail}`);

      const batches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory
      batches.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });

      setMarkBatches(batches);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  useEffect(() => {
    if (activeSection === 'assign-marks') {
      fetchMarkBatches();
    }
  }, [activeSection, userEmail]);

  const handleDeleteBatch = async (batchId: string) => {
    try {
      const batch = writeBatch(secondaryDb);

      // Mark batch as deleted
      const batchRef = doc(secondaryDb, 'mark_batches', batchId);
      batch.update(batchRef, { status: 'deleted' });

      // Mark all marks in batch as deleted
      const marksQ = query(collection(secondaryDb, 'marks'), where('batchId', '==', batchId));
      const marksSnap = await getDocs(marksQ);
      marksSnap.docs.forEach(d => {
        batch.update(d.ref, { deleted: true });
      });

      await batch.commit();
      toast.success('Batch deleted');
      fetchMarkBatches();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch");
    }
  };

  const handleUndoBatch = async (batchId: string) => {
    try {
      const batch = writeBatch(secondaryDb);

      // Restore batch
      const batchRef = doc(secondaryDb, 'mark_batches', batchId);
      batch.update(batchRef, { status: 'active' });

      // Restore marks
      const marksQ = query(collection(secondaryDb, 'marks'), where('batchId', '==', batchId));
      const marksSnap = await getDocs(marksQ);
      marksSnap.docs.forEach(d => {
        batch.update(d.ref, { deleted: false });
      });

      await batch.commit();
      toast.success('Batch restored');
      fetchMarkBatches();
    } catch (error) {
      console.error("Error restoring batch:", error);
      toast.error("Failed to restore batch");
    }
  };

  const handleDeleteAllBatches = async () => {
    if (!window.confirm("Are you sure you want to permanently delete ALL upload history? This action cannot be undone.")) return;

    try {
      const batch = writeBatch(secondaryDb);

      // Get all batches
      const batchesQ = query(collection(secondaryDb, 'mark_batches'), where('teacherEmail', '==', userEmail));
      const batchesSnap = await getDocs(batchesQ);
      batchesSnap.docs.forEach(d => batch.delete(d.ref));

      // Get all marks
      const marksQ = query(collection(secondaryDb, 'marks'), where('teacherEmail', '==', userEmail), where('type', '==', 'csv_upload'));
      const marksSnap = await getDocs(marksQ);
      marksSnap.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      toast.success('All history permanently deleted');
      fetchMarkBatches();
      setViewingBatchId(null);
      setViewingBatchMarks([]);
    } catch (error) {
      console.error("Error deleting all:", error);
      toast.error("Failed to delete all");
    }
  };

  const handleViewBatchMarks = async (batchId: string) => {
    if (viewingBatchId === batchId) {
      setViewingBatchId(null);
      setViewingBatchMarks([]);
      return;
    }

    try {
      setViewingBatchPage(1);
      const q = query(collection(secondaryDb, 'marks'), where('batchId', '==', batchId));
      const snap = await getDocs(q);
      setViewingBatchMarks(snap.docs.map(d => d.data()));
      setViewingBatchId(batchId);
    } catch (error) {
      console.error("Error fetching batch marks:", error);
      toast.error("Failed to fetch marks");
    }
  };

  const handleDownloadSampleCsv = () => {
    let csvContent = "email,marks\n";

    if (assignMarksWorkspace) {
      const ws = workspaces.find(w => w.id === assignMarksWorkspace);
      if (ws && ws.students && ws.students.length > 0) {
        ws.students.forEach((email: string) => {
          csvContent += `${email},\n`;
        });
      } else {
        csvContent += "student@example.com,85\n";
      }
    } else {
      csvContent += "student@example.com,85\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'marks_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // UNOM Functions
  const handleAddSubject = () => {
    setUnomSubjects([...unomSubjects, '']);
  };

  const handleRemoveSubject = (index: number) => {
    if (unomSubjects.length <= 4) return;
    const newSubjects = [...unomSubjects];
    newSubjects.splice(index, 1);
    setUnomSubjects(newSubjects);
  };

  const handleUnomSubjectChange = (index: number, value: string) => {
    const newSubjects = [...unomSubjects];
    newSubjects[index] = value;
    setUnomSubjects(newSubjects);
  };

  const handleCreateUnom = async () => {
    if (!unomWorkspace) {
      toast.error("Please select a workspace");
      return;
    }
    if (!unomTitle) {
      toast.error("Please enter a title");
      return;
    }

    const validSubjects = unomSubjects.filter(s => s.trim() !== '');
    if (validSubjects.length === 0) {
      toast.error("Please enter at least one subject");
      return;
    }

    try {
      const ws = workspaces.find(w => w.id === unomWorkspace);
      if (!ws || !ws.students || ws.students.length === 0) {
        toast.error("No students found in selected workspace");
        return;
      }

      const students = ws.students; // Array of emails
      const reportData: any[] = [];

      // Fetch all marks for these students and subjects
      // Optimization: Fetch all marks for the workspace/teacher once, then filter in memory
      // Or fetch per subject. Let's fetch all marks for the teacher to minimize reads if possible,
      // but 'marks' collection might be huge.
      // Better: Query marks where teacherEmail == userEmail AND subject IN validSubjects (if Firestore supports IN with many items)
      // Firestore 'in' supports up to 10. We might have more.
      // Let's fetch all marks for this teacher and filter.

      // Initialize empty report data
      for (const email of students) {
        const row: any = { email };
        validSubjects.forEach(sub => {
          row[sub] = null; // Initialize as null
        });
        row.total = 0;
        row.percentage = 0;
        row.rank = 0;
        reportData.push(row);
      }

      setUnomData(reportData);
      setUnomPage(1);
      toast.success("Template generated. Please enter marks.");

    } catch (error) {
      console.error("Error creating UNOM template:", error);
      toast.error("Failed to create template");
    }
  };

  const handleUnomMarkChange = (email: string, field: string, value: string) => {
    const newData = [...unomData];
    const rowIndex = newData.findIndex(r => r.email === email);
    if (rowIndex === -1) return;

    // Validation
    if (value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (field.endsWith('_internal') && num > 25) return;
        if (field.endsWith('_external') && num > 75) return;
      }
    }

    newData[rowIndex][field] = value;

    // If modifying internal/external, update the subject total
    let baseSubject = field;
    if (field.endsWith('_internal')) {
      baseSubject = field.replace('_internal', '');
    } else if (field.endsWith('_external')) {
      baseSubject = field.replace('_external', '');
    }

    if (field !== baseSubject) {
      const intVal = parseInt(newData[rowIndex][`${baseSubject}_internal`] || '0');
      const extVal = parseInt(newData[rowIndex][`${baseSubject}_external`] || '0');
      // Auto-calculate total if inputs are numbers
      if (!isNaN(intVal) && !isNaN(extVal)) {
        newData[rowIndex][baseSubject] = (intVal + extVal).toString();
      }
    }

    // Recalculate stats for this row
    let total = 0;
    let subjectCount = 0;
    const validSubjects = unomSubjects.filter(s => s.trim() !== '');

    validSubjects.forEach(sub => {
      const val = parseFloat(newData[rowIndex][sub]);
      if (!isNaN(val)) {
        total += val;
        subjectCount++;
      }
    });

    newData[rowIndex].total = total;
    newData[rowIndex].percentage = subjectCount > 0 ? (total / (validSubjects.length * 100)) * 100 : 0;

    setUnomData(newData);
  };

  const handleSaveUnomReport = async () => {
    if (!unomTitle) {
      toast.error("Please enter a title");
      return;
    }
    if (unomData.length === 0) {
      toast.error("No data to save");
      return;
    }

    try {
      // Calculate ranks before saving
      const dataToSave = [...unomData];
      dataToSave.sort((a, b) => b.total - a.total);
      dataToSave.forEach((row, index) => {
        row.rank = index + 1;
      });

      const validSubjects = unomSubjects.filter(s => s.trim() !== '');

      await addDoc(collection(secondaryDb, 'unom_reports'), {
        title: unomTitle,
        teacherEmail: userEmail,
        workspaceId: unomWorkspace,
        subjects: validSubjects,
        link: unomLink,
        createdAt: serverTimestamp(),
        data: dataToSave,
        status: 'active'
      });

      // Send Notification
      const studentEmails = dataToSave.map(row => row.email);
      await sendNotificationToStudents(studentEmails, "UNOM Report", `New UNOM Report: ${unomTitle}`, unomLink, 'unom');

      toast.success("UNOM Report saved successfully");
      fetchUnomReports();
      setUnomTitle('');
      setUnomSubjects(['', '', '', '']);
      setUnomData([]);
      setUnomWorkspace('');
    } catch (error) {
      console.error("Error saving UNOM report:", error);
      toast.error("Failed to save report");
    }
  };

  const fetchUnomReports = async () => {
    try {
      if (workspaces.length === 0) {
        setUnomReports([]);
        return;
      }

      const workspaceIds = workspaces.map(w => w.id);
      let allReports: any[] = [];

      // Chunking for 'in' query limit of 10
      const chunks = [];
      for (let i = 0; i < workspaceIds.length; i += 10) {
        chunks.push(workspaceIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const q = query(collection(secondaryDb, 'unom_reports'), where('workspaceId', 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(d => allReports.push({ id: d.id, ...d.data() }));
      }

      // Remove duplicates
      const uniqueReports = Array.from(new Map(allReports.map(item => [item.id, item])).values());

      uniqueReports.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      setUnomReports(uniqueReports);
    } catch (error) {
      console.error("Error fetching UNOM reports:", error);
    }
  };

  useEffect(() => {
    if (activeSection === 'unom' && workspaces.length > 0) {
      fetchUnomReports();
    }
  }, [activeSection, workspaces]);

  // Sync viewing data when reports update
  useEffect(() => {
    if (viewingUnomId) {
      const report = unomReports.find(r => r.id === viewingUnomId);
      if (report) {
        setViewingUnomData(report.data || []);
      }
    }
  }, [unomReports, viewingUnomId]);

  const handleDeleteUnom = async (id: string) => {
    try {
      await updateDoc(doc(secondaryDb, 'unom_reports', id), { status: 'deleted' });
      toast.success('UNOM report deleted successfully');
      fetchUnomReports();
    } catch (error) {
      console.error("Error deleting UNOM report:", error);
      toast.error("Failed to delete UNOM report");
    }
  };

  const handleDownloadUnomCsv = (report: any) => {
    if (!report || !report.data) return;

    const subjects = report.subjects || [];

    // Create headers with Internal, External, and Total for each subject
    const subjectHeaders = subjects.flatMap((sub: string) => [
      `${sub} (Int)`,
      `${sub} (Ext)`,
      `${sub} (Tot)`
    ]);

    const headers = ['Email', ...subjectHeaders, 'Grand Total', 'Percentage', 'Rank'];

    const csvRows = [
      headers.join(','),
      ...report.data.map((row: any) => {
        const subjectValues = subjects.flatMap((sub: string) => [
          row[`${sub}_internal`] || '-',
          row[`${sub}_external`] || '-',
          row[sub] || '-'
        ]);

        const values = [
          row.email,
          ...subjectValues,
          row.total || 0,
          `${parseFloat(row.percentage || 0).toFixed(2)}%`,
          row.rank || '-'
        ];
        return values.map(v => `"${v}"`).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${report.title || 'unom_report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAllWorkspaceMarks = async () => {
    if (!viewMarksWorkspace) return;
    if (!confirm("Are you sure you want to PERMANENTLY DELETE all graded marks for this workspace? This cannot be undone.")) return;

    try {
      const ws = workspaces.find(w => w.id === viewMarksWorkspace);
      if (!ws || !ws.students) return;

      const allDocs: any[] = [];
      // Fetch all graded submissions for students in this workspace
      await Promise.all(ws.students.map(async (email: string) => {
        const q = query(collection(db, 'submissions'), where('studentEmail', '==', email), where('status', '==', 'graded'));
        const snap = await getDocs(q);
        snap.docs.forEach(d => allDocs.push(d.ref));
      }));

      if (allDocs.length === 0) {
        toast.info("No marks found to delete");
        return;
      }

      // Batch delete (chunk by 500)
      const chunks = [];
      for (let i = 0; i < allDocs.length; i += 500) {
        chunks.push(allDocs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      toast.success(`Deleted ${allDocs.length} marks`);
      // Refresh logic if needed, but since we view by student, clearing the data is enough.
      // We might want to clear studentMarksData if the currently viewed student is in this workspace.
      setStudentMarksData([]);
      setSelectedStudentMarks(null);

    } catch (error) {
      console.error(error);
      toast.error("Failed to delete marks");
    }
  };

  const handleDownloadAttendanceCsv = () => {
    if (!viewAttendanceWorkspace || !viewAttendanceDate) return;

    const workspace = workspaces.find(w => w.id === viewAttendanceWorkspace);
    if (!workspace || !workspace.students) return;

    const daysInMonth = new Date(parseInt(viewAttendanceDate.split('-')[0]), parseInt(viewAttendanceDate.split('-')[1]), 0).getDate();
    const year = viewAttendanceDate.split('-')[0];
    const month = viewAttendanceDate.split('-')[1];

    // Headers: Student, 1, 2, ..., 31, Present Count, Total Days (Recorded)
    const headers = ['Student Email', 'Name'];
    for (let i = 1; i <= daysInMonth; i++) {
      headers.push(i.toString());
    }
    headers.push('Present Days');
    headers.push('Total Recorded Days');
    headers.push('Percentage');

    const csvRows = [headers.join(',')];

    workspace.students.forEach((email: string) => {
      const name = studentMap.get(email) || '';
      const row = [email, name];
      let presentCount = 0;
      let recordedCount = 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${month}-${i.toString().padStart(2, '0')}`;
        const hasRecord = monthAttendanceData.has(dateStr);

        if (hasRecord) {
          recordedCount++;
          const isPresent = monthAttendanceData.get(dateStr)?.has(email);
          if (isPresent) {
            presentCount++;
            row.push('P');
          } else {
            row.push('A');
          }
        } else {
          row.push('-');
        }
      }

      row.push(presentCount.toString());
      row.push(recordedCount.toString());
      const percentage = recordedCount > 0 ? ((presentCount / recordedCount) * 100).toFixed(2) + '%' : '0%';
      row.push(percentage);

      csvRows.push(row.map(v => `"${v}"`).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${workspace.name}_${viewAttendanceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUnomSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (unomSortConfig && unomSortConfig.key === key && unomSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setUnomSortConfig({ key, direction });
  };

  const handleUndoUnom = async (id: string) => {
    try {
      await updateDoc(doc(secondaryDb, 'unom_reports', id), { status: 'active' });
      toast.success('Report restored');
      fetchUnomReports();
    } catch (error) {
      console.error("Error restoring report:", error);
      toast.error("Failed to restore report");
    }
  };

  const handleClearUpdate = async (report: any, studentEmail: string) => {
    // Check authorization
    const ws = workspaces.find(w => w.id === report.workspaceId);
    if (!ws || (ws.classTeacher !== userEmail && ws.mentor !== userEmail)) {
      toast.error("Only Class Teacher or Mentor can clear this status.");
      return;
    }

    try {
      const newData = [...report.data];
      const studentIndex = newData.findIndex((d: any) => d.email === studentEmail);
      if (studentIndex === -1) return;

      newData[studentIndex] = {
        ...newData[studentIndex],
        hasUpdated: false
      };

      await updateDoc(doc(secondaryDb, 'unom_reports', report.id), {
        data: newData
      });
      toast.success("Status cleared");
    } catch (error) {
      console.error("Error clearing status:", error);
      toast.error("Failed to clear status");
    }
  };

  const handleMarkAllAsMarked = async (report: any) => {
    // Check authorization
    const ws = workspaces.find(w => w.id === report.workspaceId);
    if (!ws || (ws.classTeacher !== userEmail && ws.mentor !== userEmail)) {
      toast.error("Only Class Teacher or Mentor can perform this action.");
      return;
    }

    try {
      const newData = report.data.map((d: any) => ({
        ...d,
        hasUpdated: false
      }));

      await updateDoc(doc(secondaryDb, 'unom_reports', report.id), {
        data: newData
      });
      toast.success("All updates marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleDeleteAllUnom = async () => {
    if (!window.confirm("Are you sure you want to permanently delete ALL UNOM history?")) return;
    try {
      const batch = writeBatch(secondaryDb);
      const q = query(collection(secondaryDb, 'unom_reports'), where('teacherEmail', '==', userEmail));
      const snap = await getDocs(q);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast.success('All UNOM history deleted');
      fetchUnomReports();
      setViewingUnomId(null);
    } catch (error) {
      console.error("Error deleting all UNOM:", error);
      toast.error("Failed to delete all");
    }
  };

  const handleViewUnom = (report: any) => {
    if (viewingUnomId === report.id) {
      setViewingUnomId(null);
      setViewingUnomData([]);
    } else {
      setViewingUnomId(report.id);
      setViewingUnomData(report.data || []);
      setViewingUnomPage(1);
    }
  };

  const sidebarItems = [
    { icon: <LayoutDashboard className="h-5 w-5" />, label: 'Overview', onClick: () => setActiveSection('overview'), active: activeSection === 'overview' },
    { icon: <FileText className="h-5 w-5" />, label: 'Manage Test And Assignment', onClick: () => setActiveSection('exams'), active: activeSection === 'exams' },
    { icon: <Send className="h-5 w-5" />, label: 'Send Announcement', onClick: () => setActiveSection('announcements'), active: activeSection === 'announcements' },
    { icon: <BookOpen className="h-5 w-5" />, label: 'Syllabus', onClick: () => setActiveSection('syllabus'), active: activeSection === 'syllabus' },
    { icon: <Sparkles className="h-5 w-5" />, label: 'AI Test Generator', onClick: () => setActiveSection('ai-generator'), active: activeSection === 'ai-generator' },
    { icon: <MessageSquare className="h-5 w-5" />, label: 'Queries', onClick: () => setActiveSection('queries'), active: activeSection === 'queries' },
    { icon: <CheckSquare className="h-5 w-5" />, label: 'Assignments', onClick: () => setActiveSection('assignments'), active: activeSection === 'assignments' },
    { icon: <ClipboardList className="h-5 w-5" />, label: 'View Marks', onClick: () => setActiveSection('view-marks'), active: activeSection === 'view-marks' },
    { icon: <Calendar className="h-5 w-5" />, label: 'View Attendance', onClick: () => setActiveSection('view-attendance'), active: activeSection === 'view-attendance' },
    { icon: <UserCheck className="h-5 w-5" />, label: 'Attendance', onClick: () => setActiveSection('attendance'), active: activeSection === 'attendance' },
    { icon: <CheckCircle className="h-5 w-5" />, label: 'Assign Exam Marks', onClick: () => setActiveSection('assign-marks'), active: activeSection === 'assign-marks' },
    { icon: <FileText className="h-5 w-5" />, label: 'UNOM', onClick: () => setActiveSection('unom'), active: activeSection === 'unom' },
  ];

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace('/');
  };

  if (!isAuthorized) return null;

  return (
    <DashboardLayout
      sidebarItems={sidebarItems}
      title="Teacher Dashboard"
      headerContent={
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant={portalStatus === 'open' ? "default" : "destructive"}
            size="sm"
            onClick={handleTogglePortal}
            className={`mr-4 ${portalStatus === 'open' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white border-0`}
          >
            {portalStatus === 'open' ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Portal: {portalStatus === 'open' ? 'Open' : 'Closed'}</span>
          </Button>
          <div className="relative hidden md:block w-64 mr-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search sections..."
              className="pl-8 bg-slate-900 border-slate-700 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && searchQuery && (
              <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 overflow-hidden">
                {sidebarItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                  sidebarItems
                    .filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur
                          item.onClick();
                          setSearchQuery('');
                          setShowSuggestions(false);
                          window.scrollTo(0, 0);
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))
                ) : (
                  <div className="px-4 py-2 text-sm text-slate-500">No results found</div>
                )}
              </div>
            )}
          </div>
          <span className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 whitespace-nowrap">
            <span className="hidden lg:inline">Session expires in </span>{formatTime(timeRemaining)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)} className="border-slate-700 hover:bg-slate-800">
            <Lock className="h-4 w-4 lg:mr-2" /> <span className="hidden lg:inline">Change Password</span>
          </Button>
          <Button variant="default" size="sm" onClick={handleGlobalRefresh} className="bg-green-600 hover:bg-green-700 text-white border-0">
            <RefreshCw className="h-4 w-4 lg:mr-2" /> <span className="hidden lg:inline">Refresh</span>
          </Button>
        </div>
      }
    >
      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter your current password and a new password to update your credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                className="bg-slate-800 border-slate-700"
                value={passwordForm.current}
                onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                className="bg-slate-800 border-slate-700"
                value={passwordForm.new}
                onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Re-enter New Password</Label>
              <Input
                type="password"
                className="bg-slate-800 border-slate-700"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleChangePasswordSubmit}>Update Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-900 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-blue-900/20 transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm font-medium">Total Students</p>
                  <h3 className="text-4xl font-bold mt-2">{stats.students}</h3>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-full">
                  <Users className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-900 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-purple-900/20 transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm font-medium">Active Exams</p>
                  <h3 className="text-4xl font-bold mt-2">{stats.exams}</h3>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-full">
                  <FileText className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-900/80 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-yellow-900/20 transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-yellow-200 text-sm font-medium">Pending Reviews</p>
                  <h3 className="text-4xl font-bold mt-2">{stats.pendingReviews}</h3>
                </div>
                <div className="p-3 bg-yellow-500/20 rounded-full">
                  <AlertCircle className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-900 to-slate-900 border-slate-700 text-white shadow-lg hover:shadow-green-900/20 transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-green-200 text-sm font-medium">Syllabus Uploaded</p>
                  <h3 className="text-4xl font-bold mt-2">{stats.syllabi}</h3>
                </div>
                <div className="p-3 bg-green-500/20 rounded-full">
                  <BookOpen className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Recent Activity */}
            <div className="lg:col-span-2 space-y-6">

              {/* Recent Assignment Submissions */}
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-400" /> Recent Submissions
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={() => setActiveSection('assignments')}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {assignments.length > 0 ? (
                    <div className="space-y-4">
                      {assignments
                        .sort((a, b) => {
                          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                          return dateB - dateA;
                        })
                        .slice(0, 3)
                        .map((assignment, i) => (
                          <div key={i} className="flex items-center justify-between border-b border-slate-700 pb-3 last:border-0 last:pb-0">
                            <div>
                              <p className="font-medium text-slate-200">{assignment.title}</p>
                              <p className="text-xs text-slate-400">Due: {assignment.dueDate ? (assignment.dueDate.toDate ? assignment.dueDate.toDate().toLocaleDateString() : new Date(assignment.dueDate).toLocaleDateString()) : 'No Date'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                                {assignment.type === 'exam' ? 'Exam' : 'Assignment'}
                              </span>
                              <Button size="sm" variant="outline" className="h-7 border-slate-600 hover:bg-slate-700" onClick={() => setActiveSection('assignments')}>
                                Review
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">No recent assignments found.</div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Exams */}
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-400" /> Upcoming Exams
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={() => setActiveSection('exams')}>
                    Manage <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {exams.length > 0 ? (
                    <div className="space-y-4">
                      {exams
                        .sort((a, b) => {
                          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                          return dateB - dateA;
                        })
                        .slice(0, 3)
                        .map((exam, i) => (
                          <div key={i} className="flex items-center justify-between border-b border-slate-700 pb-3 last:border-0 last:pb-0">
                            <div>
                              <p className="font-medium text-slate-200">{exam.title}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <Calendar className="h-3 w-3" /> {(() => {
                                  const d = exam.startTime || exam.createdAt || exam.date;
                                  return d ? (d.toDate ? d.toDate().toLocaleDateString() : new Date(d).toLocaleDateString()) : 'N/A';
                                })()}
                                <span className="w-1 h-1 rounded-full bg-slate-600" />
                                <Clock className="h-3 w-3" /> {(() => {
                                  const d = exam.startTime || exam.createdAt || exam.date;
                                  return d ? (d.toDate ? d.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'N/A';
                                })()}
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${(() => {
                              const d = exam.startTime || exam.createdAt || exam.date;
                              const dateObj = d ? (d.toDate ? d.toDate() : new Date(d)) : new Date();
                              return dateObj > new Date() ? 'Scheduled' : 'Active';
                            })() ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                              }`}>
                              {(() => {
                                const d = exam.startTime || exam.createdAt || exam.date;
                                const dateObj = d ? (d.toDate ? d.toDate() : new Date(d)) : new Date();
                                return dateObj > new Date() ? 'Scheduled' : 'Active';
                              })()}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">No upcoming exams.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Quick Actions & Announcements */}
            <div className="space-y-6">

              {/* Quick Actions */}
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-blue-400">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-600 hover:bg-slate-700 text-slate-200"
                    onClick={() => setActiveSection('exams')}
                  >
                    <PlusCircle className="mr-2 h-4 w-4 text-purple-400" /> Create New Test
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-600 hover:bg-slate-700 text-slate-200"
                    onClick={() => setActiveSection('announcements')}
                  >
                    <MessageSquare className="mr-2 h-4 w-4 text-orange-400" /> Post Announcement
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-600 hover:bg-slate-700 text-slate-200"
                    onClick={() => setActiveSection('assignments')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4 text-green-400" /> Grade Assignments
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Announcements */}
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-pink-400" /> Your Announcements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {announcements.length > 0 ? (
                    <div className="space-y-4">
                      {announcements
                        .sort((a, b) => {
                          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                          return dateB - dateA;
                        })
                        .slice(0, 3)
                        .map((ann, i) => (
                          <div key={i} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <p className="font-medium text-sm text-slate-200 line-clamp-1">{ann.title}</p>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ann.content}</p>
                            <p className="text-[10px] text-slate-500 mt-2 text-right">{ann.createdAt ? (ann.createdAt.toDate ? ann.createdAt.toDate().toLocaleDateString() : new Date(ann.createdAt).toLocaleDateString()) : 'Just now'}</p>
                          </div>
                        ))}
                      <Button variant="link" className="w-full text-slate-400 hover:text-white text-xs h-auto p-0" onClick={() => setActiveSection('announcements')}>
                        View All Announcements
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">No announcements posted yet.</div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      )}

      {/* MANAGE EXAMS */}
      {activeSection === 'exams' && (
        <div className="space-y-6">
          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader>
              <CardTitle>{editingExam ? 'Edit Exam' : 'Create New Test'}</CardTitle>
              <CardDescription className="text-slate-400">Set up a new examination and assign it to a workspace and students.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Exam Title</Label>
                <Input className="bg-slate-900 border-slate-700" placeholder="e.g., Weekly Test 1" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={examType} onValueChange={setExamType}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea className="bg-slate-900 border-slate-700" placeholder="Enter exam details...(must attend 5 marks)" value={examDesc} onChange={e => setExamDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Google Drive / Form Link (Paste as Link Optional)</Label>
                <div className="flex gap-2">
                  <Input className="bg-slate-900 border-slate-700" placeholder="https://..." value={examLink} onChange={e => setExamLink(e.target.value)} />
                  <div className="relative">
                    <input type="file" id="exam-file" className="hidden" onChange={(e) => handleFileUpload(e, setExamLink)} />
                    <Button variant="secondary" className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white border-0" onClick={() => document.getElementById('exam-file')?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> Upload File
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Select Workspace</Label>
                <Select value={selectedWorkspace} onValueChange={(v) => { setSelectedWorkspace(v); loadWorkspaceStudents(v); }}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="-- Select workspace --" /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedWorkspace && (
                <div className="space-y-2">
                  <Label>Students in Workspace</Label>
                  <div className="bg-slate-900 border border-slate-700 rounded-md p-2 max-h-40 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2 px-2">
                      <span className="text-sm font-medium text-slate-400">Email</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => {
                          if (selectedStudents.length === workspaceStudents.length) {
                            setSelectedStudents([]);
                          } else {
                            setSelectedStudents(workspaceStudents);
                          }
                        }}
                      >
                        {selectedStudents.length === workspaceStudents.length ? 'Unselect All' : 'Select All'}
                      </Button>
                    </div>
                    {workspaceStudents.map(email => (
                      <div key={email} className="flex items-center justify-between py-1 px-2 hover:bg-slate-800 rounded">
                        <span className="text-sm text-slate-300">
                          {studentMap.get(email) ? `${studentMap.get(email)} (${email})` : email}
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(email)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStudents([...selectedStudents, email]);
                            else setSelectedStudents(selectedStudents.filter(s => s !== email));
                          }}
                          className="rounded border-slate-600 bg-slate-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {!driveAccessToken && (
                  <Button variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={handleGoogleAuth}>Sign In with Google</Button>
                )}
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={async () => {
                  await handleCreateExam();
                }}>
                  {editingExam ? 'Update Exam' : '+ Create Exam'}
                </Button>
                {editingExam && <Button variant="ghost" onClick={() => { setEditingExam(null); setExamTitle(''); setExamDesc(''); setExamLink(''); }}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-400" /> Active Tests
              </h3>
              {exams.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteAllExams}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete All
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search tests..."
                  className="pl-8 bg-slate-900 border-slate-700"
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                />
              </div>
              <Select value={examFilterWorkspace} onValueChange={setExamFilterWorkspace}>
                <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-slate-300">
                  <SelectValue placeholder="All Workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {exams.filter(e =>
              e.title.toLowerCase().includes(examSearch.toLowerCase()) &&
              (examFilterWorkspace === 'all' || e.workspaceId === examFilterWorkspace)
            ).length === 0 ? (
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardContent className="p-8 text-center text-slate-500">
                  {exams.length === 0 ? "No tests created yet. Create one above." : "No tests match your search."}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exams
                    .filter(e =>
                      e.title.toLowerCase().includes(examSearch.toLowerCase()) &&
                      (examFilterWorkspace === 'all' || e.workspaceId === examFilterWorkspace)
                    )
                    .slice((examPage - 1) * 20, examPage * 20)
                    .map(exam => (
                      <Card key={exam.id} className="bg-slate-800 border-slate-700 text-white hover:border-blue-500/50 transition-all group overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div className="p-2 bg-blue-500/10 rounded-lg mb-3">
                              <FileText className="h-6 w-6 text-blue-400" />
                            </div>
                            <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
                              {(() => {
                                const d = exam.createdAt || exam.startTime || exam.date || exam.timestamp;
                                return d ? (d.toDate ? d.toDate().toLocaleDateString() : new Date(d).toLocaleDateString()) : 'N/A';
                              })()}
                            </span>
                          </div>
                          <CardTitle className="text-lg group-hover:text-blue-400 transition-colors">{exam.title}</CardTitle>
                          <CardDescription className="text-slate-400 line-clamp-2">{exam.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                            {exam.driveLink && (
                              <Button size="sm" variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => window.open(exam.driveLink, '_blank')}>
                                View
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => {
                              setEditingExam(exam);
                              setExamTitle(exam.title);
                              setExamDesc(exam.description);
                              setExamLink(exam.driveLink);
                              setExamType(exam.type || 'exam');
                              setSelectedWorkspace(exam.workspaceId);
                              loadWorkspaceStudents(exam.workspaceId);
                              setSelectedStudents(exam.students || []);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}>Edit</Button>
                            <Button size="sm" variant="destructive" className="px-3" onClick={() => handleDeleteExam(exam.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
                {exams.filter(e =>
                  e.title.toLowerCase().includes(examSearch.toLowerCase()) &&
                  (examFilterWorkspace === 'all' || e.workspaceId === examFilterWorkspace)
                ).length > 20 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button variant="outline" size="sm" onClick={() => setExamPage(p => Math.max(1, p - 1))} disabled={examPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-sm text-slate-400">Page {examPage} of {Math.ceil(exams.filter(e =>
                        e.title.toLowerCase().includes(examSearch.toLowerCase()) &&
                        (examFilterWorkspace === 'all' || e.workspaceId === examFilterWorkspace)
                      ).length / 20)}</span>
                      <Button variant="outline" size="sm" onClick={() => setExamPage(p => Math.min(Math.ceil(exams.filter(e =>
                        e.title.toLowerCase().includes(examSearch.toLowerCase()) &&
                        (examFilterWorkspace === 'all' || e.workspaceId === examFilterWorkspace)
                      ).length / 20), p + 1))} disabled={examPage === Math.ceil(exams.filter(e =>
                        e.title.toLowerCase().includes(examSearch.toLowerCase()) &&
                        (examFilterWorkspace === 'all' || e.workspaceId === examFilterWorkspace)
                      ).length / 20)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {activeSection === 'announcements' && (
        <div className="space-y-6">
          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader>
              <CardTitle>{editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}</CardTitle>
              <CardDescription className="text-slate-400">Share important updates with students in a selected workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Announcement Title</Label>
                <Input className="bg-slate-900 border-slate-700" placeholder="e.g., Project Submission Reminder" value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea className="bg-slate-900 border-slate-700" placeholder="Enter details..." value={announceDesc} onChange={e => setAnnounceDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Google Drive / Form Link(Paste as Link Optional)</Label>
                <div className="flex gap-2">
                  <Input className="bg-slate-900 border-slate-700" placeholder="https://..." value={announceLink} onChange={e => setAnnounceLink(e.target.value)} />
                  <div className="relative">
                    <input type="file" id="announce-file" className="hidden" onChange={(e) => handleFileUpload(e, setAnnounceLink)} />
                    <Button variant="secondary" className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white border-0" onClick={() => document.getElementById('announce-file')?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> Upload File
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Select Workspace</Label>
                <Select value={selectedWorkspace} onValueChange={(v) => { setSelectedWorkspace(v); loadWorkspaceStudents(v); }}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="-- Select workspace --" /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedWorkspace && (
                <div className="space-y-2">
                  <Label>Students in Workspace</Label>
                  <div className="bg-slate-900 border border-slate-700 rounded-md p-2 max-h-40 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2 px-2">
                      <span className="text-sm font-medium text-slate-400">Email</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => {
                          if (selectedStudents.length === workspaceStudents.length) {
                            setSelectedStudents([]);
                          } else {
                            setSelectedStudents(workspaceStudents);
                          }
                        }}
                      >
                        {selectedStudents.length === workspaceStudents.length ? 'Unselect All' : 'Select All'}
                      </Button>
                    </div>
                    {workspaceStudents.map(email => (
                      <div key={email} className="flex items-center justify-between py-1 px-2 hover:bg-slate-800 rounded">
                        <span className="text-sm text-slate-300">
                          {studentMap.get(email) ? `${studentMap.get(email)} (${email})` : email}
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(email)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStudents([...selectedStudents, email]);
                            else setSelectedStudents(selectedStudents.filter(s => s !== email));
                          }}
                          className="rounded border-slate-600 bg-slate-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {!driveAccessToken && (
                  <Button variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white border-0 flex-1 md:flex-none" onClick={handleGoogleAuth}>
                    <span className="hidden md:inline">Sign In with Google</span>
                    <span className="md:hidden">Sign In</span>
                  </Button>
                )}
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 md:flex-none" onClick={async () => {
                  await handleSendAnnouncement();
                  // Push Notification to RTDB
                  if (selectedWorkspace && announceTitle) {
                    const notifRef = ref(database, '/notifications');
                    push(notifRef, {
                      type: 'announcement',
                      title: announceTitle,
                      workspaceId: selectedWorkspace,
                      timestamp: rtdbServerTimestamp(),
                      message: `Announcement: ${announceTitle}`
                    });
                  }
                }}>
                  {editingAnnouncement ? (
                    <>
                      <span className="hidden md:inline">Update Announcement</span>
                      <span className="md:hidden">Update</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden md:inline">+ Create Announcement</span>
                      <span className="md:hidden">+ Create</span>
                    </>
                  )}
                </Button>
                {editingAnnouncement && <Button variant="ghost" onClick={() => { setEditingAnnouncement(null); setAnnounceTitle(''); setAnnounceDesc(''); setAnnounceLink(''); }}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Announcements</CardTitle>
              {announcements.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteAllAnnouncements}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search announcements..."
                    className="pl-8 bg-slate-900 border-slate-700"
                    value={announceSearch}
                    onChange={(e) => setAnnounceSearch(e.target.value)}
                  />
                </div>
                <Select value={announceFilterWorkspace} onValueChange={setAnnounceFilterWorkspace}>
                  <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-slate-300">
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {announcements.filter(a =>
                a.title.toLowerCase().includes(announceSearch.toLowerCase()) &&
                (announceFilterWorkspace === 'all' || a.workspaceId === announceFilterWorkspace)
              ).length === 0 ? <p className="text-slate-500">No announcements found.</p> : (
                <div className="space-y-3">
                  {announcements
                    .filter(a =>
                      a.title.toLowerCase().includes(announceSearch.toLowerCase()) &&
                      (announceFilterWorkspace === 'all' || a.workspaceId === announceFilterWorkspace)
                    )
                    .slice((announcePage - 1) * 20, announcePage * 20)
                    .map(a => (
                      <div key={a.id} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-800 rounded"><Send className="h-5 w-5 text-blue-400" /></div>
                          <div>
                            <h4 className="font-medium text-white">{a.title}</h4>
                            <p className="text-sm text-slate-400">{a.description}</p>
                            <p className="text-xs text-slate-500 mt-1">Sent: {a.createdAt?.toDate().toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {a.link && <Button size="sm" variant="outline" className="bg-blue-600 border-0 text-white hover:bg-blue-700" onClick={() => window.open(a.link, '_blank')}>Open</Button>}
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingAnnouncement(a);
                            setAnnounceTitle(a.title);
                            setAnnounceDesc(a.description);
                            setAnnounceLink(a.link);
                            setSelectedWorkspace(a.workspaceId);
                            loadWorkspaceStudents(a.workspaceId);
                            setSelectedStudents(a.students || []);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteAnnouncement(a.id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {announcements.filter(a =>
                a.title.toLowerCase().includes(announceSearch.toLowerCase()) &&
                (announceFilterWorkspace === 'all' || a.workspaceId === announceFilterWorkspace)
              ).length > 20 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button variant="outline" size="sm" onClick={() => setAnnouncePage(p => Math.max(1, p - 1))} disabled={announcePage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm text-slate-400">Page {announcePage} of {Math.ceil(announcements.filter(a =>
                      a.title.toLowerCase().includes(announceSearch.toLowerCase()) &&
                      (announceFilterWorkspace === 'all' || a.workspaceId === announceFilterWorkspace)
                    ).length / 20)}</span>
                    <Button variant="outline" size="sm" onClick={() => setAnnouncePage(p => Math.min(Math.ceil(announcements.filter(a =>
                      a.title.toLowerCase().includes(announceSearch.toLowerCase()) &&
                      (announceFilterWorkspace === 'all' || a.workspaceId === announceFilterWorkspace)
                    ).length / 20), p + 1))} disabled={announcePage === Math.ceil(announcements.filter(a =>
                      a.title.toLowerCase().includes(announceSearch.toLowerCase()) &&
                      (announceFilterWorkspace === 'all' || a.workspaceId === announceFilterWorkspace)
                    ).length / 20)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SYLLABUS */}
      {
        activeSection === 'syllabus' && (
          <div className="space-y-6">
            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardHeader>
                <CardTitle>{editingSyllabus ? 'Edit Syllabus' : 'Upload Syllabus'}</CardTitle>
                <CardDescription className="text-slate-400">Add or update course syllabus with Google Drive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Syllabus Name</Label>
                  <Input className="bg-slate-900 border-slate-700" placeholder="e.g., RDBMS" value={syllabusName} onChange={e => setSyllabusName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Units (comma separated)</Label>
                  <Input className="bg-slate-900 border-slate-700" placeholder="e.g., Unit 1 - 3" value={syllabusUnits} onChange={e => setSyllabusUnits(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Google Drive Link (Paste as Link Optional)</Label>
                  <div className="flex gap-2">
                    <Input className="bg-slate-900 border-slate-700" placeholder="https://..." value={syllabusLink} onChange={e => setSyllabusLink(e.target.value)} />
                    <div className="relative">
                      <input type="file" id="syllabus-file" className="hidden" onChange={(e) => handleFileUpload(e, setSyllabusLink)} />
                      <Button variant="secondary" className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white border-0" onClick={() => document.getElementById('syllabus-file')?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> Upload File
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Workspace</Label>
                  <Select value={selectedWorkspace} onValueChange={(v) => { setSelectedWorkspace(v); loadWorkspaceStudents(v); }}>
                    <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="-- Select workspace --" /></SelectTrigger>
                    <SelectContent>
                      {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selectedWorkspace && (
                  <div className="space-y-2">
                    <Label>Students in Workspace</Label>
                    <div className="bg-slate-900 border border-slate-700 rounded-md p-2 max-h-40 overflow-y-auto">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <span className="text-sm font-medium text-slate-400">Email</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => {
                            if (selectedStudents.length === workspaceStudents.length) {
                              setSelectedStudents([]);
                            } else {
                              setSelectedStudents(workspaceStudents);
                            }
                          }}
                        >
                          {selectedStudents.length === workspaceStudents.length ? 'Unselect All' : 'Select All'}
                        </Button>
                      </div>
                      {workspaceStudents.map(email => (
                        <div key={email} className="flex items-center justify-between py-1 px-2 hover:bg-slate-800 rounded">
                          <span className="text-sm text-slate-300">
                            {studentMap.get(email) ? `${studentMap.get(email)} (${email})` : email}
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(email)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedStudents([...selectedStudents, email]);
                              else setSelectedStudents(selectedStudents.filter(s => s !== email));
                            }}
                            className="rounded border-slate-600 bg-slate-800"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {!driveAccessToken && (
                    <Button variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={handleGoogleAuth}>Sign In with Google</Button>
                  )}
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={async () => {
                    await handleCreateSyllabus();
                    // Push Notification to RTDB
                    if (selectedWorkspace && syllabusName) {
                      const notifRef = ref(database, '/notifications');
                      push(notifRef, {
                        type: 'syllabus',
                        title: syllabusName,
                        workspaceId: selectedWorkspace,
                        timestamp: rtdbServerTimestamp(),
                        message: `New Syllabus: ${syllabusName}`
                      });
                    }
                  }}>
                    {editingSyllabus ? 'Update Syllabus' : 'Upload Syllabus'}
                  </Button>
                  {editingSyllabus && <Button variant="ghost" onClick={() => { setEditingSyllabus(null); setSyllabusName(''); setSyllabusUnits(''); setSyllabusLink(''); }}>Cancel</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-green-400" /> Uploaded Syllabi
                </h3>
                {syllabi.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteAllSyllabi}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete All
                  </Button>
                )}
              </div>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search syllabus..."
                    className="pl-8 bg-slate-900 border-slate-700"
                    value={syllabusSearch}
                    onChange={(e) => setSyllabusSearch(e.target.value)}
                  />
                </div>
                <Select value={syllabusFilterWorkspace} onValueChange={setSyllabusFilterWorkspace}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-900 border-slate-700 text-slate-300">
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {syllabi.filter(s =>
                s.name.toLowerCase().includes(syllabusSearch.toLowerCase()) &&
                (syllabusFilterWorkspace === 'all' || s.workspaceId === syllabusFilterWorkspace)
              ).length === 0 ? (
                <Card className="bg-slate-800 border-slate-700 text-white">
                  <CardContent className="p-8 text-center text-slate-500">
                    {syllabi.length === 0 ? "No syllabi uploaded yet. Upload one above." : "No syllabi match your search."}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {syllabi
                      .filter(s =>
                        s.name.toLowerCase().includes(syllabusSearch.toLowerCase()) &&
                        (syllabusFilterWorkspace === 'all' || s.workspaceId === syllabusFilterWorkspace)
                      )
                      .slice((syllabusPage - 1) * 20, syllabusPage * 20)
                      .map(s => (
                        <Card key={s.id} className="bg-slate-800 border-slate-700 text-white hover:border-green-500/50 transition-all group overflow-hidden relative">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-emerald-500"></div>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div className="p-2 bg-green-500/10 rounded-lg mb-3">
                                <BookOpen className="h-6 w-6 text-green-400" />
                              </div>
                              <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
                                {s.createdAt?.toDate().toLocaleDateString()}
                              </span>
                            </div>
                            <CardTitle className="text-lg group-hover:text-green-400 transition-colors">{s.name}</CardTitle>
                            <CardDescription className="text-slate-400 line-clamp-2">{Array.isArray(s.units) ? s.units.join(', ') : s.units}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                              {s.driveLink && (
                                <Button size="sm" variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => window.open(s.driveLink, '_blank')}>
                                  View
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => {
                                setEditingSyllabus(s);
                                setSyllabusName(s.name);
                                setSyllabusUnits(Array.isArray(s.units) ? s.units.join(', ') : s.units);
                                setSyllabusLink(s.driveLink);
                                setSelectedWorkspace(s.workspaceId);
                                loadWorkspaceStudents(s.workspaceId);
                                setSelectedStudents(s.students || []);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}>Edit</Button>
                              <Button size="sm" variant="destructive" className="px-3" onClick={() => handleDeleteSyllabus(s.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                  {syllabi.filter(s =>
                    s.name.toLowerCase().includes(syllabusSearch.toLowerCase()) &&
                    (syllabusFilterWorkspace === 'all' || s.workspaceId === syllabusFilterWorkspace)
                  ).length > 20 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button variant="outline" size="sm" onClick={() => setSyllabusPage(p => Math.max(1, p - 1))} disabled={syllabusPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-sm text-slate-400">Page {syllabusPage} of {Math.ceil(syllabi.filter(s =>
                          s.name.toLowerCase().includes(syllabusSearch.toLowerCase()) &&
                          (syllabusFilterWorkspace === 'all' || s.workspaceId === syllabusFilterWorkspace)
                        ).length / 20)}</span>
                        <Button variant="outline" size="sm" onClick={() => setSyllabusPage(p => Math.min(Math.ceil(syllabi.filter(s =>
                          s.name.toLowerCase().includes(syllabusSearch.toLowerCase()) &&
                          (syllabusFilterWorkspace === 'all' || s.workspaceId === syllabusFilterWorkspace)
                        ).length / 20), p + 1))} disabled={syllabusPage === Math.ceil(syllabi.filter(s =>
                          s.name.toLowerCase().includes(syllabusSearch.toLowerCase()) &&
                          (syllabusFilterWorkspace === 'all' || s.workspaceId === syllabusFilterWorkspace)
                        ).length / 20)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        )
      }

      {/* AI GENERATOR */}
      {activeSection === 'ai-generator' && <AITestGenerator />}

      {/* QUERIES */}
      {
        activeSection === 'queries' && (
          <div className="space-y-6">
            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardHeader><CardTitle>Write your query</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="bg-slate-900 border-slate-700 min-h-[100px]"
                  placeholder="Describe your doubt or issue in detail..."
                  value={newQuery}
                  onChange={e => setNewQuery(e.target.value)}
                />
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSendQuery}>
                  <Send className="h-4 w-4 mr-2" /> Send Query
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Your Queries</CardTitle>
                <Button size="sm" variant="ghost" onClick={handleRefreshQueries}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search queries..."
                      className="pl-8 bg-slate-900 border-slate-700"
                      value={querySearch}
                      onChange={(e) => setQuerySearch(e.target.value)}
                    />
                  </div>
                </div>
                {queries.filter(q => q.userEmail === userEmail && (q.question || q.query || '').toLowerCase().includes(querySearch.toLowerCase())).length === 0 ? <p className="text-slate-500">No queries found.</p> : (
                  <div className="space-y-4">
                    {queries
                      .filter(q => q.userEmail === userEmail && (q.question || q.query || '').toLowerCase().includes(querySearch.toLowerCase()))
                      .slice((queryPage - 1) * 20, queryPage * 20)
                      .map(q => (
                        <div key={q.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-slate-500">{q.createdAt?.toDate().toLocaleString()}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${q.status === 'solved' || q.status === 'answered' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              {q.status}
                            </span>
                          </div>
                          <h4 className="font-medium text-white mb-3">Your Query:</h4>
                          <p className="text-slate-300 mb-4">{q.question || q.query}</p>

                          {(q.answer || q.adminReply) && (
                            <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                              <h5 className="text-sm font-semibold text-blue-400 mb-1">Admin Reply:</h5>
                              <p className="text-sm text-slate-300">{q.answer || q.adminReply}</p>
                            </div>
                          )}

                          {(q.status === 'solved' || q.status === 'answered') && (
                            <div className="mt-2 flex items-center text-green-500 text-sm">
                              <CheckSquare className="h-4 w-4 mr-2" /> Issue resolved
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
                {queries.filter(q => q.userEmail === userEmail && (q.question || q.query || '').toLowerCase().includes(querySearch.toLowerCase())).length > 20 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button variant="outline" size="sm" onClick={() => setQueryPage(p => Math.max(1, p - 1))} disabled={queryPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm text-slate-400">Page {queryPage} of {Math.ceil(queries.filter(q => q.userEmail === userEmail && (q.question || q.query || '').toLowerCase().includes(querySearch.toLowerCase())).length / 20)}</span>
                    <Button variant="outline" size="sm" onClick={() => setQueryPage(p => Math.min(Math.ceil(queries.filter(q => q.userEmail === userEmail && (q.question || q.query || '').toLowerCase().includes(querySearch.toLowerCase())).length / 20), p + 1))} disabled={queryPage === Math.ceil(queries.filter(q => q.userEmail === userEmail && (q.question || q.query || '').toLowerCase().includes(querySearch.toLowerCase())).length / 20)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* ASSIGNMENTS */}
      {
        activeSection === 'assignments' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-white">Assignment Reviews</h2>
                <p className="text-slate-400">Review and grade student assignments. Control whether the submission portal is open for students.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-700 mb-1 self-start md:self-auto">
                <span className={`text-xs uppercase tracking-wider px-3 font-semibold ${portalStatus === 'closed' ? 'text-orange-500' : 'text-slate-500'}`}>Portal: {portalStatus}</span>
                <Button
                  className={`h-8 px-3 text-xs font-medium ${portalStatus === 'open' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} transition-all border-0`}
                  onClick={() => portalStatus === 'closed' && togglePortal()}
                >
                  Open
                </Button>
                <Button
                  className={`h-8 px-3 text-xs font-medium ${portalStatus === 'closed' ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} transition-all border-0`}
                  onClick={() => portalStatus === 'open' && togglePortal()}
                >
                  Close
                </Button>
              </div>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-1">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                    <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                        <Label className="whitespace-nowrap text-slate-400 text-xs">From:</Label>
                        <DatePicker date={filterFrom} setDate={setFilterFrom} className="w-full md:w-36 h-8" />
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                        <Label className="whitespace-nowrap text-slate-400 text-xs">To:</Label>
                        <DatePicker date={filterTo} setDate={setFilterTo} className="w-full md:w-36 h-8" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="flex items-center gap-2 flex-1 md:flex-none">
                        <Label className="whitespace-nowrap text-slate-400 hidden md:block">Bulk Mark:</Label>
                        <Select value={bulkMark} onValueChange={setBulkMark}>
                          <SelectTrigger className="w-full md:w-[70px] bg-slate-950 border-slate-700 text-slate-300 h-8"><SelectValue placeholder="-" /></SelectTrigger>
                          <SelectContent>
                            {[0, 2, 4, 6, 8, 10].map(m => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 flex-[2] md:flex-none">
                        <Label className="whitespace-nowrap text-slate-400 hidden md:block">Search:</Label>
                        <Input className="bg-slate-950 border-slate-700 w-full md:w-64 text-slate-300 h-8" placeholder="Title / email" value={assignmentSearch} onChange={e => setAssignmentSearch(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto md:pl-2 md:border-l border-slate-700 pb-2 md:pb-0">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap h-8 text-xs px-3" onClick={handleBulkAssign}>Assign Grade</Button>
                    <Button variant="secondary" className="bg-white text-slate-900 hover:bg-slate-200 whitespace-nowrap h-8 text-xs px-3" onClick={handleAssignAndDelete}>Assign & Delete</Button>
                    <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 whitespace-nowrap h-8 text-xs px-3" onClick={handleUndoDeleteAssignment} disabled={deletedAssignmentsBackup.length === 0}>Undo</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4 md:gap-6">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Label className="whitespace-nowrap text-slate-400 w-20 md:w-auto">Workspace:</Label>
                <Select value={assignmentFilterWorkspace} onValueChange={setAssignmentFilterWorkspace}>
                  <SelectTrigger className="w-full md:w-[150px] bg-slate-900 border-slate-700 text-slate-300 h-8"><SelectValue placeholder="All Workspaces" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Label className="whitespace-nowrap text-slate-400 w-20 md:w-auto">Type:</Label>
                <Select value={assignmentFilterType} onValueChange={(v: any) => setAssignmentFilterType(v)}>
                  <SelectTrigger className="w-full md:w-[110px] bg-slate-900 border-slate-700 text-slate-300 h-8"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-600 bg-slate-800"
                  checked={selectAllAssignments}
                  onChange={e => {
                    setSelectAllAssignments(e.target.checked);
                    if (e.target.checked) {
                      // Select all currently visible
                      const visible = assignments.filter(a => {
                        const matchesSearch = (a.assignmentTitle || '').toLowerCase().includes(assignmentSearch.toLowerCase()) ||
                          (a.studentEmail || '').toLowerCase().includes(assignmentSearch.toLowerCase());
                        let matchesDate = true;
                        if (filterFrom && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                          const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                          matchesDate = matchesDate && date >= filterFrom;
                        }
                        if (filterTo && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                          const endDate = new Date(filterTo);
                          endDate.setDate(endDate.getDate() + 1);
                          const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                          matchesDate = matchesDate && date < endDate;
                        }
                        if (assignmentFilterType !== 'all') {
                          const type = a.type || 'exam';
                          if (type !== assignmentFilterType) return false;
                        }
                        if (assignmentFilterWorkspace !== 'all') {
                          const ws = workspaces.find(w => w.id === assignmentFilterWorkspace);
                          if (!ws || !ws.students || !ws.students.includes(a.studentEmail)) return false;
                        }
                        return matchesSearch && matchesDate;
                      }).map(a => a.id);
                      setSelectedAssignments(visible);
                    } else {
                      setSelectedAssignments([]);
                    }
                  }}
                />
                <span className="text-sm text-slate-300">Select all displayed</span>
              </div>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-0">
                {assignments.filter(a => {
                  const matchesSearch = (a.assignmentTitle || '').toLowerCase().includes(assignmentSearch.toLowerCase()) ||
                    (a.studentEmail || '').toLowerCase().includes(assignmentSearch.toLowerCase());
                  let matchesDate = true;
                  if (filterFrom && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                    const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                    matchesDate = matchesDate && date >= filterFrom;
                  }
                  if (filterTo && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                    const endDate = new Date(filterTo);
                    endDate.setDate(endDate.getDate() + 1);
                    const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                    matchesDate = matchesDate && date < endDate;
                  }
                  if (assignmentFilterType !== 'all') {
                    const type = a.type || 'exam'; // Default to exam for backward compatibility
                    if (type !== assignmentFilterType) return false;
                  }
                  if (assignmentFilterWorkspace !== 'all') {
                    const ws = workspaces.find(w => w.id === assignmentFilterWorkspace);
                    if (!ws || !ws.students || !ws.students.includes(a.studentEmail)) return false;
                  }
                  return matchesSearch && matchesDate;
                }).length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No assignments found matching filters.</div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-700">
                      {assignments.filter(a => {
                        const matchesSearch = (a.assignmentTitle || '').toLowerCase().includes(assignmentSearch.toLowerCase()) ||
                          (a.studentEmail || '').toLowerCase().includes(assignmentSearch.toLowerCase());
                        if (assignmentFilterWorkspace !== 'all') {
                          const ws = workspaces.find(w => w.id === assignmentFilterWorkspace);
                          if (!ws || !ws.students || !ws.students.includes(a.studentEmail)) return false;
                        }
                        let matchesDate = true;
                        if (filterFrom && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                          const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                          matchesDate = matchesDate && date >= filterFrom;
                        }
                        if (filterTo && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                          const endDate = new Date(filterTo);
                          endDate.setDate(endDate.getDate() + 1);
                          const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                          matchesDate = matchesDate && date < endDate;
                        }
                        if (assignmentFilterType !== 'all') {
                          const type = a.type || 'exam';
                          if (type !== assignmentFilterType) return false;
                        }
                        return matchesSearch && matchesDate;
                      })
                        .slice((assignmentPage - 1) * 20, assignmentPage * 20)
                        .map(a => (
                          <div key={a.id} className="p-4 hover:bg-slate-700/50 transition-colors flex flex-col md:flex-row items-start md:items-center gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                              <input
                                type="checkbox"
                                className="rounded border-slate-600 bg-slate-800 shrink-0"
                                checked={selectedAssignments.includes(a.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedAssignments([...selectedAssignments, a.id]);
                                  else setSelectedAssignments(selectedAssignments.filter(id => id !== a.id));
                                }}
                              />
                              <div className="p-3 bg-slate-700 rounded-lg shrink-0">
                                <FileText className="h-6 w-6 text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white truncate">{a.assignmentTitle || a.title || 'Untitled'} <span className="text-slate-400 font-normal text-sm">by {studentMap.get(a.studentEmail) || a.studentName || a.studentEmail}</span></h4>
                                <div className="flex items-center gap-3 mt-1">
                                  <p className="text-xs text-slate-500">Submitted: {a.submittedAt?.toDate ? a.submittedAt.toDate().toLocaleString() : (a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : 'N/A')}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'graded' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {a.status || 'pending'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.open(a.googleDriveLink || a.driveLink || a.url, '_blank')}>View PDF</Button>

                              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded border border-slate-700">
                                <span className="text-xs text-slate-400 pl-2">Marks:</span>
                                <Select onValueChange={(v) => handleUpdateMarks(a.id, Number(v))}>
                                  <SelectTrigger className="w-[60px] h-7 bg-transparent border-0 focus:ring-0 text-white"><SelectValue placeholder={a.marks || '-'} /></SelectTrigger>
                                  <SelectContent>
                                    {[0, 2, 4, 6, 8, 10].map(m => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" variant="secondary" className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white border-0">Save</Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                    {assignments.filter(a => {
                      const matchesSearch = (a.assignmentTitle || '').toLowerCase().includes(assignmentSearch.toLowerCase()) ||
                        (a.studentEmail || '').toLowerCase().includes(assignmentSearch.toLowerCase());
                      let matchesDate = true;
                      if (filterFrom && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                        const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                        matchesDate = matchesDate && date >= new Date(filterFrom);
                      }
                      if (filterTo && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                        const endDate = new Date(filterTo);
                        endDate.setDate(endDate.getDate() + 1);
                        const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                        matchesDate = matchesDate && date < endDate;
                      }
                      if (assignmentFilterType !== 'all') {
                        const type = a.type || 'exam';
                        if (type !== assignmentFilterType) return false;
                      }
                      return matchesSearch && matchesDate;
                    }).length > 20 && (
                        <div className="flex items-center justify-center gap-2 mt-6 p-4 border-t border-slate-700">
                          <Button variant="outline" size="sm" onClick={() => setAssignmentPage(p => Math.max(1, p - 1))} disabled={assignmentPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                          <span className="text-sm text-slate-400">Page {assignmentPage}</span>
                          <Button variant="outline" size="sm" onClick={() => setAssignmentPage(p => p + 1)} disabled={assignments.filter(a => {
                            const matchesSearch = (a.assignmentTitle || '').toLowerCase().includes(assignmentSearch.toLowerCase()) ||
                              (a.studentEmail || '').toLowerCase().includes(assignmentSearch.toLowerCase());
                            let matchesDate = true;
                            if (filterFrom && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                              const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                              matchesDate = matchesDate && date >= new Date(filterFrom);
                            }
                            if (filterTo && (a.submittedAt?.toDate || a.createdAt?.toDate)) {
                              const endDate = new Date(filterTo);
                              endDate.setDate(endDate.getDate() + 1);
                              const date = a.submittedAt?.toDate() || a.createdAt?.toDate();
                              matchesDate = matchesDate && date < endDate;
                            }
                            if (assignmentFilterType !== 'all') {
                              const type = a.type || 'exam';
                              if (type !== assignmentFilterType) return false;
                            }
                            return matchesSearch && matchesDate;
                          }).length <= assignmentPage * 20} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* VIEW MARKS */}
      {
        activeSection === 'view-marks' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-white">View Marks</h2>
              <p className="text-slate-400">Browse students and review the marks you have given across assignments and exams.</p>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-400">Select Workspace:</Label>
                  <Select value={viewMarksWorkspace} onValueChange={setViewMarksWorkspace}>
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-300">
                      <SelectValue placeholder="Select Workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {viewMarksWorkspace && (
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search students..."
                          className="pl-8 bg-slate-900 border-slate-700"
                          value={marksSearch}
                          onChange={(e) => setMarksSearch(e.target.value)}
                        />
                      </div>
                      <Button variant="destructive" onClick={handleDeleteAllWorkspaceMarks} className="whitespace-nowrap">
                        Delete All
                      </Button>
                    </div>
                    {workspaces.find(w => w.id === viewMarksWorkspace)?.students
                      ?.filter((email: string) => (studentMap.get(email) || email).toLowerCase().includes(marksSearch.toLowerCase()))
                      .slice((marksPage - 1) * 20, marksPage * 20)
                      .map((email: string, idx: number) => (
                        <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 gap-4 md:gap-0">
                          <div className="flex items-center gap-4 w-full">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                                <UserCheck className="h-5 w-5" />
                              </div>
                              {(() => {
                                const presenceEntry = Object.values(studentPresence).find((p: any) => p.email === email);
                                const isOnline = presenceEntry?.connections ? Object.keys(presenceEntry.connections).length > 0 : false;
                                return (
                                  <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-slate-900 ${isOnline ? 'bg-green-500' : 'bg-slate-500'}`} title={isOnline ? 'Online' : 'Offline'} />
                                );
                              })()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white truncate">#{idx + 1} {studentMap.get(email) || email}</p>
                                {(() => {
                                  const presenceEntry = Object.values(studentPresence).find((p: any) => p.email === email);
                                  const isOnline = presenceEntry?.connections ? Object.keys(presenceEntry.connections).length > 0 : false;

                                  if (!isOnline && typeof presenceEntry?.last_changed === 'number') {
                                    return (
                                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-700">
                                        Last seen: {new Date(presenceEntry.last_changed).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{email}</p>
                            </div>
                          </div>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto" onClick={() => handleFetchStudentMarks(email)}>
                            View Marks
                          </Button>
                        </div>
                      ))}
                    {workspaces.find(w => w.id === viewMarksWorkspace)?.students?.filter((email: string) => (studentMap.get(email) || email).toLowerCase().includes(marksSearch.toLowerCase())).length > 20 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button variant="outline" size="sm" onClick={() => setMarksPage(p => Math.max(1, p - 1))} disabled={marksPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-sm text-slate-400">Page {marksPage}</span>
                        <Button variant="outline" size="sm" onClick={() => setMarksPage(p => p + 1)} disabled={marksPage * 20 >= (workspaces.find(w => w.id === viewMarksWorkspace)?.students?.filter((email: string) => (studentMap.get(email) || email).toLowerCase().includes(marksSearch.toLowerCase())).length || 0)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    )}
                    {(!workspaces.find(w => w.id === viewMarksWorkspace)?.students?.length) && (
                      <p className="text-center text-slate-500 py-4">No students in this workspace.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* VIEW ATTENDANCE */}
      {
        activeSection === 'view-attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-white">View Student Attendance</h2>
              <p className="text-slate-400">Select a workspace and date to see who was present or absent.</p>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-slate-400">Select Workspace:</Label>
                    <Select value={viewAttendanceWorkspace} onValueChange={(v) => {
                      setViewAttendanceWorkspace(v);
                      fetchOverallAttendance(v);
                      if (viewAttendanceDate) handleFetchMonthAttendance(v, viewAttendanceDate);
                    }}>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-300">
                        <SelectValue placeholder="Select Workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-slate-400">Select Month:</Label>
                    <div className="flex gap-2">
                      <Input
                        type="month"
                        className="bg-slate-950 border-slate-700 text-slate-300 [&::-webkit-calendar-picker-indicator]:[filter:invert(1)]"
                        value={viewAttendanceDate}
                        onChange={(e) => {
                          setViewAttendanceDate(e.target.value);
                          if (viewAttendanceWorkspace) handleFetchMonthAttendance(viewAttendanceWorkspace, e.target.value);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {viewAttendanceWorkspace && viewAttendanceDate && (
                  <>
                    <div className="flex items-center gap-2 mt-6 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search students..."
                          className="pl-8 bg-slate-900 border-slate-700"
                          value={attendanceSearch}
                          onChange={(e) => setAttendanceSearch(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" onClick={handleDownloadAttendanceCsv} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        <Download className="h-4 w-4 mr-2" /> CSV
                      </Button>
                    </div>
                    <div className="mt-6 border border-slate-700 rounded-lg">
                      <div className="overflow-x-auto pb-2">
                        <table className="min-w-full table-auto border-collapse text-xs whitespace-nowrap" onMouseLeave={() => { setHoveredRow(null); setHoveredCol(null); }}>
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-700">
                              <th className="p-0 font-medium text-slate-400 text-left sticky left-0 bg-slate-900 z-20 border-r border-slate-700">
                                <div className="p-2 w-[140px]">Student</div>
                              </th>
                              {Array.from({ length: new Date(parseInt(viewAttendanceDate.split('-')[0]), parseInt(viewAttendanceDate.split('-')[1]), 0).getDate() }, (_, i) => i + 1).map(day => (
                                <th key={day} className={`p-0 font-medium text-slate-400 text-center border-r border-slate-800/50 last:border-0 ${hoveredCol === day ? 'bg-blue-500/10' : ''}`}>
                                  <div className="py-2 w-7 flex items-center justify-center">{day}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {workspaces.find(w => w.id === viewAttendanceWorkspace)?.students
                              ?.filter((email: string) => (studentMap.get(email) || email).toLowerCase().includes(attendanceSearch.toLowerCase()))
                              .slice((attendancePage - 1) * 20, attendancePage * 20)
                              .map((email: string, idx: number) => {
                                const daysInMonth = new Date(parseInt(viewAttendanceDate.split('-')[0]), parseInt(viewAttendanceDate.split('-')[1]), 0).getDate();
                                const year = viewAttendanceDate.split('-')[0];
                                const month = viewAttendanceDate.split('-')[1];

                                return (
                                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                    <td className={`p-0 font-medium text-slate-300 sticky left-0 bg-slate-900 z-20 border-r border-slate-700 ${hoveredRow === idx ? 'bg-blue-500/10' : ''}`}>
                                      <div className="p-2 w-[140px] truncate" title={email}>{studentMap.get(email) || email}</div>
                                    </td>
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                      const dateStr = `${year}-${month}-${day.toString().padStart(2, '0')}`;
                                      const hasRecord = monthAttendanceData.has(dateStr);
                                      const isPresent = hasRecord && monthAttendanceData.get(dateStr)?.has(email);

                                      return (
                                        <td
                                          key={day}
                                          className={`p-0 text-center border-r border-slate-800/50 last:border-0 transition-colors ${hoveredRow === idx || hoveredCol === day ? 'bg-blue-500/10' : ''}`}
                                          onMouseEnter={() => { setHoveredRow(idx); setHoveredCol(day); }}
                                        >
                                          <div className="py-1 w-7 flex items-center justify-center">
                                            <div
                                              className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-medium 
                                            ${!hasRecord ? 'bg-slate-800/30 text-slate-600' :
                                                  isPresent ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
                                              title={`${dateStr}: ${!hasRecord ? 'No Record' : isPresent ? 'Present' : 'Absent'}`}
                                            >
                                              {hasRecord ? (isPresent ? 'P' : 'A') : '-'}
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {
                      workspaces.find(w => w.id === viewAttendanceWorkspace)?.students?.filter((email: string) => (studentMap.get(email) || email).toLowerCase().includes(attendanceSearch.toLowerCase())).length > 20 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                          <Button variant="outline" size="sm" onClick={() => setAttendancePage(p => Math.max(1, p - 1))} disabled={attendancePage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                          <span className="text-sm text-slate-400">Page {attendancePage}</span>
                          <Button variant="outline" size="sm" onClick={() => setAttendancePage(p => p + 1)} disabled={attendancePage * 20 >= (workspaces.find(w => w.id === viewAttendanceWorkspace)?.students?.filter((email: string) => (studentMap.get(email) || email).toLowerCase().includes(attendanceSearch.toLowerCase())).length || 0)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      )
                    }
                  </>
                )}
              </CardContent >
            </Card >
          </div >
        )
      }

      {/* ASSIGN MARKS */}
      {
        activeSection === 'assign-marks' && (
          <div className="space-y-6 min-h-screen">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-white">Assign Marks</h2>
              <p className="text-slate-400">Upload student marks via CSV.</p>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardHeader>
                <CardTitle>Upload Marks</CardTitle>
                <CardDescription className="text-slate-400">
                  Select a workspace to generate a template, then upload the filled CSV with columns: <code>email, marks</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Workspace (for template)</Label>
                  <Select value={assignMarksWorkspace} onValueChange={setAssignMarksWorkspace}>
                    <SelectTrigger className="bg-slate-900 border-slate-700">
                      <SelectValue placeholder="Select Workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject Name</Label>
                  <Input
                    className="bg-slate-900 border-slate-700"
                    placeholder="e.g. RDBMS"
                    value={assignMarksSubject}
                    onChange={(e) => setAssignMarksSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Section Title</Label>
                  <Input
                    className="bg-slate-900 border-slate-700"
                    placeholder="e.g. Cycle Test 1"
                    value={assignMarksSectionTitle}
                    onChange={(e) => setAssignMarksSectionTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Upload CSV</Label>
                    <Button variant="link" size="sm" onClick={handleDownloadSampleCsv} className="text-blue-400 h-auto p-0">
                      {assignMarksWorkspace ? 'Download Class Template' : 'Download Sample CSV'}
                    </Button>
                  </div>
                  <Input
                    type="file"
                    accept=".csv"
                    className="bg-slate-900 border-slate-700"
                    onChange={handleMarksCsvUpload}
                  />
                </div>

                {assignMarksData.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Preview ({assignMarksData.length} records)</h3>
                      <Button onClick={handlePublishMarks} className="bg-green-600 hover:bg-green-700 text-white">
                        Publish Marks
                      </Button>
                    </div>

                    <div className="border border-slate-700 rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="p-3">Email</th>
                            <th className="p-3">Subject</th>
                            <th className="p-3">Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                          {assignMarksData
                            .slice((assignMarksPage - 1) * 10, assignMarksPage * 10)
                            .map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-700/50">
                                <td className="p-3">{item.email}</td>
                                <td className="p-3">{assignMarksSubject || '-'}</td>
                                <td className="p-3 font-mono">{item.marks}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {assignMarksData.length > 10 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => setAssignMarksPage(p => Math.max(1, p - 1))} disabled={assignMarksPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-sm text-slate-400">Page {assignMarksPage} of {Math.ceil(assignMarksData.length / 10)}</span>
                        <Button variant="outline" size="sm" onClick={() => setAssignMarksPage(p => Math.min(Math.ceil(assignMarksData.length / 10), p + 1))} disabled={assignMarksPage === Math.ceil(assignMarksData.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Published Batches History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Published History</h3>
                {markBatches.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteAllBatches}>
                    Delete All
                  </Button>
                )}
              </div>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search history..."
                    className="pl-8 bg-slate-900 border-slate-700"
                    value={marksHistorySearch}
                    onChange={(e) => setMarksHistorySearch(e.target.value)}
                  />
                </div>
                <Select value={marksHistoryFilterWorkspace} onValueChange={setMarksHistoryFilterWorkspace}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-900 border-slate-700 text-slate-300">
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {markBatches.length === 0 ? (
                <p className="text-slate-500">No published marks yet.</p>
              ) : (
                <div className="grid gap-4">
                  {markBatches
                    .filter(batch =>
                      (batch.sectionTitle?.toLowerCase().includes(marksHistorySearch.toLowerCase()) || batch.subject?.toLowerCase().includes(marksHistorySearch.toLowerCase())) &&
                      (marksHistoryFilterWorkspace === 'all' || batch.workspaceId === marksHistoryFilterWorkspace)
                    )
                    .map(batch => (
                      <Card key={batch.id} className={`bg-slate-800 border-slate-700 ${batch.status === 'deleted' ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                            <div>
                              <h4 className="font-semibold text-white text-lg">{batch.sectionTitle}</h4>
                              <p className="text-sm text-slate-400">
                                {batch.subject} • {batch.createdAt?.toDate?.().toLocaleDateString()} • {batch.count} students
                                {batch.status === 'deleted' && <span className="ml-2 text-red-400">(Deleted)</span>}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => handleViewBatchMarks(batch.id)} className={`border-blue-500 text-blue-500 hover:bg-blue-500/10 ${viewingBatchId === batch.id ? 'bg-blue-500/20' : ''}`}>
                                <Eye className="h-4 w-4 mr-2" /> {viewingBatchId === batch.id ? 'Hide Marks' : 'View Marks'}
                              </Button>
                              {batch.status === 'active' ? (
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteBatch(batch.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => handleUndoBatch(batch.id)} className="border-green-500 text-green-500 hover:bg-green-500/10">
                                  <RefreshCw className="h-4 w-4 mr-2" /> Undo
                                </Button>
                              )}
                            </div>
                          </div>

                          {viewingBatchId === batch.id && (
                            <div className="mt-4 border-t border-slate-700 pt-4">
                              <div className="rounded-lg overflow-hidden border border-slate-700">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-900 text-slate-400">
                                    <tr>
                                      <th className="p-3">Email</th>
                                      <th className="p-3">Marks</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                                    {viewingBatchMarks
                                      .slice((viewingBatchPage - 1) * 10, viewingBatchPage * 10)
                                      .map((mark, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/50">
                                          <td className="p-3">{mark.studentEmail}</td>
                                          <td className="p-3 font-mono">{mark.marks}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>

                              {viewingBatchMarks.length > 10 && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                  <Button variant="outline" size="sm" onClick={() => setViewingBatchPage(p => Math.max(1, p - 1))} disabled={viewingBatchPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                                  <span className="text-sm text-slate-400">Page {viewingBatchPage} of {Math.ceil(viewingBatchMarks.length / 10)}</span>
                                  <Button variant="outline" size="sm" onClick={() => setViewingBatchPage(p => Math.min(Math.ceil(viewingBatchMarks.length / 10), p + 1))} disabled={viewingBatchPage === Math.ceil(viewingBatchMarks.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* UNOM Section */}
      {
        activeSection === 'unom' && (
          <div className="flex flex-col gap-6 flex-1 pb-10">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-white">UNOM Report</h2>
              <p className="text-slate-400">Generate comprehensive mark reports.</p>
            </div>

            <Card className="bg-slate-800 border-2 border-slate-700 text-white">
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subjects */}
                {/* Title */}
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    className="bg-slate-900 border-slate-700"
                    placeholder="e.g. Semester 1 Final Report"
                    value={unomTitle}
                    onChange={(e) => setUnomTitle(e.target.value)}
                  />
                </div>

                {/* Subjects */}
                <div className="space-y-4">
                  <Label>Subject Codes / Names</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unomSubjects.map((subject, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          className="bg-slate-900 border-slate-700"
                          placeholder={`Subject ${index + 1}`}
                          value={subject}
                          onChange={(e) => handleUnomSubjectChange(index, e.target.value)}
                        />
                        {index >= 4 && (
                          <Button variant="destructive" size="icon" onClick={() => handleRemoveSubject(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" onClick={handleAddSubject} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    <PlusCircle className="h-4 w-4 mr-2" /> Add More Subject
                  </Button>
                </div>



                {/* Workspace & Actions */}
                <div className="space-y-2">
                  <Label>Select Workspace</Label>
                  <Select value={unomWorkspace} onValueChange={setUnomWorkspace}>
                    <SelectTrigger className="bg-slate-900 border-slate-700">
                      <SelectValue placeholder="-- Select workspace --" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {unomWorkspace && (() => {
                  const ws = workspaces.find(w => w.id === unomWorkspace);
                  const isAuthorized = ws && (ws.classTeacher === userEmail || ws.mentor === userEmail);

                  if (!isAuthorized) {
                    return (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Access Restricted: You must be the Class Teacher or Mentor to create UNOM reports for this workspace.</span>
                      </div>
                    );
                  }

                  return null;
                })()}

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleCreateUnom}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!unomWorkspace || (() => {
                      const ws = workspaces.find(w => w.id === unomWorkspace);
                      return !(ws && (ws.classTeacher === userEmail || ws.mentor === userEmail));
                    })()}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> Generate Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview Table */}
            {unomData.length > 0 && (
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Enter Marks</CardTitle>
                  <Button onClick={handleSaveUnomReport} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="h-4 w-4 mr-2" /> Save Report
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg overflow-hidden border border-slate-700 overflow-x-auto max-w-[calc(100vw-4rem)] md:max-w-none">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="p-3 whitespace-nowrap">Email</th>
                          {unomSubjects.filter(s => s.trim() !== '').map((sub, i) => (
                            <th key={i} className="p-3 whitespace-nowrap">{sub}</th>
                          ))}
                          <th className="p-3 whitespace-nowrap">Total</th>
                          <th className="p-3 whitespace-nowrap">Percentage</th>
                          <th className="p-3 whitespace-nowrap">Rank</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                        {unomData
                          .slice((unomPage - 1) * 10, unomPage * 10)
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="p-3">{row.email}</td>
                              {unomSubjects.filter(s => s.trim() !== '').map((sub, i) => (
                                <td key={i} className="p-3 min-w-[200px]">
                                  <div className="flex gap-1 items-center justify-center">
                                    <div className="flex flex-col gap-1">
                                      <Input
                                        placeholder="Int"
                                        className="h-7 w-14 text-xs bg-slate-900 border-slate-700 text-center px-1"
                                        value={row[`${sub}_internal`] ?? ''}
                                        onChange={(e) => handleUnomMarkChange(row.email, `${sub}_internal`, e.target.value)}
                                      />
                                      <span className="text-[10px] text-slate-500 text-center">Int</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Input
                                        placeholder="Ext"
                                        className="h-7 w-14 text-xs bg-slate-900 border-slate-700 text-center px-1"
                                        value={row[`${sub}_external`] ?? ''}
                                        onChange={(e) => handleUnomMarkChange(row.email, `${sub}_external`, e.target.value)}
                                      />
                                      <span className="text-[10px] text-slate-500 text-center">Ext</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Input
                                        placeholder="Tot"
                                        className="h-7 w-14 text-xs bg-slate-900 border-slate-700 text-center font-bold px-1"
                                        value={row[sub] ?? ''}
                                        onChange={(e) => handleUnomMarkChange(row.email, sub, e.target.value)}
                                      />
                                      <span className="text-[10px] text-slate-500 text-center">Tot</span>
                                    </div>
                                  </div>
                                </td>
                              ))}
                              <td className="p-3 font-mono font-bold">{row.total}</td>
                              <td className="p-3 font-mono">{row.percentage.toFixed(2)}%</td>
                              <td className="p-3 font-mono">-</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {unomData.length > 10 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setUnomPage(p => Math.max(1, p - 1))} disabled={unomPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-sm text-slate-400">Page {unomPage} of {Math.ceil(unomData.length / 10)}</span>
                      <Button variant="outline" size="sm" onClick={() => setUnomPage(p => Math.min(Math.ceil(unomData.length / 10), p + 1))} disabled={unomPage === Math.ceil(unomData.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Published History */}
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Published History</h3>
                {unomReports.length > 0 && workspaces.some(w => w.classTeacher === userEmail || w.mentor === userEmail) && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteAllUnom}>
                    Delete All
                  </Button>
                )}
              </div>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search history..."
                    className="pl-8 bg-slate-900 border-slate-700"
                    value={unomHistorySearch}
                    onChange={(e) => setUnomHistorySearch(e.target.value)}
                  />
                </div>
                <Select value={unomHistoryFilterWorkspace} onValueChange={setUnomHistoryFilterWorkspace}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-900 border-slate-700 text-slate-300">
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {unomReports.length === 0 ? (
                <p className="text-slate-500">No published reports yet.</p>
              ) : (
                <div className="grid gap-4">
                  {unomReports
                    .filter(report =>
                      (report.title?.toLowerCase().includes(unomHistorySearch.toLowerCase())) &&
                      (unomHistoryFilterWorkspace === 'all' || report.workspaceId === unomHistoryFilterWorkspace)
                    )
                    .map(report => (
                      <Card key={report.id} className={`bg-slate-800 border-slate-700 ${report.status === 'deleted' ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                            <div>
                              <h4 className="font-semibold text-white text-lg">{report.title}</h4>
                              <p className="text-sm text-slate-400">
                                {report.createdAt?.toDate?.().toLocaleDateString()} • {report.data?.length || 0} students
                                {report.status === 'deleted' && <span className="ml-2 text-red-400">(Deleted)</span>}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 w-full md:w-auto mt-2 md:mt-0">
                              {viewingUnomId === report.id && (
                                <div className="flex gap-2 items-center flex-wrap justify-end w-full">
                                  {report.data?.some((d: any) => d.hasUpdated) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMarkAllAsMarked(report)}
                                      className="border-green-600 text-green-500 hover:bg-green-500/10 h-8"
                                      title="Clear all green dots"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" /> Mark All
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      toast.promise(fetchUnomReports(), {
                                        loading: 'Refreshing...',
                                        success: 'Refreshed',
                                        error: 'Failed to refresh'
                                      });
                                    }}
                                    className="h-8 w-8 border-slate-600 text-slate-300 hover:bg-slate-700"
                                    title="Refresh Data"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                  <div className="relative flex-1 md:flex-none md:w-40">
                                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-400" />
                                    <Input
                                      placeholder="Search..."
                                      className="pl-7 bg-slate-900 border-slate-600 h-8 text-xs w-full"
                                      value={unomSearch}
                                      onChange={(e) => setUnomSearch(e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2 items-center w-full md:w-auto">
                                <Button variant="outline" size="sm" onClick={() => handleDownloadUnomCsv(report)} className="flex-1 md:flex-none border-slate-600 text-slate-300 hover:bg-slate-700">
                                  <Download className="h-4 w-4 mr-2" /> CSV
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => {
                                  handleViewUnom(report);
                                  setUnomSearch(''); // Clear search on toggle
                                }} className={`flex-1 md:flex-none border-blue-500 text-blue-500 hover:bg-blue-500/10 ${viewingUnomId === report.id ? 'bg-blue-500/20' : ''}`}>
                                  <Eye className="h-4 w-4 mr-2" /> {viewingUnomId === report.id ? 'Hide' : 'View'}
                                </Button>
                                {report.status === 'active' ? (
                                  (() => {
                                    const ws = workspaces.find(w => w.id === report.workspaceId);
                                    const isAuthorized = ws && (ws.classTeacher === userEmail || ws.mentor === userEmail);
                                    return isAuthorized ? (
                                      <Button variant="destructive" size="sm" onClick={() => handleDeleteUnom(report.id)} className="flex-1 md:flex-none">
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                      </Button>
                                    ) : null;
                                  })()
                                ) : (
                                  (() => {
                                    const ws = workspaces.find(w => w.id === report.workspaceId);
                                    const isAuthorized = ws && (ws.classTeacher === userEmail || ws.mentor === userEmail);
                                    return isAuthorized ? (
                                      <Button variant="outline" size="sm" onClick={() => handleUndoUnom(report.id)} className="flex-1 md:flex-none border-green-500 text-green-500 hover:bg-green-500/10">
                                        <RefreshCw className="h-4 w-4 mr-2" /> Undo
                                      </Button>
                                    ) : null;
                                  })()
                                )}
                              </div>
                            </div>
                          </div>

                          {viewingUnomId === report.id && (
                            <div className="mt-4 border-t border-slate-700 pt-4">
                              <div className="rounded-lg overflow-hidden border border-slate-700 overflow-x-auto max-w-[calc(100vw-4rem)] md:max-w-none">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-900 text-slate-400">
                                    <tr>
                                      <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleUnomSort('email')}>
                                        <div className="flex items-center gap-1">
                                          Email
                                          {unomSortConfig?.key === 'email' && (unomSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                        </div>
                                      </th>
                                      {report.subjects?.map((sub: string, i: number) => (
                                        <th key={i} className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleUnomSort(sub)}>
                                          <div className="flex items-center gap-1">
                                            {sub}
                                            {unomSortConfig?.key === sub && (unomSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                          </div>
                                        </th>
                                      ))}
                                      <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleUnomSort('total')}>
                                        <div className="flex items-center gap-1">
                                          Total
                                          {unomSortConfig?.key === 'total' && (unomSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                        </div>
                                      </th>
                                      <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleUnomSort('percentage')}>
                                        <div className="flex items-center gap-1">
                                          Percentage
                                          {unomSortConfig?.key === 'percentage' && (unomSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                        </div>
                                      </th>
                                      <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleUnomSort('rank')}>
                                        <div className="flex items-center gap-1">
                                          Rank
                                          {unomSortConfig?.key === 'rank' && (unomSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                        </div>
                                      </th>
                                      <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleUnomSort('updatedAt')}>
                                        <div className="flex items-center gap-1">
                                          Updated At
                                          {unomSortConfig?.key === 'updatedAt' && (unomSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                                    {(() => {
                                      let processedData = [...viewingUnomData];

                                      // Filter
                                      if (unomSearch) {
                                        processedData = processedData.filter(row =>
                                          (row.email || '').toLowerCase().includes(unomSearch.toLowerCase()) ||
                                          (row.rank?.toString() || '').includes(unomSearch)
                                        );
                                      }

                                      // Sort
                                      if (unomSortConfig) {
                                        processedData.sort((a, b) => {
                                          const aValue = a[unomSortConfig.key];
                                          const bValue = b[unomSortConfig.key];

                                          if (aValue === bValue) return 0;

                                          // Handle numeric sorting for marks, total, percentage, rank
                                          const aNum = parseFloat(aValue);
                                          const bNum = parseFloat(bValue);
                                          if (!isNaN(aNum) && !isNaN(bNum)) {
                                            return unomSortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                                          }

                                          // Handle Date sorting for 'updatedAt'
                                          if (unomSortConfig.key === 'updatedAt') {
                                            const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : (report.updatedAt?.toDate ? report.updatedAt.toDate().getTime() : 0);
                                            const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : (report.updatedAt?.toDate ? report.updatedAt.toDate().getTime() : 0);
                                            return unomSortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
                                          }

                                          // Handle string sorting
                                          if (aValue < bValue) return unomSortConfig.direction === 'asc' ? -1 : 1;
                                          if (aValue > bValue) return unomSortConfig.direction === 'asc' ? 1 : -1;
                                          return 0;
                                        });
                                      }

                                      return processedData
                                        .slice((viewingUnomPage - 1) * 10, viewingUnomPage * 10)
                                        .map((row, idx) => (
                                          <tr key={idx} className="hover:bg-slate-700/50">
                                            <td className="p-3">
                                              <div className="flex items-center gap-2">
                                                {row.email}
                                                {row.hasUpdated && (
                                                  <div
                                                    className="h-2 w-2 rounded-full bg-green-500 cursor-pointer hover:bg-green-400 animate-pulse"
                                                    title="Marks updated by student"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleClearUpdate(report, row.email);
                                                    }}
                                                  />
                                                )}
                                              </div>
                                            </td>
                                            {report.subjects?.map((sub: string, i: number) => (
                                              <td key={i} className="p-3 font-mono">{row[sub] !== null ? row[sub] : '-'}</td>
                                            ))}
                                            <td className="p-3 font-mono font-bold">{row.total}</td>
                                            <td className="p-3">{row.percentage ? `${parseFloat(row.percentage).toFixed(2)}%` : '-'}</td>
                                            <td className="p-3">#{row.rank || '-'}</td>
                                            <td className="p-3 text-slate-400 text-xs">
                                              {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : (report.updatedAt?.toDate ? report.updatedAt.toDate().toLocaleString() : (report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '-'))}
                                            </td>
                                          </tr>
                                        ));
                                    })()}
                                  </tbody>
                                </table>
                              </div>

                              {viewingUnomData.length > 10 && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                  <Button variant="outline" size="sm" onClick={() => setViewingUnomPage(p => Math.max(1, p - 1))} disabled={viewingUnomPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                                  <span className="text-sm text-slate-400">Page {viewingUnomPage} of {Math.ceil(viewingUnomData.length / 10)}</span>
                                  <Button variant="outline" size="sm" onClick={() => setViewingUnomPage(p => Math.min(Math.ceil(viewingUnomData.length / 10), p + 1))} disabled={viewingUnomPage === Math.ceil(viewingUnomData.length / 10)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* ATTENDANCE REGISTER */}
      {
        activeSection === 'attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-white">Attendance Register</h2>
              <p className="text-slate-400">Mark student attendance for a specific date.</p>
            </div>

            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-slate-400">Select Workspace:</Label>
                    <div className="flex gap-2">
                      <Select value={attendanceWorkspace} onValueChange={(v) => {
                        setAttendanceWorkspace(v);
                        if (attendanceDate) handleFetchAttendance(v, attendanceDate, false);
                      }}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-300">
                          <SelectValue placeholder="Select Workspace" />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {attendanceWorkspace && (() => {
                        const ws = workspaces.find(w => w.id === attendanceWorkspace);
                        const isAuthorized = ws && (ws.classTeacher === userEmail || ws.mentor === userEmail);
                        return isAuthorized ? (
                          <>
                            <Button variant="destructive" onClick={handleDeleteAllAttendance} title="Delete All Attendance for this Workspace">
                              Delete All
                            </Button>
                            {deletedBackup && (
                              <Button variant="outline" onClick={handleUndoDelete} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                                Undo
                              </Button>
                            )}
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-slate-400">Select Date:</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        className="bg-slate-950 border-slate-700 text-slate-300 [&::-webkit-calendar-picker-indicator]:[filter:invert(1)]"
                        value={attendanceDate}
                        onChange={(e) => {
                          setAttendanceDate(e.target.value);
                          if (attendanceWorkspace) handleFetchAttendance(attendanceWorkspace, e.target.value, false);
                        }}
                        disabled={!attendanceWorkspace || (() => {
                          const ws = workspaces.find(w => w.id === attendanceWorkspace);
                          return !(ws && (ws.classTeacher === userEmail || ws.mentor === userEmail));
                        })()}
                      />
                      {attendanceWorkspace && (() => {
                        const ws = workspaces.find(w => w.id === attendanceWorkspace);
                        const isAuthorized = ws && (ws.classTeacher === userEmail || ws.mentor === userEmail);
                        return isAuthorized ? (
                          <Button variant="destructive" size="icon" onClick={handleDeleteAttendance} title="Delete Entire Attendance">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>

                {attendanceWorkspace && (() => {
                  const ws = workspaces.find(w => w.id === attendanceWorkspace);
                  const isAuthorized = ws && (ws.classTeacher === userEmail || ws.mentor === userEmail);

                  if (!isAuthorized) {
                    return (
                      <div className="mt-6 p-6 bg-slate-900/50 border border-slate-700 rounded-lg flex flex-col items-center justify-center text-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-full">
                          <AlertTriangle className="h-8 w-8 text-red-500" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-medium text-white">Access Restricted</h3>
                          <p className="text-slate-400 max-w-md">
                            You must be the appointed <strong>Class Teacher</strong> or <strong>Mentor</strong> to mark attendance for this workspace.
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setActiveSection('view-attendance')} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                          Go to View Attendance
                        </Button>
                      </div>
                    );
                  }

                  return null;
                })()}

                {attendanceList.length > 0 && (
                  <>
                    <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700 mt-4">
                      <span className="font-medium text-slate-300">Student</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Present For All</span>
                        <input
                          type="checkbox"
                          className="rounded border-slate-600 bg-slate-800 h-4 w-4"
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAttendanceList(prev => prev.map(s => ({ ...s, status: checked ? 'present' : 'absent' })));
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search students..."
                          className="pl-8 bg-slate-900 border-slate-700"
                          value={attendanceMarkingSearch}
                          onChange={(e) => setAttendanceMarkingSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <span className="text-sm text-slate-400 whitespace-nowrap">Bulk Mark:</span>
                      <Select value={bulkAttendanceStatus} onValueChange={(v: any) => setBulkAttendanceStatus(v)}>
                        <SelectTrigger className="w-[100px] bg-slate-950 border-slate-700 text-slate-300 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Enter identifiers (e.g. 602, 607)"
                        className="bg-slate-950 border-slate-700 text-slate-300 h-9 flex-1"
                        value={bulkAttendanceInput}
                        onChange={(e) => setBulkAttendanceInput(e.target.value)}
                      />
                      <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-9"
                        onClick={handleBulkAttendanceUpdate}
                      >
                        Update
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {attendanceList
                        .filter(s => (studentMap.get(s.email) || s.email).toLowerCase().includes(attendanceMarkingSearch.toLowerCase()))
                        .slice((attendanceMarkingPage - 1) * 10, attendanceMarkingPage * 10)
                        .map((student, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <span className="text-white">{student.email}</span>
                            <input
                              type="checkbox"
                              className="rounded border-slate-600 bg-slate-800 h-5 w-5"
                              checked={student.status === 'present'}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAttendanceList(prev => prev.map(s => s.email === student.email ? { ...s, status: checked ? 'present' : 'absent' } : s));
                              }}
                            />
                          </div>
                        ))}
                    </div>
                    {attendanceList.filter(s => (studentMap.get(s.email) || s.email).toLowerCase().includes(attendanceMarkingSearch.toLowerCase())).length > 10 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button variant="outline" size="sm" onClick={() => setAttendanceMarkingPage(p => Math.max(1, p - 1))} disabled={attendanceMarkingPage === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-sm text-slate-400">Page {attendanceMarkingPage}</span>
                        <Button variant="outline" size="sm" onClick={() => setAttendanceMarkingPage(p => p + 1)} disabled={attendanceMarkingPage * 10 >= attendanceList.filter(s => (studentMap.get(s.email) || s.email).toLowerCase().includes(attendanceMarkingSearch.toLowerCase())).length} className="border-slate-600 text-slate-300 hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    )}

                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4" onClick={handleSaveAttendance}>
                      Make Attendance
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* STUDENT MARKS DIALOG */}
      <Dialog open={!!selectedStudentMarks} onOpenChange={(open) => !open && setSelectedStudentMarks(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Student Marks</DialogTitle>
            <DialogDescription className="text-slate-400">
              Student: {selectedStudentMarks?.email} • {studentMarksData.length} record(s)
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="grid grid-cols-12 gap-4 bg-slate-950 p-3 rounded-t-lg border-b border-slate-800 font-medium text-slate-400 text-sm">
              <div className="col-span-8">Assignment / Exam Title</div>
              <div className="col-span-2 text-center">Marks</div>
              <div className="col-span-2 text-right">Date</div>
            </div>
            <div className="max-h-[400px] overflow-y-auto border border-slate-800 rounded-b-lg">
              {studentMarksData.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No graded submissions found.</div>
              ) : (
                studentMarksData.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 p-3 border-b border-slate-800 hover:bg-slate-800/30 text-sm">
                    <div className="col-span-8 truncate text-white">{item.title}</div>
                    <div className="col-span-2 text-center text-slate-300">{item.marks}</div>
                    <div className="col-span-2 text-right text-slate-500">{item.date?.toDate ? item.date.toDate().toLocaleDateString() : 'N/A'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedStudentMarks(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </DashboardLayout >
  );
};

export default TeacherDashboard;

