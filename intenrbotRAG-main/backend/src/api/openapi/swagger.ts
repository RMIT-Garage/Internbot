import type { Express } from 'express'
import swaggerUi from 'swagger-ui-express'
import { getOpenApiDocument } from './generator'

export function mountOpenApiDocs(app: Express): void {
  app.get('/openapi.json', (_req, res) => {
    res.json(getOpenApiDocument())
  })
  app.get('/api/openapi.json', (_req, res) => {
    res.json(getOpenApiDocument())
  })

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(getOpenApiDocument()))
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(getOpenApiDocument()))
}
