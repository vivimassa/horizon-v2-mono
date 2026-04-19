import { useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, PanResponder } from 'react-native'
import { useRouter } from 'expo-router'
import * as LucideRN from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { MODULE_REGISTRY, MODULE_THEMES, type ModuleEntry } from '@skyhub/constants'
import { HUB_DOMAINS, type HubDomain } from './hub-carousel'
import { resolveMobileRoute } from '../../lib/hub-route-map'

const iconMap = LucideRN as unknown as Record<string, LucideIcon>
function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? LucideRN.Box
}

interface ChildNode {
  entry: ModuleEntry
  subChildren: ModuleEntry[]
}
interface SectionGroup {
  section: ModuleEntry
  children: ChildNode[]
}

function buildTree(moduleId: string): SectionGroup[] {
  return MODULE_REGISTRY.filter((m) => m.module === moduleId && m.level === 1)
    .map((s) => ({
      section: s,
      children: MODULE_REGISTRY.filter((m) => m.parent_code === s.code && m.level === 2).map((c) => ({
        entry: c,
        subChildren: MODULE_REGISTRY.filter((sc) => sc.parent_code === c.code && sc.level === 3),
      })),
    }))
    .filter((g) => g.children.length > 0)
}

interface Props {
  domain: HubDomain
  onBack: () => void
  isDark: boolean
}

