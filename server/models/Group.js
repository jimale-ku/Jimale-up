// models/Group.js
const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], required: true },
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  members:  [groupMemberSchema], // Array of { user, role }
  waitingList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  list: { type: mongoose.Schema.Types.ObjectId, ref: 'List', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
