const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../config/db');
const { verifySession } = require('../middleware/auth');

const router = express.Router();

// GET /api/doctors
router.get('/', async (req, res) => {
  try {
    const { search, specialization, sortBy, page = 1, limit = 10, all } = req.query;
    let query = {};
    
    // Hide unverified doctors from public search unless requested (all=true is for admin)
    if (all !== 'true') {
      query.verificationStatus = 'verified';
    }

    if (search) {
      query.doctorName = { $regex: search, $options: 'i' };
    }
    if (specialization) {
      query.specialization = specialization;
    }

    let sortOptions = {};
    if (sortBy === 'fee_asc') sortOptions.consultationFee = 1;
    if (sortBy === 'fee_desc') sortOptions.consultationFee = -1;
    if (sortBy === 'experience') sortOptions.experience = -1;
    if (sortBy === 'rating') sortOptions.rating = -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const doctors = await collections.doctors.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit)).toArray();
    const total = await collections.doctors.countDocuments(query);
    
    res.json({ doctors, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctors/:id
router.get('/:id', async (req, res) => {
  try {
    const doctor = await collections.doctors.findOne({ _id: new ObjectId(req.params.id) });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/doctors
router.post('/', verifySession, async (req, res) => {
  if (req.user.role !== 'doctor') {
    return res.status(403).json({ error: "Only doctors can configure their profile" });
  }
  try {
    const profile = req.body;
    const userId = req.user._id;

    const existing = await collections.doctors.findOne({ userId });
    let result;
    if (existing) {
      const updateData = { ...profile };
      delete updateData._id;
      delete updateData.userId;

      result = await collections.doctors.updateOne(
        { userId },
        { $set: { 
          ...updateData, 
          doctorName: req.user.name, 
          profileImage: updateData.profileImage || req.user.image 
        }}
      );
    } else {
      result = await collections.doctors.insertOne({
        ...profile,
        userId,
        doctorName: req.user.name,
        profileImage: profile.profileImage || req.user.image,
        verificationStatus: 'pending' // pending initially
      });
    }
    res.json({ acknowledged: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
