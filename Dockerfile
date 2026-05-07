# ---- Base image ----
FROM python:3.11-slim

# Install Node.js
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

WORKDIR /app

# Copy repo
COPY . .

# Install backend deps
RUN pip install --no-cache-dir -r backend/requirements.txt

# Build frontend
WORKDIR /app/frontend
RUN npm install && npm run build

WORKDIR /app

# Start app
CMD ["bash", "start.sh"]
