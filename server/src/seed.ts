import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Admin, User, Cart, Payment } from "./models";

dotenv.config();

const MONGODB_URL = process.env.MONGODB_URL ?? "mongodb://localhost:27017/joybuy";

async function main() {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(MONGODB_URL);
    console.log("MongoDB connected");

    // Upsert admin user
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding");
    }
    const adminPass = await bcrypt.hash(adminPassword, 10);
    await Admin.findOneAndUpdate(
      { email: adminEmail.trim().toLowerCase() },
      { $set: { password: adminPass, name: "Social Media Marketplace Administrator" } },
      { upsert: true }
    ).exec();

    // Create a sample user if not exists
    const existing = await User.findOne({ email: "user@victohs.com" }).exec();
    if (!existing) {
      const user = new User({
        email: "user@victohs.com",
        name: "Sample User",
        password: await bcrypt.hash("UserPass2025!", 10),
      });
      await user.save();

      await Payment.create({ user: user._id, amount: 49.99, method: "card", status: "completed" });

      await Cart.create({
        user: user._id,
        items: [{ productName: "Sample Product", quantity: 1, price: 49.99 }],
      });

      console.log("Seeded sample user and admin");
    } else {
      console.log("Sample user already exists, skipping creation");
    }
  } catch (err) {
    console.error("Seeding failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    } catch (e) {
      console.warn("Error disconnecting from MongoDB:", e);
    }
  }
}

void main();
