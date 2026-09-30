import {
  ArrowUpRight,
  Award,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

export default function SchoolDashboard() {
  const currentUser = getStoredUser();
  const role = currentUser.role || 'student';
  const dashboardRole =
    role === 'teacher'
      ? 'teacher'
      : role === 'parent'
        ? 'parent'
        : role === 'principal' || role === 'super-admin'
          ? 'principal'
          : 'student';

  const summaryCards = [
    {
      label: role === 'teacher' ? 'Class Average' : 'Current GPA',
      value: '89.4%',
      detail: 'up 4.2% from last term',
      icon: TrendingUp,
      tone: 'metric-card--score',
    },
    {
      label: role === 'teacher' ? 'Attendance Rate' : 'Attendance',
      value: '96.7%',
      detail: 'strong consistency this month',
      icon: ShieldCheck,
      tone: 'metric-card--attendance',
    },
    {
      label: role === 'teacher' ? 'Pending Reviews' : 'Fees Due',
      value: role === 'teacher' ? '12' : '₹12,500',
      detail: role === 'teacher' ? 'awaiting grade checks' : 'next due in 10 days',
      icon: role === 'teacher' ? FileSpreadsheet : CreditCard,
      tone: 'metric-card--pending',
    },
  ];

  const records = [
    { item: 'Semester Report', value: 'Term 1', status: 'Published' },
    { item: 'Tuition Fees', value: '₹24,000', status: 'Paid' },
    { item: 'Exam Performance', value: '93 / 100', status: 'Excellent' },
    { item: 'Progress Note', value: 'On track', status: 'Reviewed' },
  ];

  return (
    <DashboardLayout role={dashboardRole} activeTab="school-records" setActiveTab={() => {}}>
      <div className="dashboard-overview">
        <div className="overview-header">
          <div>
            <p className="eyebrow">Academic records</p>
            <h1>
              {role === 'teacher'
                ? 'Classroom performance overview'
                : 'School records and progress'}
            </h1>
            <p>
              Track fees, report cards, attendance, and the latest academic updates for your
              academic cycle.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          {summaryCards.map(({ label, value, detail, icon: Icon, tone }) => (
            <div key={label} className={`metric-card ${tone}`}>
              <div>
                <p className="metric-card__label">{label}</p>
                <p className="metric-card__value">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{detail}</p>
              </div>
              <div className="metric-card__icon">
                <Icon size={20} />
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-panel-grid">
          <div className="dashboard-panel">
            <div className="panel-header">
              <div className="panel-header__title-wrap">
                <GraduationCap size={18} />
                <h2>Latest academic records</h2>
              </div>
              <button type="button" className="panel-action-button">
                View full report <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="records-list">
              {records.map((record) => (
                <div key={record.item} className="record-row">
                  <div>
                    <p className="record-row__title">{record.item}</p>
                    <p className="record-row__meta">{record.value}</p>
                  </div>
                  <span className="status-pill status-pill--success">{record.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="panel-header">
              <div className="panel-header__title-wrap">
                <ReceiptText size={18} />
                <h2>Quick actions</h2>
              </div>
            </div>

            <div className="quick-actions">
              <button type="button" className="action-button">
                <Award size={16} />
                Download report card
              </button>
              <button type="button" className="action-button">
                <FileSpreadsheet size={16} />
                Export marksheet
              </button>
              <button type="button" className="action-button">
                <CreditCard size={16} />
                Review fee summary
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
