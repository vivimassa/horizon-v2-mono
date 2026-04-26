import { Platform, View, ActivityIndicator } from 'react-native'

export default function GanttScreen() {
  if (Platform.OS === 'web') {
    // Skia for web requires CanvasKit-Wasm to be loaded before any Skia
    // primitive is rendered. <WithSkiaWeb> waits for CanvasKit, then lazy-
    // imports GanttShell — keep the import inside getComponent so the Skia
    // module init (matchFont, etc.) does NOT run before CanvasKit is ready.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { WithSkiaWeb } = require('@shopify/react-native-skia/lib/module/web')
    return (
      <WithSkiaWeb
        opts={{ locateFile: (file: string) => `https://unpkg.com/canvaskit-wasm@0.40.0/bin/full/${file}` }}
        getComponent={() =>
          import('../../../src/components/gantt/gantt-shell').then((m) => ({ default: m.GanttShell }))
        }
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        }
      />
    )
  }
  // Native: GanttShell runs Skia synchronously — direct mount.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { GanttShell } = require('../../../src/components/gantt/gantt-shell')
  return <GanttShell />
}
