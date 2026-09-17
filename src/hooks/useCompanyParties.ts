import { useCompany } from '@/hooks/useCompany'
import { useCompanyRecords } from '@/hooks/useCompanyRecords'
import { validateParty, type Party, type PartyInput, type PartyKind } from '@/lib/parties'

export function useCompanyParties(kind?: PartyKind, enabled = true) {
  const company = useCompany()
  const { rows, loading, error } = useCompanyRecords<Party>('parties', enabled)
  async function save(value: PartyInput, existing?: Party) {
    if (!company?.membership?.active) throw new Error('An active company membership is required.')
    const clean = validateParty(value)
    return company.invoke<{ id: string; version: number }>('companyPartySave', { ...(existing ? { id: existing.id } : {}), expectedVersion: existing?.version || 0, value: clean })
  }
  return { parties: rows.filter((party) => !kind || party.kind === kind).sort((a, b) => a.registeredName.localeCompare(b.registeredName)), loading, error, save }
}
