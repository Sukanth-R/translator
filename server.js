const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// Enhanced CORS configuration
const allowedOrigins = [
  'https://astraautomax.in',
  'https://www.astraautomax.in',
  'https://adminastraautomax.in',
  'https://www.adminastraautomax.in',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(bodyParser.json({ limit: "10mb" }));

// MongoDB Connection
const mongoURI = "mongodb+srv://sukanth:sukanth0021@cluster0.qknti.mongodb.net/automax?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Product Schema and Model
const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  volt: String,
  partNo: String,
  color: String,
  image: Buffer,
  stock: String,
});

const Product = mongoose.model("Product", productSchema);

// Contact Schema and Model
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

// API Routes

// Contact Routes
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, mobile, country, subject, message } = req.body;
    
    if (!name || !email || !mobile || !country || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newContact = new Contact({
      name,
      email,
      mobile,
      country,
      subject,
      message
    });

    await newContact.save();
    res.status(201).json({ message: 'Contact form submitted successfully', contact: newContact });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Product Routes
app.post("/api/products", async (req, res) => {
  try {
    const { name, category, volt, partNo, color, image, stock } = req.body;

    if (!name || !category || !volt || !partNo || !color || !image || !stock) {
      return res.status(400).json({ error: "All fields are required" });
    }

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
      stock: product.stock,
    }));

    res.status(200).json(formattedProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
      stock: product.stock,
    };

    res.status(200).json(formattedProduct);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, volt, partNo, color, image, stock } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    product.name = name || product.name;
    product.category = category || product.category;
    product.volt = volt || product.volt;
    product.partNo = partNo || product.partNo;
    product.color = color || product.color;
    product.stock = stock || product.stock;

    if (image && image.startsWith("data:image")) {
      product.image = Buffer.from(image.split(",")[1], "base64");
    }

    await product.save();
    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS policy violation' });
  } else {
    res.status(500).json({ error: 'Something broke!' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
