import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import {
    Download,
    Loader2,
    TrendingUp,
    CheckCircle,
    XCircle,
    Clock,
    Calendar,
    FileText
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { toast } from 'sonner';

interface TeacherAttendanceHistoryDialogProps {
    teacher: {
        id: string;
        name: string;
        email: string;
        department: string;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface AttendanceData {
    date: string;
    dateFull: Date;
    status: 'P' | 'A' | 'HL';
    numericStatus: number;
}

export const TeacherAttendanceHistoryDialog = ({
    teacher,
    open,
    onOpenChange
}: TeacherAttendanceHistoryDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<AttendanceData[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        present: 0,
        absent: 0,
        halfDay: 0,
        percentage: 0
    });

    useEffect(() => {
        if (open && teacher.id) {
            fetchAttendanceHistory();
        }
    }, [open, teacher.id]);

    const fetchAttendanceHistory = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'teacher_attendance'),
                where('teacherId', '==', teacher.id),
                orderBy('date', 'desc'),
                limit(180) // Last 6 months approx
            );

            const snapshot = await getDocs(q);
            const data: AttendanceData[] = [];
            let p = 0, a = 0, hl = 0;

            snapshot.forEach(doc => {
                const item = doc.data();
                const status = item.status as 'P' | 'A' | 'HL';

                // Map status to numeric for graph if needed, or just categories
                // P = 1, HL = 0.5, A = 0
                const numericStatus = status === 'P' ? 1 : (status === 'HL' ? 0.5 : 0);

                if (status === 'P') p++;
                else if (status === 'A') a++;
                else if (status === 'HL') hl++;

                data.push({
                    date: item.dateStr,
                    dateFull: item.date.toDate(),
                    status,
                    numericStatus
                });
            });

            // Sort chronologically for graph
            const sortedData = [...data].sort((x, y) => x.dateFull.getTime() - y.dateFull.getTime());

            setHistory(sortedData);

            const total = p + a + hl;
            setStats({
                total,
                present: p,
                absent: a,
                halfDay: hl,
                percentage: total > 0 ? ((p + (hl * 0.5)) / total) * 100 : 0
            });

        } catch (error) {
            console.error("Error fetching attendance history:", error);
            toast.error("Failed to load attendance history");
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (history.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = ['Date', 'Status', 'Points'];
        const rows = history.map(item => [
            item.date,
            item.status,
            item.numericStatus
        ]);

        // Add summary to CSV
        rows.push([]);
        rows.push(['Summary', '', '']);
        rows.push(['Total Days', stats.total.toString(), '']);
        rows.push(['Present (P)', stats.present.toString(), '']);
        rows.push(['Absent (A)', stats.absent.toString(), '']);
        rows.push(['Half Day (HL)', stats.halfDay.toString(), '']);
        rows.push(['Attendance %', `${stats.percentage.toFixed(2)}%`, '']);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${teacher.name.replace(/\s+/g, '_')}_Attendance_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Prepare chart data (aggregrate by month or show last 30 days)
    const chartData = history.slice(-30).map(item => ({
        name: format(item.dateFull, 'MMM d'),
        value: item.numericStatus,
        status: item.status
    }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Calendar className="h-6 w-6 text-indigo-400" />
                                Attendance History: {teacher.name}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400">
                                {teacher.department} • {teacher.email}
                            </DialogDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-slate-800 border-slate-700 hover:bg-slate-700"
                            onClick={downloadCSV}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download CSV
                        </Button>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        <p className="text-slate-400">Fetching history...</p>
                    </div>
                ) : (
                    <div className="space-y-8 mt-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardContent className="p-4 text-center">
                                    <p className="text-xs text-slate-400 mb-1">Total Days</p>
                                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-500/10 border-green-500/20">
                                <CardContent className="p-4 text-center">
                                    <p className="text-xs text-green-400 mb-1">Present (P)</p>
                                    <p className="text-2xl font-bold text-green-500">{stats.present}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-500/10 border-red-500/20">
                                <CardContent className="p-4 text-center">
                                    <p className="text-xs text-red-400 mb-1">Absent (A)</p>
                                    <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-yellow-500/10 border-yellow-500/20">
                                <CardContent className="p-4 text-center">
                                    <p className="text-xs text-yellow-400 mb-1">Half Day (HL)</p>
                                    <p className="text-2xl font-bold text-yellow-500">{stats.halfDay}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-indigo-500/10 border-indigo-500/20">
                                <CardContent className="p-4 text-center">
                                    <p className="text-xs text-indigo-400 mb-1">Attendance %</p>
                                    <p className="text-2xl font-bold text-indigo-500">{stats.percentage.toFixed(1)}%</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chart */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-indigo-400" />
                                Recent Attendance Trend
                            </h3>
                            <div className="h-64 w-full bg-slate-800/30 rounded-lg p-4 border border-slate-800">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis
                                                dataKey="name"
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
                                                ticks={[0, 0.5, 1]}
                                                tickFormatter={(v) => v === 1 ? 'P' : (v === 0.5 ? 'HL' : 'A')}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '#1e293b', color: '#fff' }}
                                                formatter={(value: any, name: any, props: any) => [props.payload.status, 'Status']}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {chartData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.status === 'P' ? '#22c55e' : (entry.status === 'HL' ? '#eab308' : '#ef4444')}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-500">
                                        No historical data available for this teacher.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent History List */}
                        <div className="space-y-4 pb-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-indigo-400" />
                                Detailed History
                            </h3>
                            <div className="rounded-md border border-slate-700 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-700">
                                        <tr>
                                            <th className="p-3 text-left">Date</th>
                                            <th className="p-3 text-center">Status</th>
                                            <th className="p-3 text-right">Points</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-slate-500">No records found</td>
                                            </tr>
                                        ) : (
                                            history.slice(0, 10).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/50">
                                                    <td className="p-3">{format(item.dateFull, 'PPP')}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                            ${item.status === 'P' ? 'bg-green-500/20 text-green-400' :
                                                                item.status === 'HL' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-red-500/20 text-red-400'}`}>
                                                            {item.status === 'P' ? 'Present' : item.status === 'HL' ? 'Half Day' : 'Absent'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-slate-400">{item.numericStatus}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="border-t border-slate-800 pt-4">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
