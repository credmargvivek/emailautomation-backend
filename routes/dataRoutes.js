//routes/dataRoutes.js
const express = require("express");
const User = require("../models/User");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.get("/userdata", async (req, res) => {
  const token = req.cookies.jwt;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if(!decoded) return res.json({ success: false, isAuthenticated: false });
      const user = await User.findOne({ email: decoded.email });
      res.json({ name: user.name, email: user.email, picture: user.picture, _id: user._id });
    } catch (err) {
      res.json({ success: false, isAuthenticated: false });
    }
  } else {
    res.json({ success: false, isAuthenticated: false });
  }
});

module.exports = router;
