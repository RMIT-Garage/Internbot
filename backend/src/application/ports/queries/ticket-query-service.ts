import type { Ticket } from '../../../domain/entities/ticket'
import type { TicketListFilter, TicketListPage } from '../../read-models/ticket'

/**
 * Read-side port for the `tickets` aggregate. Standalone singleton — not on
 * the UnitOfWork. Input/output models live in `application/read-models/ticket`.
 */
export interface TicketQueryService {
  findById(id: string): Promise<Ticket | null>
  list(filter: TicketListFilter): Promise<TicketListPage>
}
