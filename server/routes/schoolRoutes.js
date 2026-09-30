const express = require('express');
const PDFDocument = require('pdfkit');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const { isDatabaseConnected } = require('../config/db');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { sendGuardianAlert } = require('../services/notificationService');

const router = express.Router();
const staffRoles = ['super-admin', 'principal', 'teacher'];
const managementRoles = ['super-admin', 'principal'];
router.use(protect);

const requireDatabase = (req, res, next) => {
  if (!isDatabaseConnected())
    return res
      .status(503)
      .json({ message: 'School management requires a connected MongoDB database.' });
  return next();
};

const listAccessibleStudents = async (user, requestedId) => {
  if (user.role === 'student') {
    return User.find({ _id: user._id, ...(requestedId ? { _id: requestedId } : {}) }).select(
      'name email academicProfile',
    );
  }
  if (user.role === 'parent') {
    return User.find({
      'academicProfile.guardianEmail': user.email,
      ...(requestedId ? { _id: requestedId } : {}),
    }).select('name email academicProfile');
  }
  if (staffRoles.includes(user.role)) {
    return User.find({ role: 'student', ...(requestedId ? { _id: requestedId } : {}) }).select(
      'name email academicProfile',
    );
  }
  return [];
};

const accessibleStudentIds = async (user) =>
  (await listAccessibleStudents(user)).map((student) => student._id);
const canManageRecords = (user) => managementRoles.includes(user.role) || user.role === 'teacher';

router.get('/students', requireDatabase, authorizeRoles(...staffRoles), async (req, res) => {
  const students = await User.find({ role: 'student' }).select('name email academicProfile');
  res.json(
    students.map((student) => ({
      id: String(student._id),
      name: student.name,
      email: student.email,
      classLevel: student.academicProfile?.classLevel || student.academicProfile?.course || '—',
      guardianEmail: student.academicProfile?.guardianEmail || '',
    })),
  );
});

router.get('/fees', requireDatabase, async (req, res) => {
  const students = await listAccessibleStudents(req.user, req.query.studentId);
  if (req.query.studentId && !students.length)
    return res.status(403).json({ message: 'You cannot access this student’s fee records.' });
  const fees = await Fee.find({ student: { $in: students.map((student) => student._id) } })
    .populate('student', 'name email')
    .sort({ dueDate: -1 });
  res.json(fees);
});

router.post('/fees', requireDatabase, authorizeRoles(...managementRoles), async (req, res) => {
  const { studentId, title, amount, dueDate } = req.body;
  const numericAmount = Number(amount);
  const student = await User.findOne({ _id: studentId, role: 'student' });
  if (
    !student ||
    !title?.trim() ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !dueDate ||
    Number.isNaN(Date.parse(dueDate))
  ) {
    return res.status(400).json({
      message: 'Choose a student and provide a title, positive amount, and valid due date.',
    });
  }
  const fee = await Fee.create({
    student: student._id,
    title: title.trim(),
    amount: numericAmount,
    dueDate,
    recordedBy: req.user._id,
  });
  const alerts = await sendGuardianAlert(
    student,
    `Fee reminder: ${student.name} has ${fee.title} dues of ${fee.amount}. Due date: ${fee.dueDate.toLocaleDateString()}.`,
  );
  res.status(201).json({ fee, alerts });
});

router.post(
  '/fees/:id/mark-paid',
  requireDatabase,
  authorizeRoles(...managementRoles),
  async (req, res) => {
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ message: 'Fee record not found.' });
    if (fee.status !== 'paid') {
      fee.status = 'paid';
      fee.paidAt = new Date();
      fee.receiptNumber = `AC-${Date.now().toString(36).toUpperCase()}`;
      await fee.save();
    }
    res.json(fee);
  },
);

