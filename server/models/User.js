const mongoose = require('mongoose');

const academicProfileSchema = new mongoose.Schema(
  {
    educationLevel: {
      type: String,
      enum: ['school', 'college'],
      default: null,
    },
    classLevel: { type: String, default: '' },
    stream: { type: String, default: '' },
    course: { type: String, default: '' },
    specialization: { type: String, default: '' },
    year: { type: String, default: '' },
    semester: { type: String, default: '' },
    guardianName: { type: String, default: '', trim: true },
    guardianEmail: { type: String, default: '', lowercase: true, trim: true },
    guardianPhone: { type: String, default: '', trim: true },
    subjects: [
      {
        name: { type: String, required: true, trim: true },
        subjectId: { type: String, trim: true },
      },
    ],
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false },
);

const teacherProfileSchema = new mongoose.Schema(
  {
    teacherId: { type: String, default: '', trim: true },
    teachingLevel: { type: String, default: '', trim: true },
    subjects: [
      {
        name: { type: String, required: true, trim: true },
        subjectId: { type: String, trim: true },
      },
    ],
    department: { type: String, default: '', trim: true },
    qualification: { type: String, default: '', trim: true },
    experience: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false },
);

const parentProfileSchema = new mongoose.Schema(
  {
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['super-admin', 'principal', 'teacher', 'student', 'parent'],
      default: 'student',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    academicProfile: {
      type: academicProfileSchema,
      default: () => ({ isCompleted: false, subjects: [] }),
    },
    teacherProfile: {
      type: teacherProfileSchema,
      default: () => ({ isCompleted: false, subjects: [] }),
    },
    parentProfile: {
      type: parentProfileSchema,
      default: () => ({ students: [] }),
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
