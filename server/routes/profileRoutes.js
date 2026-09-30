const express = require('express');
const User = require('../models/User');
const { dataStore } = require('../dataStore');
const { isDatabaseConnected } = require('../config/db');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const normalizeSubjects = (subjects) =>
  (Array.isArray(subjects) ? subjects : [])
    .map((subject) => ({
      name: typeof subject === 'string' ? subject.trim() : subject?.name?.trim(),
      subjectId: typeof subject === 'object' ? subject.subjectId?.trim() : undefined,
    }))
    .filter((subject) => subject.name)
    .filter(
      (subject, index, list) =>
        list.findIndex((item) => item.name.toLowerCase() === subject.name.toLowerCase()) === index,
    );

const sanitizeTeacherProfile = (profile = {}) => ({
  teacherId: String(profile.teacherId || '').trim(),
  teachingLevel: String(profile.teachingLevel || '').trim(),
  subjects: normalizeSubjects(profile.subjects || []),
  department: String(profile.department || '').trim(),
  qualification: String(profile.qualification || '').trim(),
  experience: String(profile.experience || '').trim(),
  bio: String(profile.bio || '').trim(),
  isCompleted: Boolean(profile.isCompleted),
});

const validateAcademicProfile = (profile) => {
  if (!profile || !['school', 'college'].includes(profile.educationLevel)) {
    return 'Choose whether you are studying at school or college/university.';
  }

  if (profile.educationLevel === 'school') {
    if (!/^Class (?:[1-9]|1[0-2])$/.test(profile.classLevel || ''))
      return 'Choose a valid school class.';
    if (['Class 11', 'Class 12'].includes(profile.classLevel) && !profile.stream?.trim())
      return 'Choose a school stream.';
  }

  if (profile.educationLevel === 'college' && !profile.course?.trim())
    return 'Enter your course or program.';
  if (profile.educationLevel === 'college' && !profile.year?.trim() && !profile.semester?.trim())
    return 'Choose a year or semester.';
  if (!normalizeSubjects(profile.subjects).length) return 'Add at least one current subject.';
  return null;
};

const validateTeacherProfile = (profile) => {
  if (!profile.teacherId?.trim()) return 'Teacher ID is required.';
  if (!['School', 'College / University', 'Other'].includes(profile.teachingLevel || ''))
    return 'Choose a valid teaching level.';
  if (!normalizeSubjects(profile.subjects || []).length)
    return 'Add at least one subject you teach.';
  return null;
};

const serializeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  academicProfile: user.academicProfile || { isCompleted: false, subjects: [] },
  teacherProfile: user.teacherProfile || { isCompleted: false, subjects: [] },
});

router.get('/academic', protect, (req, res) => {
  res.json(req.user.academicProfile || { isCompleted: false, subjects: [] });
});

router.put('/academic', protect, authorizeRoles('student'), async (req, res) => {
  try {
    const profile = {
      educationLevel: req.body.educationLevel,
      classLevel: req.body.classLevel?.trim() || '',
      stream: req.body.stream?.trim() || '',
      course: req.body.course?.trim() || '',
      specialization: req.body.specialization?.trim() || '',
      year: req.body.year?.trim() || '',
      semester: req.body.semester?.trim() || '',
      guardianName: req.body.guardianName?.trim() || '',
      guardianEmail: req.body.guardianEmail?.trim().toLowerCase() || '',
      guardianPhone: req.body.guardianPhone?.trim() || '',
      subjects: normalizeSubjects(req.body.subjects),
      isCompleted: false,
    };
    const validationError = validateAcademicProfile(profile);
    if (validationError) return res.status(400).json({ message: validationError });
    profile.isCompleted = true;

    if (isDatabaseConnected()) {
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { academicProfile: profile },
        { new: true },
      ).select('-password');
      return res.json({ message: 'Academic profile saved.', user: serializeUser(user) });
    }

    const user = dataStore.users.find(
      (storedUser) => String(storedUser._id) === String(req.user._id),
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.academicProfile = profile;
    return res.json({ message: 'Academic profile saved.', user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to save academic profile.' });
  }
});

router.get('/teacher', protect, authorizeRoles('teacher'), async (req, res) => {
  const user = isDatabaseConnected()
    ? await User.findById(req.user._id).select('-password')
    : dataStore.users.find((storedUser) => String(storedUser._id) === String(req.user._id));

  if (!user) return res.status(404).json({ message: 'Teacher profile not found.' });
  return res.json(user.teacherProfile || { isCompleted: false, subjects: [] });
});

router.put('/teacher', protect, authorizeRoles('teacher'), async (req, res) => {
  try {
    const profile = sanitizeTeacherProfile({
      ...req.body,
      isCompleted: true,
    });

    const validationError = validateTeacherProfile(profile);
    if (validationError) return res.status(400).json({ message: validationError });

    if (isDatabaseConnected()) {
      const existingUser = await User.findOne({
        'teacherProfile.teacherId': profile.teacherId,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res
          .status(400)
          .json({ message: 'Teacher ID already exists. Please use a unique ID.' });
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { teacherProfile: profile },
        { new: true },
      ).select('-password');

      return res.json({ message: 'Teacher profile saved.', user: serializeUser(user) });
    }

    const user = dataStore.users.find(
      (storedUser) => String(storedUser._id) === String(req.user._id),
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const duplicateId = dataStore.users.some(
      (storedUser) =>
        String(storedUser._id) !== String(req.user._id) &&
        storedUser.teacherProfile?.teacherId?.toLowerCase() === profile.teacherId.toLowerCase(),
    );

    if (duplicateId) {
      return res
        .status(400)
        .json({ message: 'Teacher ID already exists. Please use a unique ID.' });
    }

    user.teacherProfile = profile;
    return res.json({ message: 'Teacher profile saved.', user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to save teacher profile.' });
  }
});

router.get('/subject-options', protect, authorizeRoles('student'), (req, res) => {
  res.json({ subjects: [] });
});

module.exports = router;
