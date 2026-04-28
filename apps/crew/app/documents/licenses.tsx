import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Award, BookOpen, ChevronLeft, FileBadge, Globe } from 'lucide-react-native'
import { Card, Chip, FieldLabel, SectionHeader } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useFullProfile } from '../../src/data/use-full-profile'

export default function LicensesScreen() {
  const t = useTheme()
  const router = useRouter()
  const { data, isLoading, refetch } = useFullProfile()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.page }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
          hitSlop={8}
        >
          <ChevronLeft color={t.textSec} size={18} />
          <Text style={{ color: t.textSec, fontSize: 14 }}>Back</Text>
        </Pressable>

        <Text style={{ ...TYPE.pageTitle, color: t.text }}>Licenses & Certificates</Text>

        {isLoading && !data ? (
          <Card t={t} padding={20}>
            <ActivityIndicator color={t.accent} />
          </Card>
        ) : !data ? (
          <Card t={t} padding={20}>
            <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>
              Profile unavailable. Pull down to retry.
            </Text>
          </Card>
        ) : (
          <>
            {/* Licenses */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Licenses</SectionHeader>
              {data.licenses.length === 0 ? (
                <Card t={t} padding={16}>
                  <Text style={{ ...TYPE.caption, color: t.textSec }}>No licenses on file.</Text>
                </Card>
              ) : (
                data.licenses.map((l) => (
                  <Card key={l.id} t={t} padding={14}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <IconCircle t={t} icon={<Award color={t.accent} size={18} />} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{l.type}</Text>
                        <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                          {l.number} · {l.country ?? '—'}
                          {l.temporary ? ' · Temporary' : ''}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>

            {/* Expiries */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Expiries</SectionHeader>
              {data.expiries.length === 0 ? (
                <Card t={t} padding={16}>
                  <Text style={{ ...TYPE.caption, color: t.textSec }}>No tracked expiries.</Text>
                </Card>
              ) : (
                data.expiries
                  .slice()
                  .sort((a, b) => (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999))
                  .map((e) => <ExpiryRow key={e.id} t={t} e={e} />)
              )}
            </View>

            {/* Passports */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Passports</SectionHeader>
              {data.passports.length === 0 ? (
                <Card t={t} padding={16}>
                  <Text style={{ ...TYPE.caption, color: t.textSec }}>No passports on file.</Text>
                </Card>
              ) : (
                data.passports.map((p) => {
                  const expMs = Date.parse(p.expiry)
                  const daysUntil = Number.isFinite(expMs) ? Math.floor((expMs - Date.now()) / 86_400_000) : null
                  const expired = daysUntil != null && daysUntil < 0
                  const expiringSoon = daysUntil != null && daysUntil >= 0 && daysUntil <= 180
                  return (
                    <Card key={p.id} t={t} padding={14}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <IconCircle t={t} icon={<BookOpen color={t.accent} size={18} />} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>
                              {p.country} {p.isActive ? '· Active' : ''}
                            </Text>
                            {expired && (
                              <Chip t={t} kind="cancelled">
                                Expired
                              </Chip>
                            )}
                            {expiringSoon && !expired && (
                              <Chip t={t} kind="delayed">
                                Expiring
                              </Chip>
                            )}
                          </View>
                          <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                            {p.number} · expires {p.expiry}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  )
                })
              )}
            </View>

            {/* Visas */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Visas</SectionHeader>
              {data.visas.length === 0 ? (
                <Card t={t} padding={16}>
                  <Text style={{ ...TYPE.caption, color: t.textSec }}>No visas on file.</Text>
                </Card>
              ) : (
                data.visas.map((v) => {
                  const expMs = Date.parse(v.expiry)
                  const daysUntil = Number.isFinite(expMs) ? Math.floor((expMs - Date.now()) / 86_400_000) : null
                  const expired = daysUntil != null && daysUntil < 0
                  const expiringSoon = daysUntil != null && daysUntil >= 0 && daysUntil <= 60
                  return (
                    <Card key={v.id} t={t} padding={14}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <IconCircle t={t} icon={<Globe color={t.accent} size={18} />} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>
                              {v.country} {v.type ? `· ${v.type}` : ''}
                            </Text>
                            {expired && (
                              <Chip t={t} kind="cancelled">
                                Expired
                              </Chip>
                            )}
                            {expiringSoon && !expired && (
                              <Chip t={t} kind="delayed">
                                Expiring
                              </Chip>
                            )}
                          </View>
                          <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                            {v.number ?? '—'} · expires {v.expiry}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  )
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function ExpiryRow({
  t,
  e,
}: {
  t: Theme
  e: {
    id: string
    codeShort: string | null
    codeLabel: string | null
    aircraftType: string | null
    expiryDate: string | null
    isExpired: boolean
    daysUntil: number | null
  }
}) {
  const expiringSoon = e.daysUntil != null && e.daysUntil >= 0 && e.daysUntil <= 30
  return (
    <Card t={t} padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle t={t} icon={<FileBadge color={t.accent} size={18} />} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
              {e.codeLabel ?? e.codeShort ?? 'Expiry'}
            </Text>
            {e.aircraftType && (
              <Text
                style={{
                  ...TYPE.badge,
                  color: t.textSec,
                  backgroundColor: t.hover,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 4,
                }}
              >
                {e.aircraftType}
              </Text>
            )}
            {e.isExpired && (
              <Chip t={t} kind="cancelled">
                Expired
              </Chip>
            )}
            {!e.isExpired && expiringSoon && <Chip t={t} kind="delayed">{`${e.daysUntil}d`}</Chip>}
          </View>
          <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>{e.expiryDate ?? '—'}</Text>
        </View>
      </View>
    </Card>
  )
}

function IconCircle({ t, icon }: { t: Theme; icon: React.ReactNode }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 38,
        backgroundColor: t.accent + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </View>
  )
}
