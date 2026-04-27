import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk'
import { CrewMember } from '../models/CrewMember.js'

/**
 * Expo Push wrapper for SkyHub Crew. Wraps both FCM (Android) and APNs
 * (iOS) — same transport WhatsApp/Messenger use on those platforms.
 *
 * Usage:
 *   await sendToCrew(crewId, { title: 'Roster updated', body: '...', data: { type: 'sync' } })
 *
 * The wrapper:
 *   - Resolves all valid Expo push tokens for the crew member
 *   - Batches sends (Expo limit: 100 per request)
 *   - Persists ticket IDs for later receipt polling (Phase: receipt cron)
 *   - Prunes invalid tokens on `DeviceNotRegistered`
 */

const expo = new Expo({ useFcmV1: true })

interface SendOptions {
  title: string
  body: string
  data?: Record<string, unknown>
  /** Channel ID for Android grouping. Defaults to 'roster'. */
  channelId?: 'roster' | 'message' | 'reminder'
}

export async function sendToCrew(crewId: string, opts: SendOptions): Promise<{ sent: number; pruned: number }> {
  const crew = await CrewMember.findById(crewId, { 'crewApp.pushTokens': 1 }).lean()
  if (!crew?.crewApp?.pushTokens?.length) return { sent: 0, pruned: 0 }

  const validTokens = crew.crewApp.pushTokens.filter((t) => Expo.isExpoPushToken(t.token))
  const invalidTokens = crew.crewApp.pushTokens.filter((t) => !Expo.isExpoPushToken(t.token))

  let pruned = 0
  if (invalidTokens.length) {
    await CrewMember.updateOne(
      { _id: crewId },
      { $pull: { 'crewApp.pushTokens': { token: { $in: invalidTokens.map((t) => t.token) } } } },
    )
    pruned += invalidTokens.length
  }
  if (!validTokens.length) return { sent: 0, pruned }

  const messages: ExpoPushMessage[] = validTokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: opts.title,
    body: opts.body,
    data: opts.data ?? {},
    channelId: opts.channelId ?? 'roster',
    priority: 'high',
  }))

  const chunks = expo.chunkPushNotifications(messages)
  const tickets: ExpoPushTicket[] = []
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
      tickets.push(...ticketChunk)
    } catch (err) {
      console.error(`[crew-push] send error crewId=${crewId}:`, (err as Error).message)
    }
  }

  // Inline DeviceNotRegistered prune — receipt-polling cron handles deeper
  // diagnostics, but we want to drop obviously-dead tokens immediately.
  const tokensToRemove: string[] = []
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]
    if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
      const tok = validTokens[i]?.token
      if (tok) tokensToRemove.push(tok)
    }
  }
  if (tokensToRemove.length) {
    await CrewMember.updateOne({ _id: crewId }, { $pull: { 'crewApp.pushTokens': { token: { $in: tokensToRemove } } } })
    pruned += tokensToRemove.length
  }

  const sent = tickets.filter((t) => t.status === 'ok').length
  return { sent, pruned }
}

/**
 * Fan-out helper for messages addressed to multiple crew (e.g.
 * CrewMessage.recipientCrewIds). Loops sequentially — Expo's own
 * chunking handles per-crew batching, and each crew typically has 1–2
 * tokens. Keeps the implementation simple; swap for Promise.all if
 * fan-out volume grows.
 */
export async function sendToCrewBatch(crewIds: string[], opts: SendOptions): Promise<{ sent: number; pruned: number }> {
  let sent = 0
  let pruned = 0
  for (const id of crewIds) {
    const r = await sendToCrew(id, opts)
    sent += r.sent
    pruned += r.pruned
  }
  return { sent, pruned }
}
