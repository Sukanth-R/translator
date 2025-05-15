const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// ======================
// Security Middleware
// ======================
app.use(helmet());
app.use(bodyParser.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// ======================
// CORS Configuration
// ======================
const allowedOrigins = [
  'https://astraautomax.in',
  'https://www.astraautomax.in',
  'https://adminastraautomax.in',
  'https://www.adminastraautomax.in',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Flexible origin matching
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      const originUrl = new URL(origin);
      const allowedUrl = new URL(allowedOrigin);
      return originUrl.hostname === allowedUrl.hostname ||
             originUrl.hostname === allowedUrl.hostname.replace('www.', '') ||
             originUrl.hostname === `www.${allowedUrl.hostname}`;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Manual CORS headers as additional protection
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => origin === allowed)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// ======================
// Database Connection
// ======================
const mongoURI = "mongodb+srv://sukanth:sukanth0021@cluster0.qknti.mongodb.net/automax?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// ======================
// Database Models
// ======================
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  volt: { type: String, required: true },
  partNo: { type: String, required: true, unique: true },
  color: { type: String, required: true },
  image: { type: Buffer, required: true },
  stock: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
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

const Contact = mongoose.model('Contact', contactSchema, 'contacts');

// ======================
// API Routes
// ======================

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Contact Endpoints
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
    const requiredFields = ['name', 'email', 'mobile', 'country', 'subject', 'message'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }

    const newContact = new Contact(req.body);
    await newContact.save();
    
    res.status(201).json({
      success: true,
      message: 'Contact submitted successfully',
      contactId: newContact._id
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Product Endpoints
app.post("/api/products", async (req, res) => {
  try {
    const requiredFields = ['name', 'category', 'volt', 'partNo', 'color', 'image', 'stock'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields
      });
    }

    if (!req.body.image.startsWith("data:image")) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    const product = new Product({
      ...req.body,
      image: Buffer.from(req.body.image.split(",")[1], "base64")
    });

    await product.save();
    res.status(201).json({
      success: true,
      message: "Product added successfully",
      productId: product._id
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Part number already exists" });
    }
    console.error("Product creation error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// [Include GET, PUT, DELETE product routes here...]

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Maintain CORS in error responses
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => origin === allowed)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      allowedOrigins,
      yourOrigin: origin
    });
  }
  
  res.status(500).json({ error: 'Internal Server Error' });
});

// ======================
// Server Startup
// ======================
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`MongoDB connected: ${mongoose.connection.readyState === 1 ? 'Yes' : 'No'}`);
});
