import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AcademicOnboarding from './pages/AcademicOnboarding';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import SchoolDashboard from './pages/SchoolDashboard';
import Signup from './pages/Signup';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherOnboarding from './pages/TeacherOnboarding';
import VerifyOtp from './pages/VerifyOtp';

function ProtectedRoute({
  role,
  children,
  requireAcademicProfile = false,
  requireTeacherProfile = false,
}) {
  const token = localStorage.getItem('token');
  let user;

  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return <Navigate to="/" replace />;
  }

  if (!token || !user?.role) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}/dashboard`} replace />;
  if (requireAcademicProfile && !user.academicProfile?.isCompleted) {
    return <AcademicOnboarding user={user} onComplete={() => window.location.reload()} />;
  }
  if (requireTeacherProfile && !user.teacherProfile?.isCompleted) {
    return <TeacherOnboarding user={user} onComplete={() => window.location.reload()} />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute role="student" requireAcademicProfile>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/school-records"
          element={
            <ProtectedRoute role="student" requireAcademicProfile>
              <SchoolDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/onboarding"
          element={
            <ProtectedRoute role="teacher" requireTeacherProfile>
              <TeacherOnboarding
                user={JSON.parse(localStorage.getItem('user') || '{}')}
                onComplete={() => window.location.reload()}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute role="teacher" requireTeacherProfile>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/school-records"
          element={
            <ProtectedRoute role="teacher" requireTeacherProfile>
              <SchoolDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/dashboard"
          element={
            <ProtectedRoute role="parent">
              <SchoolDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/dashboard"
          element={
            <ProtectedRoute role="principal">
              <SchoolDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/dashboard"
          element={
            <ProtectedRoute role="super-admin">
              <SchoolDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
