const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');

const ensureClassroomRoleAccess = async (user, classroomId, allowedRoles = ['teacher']) => {
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    throw new Error('Classroom not found.');
  }

  const isTeacher = classroom.teacher.toString() === user._id.toString();
  const isStudent = classroom.students.some((id) => id.toString() === user._id.toString());

  if (!isTeacher && !isStudent) {
    throw new Error('You are not a member of this classroom.');
  }

  if (allowedRoles.includes('teacher') && user.role === 'teacher' && isTeacher) {
    return classroom;
  }

  if (allowedRoles.includes('student') && user.role === 'student' && isStudent) {
    return classroom;
  }

  if (user.role === 'teacher' && isTeacher) {
    return classroom;
  }

  if (user.role === 'student' && isStudent) {
    return classroom;
  }

  throw new Error('You do not have access to this classroom resource.');
};

const createAssignment = async (req, res) => {
  try {
    const { classroomId, title, description, dueDate } = req.body;

    if (!classroomId || !title || !dueDate) {
      return res.status(400).json({ message: 'Classroom, title, and due date are required.' });
    }

    const classroom = await ensureClassroomRoleAccess(req.user, classroomId, ['teacher']);
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the teacher can create assignments for this classroom.' });
    }

    const assignment = await Assignment.create({
      classroom: classroomId,
      title,
      description: description || '',
      dueDate: new Date(dueDate),
      createdBy: req.user._id,
      submissions: [],
    });

    return res.status(201).json({ message: 'Assignment created successfully.', assignment });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create assignment.' });
  }
};

const getAssignmentsByClassroom = async (req, res) => {
  try {
    const { classroomId } = req.params;
    await ensureClassroomRoleAccess(req.user, classroomId, ['teacher', 'student']);

    const assignments = await Assignment.find({ classroom: classroomId })
      .populate('createdBy', 'name')
      .sort({ dueDate: 1 });

    return res.status(200).json(assignments);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load assignments.' });
  }
};

const submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { text, link } = req.body;

    if ((!text || !text.trim()) && (!link || !link.trim())) {
      return res.status(400).json({ message: 'Provide a text answer or submission link.' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    await ensureClassroomRoleAccess(req.user, assignment.classroom, ['student']);

    const studentSubmission = assignment.submissions.find((item) => item.student.toString() === req.user._id.toString());
    if (studentSubmission) {
      return res.status(400).json({ message: 'You have already submitted this assignment.' });
    }

    assignment.submissions.push({
      student: req.user._id,
      text: text || '',
      link: link || '',
      status: 'submitted',
    });

    await assignment.save();

    return res.status(200).json({ message: 'Submission saved successfully.', assignment });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to submit assignment.' });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const { assignmentId, submissionId } = req.params;
    const { score, feedback } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ message: 'Score is required.' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    const classroom = await ensureClassroomRoleAccess(req.user, assignment.classroom, ['teacher']);
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the classroom teacher can grade this assignment.' });
    }

    const submission = assignment.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    submission.score = Number(score);
    submission.feedback = feedback || '';
    submission.status = 'graded';
    await assignment.save();

    return res.status(200).json({ message: 'Submission graded successfully.', assignment });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to grade submission.' });
  }
};

module.exports = { createAssignment, getAssignmentsByClassroom, submitAssignment, gradeSubmission };
