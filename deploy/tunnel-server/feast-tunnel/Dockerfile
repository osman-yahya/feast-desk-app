FROM node:22-slim AS builder
WORKDIR /app
COPY package.json ./
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" && \
    git config --global url."https://github.com/".insteadOf "git@github.com:" && \
    npm install --omit=dev

FROM node:22-slim
# Debian'da kullanıcı oluşturma komutları Alpine'den farklıdır:
RUN groupadd -r feast && useradd -r -g feast feast
WORKDIR /app

# Sadece gerekli dosyaları kopyala
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Yetkilendirme
RUN chown -R feast:feast /app
USER feast

EXPOSE 4000
CMD ["node", "server.js"]