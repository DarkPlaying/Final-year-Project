import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Search, Download, Save, Loader2, Filter, ClipboardList, ScanFace, Trash2, Eye, ChevronLeft, ChevronRight, MapPin, Navigation, Locate } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, setDoc, doc, Timestamp, writeBatch, deleteField, serverTimestamp } from 'firebase/firestore';
import { TeacherAttendanceHistoryDialog } from './TeacherAttendanceHistoryDialog';
import { AdminOverallAttendanceDialog } from './AdminOverallAttendanceDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet + React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function MapClickHandler({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
    useMapEvents({
        click: onClick,
    });
    return null;
}

// Helper component to recenter map when coords change
function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo([lat, lng], zoom);
    }, [lat, lng, zoom, map]);
    return null;
}

// Draggable Marker Component
function DraggableMarker({ pos, onDragEnd }: { pos: [number, number], onDragEnd: (lat: number, lng: number) => void }) {
    const markerRef = useRef<any>(null);
    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const { lat, lng } = marker.getLatLng();
                    onDragEnd(lat, lng);
                }
            },
        }),
        [onDragEnd]
    );

    return <Marker draggable={true} eventHandlers={eventHandlers} position={pos} ref={markerRef} />;
}

interface Teacher {
    id: string;
    name: string;
    email: string;
    department: string;
}

interface AttendanceRecord {
    status: 'P' | 'A' | 'HL';
    remarks?: string;
}

