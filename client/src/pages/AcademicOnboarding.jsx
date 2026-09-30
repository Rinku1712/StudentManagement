import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../services/api';

const schoolClasses = Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`);
const schoolStreams = ['Science', 'Commerce', 'Arts / Humanities', 'Vocational', 'Other'];
const collegeCourses = ['BCA', 'B.Tech', 'B.Sc', 'B.Com', 'BBA', 'BA', 'MCA', 'M.Tech', 'MBA', 'M.Sc', 'M.Com', 'Other'];
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const semesters = Array.from({ length: 8 }, (_, index) => `Semester ${index + 1}`);
const schoolSubjectSuggestions = ['Mathematics', 'English', 'Hindi', 'Science', 'Social Science', 'Computer'];
const streamSubjectSuggestions = {
  Science: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'English'],
  Commerce: ['Accountancy', 'Business Studies', 'Economics', 'Mathematics', 'Computer Science', 'English'],
  'Arts / Humanities': ['History', 'Political Science', 'Geography', 'Economics', 'Sociology', 'Psychology', 'English'],
};
const specializationSuggestions = {
  BTech: ['Computer Science', 'IT', 'Mechanical', 'Civil', 'Electronics', 'Electrical', 'Other'],
  BCA: ['General', 'AI / ML', 'Data Science', 'Cloud Computing', 'Other'],
  BCom: ['General', 'Accounting', 'Finance', 'Banking', 'Other'],
  BSc: ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Other'],
  BBA: ['Finance', 'Marketing', 'HR', 'International Business', 'Other'],
};

const emptyProfile = {
  educationLevel: '',
  classLevel: '',
  stream: '',
  course: '',
  specialization: '',
  year: '',
  semester: '',
  subjects: [],
};

const normalizeCourseKey = (course) => course?.replace(/\W/g, '') || '';

export default function AcademicOnboarding({ user, onComplete }) {
  const [profile, setProfile] = useState({ ...emptyProfile, ...(user?.academicProfile || {}) });
  const [step, setStep] = useState(0);
  const [subjectText, setSubjectText] = useState('');
  const [backendSubjects, setBackendSubjects] = useState([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    apiRequest('/api/profile/subject-options')
      .then((result) => {
        if (isMounted) setBackendSubjects(Array.isArray(result?.subjects) ? result.subjects : []);
      })
      .catch(() => {
        if (isMounted) setBackendSubjects([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSubjects(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isSeniorSchool = profile.educationLevel === 'school' && ['Class 11', 'Class 12'].includes(profile.classLevel);
  const isCollege = profile.educationLevel === 'college';
  const hasSpecializationStep = isSeniorSchool || isCollege;
  const steps = useMemo(() => {
    const nextSteps = ['Education level', isCollege ? 'Course and period' : 'Class or grade'];
    if (hasSpecializationStep) nextSteps.push(isCollege ? 'Stream or specialization' : 'School stream');
    nextSteps.push('Subjects', 'Review and save');
    return nextSteps;
  }, [hasSpecializationStep, isCollege]);

  const suggestionNames = useMemo(() => {
    if (backendSubjects.length) return backendSubjects.map((subject) => typeof subject === 'string' ? subject : subject.name).filter(Boolean);
    if (isSeniorSchool) return streamSubjectSuggestions[profile.stream] || [];
    if (profile.educationLevel === 'school') return schoolSubjectSuggestions;
    return [];
  }, [backendSubjects, isSeniorSchool, profile.educationLevel, profile.stream]);

  const updateProfile = (changes) => setProfile((current) => ({ ...current, ...changes }));
  const selectedSubjectNames = profile.subjects.map((subject) => typeof subject === 'string' ? subject : subject.name);

  const addSubject = (name) => {
    const cleanName = name.trim();
    if (!cleanName || selectedSubjectNames.some((subject) => subject.toLowerCase() === cleanName.toLowerCase())) return;
    updateProfile({ subjects: [...profile.subjects, { name: cleanName }] });
    setSubjectText('');
  };

  const removeSubject = (name) => updateProfile({ subjects: profile.subjects.filter((subject) => (typeof subject === 'string' ? subject : subject.name) !== name) });

  const validateStep = () => {
    if (step === 0 && !profile.educationLevel) return 'Choose your education level.';
    if (step === 1) {
      if (isCollege && !profile.course.trim()) return 'Choose or enter your course.';
      if (!isCollege && !profile.classLevel) return 'Choose your class or grade.';
      if (isCollege && !profile.year && !profile.semester) return 'Choose a year or semester.';
    }
    if (hasSpecializationStep && step === 2 && (!profile.stream && !profile.specialization)) return 'Complete the stream or specialization field.';
    if (steps[step] === 'Subjects' && !profile.subjects.length) return 'Select or add at least one subject.';
    return '';
  };

  const handleNext = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSave = async () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setIsSaving(true);
      setError('');
      const result = await apiRequest('/api/profile/academic', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      const nextUser = result.user || { ...user, academicProfile: { ...profile, isCompleted: true } };
      localStorage.setItem('user', JSON.stringify({
        ...user,
        id: nextUser.id || user?.id,
        name: nextUser.name || user?.name,
        email: nextUser.email || user?.email,
        role: nextUser.role || user?.role,
        academicProfile: nextUser.academicProfile || { ...profile, isCompleted: true },
      }));
      onComplete();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save your academic profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentStep = steps[step];
  const selectedCourseSuggestions = specializationSuggestions[normalizeCourseKey(profile.course)] || [];

  return (
    <main className="academic-onboarding-page">
      <section className="academic-onboarding-card">
        <div className="academic-onboarding-brand">
          <div className="brand-mark"><GraduationCap size={20} /></div>
          <span>AcademiaOS</span>
        </div>
        <div className="academic-onboarding-intro">
          <p className="eyebrow">Academic profile setup</p>
          <h1>Tell us what you are studying</h1>
          <p>This helps personalize your workspace. You can update these details later.</p>
        </div>
        <div className="academic-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((label, index) => (
            <div className={`academic-progress-step ${index <= step ? 'is-active' : ''}`} key={label}>
              <span>{index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        <div className="academic-onboarding-body">
          {currentStep === 'Education level' && (
            <div className="academic-choice-grid">
              <button type="button" className={`academic-choice ${profile.educationLevel === 'school' ? 'is-selected' : ''}`} onClick={() => updateProfile({ educationLevel: 'school', course: '', specialization: '', year: '', semester: '' })}>
                <strong>School</strong><span>Classes 1 to 12</span>
              </button>
              <button type="button" className={`academic-choice ${profile.educationLevel === 'college' ? 'is-selected' : ''}`} onClick={() => updateProfile({ educationLevel: 'college', classLevel: '', stream: '' })}>
                <strong>College / University</strong><span>Degree, diploma, or program</span>
              </button>
            </div>
          )}

          {currentStep === 'Class or grade' && (
            <div className="academic-field-group"><label htmlFor="classLevel">What class or grade are you currently in?</label><select id="classLevel" value={profile.classLevel} onChange={(event) => updateProfile({ classLevel: event.target.value })}><option value="">Choose a class</option>{schoolClasses.map((item) => <option key={item}>{item}</option>)}</select></div>
          )}

          {currentStep === 'Course and period' && (
            <div className="academic-field-stack">
              <div className="academic-field-group"><label htmlFor="course">Which course or program are you studying?</label><input id="course" list="course-options" value={profile.course} onChange={(event) => updateProfile({ course: event.target.value })} placeholder="Search or enter a course" /><datalist id="course-options">{collegeCourses.map((course) => <option key={course} value={course} />)}</datalist></div>
              <div className="academic-two-column"><div className="academic-field-group"><label htmlFor="year">Year</label><select id="year" value={profile.year} onChange={(event) => updateProfile({ year: event.target.value })}><option value="">Not provided</option>{years.map((year) => <option key={year}>{year}</option>)}</select></div><div className="academic-field-group"><label htmlFor="semester">Semester</label><select id="semester" value={profile.semester} onChange={(event) => updateProfile({ semester: event.target.value })}><option value="">Not provided</option>{semesters.map((semester) => <option key={semester}>{semester}</option>)}</select></div></div>
            </div>
          )}

          {currentStep === 'School stream' && <div className="academic-field-group"><label htmlFor="schoolStream">Which stream are you studying?</label><select id="schoolStream" value={profile.stream} onChange={(event) => updateProfile({ stream: event.target.value })}><option value="">Choose a stream</option>{schoolStreams.map((stream) => <option key={stream}>{stream}</option>)}</select></div>}

          {currentStep === 'Stream or specialization' && <div className="academic-field-group"><label htmlFor="specialization">Do you have a stream or specialization?</label><select id="specialization" value={profile.specialization} onChange={(event) => updateProfile({ specialization: event.target.value })}><option value="">Choose a specialization</option>{selectedCourseSuggestions.map((item) => <option key={item}>{item}</option>)}<option value="Other">Other</option></select>{profile.specialization === 'Other' && <input className="academic-followup-input" value={profile.stream} onChange={(event) => updateProfile({ stream: event.target.value })} placeholder="Enter your stream or specialization" />}</div>}

          {currentStep === 'Subjects' && (
            <div className="academic-subjects-step">
              <div><h2>Choose your current subjects</h2><p>Suggestions are optional. Add the subjects you actually study.</p></div>
              {isLoadingSubjects ? <p className="academic-empty-state">Loading available subjects...</p> : suggestionNames.length ? <div className="academic-suggestions">{suggestionNames.map((subject) => <button type="button" key={subject} className={selectedSubjectNames.includes(subject) ? 'is-selected' : ''} onClick={() => selectedSubjectNames.includes(subject) ? removeSubject(subject) : addSubject(subject)}>{selectedSubjectNames.includes(subject) && <Check size={14} />}{subject}</button>)}</div> : <p className="academic-empty-state">No subjects have been added yet.</p>}
              <div className="academic-add-subject"><input value={subjectText} onChange={(event) => setSubjectText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubject(subjectText); } }} placeholder="Add a custom subject" /><button type="button" onClick={() => addSubject(subjectText)}><Plus size={15} /> Add</button></div>
              <div className="academic-selected-subjects">{profile.subjects.map((subject) => { const name = typeof subject === 'string' ? subject : subject.name; return <span key={name}>{name}<button type="button" aria-label={`Remove ${name}`} onClick={() => removeSubject(name)}><Trash2 size={13} /></button></span>; })}</div>
            </div>
          )}

          {currentStep === 'Review and save' && <div className="academic-review"><h2>Review your profile</h2>{[['Education level', profile.educationLevel], ['Class / course', profile.classLevel || profile.course], ['Stream / specialization', profile.stream || profile.specialization], ['Year', profile.year], ['Semester', profile.semester], ['Subjects', profile.subjects.map((subject) => typeof subject === 'string' ? subject : subject.name).join(', ') || '—']].map(([label, value]) => <div className="academic-review-row" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}</div>}
        </div>

        {error && <p className="academic-form-error" role="alert">{error}</p>}
        <div className="academic-onboarding-actions"><button type="button" className="secondary-action" onClick={handleBack} disabled={step === 0}><ArrowLeft size={16} /> Back</button>{step < steps.length - 1 ? <button type="button" className="primary-action" onClick={handleNext}>Next <ArrowRight size={16} /></button> : <button type="button" className="primary-action" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save profile'} <Check size={16} /></button>}</div>
      </section>
    </main>
  );
}