export function HubModulePanel({ domain, onBack, isDark }: Props) {
  const router = useRouter()
  const accent = MODULE_THEMES[domain.module]?.accent ?? '#64748b'
  const DomainIcon = getIcon(domain.icon)

  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Swipe-to-dismiss. A long enough horizontal drag in either direction (>72px)
  // that stays mostly horizontal returns to the carousel. Vertical intent
  // hands control to the inner ScrollView so list scrolling still works.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        return Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > 72) onBack()
      },
    }),
  ).current

  const rawTree = useMemo(() => buildTree(domain.module), [domain.module])

  const tree = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rawTree
    return rawTree
      .map((g) => ({
        ...g,
        children: g.children
          .map((c) => {
            const matchSelf =
              c.entry.name.toLowerCase().includes(q) ||
              c.entry.description.toLowerCase().includes(q) ||
              c.entry.code.includes(q)
            const matchedSubs = c.subChildren.filter(
              (sc) =>
                sc.name.toLowerCase().includes(q) || sc.description.toLowerCase().includes(q) || sc.code.includes(q),
            )
            if (matchSelf) return c
            if (matchedSubs.length > 0) return { ...c, subChildren: matchedSubs }
            return null
          })
          .filter((c): c is ChildNode => c !== null),
      }))
      .filter((g) => g.children.length > 0)
  }, [rawTree, search])

  const totalModules = useMemo(
    () => MODULE_REGISTRY.filter((m) => m.module === domain.module && m.level === 2).length,
    [domain.module],
  )

  const toggle = (code: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const go = (entry: ModuleEntry) => {
    const mobilePath = resolveMobileRoute(entry.route)
    if (!mobilePath) return // Disabled branch — UI already shows "Coming soon".
    // Expo Router typed routes are strict; cast since paths come from a runtime map.
    router.push(mobilePath as never)
  }

  const isImplemented = (entry: ModuleEntry) => resolveMobileRoute(entry.route) !== null

  const panelBg = isDark ? 'rgba(10,10,18,0.85)' : 'rgba(15,15,25,0.75)'

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {/* Header — no back button; swipe left/right on the panel dismisses back
         to the carousel. Thin chevron hint shown in the header instead. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DomainIcon size={20} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
        </View>
        <View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }}>{domain.label}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{totalModules} modules</Text>
        </View>
      </View>

      {/* Glass panel */}
      <View
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: panelBg,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Search */}
        <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 12,
              height: 40,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <LucideRN.Search size={15} color="rgba(255,255,255,0.30)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search modules..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={{
                flex: 1,
                fontSize: 13,
                color: 'rgba(255,255,255,0.9)',
                paddingVertical: 0,
              }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <LucideRN.X size={14} color="rgba(255,255,255,0.30)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Tree */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {tree.map((group, gi) => {
            const SIcon = getIcon(group.section.icon)
            return (
              <View key={group.section.code} style={{ marginTop: gi > 0 ? 32 : 4 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 12,
                    marginBottom: 14,
                  }}
                >
                  <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
                  <SIcon size={13} color="rgba(255,255,255,0.45)" strokeWidth={2} />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                    {group.section.code}
                  </Text>
                  <Text
                    style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}
                  >
                    {group.section.name.toUpperCase()}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 8 }} />
                </View>

                {group.children.map((node) => {
                  const child = node.entry
                  const CI = getIcon(child.icon)
                  const hasSubs = node.subChildren.length > 0
                  const isCollapsed = collapsed.has(child.code)
                  // Implemented on mobile if itself has a route OR it's an
                  // expandable parent with at least one implemented sub.
                  const leafImplemented = !hasSubs && isImplemented(child)
                  const anySubImplemented = hasSubs && node.subChildren.some(isImplemented)
                  const rowEnabled = hasSubs ? true : leafImplemented
                  const rowDim = !hasSubs && !leafImplemented

                  return (
                    // Gap lives on the OUTER wrapper — margins on a Pressable
                    // don't always propagate reliably across RN versions when
                    // the press handler re-computes style.
                    <View key={child.code} style={{ marginBottom: 12 }}>
                      <Pressable
                        onPress={() => (hasSubs ? toggle(child.code) : go(child))}
                        disabled={!rowEnabled}
                        android_ripple={rowEnabled ? { color: 'rgba(255,255,255,0.10)' } : undefined}
                        style={({ pressed }) => ({
                          paddingHorizontal: 14,
                          paddingVertical: 20,
                          borderRadius: 14,
                          backgroundColor: pressed && rowEnabled ? 'rgba(255,255,255,0.08)' : 'transparent',
                          opacity: rowDim ? 0.45 : 1,
                        })}
                      >
                        {/* Outer wrapper forces row layout. Text area is a flex-column
                           with name+code on the first line and description on the
                           second — matches the web hub module rows. */}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 11,
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.08)',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 14,
                            }}
                          >
                            <CI size={17} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                              <Text
                                style={{
                                  color: 'rgba(255,255,255,0.92)',
                                  fontSize: 15,
                                  fontWeight: '600',
                                  flexShrink: 1,
                                }}
                                numberOfLines={1}
                              >
                                {child.name}
                              </Text>
                              <Text
                                style={{
                                  color: 'rgba(255,255,255,0.38)',
                                  fontSize: 11,
                                  fontWeight: '500',
                                  marginLeft: 8,
                                }}
                              >
                                {child.code}
                              </Text>
                            </View>
                            {!!child.description && (
                              <Text
                                style={{
                                  color: 'rgba(255,255,255,0.42)',
                                  fontSize: 12,
                                  marginTop: 3,
                                  lineHeight: 16,
                                }}
                                numberOfLines={1}
                              >
                                {child.description}
                              </Text>
                            )}
                          </View>
                          <View style={{ width: 10 }} />
                          {hasSubs ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {!anySubImplemented && (
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: 'rgba(255,255,255,0.45)',
                                    letterSpacing: 0.5,
                                    marginRight: 6,
                                  }}
                                >
                                  SOON
                                </Text>
                              )}
                              <LucideRN.ChevronDown
                                size={16}
                                color="rgba(255,255,255,0.5)"
                                style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}
                              />
                            </View>
                          ) : leafImplemented ? (
                            <LucideRN.ChevronRight size={14} color="rgba(255,255,255,0.3)" />
                          ) : (
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: 'rgba(255,255,255,0.45)',
                                letterSpacing: 0.5,
                              }}
                            >
                              SOON
                            </Text>
                          )}
                        </View>
                      </Pressable>

                      {hasSubs && !isCollapsed && (
                        // Sub-items take the FULL panel width same as parent rows
                        // so every tap lands on a large target. We drop the
                        // left indent + vertical rule — the 2.1.3.x code prefix
                        // at the start of each row is enough visual hierarchy.
                        <View style={{ marginTop: 6, marginBottom: 4 }}>
                          {node.subChildren.map((sub) => {
                            const subImpl = isImplemented(sub)
                            return (
                              // Wrapper holds the marginBottom (Pressable style
                              // function drops margins on state changes).
                              <View key={sub.code} style={{ marginBottom: 10 }}>
                                <Pressable
                                  onPress={() => go(sub)}
                                  disabled={!subImpl}
                                  android_ripple={subImpl ? { color: 'rgba(255,255,255,0.08)' } : undefined}
                                  // Full-width tappable row. Padding moved to the
                                  // inner static View because Pressable's style
                                  // function was dropping paddingLeft on some RN
                                  // versions — exactly the bug you saw where
                                  // sub rows aligned under the icon instead of
                                  // the description.
                                  style={({ pressed }) => ({
                                    borderRadius: 12,
                                    backgroundColor: pressed && subImpl ? 'rgba(255,255,255,0.07)' : 'transparent',
                                    opacity: subImpl ? 1 : 0.55,
                                  })}
                                >
                                  {/* Inner View is STATIC so RN reliably applies
                                     paddingLeft = 66. That lines up the sub code
                                     directly under the parent description:
                                     parent paddingHorizontal (14) + icon width
                                     (38) + icon marginRight (14) = 66. */}
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      paddingLeft: 66,
                                      paddingRight: 14,
                                      paddingVertical: 16,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: 'rgba(255,255,255,0.38)',
                                        fontSize: 11,
                                        fontWeight: '500',
                                        minWidth: 42,
                                        letterSpacing: 0.2,
                                      }}
                                    >
                                      {sub.code}
                                    </Text>
                                    <Text
                                      style={{
                                        flex: 1,
                                        color: 'rgba(255,255,255,0.78)',
                                        fontSize: 13,
                                        fontWeight: '500',
                                        marginLeft: 8,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {sub.name}
                                    </Text>
                                    {!subImpl && (
                                      <Text
                                        style={{
                                          fontSize: 9,
                                          fontWeight: '700',
                                          color: 'rgba(255,255,255,0.40)',
                                          letterSpacing: 0.5,
                                          marginLeft: 8,
                                        }}
                                      >
                                        SOON
                                      </Text>
                                    )}
                                  </View>
                                </Pressable>
                              </View>
                            )
                          })}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )
          })}

          {tree.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No modules match your search.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}

export { HUB_DOMAINS }
export type { HubDomain }
