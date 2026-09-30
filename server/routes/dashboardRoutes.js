const express = require('express');
const { dataStore, createId } = require('../dataStore');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/student-profile', authorizeRoles('student'), (req, res) => {
  const userId = req.user._id ? String(req.user._id) : null;
  const academicProfile = req.user.academicProfile || {};

  res.json({
    name: req.user.name || null,
    id: userId,
    course: academicProfile.course || null,
    classLevel: academicProfile.classLevel || null,
    semester: academicProfile.semester || academicProfile.year || academicProfile.classLevel || null,
    year: academicProfile.year || null,
    stream: academicProfile.stream || null,
    specialization: academicProfile.specialization || null,
    subjects: academicProfile.subjects || [],
    email: req.user.email || null,
  });
});

router.get('/teacher-profile', authorizeRoles('teacher'), (req, res) => {
  res.json({
    name: req.user.name,
    email: req.user.email,
  });
});

router.get('/student/assignments', authorizeRoles('student', 'teacher'), (req, res) => {
  if (req.user.role === 'teacher') {
    return res.json(dataStore.assignments);
  }

  return res.json(dataStore.assignments.map((assignment) => ({
    ...assignment,
    status: assignment.submittedBy?.includes(String(req.user._id)) ? 'Submitted' : 'Pending',
  })));
});

router.post('/student/assignments', authorizeRoles('teacher'), (req, res) => {
  const { title, subject, dueDate } = req.body;
  if (!title?.trim() || !subject?.trim() || !dueDate?.trim()) {
    return res.status(400).json({ message: 'Title, subject, and due date are required.' });
  }

  const assignment = {
    id: createId(),
    title: title.trim(),
    subject: subject.trim(),
    dueDate: dueDate.trim(),
    submissions: 0,
    submittedBy: [],
    status: 'Pending',
  };

  dataStore.assignments.unshift(assignment);
  res.status(201).json(assignment);
});

router.put('/student/assignments/:id', authorizeRoles('student'), (req, res) => {
  if (!['Pending', 'Submitted'].includes(req.body.status)) {
    return res.status(400).json({ message: 'A valid assignment status is required.' });
  }

  const index = dataStore.assignments.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const assignment = dataStore.assignments[index];
  const studentId = String(req.user._id);

  if (req.body.status === 'Submitted' && !assignment.submittedBy?.includes(studentId)) {
    assignment.submittedBy = [...(assignment.submittedBy || []), studentId];
    assignment.submissions = assignment.submittedBy.length;
  }

  dataStore.assignments[index] = assignment;
  return res.json({
    ...assignment,
    status: 'Submitted',
  });
});

router.delete('/student/assignments/:id', authorizeRoles('teacher'), (req, res) => {
  const before = dataStore.assignments.length;
  dataStore.assignments = dataStore.assignments.filter((item) => item.id !== req.params.id);

  if (dataStore.assignments.length === before) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  return res.status(200).json({ message: 'Assignment deleted' });
});

router.get('/student/tests', authorizeRoles('student', 'teacher'), (req, res) => {
  res.json(dataStore.tests);
});

router.post('/student/tests', authorizeRoles('teacher'), (req, res) => {
  const { title, subject, date, totalMarks } = req.body;
  const marks = Number(totalMarks);
  if (!title?.trim() || !subject?.trim() || !date?.trim() || !Number.isFinite(marks) || marks <= 0) {
    return res.status(400).json({ message: 'Title, subject, date, and positive total marks are required.' });
  }

  const test = {
    id: createId(),
    title: title.trim(),
    subject: subject.trim(),
    date: date.trim(),
    totalMarks: marks,
  };
  dataStore.tests.unshift(test);
  res.status(201).json(test);
});

router.delete('/student/tests/:id', authorizeRoles('teacher'), (req, res) => {
  const before = dataStore.tests.length;
  dataStore.tests = dataStore.tests.filter((item) => item.id !== req.params.id);

  if (dataStore.tests.length === before) {
    return res.status(404).json({ message: 'Test not found' });
  }

  return res.status(200).json({ message: 'Test deleted' });
});

router.get('/student/notes', authorizeRoles('student'), (req, res) => {
  res.json(dataStore.notes);
});

router.get('/student/doubts', authorizeRoles('student', 'teacher'), (req, res) => {
  const doubts = req.user.role === 'teacher'
    ? dataStore.doubts
    : dataStore.doubts.filter((doubt) => doubt.studentId === String(req.user._id));
  res.json(doubts);
});

router.post('/student/doubts', authorizeRoles('student'), (req, res) => {
  const { subject, question } = req.body;
  if (!subject?.trim() || !question?.trim()) {
    return res.status(400).json({ message: 'Subject and question are required.' });
  }

  const doubt = {
    id: createId(),
    studentId: String(req.user._id),
    studentName: req.user.name,
    subject: subject.trim(),
    question: question.trim(),
    status: 'Pending',
    reply: '',
  };

  dataStore.doubts.unshift(doubt);
  return res.status(201).json(doubt);
});

router.post('/teacher/doubts/:id/reply', authorizeRoles('teacher'), (req, res) => {
  if (!req.body.reply?.trim()) {
    return res.status(400).json({ message: 'Reply is required.' });
  }

  const doubt = dataStore.doubts.find((item) => item.id === req.params.id);
  if (!doubt) {
    return res.status(404).json({ message: 'Doubt not found' });
  }

  doubt.reply = req.body.reply.trim();
  doubt.status = 'Answered';
  return res.json(doubt);
});

router.get('/teacher/submissions', authorizeRoles('teacher'), (req, res) => {
  res.json(dataStore.submissions);
});

router.get('/teacher/attendance', authorizeRoles('teacher'), (req, res) => {
  res.json(dataStore.attendance);
});

router.post('/teacher/attendance/:id/toggle', authorizeRoles('teacher'), (req, res) => {
  const record = dataStore.attendance.find((item) => item.id === req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Attendance record not found' });
  }

  record.present = !record.present;
  return res.json(record);
});

module.exports = router;
