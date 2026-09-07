import mongoose, { Schema, Document } from "mongoose";

export interface ICartItem {
  productName: string;
  quantity: number;
  price: number;
  productId?: mongoose.Types.ObjectId;
  assignedItems?: IProductItem[]; // Digital items assigned after purchase
}

export interface ICart extends Document {
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
  isPurchased?: boolean;
  purchaseDate?: Date;
  createdAt: Date;
}

export interface IPayment extends Document {
  user?: mongoose.Types.ObjectId; // optional for front-end local users
  userLocalId?: string; // localStorage user id from client
  email?: string;
  amount: number;
  method: string;
  status: string; // pending | completed | failed
  reference?: string; // our internal paymentReference
  transactionReference?: string; // gateway reference
  isCredited?: boolean; // whether balance already applied to user wallet
  createdAt: Date;
}

export interface IUser extends Document {
  email: string;
  name?: string;
  password?: string;
  balance?: number;
  referralCode?: string;
  referredBy?: string;
  phoneNumber?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  passwordResetLastSentAt?: Date;
  createdAt: Date;
}

export interface IAdmin extends Document {
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
}

export interface IProductItem {
  _id?: mongoose.Types.ObjectId;
  username: string;
  password: string;
  twoFactorAuth?: string;
  emailAddress: string;
  recoveryPassword?: string;
  isSold: boolean;
  soldTo?: mongoose.Types.ObjectId; // User who purchased
  soldAt?: Date;
}

export interface IProduct extends Document {
  name: string;
  price: number;
  description?: string;
  category?: string;
  imageUrl?: string;
  items: IProductItem[]; // Array of account credentials
  createdAt: Date;
}

// Serial Number interface for catalog products
export interface ISerialNumber {
  id: string;
  serial: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Date;
}

// Catalog Product interface
export interface ICatalogProduct extends Document {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  serialNumbers?: ISerialNumber[];
  cachedAvailableStock?: number;
  createdAt: Date;
}

// Purchase History interface
export interface IPurchaseHistory extends Document {
  userId: string; // localStorage user ID or MongoDB user ID
  email: string;
  productId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  quantity: number;
  assignedSerials: string[];
  purchaseDate: Date;
}

// Catalog Category interface
export interface ICatalogCategory extends Document {
  id: string;
  name: string;
  icon?: string;
  createdAt: Date;
}

// Define ProductItemSchema first since it's used in CartItemSchema
const ProductItemSchema = new Schema<IProductItem>({
  username: { type: String, required: true },
  password: { type: String, required: true },
  twoFactorAuth: { type: String },
  emailAddress: { type: String, required: true },
  recoveryPassword: { type: String },
  isSold: { type: Boolean, default: false },
  soldTo: { type: Schema.Types.ObjectId, ref: "User" },
  soldAt: { type: Date },
});

const CartItemSchema = new Schema<ICartItem>({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  productId: { type: Schema.Types.ObjectId, ref: "Product" },
  assignedItems: { type: [ProductItemSchema], default: [] },
});

const CartSchema = new Schema<ICart>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: { type: [CartItemSchema], default: [] },
  isPurchased: { type: Boolean, default: false },
  purchaseDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const PaymentSchema = new Schema<IPayment>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: false },
  userLocalId: { type: String },
  email: { type: String },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  status: { type: String, required: true },
  reference: { type: String },
  transactionReference: { type: String },
  isCredited: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  name: { type: String },
  password: { type: String },
  balance: { type: Number, default: 0 },
  referralCode: { type: String, unique: true, sparse: true, index: true },
  referredBy: { type: String },
  phoneNumber: { type: String, trim: true },
  passwordResetTokenHash: { type: String },
  passwordResetExpiresAt: { type: Date },
  passwordResetLastSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const AdminSchema = new Schema<IAdmin>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  category: { type: String },
  imageUrl: { type: String },
  items: { type: [ProductItemSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// Serial Number Schema
const SerialNumberSchema = new Schema<ISerialNumber>({
  id: { type: String, required: true },
  serial: { type: String, required: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: String },
  usedAt: { type: Date },
});

// Catalog Product Schema
const CatalogProductSchema = new Schema<ICatalogProduct>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  serialNumbers: { type: [SerialNumberSchema], default: [] },
  cachedAvailableStock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Prevent silent double-spends in concurrent purchases.
// If two requests try to update the same product at once, one will fail with a version error.
CatalogProductSchema.set("optimisticConcurrency", true);

// Purchase History Schema
const PurchaseHistorySchema = new Schema<IPurchaseHistory>({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  productId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true },
  assignedSerials: { type: [String], default: [] },
  purchaseDate: { type: Date, default: Date.now },
});

// Index for efficient sorting by purchaseDate
PurchaseHistorySchema.index({ purchaseDate: -1 });

export const Cart = mongoose.model<ICart>("Cart", CartSchema);
export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
export const User = mongoose.model<IUser>("User", UserSchema);
export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
export const Product = mongoose.model<IProduct>("Product", ProductSchema);
export const CatalogProduct = mongoose.model<ICatalogProduct>("CatalogProduct", CatalogProductSchema);
export const PurchaseHistory = mongoose.model<IPurchaseHistory>("PurchaseHistory", PurchaseHistorySchema);
// Catalog Category Schema and Model
const CatalogCategorySchema = new Schema<ICatalogCategory>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: { type: String }, // Base64 or URL
  createdAt: { type: Date, default: Date.now },
});

export const CatalogCategory = mongoose.model<ICatalogCategory>("CatalogCategory", CatalogCategorySchema);
