const express = require("express");
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");

const router = express.Router();

// POST /api/reviews
router.post("/", async (req, res) => {
  try {
    const result = await collections.reviews.insertOne({
      ...req.body,
      createdAt: new Date(),
    });

    // Dynamically compute average rating for the doctor and update the doctor document
    const reviews = await collections.reviews
      .find({ doctorId: req.body.doctorId })
      .toArray();
    const avgRating =
      reviews.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0) /
      reviews.length;
    await collections.doctors.updateOne(
      { _id: new ObjectId(req.body.doctorId) },
      { $set: { rating: parseFloat(avgRating.toFixed(1)) } },
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews
router.get("/", async (req, res) => {
  try {
    const { doctorId, patientId, limit } = req.query;
    let query = {};
    if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;

    let cursor = collections.reviews.find(query);
    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }
    const reviews = await cursor.toArray();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reviews/:id
router.patch("/:id", async (req, res) => {
  try {
    const result = await collections.reviews.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reviews/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await collections.reviews.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
