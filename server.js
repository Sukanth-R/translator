require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ====== CLOUDINARY CONFIG ======
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ====== MONGODB CONNECTION ======
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected successfully"))
.catch(err => console.error("MongoDB connection error:", err));

// ====== SCHEMAS ======
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
}, { timestamps: true });
const Admin = mongoose.model("Admin", adminSchema, "admin");

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  volt: String,
  partNo: String,
  color: String,
  imageUrl: String, // store Cloudinary URL instead of Buffer
  stock: String,
});
const Product = mongoose.model("Product", productSchema);

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  country: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model("Contact", contactSchema, "contacts");

// ====== CONTACT ROUTES ======
app.get("/api/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, mobile, country, subject, message } = req.body;
    if (!name || !email || !mobile || !country || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const newContact = new Contact({ name, email, mobile, country, subject, message });
    await newContact.save();
    res.status(201).json({ message: "Contact form submitted successfully", contact: newContact });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ====== PRODUCT ROUTES ======

// Add a new product
app.post("/api/products", async (req, res) => {
  try {
    const { name, category, volt, partNo, color, image, stock } = req.body;
    if (!name || !category || !volt || !partNo || !color || !image || !stock) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!image.startsWith("data:image")) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    // Upload image to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(image, { folder: "products" });

    const product = new Product({
      name,
      category,
      volt,
      partNo,
      color,
      imageUrl: uploadResponse.secure_url,
      stock,
    });

    await product.save();
    res.status(201).json({ message: "Product added successfully" });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch product by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update product
app.put("/api/products/:id", async (req, res) => {
  try {
    const { name, category, volt, partNo, color, image, stock } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    product.name = name || product.name;
    product.category = category || product.category;
    product.volt = volt || product.volt;
    product.partNo = partNo || product.partNo;
    product.color = color || product.color;
    product.stock = stock || product.stock;

    if (image && image.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(image, { folder: "products" });
      product.imageUrl = uploadResponse.secure_url;
    }

    await product.save();
    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ====== AUTH ======
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id, email: admin.email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ====== ROOT ======
app.get("/", (req, res) => {
  res.send("Automax server is live 🚀");
});

// ====== SERVER ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
