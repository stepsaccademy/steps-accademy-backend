require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Content = require("./models/Content");

const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "arishusm12an@gmail.com";
const ADMIN_PASSWORD = "admin123";

const TEACHER_PASSWORD = "Teacher@12345";

const teachers = [
  {
    name: "muhammad saad",
    username: "muhammmadsaad",
    subject: "Physics & Mathematics",
  },
  {
    name: "Imtiyaz Hussain",
    username: "imtiyaz.hussain",
    subject: "Islamic Studies & Pak Studies",
  },
  {
    name: "Khadim Rafique",
    username: "khadim.rafique",
    subject: "English",
  },
  {
    name: "Bilal Ahmad",
    username: "bilal.ahmad",
    subject: "Urdu",
  },
  {
    name: "Amer Raza",
    username: "amer.raza",
    subject: "Biology",
  },
  {
    name: "Dr. Hamza Farooq",
    username: "hamza.farooq",
    subject: "Chemistry",
  },
  {
    name: "Sara Ahmed",
    username: "sara.ahmed",
    subject: "Computer Science",
  },
  {
    name: "Muhammad Kashif",
    username: "muhammad.kashif",
    subject: "Chemistry",
  },
];

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    // ==========================================
    // ADMIN
    // ==========================================

    const adminPasswordHash = await bcrypt.hash(
      ADMIN_PASSWORD,
      12
    );

    await User.findOneAndUpdate(
      { username: ADMIN_USERNAME },
      {
        $set: {
          name: "Step Academy Principal",
          username: ADMIN_USERNAME,
          email: ADMIN_EMAIL,
          passwordHash: adminPasswordHash,
          role: "admin",
          active: true,
        },
        $setOnInsert: {
          phone: "",
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    console.log("Admin created/reset successfully");
    console.log(`Admin username: ${ADMIN_USERNAME}`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);

    // ==========================================
    // TEACHERS
    // ==========================================

    const teacherPasswordHash = await bcrypt.hash(
      TEACHER_PASSWORD,
      12
    );

    for (const teacher of teachers) {
      await User.findOneAndUpdate(
        { username: teacher.username },
        {
          $set: {
            name: teacher.name,
            username: teacher.username,
            passwordHash: teacherPasswordHash,
            role: "teacher",
            subjects: [teacher.subject],
            teacherId: teacher.username.replace(/\./g, "-"),
            active: true,
          },
          $setOnInsert: {
            email: "arishusm12an@gmail.com",
            phone: "",
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      console.log(`Teacher ready: ${teacher.username}`);
    }

    // ==========================================
    // APPROVE EXISTING ANNOUNCEMENTS
    // ==========================================

    if (Content) {
      await Content.updateMany(
        { type: "announcement" },
        { $set: { status: "approved" } }
      );
    }

    console.log("");
    console.log("==========================================");
    console.log("STEP ACADEMY SEED COMPLETE");
    console.log("==========================================");
    console.log("");
    console.log("ADMIN");
    console.log(`Username: ${ADMIN_USERNAME}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log("");
    console.log("TEACHERS");
    console.log(`Password for all teachers: ${TEACHER_PASSWORD}`);
    console.log("");
    console.log("Database is ready.");
    console.log("==========================================");

    await mongoose.disconnect();
  } catch (error) {
    console.error("");
    console.error("SEED ERROR:");
    console.error(error);
    console.error("");

    try {
      await mongoose.disconnect();
    } catch {}

    process.exit(1);
  }
}

seed();