const express = require('express');
const { collections } = require('../config/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// STRIPE PAYMENT INTENT (Fallback/legacy)
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(amount) * 100), // Stripe expects cents
      currency: 'usd',
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STRIPE CHECKOUT SESSIONS
router.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      doctorId,
      doctorName,
      appointmentDate,
      appointmentTime,
      symptoms,
      amount
    } = req.body;

    const clientUrl = (process.env.BETTER_AUTH_URL || 'http://localhost:3000').trim();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Consultation with Dr. ${doctorName}`,
            description: `Appointment on ${appointmentDate} at ${appointmentTime}`,
          },
          unit_amount: Math.round(parseFloat(amount) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${clientUrl}/dashboard/patient/appointments?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/doctors/${doctorId}`,
      metadata: {
        patientId,
        patientName,
        patientEmail,
        doctorId,
        doctorName,
        appointmentDate,
        appointmentTime,
        symptoms,
        amount: amount.toString(),
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STRIPE VERIFY CHECKOUT SESSION
router.post('/verify-checkout-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.json({ success: false, message: "Payment not completed" });
    }

    // Check if this checkout session has already been registered
    const existing = await collections.appointments.findOne({ checkoutSessionId: sessionId });
    if (existing) {
      return res.json({ success: true, alreadyRegistered: true, result: existing });
    }

    const appointment = {
      patientId: session.metadata.patientId,
      patientName: session.metadata.patientName,
      patientEmail: session.metadata.patientEmail,
      doctorId: session.metadata.doctorId,
      doctorName: session.metadata.doctorName,
      appointmentDate: session.metadata.appointmentDate,
      appointmentTime: session.metadata.appointmentTime,
      symptoms: session.metadata.symptoms,
      amount: parseFloat(session.metadata.amount),
      paymentStatus: 'Paid',
      transactionId: session.payment_intent || session.id,
      checkoutSessionId: sessionId,
      appointmentStatus: 'Pending',
      createdAt: new Date()
    };

    const result = await collections.appointments.insertOne(appointment);

    // Record the payment log
    await collections.payments.insertOne({
      appointmentId: result.insertedId.toString(),
      patientId: session.metadata.patientId,
      patientName: session.metadata.patientName,
      doctorId: session.metadata.doctorId,
      doctorName: session.metadata.doctorName,
      amount: parseFloat(session.metadata.amount),
      transactionId: session.payment_intent || session.id,
      paymentDate: new Date(),
      status: 'Paid'
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
