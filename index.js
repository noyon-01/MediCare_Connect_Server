require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB, collections } = require("./config/db");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  "https://medi-care-connect-client.vercel.app",
];
if (process.env.BETTER_AUTH_URL) {
  allowedOrigins.push(process.env.BETTER_AUTH_URL.trim());
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// Database connection middleware for Serverless environment
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res
      .status(500)
      .json({ error: "Database connection failed: " + err.message });
  }
});

// JWT ROUTE
app.post("/api/jwt", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await collections.users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role || "patient",
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || "fallback-secret-key-123",
      { expiresIn: "7d" },
    );

    res.cookie("token", token, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send("MediCare Connect Server is running successfully!");
});

// CORE STATUS/HEALTH CHECK API
app.get("/api/status", (req, res) => {
  res.json({ success: true, message: "MediCare Connect API Running" });
});

app.get("/api/stats", async (req, res) => {
  try {
    const doctorsCount = await collections.doctors.countDocuments({
      verificationStatus: "verified",
    });
    const appointmentsCount = await collections.appointments.countDocuments();
    const reviewsCount = await collections.reviews.countDocuments();
    const uniquePatients = await collections.appointments
      .aggregate([{ $group: { _id: "$patientId" } }])
      .toArray();

    // Add realistic baseline offsets for a premium, established look
    const displayDoctors = doctorsCount > 0 ? doctorsCount + 140 : 150;
    const displayAppointments =
      appointmentsCount > 0 ? appointmentsCount + 2450 : 2500;
    const displayReviews = reviewsCount > 0 ? reviewsCount + 780 : 800;
    const displayPatients = Math.max(10000, uniquePatients.length + 9980);

    res.json({
      doctors: displayDoctors,
      patients: displayPatients,
      appointments: displayAppointments,
      reviews: displayReviews,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import modular routes
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Mount modular routes
app.use("/api/doctors", doctorRoutes);
app.use("/api", appointmentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api", paymentRoutes);
app.use("/api/admin", adminRoutes);

async function run() {
  try {
    // Connect to database
    await connectDB();

    // Auto-seed doctors if empty or less than 10
    const docCount = await collections.doctors.countDocuments();
    if (docCount < 10) {
      await collections.doctors.deleteMany({});
      await collections.reviews.deleteMany({}); // Keep reviews in sync
      const sampleDoctors = [
        {
          doctorName: "Dr. Sarah Jenkins",
          specialization: "Cardiology",
          qualifications: "MD, FACC",
          experience: 12,
          consultationFee: 150,
          hospitalName: "City General Hospital",
          profileImage: "https://i.pravatar.cc/150?img=43",
          availableDays: ["Monday", "Wednesday", "Friday"],
          availableSlots: ["09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM"],
          verificationStatus: "verified",
          rating: 4.9,
        },
        {
          doctorName: "Dr. Michael Chang",
          specialization: "Neurology",
          qualifications: "MD, PhD",
          experience: 15,
          consultationFee: 200,
          hospitalName: "Neurological Care Center",
          profileImage: "https://i.pravatar.cc/150?img=12",
          availableDays: ["Tuesday", "Thursday"],
          availableSlots: ["02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM"],
          verificationStatus: "verified",
          rating: 4.8,
        },
        {
          doctorName: "Dr. Emily Rodriguez",
          specialization: "Pediatrics",
          qualifications: "MD, FAAP",
          experience: 8,
          consultationFee: 100,
          hospitalName: "Metro Children's Clinic",
          profileImage: "https://i.pravatar.cc/150?img=49",
          availableDays: ["Monday", "Tuesday", "Thursday"],
          availableSlots: ["10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM"],
          verificationStatus: "verified",
          rating: 5.0,
        },
        {
          doctorName: "Dr. David Kim",
          specialization: "Orthopedics",
          qualifications: "MD, FAAOS",
          experience: 10,
          consultationFee: 180,
          hospitalName: "Orthopedic & Joint Center",
          profileImage: "https://i.pravatar.cc/150?img=33",
          availableDays: ["Wednesday", "Friday"],
          availableSlots: ["03:00 PM - 04:00 PM", "04:00 PM - 05:00 PM"],
          verificationStatus: "verified",
          rating: 4.7,
        },
        {
          doctorName: "Dr. Sophia Martinez",
          specialization: "Dermatology",
          qualifications: "MD, FAAD",
          experience: 7,
          consultationFee: 120,
          hospitalName: "Skin & Laser Clinic",
          profileImage: "https://i.pravatar.cc/150?img=28",
          availableDays: ["Tuesday", "Friday"],
          availableSlots: ["09:00 AM - 10:00 AM", "04:00 PM - 05:00 PM"],
          verificationStatus: "verified",
          rating: 4.9,
        },
        {
          doctorName: "Dr. James Wilson",
          specialization: "Orthopedics",
          qualifications: "MD, PhD",
          experience: 14,
          consultationFee: 190,
          hospitalName: "City Ortho Care Clinic",
          profileImage: "https://i.pravatar.cc/150?img=68",
          availableDays: ["Monday", "Thursday"],
          availableSlots: ["09:00 AM - 10:00 AM", "03:00 PM - 04:00 PM"],
          verificationStatus: "verified",
          rating: 4.8,
        },
        {
          doctorName: "Dr. Lisa Anderson",
          specialization: "Cardiology",
          qualifications: "MD, FACC",
          experience: 9,
          consultationFee: 160,
          hospitalName: "Heart & Vascular Institute",
          profileImage: "https://i.pravatar.cc/150?img=47",
          availableDays: ["Tuesday", "Wednesday", "Friday"],
          availableSlots: ["10:00 AM - 11:00 AM", "02:00 PM - 03:00 PM"],
          verificationStatus: "verified",
          rating: 4.9,
        },
        {
          doctorName: "Dr. Robert Taylor",
          specialization: "Pediatrics",
          qualifications: "MD, FAAP",
          experience: 11,
          consultationFee: 110,
          hospitalName: "Valley Kids Hospital",
          profileImage: "https://i.pravatar.cc/150?img=59",
          availableDays: ["Wednesday", "Thursday"],
          availableSlots: ["11:00 AM - 12:00 PM", "04:00 PM - 05:00 PM"],
          verificationStatus: "verified",
          rating: 4.6,
        },
        {
          doctorName: "Dr. Patricia Thomas",
          specialization: "Dermatology",
          qualifications: "MD, FAAD",
          experience: 13,
          consultationFee: 130,
          hospitalName: "Dermatological Care Clinic",
          profileImage: "https://i.pravatar.cc/150?img=34",
          availableDays: ["Monday", "Friday"],
          availableSlots: ["09:00 AM - 10:00 AM", "03:00 PM - 04:00 PM"],
          verificationStatus: "verified",
          rating: 4.7,
        },
        {
          doctorName: "Dr. William White",
          specialization: "Neurology",
          qualifications: "MD, PhD",
          experience: 16,
          consultationFee: 220,
          hospitalName: "Brain & Nerve Center",
          profileImage: "https://i.pravatar.cc/150?img=11",
          availableDays: ["Monday", "Tuesday"],
          availableSlots: ["10:00 AM - 11:00 AM", "02:00 PM - 03:00 PM"],
          verificationStatus: "verified",
          rating: 4.9,
        },
      ];
      await collections.doctors.insertMany(sampleDoctors);
      console.log("Seeded default doctors.");

      const docs = await collections.doctors.find().toArray();
      const sampleReviews = [
        {
          patientName: "John Doe",
          doctorId: docs[0]._id.toString(),
          doctorName: docs[0].doctorName,
          rating: 5,
          reviewText:
            "Dr. Jenkins was extremely professional and explained everything in clear detail. Her diagnosis was spot on.",
          createdAt: new Date(),
        },
        {
          patientName: "Alice Smith",
          doctorId: docs[1]._id.toString(),
          doctorName: docs[1].doctorName,
          rating: 5,
          reviewText:
            "Excellent neurological consultation. Highly knowledgeable and caring specialist.",
          createdAt: new Date(),
        },
        {
          patientName: "Robert Johnson",
          doctorId: docs[2]._id.toString(),
          doctorName: docs[2].doctorName,
          rating: 4,
          reviewText:
            "Great experience at the pediatric clinic. Very friendly staff and child-friendly environment.",
          createdAt: new Date(),
        },
      ];
      await collections.reviews.insertMany(sampleReviews);
      console.log("Seeded default reviews.");
    }

    // Auto-migrate any mismatched or orphaned doctorId in appointments, reviews, payments, prescriptions
    try {
      const allDoctors = await collections.doctors.find({}).toArray();
      const doctorMap = new Map();
      allDoctors.forEach((doc) => {
        doctorMap.set(doc.doctorName, doc._id.toString());
      });

      // Update appointments
      const allAppointments = await collections.appointments.find({}).toArray();
      for (const app of allAppointments) {
        const correctId = doctorMap.get(app.doctorName);
        if (correctId && app.doctorId !== correctId) {
          await collections.appointments.updateOne(
            { _id: app._id },
            { $set: { doctorId: correctId } },
          );
        }
      }

      // Update reviews
      const allReviews = await collections.reviews.find({}).toArray();
      for (const rev of allReviews) {
        const correctId = doctorMap.get(rev.doctorName);
        if (correctId && rev.doctorId !== correctId) {
          await collections.reviews.updateOne(
            { _id: rev._id },
            { $set: { doctorId: correctId } },
          );
        }
      }

      // Update payments
      const allPayments = await collections.payments.find({}).toArray();
      for (const pm of allPayments) {
        const correctId = doctorMap.get(pm.doctorName);
        if (correctId && pm.doctorId !== correctId) {
          await collections.payments.updateOne(
            { _id: pm._id },
            { $set: { doctorId: correctId } },
          );
        }
      }

      // Update prescriptions
      const allPrescriptions = await collections.prescriptions
        .find({})
        .toArray();
      const { ObjectId } = require("mongodb");
      for (const pr of allPrescriptions) {
        if (pr.appointmentId) {
          let appQueryId = pr.appointmentId;
          if (
            typeof appQueryId === "string" &&
            appQueryId.length === 24 &&
            /^[0-9a-fA-F]{24}$/.test(appQueryId)
          ) {
            appQueryId = new ObjectId(appQueryId);
          } else if (appQueryId instanceof ObjectId) {
            // Keep as is
          } else {
            // Skip invalid ID formats
            continue;
          }

          const app = await collections.appointments.findOne({
            _id: appQueryId,
          });
          if (app && pr.doctorId !== app.doctorId) {
            await collections.prescriptions.updateOne(
              { _id: pr._id },
              { $set: { doctorId: app.doctorId } },
            );
          }
        }
      }

      // Re-calculate all doctor average ratings based on reviews
      for (const doc of allDoctors) {
        const reviews = await collections.reviews
          .find({ doctorId: doc._id.toString() })
          .toArray();
        if (reviews.length > 0) {
          const avgRating =
            reviews.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0) /
            reviews.length;
          await collections.doctors.updateOne(
            { _id: doc._id },
            { $set: { rating: parseFloat(avgRating.toFixed(1)) } },
          );
        }
      }
      console.log(
        "Database doctorId and ratings integrity checked and updated.",
      );
    } catch (err) {
      console.error("Failed to run doctorId migration check:", err);
    }
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`MediCare Connect Server is running on port ${port}`);
});

module.exports = app;
