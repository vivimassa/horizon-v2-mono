import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, Heart, Mail, MapPin, Phone, User } from 'lucide-react-native'
import { Card, FieldLabel, SectionHeader } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useFullProfile } from '../../src/data/use-full-profile'
import { initials } from '../../src/data/format'

export default function ContactScreen() {
  const t = useTheme()
  const router = useRouter()
  const { data, isLoading } = useFullProfile()

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

        {isLoading && !data ? (
          <Card t={t} padding={20}>
            <ActivityIndicator color={t.accent} />
          </Card>
        ) : !data ? (
          <Card t={t} padding={20}>
            <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>Profile unavailable.</Text>
          </Card>
        ) : (
          <>
            {/* Hero */}
            <Card t={t} padding={18}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 60,
                    backgroundColor: t.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 22, letterSpacing: 0.5 }}>
                    {initials(data.identity.firstName, data.identity.lastName)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '600', fontSize: 18, letterSpacing: -0.3 }}>
                    {[data.identity.firstName, data.identity.middleName, data.identity.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                  <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
                    EID {data.identity.employeeId}
                    {data.identity.shortCode ? ` · ${data.identity.shortCode}` : ''}
                  </Text>
                  <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                    {data.employment.position ?? '—'} · {data.employment.contractType ?? '—'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Personal */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Personal</SectionHeader>
              <Card t={t} padding={0}>
                <KVField t={t} k="Date of Birth" v={data.identity.dateOfBirth ?? '—'} />
                <Divider t={t} />
                <KVField t={t} k="Gender" v={data.identity.gender ?? '—'} />
                <Divider t={t} />
                <KVField t={t} k="Nationality" v={data.identity.nationality ?? '—'} last />
              </Card>
            </View>

            {/* Contact */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Contact</SectionHeader>
              <Card t={t} padding={0}>
                <ActionRow
                  t={t}
                  icon={<Mail color={t.text} size={18} />}
                  title="Primary Email"
                  value={data.contact.emailPrimary ?? '—'}
                  onPress={
                    data.contact.emailPrimary
                      ? () => void Linking.openURL(`mailto:${data.contact.emailPrimary}`)
                      : undefined
                  }
                />
                {data.contact.emailSecondary && (
                  <>
                    <Divider t={t} />
                    <ActionRow
                      t={t}
                      icon={<Mail color={t.text} size={18} />}
                      title="Secondary Email"
                      value={data.contact.emailSecondary}
                      onPress={() => void Linking.openURL(`mailto:${data.contact.emailSecondary}`)}
                    />
                  </>
                )}
                {data.contact.phones.map((p, i) => (
                  <View key={p.id}>
                    <Divider t={t} />
                    <ActionRow
                      t={t}
                      icon={<Phone color={t.text} size={18} />}
                      title={p.type || 'Phone'}
                      value={p.number}
                      onPress={() => void Linking.openURL(`tel:${p.number}`)}
                      last={i === data.contact.phones.length - 1 && !data.contact.address.line1}
                    />
                  </View>
                ))}
              </Card>
            </View>

            {/* Address */}
            {(data.contact.address.line1 || data.contact.address.city) && (
              <View style={{ gap: 10 }}>
                <SectionHeader t={t}>Address</SectionHeader>
                <Card t={t} padding={14}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <MapPin color={t.textSec} size={18} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      {data.contact.address.line1 && (
                        <Text style={{ color: t.text, fontSize: 14 }}>{data.contact.address.line1}</Text>
                      )}
                      {data.contact.address.line2 && (
                        <Text style={{ color: t.text, fontSize: 14 }}>{data.contact.address.line2}</Text>
                      )}
                      <Text style={{ color: t.text, fontSize: 14 }}>
                        {[data.contact.address.city, data.contact.address.state, data.contact.address.zip]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                      {data.contact.address.country && (
                        <Text style={{ color: t.textSec, fontSize: 13, marginTop: 2 }}>
                          {data.contact.address.country}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </View>
            )}

            {/* Emergency */}
            {data.contact.emergency.name && (
              <View style={{ gap: 10 }}>
                <SectionHeader t={t}>Emergency Contact</SectionHeader>
                <Card t={t} padding={14}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Heart color={t.status.cancelled.fg} size={18} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>
                        {data.contact.emergency.name}
                      </Text>
                      <Text style={{ color: t.textSec, fontSize: 13, marginTop: 2 }}>
                        {data.contact.emergency.relationship ?? 'Contact'}
                      </Text>
                      {data.contact.emergency.phone && (
                        <Pressable
                          onPress={() => void Linking.openURL(`tel:${data.contact.emergency.phone}`)}
                          style={{ marginTop: 8 }}
                        >
                          <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>
                            {data.contact.emergency.phone}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Card>
              </View>
            )}

            {/* Employment */}
            <View style={{ gap: 10 }}>
              <SectionHeader t={t}>Employment</SectionHeader>
              <Card t={t} padding={0}>
                <KVField t={t} k="Base" v={data.employment.base ?? '—'} />
                <Divider t={t} />
                <KVField t={t} k="Position" v={data.employment.position ?? '—'} />
                <Divider t={t} />
                <KVField t={t} k="Joined" v={data.employment.employmentDate ?? '—'} />
                {data.employment.seniority != null && (
                  <>
                    <Divider t={t} />
                    <KVField t={t} k="Seniority" v={String(data.employment.seniority)} />
                  </>
                )}
                {data.employment.ratings.length > 0 && (
                  <>
                    <Divider t={t} />
                    <KVField t={t} k="Ratings" v={data.employment.ratings.join(', ')} last />
                  </>
                )}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function KVField({ t, k, v, last }: { t: Theme; k: string; v: string; last?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: t.textSec, fontSize: 13 }}>{k}</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '500' }}>{v}</Text>
    </View>
  )
}

function ActionRow({
  t,
  icon,
  title,
  value,
  onPress,
  last,
}: {
  t: Theme
  icon: React.ReactNode
  title: string
  value: string
  onPress?: () => void
  last?: boolean
}) {
  const body = (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: t.hover,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.textSec, fontSize: 12 }}>{title}</Text>
        <Text
          style={{ color: onPress ? t.accent : t.text, fontSize: 14, fontWeight: '500', marginTop: 2 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  )
  if (onPress) return <Pressable onPress={onPress}>{body}</Pressable>
  return body
}

function Divider({ t }: { t: Theme }) {
  return <View style={{ height: 0.5, backgroundColor: t.border, marginLeft: 58 }} />
}
