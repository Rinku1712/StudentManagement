const Discussion = require('../models/Discussion');
const Classroom = require('../models/Classroom');

const ensureClassroomAccess = async (user, classroomId) => {
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    throw new Error('Classroom not found.');
  }

  const isTeacher = classroom.teacher.toString() === user._id.toString();
  const isStudent = classroom.students.some((id) => id.toString() === user._id.toString());

  if (!isTeacher && !isStudent) {
    throw new Error('You are not a member of this classroom.');
  }

  return classroom;
};

const createDiscussion = async (req, res) => {
  try {
    const { classroomId, content } = req.body;

    if (!classroomId || !content || !content.trim()) {
      return res.status(400).json({ message: 'Classroom and content are required.' });
    }

    await ensureClassroomAccess(req.user, classroomId);

    const discussion = await Discussion.create({
      classroom: classroomId,
      author: req.user._id,
      authorRole: req.user.role,
      content: content.trim(),
    });

    return res.status(201).json({ message: 'Question posted successfully.', discussion });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create discussion.' });
  }
};

const getDiscussionsByClassroom = async (req, res) => {
  try {
    const { classroomId } = req.params;
    await ensureClassroomAccess(req.user, classroomId);

    const discussions = await Discussion.find({ classroom: classroomId })
      .populate('author', 'name role email')
      .sort({ createdAt: -1 });

    return res.status(200).json(discussions);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load discussions.' });
  }
};

const addReply = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { content, isSolution } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply content is required.' });
    }

    const discussion = await Discussion.findById(discussionId).populate('author', 'name');
    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found.' });
    }

    const classroom = await ensureClassroomAccess(req.user, discussion.classroom);
    const isTeacher = classroom.teacher.toString() === req.user._id.toString();

    if (isSolution && !isTeacher) {
      return res.status(403).json({ message: 'Only the teacher can mark a reply as the official solution.' });
    }

    discussion.replies.push({
      author: req.user._id,
      authorRole: req.user.role,
      content: content.trim(),
      isSolution: Boolean(isSolution),
    });

    if (isSolution) {
      discussion.isResolved = true;
    }

    await discussion.save();

    return res.status(200).json({ message: 'Reply added successfully.', discussion });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to add reply.' });
  }
};

module.exports = { createDiscussion, getDiscussionsByClassroom, addReply };