export const AdminAttendanceManager = () => {
    const [date, setDate] = useState<Date>(new Date());
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedTeacherForHistory, setSelectedTeacherForHistory] = useState<Teacher | null>(null);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [overallAttendanceOpen, setOverallAttendanceOpen] = useState(false);
    const [showLocationSettings, setShowLocationSettings] = useState(false);
    const [locationConfig, setLocationConfig] = useState({
        lat: 0,
        lng: 0,
        radius: 100, // Default 100 meters
        isEnabled: false
    });
    const [mapZoom, setMapZoom] = useState(13); // New state for map zoom

    useEffect(() => {
        const fetchLocationSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'attendance'));
                if (docSnap.exists()) {
                    setLocationConfig(docSnap.data() as any);
                }
            } catch (error) {
                console.error("Error fetching location settings:", error);
            }
        };
        fetchLocationSettings();
    }, []);

    const saveLocationSettings = async () => {
        try {
            setSaving(true);
            await setDoc(doc(db, 'settings', 'attendance'), {
                ...locationConfig,
                updatedAt: serverTimestamp()
            });
            toast.success("Location settings saved successfully");
            setShowLocationSettings(false);
        } catch (error) {
            console.error("Error saving location settings:", error);
            toast.error("Failed to save location settings");
        } finally {
            setSaving(false);
        }
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        toast.loading("Detecting location...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setLocationConfig(prev => ({
                    ...prev,
                    lat: latitude,
                    lng: longitude
                }));

                // Adjust zoom based on accuracy
                if (accuracy > 2000) {
                    setMapZoom(11); // Zoom out for city view if accuracy is low
                    toast.dismiss();
                    toast.warning(`Low GPS Accuracy (${Math.round(accuracy / 1000)}km). Please SEARCH for your exact address above or DRAG the marker.`);
                } else {
                    setMapZoom(15); // Zoom in for street view
                    toast.dismiss();
                    toast.success(`Location detected (Accuracy: ${Math.round(accuracy)}m).`);
                }
            },
            (error) => {
                toast.dismiss();
                toast.error("Failed to detect location: " + error.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSearch = (query: string) => {
        if (!query) return;

        // Check for Google Maps URL or Lat,Lng format
        const googleMapsUrlRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const latLngRegex = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/;

        const urlMatch = query.match(googleMapsUrlRegex);
        const latLngMatch = query.match(latLngRegex);

        if (urlMatch) {
            const lat = parseFloat(urlMatch[1]);
            const lng = parseFloat(urlMatch[2]);
            setLocationConfig(prev => ({ ...prev, lat, lng }));
            setMapZoom(17);
            toast.success("Location extracted from URL");
        } else if (latLngMatch) {
            const lat = parseFloat(latLngMatch[1]);
            const lng = parseFloat(latLngMatch[2]);
            setLocationConfig(prev => ({ ...prev, lat, lng }));
            setMapZoom(17);
            toast.success("Location set from coordinates");
        } else {
            toast.loading("Searching location...");
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    toast.dismiss();
                    if (data && data.length > 0) {
                        const { lat, lon } = data[0];
                        setLocationConfig(prev => ({
                            ...prev,
                            lat: parseFloat(lat),
                            lng: parseFloat(lon)
                        }));
                        setMapZoom(16);
                        toast.success(`Found: ${data[0].display_name}`);
                    } else {
                        toast.error("Location not found on OpenStreetMap", {
                            action: {
                                label: 'Find on Google Maps',
                                onClick: () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
                            },
                            description: "Click above to find, then copy the URL & paste it here.",
                            duration: 8000
                        });
                    }
                })
                .catch(err => {
                    toast.dismiss();
                    toast.error("Search failed");
                    console.error(err);
                });
        }
    };
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    // Load Teachers
    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
                const snapshot = await getDocs(q);
                const teacherList: Teacher[] = [];
                const depts = new Set<string>();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    teacherList.push({
                        id: doc.id,
                        name: data.name || data.full_name || 'Unknown',
                        email: data.email,
                        department: data.department || 'General'
                    });
                    if (data.department) depts.add(data.department);
                });

                setTeachers(teacherList);
                setDepartments(Array.from(depts));
            } catch (error) {
                console.error("Error fetching teachers:", error);
                toast.error("Failed to load teachers");
            }
        };
        fetchTeachers();
    }, []);

    // Load Attendance for Date
    useEffect(() => {
        if (!date) return;
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const dateStr = format(date, 'yyyy-MM-dd');
                // We'll store/fetch from a 'teacher_attendance' collection
                // Doc ID structure: `${dateStr}_${teacherId}`
                // Or query by date field. Let's query by date field for flexibility.

                const q = query(
                    collection(db, 'teacher_attendance'),
                    where('dateStr', '==', dateStr)
                );

                const snapshot = await getDocs(q);
                const currentAttendance: Record<string, AttendanceRecord> = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.teacherId) {
                        currentAttendance[data.teacherId] = {
                            status: data.status,
                            remarks: data.remarks
                        };
                    }
                });

                setAttendance(currentAttendance);
            } catch (error) {
                console.error("Error loading attendance:", error);
                toast.error("Failed to load attendance");
            } finally {
                setLoading(false);
            }
        };
        fetchAttendance();
    }, [date]);

    const handleStatusChange = (teacherId: string, status: 'P' | 'A' | 'HL') => {
        setAttendance(prev => ({
            ...prev,
            [teacherId]: { ...prev[teacherId], status }
        }));
    };

    const saveAttendance = async () => {
        if (!date) return;
        setSaving(true);
        try {
            const batch = writeBatch(db);
            const dateStr = format(date, 'yyyy-MM-dd');
            const timestamp = Timestamp.fromDate(date);

            // We only save records for teachers who have a status set (or explicit update)
            // Since we want to capture "Absent" vs "Not Marked", we iterate through visible teachers 
            // or just the ones in `attendance` state. 
            // A robust system would save all. Let's save all visible teachers to ensure completeness.

            teachers.forEach(teacher => {
                const record = attendance[teacher.id];
                if (record) {
                    const docRef = doc(db, 'teacher_attendance', `${dateStr}_${teacher.id}`);
                    batch.set(docRef, {
                        dateStr,
                        date: timestamp,
                        teacherId: teacher.id,
                        teacherName: teacher.name,
                        department: teacher.department,
                        status: record.status,
                        updatedAt: Timestamp.now()
                    }, { merge: true });
                }
            });

            await batch.commit();
            toast.success("Attendance saved successfully");
        } catch (error) {
            console.error("Error saving attendance:", error);
            toast.error("Failed to save attendance");
        } finally {
            setSaving(false);
        }
    };

    const downloadCSV = () => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const headers = ['Name', 'Email', 'Department', 'Date', 'Status'];

        // Filter teachers based on current view
        const filteredTeachers = teachers.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDept = departmentFilter === 'all' || t.department === departmentFilter;
            return matchesSearch && matchesDept;
        });

        const rows = filteredTeachers.map(t => {
            const status = attendance[t.id]?.status || 'Not Marked';
            return [
                t.name,
                t.email,
                t.department,
                dateStr,
                status
            ].map(val => `"${val}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Teacher_Attendance_${dateStr}.csv`;
        a.click();
    };

    // Filter Logic
    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = departmentFilter === 'all' || t.department === departmentFilter;
        return matchesSearch && matchesDept;
    });

    // Reset to page 1 when filtering
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, departmentFilter]);

    const paginatedTeachers = filteredTeachers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE);

    // Calculate Stats
    const stats = {
        present: Object.values(attendance).filter(r => r.status === 'P').length,
        absent: Object.values(attendance).filter(r => r.status === 'A').length,
        halfDay: Object.values(attendance).filter(r => r.status === 'HL').length,
    };

    const resetFaceID = async (teacherId: string, name: string) => {
        if (!confirm(`Are you sure you want to reset Face ID for ${name}?`)) return;
        try {
            await setDoc(doc(db, 'users', teacherId), {
                faceDescriptor: null,
                hasFace: false,
                // Also clear old biometric fields if they exist
                biometricCredId: deleteField(),
                biometricCredIds: deleteField(),
                registeredDeviceIds: deleteField()
            }, { merge: true });
            toast.success(`Face ID reset for ${name}`);
        } catch (error) {
            console.error("Error resetting Face ID:", error);
            toast.error("Failed to reset Face ID");
        }
    };

    const resetAllFaceIDs = async () => {
        let targets = [];
        if (departmentFilter === 'all') {
            targets = teachers;
        } else {
            targets = teachers.filter(t => t.department === departmentFilter);
        }

        if (targets.length === 0) {
            toast.error("No teachers found to reset.");
            return;
        }

        if (!confirm(`WARNING: This will remove Face ID access for ${targets.length} teachers in ${departmentFilter === 'all' ? 'All Departments' : departmentFilter}. Continue?`)) return;

        setSaving(true);
        try {
            const batch = writeBatch(db);
            targets.forEach(t => {
                const ref = doc(db, 'users', t.id);
                batch.update(ref, {
                    faceDescriptor: null,
                    hasFace: false,
                    biometricCredId: deleteField(),
                    biometricCredIds: deleteField(),
                    registeredDeviceIds: deleteField()
                });
            });
            await batch.commit();
            toast.success("All selected Face IDs reset successfully");
        } catch (error) {
            console.error("Error resetting all:", error);
            toast.error("Failed to reset all Face IDs");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 w-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <ClipboardList className="h-8 w-8 text-indigo-500" />
                    Manage Teacher Attendance
                </h1>
                <p className="text-slate-400">View and modify daily attendance reports for teachers.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls Panel */}
                <Card className="bg-slate-800 border-slate-700 text-white lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal bg-slate-900 border-slate-700 hover:bg-slate-800"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="bg-slate-900 border-slate-700">
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Attendance Summary</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-emerald-500/10 p-3 rounded-xl text-center border border-emerald-500/20 shadow-sm">
                                    <div className="font-black text-xl text-emerald-500 leading-none">{stats.present}</div>
                                    <div className="text-[9px] font-bold text-emerald-400/70 mt-1 uppercase">Present</div>
                                </div>
                                <div className="bg-rose-500/10 p-3 rounded-xl text-center border border-rose-500/20 shadow-sm">
                                    <div className="font-black text-xl text-rose-500 leading-none">{stats.absent}</div>
                                    <div className="text-[9px] font-bold text-rose-400/70 mt-1 uppercase">Absent</div>
                                </div>
                                <div className="bg-amber-500/10 p-3 rounded-xl text-center border border-amber-500/20 shadow-sm">
                                    <div className="font-black text-xl text-amber-500 leading-none">{stats.halfDay}</div>
                                    <div className="text-[9px] font-bold text-amber-400/70 mt-1 uppercase">Half Day</div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 space-y-3 border-t border-slate-700">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={saveAttendance} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>

                            <Button variant="outline" className="w-full border-slate-700" onClick={downloadCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Report
                            </Button>

                            <Button variant="secondary" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setOverallAttendanceOpen(true)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Overall Attendance
                            </Button>

                            <Button
                                variant="destructive"
                                className="w-full bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200"
                                onClick={resetAllFaceIDs}
                                disabled={saving}
                            >
                                <ScanFace className="mr-2 h-4 w-4" />
                                Reset {departmentFilter === 'all' ? 'All' : departmentFilter} Face IDs
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full border-slate-700 bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white border-amber-600/50"
                                onClick={() => setShowLocationSettings(true)}
                            >
                                <MapPin className="mr-2 h-4 w-4" />
                                Attendance Location Settings
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Main List */}
                <Card className="bg-slate-800 border-slate-700 text-white lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Attendance List</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search teacher..."
                                className="pl-8 bg-slate-900 border-slate-700 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-slate-700 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900 border-b border-slate-700">
                                    <TableRow className="border-slate-700 hover:bg-slate-900">
                                        <TableHead className="text-slate-400">Teacher</TableHead>
                                        <TableHead className="text-slate-400">Department</TableHead>
                                        <TableHead className="text-center text-slate-400">Status</TableHead>
                                        <TableHead className="text-center text-slate-400">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-500" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredTeachers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                                No teachers found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedTeachers.map((teacher) => {
                                            const status = attendance[teacher.id]?.status; // undefined = Not Marked
                                            return (
                                                <TableRow key={teacher.id} className="border-slate-700 hover:bg-slate-700/30">
                                                    <TableCell className="font-medium">
                                                        <div>{teacher.name}</div>
                                                        <div className="text-xs text-slate-500">{teacher.email}</div>
                                                    </TableCell>
                                                    <TableCell>{teacher.department}</TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-center gap-3">
                                                            <button
                                                                onClick={() => handleStatusChange(teacher.id, 'P')}
                                                                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all duration-300 shadow-sm
                                                            ${status === 'P'
                                                                        ? 'bg-emerald-500 text-emerald-950 font-black ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 scale-110 shadow-emerald-500/20'
                                                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                                                title="Present"
                                                            >
                                                                <span className="text-xs leading-none">P</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusChange(teacher.id, 'A')}
                                                                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all duration-300 shadow-sm
                                                            ${status === 'A'
                                                                        ? 'bg-rose-500 text-rose-950 font-black ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900 scale-110 shadow-rose-500/20'
                                                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                                                title="Absent"
                                                            >
                                                                <span className="text-xs leading-none">A</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusChange(teacher.id, 'HL')}
                                                                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all duration-300 shadow-sm
                                                            ${status === 'HL'
                                                                        ? 'bg-amber-500 text-amber-950 font-black ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 scale-110 shadow-amber-500/20'
                                                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                                                title="Half Day Leave"
                                                            >
                                                                <span className="text-xs leading-none text-[10px]">HL</span>
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10"
                                                                onClick={() => {
                                                                    setSelectedTeacherForHistory(teacher);
                                                                    setHistoryDialogOpen(true);
                                                                }}
                                                                title="Show Attendance"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                                                                onClick={() => resetFaceID(teacher.id, teacher.name)}
                                                                title="Reset Face ID"
                                                            >
                                                                <ScanFace className="h-4 w-4" />
                                                                <span className="sr-only">Reset</span>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {totalPages > 1 && (
                            <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 mx-6 mb-6">
                                <div className="text-sm text-slate-400">
                                    Showing <span className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTeachers.length)}</span> of <span className="text-white">{filteredTeachers.length}</span> teachers
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                    </Button>
                                    <div className="flex items-center gap-1.5 px-3 text-sm font-medium text-slate-400">
                                        Page <span className="text-white">{currentPage}</span> of <span className="text-white">{totalPages}</span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {selectedTeacherForHistory && (
                <TeacherAttendanceHistoryDialog
                    teacher={selectedTeacherForHistory}
                    open={historyDialogOpen}
                    onOpenChange={setHistoryDialogOpen}
                />
            )}

            <AdminOverallAttendanceDialog
                open={overallAttendanceOpen}
                onOpenChange={setOverallAttendanceOpen}
                departments={departments}
            />

            {/* Location Settings Dialog */}
            <Dialog open={showLocationSettings} onOpenChange={setShowLocationSettings}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-amber-500" />
                            Attendance Location Settings
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Restrict teacher attendance to a specific geographical radius.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 flex-1 overflow-y-auto px-1">
                        <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                            <div className="space-y-0.5">
                                <Label>Enable Location Restriction</Label>
                                <p className="text-xs text-slate-500">Teachers must be within the radius to mark attendance.</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={locationConfig.isEnabled}
                                onChange={e => setLocationConfig({ ...locationConfig, isEnabled: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600"
                            />
                        </div>

                        <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <Label className="text-indigo-400 font-semibold">1. Search your exact location</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search address or paste Google Maps URL..."
                                    className="bg-slate-800 border-slate-700"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch((e.target as HTMLInputElement).value);
                                        }
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                                    onClick={(e) => {
                                        const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                                        handleSearch(input?.value);
                                    }}
                                >
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={getCurrentLocation}
                            >
                                <Locate className="mr-2 h-4 w-4" />
                                Detect Location
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-slate-700"
                                onClick={() => {
                                    const lat = locationConfig.lat || 0;
                                    const lng = locationConfig.lng || 0;
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
                                }}
                            >
                                <MapPin className="mr-2 h-4 w-4" />
                                Google Maps
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label>Constraint Radius (Meters)</Label>
                            <div className="flex items-center gap-4">
                                <Input
                                    type="number"
                                    value={locationConfig.radius}
                                    onChange={e => setLocationConfig({ ...locationConfig, radius: parseInt(e.target.value) })}
                                    className="bg-slate-800 border-slate-700"
                                />
                                <span className="text-slate-400 text-sm whitespace-nowrap">meters</span>
                            </div>
                            <p className="text-[10px] text-slate-500">Suggested: 100-500 meters for office/campus.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>2. Fine-tune on Map (Drag Marker)</Label>
                            <div className="h-64 w-full rounded-lg overflow-hidden border border-slate-700 relative z-0">
                                <MapContainer
                                    center={[locationConfig.lat || 13.0482, locationConfig.lng || 80.2324]}
                                    zoom={mapZoom}
                                    style={{ height: '100%', width: '100%' }}
                                    scrollWheelZoom={true}
                                    dragging={true}
                                >
                                    <TileLayer
                                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                        attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                                    />
                                    <MapClickHandler onClick={(e) => {
                                        setLocationConfig(prev => ({
                                            ...prev,
                                            lat: e.latlng.lat,
                                            lng: e.latlng.lng
                                        }));
                                    }} />

                                    <MapRecenter lat={locationConfig.lat || 13.0482} lng={locationConfig.lng || 80.2324} zoom={mapZoom} />

                                    {locationConfig.lat !== 0 && (
                                        <DraggableMarker
                                            pos={[locationConfig.lat, locationConfig.lng]}
                                            onDragEnd={(lat, lng) => {
                                                setLocationConfig(prev => ({ ...prev, lat, lng }));
                                            }}
                                        />
                                    )}
                                </MapContainer>
                                <div className="absolute bottom-2 right-2 z-[1000] bg-slate-900/90 p-2 rounded text-xs text-slate-300 pointer-events-none border border-slate-700 shadow-xl">
                                    {mapZoom < 13 ? "Zoomed out due to low accuracy. Zoom in (+)" : "Drag marker to adjust"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowLocationSettings(false)}>Cancel</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={saveLocationSettings} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
