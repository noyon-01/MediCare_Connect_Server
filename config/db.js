const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MongoDB_URI;
if (!uri) {
  console.error("MongoDB_URI is not set in environment.");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("medicareconnect");

// Database collections
const collections = {
  users: db.collection("user"),
  doctors: db.collection("doctors"),
  appointments: db.collection("appointments"),
  reviews: db.collection("reviews"),
  payments: db.collection("payments"),
  prescriptions: db.collection("prescriptions"),
  session: db.collection("session"),
};

async function connectDB() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}

module.exports = {
  client,
  db,
  collections,
  connectDB,
};
