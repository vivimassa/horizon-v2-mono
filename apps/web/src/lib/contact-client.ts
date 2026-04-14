import { getApiBaseUrl } from '@skyhub/api'

export interface ContactSubmissionInput {
  name: string
  company: string
  airline: string
  role: string
  email: string
  phone: string
  country: string
  message: string
  source: string
  consent: boolean
}

export interface ContactSubmissionResult {
  ok: true
  id: string
}

export interface ContactSubmissionError {
  ok: false
  error: string
  fieldErrors?: Record<string, string>
}

export async function submitContact(
  input: ContactSubmissionInput,
): Promise<ContactSubmissionResult | ContactSubmissionError> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/contact-submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = (await res.json().catch(() => null)) as ContactSubmissionResult | ContactSubmissionError | null
    if (!res.ok) {
      return body && 'error' in body ? body : { ok: false, error: `Request failed (${res.status})` }
    }
    return body && 'ok' in body ? body : { ok: false, error: 'Malformed response' }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Network error' }
  }
}
