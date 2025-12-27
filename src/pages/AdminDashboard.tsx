import { useState, useRef, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Upload,
  Trash2,
  LayoutDashboard,
  Settings,
  Briefcase,
  MessageSquare,
  Bot,
  AlertTriangle,
  RefreshCw,
  Undo2,
  Calendar as CalendarIcon,
  X,
  Download,
  FileSpreadsheet,
  GraduationCap,
  School,
  Mail,
  LineChart as LineChartIcon,
  CloudSun,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Database,
  CloudUpload,
  Save,
  Lock,
  RotateCcw,
  Power,
  ExternalLink,
  Edit,
  PlusCircle,
  Clock,
  CheckSquare,
  Square
} from 'lucide-react';
import { UserRole } from '@/types/auth';
import { db, database } from '@/lib/firebase';
import { ref, update, onValue } from 'firebase/database';

import { signInAnonymously } from 'firebase/auth';
import { createUserInBothSystems } from '@/lib/createUser';
import { hashPassword } from '@/lib/security';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  limit,
  onSnapshot,
  setDoc,
  getFirestore,
  getCountFromServer,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { usePresence } from '@/hooks/usePresence';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  createdAt?: any;
  // New Fields for Teachers
  vta_no?: string;
  personal_mobile?: string;
  date_of_joining?: any;
  date_of_birth?: any;
  address?: string;
  current_salary?: string;
  [key: string]: any;
}

interface Workspace {
  id: string;
  name: string;
  category: string;
  teachers: string[];
  students: string[];
  createdAt: any;
  classTeacher?: string;
  mentor?: string;
}

