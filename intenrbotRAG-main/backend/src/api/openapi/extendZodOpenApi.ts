/**
 * Side-effect import: extend Zod with `.openapi()` for @asteasolutions/zod-to-openapi.
 * Import this module before any schema or route that uses `.openapi()`.
 */
import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)
