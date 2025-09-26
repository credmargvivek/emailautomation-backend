const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  email: {
    type: String,
  },
  picture: {
    type: String,
    // required: [true, "Profile picture is required"],
  },
},
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
