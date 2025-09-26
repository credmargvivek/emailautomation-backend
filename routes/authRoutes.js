// routes/authRoutes.js
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google-auth', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
     
    
    console.log('payload --->',payload);
    
    const { email, sub: googleId, name, picture } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        name,
        picture,
      });
      await user.save();
    }

    const jwtToken = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.cookie('jwt', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // sameSite: 'strict',
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: 'Authentication successful' });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ success: false, error: 'Invalid Google token' });
  }
});

router.get('/check-auth', (req, res) => {
  const token = req.cookies.jwt;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.json({ success: true, isAuthenticated: true, email: decoded.email });
    } catch (err) {
      res.json({ success: false, isAuthenticated: false });
    }
  } else {
    res.json({ success: false, isAuthenticated: false });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // sameSite: 'strict',
    sameSite:'none'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});


module.exports = router;