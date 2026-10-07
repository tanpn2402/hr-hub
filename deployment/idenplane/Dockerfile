FROM node:22-bookworm-slim

WORKDIR /app

# Copy the root package.json and package-lock.json to the container
COPY ./package.json ./package-lock.json ./

# Copy the built files of the idenplane workspace to the container
COPY ./idenplane/ ./apps/idenplane/

# Copy themes
COPY ./idenplane/themes/ ./apps/themes/

# Install dependencies for the idenplane workspace
RUN npm ci --omit=dev --workspace=apps/idenplane

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "cd apps/idenplane && npx prisma db push --config=prisma.config.ts --schema=prisma/schema.prisma && node main.js"]