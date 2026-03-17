const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/thrift_shop.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

const schema = `
-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT,
  condition TEXT,
  size TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'available',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT
);

-- Cart sessions table
CREATE TABLE IF NOT EXISTS cart_sessions (
  id TEXT PRIMARY KEY,
  items TEXT, -- JSON array of cart items
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  items TEXT, -- JSON array of ordered items
  total DECIMAL(10, 2),
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const seedData = `
-- Insert default categories
INSERT OR IGNORE INTO categories (name, description) VALUES
  ('Clothing', 'Vintage and contemporary clothing'),
  ('Accessories', 'Bags, jewelry, belts, and more'),
  ('Home Goods', 'Furniture, decor, and kitchen items'),
  ('Shoes', 'Footwear for all occasions'),
  ('Books', 'Vintage books and collectibles');

-- Insert sample products
INSERT OR IGNORE INTO products (name, description, price, category, condition, size, status) VALUES
  ('Vintage Denim Jacket', 'Classic 90s denim jacket in excellent condition', 45.00, 'Clothing', 'Excellent', 'M', 'available'),
  ('Leather Crossbody Bag', 'Genuine leather crossbody bag with adjustable strap', 35.00, 'Accessories', 'Good', 'One Size', 'available'),
  ('Mid-Century Table Lamp', 'Ceramic table lamp with original shade', 65.00, 'Home Goods', 'Very Good', 'One Size', 'available'),
  ('Nike Air Max 90', 'Classic Air Max 90s, gently worn', 55.00, 'Shoes', 'Good', 'US 10', 'available'),
  ('First Edition Novel', 'Vintage first edition mystery novel', 25.00, 'Books', 'Good', 'N/A', 'available'),
  ('Wool Sweater', 'Cozy wool sweater perfect for winter', 28.00, 'Clothing', 'Excellent', 'L', 'available'),
  ('Silk Scarf', 'Beautiful printed silk scarf', 18.00, 'Accessories', 'Like New', 'One Size', 'available'),
  ('Vintage Coffee Mug Set', 'Set of 4 matching ceramic mugs', 22.00, 'Home Goods', 'Good', 'One Size', 'available');

-- Insert default admin (username: admin, password: thrift2024)
INSERT OR IGNORE INTO admin_users (username, password_hash) 
VALUES ('admin', '$2a$10$YourHashedPasswordHere');
`;

db.exec(schema, (err) => {
  if (err) {
    console.error('Error creating schema:', err);
    db.close();
    process.exit(1);
  }
  console.log('Database schema created successfully');
  
  db.exec(seedData, (err) => {
    if (err) {
      console.error('Error seeding data:', err);
    } else {
      console.log('Sample data inserted successfully');
    }
    db.close();
    console.log('Database initialization complete');
  });
});
