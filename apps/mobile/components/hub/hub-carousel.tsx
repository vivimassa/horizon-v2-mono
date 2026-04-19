import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ListRenderItem,
  type ImageSourcePropType,
} from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import * as LucideRN from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { MODULE_REGISTRY, MODULE_THEMES } from '@skyhub/constants'

export interface HubDomain {
  key: string
  label: string
  description: string
  icon: string
  module: string
  /** RN ImageSourcePropType — either a require()'d local asset or a {uri} object.
     Mirrors apps/web/src/app/hub/page.tsx DOMAINS so both platforms look identical. */
  image: ImageSourcePropType
}

export const HUB_DOMAINS: HubDomain[] = [
  {
    key: 'network',
    label: 'Network',
    description: 'Routes, schedules, fleet planning & slot management',
    icon: 'Route',
    module: 'network',
    image: { uri: 'https://images.unsplash.com/photo-1533456307239-052e029c1362?w=1920&q=80&auto=format&fit=crop' },
  },
  {
    key: 'flightops',
    label: 'Flight Ops',
    description: 'Movement control, OOOI tracking & daily operations',
    icon: 'Plane',
    module: 'operations',
    image: require('../../assets/domains/flight-ops.png'),
  },
  {
    key: 'groundops',
    label: 'Ground Ops',
    description: 'Cargo, turnaround, fueling & ramp coordination',
    icon: 'Truck',
    module: 'ground',
    image: { uri: 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=1920&q=80&auto=format&fit=crop' },
  },
  {
    key: 'crewops',
    label: 'Crew Ops',
    description: 'Rostering, pairing, FDTL & crew tracking',
    icon: 'Users',
    module: 'workforce',
    image: { uri: 'https://images.unsplash.com/photo-1503468120394-03d29a34a0bf?w=1920&q=80&auto=format&fit=crop' },
  },
  {
    key: 'settings',
    label: 'Master Database',
    description: 'Reference data catalogues for every operational domain',
    icon: 'Database',
    module: 'admin',
    image: require('../../assets/domains/master-database.png'),
  },
  {
    key: 'sysadmin',
    label: 'System Administration',
    description: 'User accounts, access rights, operator config & company documents',
    icon: 'ShieldCheck',
    module: 'sysadmin',
    image: require('../../assets/domains/settings.png'),
  },
]

const iconMap = LucideRN as unknown as Record<string, LucideIcon>
function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? LucideRN.Box
}

function countModules(domainKey: string): number {
  const moduleId = HUB_DOMAINS.find((d) => d.key === domainKey)?.module
  if (!moduleId) return 0
  return MODULE_REGISTRY.filter((m) => m.module === moduleId && m.level === 2).length
}

interface Props {
  onSelect: (key: string) => void
  isDark: boolean
}

// Triple the domain list so the FlatList feels infinite. We render three
// consecutive copies and silently snap the scroll position back into the
// middle copy whenever the user drifts into the first or third, so there's
// always more content to swipe in either direction.
const N = HUB_DOMAINS.length
const LOOP_DATA: HubDomain[] = [...HUB_DOMAINS, ...HUB_DOMAINS, ...HUB_DOMAINS]

