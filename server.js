const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const mongoURI = "mongodb+srv://sukanth:sukanth0021@cluster0.qknti.mongodb.net/automax?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Admin Schema
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema, 'admin');


const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  volt: String,
  partNo: String,
  color: String,
  image: Buffer,
  stock:String,
});

const Product = mongoose.model("Product", productSchema);

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Contact Schema
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  country: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', contactSchema, 'contacts');

// Add this to your existing server.js file

// API Endpoint to fetch all contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }); // Sort by newest first
    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// API Endpoint to handle form submission
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, mobile, country, subject, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !mobile || !country || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create new contact document
    const newContact = new Contact({
      name,
      email,
      mobile,
      country,
      subject,
      message
    });

    // Save to database
    await newContact.save();

    res.status(201).json({ message: 'Contact form submitted successfully', contact: newContact });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Add a new product
app.post("/api/products", async (req, res) => {
  try {
    const { name, category, volt, partNo, color, image,stock } = req.body;

    // Validate required fields
    if (!name || !category || !volt || !partNo || !color || !image || !stock) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate image format
    if (!image.startsWith("data:image")) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    const product = new Product({
      name,
      category,
      volt,
      partNo,
      color,
      image: Buffer.from(image.split(",")[1], "base64"),
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
    const formattedProducts = products.map((product) => ({
      _id: product._id,
      name: product.name,
      category: product.category,
      volt: product.volt,
      partNo: product.partNo,
      color: product.color,
      image: product.image ? product.image.toString("base64") : null,
      stock:product.stock,
    }));

    res.status(200).json(formattedProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch a specific product by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const formattedProduct = {
      _id: product._id,
      name: product.name,
      category: product.category,
      volt: product.volt,
      partNo: product.partNo,
      color: product.color,
      image: product.image ? product.image.toString("base64") : null,
      stock:product.stock,
    };

    res.status(200).json(formattedProduct);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update a product by ID
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, volt, partNo, color, image, stock } = req.body;

    console.log("Received update request for product ID:", id);
    console.log("Request body:", req.body);

    // Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      console.log("Product not found");
      return res.status(404).json({ error: "Product not found" });
    }

    // Update the product fields
    product.name = name || product.name;
    product.category = category || product.category;
    product.volt = volt || product.volt;
    product.partNo = partNo || product.partNo;
    product.color = color || product.color;
    product.stock = stock || product.stock;

    // Update the image if provided
    if (image) {
      if (image.startsWith("data:image")) {
        console.log("Updating image");
        product.image = Buffer.from(image.split(",")[1], "base64");
      } else {
        console.log("Invalid image format. Image not updated.");
      }
    } else {
      console.log("No image provided. Image not updated.");
    }

    // Save the updated product
    await product.save();
    console.log("Product updated successfully");
    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a product by ID
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/", (req, res) => {
  res.send("Automax server is live 🚀");
});

const JWT_SECRET = "super_secret_key"; // Change this to a secure value or store in .env

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for email and password
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare hashed passwords
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ id: admin._id, email: admin.email }, JWT_SECRET, { expiresIn: "1h" });

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
