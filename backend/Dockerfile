FROM node:22-alpine AS builder
WORKDIR /app
# Force devDependencies (nest cli, typescript, prisma cli, ts-node) to install even
# when NODE_ENV=production leaks into the build environment — npm's default
# `omit=dev` behavior under NODE_ENV=production would otherwise strip @nestjs/cli
# and break `nest build` below.
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
