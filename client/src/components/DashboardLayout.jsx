import {
  Bell,
  BookOpen,
  CalendarCheck,
  CheckSquare,
  ClipboardList,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DashboardLayout({ children, role = 'student', activeTab, setActiveTab }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const currentUser = useMemo(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      return storedUser || {};
    } catch {
      return {};
    }
  }, []);

  const displayName = currentUser?.name?.trim() || '—';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || '')
      .join('') || '—';

  const studentLinks = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'tests', label: 'Tests & Quizzes', icon: ClipboardList },
    { id: 'notes', label: 'Study Notes', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    {
      id: 'school-records',
      label: 'Fees & Report Card',
      icon: WalletCards,
      href: '/student/school-records',
    },
    { id: 'ai-helper', label: 'AI Study Assistant', icon: Sparkles },
  ];

  const teacherLinks = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'assignments', label: 'Manage Assignments', icon: FileText },
    { id: 'tests', label: 'Tests & Exams', icon: ClipboardList },
    { id: 'submissions', label: 'Review Submissions', icon: CheckSquare },
    { id: 'attendance', label: 'Attendance Register', icon: CalendarCheck },
    {
      id: 'school-records',
      label: 'Attendance & Marks',
      icon: FileCheck2,
      href: '/teacher/school-records',
    },
    { id: 'materials', label: 'Upload Materials', icon: BookOpen },
  ];

  const parentLinks = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'fees', label: 'Fees & Receipts', icon: WalletCards },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'report-card', label: 'Report Card', icon: FileCheck2 },
  ];
  const adminLinks = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students & Guardians', icon: UsersRound },
    { id: 'fees', label: 'Fee Management', icon: WalletCards },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'report-card', label: 'Marks & Reports', icon: FileCheck2 },
    { id: 'notifications', label: 'Notifications', icon: MessageCircle },
  ];
  const navLinks =
    role === 'teacher'
      ? teacherLinks
      : role === 'parent'
        ? parentLinks
        : role === 'principal' || role === 'super-admin'
          ? adminLinks
          : studentLinks;

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="dashboard-shell">
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="mobile-backdrop" />}

      <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-wrap">
            <div className="brand-mark">
              <GraduationCap size={18} />
            </div>
            <span className="brand-name">AcademiaOS</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="mobile-close-button"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-portal-label">
          <span>Workspace</span>
          <p>
            {role === 'teacher'
              ? 'Instructor Portal'
              : role === 'student'
                ? 'Student Portal'
                : `${role} Portal`}
          </p>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.href) {
                    navigate(item.href);
                    setSidebarOpen(false);
                    return;
                  }
                  if (setActiveTab) setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`nav-button ${isActive ? 'nav-button--active' : ''}`}
              >
                <Icon size={18} className="nav-button__icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleSignOut} className="signout-button">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="dashboard-main-panel">
        <header className="dashboard-header">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-menu-button"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="header-section-label hidden-mobile">
            Active Section: <span>{activeTab}</span>
          </div>

          <div className="header-actions">
            <button className="notification-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>

            <div className="profile-chip">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-meta">
                <p>{displayName}</p>
                <span>{role}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
