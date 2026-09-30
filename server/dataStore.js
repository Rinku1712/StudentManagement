const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const dataStore = {
  users: [],
  assignments: [],
  tests: [],
  doubts: [],
  submissions: [],
  attendance: [],
  notes: [],
  profile: {
    student: {},
    teacher: {},
  },
};

module.exports = { dataStore, createId };
