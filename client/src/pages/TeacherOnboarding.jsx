import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, UserCircle2 } from 'lucide-react';
import { apiRequest } from '../services/api';

const defaultProfile = {
  teacherId: '',
  teachingLevel: '',
  subjects: [],
  department: '',
  qualification: '',
  experience: '',
  bio: '',
};

const suggestedSubjects = [
  'Mathematics',
  'English',
  'Physics',
  'Chemistry',
  'Computer Science',
  'Data Structures',
  'DBMS',
  'Operating Systems',
  'Web Development',
  'Algorithms',
  'Biology',
  'Economics',
  'History',
  'Psychology',
  'Art',
];

export default function TeacherOnboarding({ user, onComplete }) {
  const [profile, setProfile] = useState({
    ...defaultProfile,
    ...(user?.teacherProfile || {}),
  });
  const [customSubject, setCustomSubject] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedSubjects = useMemo(
    () => profile.subjects.map((subject) => (typeof subject === 'string' ? subject : subject.name)).filter(Boolean),
    [profile.subjects]
  );

  const updateProfile = (changes) => setProfile((current) => ({ ...current, ...changes }));

  const addSubject = (subjectName) => {
    const value = subjectName.trim();
    if (!value || selectedSubjects.some((subject) => subject.toLowerCase() === value.toLowerCase())) return;
    updateProfile({ subjects: [...profile.subjects, { name: value }] });
    setCustomSubject('');
  };

  const removeSubject = (subjectName) => {
    updateProfile({
      subjects: profile.subjects.filter((subject) => (typeof subject === 'string' ? subject : subject.name) !== subjectName),
    });
  };

  const handleSubmit = async () => {
    if (!profile.teacherId.trim()) {
      setError('Teacher ID is required.');
      return;
    }

    if (!profile.teachingLevel) {
      setError('Please choose what you teach.');
      return;
    }

    if (!selectedSubjects.length) {
      setError('Add at least one subject you teach.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      const result = await apiRequest('/api/profile/teacher', {
        method: 'PUT',
        body: JSON.stringify({ ...profile, subjects: profile.subjects }),
      });

      const nextUser = result.user || { ...user, teacherProfile: { ...profile, isCompleted: true } };
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...user,
          id: nextUser.id || user?.id,
          name: nextUser.name || user?.name,
          email: nextUser.email || user?.email,
          role: nextUser.role || user?.role,
          academicProfile: nextUser.academicProfile || user?.academicProfile || { isCompleted: false, subjects: [] },
          teacherProfile: nextUser.teacherProfile || { ...profile, isCompleted: true },
        })
      );
      onComplete();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save your teacher profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="academic-onboarding-page">
      <section className="academic-onboarding-card" style={{ maxWidth: 760 }}>
        <div className="academic-onboarding-brand">
          <div className="brand-mark"><UserCircle2 size={20} /></div>
          <span>AcademiaOS</span>
        </div>

        <div className="academic-onboarding-intro">
          <p className="eyebrow">Teacher profile setup</p>
          <h1>Complete your teaching profile</h1>
          <p>Set up your teacher ID, subjects, and basic academic details before accessing the instructor dashboard.</p>
        </div>

        <div className="academic-onboarding-body">
          <div className="academic-field-group">
            <label htmlFor="teacherId">Teacher ID</label>
            <input
              id="teacherId"
              value={profile.teacherId}
              onChange={(event) => updateProfile({ teacherId: event.target.value })}
              placeholder="TCH-2026-001"
            />
          </div>

          <div className="academic-field-group">
            <label htmlFor="teachingLevel">What do you teach?</label>
            <select
              id="teachingLevel"
              value={profile.teachingLevel}
              onChange={(event) => updateProfile({ teachingLevel: event.target.value })}
            >
              <option value="">Select level</option>
              <option value="School">School</option>
              <option value="College / University">College / University</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="academic-subjects-step">
            <div>
              <h2>Which subject(s) do you teach?</h2>
              <p>Select an existing subject or add your own.</p>
            </div>

            <div className="academic-suggestions">
              {suggestedSubjects.map((subject) => (
                <button
                  type="button"
                  key={subject}
                  className={selectedSubjects.includes(subject) ? 'is-selected' : ''}
                  onClick={() =>
                    selectedSubjects.includes(subject)
                      ? removeSubject(subject)
                      : addSubject(subject)
                  }
                >
                  {selectedSubjects.includes(subject) && <Check size={14} />}
                  {subject}
                </button>
              ))}
            </div>

            <div className="academic-add-subject">
              <input
                value={customSubject}
                onChange={(event) => setCustomSubject(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSubject(customSubject);
                  }
                }}
                placeholder="Add custom subject"
              />
              <button type="button" onClick={() => addSubject(customSubject)}>
                <Plus size={15} /> Add
              </button>
            </div>

            <div className="academic-selected-subjects">
              {selectedSubjects.map((subjectName) => (
                <span key={subjectName}>
                  {subjectName}
                  <button type="button" aria-label={`Remove ${subjectName}`} onClick={() => removeSubject(subjectName)}>
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="academic-two-column">
            <div className="academic-field-group">
              <label htmlFor="department">Department</label>
              <input
                id="department"
                value={profile.department}
                onChange={(event) => updateProfile({ department: event.target.value })}
                placeholder="Computer Science"
              />
            </div>
            <div className="academic-field-group">
              <label htmlFor="qualification">Qualification</label>
              <input
                id="qualification"
                value={profile.qualification}
                onChange={(event) => updateProfile({ qualification: event.target.value })}
                placeholder="M.Tech / Ph.D."
              />
            </div>
          </div>

          <div className="academic-two-column">
            <div className="academic-field-group">
              <label htmlFor="experience">Experience</label>
              <input
                id="experience"
                value={profile.experience}
                onChange={(event) => updateProfile({ experience: event.target.value })}
                placeholder="5 years"
              />
            </div>
            <div className="academic-field-group">
              <label htmlFor="bio">Short bio</label>
              <input
                id="bio"
                value={profile.bio}
                onChange={(event) => updateProfile({ bio: event.target.value })}
                placeholder="Optional summary"
              />
            </div>
          </div>
        </div>

        {error && <p className="academic-form-error" role="alert">{error}</p>}

        <div className="academic-onboarding-actions">
          <button type="button" className="secondary-action" onClick={() => window.location.reload()}>
            <ArrowLeft size={16} /> Exit
          </button>
          <button type="button" className="primary-action" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save teacher profile'}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}
