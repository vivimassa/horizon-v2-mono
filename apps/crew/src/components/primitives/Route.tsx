import { Text, View } from 'react-native'
import { PlaneTakeoff } from 'lucide-react-native'
import { TYPE, type Theme } from '../../theme/tokens'

interface Props {
  t: Theme
  dep: string
  arr: string
  depTime: string
  arrTime: string
  depLabel?: string
  arrLabel?: string
  accent?: string
  big?: boolean
  delayed?: boolean
}

export function Route({
  t,
  dep,
  arr,
  depTime,
  arrTime,
  depLabel = 'STD',
  arrLabel = 'STA',
  accent,
  big = true,
  delayed = false,
}: Props) {
  const lineColor = accent ?? t.accent
  const codeSize = big ? 34 : 26
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View>
        <Text
          style={{
            fontSize: codeSize,
            fontWeight: '700',
            color: t.text,
            letterSpacing: -0.5,
            lineHeight: codeSize,
          }}
        >
          {dep}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>{depTime}</Text>
          <Text style={{ color: t.textSec, ...TYPE.caption }}>{depLabel}</Text>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          height: codeSize,
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 40,
        }}
      >
        {/* Plane glyph centered above the connector line */}
        <View
          style={{
            position: 'absolute',
            top: codeSize / 2 - 22,
            alignSelf: 'center',
            zIndex: 1,
          }}
        >
          <PlaneTakeoff color={lineColor} size={20} />
        </View>
        <View
          style={{
            width: '100%',
            height: 1.5,
            backgroundColor: t.border,
            borderRadius: 1,
            position: 'relative',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: -2,
              width: 5,
              height: 5,
              borderRadius: 5,
              backgroundColor: lineColor,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: -2,
              width: 5,
              height: 5,
              borderRadius: 5,
              backgroundColor: lineColor,
            }}
          />
        </View>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: codeSize,
            fontWeight: '700',
            color: t.text,
            letterSpacing: -0.5,
            lineHeight: codeSize,
          }}
        >
          {arr}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          <Text
            style={{
              color: delayed ? t.status.delayed.fg : t.text,
              fontWeight: '600',
              fontSize: 13,
              textDecorationLine: delayed ? 'line-through' : 'none',
            }}
          >
            {arrTime}
          </Text>
          <Text style={{ color: t.textSec, ...TYPE.caption }}>{arrLabel}</Text>
        </View>
      </View>
    </View>
  )
}
