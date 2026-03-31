import React from 'react'
import { YStack, Text } from 'tamagui'

export default function WorkforceScreen() {
  return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$xl">
      <Text fontSize={20} fontWeight="600" color="$color">Workforce</Text>
      <Text fontSize={13} color="$colorSecondary" marginTop="$xs" textAlign="center">
        GCS, Crew Pairing, Rostering, FDTL, Auto Assignment
      </Text>
    </YStack>
  )
}
