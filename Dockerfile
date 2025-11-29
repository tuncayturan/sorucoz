# Railway için Dockerfile - Next.js + Puppeteer (Chromium)
FROM node:20-slim

# Chromium ve gerekli bağımlılıkları yükle
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1 \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer için Chromium PATH'ini ayarla
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Çalışma dizini
WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci

# Projeyi kopyala
COPY . .

# Build
RUN npm run build

# Port
EXPOSE 3000

# Başlat
CMD ["npm", "start"]

