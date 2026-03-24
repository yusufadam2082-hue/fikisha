import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  output: './prisma/client',
  config: {
    database: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
})