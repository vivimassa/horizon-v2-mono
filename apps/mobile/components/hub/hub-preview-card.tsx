import { StyleSheet, Text, View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import * as LucideRN from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { MODULE_REGISTRY, MODULE_THEMES } from '@skyhub/constants'
import type { HubDomain } from './hub-carousel'
import { HUB_DOMAINS } from './hub-carousel'

const iconMap = LucideRN as unknown as Record<string, LucideIcon>
function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? LucideRN.Box
}

interface Props {
  domain: HubDomain
}

/**
 * Static single-card preview used on the tablet split view — mirrors the
 * center card of the carousel exactly, but without the surrounding dots,
 * arrows or scroll behaviour so it reads as "pinned context" next to the
 * module tree panel. Matches apps/web/src/app/hub/page.tsx's left column
 * when the right-side panel is open.
 */
export function HubPreviewCard({ domain }: Props) {
  const accent = MODULE_THEMES[domain.module]?.accent ?? '#64748b'
  const Icon = getIcon(domain.icon)
  const count = MODULE_REGISTRY.filter((m) => m.module === domain.module && m.level === 2).length
  const index = HUB_DOMAINS.findIndex((d) => d.key === domain.key)
  const numberBadge = String(index + 1).padStart(2, '0')

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 0.72,
        maxWidth: 460,
        alignSelf: 'center',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${accent}66`,
      }}
    >
      <ExpoImage
        source={domain.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
        transition={250}
      />
      <View style={{ flex: 1 }}>
        {/* Accent top line */}
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
        {/* Darken overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.30)',
          }}
        />

        <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{numberBadge}</Text>
            </View>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.30)',
                borderWidth: 1,
                borderColor: `${accent}55`,
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
                fontSize: 24,
                fontWeight: '700',
                letterSpacing: -0.3,
                marginBottom: 6,
              }}
            >
              {domain.label}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 13,
                lineHeight: 19,
                marginBottom: 12,
              }}
              numberOfLines={2}
            >
              {domain.description}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
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
          </View>
        </View>
      </View>
    </View>
  )
}
