FROM node:22-bookworm-slim

WORKDIR /app

# Copy the root package.json and package-lock.json to the container
COPY ./package.json ./package-lock.json ./

# Copy the built files of the hr-hub-api workspace to the container
COPY ./hr-hub-api/ ./apps/hr-hub-api/

# Install dependencies for the hr-hub-api workspace
RUN npm ci --omit=dev --workspace=apps/hr-hub-api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "cd apps/hr-hub-api && npx prisma migrate deploy --config=prisma.config.ts --schema=prisma/schema.prisma && node src/main.js"]