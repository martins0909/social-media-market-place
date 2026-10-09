import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import axios from "axios";
import { User, Admin, Cart, Payment, Product, CatalogProduct, PurchaseHistory, CatalogCategory, ReferralBonus, NumberActivation, NumberRental, NumberTransaction, Settings, Transfer, BoostOrder, BoostSettings } from "./models";
import paymentsRouter from "./routes/payments";

const app = express();
// Allow local development plus one or more production frontend URLs.
const configuredFrontendUrls = [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
  .filter(Boolean)
  .join(",")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:4001",
  "http://localhost:4000",
  "http://localhost:5173",
  ...configuredFrontendUrls,
]));

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^https?:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Preserve raw webhook payloads before JSON parsing runs for other routes.
app.use('/api/payments/pocketfi/webhook', express.raw({ type: 'application/json' }));

// Increase payload limit and add error handling for malformed JSON
app.use(express.json({ limit: '10mb' }));
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('Bad JSON request:', err);
    return res.status(400).send({ status: 400, message: 'Invalid JSON payload received' });
  }
  next();
});

// Payment routes (Ercaspay integration)
app.use("/api/payments", paymentsRouter);

const PORT = parseInt(process.env.PORT || "4000", 10);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/joybuy";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || "";

const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM = (process.env.RESEND_FROM || "").trim();

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const PHONE_PREFIXES = ["070", "080", "081", "090"];

function generatePhoneNumber(): string {
  const prefix = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  const suffix = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${suffix}`;
}

function generateReferralCode(): string {
  return `SMM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function ensureUserReferralCode(user: any): Promise<string> {
  if (user.referralCode) return user.referralCode;

  let referralCode = generateReferralCode();
  while (await User.exists({ referralCode })) {
    referralCode = generateReferralCode();
  }

  user.referralCode = referralCode;
  await user.save();
  return referralCode;
}

async function ensureUserPhoneNumber(user: any): Promise<string> {
  if (user.phoneNumber && /^0[7890]\d{8}$/.test(user.phoneNumber)) {
    return user.phoneNumber;
  }

  let assignedPhone = "";
  let attempts = 0;

  while (attempts < 20) {
    assignedPhone = generatePhoneNumber();
    const existingUser = await User.findOne({ phoneNumber: assignedPhone }).lean();
    if (!existingUser) {
      break;
    }
    assignedPhone = "";
    attempts += 1;
  }

  if (!assignedPhone) {
    throw new Error("Unable to generate a unique phone number for user");
  }

  user.phoneNumber = assignedPhone;
  await user.save();
  return assignedPhone;
}

async function sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<void> {
  // Prefer Resend if configured
  if (RESEND_API_KEY && RESEND_FROM) {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: RESEND_FROM,
        to: [toEmail],
        subject: "Reset your password",
        html: `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5;">
            <h2 style="margin:0 0 12px 0;">Password reset request</h2>
            <p style="margin:0 0 12px 0;">Click the button below to reset your password. This link expires in 1 hour.</p>
            <p style="margin:16px 0;">
              <a href="${resetLink}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;">Reset Password</a>
            </p>
            <p style="margin:0 0 12px 0;">If you didn’t request this, you can ignore this email.</p>
            <p style="margin:0;color:#6b7280;font-size:12px;">Link: ${resetLink}</p>
          </div>
        `.trim(),
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    return;
  }

  // Fallback: no provider configured
  console.warn("Password reset requested but email provider not configured (set RESEND_API_KEY and RESEND_FROM)");
  console.warn("Reset link:", resetLink);
}

// We'll start the server after connecting to MongoDB (so startup failures surface immediately)

type JwtAdminPayload = {
  adminId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

type AdminRequest = Request & { admin?: JwtAdminPayload };

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing authorization" });
  const parts = auth.split(" ");
  const token = parts.length === 2 ? parts[1] : parts[0];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtAdminPayload;
    if (!payload || !payload.adminId) return res.status(403).json({ error: "Not authorized" });
    // attach to request object in a type-safe way
  (req as AdminRequest).admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function tryGetAdmin(req: Request): JwtAdminPayload | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const parts = auth.split(" ");
  const token = parts.length === 2 ? parts[1] : parts[0];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtAdminPayload;
    return payload && payload.adminId ? payload : null;
  } catch {
    return null;
  }
}

type CacheEntry<T> = { value: T; expiresAt: number };
const memoryCache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number) {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function cacheDel(key: string) {
  memoryCache.delete(key);
}

async function start() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URL);
    console.log("MongoDB connected successfully");
    
    // Seed default categories if none exist
    const categoryCount = await CatalogCategory.countDocuments();
    if (categoryCount === 0) {
      const defaultCategories = [
        { id: "audio", name: "Audio" },
        { id: "wearables", name: "Wearables" },
        { id: "computers", name: "Computers" },
        { id: "mobile", name: "Mobile" },
        { id: "accessories", name: "Accessories" },
        { id: "gaming", name: "Gaming" },
        { id: "smart-home", name: "Smart Home" },
        { id: "storage", name: "Storage" },
        { id: "cameras", name: "Cameras" },
        { id: "other", name: "Other" },
      ];
      await CatalogCategory.insertMany(defaultCategories);
      console.log("Default categories seeded to database");
    }
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on all interfaces, port ${PORT}`);
      console.log(`Try accessing: http://localhost:${PORT}/api/health`);
    }).on('error', (error: Error) => {
      console.error("Failed to start server:", error);
      console.error("Port:", PORT);
      console.error("Error details:", error.message);
      process.exit(1);
    });

    // Periodic job: mark expired number activations as failed and rentals as expired
    setInterval(async () => {
      try {
        const now = new Date();
        const activationsResult = await NumberActivation.updateMany(
          { status: "waiting", expiresAt: { $lt: now } },
          { status: "failed" }
        ).exec();
        const rentalsResult = await NumberRental.updateMany(
          { status: "active", expiresAt: { $lt: now } },
          { status: "expired" }
        ).exec();
        if (activationsResult.modifiedCount > 0 || rentalsResult.modifiedCount > 0) {
          console.log(`Expired numbers cleanup: ${activationsResult.modifiedCount} activations failed, ${rentalsResult.modifiedCount} rentals expired`);
        }
      } catch (err) {
        console.error("Expired numbers cleanup error:", err);
      }
    }, 60_000);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

// Admin login
app.post("/api/admin/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });
    const admin = await Admin.findOne({ email }).exec();
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ adminId: admin._id, email: admin.email }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// User registration
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, referralCode } = req.body as { email?: string; password?: string; name?: string; referralCode?: string };
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !(password || '').trim()) return res.status(400).json({ error: "Email and password are required" });
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail }).exec();
    if (existingUser) return res.status(400).json({ error: "Email already registered" });
    
    const normalizedReferralCode = (referralCode || "").trim().toUpperCase();
    const referrer = normalizedReferralCode
      ? await User.findOne({ referralCode: normalizedReferralCode }).exec()
      : null;

    // Hash password (8 rounds = faster but still secure)
    const hashedPassword = await bcrypt.hash(String(password).trim(), 8);
    
    // Create user
    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      name: name || undefined,
      balance: 0,
      referredBy: referrer?.referralCode,
      referralCode: generateReferralCode(),
    });

    await ensureUserPhoneNumber(user);
    await ensureUserReferralCode(user);

    res.json({ 
      ok: true, 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        balance: user.balance,
        phoneNumber: user.phoneNumber,
        referralCode: user.referralCode
      } 
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// User login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const normalizedEmail = (email || "").trim().toLowerCase();
    const rawPassword = (password || '').trim();
    if (!normalizedEmail || !rawPassword) return res.status(400).json({ error: "Email and password are required" });
    
    const user = await User.findOne({ email: normalizedEmail }).exec();
    if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials" });
    
    const match = await bcrypt.compare(rawPassword, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const phoneNumber = await ensureUserPhoneNumber(user);
    const referralCode = await ensureUserReferralCode(user);
    
    res.json({ 
      ok: true, 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        balance: user.balance,
        phoneNumber,
        referralCode
      } 
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Transfer money between users
app.post("/api/transfer", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { senderId, recipientEmail, amount } = req.body as { senderId?: string; recipientEmail?: string; amount?: number };
    if (!senderId || !recipientEmail || !amount || amount <= 0) {
      return res.status(400).json({ error: "senderId, recipientEmail and a positive amount are required" });
    }

    const normalizedRecipientEmail = recipientEmail.trim().toLowerCase();
    const sender = await User.findById(senderId).exec();
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const recipient = await User.findOne({ email: normalizedRecipientEmail }).exec();
    if (!recipient) return res.status(404).json({ error: "Recipient not found" });

    if (sender._id.toString() === recipient._id.toString()) {
      return res.status(400).json({ error: "Cannot transfer to yourself" });
    }

    if ((sender.balance || 0) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    let newBalance = 0;
    await session.withTransaction(async () => {
      const updatedSender = await User.findByIdAndUpdate(
        sender._id,
        { $inc: { balance: -amount } },
        { new: true, session }
      ).exec();
      await User.updateOne(
        { _id: recipient._id },
        { $inc: { balance: amount } },
        { session }
      ).exec();

      await new Transfer({
        senderId: sender._id.toString(),
        senderEmail: sender.email,
        recipientId: recipient._id.toString(),
        recipientEmail: recipient.email,
        amount,
        status: "completed",
      }).save({ session });

      newBalance = updatedSender?.balance || 0;
    });

    res.json({ ok: true, newBalance, recipientEmail: recipient.email });
  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ error: "Failed to process transfer" });
  } finally {
    session.endSession();
  }
});

