const express = require("express");
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// POST /api/appointments
router.post("/appointments", async (req, res) => {
  try {
    const appointment = {
      ...req.body,
      appointmentStatus: "Pending",
      createdAt: new Date(),
    };
    const result = await collections.appointments.insertOne(appointment);

    if (req.body.paymentStatus === "Paid") {
      await collections.payments.insertOne({
        appointmentId: result.insertedId.toString(),
        patientId: req.body.patientId,
        patientName: req.body.patientName,
        doctorId: req.body.doctorId,
        doctorName: req.body.doctorName,
        amount: req.body.amount,
        transactionId: req.body.transactionId,
        paymentDate: new Date(),
        status: "Paid",
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-appointments
router.get("/my-appointments", async (req, res) => {
  try {
    const { patientId, doctorId } = req.query;
    let query = {};
    if (patientId) query.patientId = patientId;
    if (doctorId) query.doctorId = doctorId;
    const appointments = await collections.appointments.find(query).toArray();
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/appointments/:id
router.patch("/appointments/:id", async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const updateData = { ...req.body };

    // Find existing appointment first
    const appointment = await collections.appointments.findOne({
      _id: new ObjectId(appointmentId),
    });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if status is transitioning to Cancelled
    if (
      updateData.appointmentStatus === "Cancelled" &&
      appointment.appointmentStatus !== "Cancelled"
    ) {
      if (appointment.paymentStatus === "Paid") {
        updateData.paymentStatus = "Refunded";

        // Process Stripe refund if there is a real transaction ID
        const transactionId = appointment.transactionId;
        if (
          transactionId &&
          !transactionId.startsWith("ch_mock_") &&
          !transactionId.startsWith("pi_mock_") &&
          !transactionId.includes("mock")
        ) {
          try {
            await stripe.refunds.create({
              payment_intent: transactionId,
            });
            console.log(
              `Successfully processed Stripe refund for appointment ${appointmentId}`,
            );
          } catch (stripeErr) {
            console.error(
              `Stripe refund failed for transaction ${transactionId}:`,
              stripeErr.message,
            );
            // Try fallback to charge parameter
            try {
              await stripe.refunds.create({
                charge: transactionId,
              });
              console.log(
                `Successfully processed Stripe fallback refund for appointment ${appointmentId}`,
              );
            } catch (fallbackErr) {
              console.error(
                `Stripe fallback refund failed:`,
                fallbackErr.message,
              );
            }
          }
        }

        // Update payment transaction document status to 'Refunded'
        try {
          await collections.payments.updateOne(
            { appointmentId: appointmentId },
            { $set: { status: "Refunded", refundedAt: new Date() } },
          );
        } catch (dbErr) {
          console.error(
            `Failed to update payments collection for appointment ${appointmentId}:`,
            dbErr,
          );
        }
      }
    }

    const result = await collections.appointments.updateOne(
      { _id: new ObjectId(appointmentId) },
      { $set: updateData },
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/appointments/:id
router.delete("/appointments/:id", async (req, res) => {
  try {
    const result = await collections.appointments.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
