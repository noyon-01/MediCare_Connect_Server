const express = require("express");
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");

const router = express.Router();

// POST /api/prescriptions
router.post("/", async (req, res) => {
  try {
    const result = await collections.prescriptions.insertOne({
      ...req.body,
      createdAt: new Date(),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prescriptions
router.get("/", async (req, res) => {
  try {
    const prescriptions = await collections.prescriptions
      .find(req.query)
      .toArray();
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/prescriptions/:id
router.patch("/:id", async (req, res) => {
  try {
    const result = await collections.prescriptions.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/prescriptions/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await collections.prescriptions.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
