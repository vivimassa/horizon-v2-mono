import React from 'react'
import { YStack, Text } from 'tamagui'

export default function AdminScreen() {
  return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$xl">
      <Text fontSize={20} fontWeight="600" color="$color">Admin</Text>
      <Text fontSize={13} color="$colorSecondary" marginTop="$xs" textAlign="center">
        Master Data, Users, Roles, Airline Config
      </Text>
    </YStack>
  )
}
