import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiRequest } from '../services/api';
import {
  CheckCircle2,
  Clock,
  BookOpen,
  ClipboardList,
  Award,
  MessageSquarePlus,
  Send,
  HelpCircle,
  UploadCloud,
  Download,
  Sparkles,
} from 'lucide-react';

const emptyProfile = { name: '', id: '', course: '', semester: '', classLevel: '', year: '', stream: '', specialization: '', subjects: [], email: '' };

const getAuthenticatedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export default function StudentDashboard() {
  const authenticatedUser = getAuthenticatedUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [studentProfile, setStudentProfile] = useState({
    ...emptyProfile,
    name: authenticatedUser.name || '',
    id: authenticatedUser.id || '',
    email: authenticatedUser.email || '',
  });
  const [assignments, setAssignments] = useState([]);
  const [upcomingTests, setUpcomingTests] = useState([]);
  const [notes, setNotes] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChat, setAiChat] = useState([{ sender: 'ai', text: 'Ask me anything about your course or assignments.' }]);
  const [isSubmittingDoubt, setIsSubmittingDoubt] = useState(false);
  const [isSubmittingAi, setIsSubmittingAi] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [apiError, setApiError] = useState('');

  const loadDashboardData = async () => {
    try {
      setIsLoadingData(true);
      const [profileRes, assignmentsRes, testsRes, notesRes, doubtsRes] = await Promise.all([
        apiRequest('/api/dashboard/student-profile'),
        apiRequest('/api/dashboard/student/assignments'),
        apiRequest('/api/dashboard/student/tests'),
        apiRequest('/api/dashboard/student/notes'),
        apiRequest('/api/dashboard/student/doubts'),
      ]);

      setStudentProfile({
        ...emptyProfile,
        ...profileRes,
        name: profileRes?.name || authenticatedUser.name || '',
        id: profileRes?.id || authenticatedUser.id || '',
        email: profileRes?.email || authenticatedUser.email || '',
      });
      setAssignments(assignmentsRes || []);
      setUpcomingTests(testsRes || []);
      setNotes(notesRes || []);
      setDoubts(doubtsRes || []);
      setIsDataLoaded(true);
      setApiError('');
    } catch (error) {
      setIsDataLoaded(false);
      setApiError(error.message || 'Unable to load student dashboard data.');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      setActiveTab('overview');
      setQuestionInput('');
      setSubjectInput('');
      setAiPrompt('');
      setAiChat([{ sender: 'ai', text: 'Ask me anything about your course or assignments.' }]);
      return loadDashboardData();
    });
    // The dashboard data is intentionally loaded once for each dashboard mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAskDoubt = async (e) => {
    e.preventDefault();
    if (!questionInput.trim()) return;

    const payload = { subject: subjectInput.trim(), question: questionInput.trim() };

    if (!subjectInput.trim()) {
      setApiError('Please enter a subject for your doubt.');
      return;
    }

    try {
      setIsSubmittingDoubt(true);
      const createdDoubt = await apiRequest('/api/dashboard/student/doubts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setDoubts((prev) => [createdDoubt, ...prev]);
      setQuestionInput('');
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to submit your doubt.');
    } finally {
      setIsSubmittingDoubt(false);
    }
  };

  const handleAiSend = async (e) => {
    e.preventDefault();
    const trimmedPrompt = aiPrompt.trim();
    if (!trimmedPrompt || isSubmittingAi) return;

    const userMessage = { sender: 'user', text: trimmedPrompt };
    setAiChat((prev) => [...prev, userMessage, { sender: 'ai', text: 'Thinking...', isLoading: true }]);
    setAiPrompt('');
    setIsSubmittingAi(true);

    try {
      const response = await apiRequest('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmedPrompt }),
      });

      setAiChat((prev) =>
        prev
          .filter((msg) => !msg.isLoading)
          .concat({ sender: 'ai', text: response.reply || 'I could not generate a response.' })
      );
    } catch (error) {
      setAiChat((prev) =>
        prev
          .filter((msg) => !msg.isLoading)
          .concat({ sender: 'ai', text: error.message || 'The AI service is unavailable right now.' })
      );
    } finally {
      setIsSubmittingAi(false);
    }
  };

  const handleAssignmentSubmit = async (id) => {
    try {
      const updated = await apiRequest(`/api/dashboard/student/assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Submitted' }),
      });
      setAssignments((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Unable to submit assignment.');
    }
  };

  const dashboardValue = (value) => (isLoadingData || !isDataLoaded ? '—' : value);
  const initials = studentProfile.name
    ? studentProfile.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : '—';

  return (
    <DashboardLayout role="student" activeTab={activeTab} setActiveTab={setActiveTab}>
      {apiError && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{apiError}</div>}

      {activeTab === 'overview' && (
        <div className="dashboard-overview">
          <div className="overview-header">
            <div>
              <p className="eyebrow">Student portal</p>
              <h1>{studentProfile.name ? `Welcome back, ${studentProfile.name.split(' ')[0]} 👋` : 'Welcome back 👋'}</h1>
              <p>Here is an overview of your academic schedule, tests, and tasks.</p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="metric-card metric-card--attendance">
              <div>
                <p className="metric-card__label">Attendance</p>
                <p className="metric-card__value">—</p>
              </div>
              <div className="metric-card__icon"><CheckCircle2 size={20} /></div>
            </div>
            <div className="metric-card metric-card--pending">
              <div>
                <p className="metric-card__label">Pending Tasks</p>
                <p className="metric-card__value">{dashboardValue(assignments.filter((item) => item.status === 'Pending').length)}</p>
              </div>
              <div className="metric-card__icon"><Clock size={20} /></div>
            </div>
            <div className="metric-card metric-card--tests">
              <div>
                <p className="metric-card__label">Upcoming Tests</p>
                <p className="metric-card__value">{dashboardValue(upcomingTests.length)}</p>
              </div>
              <div className="metric-card__icon"><ClipboardList size={20} /></div>
            </div>
            <div className="metric-card metric-card--score">
              <div>
                <p className="metric-card__label">Avg Score</p>
                <p className="metric-card__value">—</p>
              </div>
              <div className="metric-card__icon"><Award size={20} /></div>
            </div>
          </div>

          <div className="dashboard-panel-grid">
            <div className="dashboard-panel student-profile-card">
              <div className="student-profile-header">
                <div className="student-avatar">{initials}</div>
                <div>
                  <h3>{studentProfile.name || '—'}</h3>
                  <p>{studentProfile.semester || '—'}</p>
                </div>
              </div>

              <div className="student-meta">
                <div className="student-meta-item"><span>Student ID</span><strong>{studentProfile.id || '—'}</strong></div>
                <div className="student-meta-item"><span>Course</span><strong>{studentProfile.course || '—'}</strong></div>
                <div className="student-meta-item"><span>Semester</span><strong>{studentProfile.semester || '—'}</strong></div>
                <div className="student-meta-item"><span>Year / Class</span><strong>{studentProfile.year || studentProfile.classLevel || '—'}</strong></div>
                <div className="student-meta-item"><span>Email</span><strong>{studentProfile.email || '—'}</strong></div>
                <div className="student-meta-item"><span>Stream</span><strong>{studentProfile.stream || '—'}</strong></div>
                <div className="student-meta-item"><span>Specialization</span><strong>{studentProfile.specialization || '—'}</strong></div>
              </div>
              <div className="student-subjects">
                <span>Current subjects</span>
                {studentProfile.subjects?.length ? <div>{studentProfile.subjects.map((subject) => <strong key={subject.name || subject}>{subject.name || subject}</strong>)}</div> : <p>No subjects provided</p>}
              </div>
            </div>

            <div className="progress-card">
              <div className="card-header">
                <h3>Attendance Overview</h3>
                <span className="card-pill">No data</span>
              </div>
              <div className="attendance-ring-wrap">
                <div className="attendance-empty-state">
                  <strong>No attendance data available</strong>
                  <p>Attendance will appear when records are published.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-panel doubt-panel">
            <div className="card-header">
              <h3 className="flex items-center gap-2"><MessageSquarePlus size={18} className="text-blue-600" /> Ask a Doubt</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-fit">
                <form onSubmit={handleAskDoubt} className="space-y-3">
                  <input type="text" required placeholder="Subject" value={subjectInput} onChange={(e) => setSubjectInput(e.target.value)} className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800" />
                  <textarea rows="3" required placeholder="Explain what concept you're stuck with..." className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800" value={questionInput} onChange={(e) => setQuestionInput(e.target.value)} />
                  <button type="submit" disabled={isSubmittingDoubt} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                    <Send size={14} /> {isSubmittingDoubt ? 'Submitting...' : 'Submit Query'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><HelpCircle size={18} className="text-blue-600" /> My Doubts & Instructor Feedback</h2>
                </div>
                <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto">
                  {doubts.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500">No doubts submitted yet.</div>
                  ) : doubts.map((item) => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{item.subject}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.status === 'Answered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800">{item.question}</p>
                      {item.reply && <div className="bg-emerald-50 border-l-2 border-emerald-500 p-2.5 rounded-r-lg"><p className="text-[11px] font-bold text-emerald-800">Teacher Response:</p><p className="text-xs text-emerald-900 mt-0.5">{item.reply}</p></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Assignments & Submissions</h1>
              <p className="text-xs text-slate-500">Track deadlines and upload your coursework</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {assignments.length === 0 ? (
              <div className="p-5 text-xs text-slate-500">No assignments available yet.</div>
            ) : assignments.map((item) => (
              <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{item.subject}</span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Clock size={13} /> Deadline: {item.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.status === 'Submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span>
                  {item.status === 'Pending' ? (
                    <button onClick={() => handleAssignmentSubmit(item.id)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"><UploadCloud size={14} /> Submit Work</button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 size={14} /> Handed In</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h1 className="text-xl font-bold text-slate-900">Scheduled Tests & Quizzes</h1>
            <p className="text-xs text-slate-500">View your upcoming evaluation schedule</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingTests.length === 0 ? (
              <div className="col-span-full bg-white p-5 rounded-xl border border-slate-200 text-xs text-slate-500">No upcoming tests yet.</div>
            ) : upcomingTests.map((test, index) => (
              <div key={test.id || index} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{test.subject}</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-2">{test.title}</h3>
                <div className="text-xs text-slate-500 space-y-1 mt-3"><p>📅 Date: {test.date}</p><p>⏰ Time: {test.time || 'TBD'} ({test.duration || 'Not set'})</p><p>🎯 Marks: {test.totalMarks || 'N/A'} Total</p></div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center"><span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Upcoming</span><button className="text-xs font-medium text-blue-600 hover:underline">Syllabus Details →</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h1 className="text-xl font-bold text-slate-900">Study Materials & Notes</h1>
            <p className="text-xs text-slate-500">Download lecture notes and syllabus resources</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {notes.length === 0 ? (
              <div className="col-span-full bg-white p-5 rounded-xl border border-slate-200 text-xs text-slate-500">No study notes available yet.</div>
            ) : notes.map((note) => (
              <div key={note.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><BookOpen size={18} /></div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">{note.subject}</span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">{note.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{note.format} • {note.size}</p>
                </div>
                <button onClick={() => alert(`Downloading ${note.title}...`)} className="mt-4 w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"><Download size={14} /> Download File</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h1 className="text-xl font-bold text-slate-900">Attendance Summary</h1>
            <p className="text-xs text-slate-500">Semester attendance metrics and breakdown</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Overall Attendance</p>
                <p className="text-3xl font-bold text-slate-400 mt-1">—</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-semibold border border-slate-200">No data</span>
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">No attendance data available.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai-helper' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[560px]">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><Sparkles size={16} /></div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AI Study Tutor</h2>
              <p className="text-[11px] text-slate-500">Ask doubts, generate quiz questions, or summarize lecture topics</p>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {aiChat.map((msg, idx) => (
              <div key={`${msg.sender}-${idx}`} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAiSend} className="p-3 border-t border-slate-100 flex gap-2">
            <input type="text" placeholder="e.g. Explain Dijkstra algorithm in 3 bullet points..." className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} disabled={isSubmittingAi} />
            <button type="submit" disabled={isSubmittingAi} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              <Send size={13} /> {isSubmittingAi ? 'Thinking...' : 'Ask AI'}
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