router.get('/fees/:id/receipt', requireDatabase, async (req, res) => {
  const fee = await Fee.findById(req.params.id).populate('student', 'name email');
  if (!fee) return res.status(404).json({ message: 'Fee record not found.' });
  const students = await listAccessibleStudents(req.user, String(fee.student._id));
  if (!students.length) return res.status(403).json({ message: 'You cannot access this receipt.' });
  if (fee.status !== 'paid')
    return res.status(409).json({ message: 'Receipt is available after the fee is marked paid.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${fee.receiptNumber}.pdf"`);
  const document = new PDFDocument({ margin: 56 });
  document.pipe(res);
  document.fontSize(22).text('AcademiaOS', { align: 'center' });
  document.moveDown(0.5).fontSize(16).text('Fee Payment Receipt', { align: 'center' });
  document.moveDown(2).fontSize(12);
  document.text(`Receipt number: ${fee.receiptNumber}`);
  document.text(`Student: ${fee.student.name}`);
  document.text(`Email: ${fee.student.email}`);
  document.text(`Fee: ${fee.title}`);
  document.text(`Amount paid: INR ${fee.amount.toFixed(2)}`);
  document.text(`Paid on: ${fee.paidAt.toLocaleDateString()}`);
  document.end();
});

router.get('/attendance', requireDatabase, async (req, res) => {
  const students = await listAccessibleStudents(req.user, req.query.studentId);
  if (req.query.studentId && !students.length)
    return res.status(403).json({ message: 'You cannot access this student’s attendance.' });
  const records = await Attendance.find({
    student: { $in: students.map((student) => student._id) },
  })
    .populate('student', 'name email')
    .sort({ date: -1 });
  res.json(records);
});

router.post(
  '/attendance/bulk',
  requireDatabase,
  authorizeRoles(...staffRoles),
  async (req, res) => {
    const { date, records, term = '' } = req.body;
    if (!date || Number.isNaN(Date.parse(date)) || !Array.isArray(records) || !records.length) {
      return res
        .status(400)
        .json({ message: 'A valid date and at least one attendance record are required.' });
    }
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const results = [];
    for (const item of records) {
      if (!item.studentId || typeof item.present !== 'boolean') continue;
      const student = await User.findOne({ _id: item.studentId, role: 'student' });
      if (!student) continue;
      const record = await Attendance.findOneAndUpdate(
        { student: student._id, date: day },
        { student: student._id, date: day, present: item.present, term, markedBy: req.user._id },
        { upsert: true, new: true, runValidators: true },
      );
      results.push(record);
      if (!item.present)
        await sendGuardianAlert(
          student,
          `Attendance alert: ${student.name} was marked absent on ${day.toLocaleDateString()}.`,
        );
    }
    res.json({ saved: results.length, records: results });
  },
);

router.post('/marks', requireDatabase, authorizeRoles(...staffRoles), async (req, res) => {
  const { studentId, subject, semester, marks, totalMarks } = req.body;
  const score = Number(marks);
  const maximum = Number(totalMarks);
  const student = await User.findOne({ _id: studentId, role: 'student' });
  if (
    !student ||
    !subject?.trim() ||
    !semester?.trim() ||
    !Number.isFinite(score) ||
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    score < 0 ||
    score > maximum
  ) {
    return res
      .status(400)
      .json({ message: 'Provide a student, subject, semester, and marks within the total.' });
  }
  const mark = await Mark.findOneAndUpdate(
    { student: student._id, subject: subject.trim(), semester: semester.trim() },
    {
      student: student._id,
      subject: subject.trim(),
      semester: semester.trim(),
      marks: score,
      totalMarks: maximum,
      recordedBy: req.user._id,
    },
    { upsert: true, new: true, runValidators: true },
  );
  res.json(mark);
});

router.get('/report-card', requireDatabase, async (req, res) => {
  const students = await listAccessibleStudents(req.user, req.query.studentId);
  if (req.query.studentId && !students.length)
    return res.status(403).json({ message: 'You cannot access this report card.' });
  const marks = await Mark.find({ student: { $in: students.map((student) => student._id) } })
    .populate('student', 'name email academicProfile')
    .sort({ semester: 1, subject: 1 });
  res.json(marks);
});

router.post(
  '/notifications/fee-reminders',
  requireDatabase,
  authorizeRoles(...managementRoles),
  async (req, res) => {
    const pendingFees = await Fee.find({ status: 'pending' }).populate(
      'student',
      'name academicProfile',
    );
    const results = await Promise.all(
      pendingFees.map(async (fee) => ({
        feeId: String(fee._id),
        student: fee.student.name,
        channels: await sendGuardianAlert(
          fee.student,
          `Fee reminder: ${fee.student.name} has ${fee.title} dues of ${fee.amount}. Due date: ${fee.dueDate.toLocaleDateString()}.`,
        ),
      })),
    );
    res.json({ reminders: results.length, results });
  },
);

router.put(
  '/students/:id/guardian',
  requireDatabase,
  authorizeRoles(...managementRoles),
  async (req, res) => {
    const guardianName = String(req.body.guardianName || '').trim();
    const guardianEmail = String(req.body.guardianEmail || '')
      .trim()
      .toLowerCase();
    const guardianPhone = String(req.body.guardianPhone || '').trim();
    if (!guardianEmail.includes('@'))
      return res.status(400).json({ message: 'Enter a valid parent or guardian email.' });
    const student = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'student' },
      {
        'academicProfile.guardianName': guardianName,
        'academicProfile.guardianEmail': guardianEmail,
        'academicProfile.guardianPhone': guardianPhone,
      },
      { new: true },
    ).select('name email academicProfile');
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.json({
      message: 'Parent contact linked. The parent must register with this email.',
      student,
    });
  },
);

module.exports = router;
