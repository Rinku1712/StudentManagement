const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createClassroom,
  getMyClassrooms,
  joinClassroom,
  getClassroomById,
} = require('../controllers/classroomController');
const {
  createAssignment,
  getAssignmentsByClassroom,
  submitAssignment,
  gradeSubmission,
} = require('../controllers/assignmentController');
const {
  createDiscussion,
  getDiscussionsByClassroom,
  addReply,
} = require('../controllers/discussionController');

const router = express.Router();

router.use(protect);

router.post('/', createClassroom);
router.get('/mine', getMyClassrooms);
router.post('/join', joinClassroom);

router.post('/:classroomId/assignments', createAssignment);
router.get('/:classroomId/assignments', getAssignmentsByClassroom);
router.post('/assignments/:assignmentId/submit', submitAssignment);
router.post('/assignments/:assignmentId/grade/:submissionId', gradeSubmission);

router.post('/:classroomId/discussions', createDiscussion);
router.get('/:classroomId/discussions', getDiscussionsByClassroom);
router.post('/discussions/:discussionId/replies', addReply);

router.get('/:id', getClassroomById);

module.exports = router;
