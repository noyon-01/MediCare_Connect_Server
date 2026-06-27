const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function run() {
  const uri = process.env.MongoDB_URI;
  if (!uri) {
    console.error("MongoDB_URI is not set in environment.");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for seeding...");
    const db = client.db("medicareconnect");
    
    const doctorsCollection = db.collection("doctors");
    const appointmentsCollection = db.collection("appointments");
    const reviewsCollection = db.collection("reviews");
    const usersCollection = db.collection("user");

    const doctors = await doctorsCollection.find({}).toArray();
    if (doctors.length === 0) {
      console.log("No doctors found to link appointments/reviews. Run server first to auto-seed doctors.");
      return;
    }

    // Seed dummy users if needed
    const userCount = await usersCollection.countDocuments();
    let samplePatients = [];
    if (userCount <= 3) {
      samplePatients = [
        {
          name: "Jane Smith",
          email: "jane.smith@example.com",
          role: "patient",
          createdAt: new Date()
        },
        {
          name: "Robert Downey",
          email: "robert.d@example.com",
          role: "patient",
          createdAt: new Date()
        },
        {
          name: "Emily Watson",
          email: "emily.w@example.com",
          role: "patient",
          createdAt: new Date()
        },
        {
          name: "Chris Evans",
          email: "chris.e@example.com",
          role: "patient",
          createdAt: new Date()
        }
      ];
      await usersCollection.insertMany(samplePatients);
      console.log("Seeded sample patient users.");
    }

    const patients = await usersCollection.find({ role: "patient" }).toArray();
    const patientList = patients.length > 0 ? patients : [{ _id: new ObjectId(), name: "John Doe", email: "john@example.com" }];

    // Seed appointments if fewer than 10
    const appCount = await appointmentsCollection.countDocuments();
    if (appCount < 10) {
      const sampleApps = [];
      const symptomsList = [
        "Routine cardiovascular checkup and mild chest tightness",
        "Persistent headaches and sleep disturbance",
        "Annual pediatric growth assessment",
        "Follow-up on lower back pain exercises",
        "Mild skin rash and allergy consultation",
        "Chronic knee discomfort during jogging",
        "Migraine monitoring and prescription adjustment"
      ];
      
      for (let i = 0; i < 15; i++) {
        const doc = doctors[i % doctors.length];
        const patient = patientList[i % patientList.length];
        const randomDaysAhead = Math.floor(Math.random() * 14) + 1;
        const appDate = new Date();
        appDate.setDate(appDate.getDate() + randomDaysAhead);
        
        sampleApps.push({
          patientId: patient._id.toString(),
          patientName: patient.name || "Patient " + (i + 1),
          patientEmail: patient.email || `patient${i}@example.com`,
          doctorId: doc._id.toString(),
          doctorName: doc.doctorName,
          appointmentDate: `Monday (${appDate.toISOString().slice(0, 10)})`,
          appointmentTime: doc.availableSlots[0] || "10:00 AM - 11:00 AM",
          symptoms: symptomsList[i % symptomsList.length],
          amount: doc.consultationFee,
          paymentStatus: "Paid",
          transactionId: "ch_mock_" + Math.random().toString(36).substring(2, 10),
          createdAt: new Date()
        });
      }
      await appointmentsCollection.insertMany(sampleApps);
      console.log(`Seeded ${sampleApps.length} sample appointments.`);
    }

    // Seed reviews if fewer than 12
    const revCount = await reviewsCollection.countDocuments();
    if (revCount < 12) {
      const sampleReviews = [];
      const reviewComments = [
        "Highly recommended. Listened carefully and provided great guidance.",
        "Excellent consultation. Very professional and friendly approach.",
        "Very clean clinic and wonderful bedside manners. Felt in safe hands.",
        "Clear explanations of diagnosis and treatments. Highly satisfied.",
        "Superb specialist. Took the time to detail options and address concerns.",
        "Wonderful experience, child-friendly environment and caring staff.",
        "Prompt, professional, and highly knowledgeable. Will consult again."
      ];

      for (let i = 0; i < 20; i++) {
        const doc = doctors[i % doctors.length];
        const patient = patientList[i % patientList.length];
        
        sampleReviews.push({
          patientId: patient._id.toString(),
          patientName: patient.name || "Patient " + (i + 1),
          doctorId: doc._id.toString(),
          doctorName: doc.doctorName,
          rating: i % 2 === 0 ? 5 : 4,
          reviewText: reviewComments[i % reviewComments.length],
          createdAt: new Date()
        });
      }
      await reviewsCollection.insertMany(sampleReviews);
      console.log(`Seeded ${sampleReviews.length} sample reviews.`);
    }

    // Migration mapping for unlinked reviews in database matching patient names
    const allUsers = await usersCollection.find({}).toArray();
    const userMap = new Map();
    allUsers.forEach(u => {
      if (u.name) userMap.set(u.name.toLowerCase(), u._id.toString());
    });
    
    const dbReviews = await reviewsCollection.find({}).toArray();
    let migratedCount = 0;
    for (const r of dbReviews) {
      if (!r.patientId && r.patientName) {
        const matchingId = userMap.get(r.patientName.toLowerCase());
        if (matchingId) {
          await reviewsCollection.updateOne({ _id: r._id }, { $set: { patientId: matchingId } });
          migratedCount++;
        }
      }
    }
    console.log(`Associated patientId to ${migratedCount} existing reviews.`);

    // Recompute average ratings
    const allDocs = await doctorsCollection.find({}).toArray();
    for (const doc of allDocs) {
      const reviews = await reviewsCollection.find({ doctorId: doc._id.toString() }).toArray();
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await doctorsCollection.updateOne(
          { _id: doc._id },
          { $set: { rating: parseFloat(avgRating.toFixed(1)) } }
        );
      }
    }
    console.log("Recalculated all doctor average ratings.");

  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await client.close();
    console.log("Seeding script finished.");
  }
}

run();