export function HubCarousel({ onSelect, isDark }: Props) {
  const { width: viewportW } = useWindowDimensions()
  const isPhone = viewportW < 768

  // Card dimensions tuned per viewport. Phone fills width with small gutter;
  // tablet shows a 10% peek on each side via snapToInterval.
  const cardW = isPhone ? Math.min(viewportW - 32, 360) : Math.min(viewportW * 0.6, 440)
  const cardH = Math.round(cardW * 1.35)
  const snap = cardW + 16 // gap between cards
  const sidePad = Math.max(16, (viewportW - cardW) / 2)

  // `cur` is the LOGICAL domain index in [0, N). Absolute list position is
  // `cur + N` — the middle copy — so there's always N cards of headroom
  // either direction before we silently teleport back to the middle.
  const [cur, setCur] = useState(0)
  const listRef = useRef<FlatList<HubDomain>>(null)

  // On mount (and whenever card width changes) jump to the middle copy so
  // the user can swipe left immediately without hitting the content start.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: N * snap, animated: false })
    })
    return () => cancelAnimationFrame(id)
  }, [snap])

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      const absIdx = Math.round(x / snap)
      const logical = ((absIdx % N) + N) % N
      if (logical !== cur) setCur(logical)

      // If we've drifted into the first or third copy, silently teleport
      // back to the equivalent card in the middle copy. Unanimated so the
      // user never sees the jump.
      if (absIdx < N || absIdx >= 2 * N) {
        listRef.current?.scrollToOffset({ offset: (logical + N) * snap, animated: false })
      }
    },
    [snap, cur],
  )

  const goTo = useCallback(
    (idx: number) => {
      // Accept any integer (prev/next may pass -1 or N) and map into [0,N).
      const logical = ((idx % N) + N) % N
      listRef.current?.scrollToOffset({ offset: (logical + N) * snap, animated: true })
      setCur(logical)
    },
    [snap],
  )

  const renderItem: ListRenderItem<HubDomain> = useCallback(
    ({ item, index }) => {
      const accent = MODULE_THEMES[item.module]?.accent ?? '#64748b'
      const Icon = getIcon(item.icon)
      const count = countModules(item.key)
      const logical = index % N
      const isCenter = logical === cur

      return (
        <Pressable
          onPress={() => (isCenter ? onSelect(item.key) : goTo(logical))}
          style={{
            width: cardW,
            height: cardH,
            marginRight: 16,
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isCenter ? `${accent}66` : 'rgba(255,255,255,0.06)',
            opacity: isCenter ? 1 : 0.55,
            transform: [{ scale: isCenter ? 1 : 0.94 }],
            backgroundColor: isDark ? '#191921' : '#1f2937',
          }}
        >
          <ExpoImage
            source={item.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={[StyleSheet.absoluteFill, { opacity: isCenter ? 1 : 0.85 }]}
            transition={200}
          />
          <View style={{ flex: 1 }}>
            {/* Top accent line on active card */}
            {isCenter && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: accent,
                  opacity: 0.9,
                }}
              />
            )}

            {/* Darken overlay */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: isCenter ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.55)',
              }}
            />

            {/* Content */}
            <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: isCenter ? accent : 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    {String(logical + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: 'rgba(0,0,0,0.30)',
                    borderWidth: 1,
                    borderColor: isCenter ? `${accent}55` : 'rgba(255,255,255,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color="#fff" strokeWidth={1.6} />
                </View>
              </View>

              <View>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 22,
                    fontWeight: '700',
                    letterSpacing: -0.3,
                    marginBottom: 6,
                  }}
                >
                  {item.label}
                </Text>
                {isCenter && (
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: 13,
                      lineHeight: 19,
                      marginBottom: 12,
                    }}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}
                {isCenter && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: `${accent}33`,
                        borderWidth: 1,
                        borderColor: `${accent}44`,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{count} modules</Text>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Tap to explore</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Pressable>
      )
    },
    [cardW, cardH, cur, goTo, onSelect, isDark],
  )

  const arrowColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.65)'
  const arrowBg = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.55)'

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <FlatList
        ref={listRef}
        data={LOOP_DATA}
        keyExtractor={(d, i) => `${d.key}-${i}`}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePad - 8, alignItems: 'center' }}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, i) => ({ length: snap, offset: i * snap, index: i })}
        initialScrollIndex={N}
        initialNumToRender={3}
        windowSize={5}
      />

      {/* Prev / Next arrows — always enabled, wrap around at ends */}
      <Pressable
        onPress={() => goTo(cur - 1)}
        style={{
          position: 'absolute',
          left: 8,
          top: '50%',
          width: isPhone ? 36 : 44,
          height: isPhone ? 36 : 44,
          marginTop: -(isPhone ? 18 : 22),
          borderRadius: 999,
          backgroundColor: arrowBg,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LucideRN.ChevronLeft size={isPhone ? 18 : 20} color={arrowColor} />
      </Pressable>
      <Pressable
        onPress={() => goTo(cur + 1)}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          width: isPhone ? 36 : 44,
          height: isPhone ? 36 : 44,
          marginTop: -(isPhone ? 18 : 22),
          borderRadius: 999,
          backgroundColor: arrowBg,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LucideRN.ChevronRight size={isPhone ? 18 : 20} color={arrowColor} />
      </Pressable>

      {/* Pagination dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginTop: 20,
        }}
      >
        {HUB_DOMAINS.map((d, i) => {
          const ac = MODULE_THEMES[d.module]?.accent ?? '#64748b'
          const active = i === cur
          return (
            <Pressable
              key={d.key}
              onPress={() => goTo(i)}
              style={{
                width: active ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: active ? ac : isDark ? 'rgba(255,255,255,0.20)' : 'rgba(15,23,42,0.25)',
              }}
            />
          )
        })}
      </View>
    </View>
  )
}
