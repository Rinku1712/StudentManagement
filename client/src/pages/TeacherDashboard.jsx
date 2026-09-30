import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiRequest } from '../services/api';
import {
  Users,
  HelpCircle,
  Plus,
  MessageSquare,
  ClipboardList,
  Send,
  Upload,
} from 'lucide-react';

const defaultTestForm = { title: '', subject: '', date: '', totalMarks: '' };
const defaultAssignmentForm = { title: '', subject: '', dueDate: '' };

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [teacherProfile, setTeacherProfile] = useState({ name: '', email: '' });
  const [tests, setTests] = useState([]);
  const [newTest, setNewTest] = useState(defaultTestForm);
  const [showTestModal, setShowTestModal] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [newAssignment, setNewAssignment] = useState(defaultAssignmentForm);
  const [submissions, setSubmissions] = useState([]);
  const [studentsAttendance, setStudentsAttendance] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [activeDoubtId, setActiveDoubtId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [apiError, setApiError] = useState('');

  const loadDashboardData = async () => {
    try {
      const [profileRes, assignmentsRes, testsRes, doubtsRes, submissionsRes, attendanceRes] = await Promise.all([
        apiRequest('/api/dashboard/teacher-profile'),
        apiRequest('/api/dashboard/student/assignments'),
        apiRequest('/api/dashboard/student/tests'),
        apiRequest('/api/dashboard/student/doubts'),
        apiRequest('/api/dashboard/teacher/submissions'),
        apiRequest('/api/dashboard/teacher/attendance'),
      ]);

      setTeacherProfile(profileRes || { name: '', email: '' });
      setAssignments(assignmentsRes || []);
      setTests(testsRes || []);
      setDoubts(doubtsRes || []);
      setSubmissions(submissionsRes || []);
      setStudentsAttendance(attendanceRes || []);
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to load teacher dashboard data.');
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      setActiveTab('overview');
      setNewTest(defaultTestForm);
      setNewAssignment(defaultAssignmentForm);
      setShowTestModal(false);
      setActiveDoubtId(null);
      setReplyText('');
      return loadDashboardData();
    });
  }, []);

  const handleAddTest = async (e) => {
    e.preventDefault();
    if (!newTest.title || !newTest.subject || !newTest.date || !newTest.totalMarks) return;

    try {
      const createdTest = await apiRequest('/api/dashboard/student/tests', {
        method: 'POST',
        body: JSON.stringify({ ...newTest, totalMarks: Number(newTest.totalMarks) }),
      });
      setTests((prev) => [createdTest, ...prev]);
      setNewTest(defaultTestForm);
      setShowTestModal(false);
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to create test.');
    }
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    if (!newAssignment.title || !newAssignment.subject || !newAssignment.dueDate) return;

    try {
      const createdAssignment = await apiRequest('/api/dashboard/student/assignments', {
        method: 'POST',
        body: JSON.stringify({ ...newAssignment, submissions: 0, status: 'Pending' }),
      });
      setAssignments((prev) => [createdAssignment, ...prev]);
      setNewAssignment(defaultAssignmentForm);
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to create assignment.');
    }
  };

  const handleSendReply = async (id) => {
    if (!replyText.trim()) return;

    try {
      const updatedDoubt = await apiRequest(`/api/dashboard/teacher/doubts/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      setDoubts((prev) => prev.map((doubt) => (doubt.id === id ? updatedDoubt : doubt)));
      setReplyText('');
      setActiveDoubtId(null);
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to send reply.');
    }
  };

  const toggleAttendance = async (id) => {
    try {
      const updatedRecord = await apiRequest(`/api/dashboard/teacher/attendance/${id}/toggle`, {
        method: 'POST',
      });
      setStudentsAttendance((prev) => prev.map((item) => (item.id === id ? updatedRecord : item)));
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to update attendance.');
    }
  };

  return (
    <DashboardLayout role="teacher" activeTab={activeTab} setActiveTab={setActiveTab}>
      {apiError && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{apiError}</div>}

      {activeTab === 'overview' && (
          <div className="dashboard-overview teacher-dashboard">
            <div className="teacher-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{teacherProfile.name ? `${teacherProfile.name}'s Dashboard` : 'Instructor Dashboard'}</h1>
              <p className="text-slate-500 text-sm mt-1">Manage tests, review coursework, and resolve student doubts.</p>
            </div>
            <button onClick={() => setShowTestModal(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all w-fit"><Plus size={16} /> Schedule New Test</button>
          </div>

          <div className="teacher-metrics grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="teacher-metric-card bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Active Students</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{studentsAttendance.length || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Users size={20} /></div>
            </div>
            <div className="teacher-metric-card bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Unresolved Doubts</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{doubts.filter((d) => d.status === 'Pending').length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><HelpCircle size={20} /></div>
            </div>
            <div className="teacher-metric-card bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Tests Scheduled</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{tests.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ClipboardList size={20} /></div>
            </div>
          </div>

          <div className="teacher-forum bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2"><MessageSquare size={18} className="text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Student Doubt Forum</h2></div>
              <span className="text-xs text-slate-500">Live Q&A Stream</span>
            </div>

            <div className="divide-y divide-slate-100">
              {doubts.length === 0 ? <div className="p-5 text-xs text-slate-500">No student doubts available yet.</div> : doubts.map((doubt) => (
                <div key={doubt.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{doubt.studentName || 'Student'}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500">{doubt.subject}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 mt-1.5">{doubt.question}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${doubt.status === 'Answered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{doubt.status}</span>
                  </div>

                  {doubt.reply && <div className="ml-4 pl-3 border-l-2 border-emerald-500 bg-emerald-50/50 p-2.5 rounded-r-lg"><p className="text-xs font-semibold text-emerald-800">Your Response:</p><p className="text-xs text-emerald-900 mt-0.5">{doubt.reply}</p></div>}

                  {doubt.status === 'Pending' && (
                    <div>
                      {activeDoubtId === doubt.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea rows="2" placeholder="Type response..." className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleSendReply(doubt.id)} className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"><Send size={13} /> Submit Reply</button>
                            <button onClick={() => setActiveDoubtId(null)} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 cursor-pointer">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setActiveDoubtId(doubt.id); setReplyText(''); }} className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">Reply to Doubt →</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Create New Assignment</h2>
            <form onSubmit={handleAddAssignment} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" placeholder="Assignment Title" required className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5" value={newAssignment.title} onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })} />
              <input type="text" placeholder="Subject or subject code" required className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5" value={newAssignment.subject} onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })} />
              <div className="flex gap-2">
                <input type="text" placeholder="Due Date (e.g. 15 Mar)" required className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5" value={newAssignment.dueDate} onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })} />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 rounded-lg cursor-pointer">Publish</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {assignments.length === 0 ? <div className="p-5 text-xs text-slate-500">No assignments published yet.</div> : assignments.map((assignment) => (
              <div key={assignment.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{assignment.subject}</span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">{assignment.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Deadline: {assignment.dueDate}</p>
                </div>
                <span className="text-xs font-semibold bg-slate-100 px-3 py-1 rounded-full text-slate-700">{assignment.submissions || 0} Submissions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Manage Tests & Exams</h1>
              <p className="text-xs text-slate-500">Schedule quizzes and monitor testing windows</p>
            </div>
            <button onClick={() => setShowTestModal(true)} className="text-xs bg-blue-600 text-white px-3.5 py-2 rounded-lg font-medium cursor-pointer">+ Add Test</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.length === 0 ? <div className="col-span-full bg-white p-5 rounded-xl border border-slate-200 text-xs text-slate-500">No tests scheduled yet.</div> : tests.map((test) => (
              <div key={test.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{test.subject}</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-2">{test.title}</h3>
                <p className="text-xs text-slate-500 mt-1">Date: {test.date}</p>
                <p className="text-xs font-semibold text-slate-700 mt-1">Total Marks: {test.totalMarks}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h1 className="text-xl font-bold text-slate-900">Student Submissions</h1>
            <p className="text-xs text-slate-500">Grade submitted student papers and coursework</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {submissions.length === 0 ? <div className="p-5 text-xs text-slate-500">No submissions available yet.</div> : submissions.map((submission) => (
              <div key={submission.id} className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{submission.studentName}</h3>
                  <p className="text-xs text-slate-500">{submission.assignment}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{submission.marks}</span>
                  <button onClick={() => alert(`Reviewing work of ${submission.studentName}`)} className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">Grade Work →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Class Attendance Register</h1>
              <p className="text-xs text-slate-500">Toggle student status for today's lecture</p>
            </div>
            <button onClick={() => alert('Attendance Saved Successfully!')} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-lg cursor-pointer">Save Register</button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                <tr><th className="p-3">Roll No</th><th className="p-3">Student Name</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {studentsAttendance.length === 0 ? <tr><td colSpan="4" className="p-3 text-slate-500">No attendance records yet.</td></tr> : studentsAttendance.map((student) => (
                  <tr key={student.id}>
                    <td className="p-3 font-semibold">{student.rollNo}</td>
                    <td className="p-3 font-medium">{student.name}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded font-semibold ${student.present ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{student.present ? 'Present' : 'Absent'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => toggleAttendance(student.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer">Toggle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h1 className="text-xl font-bold text-slate-900">Upload Study Resources</h1>
            <p className="text-xs text-slate-500">Share lecture notes, PDFs and lab guides with your class</p>
          </div>
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm border-dashed flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3"><Upload size={24} /></div>
            <h3 className="text-sm font-semibold text-slate-900">Drop your study material PDF or docs here</h3>
            <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, PPT up to 25MB</p>
            <button onClick={() => alert('File upload will link directly with Multer & Cloudinary backend!')} className="mt-4 text-xs font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">Browse Files</button>
          </div>
        </div>
      )}

      {showTestModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-4">Schedule New Class Test</h3>
            <form onSubmit={handleAddTest} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Test Title</label>
                <input type="text" required placeholder="e.g. Unit 3 Quiz" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs" value={newTest.title} onChange={(e) => setNewTest({ ...newTest, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Subject Code</label>
                  <input type="text" required placeholder="BCA203" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs" value={newTest.subject} onChange={(e) => setNewTest({ ...newTest, subject: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase">Total Marks</label>
                  <input type="number" required placeholder="30" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs" value={newTest.totalMarks} onChange={(e) => setNewTest({ ...newTest, totalMarks: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Date & Time</label>
                <input type="text" required placeholder="12 Mar, 2026 • 11:00 AM" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs" value={newTest.date} onChange={(e) => setNewTest({ ...newTest, date: e.target.value })} />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowTestModal(false)} className="text-xs px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="text-xs px-4 py-2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">Save Test</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
