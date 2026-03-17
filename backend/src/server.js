const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session for cart management
app.use(session({
  secret: 'williams-parkway-thrift-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Database connection
const dbPath = path.join(__dirname, '../database/thrift_shop.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize cart session
app.use((req, res, next) => {
  if (!req.session.cartId) {
    req.session.cartId = uuidv4();
  }
  next();
});

// === API ROUTES ===

// Get all products
app.get('/api/products', (req, res) => {
  const { category, search, limit = 50 } = req.query;
  let sql = 'SELECT * FROM products WHERE status = "available"';
  const params = [];
  
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  
  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ products: rows });
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ product: row });
  });
});

// Get categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ categories: rows });
  });
});

// Get cart
app.get('/api/cart', (req, res) => {
  const cartId = req.session.cartId;
  
  db.get('SELECT * FROM cart_sessions WHERE id = ?', [cartId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const items = row ? JSON.parse(row.items || '[]') : [];
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    res.json({ 
      cartId,
      items,
      total: total.toFixed(2),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
    });
  });
});

// Add to cart
app.post('/api/cart/add', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const cartId = req.session.cartId;
  
  if (!productId) {
    return res.status(400).json({ error: 'Product ID required' });
  }
  
  // Get product details
  db.get('SELECT * FROM products WHERE id = ? AND status = "available"', [productId], (err, product) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!product) {
      return res.status(404).json({ error: 'Product not found or unavailable' });
    }
    
    // Get current cart
    db.get('SELECT * FROM cart_sessions WHERE id = ?', [cartId], (err, row) => {
      let items = [];
      if (row && row.items) {
        items = JSON.parse(row.items);
      }
      
      // Check if item already in cart
      const existingItem = items.find(item => item.productId === productId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        items.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image_url,
          quantity: quantity
        });
      }
      
      // Save cart
      const sql = `
        INSERT INTO cart_sessions (id, items, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET 
          items = excluded.items, 
          updated_at = CURRENT_TIMESTAMP
      `;
      
      db.run(sql, [cartId, JSON.stringify(items)], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.json({
          message: 'Added to cart',
          items,
          total: total.toFixed(2),
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
        });
      });
    });
  });
});

// Remove from cart
app.post('/api/cart/remove', (req, res) => {
  const { productId } = req.body;
  const cartId = req.session.cartId;
  
  db.get('SELECT * FROM cart_sessions WHERE id = ?', [cartId], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'Cart not found' });
    }
    
    let items = JSON.parse(row.items || '[]');
    items = items.filter(item => item.productId !== productId);
    
    db.run(
      'UPDATE cart_sessions SET items = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(items), cartId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.json({
          message: 'Removed from cart',
          items,
          total: total.toFixed(2),
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
        });
      }
    );
  });
});

// Clear cart
app.post('/api/cart/clear', (req, res) => {
  const cartId = req.session.cartId;
  
  db.run(
    'UPDATE cart_sessions SET items = "[]", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [cartId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Cart cleared', items: [], total: '0.00', itemCount: 0 });
    }
  );
});

// Create order (checkout)
app.post('/api/orders', (req, res) => {
  const { customerName, customerEmail, customerPhone, notes } = req.body;
  const cartId = req.session.cartId;
  
  if (!customerName || !customerEmail) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  
  db.get('SELECT * FROM cart_sessions WHERE id = ?', [cartId], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'Cart not found' });
    }
    
    const items = JSON.parse(row.items || '[]');
    if (items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    db.run(
      `INSERT INTO orders (session_id, customer_name, customer_email, customer_phone, items, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cartId, customerName, customerEmail, customerPhone || '', JSON.stringify(items), total, notes || ''],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Clear cart after order
        db.run('UPDATE cart_sessions SET items = "[]" WHERE id = ?', [cartId]);
        
        res.json({
          message: 'Order submitted successfully',
          orderId: this.lastID,
          total: total.toFixed(2)
        });
      }
    );
  });
});

// === ADMIN API (Basic auth can be added later) ===

// Get all orders
app.get('/api/admin/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Parse items JSON for each order
    const orders = rows.map(row => ({
      ...row,
      items: JSON.parse(row.items || '[]')
    }));
    res.json({ orders });
  });
});

// Update order status
app.post('/api/admin/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Order status updated' });
  });
});

// Add new product
app.post('/api/admin/products', (req, res) => {
  const { name, description, price, category, condition, size, image_url } = req.body;
  
  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price required' });
  }
  
  db.run(
    `INSERT INTO products (name, description, price, category, condition, size, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, description, price, category, condition, size, image_url],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Product added', productId: this.lastID });
    }
  );
});

// Update product
app.post('/api/admin/products/:id', (req, res) => {
  const { name, description, price, category, condition, size, image_url, status } = req.body;
  
  db.run(
    `UPDATE products SET 
      name = ?, description = ?, price = ?, category = ?, 
      condition = ?, size = ?, image_url = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description, price, category, condition, size, image_url, status, req.params.id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Product updated' });
    }
  );
});

// Serve the main frontend HTML
app.get('/', (req, res) => {
  const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, '../../frontend');
  res.sendFile(path.join(frontendPath, 'williams-parkway-thrift-shop (4) (2).html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