// Get transfer history for a user
app.get("/api/transfers/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const transfers = await Transfer.find({
      $or: [{ senderId: userId }, { recipientId: userId }],
    }).sort({ createdAt: -1 }).lean();
    res.json(transfers);
  } catch (err) {
    console.error("Fetch transfers error:", err);
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
});

// Forgot password (send reset link)
app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email: normalizedEmail }).exec();

    // Always respond ok (avoid user enumeration)
    if (!user) return res.json({ ok: true });

    // Simple rate limit: allow one send every 30 seconds
    const now = Date.now();
    const lastSent = user.passwordResetLastSentAt ? user.passwordResetLastSentAt.getTime() : 0;
    if (lastSent && now - lastSent < 30_000) {
      return res.json({ ok: true, throttled: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = sha256Hex(token);
    user.passwordResetExpiresAt = new Date(now + 60 * 60 * 1000); // 1 hour
    user.passwordResetLastSentAt = new Date(now);
    await user.save();

    const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const resetLink = `${frontendBase}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail(normalizedEmail, resetLink);

    // In production we never include resetLink in the response
    if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
      return res.json({ ok: true, resetLink });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Failed to process request" });
  }
});

// Reset password (exchange token for new password)
app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    const resetToken = (token || "").trim();
    const newPassword = (password || "").trim();

    if (!resetToken) return res.status(400).json({ error: "Reset token is required" });
    if (!newPassword) return res.status(400).json({ error: "Password is required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const tokenHash = sha256Hex(resetToken);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).exec();

    if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });

    user.password = await bcrypt.hash(newPassword, 8);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetLastSentAt = undefined;
    await user.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

// Users
app.get("/api/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users/backfill-phone-numbers", requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await User.find({
      $or: [
        { phoneNumber: { $exists: false } },
        { phoneNumber: null },
        { phoneNumber: "" }
      ]
    });

    let assignedCount = 0;
    for (const user of users) {
      try {
        await ensureUserPhoneNumber(user);
        assignedCount += 1;
      } catch (err) {
        console.error("Failed to assign phone number to user", user._id, err);
      }
    }

    res.json({ ok: true, assignedCount, totalMissing: users.length });
  } catch (err) {
    console.error("Error backfilling phone numbers:", err);
    res.status(500).json({ error: "Failed to backfill phone numbers" });
  }
});

// Get current user data by ID (for balance refresh)
app.get("/api/users/current/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const phoneNumber = user.phoneNumber || await ensureUserPhoneNumber(user);
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      balance: user.balance || 0,
      phoneNumber
    });
  } catch (err) {
    console.error("Error fetching current user:", err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

app.get("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await User.findById(id).lean();
  if (!user) return res.status(404).json({ error: "Not found" });
  const carts = await Cart.find({ user: user._id }).lean();
  const payments = await Payment.find({ user: user._id }).lean();
  res.json({ ...user, carts, payments });
});

app.delete("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Delete associated data
    await Cart.deleteMany({ user: user._id });
    await Payment.deleteMany({ user: user._id });
    
    // Delete the user
    await User.findByIdAndDelete(id);
    
    res.json({ ok: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Adjust user balance (admin only - for manual cash payments)
app.post("/api/users/:id/adjust-balance", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { amount } = req.body;
    
    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Update balance
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $inc: { balance: amount } },
      { new: true }
    );
    
    // Create a payment record for tracking
    await Payment.create({
      user: id,
      amount: Math.abs(amount),
      method: "cash",
      status: "completed",
      reference: `MANUAL_${Date.now()}`,
      isCredited: true,
    });
    
    res.json({ 
      ok: true, 
      message: `Balance ${amount > 0 ? 'increased' : 'decreased'} successfully`,
      newBalance: updatedUser?.balance || 0
    });
  } catch (err) {
    console.error("Error adjusting balance:", err);
    res.status(500).json({ error: "Failed to adjust balance" });
  }
});

// Payments
app.get("/api/payments", requireAdmin, async (req: Request, res: Response) => {
  const payments = await Payment.find().populate("user").lean();
  res.json(payments);
});

// Get payments for a specific user
app.get("/api/payments/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json([]);
    }
    const payments = await Payment.find({ user: userId }).sort({ createdAt: -1 }).lean();
    res.json(payments);
  } catch (err) {
    console.error("Error fetching user payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

app.delete("/api/payments/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    
    await Payment.findByIdAndDelete(id);
    
    res.json({ ok: true, message: "Payment deleted successfully" });
  } catch (err) {
    console.error("Error deleting payment:", err);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

// Carts
app.get("/api/carts", requireAdmin, async (req: Request, res: Response) => {
  const carts = await Cart.find().populate("user").lean();
  res.json(carts);
});

// Products
app.get("/api/products", async (req: Request, res: Response) => {
  try {
    const products = await Product.find().lean();
    // Hide items from non-admin users
    const isAdmin = req.headers.authorization?.startsWith("Bearer ");
    if (!isAdmin) {
      // Remove items array for regular users
      const sanitized = products.map(p => ({ ...p, items: [] }));
      return res.json(sanitized);
    }
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, price, description, category, imageUrl } = req.body;
    if (!name || !price) return res.status(400).json({ error: "Name and price are required" });
    
    const product = await Product.create({
      name,
      price,
      description,
      category,
      imageUrl,
      items: []
    });
    
    res.json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/api/products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, price, description, category, imageUrl } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, description, category, imageUrl },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true, message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Product Items (account credentials)
app.post("/api/products/:id/items", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, password, twoFactorAuth, emailAddress, recoveryPassword } = req.body;
    if (!username || !password || !emailAddress) {
      return res.status(400).json({ error: "Username, password, and email are required" });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    
    product.items.push({
      username,
      password,
      twoFactorAuth,
      emailAddress,
      recoveryPassword,
      isSold: false
    });
    
    await product.save();
    res.json(product);
  } catch (err) {
    console.error("Error adding item:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

app.delete("/api/products/:productId/items/:itemId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    
    product.items = product.items.filter(item => item._id?.toString() !== req.params.itemId);
    await product.save();
    
    res.json({ ok: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

app.patch("/api/products/:productId/items/:itemId/sold", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isSold } = req.body;
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    
    const item = product.items.find(item => item._id?.toString() === req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    
    item.isSold = isSold;
    if (!isSold) {
      item.soldTo = undefined;
      item.soldAt = undefined;
    }
    
    await product.save();
    res.json(product);
  } catch (err) {
    console.error("Error updating item status:", err);
    res.status(500).json({ error: "Failed to update item status" });
  }
});

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  const state = mongoose.connection.readyState; // 0 disconnected, 1 connected
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({ status: states[state] || "unknown", uptime: process.uptime() });
});

// ======== CATALOG PRODUCT ENDPOINTS ========

// Global variable to hold the active database query "promise" for the catalog
let activeCatalogFetch: Promise<any[]> | null = null;

// Helper to serve product images directly and cache them
app.get("/api/catalog/:id/image", async (req: Request, res: Response) => {
  try {
    const product = await CatalogProduct.findOne({ id: req.params.id }, "image").lean();
    if (!product || !product.image) return res.status(404).send("Not found");

    const match = product.image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(buffer);
    }
    
    if (product.image.startsWith('http')) return res.redirect(product.image);
    res.setHeader("Content-Type", "text/plain");
    res.send(product.image);
  } catch (err) {
    res.status(500).send("Error serving image");
  }
});

// Get all catalog products
app.get("/api/catalog", async (req: Request, res: Response) => {
  try {
    const isAdmin = !!tryGetAdmin(req);

    // Admins can see serialNumbers (needed for inventory management)
    if (isAdmin) {
      const products = await CatalogProduct.find({}, "-image").sort({ createdAt: -1 }).lean();
      const mapped = products.map(p => ({ ...p, image: `/api/catalog/${p.id}/image` }));
      return res.json(mapped);
    }

    // Public response: include serial numbers with IDs/links for account checking, but never the actual log content.
    res.setHeader("Cache-Control", "public, max-age=30");
    const cacheKey = "catalog:public:v1";
    const cached = cacheGet<any[]>(cacheKey);
    if (cached) return res.json(cached);

    // If another visitor is currently triggering the DB query, just wait for it to finish!
    if (activeCatalogFetch) {
      console.log("Waiting for existing catalog query to finish...");
      const products = await activeCatalogFetch;
      return res.json(products);
    }

    // Otherwise, start the DB query and save the 'Promise' in the global variable
    const reqId = Math.random().toString(36).substring(7);
    activeCatalogFetch = (async () => {
      console.time(`Catalog fetch - ${reqId}`);
      const products = await CatalogProduct.find({}, "-image")
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      // Ensure frontend sees 'availableStock' property matching the cached count and public serial info
      const mappedProducts = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: `/api/catalog/${p.id}/image`,
        category: p.category,
        createdAt: p.createdAt,
        availableStock: p.cachedAvailableStock || 0,
        serialNumbers: Array.isArray(p.serialNumbers)
          ? p.serialNumbers
              .filter((s: any) => !s.isUsed)
              .map((s: any) => ({
                id: s.id,
                displayId: s.displayId,
                url: s.url,
                isUsed: s.isUsed,
              }))
          : [],
      }));

      console.timeEnd(`Catalog fetch - ${reqId}`);

      cacheSet(cacheKey, mappedProducts, 60_000); // 60 seconds Cache
      return mappedProducts;
    })();

    const products = await activeCatalogFetch;
    res.json(products);
  } catch (err) {
    console.error("Error fetching catalog products:", err);
    res.status(500).json({ error: "Failed to fetch catalog products" });
  } finally {
    // Once it breaks or finishes, clear the active fetch so new ones can start later
    activeCatalogFetch = null;
  }
});

// Create catalog product (admin only)
app.post("/api/catalog", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, name, description, price, image, category } = req.body;
    if (!id || !name || !description || !price || !image || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const product = new CatalogProduct({
      id,
      name,
      description,
      price,
      image,
      category,
      serialNumbers: [],
    });
    await product.save();
    cacheDel("catalog:public:v1");
    res.json(product);
  } catch (err) {
    console.error("Error creating catalog product:", err);
    res.status(500).json({ error: "Failed to create catalog product" });
  }
});

// Update catalog product (admin only)
app.put("/api/catalog/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.serialNumbers) {
      updates.cachedAvailableStock = updates.serialNumbers.filter((s: any) => !s.isUsed).length;
    }

    const product = await CatalogProduct.findOneAndUpdate(
      { id },
      updates,
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    cacheDel("catalog:public:v1");
    res.json(product);
  } catch (err) {
    console.error("Error updating catalog product:", err);
    res.status(500).json({ error: "Failed to update catalog product" });
  }
});

// Delete catalog product (admin only)
app.delete("/api/catalog/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await CatalogProduct.findOneAndDelete({ id });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    cacheDel("catalog:public:v1");
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting catalog product:", err);
    res.status(500).json({ error: "Failed to delete catalog product" });
  }
});

// ======== CATALOG CATEGORY ENDPOINTS ========

// Get all categories
app.get("/api/catalog-categories", async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=120");
    const cacheKey = "catalogCategories:public:v1";
    const cached = cacheGet<any[]>(cacheKey);
    if (cached) return res.json(cached);

    const cats = await CatalogCategory.find().sort({ name: 1 }).lean();
    cacheSet(cacheKey, cats, 120_000);
    res.json(cats);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Create category (admin)
app.post("/api/catalog-categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, name, icon } = req.body as { id?: string; name?: string; icon?: string };
    if (!name) return res.status(400).json({ error: "Name is required" });
    const cat = new CatalogCategory({ id: id || crypto.randomUUID(), name, icon });
    await cat.save();
    cacheDel("catalogCategories:public:v1");
    res.json(cat);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// Update category (admin)
app.put("/api/catalog-categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body as { name?: string; icon?: string };
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (icon !== undefined) updateData.icon = icon;

    const updated = await CatalogCategory.findOneAndUpdate({ id }, updateData, { new: true });
    if (!updated) return res.status(404).json({ error: "Category not found" });
    cacheDel("catalogCategories:public:v1");
    res.json(updated);
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// Delete category (admin)
app.delete("/api/catalog-categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await CatalogCategory.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ error: "Category not found" });
    cacheDel("catalogCategories:public:v1");
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ======== PURCHASE HISTORY ENDPOINTS ========

// Get purchase history for a user
app.get("/api/purchase-history/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const history = await PurchaseHistory.find({ userId }, "-image").sort({ purchaseDate: -1 }).lean();
    const mapped = history.map(h => ({ ...h, image: `/api/catalog/${h.productId}/image` }));
    res.json(mapped);
  } catch (err) {
    console.error("Error fetching purchase history:", err);
    res.status(500).json({ error: "Failed to fetch purchase history" });
  }
});

// Get referral bonus history for a user
app.get("/api/referral-bonuses/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const bonuses = await ReferralBonus.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(bonuses);
  } catch (err) {
    console.error("Error fetching referral bonuses:", err);
    res.status(500).json({ error: "Failed to fetch referral bonuses" });
  }
});

// Create purchase history entry
app.post("/api/purchase-history", async (req: Request, res: Response) => {
  try {
    const { userId, email, productId, name, description, price, image, category, quantity, assignedSerials } = req.body;
    if (!userId || !email || !productId || !name || !price || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const purchase = new PurchaseHistory({
      userId,
      email,
      productId,
      name,
      description,
      price,
      image,
      category,
      quantity,
      assignedSerials: assignedSerials || [],
      softDeleted: false
    });
    await purchase.save();
    res.json(purchase);
  } catch (err) {
    console.error("Error creating purchase history:", err);
    res.status(500).json({ error: "Failed to create purchase history" });
  }
});

// Complete purchase (deduct balance, update product, create history)
app.post("/api/purchase/complete", async (req: Request, res: Response) => {
  try {
    const { userId, productId, quantity, serialIds } = req.body as {
      userId?: string;
      productId?: string;
      quantity?: number;
      serialIds?: string[];
    };
    
    console.log("Purchase request received:", { userId, productId, quantity });
    
    if (!userId || !productId || !quantity) {
      console.error("Missing required fields:", { userId, productId, quantity });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Helper to resolve catalog product by Mongo _id or custom id
    const findCatalogProduct = async (id: string, session?: mongoose.ClientSession) => {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      if (isValidObjectId) {
        const byMongoIdQuery = CatalogProduct.findById(id);
        if (session) byMongoIdQuery.session(session);
        const byMongoId = await byMongoIdQuery.exec();
        if (byMongoId) return byMongoId;
      }
      const byCustomIdQuery = CatalogProduct.findOne({ id });
      if (session) byCustomIdQuery.session(session);
      return byCustomIdQuery.exec();
    };

    const session = await mongoose.startSession();

    let responsePayload: {
      success: true;
      newBalance: number;
      purchase: any;
      assignedSerials: string[];
      updatedProduct: { id: string; availableStock: number };
    } | null = null;

    try {
      await session.withTransaction(async () => {
        // Load user + product within transaction
        const user = await User.findById(userId).session(session).exec();
        if (!user) {
          console.error("User not found:", userId);
          throw Object.assign(new Error("User not found"), { statusCode: 404 });
        }

        const catalogProduct = await findCatalogProduct(productId, session);
        if (!catalogProduct) {
          console.error("Catalog product not found:", productId);
          throw Object.assign(new Error("Product not found"), { statusCode: 404 });
        }

        let qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw Object.assign(new Error("Invalid quantity"), { statusCode: 400 });
        }

        const serials = Array.isArray(catalogProduct.serialNumbers) ? catalogProduct.serialNumbers : [];
        const available = serials.filter((s: any) => !s.isUsed);

        let chosen: any[] = [];
        if (Array.isArray(serialIds) && serialIds.length > 0) {
          // Specific serial IDs selected by the user
          chosen = serials.filter((s: any) => serialIds.includes(s.id) && !s.isUsed);
          if (chosen.length !== serialIds.length) {
            throw Object.assign(new Error("One or more selected accounts are no longer available"), { statusCode: 400 });
          }
          qty = chosen.length;
        } else {
          // Fallback: pick the first available serials
          chosen = available.slice(0, qty);
        }

        if (available.length < qty) {
          throw Object.assign(new Error(`Only ${available.length} units available in stock.`), { statusCode: 400 });
        }

        const totalPrice = (catalogProduct.price || 0) * qty;
        if ((user.balance || 0) < totalPrice) {
          console.error("Insufficient balance:", { balance: user.balance, required: totalPrice });
          throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 });
        }

        const assignedSerials = chosen.map((s: any) => s.serial);
        const now = new Date();
        for (const s of serials as any[]) {
          if (chosen.some((c: any) => c.id === s.id)) {
            s.isUsed = true;
            s.usedBy = user.email;
            s.usedAt = now;
          }
        }
        
        const remainingAvailable = serials.filter((s: any) => !s.isUsed).length;
        (catalogProduct as any).cachedAvailableStock = remainingAvailable;

        await (catalogProduct as any).save({ session });

        const purchase = new PurchaseHistory({
          userId,
          email: user.email,
          productId: catalogProduct.id,
          name: catalogProduct.name,
          description: catalogProduct.description,
          price: catalogProduct.price,
          image: catalogProduct.image,
          category: catalogProduct.category,
          quantity: qty,
          assignedSerials,
        });
        await purchase.save({ session } as any);

        // Referral purchase bonus: if user was referred and this is their
        // first qualifying purchase (>= ₦3,000), reward referrer ₦300 and buyer ₦200.
        let referralBuyerBonus = 0;
        let referrerDoc: any = null;
        if (user.referredBy && totalPrice >= 3000 && !user.referralPurchaseBonusReceived) {
          referrerDoc = await User.findOne({ referralCode: user.referredBy }).session(session).exec();
          if (referrerDoc) {
            await User.updateOne({ _id: referrerDoc._id }, { $inc: { balance: 300 } }).session(session).exec();
            referralBuyerBonus = 200;
          }
        }

        const userUpdate: any = { $inc: { balance: referralBuyerBonus - totalPrice } };
        if (referralBuyerBonus > 0) userUpdate.referralPurchaseBonusReceived = true;

        const updatedUser = await User.findByIdAndUpdate(
          userId,
          userUpdate,
          { new: true, session }
        ).exec();

        // Record referral bonus history inside the same transaction.
        if (referralBuyerBonus > 0 && referrerDoc) {
          await ReferralBonus.create([{
            userId: referrerDoc._id,
            amount: 300,
            type: "referrer",
            buyerEmail: user.email,
            purchaseAmount: totalPrice,
          }, {
            userId: user._id,
            amount: 200,
            type: "buyer",
            referrerEmail: referrerDoc.email,
            purchaseAmount: totalPrice,
          }], { session });
        }

        responsePayload = {
          success: true,
          newBalance: updatedUser?.balance || 0,
          purchase,
          assignedSerials,
          updatedProduct: {
            id: catalogProduct.id,
            availableStock: remainingAvailable,
          },
        };
      });
    } finally {
      session.endSession();
    }

    // Invalidate public cache so stock updates reflect quickly
    cacheDel("catalog:public:v1");

    if (!responsePayload) {
      return res.status(500).json({ error: "Failed to complete purchase" });
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error("Error completing purchase:", err);
    const anyErr = err as any;
    const statusCode = typeof anyErr?.statusCode === "number" ? anyErr.statusCode : 500;
    res.status(statusCode).json({ error: anyErr?.message || "Failed to complete purchase" });
  }
});

// Get all purchase history (admin only) - shows ALL purchases including user-deleted for business records
app.get("/api/purchase-history", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email } = req.query as { email?: string };
    const filter: Record<string, any> = {};
    if (email && email.trim().length > 0) {
      // Case-insensitive partial match from start or anywhere
      // Using regex enables admin to type partial email and see matches
      filter.email = { $regex: email.trim(), $options: "i" };
    }
    const items = await PurchaseHistory.find(filter, "-image").sort({ purchaseDate: -1 }).allowDiskUse(true).lean();
    const mapped = items.map(h => ({ ...h, image: `/api/catalog/${h.productId}/image` }));
    res.json(mapped);
  } catch (err) {
    console.error("Error fetching all purchase history:", err);
    res.status(500).json({ error: "Failed to fetch purchase history" });
  }
});

// Note: Deletion endpoints removed to simplify UX; users can no longer delete purchase history entries

// (duplicate /api/health removed)


// Initialize Paystack transaction
app.post("/api/payments/initialize", async (req: Request, res: Response) => {
  const { amount, email, userId } = req.body;
  if (!amount || !email || !userId) return res.status(400).json({ error: "Missing fields" });
  const reference = `ref_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  try {
    // create pending payment record
    const payment = await Payment.create({ user: userId, amount, method: "card", status: "pending", reference });
    // call Paystack initialize
    const resp = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email, amount: Math.round(amount * 100), reference },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    res.json({ authorization_url: resp.data.data.authorization_url, reference, paymentId: payment._id });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(err.response?.data ?? err.message);
    } else if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// Credit Ercas payment endpoint moved to routes/payments.ts

// Verify Paystack transaction
// Robust verification endpoint: accepts path or various query param names (reference, pref, ref, transRef)
app.get("/api/payments/verify/:reference?", async (req: Request, res: Response) => {
  const passed = req.params.reference
    || (req.query.reference as string | undefined)
    || (req.query.pref as string | undefined)
    || (req.query.ref as string | undefined)
    || (req.query.transRef as string | undefined);
  if (!passed) return res.status(400).json({ error: "Missing reference" });
  try {
    // Call Paystack with whatever reference we were given
    const resp = await axios.get(`https://api.paystack.co/transaction/verify/${passed}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } });
    const { status, amount } = resp.data.data; // amount in kobo

    // Attempt to locate Payment by internal reference first, then by transactionReference
    let payment = await Payment.findOne({ reference: passed }).exec();
    if (!payment) {
      payment = await Payment.findOne({ transactionReference: passed }).exec();
    }

    if (!payment) {
      // No payment record, still return status so client can decide next step
      return res.json({ ok: true, status, amount: amount / 100, newBalance: undefined, paymentFound: false });
    }

    // Update status
    payment.status = status === "success" ? "completed" : status;

    let newBalance: number | undefined = undefined;
    if (payment.status === "completed" && !payment.isCredited && payment.user) {
      const creditedAmount = amount / 100;
      const updatedUser = await User.findByIdAndUpdate(payment.user, { $inc: { balance: creditedAmount } }, { new: true }).exec();
      if (updatedUser) {
        newBalance = updatedUser.balance || 0;
        payment.isCredited = true;
      }
    }
    await payment.save();
    res.json({ ok: true, status: payment.status, amount: amount / 100, newBalance, alreadyCredited: payment.isCredited, paymentFound: true });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("Paystack verify error:", err.response?.data ?? err.message);
      const { status, details } = providerErrorDetails(err);
      return res.status(500).json({ error: "Verification failed", providerStatus: status, providerError: details });
    } else if (err instanceof Error) {
      console.error("Verify error:", err.message);
      const { details } = providerErrorDetails({ message: err.message });
      return res.status(500).json({ error: "Verification failed", providerError: details });
    } else {
      console.error("Unknown verify error:", err);
      return res.status(500).json({ error: "Verification failed" });
    }
  }
});

// ======== BLOOMSMS NUMBER MODULE ========

const BLOOMSMS_BASE = "https://bloomsms.com/api/v1";
const BLOOMSMS_API_KEY = process.env.BLOOMSMS_API_KEY || "";

async function ensureSettings() {
  let settings = await Settings.findOne().exec();
  if (!settings) {
    settings = await Settings.create({ markupPercentage: 0, exchangeRate: 1500 });
  }
  return settings;
}

async function ensureBoostSettings() {
  let settings = await BoostSettings.findOne().exec();
  if (!settings) {
    settings = await BoostSettings.create({ exchangeRate: 1, markupPercentage: 0, flatMarkupNgn: 0 });
  }
  return settings;
}

function calculateNgnPrice(usd: number, exchangeRate: number, markupPercentage: number) {
  return Math.ceil(usd * exchangeRate * (1 + markupPercentage / 100));
}

async function bloomRequest(method: string, path: string, body?: any) {
  if (!BLOOMSMS_API_KEY) {
    throw new Error("Number provider API key is not configured");
  }
  const url = `${BLOOMSMS_BASE}${path}`;
  const res = await axios({
    method,
    url,
    headers: {
      Authorization: `Bearer ${BLOOMSMS_API_KEY}`,
      "Content-Type": "application/json",
    },
    data: body,
    timeout: 20000,
  });
  return res.data;
}

function generateReference(prefix = "NUM") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// Sanitize provider errors so raw HTML/Cloudflare pages never reach users
function providerErrorDetails(err: any): { status?: number; details: string } {
  const status = err?.response?.status || 0;
  const raw = err?.response?.data || err?.message || String(err);
  const isHtml = typeof raw === "string" && (raw.trim().startsWith("<") || raw.toLowerCase().includes("<html"));
  return {
    status,
    details: isHtml
      ? "Provider returned an HTML page (likely a security block). Please try again."
      : String(raw).substring(0, 1000),
  };
}

// Settings: get
app.get("/api/numbers/settings", async (req: Request, res: Response) => {
  try {
    const settings = await ensureSettings();
    res.json({
      markupPercentage: settings.markupPercentage,
      exchangeRate: settings.exchangeRate,
    });
  } catch (err) {
    console.error("Error fetching number settings:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Settings: update (admin only, protected by basic admin auth if desired)
app.put("/api/numbers/settings", async (req: Request, res: Response) => {
  try {
    const { markupPercentage, exchangeRate } = req.body;
    const settings = await ensureSettings();
    if (markupPercentage !== undefined) settings.markupPercentage = Number(markupPercentage);
    if (exchangeRate !== undefined) settings.exchangeRate = Number(exchangeRate);
    settings.updatedAt = new Date();
    await settings.save();
    res.json({
      markupPercentage: settings.markupPercentage,
      exchangeRate: settings.exchangeRate,
    });
  } catch (err) {
    console.error("Error updating number settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Proxy: list countries
app.get("/api/numbers/countries", async (req: Request, res: Response) => {
  try {
    const data = await bloomRequest("GET", "/countries");
    res.json(data);
  } catch (err: any) {
    console.error("Countries error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(502).json({ error: "Failed to load countries", providerStatus: status, providerError: details });
  }
});

// Proxy: list services for a country
app.get("/api/numbers/services", async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string) || "187";
    const data = await bloomRequest("GET", `/services?country=${country}`);
    const settings = await ensureSettings();
    if (data?.status === "success" && Array.isArray(data.data?.services)) {
      data.data.services = data.data.services.map((s: any) => ({
        ...s,
        priceNgn: calculateNgnPrice(Number(s.price), settings.exchangeRate, settings.markupPercentage),
      }));
    }
    res.json(data);
  } catch (err: any) {
    console.error("Services error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(502).json({ error: "Failed to load services", providerStatus: status, providerError: details });
  }
});

// Rent a number (short-term activation)
app.post("/api/numbers/activations", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { userId, service, country, serviceName, countryName } = req.body;
    if (!userId || !service || !country) {
      return res.status(400).json({ error: "userId, service and country are required" });
    }
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get live price from BloomSMS
    const servicesData = await bloomRequest("GET", `/services?country=${country}&service=${service}`);
    const serviceInfo = servicesData?.data?.services?.find((s: any) => s.code === service);
    const priceUsd = serviceInfo ? Number(serviceInfo.price) : 0;
    if (!priceUsd) {
      return res.status(400).json({ error: "Service not available for this country" });
    }

    const settings = await ensureSettings();
    const priceNgn = calculateNgnPrice(priceUsd, settings.exchangeRate, settings.markupPercentage);

    if ((user.balance || 0) < priceNgn) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Create activation with BloomSMS
    const bloomResp = await bloomRequest("POST", "/activations", { service, country });
    if (bloomResp?.status !== "success" || !bloomResp.data) {
      return res.status(502).json({ error: "Failed to rent number. Provider may be out of stock.", details: bloomResp?.errors || bloomResp });
    }

    const bloom = bloomResp.data;

    await session.withTransaction(async () => {
      await User.updateOne({ _id: user._id }, { $inc: { balance: -priceNgn } }).session(session).exec();

      const activation = new NumberActivation({
        userId: user._id.toString(),
        email: user.email,
        provider: "bloom",
        activationId: String(bloom.activation_id),
        phoneNumber: String(bloom.phone_number),
        service,
        serviceName: serviceName || serviceInfo?.name || service,
        country,
        countryName: countryName || "",
        priceUsd,
        priceNgn,
        status: "waiting",
        expiresAt: bloom.expires_at ? new Date(bloom.expires_at) : undefined,
      });
      await activation.save({ session });

      await new NumberTransaction({
        userId: user._id.toString(),
        email: user.email,
        provider: "bloom",
        reference: generateReference("ACT"),
        amount: priceNgn,
        type: "activation",
        method: "wallet",
        status: "completed",
        activationId: String(bloom.activation_id),
      }).save({ session });

      res.json({
        ok: true,
        activation: {
          id: activation._id,
          activationId: activation.activationId,
          phoneNumber: activation.phoneNumber,
          service: activation.serviceName,
          country: activation.countryName,
          priceNgn: activation.priceNgn,
          status: activation.status,
          expiresAt: activation.expiresAt,
        },
        newBalance: (user.balance || 0) - priceNgn,
      });
    });
  } catch (err: any) {
    console.error("Rent number error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    let message = "Failed to rent number. Please try again.";
    if (status === 403) message = "Provider access denied (403). Your API key may be invalid or the server IP is blocked.";
    else if (status === 401) message = "Provider authentication failed. Please check your API key.";
    else if (status === 429) message = "Too many requests to provider. Please wait a moment.";
    res.status(500).json({ error: message, providerStatus: status, providerError: details });
  } finally {
    session.endSession();
  }
});

// Get user's activations
app.get("/api/numbers/activations/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const filter: any = { userId };
    if (req.query.provider) filter.provider = req.query.provider;
    const activations = await NumberActivation.find(filter).sort({ createdAt: -1 }).lean();
    res.json(activations);
  } catch (err) {
    console.error("Error fetching activations:", err);
    res.status(500).json({ error: "Failed to fetch activations" });
  }
});

// Poll activation status from BloomSMS and update local record
app.get("/api/numbers/activations/status/:activationId", async (req: Request, res: Response) => {
  try {
    const { activationId } = req.params;
    const bloomResp = await bloomRequest("GET", `/activations/${activationId}`);
    const bloom = bloomResp?.data;
    if (!bloom) return res.status(502).json({ error: "Failed to fetch activation status" });

    const update: any = {};
    if (bloom.activation_status) update.status = bloom.activation_status;
    if (bloom.sms?.code) {
      update.smsCode = bloom.sms.code;
      update.smsText = bloom.sms.full_text;
      update.status = "code_received";
    }
    if (Object.keys(update).length > 0) {
      await NumberActivation.updateOne({ activationId }, update).exec();
    }

    const activation = await NumberActivation.findOne({ activationId }).lean();
    res.json({ ...bloomResp, local: activation });
  } catch (err: any) {
    console.error("Activation status error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to check status", providerStatus: status, providerError: details });
  }
});

// Update activation status (cancel/complete)
app.patch("/api/numbers/activations/:activationId", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { activationId } = req.params;
    const { status, userId } = req.body; // cancel | complete
    if (!status) return res.status(400).json({ error: "status is required" });

    const activation = await NumberActivation.findOne({ activationId }).lean();
    if (!activation) return res.status(404).json({ error: "Activation not found" });

    const bloomResp = await bloomRequest("PATCH", `/activations/${activationId}`, { status });

    // Bloom returns { status: "success" | "error", data, errors }
    const providerSuccess = bloomResp?.status === "success";
    const newStatus = status === "cancel" ? "cancelled" : "completed";
    const shouldRefund = status === "cancel" && providerSuccess;

    if (!providerSuccess) {
      // Provider rejected the request — do not refund, do not change status
      return res.status(502).json({
        error: "Provider rejected the request",
        details: bloomResp?.errors || bloomResp,
      });
    }

    await session.withTransaction(async () => {
      await NumberActivation.updateOne({ activationId }, { status: newStatus }).session(session).exec();

      // Refund user if cancellation was accepted by Bloom and not already refunded
      if (shouldRefund && activation.status !== "cancelled" && activation.status !== "failed") {
        const refundUserId = userId || activation.userId;
        await User.updateOne({ _id: refundUserId }, { $inc: { balance: activation.priceNgn } }).session(session).exec();
        await new NumberTransaction({
          userId: activation.userId,
          email: activation.email,
          provider: "bloom",
          reference: generateReference("REF"),
          amount: activation.priceNgn,
          type: "refund",
          method: "wallet",
          status: "completed",
          activationId,
        }).save({ session });
      }
    });

    res.json({ ...bloomResp, refunded: shouldRefund, newStatus });
  } catch (err: any) {
    console.error("Update activation error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to cancel activation", providerStatus: status, providerError: details });
  } finally {
    session.endSession();
  }
});

// Create long rental
app.post("/api/numbers/rentals", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { userId, service, period, autoRenew, serviceName } = req.body;
    if (!userId || !service || !period) {
      return res.status(400).json({ error: "userId, service and period are required" });
    }
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: "User not found" });

    const bloomResp = await bloomRequest("POST", "/long-rentals", { service, period, auto_renew: !!autoRenew });
    if (bloomResp?.status !== "success" || !bloomResp.data) {
      return res.status(502).json({ error: "Failed to create rental", details: bloomResp });
    }
    const bloom = bloomResp.data;

    const settings = await ensureSettings();
    const priceUsd = Number(bloom.price) || 0;
    const priceNgn = calculateNgnPrice(priceUsd, settings.exchangeRate, settings.markupPercentage);

    if ((user.balance || 0) < priceNgn) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await session.withTransaction(async () => {
      await User.updateOne({ _id: user._id }, { $inc: { balance: -priceNgn } }).session(session).exec();

      const rental = new NumberRental({
        userId: user._id.toString(),
        email: user.email,
        provider: "bloom",
        rentalId: String(bloom.id),
        phoneNumber: String(bloom.phone_number),
        serviceCode: service,
        serviceName: serviceName || bloom.service_name || service,
        period,
        priceUsd,
        priceNgn,
        status: "active",
        autoRenew: !!autoRenew,
        expiresAt: bloom.expires_at ? new Date(bloom.expires_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await rental.save({ session });

      await new NumberTransaction({
        userId: user._id.toString(),
        email: user.email,
        provider: "bloom",
        reference: generateReference("RNT"),
        amount: priceNgn,
        type: "rental",
        method: "wallet",
        status: "completed",
        rentalId: String(bloom.id),
      }).save({ session });

      res.json({
        ok: true,
        rental: {
          id: rental._id,
          rentalId: rental.rentalId,
          phoneNumber: rental.phoneNumber,
          service: rental.serviceName,
          period: rental.period,
          priceNgn: rental.priceNgn,
          status: rental.status,
          expiresAt: rental.expiresAt,
        },
        newBalance: (user.balance || 0) - priceNgn,
      });
    });
  } catch (err: any) {
    console.error("Create rental error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to create rental", providerStatus: status, providerError: details });
  } finally {
    session.endSession();
  }
});

// Get user rentals
app.get("/api/numbers/rentals/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const rentals = await NumberRental.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json(rentals);
  } catch (err) {
    console.error("Error fetching rentals:", err);
    res.status(500).json({ error: "Failed to fetch rentals" });
  }
});

// Cancel rental
app.post("/api/numbers/rentals/:rentalId/cancel", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { rentalId } = req.params;
    const { userId } = req.body;

    const rental = await NumberRental.findOne({ rentalId }).lean();
    if (!rental) return res.status(404).json({ error: "Rental not found" });

    const bloomResp = await bloomRequest("POST", `/long-rentals/${rentalId}/cancel`);
    const refundUsd = Number(bloomResp?.data?.refund_amount) || 0;
    const settings = await ensureSettings();
    const refundNgn = refundUsd > 0 ? Math.floor(refundUsd * settings.exchangeRate) : rental.priceNgn;

    await session.withTransaction(async () => {
      await NumberRental.updateOne({ rentalId }, { status: "cancelled" }).session(session).exec();

      // Refund user if cancellation succeeded and not already refunded
      if (bloomResp?.status === "success" && rental.status !== "cancelled") {
        const refundUserId = userId || rental.userId;
        await User.updateOne({ _id: refundUserId }, { $inc: { balance: refundNgn } }).session(session).exec();
        await new NumberTransaction({
          userId: rental.userId,
          email: rental.email,
          provider: "bloom",
          reference: generateReference("REF"),
          amount: refundNgn,
          type: "refund",
          method: "wallet",
          status: "completed",
          rentalId,
        }).save({ session });
      }
    });

    res.json({ ...bloomResp, refunded: bloomResp?.status === "success", refundNgn });
  } catch (err: any) {
    console.error("Cancel rental error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to cancel rental", providerStatus: status, providerError: details });
  } finally {
    session.endSession();
  }
});

// Get user transactions
app.get("/api/numbers/transactions/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const filter: any = { userId };
    if (req.query.provider) filter.provider = req.query.provider;
    const transactions = await NumberTransaction.find(filter).sort({ createdAt: -1 }).lean();
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching number transactions:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Webhook: receive SMS/OTP from BloomSMS
app.post("/api/numbers/webhook", async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    if (event === "sms.received" && data?.activation_id) {
      const update: any = {};
      if (data.sms?.code) {
        update.smsCode = String(data.sms.code);
        update.smsText = String(data.sms.full_text || "");
      }
      if (data.status) update.status = String(data.status);
      if (Object.keys(update).length > 0) {
        await NumberActivation.updateOne({ activationId: String(data.activation_id), provider: "bloom" }, update).exec();
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Admin: all activations
app.get("/api/numbers/admin/activations", async (req: Request, res: Response) => {
  try {
    const activations = await NumberActivation.find().sort({ createdAt: -1 }).lean();
    res.json(activations);
  } catch (err) {
    console.error("Admin activations error:", err);
    res.status(500).json({ error: "Failed to fetch activations" });
  }
});

// Admin: USA activations (country 187)
app.get("/api/numbers/admin/usa", async (req: Request, res: Response) => {
  try {
    const activations = await NumberActivation.find({ country: "187" }).sort({ createdAt: -1 }).lean();
    res.json(activations);
  } catch (err) {
    console.error("Admin USA error:", err);
    res.status(500).json({ error: "Failed to fetch USA activations" });
  }
});

// Admin: activations by country
app.get("/api/numbers/admin/countries/:country", async (req: Request, res: Response) => {
  try {
    const { country } = req.params;
    const activations = await NumberActivation.find({ country }).sort({ createdAt: -1 }).lean();
    res.json(activations);
  } catch (err) {
    console.error("Admin country error:", err);
    res.status(500).json({ error: "Failed to fetch country activations" });
  }
});

// Admin: all rentals
app.get("/api/numbers/admin/rentals", async (req: Request, res: Response) => {
  try {
    const rentals = await NumberRental.find().sort({ createdAt: -1 }).lean();
    res.json(rentals);
  } catch (err) {
    console.error("Admin rentals error:", err);
    res.status(500).json({ error: "Failed to fetch rentals" });
  }
});

// Admin: all transactions
app.get("/api/numbers/admin/transactions", async (req: Request, res: Response) => {
  try {
    const transactions = await NumberTransaction.find().sort({ createdAt: -1 }).lean();
    res.json(transactions);
  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ======== DAISYSMS NUMBER MODULE ========

const DAISYSMS_BASE = "https://daisysms.io/stubs/handler_api.php";
const DAISYSMS_API_KEY = process.env.DAISYSMS_API_KEY || "";

const DAISY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "DNT": "1",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

async function daisyRequest(action: string, params: Record<string, string | number | boolean> = {}) {
  if (!DAISYSMS_API_KEY) {
    throw new Error("Number provider API key is not configured");
  }
  const query = new URLSearchParams({ api_key: DAISYSMS_API_KEY, action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${DAISYSMS_BASE}?${query.toString()}`;
  const res = await axios.get(url, { timeout: 20000, responseType: "text", headers: DAISY_HEADERS });
  return String(res.data || "").trim();
}

async function daisyRequestRaw(action: string, params: Record<string, string | number | boolean> = {}) {
  if (!DAISYSMS_API_KEY) {
    throw new Error("Number provider API key is not configured");
  }
  const query = new URLSearchParams({ api_key: DAISYSMS_API_KEY, action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${DAISYSMS_BASE}?${query.toString()}`;
  const res = await axios.get(url, { timeout: 20000, responseType: "text", headers: DAISY_HEADERS });
  return { text: String(res.data || "").trim(), headers: res.headers };
}

// Proxy: DaisySMS services/prices
app.get("/api/numbers/daisy/services", async (req: Request, res: Response) => {
  try {
    if (!DAISYSMS_API_KEY) {
      return res.status(503).json({ error: "DaisySMS API key is not configured" });
    }

    const settings = await ensureSettings();

    // Helper to normalize any sms-activate prices response into service => country => entry
    const normalizePrices = (raw: any): Record<string, Record<string, any>> => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const result: Record<string, Record<string, any>> = {};

      Object.keys(raw).forEach((key) => {
        const value = raw[key];
        if (!value || typeof value !== "object") return;

        // Check if this is a flat service => {cost, count} entry (DaisySMS actual format)
        const isFlatServiceEntry =
          value.cost !== undefined ||
          value.price !== undefined ||
          value.retail_price !== undefined ||
          (value.count !== undefined && typeof value.count === "number");

        if (isFlatServiceEntry) {
          // DaisySMS flat format: service => {cost, count, multi}
          result[key] = { "187": value };
          return;
        }

        // Otherwise it's a nested object; detect format by looking at first nested value
        const nestedKeys = Object.keys(value);
        if (nestedKeys.length === 0) return;
        const firstNested = value[nestedKeys[0]];
        const isServiceFirst =
          firstNested &&
          typeof firstNested === "object" &&
          (firstNested.cost !== undefined || firstNested.price !== undefined || firstNested.count !== undefined || firstNested.retail_price !== undefined);

        if (isServiceFirst) {
          // getPricesVerification format: service => country => data
          result[key] = value;
        } else {
          // getPrices format: country => service => data
          const country = key;
          Object.keys(value).forEach((serviceCode) => {
            if (!result[serviceCode]) result[serviceCode] = {};
            result[serviceCode][country] = value[serviceCode];
          });
        }
      });

      return result;
    };

    const attachNgnPrices = (data: Record<string, Record<string, any>>) => {
      Object.keys(data).forEach((service) => {
        const countries = data[service];
        if (!countries || typeof countries !== "object") return;
        Object.keys(countries).forEach((country) => {
          const entry = countries[country];
          if (!entry || typeof entry !== "object") return;
          const cost = Number(entry.cost ?? entry.price ?? entry.retail_price ?? 0);
          if (cost > 0) {
            entry.cost = cost;
            entry.priceNgn = calculateNgnPrice(cost, settings.exchangeRate, settings.markupPercentage);
          }
        });
      });
    };

    // Try getPricesVerification first
    let text = await daisyRequest("getPricesVerification");
    console.log("Daisy getPricesVerification raw:", text.substring(0, 1000));

    const isHtmlResponse = (t: string) => !t || t.trim().startsWith("<") || t.toLowerCase().includes("<html");
    const isProviderError = (t: string) => t.startsWith("BAD_KEY") || t.startsWith("NO") || t.startsWith("ERROR") || t.startsWith("ACCESS");

    if (isHtmlResponse(text) || isProviderError(text)) {
      // Try getPrices as fallback
      console.log("Daisy: getPricesVerification failed/empty/blocked, trying getPrices");
      text = await daisyRequest("getPrices");
      console.log("Daisy getPrices raw:", text.substring(0, 1000));
    }

    const isHtmlText = (t: string) => !t || t.trim().startsWith("<") || t.toLowerCase().includes("<html");
    const cleanText = (t: string) => isHtmlText(t) ? "Provider returned an HTML page (likely a security block). Please try again." : t;

    if (!text || text.startsWith("BAD_KEY")) {
      return res.status(502).json({ error: "API key is invalid", providerError: cleanText(text) });
    }
    if (text.startsWith("NO") || text.startsWith("ERROR")) {
      return res.status(502).json({ error: "Provider returned an error", providerError: cleanText(text) });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Likely a Cloudflare challenge or HTML error page
      const isHtml = text.trim().startsWith("<") || text.includes("<html");
      return res.status(502).json({
        error: isHtml ? "Provider is temporarily blocked. Please try again in a moment." : "Invalid response from provider",
        providerError: isHtml ? "Provider returned an HTML page (likely a security block)." : text,
      });
    }

    const normalized = normalizePrices(parsed);
    attachNgnPrices(normalized);

    // Count total services for debugging
    let totalEntries = 0;
    Object.keys(normalized).forEach((s) => {
      totalEntries += Object.keys(normalized[s]).length;
    });
    console.log("DaisySMS normalized services:", Object.keys(normalized).length, "services,", totalEntries, "entries");

    res.json({ status: "success", data: normalized });
  } catch (err: any) {
    console.error("Number services error:", err.response?.data || err.message);
    const status = err.response?.status;
    const details = err.response?.data || err.message || String(err);
    const isHtml = typeof details === "string" && (details.trim().startsWith("<") || details.includes("<html"));
    let message = "Failed to load services. Please try again.";
    if (status === 403) message = "Provider access denied (403). Your API key may be invalid or the server IP is blocked.";
    else if (status === 401) message = "Provider authentication failed. Please check your API key.";
    else if (status === 429) message = "Too many requests to provider. Please wait a moment.";
    res.status(502).json({
      error: message,
      providerStatus: status,
      providerError: isHtml ? "Provider returned an HTML page (likely a block)." : details,
    });
  }
});

// Debug: test DaisySMS API key and show raw responses
app.get("/api/numbers/daisy/debug", async (req: Request, res: Response) => {
  try {
    if (!DAISYSMS_API_KEY) {
      return res.status(503).json({ error: "Number provider API key is not configured" });
    }

    const testEndpoint = async (action: string) => {
      try {
        const text = await daisyRequest(action);
        return { ok: true, status: 200, body: text.substring(0, 2000) };
      } catch (e: any) {
        return {
          ok: false,
          status: e.response?.status || 0,
          error: e.message,
          body: e.response?.data ? String(e.response.data).substring(0, 2000) : undefined,
        };
      }
    };

    const [balance, verification, prices] = await Promise.all([
      testEndpoint("getBalance"),
      testEndpoint("getPricesVerification"),
      testEndpoint("getPrices"),
    ]);

    res.json({
      apiKeyConfigured: true,
      apiKeyPrefix: DAISYSMS_API_KEY.substring(0, 8) + "...",
      timestamp: new Date().toISOString(),
      endpoints: { getBalance: balance, getPricesVerification: verification, getPrices: prices },
    });
  } catch (err: any) {
    console.error("Debug error:", err);
    res.status(500).json({ error: "Debug failed", details: err.message });
  }
});

// Rent a DaisySMS number
app.post("/api/numbers/daisy/activations", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { userId, service, serviceName, priceUsd: sentPriceUsd, maxPrice } = req.body;
    if (!userId || !service) {
      return res.status(400).json({ error: "userId and service are required" });
    }
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: "User not found" });

    const settings = await ensureSettings();

    // Use the price the user saw on the frontend as the expected price.
    // This prevents charging the high fallback ceiling if X-Price header is missing.
    const expectedUsd = Number(sentPriceUsd) || Number(maxPrice) || 0;
    if (!expectedUsd || expectedUsd <= 0) {
      return res.status(400).json({ error: "Service price is required" });
    }

    // Allow a small buffer for provider price fluctuations (max 50% above displayed price).
    const maxUsd = Math.max(expectedUsd * 1.5, expectedUsd + 0.5);

    // Check user has enough balance for the expected price before calling provider.
    const expectedNgn = calculateNgnPrice(expectedUsd, settings.exchangeRate, settings.markupPercentage);
    if ((user.balance || 0) < expectedNgn) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Rent from provider
    const raw = await daisyRequestRaw("getNumber", { service, max_price: maxUsd });
    const text = raw.text;

    // Expected: ACCESS_NUMBER:id:phone
    if (!text.startsWith("ACCESS_NUMBER")) {
      const isHtml = !text || text.trim().startsWith("<") || text.toLowerCase().includes("<html");
      return res.status(502).json({
        error: "Failed to rent number. Provider may be out of stock or the price exceeded the allowed limit.",
        providerError: isHtml ? "Provider returned an HTML page (likely a security block)." : text,
      });
    }

    const parts = text.split(":");
    const activationId = parts[1];
    const phoneNumber = parts[2];

    // Daisy returns the effective price in the X-Price header.
    // Read it robustly from axios headers (case-insensitive lookup).
    const headerValue =
      raw.headers["x-price"] ??
      raw.headers["X-Price"] ??
      raw.headers["x_price"] ??
      raw.headers["price"];
    const actualUsdFromHeader = Number(headerValue);

    // Use the actual provider price if available and reasonable; otherwise use the displayed price.
    let priceUsd = expectedUsd;
    if (!isNaN(actualUsdFromHeader) && actualUsdFromHeader > 0) {
      if (actualUsdFromHeader > maxUsd) {
        return res.status(502).json({
          error: "Provider price is higher than expected. Please try again.",
          providerError: `Provider price $${actualUsdFromHeader} exceeds max $${maxUsd}`,
        });
      }
      priceUsd = actualUsdFromHeader;
    }

    const priceNgn = calculateNgnPrice(priceUsd, settings.exchangeRate, settings.markupPercentage);

    if ((user.balance || 0) < priceNgn) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await session.withTransaction(async () => {
      await User.updateOne({ _id: user._id }, { $inc: { balance: -priceNgn } }).session(session).exec();

      const activation = new NumberActivation({
        userId: user._id.toString(),
        email: user.email,
        provider: "daisy",
        activationId,
        phoneNumber,
        service,
        serviceName: serviceName || service,
        country: "187",
        countryName: "United States",
        priceUsd,
        priceNgn,
        status: "waiting",
      });
      await activation.save({ session });

      await new NumberTransaction({
        userId: user._id.toString(),
        email: user.email,
        provider: "daisy",
        reference: generateReference("DAISY"),
        amount: priceNgn,
        type: "activation",
        method: "wallet",
        status: "completed",
        activationId,
      }).save({ session });

      res.json({
        ok: true,
        activation: {
          id: activation._id,
          activationId,
          phoneNumber,
          service: activation.serviceName,
          country: activation.countryName,
          priceNgn,
          status: activation.status,
        },
        newBalance: (user.balance || 0) - priceNgn,
      });
    });
  } catch (err: any) {
    console.error("Rent number error:", err.response?.data || err.message);
    const status = err.response?.status;
    const details = err.response?.data || err.message || String(err);
    const isHtml = typeof details === "string" && (details.trim().startsWith("<") || details.includes("<html"));
    let message = "Failed to rent number. Please try again.";
    if (status === 403) message = "Provider access denied (403). Your API key may be invalid or the server IP is blocked.";
    else if (status === 401) message = "Provider authentication failed. Please check your API key.";
    else if (status === 429) message = "Too many requests to provider. Please wait a moment.";
    res.status(500).json({
      error: message,
      providerStatus: status,
      providerError: isHtml ? "Provider returned an HTML page (likely a block)." : details,
    });
  } finally {
    session.endSession();
  }
});

// Poll DaisySMS activation status
app.get("/api/numbers/daisy/activations/status/:activationId", async (req: Request, res: Response) => {
  try {
    const { activationId } = req.params;
    const text = await daisyRequest("getStatus", { id: activationId });
    let update: any = {};
    let statusText = text;
    if (text.startsWith("STATUS_OK")) {
      const code = text.split(":")[1];
      update.smsCode = code;
      update.status = "code_received";
      statusText = `STATUS_OK:${code}`;
    } else if (text === "STATUS_CANCEL") {
      update.status = "cancelled";
    }
    if (Object.keys(update).length > 0) {
      await NumberActivation.updateOne({ activationId, provider: "daisy" }, update).exec();
    }
    res.json({ status: "success", data: statusText });
  } catch (err: any) {
    console.error("Status error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to fetch status", providerStatus: status, providerError: details });
  }
});

// Update DaisySMS activation status (done=6 or cancel=8)
app.patch("/api/numbers/daisy/activations/:activationId", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { activationId } = req.params;
    const { status, userId } = req.body; // 6 = done, 8 = cancel
    if (!status) return res.status(400).json({ error: "status is required" });

    const activation = await NumberActivation.findOne({ activationId, provider: "daisy" }).lean();
    if (!activation) return res.status(404).json({ error: "Activation not found" });

    const text = await daisyRequest("setStatus", { id: activationId, status });
    const localStatus = status === "8" ? "cancelled" : "completed";
    const cancelled = status === "8" && text.startsWith("ACCESS_CANCEL");
    const alreadyDone = text.startsWith("ACCESS_READY") || text.startsWith("NO_ACTIVATION");

    if (status === "8" && !cancelled && !alreadyDone) {
      // Unexpected response — do not refund
      const isHtml = !text || text.trim().startsWith("<") || text.toLowerCase().includes("<html");
      return res.status(502).json({
        error: "Provider rejected cancellation",
        providerError: isHtml ? "Provider returned an HTML page (likely a security block)." : text,
      });
    }

    await session.withTransaction(async () => {
      await NumberActivation.updateOne({ activationId, provider: "daisy" }, { status: localStatus }).session(session).exec();

      // Refund user if cancellation was accepted by Daisy and not already refunded
      if (cancelled && activation.status !== "cancelled" && activation.status !== "failed") {
        const refundUserId = userId || activation.userId;
        await User.updateOne({ _id: refundUserId }, { $inc: { balance: activation.priceNgn } }).session(session).exec();
        await new NumberTransaction({
          userId: activation.userId,
          email: activation.email,
          provider: "daisy",
          reference: generateReference("REF"),
          amount: activation.priceNgn,
          type: "refund",
          method: "wallet",
          status: "completed",
          activationId,
        }).save({ session });
      }
    });

    res.json({ status: "success", data: text, refunded: cancelled, newStatus: localStatus });
  } catch (err: any) {
    console.error("Update activation error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to cancel activation", providerStatus: status, providerError: details });
  } finally {
    session.endSession();
  }
});

// Webhook: receive SMS/OTP from DaisySMS
app.post("/api/numbers/daisy/webhook", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (data?.activationId) {
      const update: any = {};
      if (data.code) update.smsCode = String(data.code);
      if (data.text) update.smsText = String(data.text);
      update.status = "code_received";
      await NumberActivation.updateOne({ activationId: String(data.activationId), provider: "daisy" }, update).exec();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DaisySMS webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ======== BOOST FOLLOWERS MODULE (Really Simple Social) ========

const RSS_BASE = "https://reallysimplesocial.com/api/v2";
const RSS_API_KEY = process.env.RSS_API_KEY || "";

// Boost settings endpoints (independent from Buy Numbers settings)
app.get("/api/boost/settings", async (req: Request, res: Response) => {
  try {
    const settings = await ensureBoostSettings();
    res.json({
      exchangeRate: settings.exchangeRate,
      markupPercentage: settings.markupPercentage,
      flatMarkupNgn: settings.flatMarkupNgn,
    });
  } catch (err) {
    console.error("Error fetching boost settings:", err);
    res.status(500).json({ error: "Failed to fetch boost settings" });
  }
});

app.put("/api/boost/settings", async (req: Request, res: Response) => {
  try {
    const { exchangeRate, markupPercentage, flatMarkupNgn } = req.body;
    const settings = await ensureBoostSettings();
    if (exchangeRate !== undefined) settings.exchangeRate = Number(exchangeRate);
    if (markupPercentage !== undefined) settings.markupPercentage = Number(markupPercentage);
    if (flatMarkupNgn !== undefined) settings.flatMarkupNgn = Number(flatMarkupNgn);
    settings.updatedAt = new Date();
    await settings.save();
    res.json({
      exchangeRate: settings.exchangeRate,
      markupPercentage: settings.markupPercentage,
      flatMarkupNgn: settings.flatMarkupNgn,
    });
  } catch (err) {
    console.error("Error updating boost settings:", err);
    res.status(500).json({ error: "Failed to update boost settings" });
  }
});

interface RssService {
  service: string;
  name: string;
  type?: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  averageTime?: string;
  description?: string;
  refill?: string;
  cancel?: string;
}

async function rssRequest(action: string, params: Record<string, string | number> = {}) {
  if (!RSS_API_KEY) {
    throw new Error("Boost provider API key is not configured");
  }

  const form = new URLSearchParams();
  form.append("key", RSS_API_KEY);
  form.append("action", action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });

  const res = await axios.post(RSS_BASE, form, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json, text/plain, */*",
    },
    timeout: 30000,
    validateStatus: () => true,
  });

  const data = res.data;
  if (typeof data === "string") {
    const text = data.trim();
    // Some SMM panels return plain text errors
    if (text.toLowerCase().startsWith("<html") || text.toLowerCase().startsWith("<!doctype")) {
      throw new Error("Provider returned an HTML page");
    }
    // Try parse JSON if it looks like JSON
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  }
  return data;
}

function calculateBoostNgnPrice(ratePer1000: number, exchangeRate: number, markupPercentage: number, flatMarkupNgnPer1000 = 0) {
  // ratePer1000 is the provider's rate per 1,000 units
  // Selling price per 1,000 = (ratePer1000 * exchangeRate * (1 + markup%)) + flatMarkupNgnPer1000
  const per1000Base = ratePer1000 * exchangeRate * (1 + markupPercentage / 100);
  return Math.ceil(per1000Base + flatMarkupNgnPer1000);
}

function normalizeRssServices(raw: any): RssService[] {
  if (!raw) return [];
  // Common format: array of services
  if (Array.isArray(raw)) {
    return raw.map((s: any) => ({
      service: String(s.service ?? s.id ?? ""),
      name: String(s.name ?? ""),
      type: s.type ? String(s.type) : undefined,
      category: String(s.category ?? ""),
      rate: Number(s.rate ?? s.price ?? 0),
      min: Number(s.min ?? 0),
      max: Number(s.max ?? 0),
      averageTime: s.average_time ? String(s.average_time) : undefined,
      description: s.description ? String(s.description) : undefined,
      refill: s.refill ? String(s.refill) : undefined,
      cancel: s.cancel ? String(s.cancel) : undefined,
    })).filter((s) => s.service && s.name);
  }
  // Object keyed by service id
  if (typeof raw === "object") {
    return Object.keys(raw).map((key) => {
      const s = raw[key];
      if (!s || typeof s !== "object") return null;
      return {
        service: String(s.service ?? key ?? ""),
        name: String(s.name ?? ""),
        type: s.type ? String(s.type) : undefined,
        category: String(s.category ?? ""),
        rate: Number(s.rate ?? s.price ?? 0),
        min: Number(s.min ?? 0),
        max: Number(s.max ?? 0),
        averageTime: s.average_time ? String(s.average_time) : undefined,
        description: s.description ? String(s.description) : undefined,
        refill: s.refill ? String(s.refill) : undefined,
        cancel: s.cancel ? String(s.cancel) : undefined,
      };
    }).filter(Boolean) as RssService[];
  }
  return [];
}

function groupServicesByCategory(services: RssService[]) {
  const groups: Record<string, RssService[]> = {};
  services.forEach((s) => {
    const cat = s.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  });
  // Sort categories and services within each category
  const sorted: Record<string, RssService[]> = {};
  Object.keys(groups)
    .sort((a, b) => a.localeCompare(b))
    .forEach((cat) => {
      sorted[cat] = groups[cat].sort((a, b) => a.name.localeCompare(b.name));
    });
  return sorted;
}

// Proxy: list services grouped by category
app.get("/api/boost/services", async (req: Request, res: Response) => {
  try {
    if (!RSS_API_KEY) {
      return res.status(503).json({ error: "Boost provider API key is not configured" });
    }

    const cacheKey = "boost:services";
    const cached = cacheGet<RssService[]>(cacheKey);
    let services: RssService[];
    if (cached) {
      services = cached;
    } else {
      const raw = await rssRequest("services");
      services = normalizeRssServices(raw);
      if (services.length === 0) {
        return res.status(502).json({ error: "No services returned by provider", providerResponse: raw });
      }
      cacheSet(cacheKey, services, 10 * 60 * 1000); // cache 10 minutes
    }

    const settings = await ensureBoostSettings();
    const enriched = services.map((s) => {
      const rate = Number(s.rate) || 0;
      const min = Number(s.min) || 0;
      const max = Number(s.max) || 0;
      const pricePer1000Ngn = calculateBoostNgnPrice(rate, settings.exchangeRate, settings.markupPercentage, settings.flatMarkupNgn);
      const minPriceNgn = Math.ceil((pricePer1000Ngn * min) / 1000);
      return {
        ...s,
        rate: Number(rate.toFixed(4)),
        min,
        max,
        pricePer1000Ngn,
        minPriceNgn,
      };
    });

    res.json({ status: "success", data: groupServicesByCategory(enriched) });
  } catch (err: any) {
    console.error("Boost services error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(502).json({ error: "Failed to load boost services", providerStatus: status, providerError: details });
  }
});

// Place a boost order
app.post("/api/boost/orders", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { userId, serviceId, serviceName, category, link, quantity, ratePer1000Usd } = req.body;
    if (!userId || !serviceId || !link || !quantity) {
      return res.status(400).json({ error: "userId, serviceId, link and quantity are required" });
    }

    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: "User not found" });

    const settings = await ensureBoostSettings();
    const qty = Number(quantity);
    const rate = Number(ratePer1000Usd) || 0;
    const pricePer1000Ngn = calculateBoostNgnPrice(rate, settings.exchangeRate, settings.markupPercentage, settings.flatMarkupNgn);
    const priceUsd = (rate * qty) / 1000;
    const priceNgn = Math.ceil((pricePer1000Ngn * qty) / 1000);

    if (!priceUsd || priceUsd <= 0) {
      return res.status(400).json({ error: "Invalid service price" });
    }
    if ((user.balance || 0) < priceNgn) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const rssResp = await rssRequest("add", { service: serviceId, link, quantity: qty });

    // Common response formats: { order: 123 } or { order_id: 123 } or plain number string
    let providerOrderId: string | undefined;
    if (typeof rssResp === "string") {
      providerOrderId = rssResp.trim();
    } else if (rssResp && typeof rssResp === "object") {
      providerOrderId = String(rssResp.order ?? rssResp.order_id ?? rssResp.id ?? "");
    }

    if (!providerOrderId) {
      return res.status(502).json({ error: "Failed to place boost order", providerResponse: rssResp });
    }

    let newBalance = 0;
    await session.withTransaction(async () => {
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { balance: -priceNgn } },
        { new: true, session }
      ).exec();
      newBalance = updatedUser?.balance || 0;

      await new BoostOrder({
        userId: user._id.toString(),
        email: user.email,
        providerOrderId,
        serviceId: String(serviceId),
        serviceName: serviceName || "Boost Service",
        category: category || "",
        link,
        quantity: qty,
        ratePer1000Usd: rate,
        priceUsd,
        priceNgn,
        status: "Pending",
      }).save({ session });
    });

    res.json({ ok: true, orderId: providerOrderId, priceNgn, newBalance });
  } catch (err: any) {
    console.error("Boost order error:", err.response?.data || err.message);
    const { status, details } = providerErrorDetails(err);
    res.status(500).json({ error: "Failed to place boost order", providerStatus: status, providerError: details });
  } finally {
    session.endSession();
  }
});

// Get user's boost orders
app.get("/api/boost/orders/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const orders = await BoostOrder.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("Error fetching boost orders:", err);
    res.status(500).json({ error: "Failed to fetch boost orders" });
  }
});

// Sync an order status from provider
async function syncBoostOrderStatus(order: any) {
  if (!order?.providerOrderId) return order;
  try {
    const rssResp = await rssRequest("status", { order: order.providerOrderId });
    let status = order.status;
    let startCount = order.startCount;
    let remains = order.remains;
    let charge = order.charge;
    let currency = order.currency;

    if (typeof rssResp === "object" && rssResp) {
      status = rssResp.status ?? status;
      startCount = rssResp.start_count ?? startCount;
      remains = rssResp.remains ?? remains;
      charge = rssResp.charge ?? charge;
      currency = rssResp.currency ?? currency;
    }

    await BoostOrder.updateOne(
      { _id: order._id },
      { status, startCount, remains, charge, currency, updatedAt: new Date() }
    ).exec();

    return { ...order, status, startCount, remains, charge, currency };
  } catch (e) {
    console.error("Boost status sync error for order", order.providerOrderId, e);
    return order;
  }
}

// Check boost order status
app.get("/api/boost/orders/status/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await BoostOrder.findOne({ providerOrderId: orderId }).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    const updated = await syncBoostOrderStatus(order);
    res.json(updated);
  } catch (err) {
    console.error("Boost status error:", err);
    res.status(500).json({ error: "Failed to fetch boost order status" });
  }
});

// Admin: all boost orders
app.get("/api/boost/admin/orders", async (req: Request, res: Response) => {
  try {
    const orders = await BoostOrder.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("Admin boost orders error:", err);
    res.status(500).json({ error: "Failed to fetch boost orders" });
  }
});

// Get user's refund-eligible boost orders
app.get("/api/boost/refunds/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const orders = await BoostOrder.find({
      userId,
      status: { $in: ["Canceled", "Partial", "Cancelled"] },
    }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("Error fetching boost refunds:", err);
    res.status(500).json({ error: "Failed to fetch boost refunds" });
  }
});

// Admin: all refund-eligible boost orders
app.get("/api/boost/admin/refunds", async (req: Request, res: Response) => {
  try {
    const orders = await BoostOrder.find({
      status: { $in: ["Canceled", "Partial", "Cancelled"] },
    }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("Admin boost refunds error:", err);
    res.status(500).json({ error: "Failed to fetch boost refunds" });
  }
});

// Admin: sync all pending boost orders
app.post("/api/boost/admin/sync", async (req: Request, res: Response) => {
  try {
    const pending = await BoostOrder.find({
      status: { $in: ["Pending", "In progress", "Processing", "In Progress"] },
    }).lean();
    const results = [];
    for (const order of pending) {
      results.push(await syncBoostOrderStatus(order));
    }
    res.json({ synced: results.length, orders: results });
  } catch (err) {
    console.error("Boost admin sync error:", err);
    res.status(500).json({ error: "Failed to sync boost orders" });
  }
});

// Start the server (after connecting to MongoDB)
start();
