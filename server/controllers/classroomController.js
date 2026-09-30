const Classroom = require('../models/Classroom');
const User = require('../models/User');

const generateAccessCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const createClassroom = async (req, res) => {
  try {
    const { name, subject, description } = req.body;

    if (!name || !subject) {
      return res.status(400).json({ message: 'Classroom name and subject are required.' });
    }

    let accessCode = generateAccessCode();
    let exists = await Classroom.findOne({ accessCode });

    while (exists) {
      accessCode = generateAccessCode();
      exists = await Classroom.findOne({ accessCode });
    }

    const classroom = await Classroom.create({
      name,
      subject,
      description: description || '',
      teacher: req.user._id,
      accessCode,
      students: [],
    });

    return res.status(201).json({
      message: 'Classroom created successfully.',
      classroom,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create classroom.' });
  }
};

const getMyClassrooms = async (req, res) => {
  try {
    const filter = req.user.role === 'teacher' ? { teacher: req.user._id } : { students: req.user._id };
    const classrooms = await Classroom.find(filter)
      .populate('teacher', 'name email')
      .populate('students', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json(classrooms);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load classrooms.' });
  }
};

const joinClassroom = async (req, res) => {
  try {
    const { accessCode } = req.body;

    if (!accessCode) {
      return res.status(400).json({ message: 'Access code is required.' });
    }

    const classroom = await Classroom.findOne({ accessCode: accessCode.toUpperCase() });
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found with this access code.' });
    }

    if (classroom.teacher.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Teacher cannot join their own classroom as a student.' });
    }

    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already enrolled in this classroom.' });
    }

    classroom.students.push(req.user._id);
    await classroom.save();

    return res.status(200).json({
      message: 'Successfully joined classroom.',
      classroom,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to join classroom.' });
  }
};

const getClassroomById = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('students', 'name email role');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }

    const isTeacher = classroom.teacher._id.toString() === req.user._id.toString();
    const isStudent = classroom.students.some((student) => student._id.toString() === req.user._id.toString());

    if (!isTeacher && !isStudent) {
      return res.status(403).json({ message: 'You are not a member of this classroom.' });
    }

    return res.status(200).json(classroom);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load classroom details.' });
  }
};

module.exports = { createClassroom, getMyClassrooms, joinClassroom, getClassroomById };
