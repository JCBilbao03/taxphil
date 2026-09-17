import type { ComplianceTask, ComplianceTaskStatus, RegulationRecord } from '../../lib/compliance-records.ts'

export type RecordMetadata = { id: string; version: number; createdBy: string; createdAt: string; updatedAt: string }
export type RegulationRow = RegulationRecord & RecordMetadata
export type TaskRow = ComplianceTask & RecordMetadata
export type WorkspaceRole = 'admin' | 'manager' | 'accountant' | 'viewer'

export const statusLabels: Record<ComplianceTaskStatus, string> = {
  needs_review: 'Needs review', in_progress: 'In progress', ready_for_review: 'Ready for manager review',
  filed: 'Recorded filed', not_applicable: 'Not applicable',
}
export const isManager = (role: WorkspaceRole) => role === 'admin' || role === 'manager'
export const isClosedTask = (task: Pick<ComplianceTask, 'status'>) => task.status === 'filed' || task.status === 'not_applicable'
export function canEditTask(role: WorkspaceRole, uid: string, task: Pick<TaskRow, 'status' | 'assignedTo' | 'createdBy'>) {
  return isManager(role) || (role === 'accountant' && !isClosedTask(task)
    && (task.assignedTo === uid || (!task.assignedTo && task.createdBy === uid)))
}
export function isOverdueTask(task: Pick<ComplianceTask, 'status' | 'dueDate'>, today: string) {
  return !isClosedTask(task) && Boolean(task.dueDate) && task.dueDate < today
}
export function filterRegulations(rows: RegulationRow[], search: string, agency: string, kind: string) {
  const needle = search.trim().toLocaleLowerCase()
  return rows.filter(row => (!agency || row.agency === agency) && (!kind || row.kind === kind)
    && (!needle || [row.title, row.agency, row.number, row.year, row.kind, row.amends, row.notes].join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a, b) => b.year.localeCompare(a.year) || b.issuedOn.localeCompare(a.issuedOn) || a.title.localeCompare(b.title))
}
export function filterComplianceTasks(rows: TaskRow[], search: string, agency: string, status: string, owner: string, today: string) {
  const needle = search.trim().toLocaleLowerCase()
  return rows.filter(row => (!agency || row.agency === agency)
    && (!status || (status === 'overdue' ? isOverdueTask(row, today) : row.status === status))
    && (!owner || (owner === '__unassigned' ? !row.assignedTo : row.assignedTo === owner))
    && (!needle || [row.title, row.agency, row.period, row.notes, row.filingReference].join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a, b) => Number(isClosedTask(a)) - Number(isClosedTask(b))
      || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.title.localeCompare(b.title))
}
