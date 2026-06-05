import { Router, type Router as ExpressRouter } from 'express'
import { benchmarksRouter } from './benchmarks'
import { chatRouter } from './chat'
import { knowledgeRouter } from './knowledge'

const router: ExpressRouter = Router()

router.use('/benchmarks', benchmarksRouter)
router.use('/chat', chatRouter)
router.use('/knowledge', knowledgeRouter)

export { router as apiRouter }
