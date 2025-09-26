const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Campaign owner is required"],
  },
  name: {
    type: String,
    required: [true, "Campaign name is required"],
    trim: true,
  },

  data: [
    {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      fullName: { type: String, trim: true },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      domain: { type: String, trim: true },
      companyName: { type: String, trim: true },
      isVerified: {type:Boolean, default:false}
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Campaign', campaignSchema);
