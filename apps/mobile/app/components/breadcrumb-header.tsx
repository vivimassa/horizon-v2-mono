import { View, Text } from 'react-native'
import { getBreadcrumbChain, MODULE_THEMES } from '@skyhub/constants'

interface BreadcrumbHeaderProps {
  /** Top-level module code, e.g. '1', '2', '3' */
  moduleCode: string
}

export function BreadcrumbHeader({ moduleCode }: BreadcrumbHeaderProps) {
  const chain = getBreadcrumbChain(moduleCode)
  if (chain.length === 0) return null

  const current = chain[chain.length - 1]
  const theme = MODULE_THEMES[current.module] ?? MODULE_THEMES.admin

  return (
    <View
      style={{
        paddingTop: 56,
        paddingHorizontal: 16,
        height: 100, // 56 safe area + 44 content
        backgroundColor: theme.bgSubtle,
      }}
    >
      <View className="flex-row items-center h-[44px]">
        {chain.map((entry, i) => {
          const isLast = i === chain.length - 1
          const textColor = isLast ? theme.accent : '#6b7280'

          return (
            <View key={entry.code} className="flex-row items-center">
              {i > 0 && (
                <Text
                  className="mx-1.5"
                  style={{ color: '#9ca3af', fontSize: 13 }}
                >
                  ›
                </Text>
              )}
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>
                {entry.code}
              </Text>
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '400', marginLeft: 4 }}>
                {entry.name}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
