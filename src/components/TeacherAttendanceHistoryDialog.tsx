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
    FileText,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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
    const [selectedMonth, setSelectedMonth] = useState(new Date());
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
    }, [open, teacher.id, selectedMonth]);

    const fetchAttendanceHistory = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(selectedMonth);
            const end = endOfMonth(selectedMonth);
            const dateStrStart = format(start, 'yyyy-MM-dd');
            const dateStrEnd = format(end, 'yyyy-MM-dd');

            const q = query(
                collection(db, 'teacher_attendance'),
                where('teacherId', '==', teacher.id),
                where('dateStr', '>=', dateStrStart),
                where('dateStr', '<=', dateStrEnd),
                orderBy('dateStr', 'desc')
            );

            const snapshot = await getDocs(q);
            const data: AttendanceData[] = [];
            let p = 0, a = 0, hl = 0;

            snapshot.forEach(doc => {
                const item = doc.data();
                const status = item.status as 'P' | 'A' | 'HL';
                const numericStatus = status === 'P' ? 1 : (status === 'HL' ? 0.5 : 0);

                if (status === 'P') p++;
                else if (status === 'A') a++;
                else if (status === 'HL') hl++;

                // Safe date conversion
                let dateFull: Date;
                if (item.date && typeof item.date.toDate === 'function') {
                    dateFull = item.date.toDate();
                } else if (item.dateStr) {
                    // item.dateStr is "YYYY-MM-DD"
                    const [y, m, d] = item.dateStr.split('-').map(Number);
                    dateFull = new Date(y, m - 1, d);
                } else {
                    dateFull = new Date();
                }

                data.push({
                    date: item.dateStr || format(dateFull, 'yyyy-MM-dd'),
                    dateFull,
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

    const downloadExcel = async () => {
        if (history.length === 0) {
            toast.error("No data to download for this month");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        // Set column widths
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Status', key: 'status', width: 8 },
            { header: 'Points', key: 'points', width: 8 },
        ];

        // Format Header
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFC6E0B4' } // Light Green
            };
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add Data
        history.forEach((item) => {
            const row = worksheet.addRow({
                date: item.date,
                status: item.status,
                points: item.numericStatus
            });
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Add Summary Section
        worksheet.addRow([]); // Empty row

        const summaryTitleRow = worksheet.addRow(['Summary']);
        worksheet.mergeCells(`A${summaryTitleRow.number}:C${summaryTitleRow.number}`);
        const summaryTitleCell = summaryTitleRow.getCell(1);
        summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        summaryTitleCell.font = { bold: true };
        summaryTitleCell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        const summaryData = [
            ['Month', format(selectedMonth, 'MMM-yy')],
            ['Total Days', stats.total],
            ['Present (P)', stats.present],
            ['Absent (A)', stats.absent],
            ['Half Day (HL)', stats.halfDay],
            ['Attendance %', `${stats.percentage.toFixed(2)}%`]
        ];

        summaryData.forEach((data, index) => {
            const row = worksheet.addRow([data[0], '', data[1]]);
            const rowNum = row.number;

            // Merge A and B for labels
            worksheet.mergeCells(`A${rowNum}:B${rowNum}`);

            const cellLabel = row.getCell(1);
            const cellValue = row.getCell(3);

            // Styling for summary rows
            [cellLabel, cellValue].forEach(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };

                // Header row for summary (Month)
                if (index === 0) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFC6E0B4' }
                    };
                    cell.font = { bold: true };
                }
            });

            // Font for numbers in summary
            if (typeof data[1] === 'number' || data[0] === 'Attendance %') {
                cellValue.font = { size: 11, bold: true };
            }
        });

        // Export file
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${teacher.name.replace(/\s+/g, '_')}_${format(selectedMonth, 'MMM_yyyy')}_Attendance.xlsx`);
        toast.success("Excel report generated successfully");
    };

    const chartData = history.map(item => ({
        name: format(item.dateFull, 'd'),
        value: item.numericStatus,
        status: item.status,
        dateFull: format(item.dateFull, 'MMM d')
    }));

    const recentAbsents = history
        .filter(item => item.status === 'A')
        .sort((a, b) => b.dateFull.getTime() - a.dateFull.getTime())
        .slice(0, 3);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-[#0f172a]/95 border-slate-800 text-white max-h-[90vh] overflow-y-auto backdrop-blur-xl">
                <DialogHeader className="relative pr-12">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-indigo-400">
                                <Calendar className="h-6 w-6" />
                                {teacher.name}'s Attendance
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 font-medium">
                                {teacher.department} • {teacher.email}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                                <select
                                    className="bg-transparent text-sm font-semibold px-2 py-1 outline-none cursor-pointer text-white"
                                    value={selectedMonth.getMonth()}
                                    onChange={(e) => {
                                        const newDate = new Date(selectedMonth);
                                        newDate.setMonth(parseInt(e.target.value));
                                        setSelectedMonth(newDate);
                                    }}
                                >
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <option key={i} value={i} className="bg-slate-900">{format(new Date(2024, i, 1), 'MMMM')}</option>
                                    ))}
                                </select>
                                <select
                                    className="bg-transparent text-sm font-semibold px-2 py-1 outline-none border-l border-slate-700 cursor-pointer text-white"
                                    value={selectedMonth.getFullYear()}
                                    onChange={(e) => {
                                        const newDate = new Date(selectedMonth);
                                        newDate.setFullYear(parseInt(e.target.value));
                                        setSelectedMonth(newDate);
                                    }}
                                >
                                    {[2024, 2025, 2026].map(y => (
                                        <option key={y} value={y} className="bg-slate-900">{y}</option>
                                    ))}
                                </select>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                                onClick={downloadExcel}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Report
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                        <p className="text-slate-400 animate-pulse">Analyzing monthly records...</p>
                    </div>
                ) : (
                    <div className="space-y-8 mt-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-slate-800/40 border border-slate-700 p-4 rounded-2xl text-center shadow-lg">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Monthly Days</p>
                                <p className="text-3xl font-black text-white">{stats.total}</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-center shadow-lg">
                                <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">Present</p>
                                <p className="text-3xl font-black text-emerald-500">{stats.present}</p>
                            </div>
                            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center shadow-lg ring-1 ring-rose-500/40">
                                <p className="text-[10px] uppercase tracking-wider text-rose-400 font-bold mb-1">Total Absent</p>
                                <p className="text-3xl font-black text-rose-500">{stats.absent}</p>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-center shadow-lg">
                                <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1">Half Day</p>
                                <p className="text-3xl font-black text-amber-500">{stats.halfDay}</p>
                            </div>
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl text-center shadow-lg">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold mb-1">Efficiency</p>
                                <p className="text-3xl font-black text-indigo-500">{stats.percentage.toFixed(0)}%</p>
                            </div>
                        </div>

                        {/* Recent Absents Section */}
                        {recentAbsents.length > 0 && (
                            <div className="space-y-3 bg-red-950/20 p-4 rounded-2xl border border-red-900/40">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-red-400">
                                    <XCircle className="h-4 w-4" />
                                    Critical Absences (Recent 3)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {recentAbsents.map((abs, i) => (
                                        <div key={i} className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 flex justify-between items-center">
                                            <span className="text-sm font-semibold">{format(abs.dateFull, 'MMM dd, yyyy')}</span>
                                            <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">ABSENT</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Chart */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-white/90">
                                <TrendingUp className="h-5 w-5 text-indigo-400" />
                                Monthly Performance Trend
                            </h3>
                            <div className="h-64 w-full bg-slate-900/50 rounded-2xl p-4 border border-slate-800 shadow-inner">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                stroke="#475569"
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                stroke="#475569"
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                ticks={[0, 0.5, 1]}
                                                tickFormatter={(v) => v === 1 ? 'P' : (v === 0.5 ? 'H' : 'A')}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                contentStyle={{ backgroundColor: '#020617', border: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                                labelFormatter={(label) => `Day ${label}`}
                                                formatter={(value: any, name: any, props: any) => [props.payload.status, 'Status']}
                                            />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={20}>
                                                {chartData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.status === 'P' ? '#10b981' : (entry.status === 'HL' ? '#f59e0b' : '#ef4444')}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 italic">
                                        <Calendar className="h-12 w-12 mb-2 opacity-20" />
                                        No logs found for this month.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent History List */}
                        <div className="space-y-4 pb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-white/90">
                                <FileText className="h-5 w-5 text-indigo-400" />
                                Recent 5: {format(selectedMonth, 'MMMM yyyy')} Log
                            </h3>
                            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50 shadow-xl">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                                        <tr>
                                            <th className="p-4 text-left font-bold uppercase tracking-wider text-[10px]">Date</th>
                                            <th className="p-4 text-center font-bold uppercase tracking-wider text-[10px]">Status</th>
                                            <th className="p-4 text-right font-bold uppercase tracking-wider text-[10px]">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-10 text-center text-slate-500 italic">No attendance records for this period</td>
                                            </tr>
                                        ) : (
                                            [...history].reverse().slice(0, 5).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-indigo-500/5 group transition-colors">
                                                    <td className="p-4 font-medium text-slate-300">{format(item.dateFull, 'PPP')}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                            ${item.status === 'P' ? 'bg-emerald-500 text-emerald-950 border-emerald-400' :
                                                                item.status === 'HL' ? 'bg-amber-500 text-amber-950 border-amber-400' :
                                                                    'bg-rose-500 text-rose-950 border-rose-400'}`}>
                                                            {item.status === 'P' ? 'Present' : item.status === 'HL' ? 'Half Day' : 'Absent'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-black text-slate-500 group-hover:text-indigo-400 transition-colors">{item.numericStatus.toFixed(1)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="bg-slate-900/80 sticky bottom-0 border-t border-slate-800 p-4 -mx-6 -mb-6 backdrop-blur-md">
                    <Button
                        variant="ghost"
                        className="text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={() => onOpenChange(false)}
                    >
                        Close Portal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
