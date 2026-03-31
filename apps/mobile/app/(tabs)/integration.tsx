import React from 'react'
import { YStack, Text } from 'tamagui'

export default function IntegrationScreen() {
  return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$xl">
      <Text fontSize={20} fontWeight="600" color="$color">Integration</Text>
      <Text fontSize={13} color="$colorSecondary" marginTop="$xs" textAlign="center">
        AMOS, Message Hub, SSIM/SSM, MVT/LDM, ML Pipeline
      </Text>
    </YStack>
  )
}
