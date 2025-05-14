# Use Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Build the app
RUN npm run build

# Expose frontend port
EXPOSE 3000

# Start the app in development mode
CMD ["npm", "run", "dev"]