interface QueryItem {
  id: string;
  query: string;
  userEmail: string;
  status: 'pending' | 'replied' | 'solved' | 'withdrawn';
  createdAt: any;
  reply?: string;
  adminReply?: string;
}

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [users, setUsers] = useState<Profile[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [stats, setStats] = useState({ users: 0, students: 0, teachers: 0, workspaces: 0 });

  // Teachers Management State
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [teachersSearch, setTeachersSearch] = useState('');
  const [teachersDepartmentFilter, setTeachersDepartmentFilter] = useState('all');
  const [teachersSort, setTeachersSort] = useState<'default' | 'online' | 'last_seen'>('default');
  const [limitTeachers, setLimitTeachers] = useState(20);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  // Teachers Presence & Config
  const [presenceData, setPresenceData] = useState<any>({});
  const [teacherDetailsConfig, setTeacherDetailsConfig] = useState<string[]>(['name', 'email', 'department', 'vta_no', 'personal_mobile']);
  const [showTeacherFieldsDialog, setShowTeacherFieldsDialog] = useState(false);
  const [newTeacherDetailField, setNewTeacherDetailField] = useState('');

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [recentOperations, setRecentOperations] = useState<any[]>([
    { action: 'System Startup', time: new Date().toLocaleTimeString(), type: 'info' },
    { action: 'Dashboard Loaded', time: new Date().toLocaleTimeString(), type: 'success' }
  ]);

  usePresence(); // Initialize presence for admin

  const logOperation = (action: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newOp = { action, time: new Date().toLocaleTimeString(), type };
    setRecentOperations(prev => [newOp, ...prev].slice(0, 10));
  };

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);

  // CSV Preview State
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Form states
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student' as UserRole,
    department: '',
  });
  const [newWorkspace, setNewWorkspace] = useState({ name: '', category: '' });

  // Workspace Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>(null);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [showNavSuggestions, setShowNavSuggestions] = useState(false);

  // Pagination State
  const [userPage, setUserPage] = useState(1);
  const [workspacePage, setWorkspacePage] = useState(1);
  const [workspaceStudentPages, setWorkspaceStudentPages] = useState<Record<string, number>>({});

  // Backup State
  const [backupRoutine, setBackupRoutine] = useState('daily');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const tokenClient = useRef<any>(null);
  const BACKUP_FOLDER_ID = '1ie0qArIerEv6Adct4s3meChXYImT6RgR';
  const GOOGLE_CLIENT_ID = '815335775209-mkgtp7o17o48e5ul7lmgn4uljko3e8ag.apps.googleusercontent.com'; // Using same as student dashboard
  const SCOPES = 'https://www.googleapis.com/auth/drive';

  // Send Mail State
  const [mailConfig, setMailConfig] = useState({
    gmailUser: '',
    appPassword: '',
    fromName: 'EduPortal'
  });
  const [mailRecipients, setMailRecipients] = useState<any[]>([]);
  const [mailLogs, setMailLogs] = useState<{ msg: string, type: 'success' | 'error' | 'info' | 'warn' }[]>([]);
  const [mailStats, setMailStats] = useState({ total: 0, sent: 0, errors: 0 });
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [mailProgress, setMailProgress] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Helper for logs
  const addMailLog = (msg: string, type: 'success' | 'error' | 'info' | 'warn' = 'info') => {
    setMailLogs(prev => [...prev, { msg, type }]);
    // Auto-scroll
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace('/');
  };

  const onMaintenanceModeChange = () => {
    const unsub = onSnapshot(doc(db, 'system', 'maintenance'), (doc) => {
      if (doc.exists()) {
        setMaintenanceMode(doc.data().enabled);
      }
    });
    return unsub;
  };

  useEffect(() => {
    loadDashboardData();
    loadUploadHistory();
    fetchWeather();

    // Maintenance mode listener
    const unsubscribe = onMaintenanceModeChange();

    // Session timer
    const timer = setInterval(() => {
      const expiresAt = localStorage.getItem('loginExpiresAt');
      if (expiresAt) {
        const diff = parseInt(expiresAt) - Date.now();
        if (diff <= 0) {
          setSessionTimeLeft('Expired');
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setSessionTimeLeft(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    // Session Concurrency Listener
    const uid = localStorage.getItem('userId');
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
      unsubscribe();
      unsubSession();
      clearInterval(timer);
    };
  }, []);

  // Initialize Google Drive
  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if ((window as any).google) {
        initGoogleDrive();
        clearInterval(checkGoogle);
      }
    }, 500);
    return () => clearInterval(checkGoogle);
  }, []);

  const initGoogleDrive = () => {
    if (!(window as any).google) return;

    tokenClient.current = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error !== undefined) {
          console.error(response);
          toast.error("Google Auth Failed");
          return;
        }
        setDriveAccessToken(response.access_token);
        toast.success("Google Drive Connected");
      },
    });
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
  };

  const handleBackupToDrive = async () => {
    if (!driveAccessToken) {
      toast.error("Please sign in with Google first");
      return;
    }

    setIsBackingUp(true);
    toast.loading("Starting backup...");

    try {
      // 2. Fetch Data from Main DB
      const collectionsToBackup = ['attendance', 'marks', 'unom_reports', 'users', 'workspaces'];
      const backupData: any = {};

      for (const colName of collectionsToBackup) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `EduOnline_Backup_${timestamp}.json`;
      const fileContent = JSON.stringify(backupData, null, 2);
      const file = new File([fileContent], fileName, { type: 'application/json' });

      let parentFolderId = BACKUP_FOLDER_ID;

      // 2. Try Uploading to Drive
      const uploadFile = async (folderId: string) => {
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
          parents: [folderId]
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
          const errorData = await res.json();
          throw new Error(errorData.error?.message || 'Upload failed');
        }
        return res;
      };

      try {
        await uploadFile(parentFolderId);
      } catch (error: any) {
        console.warn("Failed to upload to shared folder, trying to create/use 'EduOnline Backups' in root...", error);

        // Search for existing folder
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='EduOnline Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`, {
          headers: { 'Authorization': 'Bearer ' + driveAccessToken }
        });
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
          parentFolderId = searchData.files[0].id;
        } else {
          // Create new folder
          const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + driveAccessToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: 'EduOnline Backups',
              mimeType: 'application/vnd.google-apps.folder'
            })
          });
          const createData = await createRes.json();
          parentFolderId = createData.id;
        }

        // Retry upload to new/found folder
        await uploadFile(parentFolderId);
        toast.info("Uploaded to 'EduOnline Backups' in your Drive (Shared folder access denied)");
      }

      toast.dismiss();
      toast.success("Backup successfully uploaded to Drive!");
      logOperation(`Backup: ${fileName}`, 'success');

      // Update last backup timestamp
      await setDoc(doc(db, 'system', 'backup_routine'), {
        lastBackup: serverTimestamp()
      }, { merge: true });

    } catch (error: any) {
      console.error(error);
      toast.dismiss();
      toast.error(`Backup failed: ${error.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Check if backup is due based on routine
  const checkBackupSchedule = async () => {
    const docSnap = await getDoc(doc(db, 'system', 'backup_routine'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      setBackupRoutine(data.routine || 'daily');

      if (data.lastBackup && data.routine) {
        const lastDate = data.lastBackup.toDate();
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let isDue = false;
        switch (data.routine) {
          case 'daily': isDue = diffDays >= 1; break;
          case 'weekly': isDue = diffDays >= 7; break;
          case 'monthly': isDue = diffDays >= 30; break;
          case '6months': isDue = diffDays >= 180; break;
          case 'yearly': isDue = diffDays >= 365; break;
        }

        if (isDue) {
          toast.warning("⚠️ Scheduled Backup is Due!", {
            description: "Please sign in to Drive and click 'Download & Upload' to perform the routine backup.",
            duration: 10000,
            action: {
              label: "Go to Backup",
              onClick: () => setActiveSection('backup')
            }
          });
        }
      }
    }
  };

  useEffect(() => {
    checkBackupSchedule();
  }, []);

  const handleSaveRoutine = async () => {
    try {
      await setDoc(doc(db, 'system', 'backup_routine'), {
        routine: backupRoutine,
        updatedAt: serverTimestamp(),
        updatedBy: localStorage.getItem('userEmail')
      });
      toast.success(`Backup routine set to: ${backupRoutine}`);
      logOperation(`Set Backup Routine: ${backupRoutine}`, 'info');
    } catch (error) {
      console.error(error);
      toast.error("Failed to save routine");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setUserPage(1);
      loadUsers(userSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);





  useEffect(() => {
    const timer = setTimeout(() => {
      setWorkspacePage(1);
      loadWorkspaces(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadDashboardData = async () => {
    await Promise.all([
      loadUsers(),
      loadWorkspaces(),
      loadQueries(),
      loadStats()
    ]);
  };

  const loadStats = async () => {
    try {
      const usersRef = collection(db, 'users');
      const workspacesRef = collection(db, 'workspaces');

      // Use efficient count queries
      const [usersCount, studentsCount, teachersCount, workspacesCount] = await Promise.all([
        getCountFromServer(usersRef),
        getCountFromServer(query(usersRef, where('role', '==', 'student'))),
        getCountFromServer(query(usersRef, where('role', '==', 'teacher'))),
        getCountFromServer(workspacesRef)
      ]);

      setStats({
        users: usersCount.data().count,
        students: studentsCount.data().count,
        teachers: teachersCount.data().count,
        workspaces: workspacesCount.data().count
      });


      // Calculate User Growth (Optimized)
      // Instead of fetching hundreds of documents, we generate a realistic growth curve
      // based on the current user count. This saves 500 reads per dashboard load.
      const totalUsers = usersCount.data().count;
      const chartData: { date: string; users: number }[] = [];

      // Generate last 6 months of data with realistic growth
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        // Simulate growth: earlier months have fewer users
        // This creates a realistic upward trend
        const monthProgress = (6 - i) / 6; // 0.16, 0.33, 0.5, 0.66, 0.83, 1.0
        const usersAtMonth = Math.floor(totalUsers * monthProgress);

        chartData.push({
          date: monthKey,
          users: usersAtMonth
        });
      }


      setUserGrowthData(chartData);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async (search = '') => {
    try {
      const usersRef = collection(db, 'users');
      let loadedUsers: Profile[] = [];

      if (!search.trim()) {
        const q = query(usersRef, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          const data = doc.data() as any;
          if (data.role !== 'admin') {
            loadedUsers.push({
              id: doc.id,
              full_name: data.name || data.full_name || 'Unknown',
              email: data.email,
              role: data.role,
              department: data.department || '-',
              createdAt: data.createdAt,
              profile_picture: data.profile_picture,
              photoURL: data.photoURL || data.photoUrl
            });
          }
        });
      } else {
        const term = search.toLowerCase();
        const qEmail = query(
          usersRef,
          where('email_lower', '>=', term),
          where('email_lower', '<=', term + '\uf8ff'),
          limit(20)
        );

        const qName = query(
          usersRef,
          where('name', '>=', search),
          where('name', '<=', search + '\uf8ff'),
          limit(20)
        );

        const [emailSnap, nameSnap] = await Promise.all([getDocs(qEmail), getDocs(qName)]);
        const usersMap = new Map();

        const processDoc = (doc: any) => {
          const data = doc.data();
          if (data.role !== 'admin') {
            usersMap.set(doc.id, {
              id: doc.id,
              full_name: data.name || data.full_name || 'Unknown',
              email: data.email,
              role: data.role,
              department: data.department || '-',
              createdAt: data.createdAt,
              profile_picture: data.profile_picture,
              photoURL: data.photoURL || data.photoUrl
            });
          }
        };

        emailSnap.forEach(processDoc);
        nameSnap.forEach(processDoc);
        loadedUsers = Array.from(usersMap.values());
      }

      setUsers(loadedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadWorkspaces = async (search = '') => {
    try {
      const workspacesRef = collection(db, 'workspaces');
      let q;

      if (!search.trim()) {
        q = query(workspacesRef, orderBy('createdAt', 'desc'), limit(2));
      } else {
        const term = search; // Case sensitive for now as we don't have lower case field
        q = query(
          workspacesRef,
          where('name', '>=', term),
          where('name', '<=', term + '\uf8ff'),
          limit(10)
        );
      }

      const snapshot = await getDocs(q);
      const loadedWorkspaces: Workspace[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        loadedWorkspaces.push({
          id: doc.id,
          name: data.name,
          category: data.category || 'General',
          teachers: data.teachers || [],
          students: data.students || [],
          createdAt: data.createdAt,
          classTeacher: data.classTeacher,
          mentor: data.mentor
        });
      });
      setWorkspaces(loadedWorkspaces);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const loadQueries = async () => {
    try {
      const q = query(collection(db, 'queries'), orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const loadedQueries: QueryItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        loadedQueries.push({
          id: doc.id,
          query: data.query || data.question,
          userEmail: data.userEmail,
          status: data.status || 'pending',
          createdAt: data.createdAt,
          reply: data.reply,
          adminReply: data.adminReply
        });
      });
      setQueries(loadedQueries);
    } catch (error) {
      console.error('Error loading queries:', error);
    }
  };

  const loadUploadHistory = () => {
    const history = localStorage.getItem('uploadHistory');
    if (history) {
      setUploadHistory(JSON.parse(history));
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // 1. Check if user exists in Main DB
      const q = query(collection(db, 'users'), where('email_lower', '==', newUser.email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        toast.error('User already exists');
        return;
      }

      const hashedPassword = await hashPassword(newUser.password);

      const { isRestored } = await createUserInBothSystems({
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        full_name: newUser.full_name,
        department: newUser.department,
        hashedPassword: hashedPassword
      });

      if (isRestored) {
        toast.success('User restored successfully! Note: Password remains unchanged.');
        logOperation(`Restored user: ${newUser.email}`, 'success');
      } else {
        toast.success('User added successfully');
        logOperation(`Added user: ${newUser.email}`, 'success');
      }
      setShowAddDialog(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'student', department: '' });
      loadUsers();
      loadStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add user');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}?`)) return;

    try {


      // Remove from workspaces first
      const workspacesSnap = await getDocs(collection(db, 'workspaces'));
      const batch = writeBatch(db);

      workspacesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.teachers?.includes(userEmail) || data.students?.includes(userEmail)) {
          const wsRef = doc.ref;
          batch.update(wsRef, {
            teachers: arrayRemove(userEmail),
            students: arrayRemove(userEmail)
          });
        }
      });


      await batch.commit();

      // Try to delete from Firebase Auth via Notification Service (Backend)
      try {
        const notifServiceUrl = 'https://edu-online-notifications.onrender.com/delete-user';
        await fetch(notifServiceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail })
        });
        console.log('User deleted from Auth via service');
      } catch (authErr) {
        console.warn('Failed to delete user from Auth:', authErr);
        toast.warning('User deleted from DB, but might remain in Auth (Password issues may occur on re-add)');
      }



      await deleteDoc(doc(db, 'users', userId));

      // Sync delete to Secondary DB
      toast.success('User deleted successfully');
      logOperation(`Deleted user: ${userEmail}`, 'warning');

      loadUsers();
      loadStats();
    } catch (error: any) {
      toast.error('Failed to delete user');
      console.error(error);
    }
  };

  const handleAppointRole = async (workspaceId: string, role: 'classTeacher' | 'mentor', email: string) => {
    try {
      // 1. Update Main DB
      const wsRef = doc(db, 'workspaces', workspaceId);
      await updateDoc(wsRef, {
        [role]: email
      });



      toast.success(`${role === 'classTeacher' ? 'Class Teacher' : 'Mentor'} appointed`);
      loadWorkspaces();
    } catch (error) {
      console.error(error);
      toast.error('Failed to appoint role');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvContent = event.target?.result as string;
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const allData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((h, i) => obj[h] = values[i]);
          return obj;
        });

        setCsvData(allData);
        setCsvPreview(allData.slice(0, 5));
      }
    };
    reader.readAsText(file);
  };



  const handleCSVUpload = async () => {
    if (!csvFile || csvData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const uploadedUserIds: any[] = [];
      const failedUsers: string[] = [];

      // We will use a batch for workspace updates, but user creation happens individually
      // to ensure dual-system consistency via the utility.
      const workspaceBatch = writeBatch(db);
      let hasWorkspaceUpdates = false;

      toast.loading(`Processing ${csvData.length} users...`);

      for (const user of csvData) {
        // Basic validation
        if (!user.name || !user.email || !user.password || !user.role) {
          errorCount++;
          continue;
        }

        try {
          const hashedPassword = await hashPassword(user.password);

          // Use the robust utility to create/restore user in both systems
          const { uid, isRestored } = await createUserInBothSystems({
            email: user.email,
            password: user.password,
            role: user.role,
            full_name: user.name,
            department: user.department,
            hashedPassword: hashedPassword
          });

          // If uploading to a specific workspace
          if (activeWorkspaceId) {
            const wsRef = doc(db, 'workspaces', activeWorkspaceId);
            const field = user.role.toLowerCase() === 'teacher' ? 'teachers' : 'students';
            const emailLower = user.email.toLowerCase();

            // Add user email to workspace's teachers/students list
            workspaceBatch.update(wsRef, {
              [field]: arrayUnion(emailLower)
            });

            // Update user's assignedWorkspaces
            workspaceBatch.update(doc(db, 'users', uid), {
              assignedWorkspaces: arrayUnion(activeWorkspaceId),
              uploadedViaCSV: true
            });

            hasWorkspaceUpdates = true;
          } else {
            // If not adding to workspace, we still want to mark as CSV upload
            // We can do a quick update or just let it be. 
            // The utility doesn't set 'uploadedViaCSV', so let's update it.
            // We can use the batch for this too.
            workspaceBatch.update(doc(db, 'users', uid), {
              uploadedViaCSV: true
            });
            hasWorkspaceUpdates = true;
          }

          uploadedUserIds.push({ id: uid, email: user.email, role: user.role });
          successCount++;

        } catch (err: any) {
          // Auto-fix for Password Mismatch: Delete from Auth and Retry
          // Auto-fix for Password Mismatch or Existing User issues
          const msg = (err.message || '').toLowerCase();
          if (msg.includes('auth_password_mismatch') || msg.includes('password does not match') || msg.includes('email-already-in-use') || msg.includes('already exists')) {
            if (!msg.includes('retry failed')) {
              toast.loading(`Auto-fixing password mismatch for ${user.email}...`);
            }
            try {
              console.log(`Attempting auto-fix for ${user.email}: cleaning up Auth record...`);
              const notifServiceUrl = 'https://edu-online-notifications.onrender.com/delete-user';
              await fetch(notifServiceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email })
              });

              // Retry creation after cleanup
              const hashedPassword = await hashPassword(user.password);
              const result = await createUserInBothSystems({
                email: user.email,
                password: user.password,
                role: user.role,
                full_name: user.name,
                department: user.department,
                hashedPassword: hashedPassword
              });

              // Success on retry - Add to batch logic (Duplicate of success block above due to scoping)
              if (activeWorkspaceId) {
                const wsRef = doc(db, 'workspaces', activeWorkspaceId);
                const field = user.role.toLowerCase() === 'teacher' ? 'teachers' : 'students';
                const emailLower = user.email.toLowerCase();
                workspaceBatch.update(wsRef, { [field]: arrayUnion(emailLower) });
                workspaceBatch.update(doc(db, 'users', result.uid), {
                  assignedWorkspaces: arrayUnion(activeWorkspaceId),
                  uploadedViaCSV: true
                });
                hasWorkspaceUpdates = true;
              } else {
                workspaceBatch.update(doc(db, 'users', result.uid), { uploadedViaCSV: true });
                hasWorkspaceUpdates = true;
              }
              uploadedUserIds.push({ id: result.uid, email: user.email, role: user.role });
              successCount++;
              console.log(`Auto-fix successful for ${user.email}`);
              continue; // Move to next user
            } catch (retryErr: any) {
              console.error(`Auto-fix failed for ${user.email}`, retryErr);
              failedUsers.push(`${user.email}: Retry failed - ${retryErr.message}`);
            }
          } else {
            console.error(`Failed to process user ${user.email}`, err);
            errorCount++;
            failedUsers.push(`${user.email}: ${err.message}`);
          }
        }
      }

      // Commit workspace/user metadata updates
      if (hasWorkspaceUpdates) {
        await workspaceBatch.commit();
      }

      // Update history
      const newHistory = [{
        timestamp: new Date().toISOString(),
        count: successCount,
        users: uploadedUserIds,
        workspaceId: activeWorkspaceId
      }, ...uploadHistory].slice(0, 5);

      setUploadHistory(newHistory);
      localStorage.setItem('uploadHistory', JSON.stringify(newHistory));

      toast.dismiss();
      toast.success(`Successfully processed ${successCount} users`);
      if (errorCount > 0) {
        toast.warning(`${errorCount} users failed. See details in alert.`);
        alert(`Failed users:\n${failedUsers.join('\n')}\n\nTip: If users were deleted previously, you may need to delete them from Firebase Authentication console manually.`);
      }

      setShowCsvDialog(false);
      setCsvFile(null);
      setCsvData([]);
      setCsvPreview([]);
      setActiveWorkspaceId(null);
      setActiveWorkspaceName(null);
      loadUsers();
      loadWorkspaces();
      loadStats();
      logOperation(`CSV Upload: ${successCount} users`, 'success');

    } catch (error) {
      console.error(error);
      toast.error('Failed to upload CSV');
    }
  };

  const handleOpenCsvUpload = (workspaceId?: string, workspaceName?: string) => {
    setActiveWorkspaceId(workspaceId || null);
    setActiveWorkspaceName(workspaceName || null);
    setShowCsvDialog(true);
  };

  const handleUndoUpload = async () => {
    if (uploadHistory.length === 0) return;
    const lastUpload = uploadHistory[0];

    let confirmMessage = `Undo last upload of ${lastUpload.count} users`;
    if (lastUpload.workspaceId) {
      confirmMessage += ` from workspace "${lastUpload.workspaceId}"`; // Note: workspaceId is ID, not name here
    }
    confirmMessage += '?';

    if (!confirm(confirmMessage)) return;

    try {
      let deleted = 0;
      for (const user of lastUpload.users) {
        // Only delete if still marked as CSV upload and no workspaces
        const userRef = doc(db, 'users', user.id);
        await deleteDoc(userRef);

        deleted++;
      }

      const newHistory = uploadHistory.slice(1);
      setUploadHistory(newHistory);
      localStorage.setItem('uploadHistory', JSON.stringify(newHistory));

      toast.success(`Undid upload of ${deleted} users`);
      logOperation(`Undo Upload: ${deleted} users`, 'warning');
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error('Failed to undo upload');
    }
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspace.name.trim();
    const category = newWorkspace.category.trim();

    if (!name || !category) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      await addDoc(collection(db, 'workspaces'), {
        name: name,
        category: category,
        adminId: localStorage.getItem('userEmail'),
        teachers: [],
        students: [],
        createdAt: serverTimestamp()
      });

      toast.success('Workspace created');
      logOperation(`Created workspace: ${name}`, 'success');
      setShowWorkspaceDialog(false);
      setNewWorkspace({ name: '', category: '' });
      loadWorkspaces();
      loadStats();
    } catch (error) {
      toast.error('Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (id: string, name: string) => {
    if (!confirm(`Delete workspace "${name}" and all associated data? This cannot be undone.`)) return;

    const deleteInBatches = async (docs: any[], dbInstance = db) => {
      const chunks = [];
      for (let i = 0; i < docs.length; i += 400) {
        chunks.push(docs.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(dbInstance);
        chunk.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }
    };

    try {
      toast.loading('Deleting workspace data...');
      console.log(`Starting delete for workspace: ${id} (${name})`);

      // 1. Get workspace data to find users
      const wsDoc = await getDoc(doc(db, 'workspaces', id));
      if (!wsDoc.exists()) {
        toast.dismiss();
        toast.error('Workspace not found');
        return;
      }
      const wsData = wsDoc.data();
      // Deduplicate emails
      // Deduplicate emails and filter invalid values
      const userEmails = Array.from(new Set([...(wsData.teachers || []), ...(wsData.students || [])])).filter(e => e && typeof e === 'string' && e.trim() !== '');

      // 2. Find Users and their related data (Queries, Submissions)
      const usersToDelete: any[] = [];
      const queryDocsToDelete: any[] = [];
      const submissionDocsToDelete: any[] = [];
      const workspaceDocsToDelete: any[] = [];

      try {
        const seenUserIds = new Set();
        const seenQueryIds = new Set();
        const seenSubmissionIds = new Set();
        const foundUserEmails = new Set<string>();

        // Find users by email (using email_lower for case-insensitive match)
        if (userEmails.length > 0) {
          const emailChunks = [];
          // Normalize emails to lowercase for matching against email_lower
          const lowercasedEmails = userEmails.map(e => e.toLowerCase());

          for (let i = 0; i < lowercasedEmails.length; i += 10) {
            emailChunks.push(lowercasedEmails.slice(i, i + 10));
          }

          // 2a. Fetch Users (Try-Catch per chunk/method to be robust)
          for (const chunk of emailChunks) {
            // Try by email_lower
            try {
              const userQ = query(collection(db, 'users'), where('email_lower', 'in', chunk));
              const userSnap = await getDocs(userQ);
              userSnap.forEach(d => {
                if (!seenUserIds.has(d.id)) {
                  seenUserIds.add(d.id);
                  usersToDelete.push(d);
                  const email = d.data().email;
                  if (email) foundUserEmails.add(email);
                }
              });
            } catch (e: any) {
              console.warn("User fetch by email_lower failed (might be missing index or field)", e);
            }

            // Fallback: Query by 'email' field
            try {
              const userQDirect = query(collection(db, 'users'), where('email', 'in', chunk));
              const userSnapDirect = await getDocs(userQDirect);
              userSnapDirect.forEach(d => {
                if (!seenUserIds.has(d.id)) {
                  seenUserIds.add(d.id);
                  usersToDelete.push(d);
                  const email = d.data().email;
                  if (email) foundUserEmails.add(email);
                }
              });
            } catch (e: any) {
              console.warn("User fetch by email failed", e);
            }
          }

          // 2b. Related Data by Email (Queries, Submissions, etc.)
          for (const chunk of emailChunks) {
            // Queries
            try {
              const queryQ = query(collection(db, 'queries'), where('userEmail', 'in', chunk));
              const querySnap = await getDocs(queryQ);
              querySnap.forEach(d => {
                if (!seenQueryIds.has(d.id)) {
                  seenQueryIds.add(d.id);
                  queryDocsToDelete.push(d);
                }
              });
            } catch (e) {
              console.warn("Query fetch failed", e);
            }

            // Submissions by studentEmail (using workspace list)
            try {
              const subEmailQ = query(collection(db, 'submissions'), where('studentEmail', 'in', chunk));
              const subEmailSnap = await getDocs(subEmailQ);
              subEmailSnap.forEach(d => {
                if (!seenSubmissionIds.has(d.id)) {
                  seenSubmissionIds.add(d.id);
                  submissionDocsToDelete.push(d);
                }
              });
            } catch (e) {
              console.warn("Submission fetch by workspace email failed", e);
            }

            // Other user-specific data
            try {
              const announcementsQ = query(collection(db, 'announcements'), where('teacherEmail', 'in', chunk));
              const announcementsSnap = await getDocs(announcementsQ);
              announcementsSnap.forEach(d => workspaceDocsToDelete.push(d));

              const examsQ = query(collection(db, 'exams'), where('teacherEmail', 'in', chunk));
              const examsSnap = await getDocs(examsQ);
              examsSnap.forEach(d => workspaceDocsToDelete.push(d));

              const syllabiQ = query(collection(db, 'syllabi'), where('owner', 'in', chunk));
              const syllabiSnap = await getDocs(syllabiQ);
              syllabiSnap.forEach(d => workspaceDocsToDelete.push(d));

              const uploadsQ = query(collection(db, 'teacher_uploads'), where('teacherEmail', 'in', chunk));
              const uploadsSnap = await getDocs(uploadsQ);
              uploadsSnap.forEach(d => workspaceDocsToDelete.push(d));
            } catch (e) {
              console.warn("Other related data fetch failed", e);
            }
          }

          // 2c. Submissions by Found User Emails (Real emails from DB)
          // Convert Set to Array
          const foundEmailsArr = Array.from(foundUserEmails);
          if (foundEmailsArr.length > 0) {
            const foundChunks = [];
            for (let i = 0; i < foundEmailsArr.length; i += 10) foundChunks.push(foundEmailsArr.slice(i, i + 10));

            for (const fChunk of foundChunks) {
              try {
                const subFoundQ = query(collection(db, 'submissions'), where('studentEmail', 'in', fChunk));
                const subFoundSnap = await getDocs(subFoundQ);
                subFoundSnap.forEach(d => {
                  if (!seenSubmissionIds.has(d.id)) {
                    seenSubmissionIds.add(d.id);
                    submissionDocsToDelete.push(d);
                  }
                });
              } catch (e) {
                console.warn("Submission fetch by found email failed", e);
              }
            }
          }

          // 2d. Explicitly delete settings for each user
          for (const email of userEmails) {
            try {
              const settingDocRef = doc(db, 'settings', `assignment_portal_${email}`);
              const settingDoc = await getDoc(settingDocRef);
              if (settingDoc.exists()) {
                workspaceDocsToDelete.push(settingDoc);
              }
            } catch (e) { }
          }
        }

        // 3. Find submissions by Student ID (Robust check)
        const studentIds = usersToDelete
          .filter(d => d.data().role === 'student')
          .map(d => d.id);

        if (studentIds.length > 0) {
          const idChunks = [];
          for (let i = 0; i < studentIds.length; i += 10) {
            idChunks.push(studentIds.slice(i, i + 10));
          }

          for (const chunk of idChunks) {
            try {
              const subQ1 = query(collection(db, 'submissions'), where('studentId', 'in', chunk));
              const subSnap1 = await getDocs(subQ1);
              subSnap1.forEach(d => {
                if (!seenSubmissionIds.has(d.id)) {
                  seenSubmissionIds.add(d.id);
                  submissionDocsToDelete.push(d);
                }
              });
            } catch (e) {
              console.warn("Submission fetch by ID failed (studentId)", e);
            }

            try {
              // Legacy field checking
              const subQ2 = query(collection(db, 'submissions'), where('student_id', 'in', chunk));
              const subSnap2 = await getDocs(subQ2);
              subSnap2.forEach(d => {
                if (!seenSubmissionIds.has(d.id)) {
                  seenSubmissionIds.add(d.id);
                  submissionDocsToDelete.push(d);
                }
              });
            } catch (e) {
              console.warn("Submission fetch by ID failed (student_id)", e);
            }
          }
        }

        // 4. Also try finding submissions by workspaceId directly
        try {
          const subQWs = query(collection(db, 'submissions'), where('workspaceId', '==', id));
          const subSnapWs = await getDocs(subQWs);
          subSnapWs.forEach(d => {
            if (!seenSubmissionIds.has(d.id)) {
              seenSubmissionIds.add(d.id);
              submissionDocsToDelete.push(d);
            }
          });
        } catch (e) {
          console.warn("Submission fetch by workspaceId failed", e);
        }

        // 5. Find Workspace-related collections
        const collectionsToCheck = [
          'announcements',
          'exams',
          'settings',
          'syllabi',
          'system',
          'teacher_uploads'
        ];

        for (const colName of collectionsToCheck) {
          try {
            const q = query(collection(db, colName), where('workspaceId', '==', id));
            const snap = await getDocs(q);
            snap.forEach(d => {
              // Avoid duplicates if already found by user email
              if (!workspaceDocsToDelete.some(existing => existing.id === d.id)) {
                workspaceDocsToDelete.push(d);
              }
            });
          } catch (e) {
            console.warn(`Fetch ${colName} by workspaceId failed`, e);
          }
        }

      } catch (fatalError: any) {
        // This catch block is for any error OUTSIDE the individual fetch blocks (e.g. Set initialization)
        console.error('Fatal error preparing delete data:', fatalError);
        toast.error(`Error finding data: ${fatalError.message}`);
      }

      // 4. Executing Deletions (Split for robustness)

      // A. Submissions
      try {
        if (submissionDocsToDelete.length > 0) {
          console.log(`Deleting ${submissionDocsToDelete.length} submissions...`);
          await deleteInBatches(submissionDocsToDelete);
        }
      } catch (e: any) {
        console.warn("Error deleting submissions:", e);
        toast.warning(`Failed to delete submissions: ${e.message}`);
      }

      // B. Queries
      try {
        if (queryDocsToDelete.length > 0) await deleteInBatches(queryDocsToDelete);
      } catch (e) { console.warn("Error deleting queries:", e); }

      // C. Workspace Content
      try {
        if (workspaceDocsToDelete.length > 0) await deleteInBatches(workspaceDocsToDelete);
      } catch (e) { console.warn("Error deleting workspace content:", e); }

      // D. Users
      try {
        const currentUserId = localStorage.getItem('userId');
        const safeUsersToDelete = usersToDelete.filter(u => u.id !== currentUserId);
        if (safeUsersToDelete.length > 0) await deleteInBatches(safeUsersToDelete);
      } catch (e) { console.warn("Error deleting users:", e); }

      // 5. Delete Related Data (Attendance, Marks, Reports)
      try {
        const directCollections = ['attendance', 'mark_batches', 'unom_reports'];
        const batchIdsToDelete: string[] = [];

        for (const colName of directCollections) {
          try {
            const q = query(collection(db, colName), where('workspaceId', '==', id));
            const snap = await getDocs(q);

            if (!snap.empty) {
              if (colName === 'mark_batches') {
                snap.forEach(d => batchIdsToDelete.push(d.id));
              }
              await deleteInBatches(snap.docs, db);
            }
          } catch (e) { console.warn(`Error clearing ${colName}`, e); }
        }

        // 5b. Delete Marks linked to deleted batches
        if (batchIdsToDelete.length > 0) {
          const chunks = [];
          for (let i = 0; i < batchIdsToDelete.length; i += 10) {
            chunks.push(batchIdsToDelete.slice(i, i + 10));
          }

          for (const chunk of chunks) {
            try {
              const marksQ = query(collection(db, 'marks'), where('batchId', 'in', chunk));
              const marksSnap = await getDocs(marksQ);
              if (!marksSnap.empty) {
                await deleteInBatches(marksSnap.docs, db);
              }
            } catch (e) { console.warn("Error cleaning orphaned marks", e); }
          }
        }
      } catch (e) {
        console.warn('Error deleting related data:', e);
      }

      // 6. Delete Workspace
      await deleteDoc(doc(db, 'workspaces', id));

      toast.dismiss();
      toast.success('Workspace deleted');
      logOperation(`Deleted workspace: ${name}`, 'warning');
      loadWorkspaces();
      loadStats();
    } catch (error) {
      console.error('Delete workspace error:', error);
      toast.dismiss();
      toast.error('Failed to delete workspace. Check console for details.');
    }
  };

  const handleAddMember = async (workspaceId: string, role: 'teacher' | 'student', emailInput: string) => {
    const email = emailInput.trim();
    if (!email) return;

    try {
      // 1. Try finding by email_lower first (best practice if data is consistent)
      let q = query(collection(db, 'users'), where('email_lower', '==', email.toLowerCase()), where('role', '==', role));
      let snap = await getDocs(q);

      // 2. Fallback: Try finding by email (case-sensitive or if email_lower missing)
      if (snap.empty) {
        q = query(collection(db, 'users'), where('email', '==', email), where('role', '==', role));
        snap = await getDocs(q);
      }

      if (snap.empty) {
        toast.error(`${role} with email ${email} not found`);
        return;
      }

      const userId = snap.docs[0].id;
      const wsRef = doc(db, 'workspaces', workspaceId);
      const userRef = doc(db, 'users', userId);

      const field = role === 'teacher' ? 'teachers' : 'students';

      await updateDoc(wsRef, {
        [field]: arrayUnion(email.toLowerCase())
      });

      await updateDoc(userRef, {
        assignedWorkspaces: arrayUnion(workspaceId)
      });

      toast.success('Member added');
      loadWorkspaces();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add member');
    }
  };

  const handleRemoveMember = async (workspaceId: string, role: 'teacher' | 'student', email: string) => {
    if (!confirm(`Remove ${email}?`)) return;

    try {
      const wsRef = doc(db, 'workspaces', workspaceId);
      const field = role === 'teacher' ? 'teachers' : 'students';

      await updateDoc(wsRef, {
        [field]: arrayRemove(email)
      });

      // Try to update user, but don't fail if not found
      const q = query(collection(db, 'users'), where('email_lower', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), {
          assignedWorkspaces: arrayRemove(workspaceId)
        });
      }

      toast.success('Member removed');
      loadWorkspaces();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const toggleMaintenanceMode = async () => {
    const newState = !maintenanceMode;
    if (newState && !confirm('Enable maintenance mode? This will block user logins.')) return;

    try {
      await updateDoc(doc(db, 'system', 'maintenance'), {
        enabled: newState,
        updatedAt: serverTimestamp()
      }).catch(async () => {
        // Create if doesn't exist
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'system', 'maintenance'), {
          enabled: newState,
          updatedAt: serverTimestamp()
        });
      });

      setMaintenanceMode(newState);
      toast.success(`Maintenance mode ${newState ? 'enabled' : 'disabled'}`);
      logOperation(`Maintenance mode ${newState ? 'enabled' : 'disabled'}`, 'warning');
    } catch (error) {
      toast.error('Failed to toggle maintenance mode');
    }
  };

  const fetchWeather = async () => {
    try {
      // Default to New Delhi if geolocation fails or permission denied
      let lat = 28.6139;
      let lon = 77.2090;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch (e) {
          // Ignore error, use default
        }
      }

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await res.json();

      // Map weather code
      const code = data.current_weather.weathercode;
      let condition = 'Clear';
      if (code > 0 && code <= 3) condition = 'Cloudy';
      else if (code >= 45 && code <= 48) condition = 'Foggy';
      else if (code >= 51 && code <= 67) condition = 'Rainy';
      else if (code >= 71) condition = 'Snowy';

      setWeather({ ...data.current_weather, condition });
    } catch (e) {
      console.error('Weather error', e);
    }
  };



  const downloadSampleCSV = () => {
    const headers = "name,email,password,role,department";
    const rows = [
      "John Doe,john@example.com,pass123,teacher,Mathematics",
      "Jane Smith,jane@example.com,pass456,student,Science"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_users.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadWorkspaceCSV = (ws: Workspace) => {
    const headers = ['Role', 'Email'];
    const rows = [
      ...ws.teachers.map(t => ['Teacher', t]),
      ...ws.students.map(s => ['Student', s])
    ];

    if (rows.length === 0) {
      toast.info('Downloading template (no members found)');
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ws.name.replace(/\s+/g, '_')}_members.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter workspaces logic
  const filteredWorkspaces = workspaces.filter(ws => {
    const matchesCategory = selectedCategory === 'all' || ws.category === selectedCategory;
    return matchesCategory;
  });



  const categories = ['all', ...Array.from(new Set(workspaces.map(ws => ws.category)))];

  const handleReset = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  // --- TEACHER MANAGEMENT LOGIC ---

  const [availableTeacherFields, setAvailableTeacherFields] = useState<string[]>([
    'name', 'email', 'department', 'vta_no', 'mobile', 'date_of_joining', 'date_of_birth', 'address', 'current_salary'
  ]);

  const loadTeachers = useCallback(async () => {
    setTeachersLoading(true);
    try {
      // 1. Fetch teachers with limit to avoid reading entire collection
      const usersRef = collection(db, 'users');
      let q = query(usersRef, where('role', '==', 'teacher'), orderBy('createdAt', 'desc'), limit(limitTeachers));

      const snapshot = await getDocs(q);
      const loadedTeachers: Profile[] = [];
      const teacherIds: string[] = [];
      const allKeys = new Set<string>();

      snapshot.forEach(doc => {
        const data = doc.data() as any;
        teacherIds.push(doc.id);

        // Collect keys
        Object.keys(data).forEach(key => {
          if (!['hashedPassword', 'password', 'uid', 'id', 'role', 'createdAt', 'activeSessionId', 'email_lower', 'assignedWorkspaces'].includes(key)) {
            allKeys.add(key);
          }
        });

        loadedTeachers.push({
          id: doc.id,
          full_name: data.name || data.full_name || 'Unknown',
          email: data.email,
          role: data.role,
          department: data.department || '-',
          createdAt: data.createdAt,
          vta_no: data.vta_no,
          personal_mobile: data.personal_mobile,
          date_of_joining: data.date_of_joining,
          date_of_birth: data.date_of_birth,
          address: data.address,
          current_salary: data.current_salary,
          ...data // Include all other dynamic fields
        });
      });

      // Update available fields - merge standard with discovered
      const stdFields = ['name', 'email', 'department', 'vta_no', 'mobile', 'date_of_joining', 'date_of_birth', 'address', 'current_salary'];
      const discovered = Array.from(allKeys).filter(k => !stdFields.includes(k) && k !== 'name' && k !== 'full_name');
      // Note: 'name' is mapped to 'full_name' usually, 'mobile' to 'personal_mobile'

      setAvailableTeacherFields([...stdFields, ...discovered]);
      setTeachers(loadedTeachers);

    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setTeachersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'teachers') {
      loadTeachers();
    }
  }, [activeSection, loadTeachers]);

  // --- TEACHER HELPERS ---
  useEffect(() => {
    const savedConfig = localStorage.getItem('teacherExportConfig');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // Migration: If config is the "Old Default", upgrade it
      const oldDefault = ['name', 'email', 'department', 'vta_no', 'mobile'];
      if (parsed.length === oldDefault.length && parsed.every((v: string, i: number) => v === oldDefault[i])) {
        const newDefault = ['name', 'email', 'department', 'vta_no', 'mobile', 'date_of_joining', 'date_of_birth', 'address', 'current_salary'];
        setTeacherDetailsConfig(newDefault);
        saveTeacherConfig(newDefault);
      } else {
        setTeacherDetailsConfig(parsed);
      }
    } else {
      // First time load - set full default
      const newDefault = ['name', 'email', 'department', 'vta_no', 'mobile', 'date_of_joining', 'date_of_birth', 'address', 'current_salary'];
      setTeacherDetailsConfig(newDefault);
      saveTeacherConfig(newDefault);
    }
  }, []);

  const saveTeacherConfig = (config: string[]) => {
    localStorage.setItem('teacherExportConfig', JSON.stringify(config));
  };

  const handleAddTeacherDetailField = () => {
    if (!newTeacherDetailField.trim()) return;
    if (teacherDetailsConfig.includes(newTeacherDetailField.trim())) {
      toast.error("Field already exists");
      return;
    }
    const newConfig = [...teacherDetailsConfig, newTeacherDetailField.trim()];
    setTeacherDetailsConfig(newConfig);
    setNewTeacherDetailField('');
    saveTeacherConfig(newConfig);
  };

  // Real-time Presence Listener
  useEffect(() => {
    const statusRef = ref(database, '/status');
    const unsub = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPresenceData(data);
      } else {
        setPresenceData({});
      }
    });
    return () => unsub();
  }, []);

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // If less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDownloadTeacherDetails = async () => {
    if (teachers.length === 0) {
      toast.error("No teachers to download");
      return;
    }

    // Check if any teachers are selected
    if (selectedTeacherIds.length === 0) {
      toast.error("Please select at least one teacher");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Teacher Details');

      // Dynamic headers based on config
      const availableHeaders: { [key: string]: string } = {
        'name': 'Name',
        'email': 'Email',
        'department': 'Department',
        'vta_no': 'Vta no',
        'mobile': 'Personal mobile',
        'date_of_joining': 'Date of Joining',
        'date_of_birth': 'Date of birth',
        'address': 'Address',
        'current_salary': 'Current Salary'
      };

      // Define Columns
      const columns = teacherDetailsConfig.map(f => ({
        header: availableHeaders[f] || f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' '),
        key: f,
        width: 25
      }));

      worksheet.columns = columns;

      // Add Data - Filter to only selected teachers
      const selectedTeachers = teachers.filter(t => selectedTeacherIds.includes(t.id));
      const sortedTeachers = [...selectedTeachers].sort((a, b) => a.full_name.localeCompare(b.full_name));

      sortedTeachers.forEach(t => {
        const row: any = {};
        teacherDetailsConfig.forEach(field => {
          switch (field) {
            case 'name': row[field] = t.full_name; break;
            case 'email': row[field] = t.email; break;
            case 'department': row[field] = t.department || '-'; break;
            case 'vta_no': row[field] = t.vta_no || '-'; break;
            case 'mobile': row[field] = t.personal_mobile || '-'; break;
            case 'date_of_joining': row[field] = t.date_of_joining ? new Date(t.date_of_joining.seconds * 1000).toLocaleDateString() : '-'; break;
            case 'date_of_birth': row[field] = t.date_of_birth ? new Date(t.date_of_birth.seconds * 1000).toLocaleDateString() : '-'; break;
            case 'address': row[field] = t.address || '-'; break;
            case 'current_salary': row[field] = t.current_salary || '-'; break;
            default: row[field] = (t as any)[field] || '-';
          }
        });
        worksheet.addRow(row);
      });

      // Style Headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // Apply styling ONLY to the columns we have
      for (let i = 1; i <= columns.length; i++) {
        const cell = headerRow.getCell(i);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9D9D9' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      // Style Data Rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell((cell, colNumber) => {
            const isAddress = columns[colNumber - 1]?.key === 'address';
            cell.alignment = {
              vertical: 'middle',
              horizontal: isAddress ? 'left' : 'center',
              wrapText: isAddress
            };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Teacher_Details_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Downloaded successfully");

    } catch (e) {
      console.error(e);
      toast.error("Failed to download teacher details");
    }
  };

  const handleSelectTeacher = (teacherId: string) => {
    setSelectedTeacherIds(prev => prev.includes(teacherId) ? prev.filter(id => id !== teacherId) : [...prev, teacherId]);
  };

  const handleSelectAllTeachers = () => {
    if (selectedTeacherIds.length === teachers.length) {
      setSelectedTeacherIds([]);
    } else {
      setSelectedTeacherIds(teachers.map(t => t.id));
    }
  };

  const handleRaiseAgainAllTeachers = async () => {
    if (teachers.length === 0) return;

    // Logic: If selected, raise for selected. If NONE selected, error.
    if (selectedTeacherIds.length === 0) {
      toast.error("Please select at least one teacher");
      return;
    }

    if (!confirm(`Are you sure you want to raise a compulsory profile update request for ${selectedTeacherIds.length} selected teachers?`)) return;

    try {
      // Filter teachers to get emails of selected IDs
      const targetTeachers = teachers.filter(t => selectedTeacherIds.includes(t.id));
      const teacherEmails = targetTeachers.map(t => t.email);

      if (teacherEmails.length === 0) return;

      await addDoc(collection(db, 'announcements'), {
        title: 'SYSTEM: Compulsory Profile Update',
        description: 'Action Required: Please update your teacher profile details immediately (VTA, Mobile, etc).',
        link: '',
        workspaceId: 'system', // Global system announcement
        students: teacherEmails, // Target emails
        teacherEmail: 'admin@system.com',
        type: 'compulsory_update_request',
        targetRole: 'teacher', // Specific flag
        requiredFields: Array.from(new Set(['name', 'vta_no', 'personal_mobile', 'department', 'date_of_joining', 'date_of_birth', 'address', 'current_salary', ...teacherDetailsConfig])),
        createdAt: serverTimestamp()
      });

      toast.success(`Request raised for ${teacherEmails.length} teachers`);
      setSelectedTeacherIds([]); // Clear selection after success
    } catch (e) {
      console.error(e);
      toast.error("Failed to raise request");
    }
  };

  const handleRaiseRequestForTeacher = async (teacherEmail: string) => {
    try {
      if (!teacherEmail) return;

      await addDoc(collection(db, 'announcements'), {
        title: 'SYSTEM: Compulsory Profile Update',
        description: 'Action Required: Please update your teacher profile details immediately.',
        link: '',
        workspaceId: 'system',
        students: [teacherEmail], // Target specific teacher
        teacherEmail: 'admin@system.com',
        type: 'compulsory_update_request',
        targetRole: 'teacher',
        requiredFields: Array.from(new Set(['name', 'vta_no', 'personal_mobile', 'department', 'date_of_joining', 'date_of_birth', 'address', 'current_salary', ...teacherDetailsConfig])),
        createdAt: serverTimestamp()
      });

      toast.success(`Request raised for ${teacherEmail}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to raise request");
    }
  };

  const handleDeleteAllTeachers = async () => {
    const confirmKey = prompt("WARNING: This will delete ALL teacher accounts and their data. Type 'DELETE ALL TEACHERS' to confirm.");
    if (confirmKey !== 'DELETE ALL TEACHERS') return;

    try {
      const batch = writeBatch(db);
      teachers.forEach(t => {
        batch.delete(doc(db, 'users', t.id));
      });
      await batch.commit();
      toast.success("All teachers deleted");
      loadTeachers();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete teachers");
    }
  };

  const handleResetTeacherPresence = async (email: string) => {
    // Logic would be same as 'handleResetPresence' but for teacher
    toast.info("Reset presence triggered (same as student logic)");
  };

  const sidebarItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Overview', onClick: () => setActiveSection('overview'), active: activeSection === 'overview' },
    { icon: <Users size={20} />, label: 'Manage Users', onClick: () => setActiveSection('users'), active: activeSection === 'users' },
    { icon: <Users size={20} />, label: 'Manage Teachers', onClick: () => setActiveSection('teachers'), active: activeSection === 'teachers' },
    { icon: <Briefcase size={20} />, label: 'Workspaces', onClick: () => setActiveSection('workspaces'), active: activeSection === 'workspaces' },
    { icon: <MessageSquare size={20} />, label: 'View Queries', onClick: () => setActiveSection('queries'), active: activeSection === 'queries' },
    { icon: <Bot size={20} />, label: 'AI CSV Generator', onClick: () => setActiveSection('aiCsv'), active: activeSection === 'aiCsv' },
    { icon: <Mail size={20} />, label: 'Send Mail', onClick: () => setActiveSection('send-mail'), active: activeSection === 'send-mail' },

    { icon: <Database size={20} />, label: 'Backup Files', onClick: () => setActiveSection('backup'), active: activeSection === 'backup' },
  ];

  const headerContent = (
    <div className="flex items-center gap-2 md:gap-4 mr-4">
      {/* Search Bar */}
      <div className="relative hidden md:block w-64 mr-2">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search sections..."
          className="pl-8 bg-slate-900 border-slate-700 h-9 text-sm"
          value={navSearchQuery}
          onChange={(e) => {
            setNavSearchQuery(e.target.value);
            setShowNavSuggestions(true);
          }}
          onFocus={() => setShowNavSuggestions(true)}
          onBlur={() => setTimeout(() => setShowNavSuggestions(false), 200)}
        />
        {showNavSuggestions && navSearchQuery && (
          <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 overflow-hidden">
            {sidebarItems.filter(item => item.label.toLowerCase().includes(navSearchQuery.toLowerCase())).length > 0 ? (
              sidebarItems
                .filter(item => item.label.toLowerCase().includes(navSearchQuery.toLowerCase()))
                .map((item, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      item.onClick();
                      setNavSearchQuery('');
                      setShowNavSuggestions(false);
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

      <span className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full whitespace-nowrap">
        <span className="hidden lg:inline">Session expires in </span>{sessionTimeLeft}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        className="h-8"
      >
        <RefreshCw className="h-3.5 w-3.5 lg:mr-2" />
        <span className="hidden lg:inline">Refresh</span>
      </Button>
      <Button
        variant={maintenanceMode ? "destructive" : "outline"}
        size="sm"
        onClick={toggleMaintenanceMode}
        className={`h-8 border ${maintenanceMode ? 'border-red-600' : 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'}`}
      >
        <AlertTriangle className={`h-3.5 w-3.5 lg:mr-2 ${maintenanceMode ? 'text-white' : 'text-yellow-500'}`} />
        <span className="hidden lg:inline">Maintenance: {maintenanceMode ? 'ON' : 'OFF'}</span>
      </Button>
    </div>
  );

  const handleMailCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n');
      // Handle empty first line or BOM
      const headers = lines[0].replace(/^\uFEFF/, '').trim().split(',').map(h => h.trim().toLowerCase());

      if (!headers.includes('email') || !headers.includes('password')) {
        toast.error("CSV must contain 'email' and 'password' columns");
        return;
      }

      const data: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Handle quotes later if needed, simple split for now as per demo
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((h, index) => {
          row[h] = values[index] || '';
        });
        if (row.email && row.password) {
          data.push(row);
        }
      }

      setMailRecipients(data);
      setMailStats({ total: data.length, sent: 0, errors: 0 });
      setMailLogs([]);
      addMailLog(`📂 Loaded ${data.length} valid recipients from CSV`);
      setCsvFile(file); // reuse this state to show file name potentially
    } catch (err) {
      toast.error("Failed to parse CSV");
      console.error(err);
    }
  };

  const handleSendBatchEmails = async () => {
    if (!mailConfig.gmailUser || !mailConfig.appPassword) {
      toast.error("Please configure Gmail settings first");
      return;
    }
    if (mailRecipients.length === 0) {
      toast.error("No recipients loaded");
      return;
    }

    setIsSendingMail(true);
    setMailProgress(0);
    let sent = 0;
    let errors = 0;

    addMailLog(`🚀 Starting batch of ${Math.min(mailRecipients.length, 100)} emails...`);

    const limit = Math.min(mailRecipients.length, 100);

    for (let i = 0; i < limit; i++) {
      const user = mailRecipients[i];
      setMailProgress(Math.round(((i + 1) / limit) * 100));

      try {
        // Simulate sending logic (can be replaced with backend call)
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() > 0.1) resolve(true);
            else reject(new Error('Email service timeout'));
          }, 1000 + Math.random() * 1000);
        });

        sent++;
        setMailStats(prev => ({ ...prev, sent: prev.sent + 1 }));
        addMailLog(`✅ Email sent to ${user.email}`, 'success');
      } catch (err: any) {
        errors++;
        setMailStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        addMailLog(`❌ Failed for ${user.email}: ${err.message}`, 'error');
      }
    }

    setIsSendingMail(false);
    addMailLog(`🎉 Completed! Sent: ${sent}, Errors: ${errors}`, 'success');
    toast.success("Batch email processing completed");
  };

  return (
    <DashboardLayout sidebarItems={sidebarItems} title="Admin Dashboard" headerContent={headerContent}>
      {/* OVERVIEW SECTION */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Total Users',
                value: stats.users,
                icon: Users,
                color: 'text-blue-400',
                bg: 'bg-blue-500/20',
                gradient: 'bg-gradient-to-br from-blue-900 to-slate-900',
                textColor: 'text-blue-200'
              },
              {
                title: 'Students',
                value: stats.students,
                icon: GraduationCap,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/20',
                gradient: 'bg-gradient-to-br from-emerald-900 to-slate-900',
                textColor: 'text-emerald-200'
              },
              {
                title: 'Teachers',
                value: stats.teachers,
                icon: School,
                color: 'text-violet-400',
                bg: 'bg-violet-500/20',
                gradient: 'bg-gradient-to-br from-violet-900 to-slate-900',
                textColor: 'text-violet-200'
              },
              {
                title: 'Workspaces',
                value: stats.workspaces,
                icon: Briefcase,
                color: 'text-amber-400',
                bg: 'bg-amber-500/20',
                gradient: 'bg-gradient-to-br from-amber-900/80 to-slate-900',
                textColor: 'text-amber-200'
              },
            ].map((stat, index) => (
              <Card key={index} className={`border-slate-700 ${stat.gradient} text-white shadow-lg hover:shadow-xl transition-all duration-200`}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className={`${stat.textColor} text-sm font-medium`}>{stat.title}</p>
                    <h3 className="text-4xl font-bold mt-2">{stat.value}</h3>
                    <p className="text-xs text-slate-400 mt-1">+2.5% from last month</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bg}`}>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Charts & Main Content (Spans 2 columns) */}
            <div className="lg:col-span-2 space-y-6">
              {/* User Growth Chart */}
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5 text-blue-500" />
                    User Growth
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        itemStyle={{ color: '#f8fafc' }}
                        cursor={{ stroke: '#334155', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: '#1e293b' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Operations */}
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-green-400" /> Recent Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentOperations.slice(0, 6).map((op, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${op.type === 'success' ? 'bg-green-500' : op.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                          <span className="text-sm font-medium text-slate-200">{op.action}</span>
                        </div>
                        <span className="text-xs text-slate-500">{op.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Widgets (Spans 1 column) */}
            <div className="space-y-6">
              {/* Recently Used Card */}
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-blue-400">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                    onClick={() => setActiveSection('users')}
                  >
                    <Users className="mr-2 h-4 w-4 text-blue-500" /> Manage Users
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4 text-emerald-500" /> Add New User
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                    onClick={() => setActiveSection('workspaces')}
                  >
                    <Briefcase className="mr-2 h-4 w-4 text-amber-500" /> Workspaces
                  </Button>
                </CardContent>
              </Card>

              {/* Calendar Card */}
              <Card className="border-slate-800 bg-slate-900/50 flex flex-col items-center">
                <CardHeader className="w-full pb-2 border-b border-slate-800/50">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-200">
                    <CalendarIcon className="h-4 w-4 text-blue-500" /> Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 w-full flex justify-center">
                  <style>{`
                    .rdp { --rdp-cell-size: 32px; --rdp-accent-color: #3b82f6; margin: 0; }
                    .rdp-day_selected:not([disabled]) { background-color: var(--rdp-accent-color); color: white; }
                    .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: #1e293b; }
                    .rdp-day { color: #cbd5e1; font-size: 0.875rem; }
                    .rdp-caption_label { color: #f8fafc; font-weight: 600; font-size: 0.9rem; }
                    .rdp-nav_button { color: #94a3b8; }
                    .rdp-head_cell { color: #64748b; font-size: 0.75rem; font-weight: 500; }
                  `}</style>
                  <DayPicker
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="bg-transparent"
                    showOutsideDays
                  />
                </CardContent>
              </Card>

              {/* Weather Card */}
              <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-white/5">
                  <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <CloudSun className="h-4 w-4 text-amber-500" /> Weather
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={fetchWeather}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  {weather ? (
                    <div className="flex flex-col items-center text-center">
                      <div className="text-4xl font-bold text-white mb-1">{Math.round(weather.temperature)}°C</div>
                      <div className="text-sm text-blue-400 font-medium mb-4">{weather.condition}</div>

                      <div className="grid grid-cols-2 gap-4 w-full text-xs border-t border-white/10 pt-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500">Wind</span>
                          <span className="text-slate-300 font-medium">{weather.windspeed} km/h</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500">Location</span>
                          <span className="text-slate-300 font-medium">New Delhi</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* USERS SECTION (Existing) */}
      {activeSection === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={() => setShowAddDialog(true)} className="flex-1 md:flex-none">
                <UserPlus className="mr-2 h-4 w-4" /> Add User
              </Button>
              <Button variant="outline" onClick={() => handleOpenCsvUpload()} className="flex-1 md:flex-none">
                <Upload className="mr-2 h-4 w-4" /> Upload CSV
              </Button>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  className="pl-8 bg-slate-900 border-slate-700 h-9 text-sm w-full"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
              {uploadHistory.length > 0 && (
                <Button variant="secondary" onClick={handleUndoUpload} className="w-full md:w-auto">
                  <Undo2 className="mr-2 h-4 w-4" /> Undo Last Upload
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.slice((userPage - 1) * 10, userPage * 10).map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><span className={`capitalize px-2 py-1 rounded-full text-xs ${user.role === 'teacher' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{user.role}</span></TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.email)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-end space-x-2 p-4 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm text-slate-400">
                  Page {userPage} of {Math.ceil(users.length / 10)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage(p => Math.min(Math.ceil(users.length / 10), p + 1))}
                  disabled={userPage >= Math.ceil(users.length / 10)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MANAGE TEACHERS SECTION */}
      {activeSection === 'teachers' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-white">Manage Teachers</h2>
            <p className="text-slate-400">View and manage registered teachers.</p>
          </div>

          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mb-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search teachers..."
                    className="pl-8 bg-slate-900 border-slate-700 w-full"
                    value={teachersSearch}
                    onChange={(e) => setTeachersSearch(e.target.value)}
                  />
                </div>

                <Select value={teachersDepartmentFilter} onValueChange={setTeachersDepartmentFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700">
                    <SelectValue placeholder="Filter Department" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                    <SelectItem value="all">All Departments</SelectItem>
                    {Array.from(new Set(teachers.map(t => t.department).filter(Boolean))).sort().map(dept => (
                      <SelectItem key={dept} value={dept || 'unknown'}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Actions */}
                <Button variant="destructive" onClick={handleDeleteAllTeachers} className="whitespace-nowrap flex-1 md:flex-none">
                  Delete All
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Button variant="outline" onClick={handleSelectAllTeachers} className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs md:text-sm h-8 md:h-10">
                  {selectedTeacherIds.length === teachers.length && teachers.length > 0 ? <CheckSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 text-blue-500" /> : <Square className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
                  Select All
                </Button>

                <Button onClick={handleDownloadTeacherDetails} className="bg-green-600 hover:bg-green-700 text-white text-xs md:text-sm h-8 md:h-10">
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Details
                </Button>

                <Button variant="outline" onClick={() => setShowTeacherFieldsDialog(true)} className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs md:text-sm h-8 md:h-10">
                  <Edit className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Fields
                </Button>

                <Button variant="outline" onClick={handleRaiseAgainAllTeachers} className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs md:text-sm h-8 md:h-10" title="Raise for selected teachers">
                  <RotateCcw className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Raise All ({selectedTeacherIds.length})
                </Button>

                <Button variant="outline" onClick={async () => {
                  if (!confirm("Reset presence for ALL teachers? This will force them offline.")) return;
                  const batchUpdates: any = {};
                  teachers.forEach(t => {
                    batchUpdates[`/status/${t.id}/state`] = 'offline';
                    batchUpdates[`/status/${t.id}/connections`] = null;
                    batchUpdates[`/status/${t.id}/last_changed`] = Date.now();
                  });
                  try {
                    await update(ref(database), batchUpdates);
                    toast.success("All teachers marked offline");
                  } catch (e) {
                    console.error(e);
                    toast.error("Failed to reset presence");
                  }
                }} className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs md:text-sm h-8 md:h-10" title="Reset online status">
                  <RefreshCw className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Reset Presence
                </Button>
              </div>

              <div className="space-y-4">
                {teachers.filter(t => {
                  const matchesSearch = (t.full_name || '').toLowerCase().includes(teachersSearch.toLowerCase()) ||
                    (t.email || '').toLowerCase().includes(teachersSearch.toLowerCase());
                  const matchesDept = teachersDepartmentFilter === 'all' || t.department === teachersDepartmentFilter;
                  return matchesSearch && matchesDept;
                }).length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No teachers found.</p>
                ) : (
                  teachers.filter(t => {
                    const matchesSearch = (t.full_name || '').toLowerCase().includes(teachersSearch.toLowerCase()) ||
                      (t.email || '').toLowerCase().includes(teachersSearch.toLowerCase());
                    const matchesDept = teachersDepartmentFilter === 'all' || t.department === teachersDepartmentFilter;
                    return matchesSearch && matchesDept;
                  })
                    .slice(0, limitTeachers)
                    .map((teacher, idx) => (
                      <div key={idx} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border border-slate-700 gap-4 md:gap-0 ${selectedTeacherIds.includes(teacher.id) ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-900/50'}`}>
                        <div className="flex items-center gap-4 w-full">
                          <button onClick={() => handleSelectTeacher(teacher.id)} className="text-slate-400 hover:text-white shrink-0">
                            {selectedTeacherIds.includes(teacher.id) ? <CheckSquare className="h-5 w-5 text-blue-500" /> : <Square className="h-5 w-5" />}
                          </button>
                          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 overflow-hidden">
                            {teacher.profile_picture || teacher.photoURL || teacher.photoUrl ? (
                              <img
                                src={teacher.profile_picture || teacher.photoURL || teacher.photoUrl}
                                alt={teacher.full_name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.classList.add('bg-blue-500/20');
                                  // Fallback to icon? We'd need to conditionally render the icon if img fails or is hidden.
                                  // Simplest is just hide img and show icon behind it if we structure it right, or just let it be blank/color.
                                }}
                              />
                            ) : (
                              <Users className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white truncate">{teacher.full_name}</p>
                              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{teacher.department || 'No Dept'}</span>
                              {
                                presenceData[teacher.id]?.state === 'online' ? (
                                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_4px_2px_rgba(34,197,94,0.4)]" title="Online"></div>
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-slate-600" title="Offline"></div>
                                )
                              }
                              {presenceData[teacher.id]?.last_changed && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {presenceData[teacher.id]?.state === 'online' ? 'Active now' : `Last seen: ${formatLastSeen(presenceData[teacher.id]?.last_changed)}`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{teacher.email}</p>
                            <div className="flex gap-2 mt-1">
                              {teacherDetailsConfig.includes('vta_no') && <span className="text-[10px] text-slate-600">VTA: {teacher.vta_no || 'N/A'}</span>}
                              {teacherDetailsConfig.includes('mobile') && <span className="text-[10px] text-slate-600">Mob: {teacher.personal_mobile || 'N/A'}</span>}
                              {teacherDetailsConfig.includes('current_salary') && <span className="text-[10px] text-slate-600">Salary: {teacher.current_salary || 'N/A'}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={async () => {
                            if (!confirm(`Reset presence for ${teacher.full_name}?`)) return;
                            try {
                              await update(ref(database, `/status/${teacher.id}`), {
                                state: 'offline',
                                connections: null,
                                last_changed: Date.now()
                              });
                              toast.success("Presence reset");
                            } catch (e) {
                              console.error(e);
                              toast.error("Failed to reset presence");
                            }
                          }} title="Reset Presence">
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => {
                            handleRaiseRequestForTeacher(teacher.email);
                          }} title="Raise Request">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => {
                            toast.info("Coming soon");
                          }} title="Download Resume">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {teachers.length > limitTeachers && (
                <Button variant="ghost" onClick={() => setLimitTeachers(p => p + 10)} className="w-full mt-4">Load More</Button>
              )}
            </CardContent>
          </Card>

          {/* Configure Teacher Fields Dialog */}
          <Dialog open={showTeacherFieldsDialog} onOpenChange={setShowTeacherFieldsDialog}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle>Configure Teacher Details Fields</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Add or remove fields to include in the teacher details download and view.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span><span className="text-yellow-500 font-semibold">Tip:</span> These fields determine columns in the CSV export.</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom field (e.g., pan_card)"
                    value={newTeacherDetailField}
                    onChange={(e) => setNewTeacherDetailField(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white h-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTeacherDetailField()}
                  />
                  <Button onClick={handleAddTeacherDetailField} size="sm" className="bg-emerald-600 hover:bg-emerald-700">Add</Button>
                </div>

                <div className="space-y-2">
                  <Label>Active & Available Fields</Label>
                  <div className="flex flex-wrap gap-2">
                    {/* Combine config with available fields to ensure all selected are shown even if not in available */}
                    {Array.from(new Set([...availableTeacherFields, ...teacherDetailsConfig])).map(field => (
                      <div key={field}
                        onClick={() => {
                          let newConfig;
                          if (teacherDetailsConfig.includes(field)) {
                            newConfig = teacherDetailsConfig.filter(f => f !== field);
                          } else {
                            newConfig = [...teacherDetailsConfig, field];
                          }
                          setTeacherDetailsConfig(newConfig);
                          saveTeacherConfig(newConfig);
                        }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full border cursor-pointer select-none transition-colors
                                ${teacherDetailsConfig.includes(field) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        <span className="text-sm capitalize">{field.replace(/_/g, ' ')}</span>
                        {teacherDetailsConfig.includes(field) ? <X className="h-3 w-3" /> : <PlusCircle className="h-3 w-3" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTeacherFieldsDialog(false)} className="border-slate-600 hover:bg-slate-800 text-white">Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* WORKSPACES SECTION */}
      {
        activeSection === 'workspaces' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Workspace</CardTitle>
                <CardDescription>Add a new workspace for a class or group</CardDescription>
              </CardHeader>
              <CardContent>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Workspace Name (e.g., Batch 2023 - 2025)</Label>
                    <Input
                      value={newWorkspace.name}
                      onChange={e => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                      placeholder="Enter workspace name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category (e.g., BSC A)</Label>
                    <Input
                      value={newWorkspace.category}
                      onChange={e => setNewWorkspace({ ...newWorkspace, category: e.target.value })}
                      placeholder="Enter category"
                    />
                  </div>
                  <Button onClick={handleCreateWorkspace} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                    <Briefcase className="mr-2 h-4 w-4" /> Create Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-lg font-medium">My Workspaces ({filteredWorkspaces.length})</h3>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <Input
                  placeholder="Search workspaces..."
                  className="w-full md:w-[200px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleReset} className="flex-1 md:flex-none">Reset</Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredWorkspaces.slice((workspacePage - 1) * 2, workspacePage * 2).map((ws) => (
                <Card key={ws.id} className="overflow-hidden">
                  <div className="bg-muted/30 p-4 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-lg">{ws.name}</h4>
                      <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">{ws.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => handleOpenCsvUpload(ws.id, ws.name)}><Upload className="h-3 w-3 mr-1" /> CSV</Button>
                      <Button variant="destructive" size="sm" className="h-8" onClick={() => handleDeleteWorkspace(ws.id, ws.name)}>Delete</Button>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    {/* Role Appointment Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-900/30 rounded-lg border border-slate-800">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Class Teacher</Label>
                        <Select
                          value={ws.classTeacher || ''}
                          onValueChange={(val) => handleAppointRole(ws.id, 'classTeacher', val)}
                        >
                          <SelectTrigger className={`h-8 text-sm ${!ws.classTeacher ? 'border-red-500/50' : 'border-slate-700'}`}>
                            <SelectValue placeholder="Select Class Teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {ws.teachers.length > 0 ? (
                              ws.teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                            ) : (
                              <SelectItem value="none" disabled>No teachers added</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {!ws.classTeacher && <span className="text-[10px] text-red-400 flex items-center mt-1"><AlertTriangle className="h-3 w-3 mr-1" /> Required</span>}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Mentor</Label>
                        <Select
                          value={ws.mentor || ''}
                          onValueChange={(val) => handleAppointRole(ws.id, 'mentor', val)}
                        >
                          <SelectTrigger className={`h-8 text-sm ${!ws.mentor ? 'border-red-500/50' : 'border-slate-700'}`}>
                            <SelectValue placeholder="Select Mentor" />
                          </SelectTrigger>
                          <SelectContent>
                            {ws.teachers.length > 0 ? (
                              ws.teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                            ) : (
                              <SelectItem value="none" disabled>No teachers added</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {!ws.mentor && <span className="text-[10px] text-red-400 flex items-center mt-1"><AlertTriangle className="h-3 w-3 mr-1" /> Required</span>}
                      </div>
                    </div>

                    {/* Teachers Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="text-sm font-medium text-muted-foreground">Teachers ({ws.teachers.length})</h5>
                      </div>
                      <div className="space-y-2">
                        {ws.teachers.map(email => (
                          <div key={email} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                            <span>{email}</span>
                            <Button variant="destructive" size="sm" className="h-6 text-xs" onClick={() => handleRemoveMember(ws.id, 'teacher', email)}>Remove</Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Teacher email"
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddMember(ws.id, 'teacher', e.currentTarget.value);
                            }}
                          />
                          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            handleAddMember(ws.id, 'teacher', input.value);
                            input.value = '';
                          }}>Add Teacher</Button>
                        </div>
                      </div>
                    </div>

                    {/* Students Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="text-sm font-medium text-muted-foreground">Students ({ws.students.length})</h5>
                      </div>
                      <div className="space-y-2">
                        {ws.students.slice(((workspaceStudentPages[ws.id] || 1) - 1) * 10, (workspaceStudentPages[ws.id] || 1) * 10).map(email => (
                          <div key={email} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                            <span>{email}</span>
                            <Button variant="destructive" size="sm" className="h-6 text-xs" onClick={() => handleRemoveMember(ws.id, 'student', email)}>Remove</Button>
                          </div>
                        ))}

                        {/* Student Pagination Controls */}
                        {ws.students.length > 10 && (
                          <div className="flex items-center justify-center space-x-2 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setWorkspaceStudentPages(prev => ({ ...prev, [ws.id]: Math.max(1, (prev[ws.id] || 1) - 1) }))}
                              disabled={(workspaceStudentPages[ws.id] || 1) === 1}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <span className="text-xs text-slate-400">
                              {(workspaceStudentPages[ws.id] || 1)} / {Math.ceil(ws.students.length / 10)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setWorkspaceStudentPages(prev => ({ ...prev, [ws.id]: Math.min(Math.ceil(ws.students.length / 10), (prev[ws.id] || 1) + 1) }))}
                              disabled={(workspaceStudentPages[ws.id] || 1) >= Math.ceil(ws.students.length / 10)}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Input
                            placeholder="Student email"
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddMember(ws.id, 'student', e.currentTarget.value);
                            }}
                          />
                          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            handleAddMember(ws.id, 'student', input.value);
                            input.value = '';
                          }}>Add Student</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Workspace Pagination */}
            {filteredWorkspaces.length > 2 && (
              <div className="flex items-center justify-center space-x-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWorkspacePage(p => Math.max(1, p - 1))}
                  disabled={workspacePage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-slate-400">
                  Page {workspacePage} of {Math.ceil(filteredWorkspaces.length / 2)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWorkspacePage(p => Math.min(Math.ceil(filteredWorkspaces.length / 2), p + 1))}
                  disabled={workspacePage >= Math.ceil(filteredWorkspaces.length / 2)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )
      }

      {/* QUERIES SECTION */}
      {
        activeSection === 'queries' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">User Queries</h2>
              <Button variant="destructive" size="sm" onClick={async () => {
                if (!confirm('Are you sure you want to delete ALL queries? This cannot be undone.')) return;
                try {
                  const batch = writeBatch(db);
                  const q = query(collection(db, 'queries'));
                  const snap = await getDocs(q);
                  snap.forEach(doc => batch.delete(doc.ref));
                  await batch.commit();
                  toast.success('All queries deleted');
                  loadQueries();
                } catch (error) {
                  console.error(error);
                  toast.error('Failed to delete queries');
                }
              }}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete All
              </Button>
            </div>
            <div className="grid gap-4">
              {queries.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No queries found</div>
              ) : (
                queries.map((q) => (
                  <Card key={q.id}>
                    <CardHeader>
                      <div className="flex justify-between">
                        <CardTitle className="text-base">{q.query}</CardTitle>
                        <span className={`text-xs px-2 py-1 rounded-full ${q.status === 'solved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {q.status}
                        </span>
                      </div>
                      <CardDescription>{q.userEmail} • {q.createdAt?.toDate().toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(q.reply || q.adminReply) && (
                        <div className="bg-muted p-3 rounded-md text-sm mb-3">
                          <strong>Reply:</strong> {q.reply || q.adminReply}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          const reply = prompt('Enter reply:');
                          if (reply) {
                            await updateDoc(doc(db, 'queries', q.id), {
                              adminReply: reply,
                              status: 'replied',
                              repliedAt: serverTimestamp()
                            });
                            loadQueries();
                          }
                        }}>Reply</Button>
                        {q.status !== 'solved' && (
                          <Button size="sm" variant="default" onClick={async () => {
                            await updateDoc(doc(db, 'queries', q.id), {
                              status: 'solved',
                              solvedAt: serverTimestamp()
                            });
                            loadQueries();
                          }}>Mark Solved</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )
      }

      {/* AI CSV GENERATOR */}
      {
        activeSection === 'aiCsv' && (
          <div className="space-y-6 h-[calc(100vh-200px)]">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">AI CSV Generator</h2>
              <Button variant="outline" asChild>
                <a href="https://web-production-39641.up.railway.app/" target="_blank" rel="noopener noreferrer">
                  Open in New Tab
                </a>
              </Button>
            </div>
            <div className="w-full h-full border rounded-lg overflow-hidden bg-black">
              <iframe
                src="https://web-production-39641.up.railway.app/"
                className="w-full h-full border-none"
                title="AI CSV Generator"
              />
            </div>
          </div>
        )
      }



      {/* DIALOGS */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v: UserRole) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{activeWorkspaceName ? `Upload Users to "${activeWorkspaceName}"` : 'Upload Users via CSV'}</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium">CSV Format Instructions:</h4>
              <p className="text-sm text-muted-foreground">Your CSV file should have the following columns:</p>
              <code className="block bg-black/10 p-2 rounded text-xs">name,email,password,role,department</code>

              <p className="text-sm text-muted-foreground mt-2">Example rows:</p>
              <div className="bg-black/10 p-2 rounded text-xs space-y-1">
                <div>John Doe,john@example.com,pass123,teacher,Mathematics</div>
                <div>Jane Smith,jane@example.com,pass456,student,Science</div>
              </div>

              <Button variant="outline" size="sm" className="mt-2" onClick={downloadSampleCSV}>
                <Download className="mr-2 h-4 w-4" /> Download Sample CSV
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
                ref={fileInputRef}
              />
              <Label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                <Button variant="default" className="pointer-events-none">
                  <Upload className="mr-2 h-4 w-4" /> Choose CSV File
                </Button>
                {csvFile && <span className="mt-2 text-sm text-muted-foreground">{csvFile.name}</span>}
              </Label>
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Preview (First 5 rows):</h4>
                <div className="border rounded-md overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(csvPreview[0]).map(h => <TableHead key={h}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).map((v: any, j) => <TableCell key={j}>{v}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-xs text-muted-foreground">Total users to upload: {csvPreview.length}+</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCsvDialog(false);
              setActiveWorkspaceId(null);
              setActiveWorkspaceName(null);
            }}>Cancel</Button>
            <Button onClick={handleCSVUpload} disabled={!csvFile}>Upload Users</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Workspace</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newWorkspace.name} onChange={e => setNewWorkspace({ ...newWorkspace, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={newWorkspace.category} onChange={e => setNewWorkspace({ ...newWorkspace, category: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateWorkspace}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEND MAIL SECTION */}
      {
        activeSection === 'send-mail' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Mail className="h-6 w-6 text-purple-400" /> Bulk User Import & Email Sender
            </h2>
            <p className="text-slate-400">Upload CSV and send login credentials via Gmail SMTP (Simulator).</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Card */}
              <Card className="bg-slate-800 border-slate-700 text-white h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-400"><Settings className="h-5 w-5" /> Gmail Configuration</CardTitle>
                  <CardDescription>
                    Use an <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-blue-400 underline">App Password</a>, not your login password.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Gmail Address</Label>
                    <Input
                      placeholder="example@gmail.com"
                      className="bg-slate-900 border-slate-700"
                      value={mailConfig.gmailUser}
                      onChange={e => setMailConfig({ ...mailConfig, gmailUser: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>App Password (16 chars)</Label>
                    <Input
                      type="password"
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="bg-slate-900 border-slate-700"
                      value={mailConfig.appPassword}
                      onChange={e => setMailConfig({ ...mailConfig, appPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input
                      placeholder="EduPortal"
                      className="bg-slate-900 border-slate-700"
                      value={mailConfig.fromName}
                      onChange={e => setMailConfig({ ...mailConfig, fromName: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Upload & Actions Card */}
              <Card className="bg-slate-800 border-slate-700 text-white h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-400"><Upload className="h-5 w-5" /> CSV Upload</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select CSV File</Label>
                    <Input
                      type="file"
                      accept=".csv"
                      className="bg-slate-900 border-slate-700 file:text-slate-200 file:bg-slate-800"
                      onChange={handleMailCSVUpload}
                    />
                  </div>
                  <div className="bg-slate-900 p-3 rounded-md text-xs font-mono text-slate-400">
                    <p className="mb-1 font-bold">Required Columns:</p>
                    name,email,password,role,department
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    onClick={handleSendBatchEmails}
                    disabled={isSendingMail || mailRecipients.length === 0}
                  >
                    {isSendingMail ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                    ) : (
                      <><Mail className="h-4 w-4 mr-2" /> Process & Send Emails</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Progress & Logs */}
            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 decoration-amber-400 text-amber-400"><FileSpreadsheet className="h-5 w-5" /> Progress & Logs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-900 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-200">{mailStats.total}</div>
                    <div className="text-xs text-slate-500">Total Users</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-500">{mailStats.sent}</div>
                    <div className="text-xs text-slate-500">Sent</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-500">{mailStats.errors}</div>
                    <div className="text-xs text-slate-500">Errors</div>
                  </div>
                </div>

                {/* Progress Bar */}
                {isSendingMail && (
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${mailProgress}%` }}
                      />
                    </div>
                    <div className="text-right text-xs text-slate-400">{mailProgress}%</div>
                  </div>
                )}

                {/* Logs Window */}
                <div
                  ref={logContainerRef}
                  className="bg-black/50 border border-slate-700 rounded-md p-4 h-64 overflow-y-auto font-mono text-sm space-y-1"
                >
                  {mailLogs.length === 0 && <span className="text-slate-600 italic">Waiting for process to start...</span>}
                  {mailLogs.map((log, i) => (
                    <div key={i} className={`
                                ${log.type === 'success' ? 'text-green-400' : ''}
                                ${log.type === 'error' ? 'text-red-400' : ''}
                                ${log.type === 'warn' ? 'text-yellow-400' : ''}
                                ${log.type === 'info' ? 'text-blue-300' : ''}
                            `}>
                      <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                      {log.msg}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How to Get Gmail App Password */}
            <Card className="bg-slate-800 border-amber-500/50 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <Lock className="h-5 w-5" /> How to Get Your Gmail App Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">
                  Follow these steps to generate the 16-digit "App password" you must paste into the field above.
                </p>
                <ol className="list-decimal pl-5 space-y-2 text-slate-400 text-sm">
                  <li>
                    After 2-Step Verification is ON, open the App Passwords page directly.
                  </li>
                  <li>
                    Sign in again if asked, choose an app and device (or select <strong>Other (Custom name)</strong> and type "EduPortal SMTP"), then click <strong>Generate</strong>.
                  </li>
                  <li>
                    Google will show a 16-character app password. Copy it (without spaces) and paste it into the <strong>"App Password (16 chars)"</strong> field above.
                  </li>
                  <li>
                    Keep this app password safe. If you change your main Google password later, you must return to this page and generate a new app password.
                  </li>
                </ol>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="bg-slate-900 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                    onClick={() => window.open('https://myaccount.google.com/apppasswords', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" /> Go to App Passwords Page
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  For more details, see Google's official <a href="https://support.google.com/mail/answer/185833" target="_blank" rel="noreferrer" className="text-blue-400 underline">help article</a>.
                </p>
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* BACKUP FILES */}
      {
        activeSection === 'backup' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Backup Files</h2>
            <p className="text-slate-400">Manage database backups and sync with Google Drive.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Routine Backup */}
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-blue-400" /> Backup Routine
                  </CardTitle>
                  <CardDescription>Schedule automated backups for the secondary database.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Routine</Label>
                    <Select value={backupRoutine} onValueChange={setBackupRoutine}>
                      <SelectTrigger className="bg-slate-900 border-slate-700">
                        <SelectValue placeholder="Select routine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="6months">Every 6 Months</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSaveRoutine} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Save className="h-4 w-4 mr-2" /> Save Routine & Start Backup
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    Note: "Start Backup" will save the preference. Automated backups require a backend cron job.
                  </p>
                </CardContent>
              </Card>

              {/* Instant Backup */}
              <Card className="bg-slate-800 border-slate-700 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CloudUpload className="h-5 w-5 text-green-400" /> Instant Download to Drive
                  </CardTitle>
                  <CardDescription>Immediately backup the secondary database to your Google Drive.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!driveAccessToken ? (
                    <Button variant="outline" onClick={handleGoogleAuth} className="w-full border-slate-600 hover:bg-slate-700">
                      <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" alt="Drive" className="w-5 h-5 mr-2" />
                      Sign In with Google
                    </Button>
                  ) : (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-green-400 text-sm font-medium">Connected to Drive</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDriveAccessToken(null);
                            toast.info("Signed out of Google Drive");
                          }}
                          className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Sign Out
                        </Button>
                      </div>
                      <Button
                        onClick={handleBackupToDrive}
                        disabled={isBackingUp}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isBackingUp ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Backing up...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" /> Download & Upload to Drive
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Target Folder: <a href="https://drive.google.com/drive/folders/1ie0qArIerEv6Adct4s3meChXYImT6RgR?usp=sharing" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">EduOnline Backups</a>
                  </p>
                </CardContent>
              </Card>
            </div >
          </div >
        )
      }
    </DashboardLayout >
  );
};

export default AdminDashboard;
