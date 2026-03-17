FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY backend/src ./src
COPY backend/public ./public
COPY backend/database ./database
COPY frontend ./frontend

# Create database directory
RUN mkdir -p /app/database

# Initialize database
RUN node src/init-db.js

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js"]
