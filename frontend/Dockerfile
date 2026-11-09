FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN apk add --no-cache openssl curl \
    && mkdir -p /etc/nginx/certs /app/staticfiles \
    && openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
       -keyout /etc/nginx/certs/selfsigned.key \
       -out /etc/nginx/certs/selfsigned.crt \
       -subj "/C=ZW/ST=Harare/L=Harare/O=Ministry of Lands and Rural Development/CN=land.applications" \
       -addext "subjectAltName=DNS:land.applications,IP:10.100.7.180,DNS:localhost" \
    && chown -R nginx:nginx /etc/nginx/certs /app/staticfiles

COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/health/ || exit 1
