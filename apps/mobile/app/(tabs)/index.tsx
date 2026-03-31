import React from 'react'
import { YStack, Text } from 'tamagui'

export default function NetworkScreen() {
  return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$xl">
      <Text fontSize={20} fontWeight="600" color="$color">Network</Text>
      <Text fontSize={13} color="$colorSecondary" marginTop="$xs" textAlign="center">
        Schedule Builder, Gantt, Slot Manager, Codeshare, Charter
      </Text>
    </YStack>
  )
}
