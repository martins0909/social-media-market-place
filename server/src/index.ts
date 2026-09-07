import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import axios from "axios";
import { User, Admin, Cart, Payment, Product, CatalogProduct, PurchaseHistory, CatalogCategory } from "./models";
import paymentsRouter from "./routes/payments";

const app = express();
// allow CORS from local dev and a production frontend URL set via env
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:8080";
app.use(cors({
  origin: [
    FRONTEND_URL, 
    'https://victohs.com',
    'https://www.victohs.com',
    'https://viktohsstore.com',
    'https://www.viktohsstore.com',
    'https://logs-online.com',
    'https://www.logs-online.com',
    'https://logs-online.vercel.app',
    'http://localhost:8080', 
    'http://localhost:8081', 
    'http://localhost:4001', 
    'http://localhost:4000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

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

    if (referrer) {
      await User.updateOne({ _id: referrer._id }, { $inc: { balance: 100 } }).exec();
    }
    
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

    // Public response: no serialNumbers. Provide availableStock only.
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
      // Super fast query! No more array unwinding.
      const products = await CatalogProduct.find({}, "-serialNumbers -image")
        .sort({ createdAt: -1 })
        .lean()
        .exec();
        
      // Ensure frontend sees 'availableStock' property matching the cached count
      const mappedProducts = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: `/api/catalog/${p.id}/image`,
        category: p.category,
        createdAt: p.createdAt,
        availableStock: p.cachedAvailableStock || 0,
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
    const { userId, productId, quantity } = req.body as {
      userId?: string;
      productId?: string;
      quantity?: number;
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

        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw Object.assign(new Error("Invalid quantity"), { statusCode: 400 });
        }

        const totalPrice = (catalogProduct.price || 0) * qty;
        if ((user.balance || 0) < totalPrice) {
          console.error("Insufficient balance:", { balance: user.balance, required: totalPrice });
          throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 });
        }

        const serials = Array.isArray(catalogProduct.serialNumbers) ? catalogProduct.serialNumbers : [];
        const available = serials.filter((s: any) => !s.isUsed);
        if (available.length < qty) {
          throw Object.assign(new Error(`Only ${available.length} units available in stock.`), { statusCode: 400 });
        }

        // Assign serials server-side (never expose whole pool to the client)
        const chosen = available.slice(0, qty);
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

        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $inc: { balance: -totalPrice } },
          { new: true, session }
        ).exec();

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
      return res.status(500).json({ error: "Verification failed", details: err.response?.data ?? err.message });
    } else if (err instanceof Error) {
      console.error("Verify error:", err.message);
      return res.status(500).json({ error: "Verification failed", details: err.message });
    } else {
      console.error("Unknown verify error:", err);
      return res.status(500).json({ error: "Verification failed" });
    }
  }
});

// Start the server (after connecting to MongoDB)
start();
