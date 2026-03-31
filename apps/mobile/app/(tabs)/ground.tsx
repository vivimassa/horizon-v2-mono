import React from 'react'
import { YStack, Text } from 'tamagui'

export default function GroundScreen() {
  return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$xl">
      <Text fontSize={20} fontWeight="600" color="$color">Ground</Text>
      <Text fontSize={13} color="$colorSecondary" marginTop="$xs" textAlign="center">
        Ground Handling, Turnaround, Gate Management
      </Text>
    </YStack>
  )
}
