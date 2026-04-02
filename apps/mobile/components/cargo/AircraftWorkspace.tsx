import { useState, useRef, useEffect } from 'react'
import { View, Image, Animated, Easing, LayoutChangeEvent, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import type { HoldKey } from '../../types/cargo'
import { AIRCRAFT_CARGO_CONFIGS, HOLD_IMAGE_OFFSETS } from '../../config/aircraft-cargo'
import { CompartmentOverlay } from './CompartmentOverlay'
import { ConnectorLine } from './ConnectorLine'

const aircraftImage = require('../../assets/aircraft-a321.png')
const terminalLight = require('../../assets/terminal-light.png')
const terminalDark = require('../../assets/terminal-dark.png')

interface AircraftWorkspaceProps {
  activeHold: HoldKey
  hasSelection: boolean
  onSelectHold: (key: HoldKey) => void
  accent: string
  isDark: boolean
  height?: number
  fullScreen?: boolean
  showConnector?: boolean
}

const DURATION = 1200
const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const IMAGE_HEIGHT_MULT = 2

export function AircraftWorkspace({
  activeHold,
  hasSelection,
  onSelectHold,
  accent,
  isDark,
  height = 350,
  fullScreen = false,
  showConnector = false,
}: AircraftWorkspaceProps) {
  const config = AIRCRAFT_CARGO_CONFIGS.A321
  const zones = config?.zones ?? []

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout
    setContainerSize({ width, height: h })
  }

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout
    setImageSize({ width, height: h })
  }

  const scrollRef = useRef<ScrollView>(null)
  const [scrollY, setScrollY] = useState(0)
  const terminalOpacity = useRef(new Animated.Value(1)).current
  const aircraftOpacity = useRef(new Animated.Value(0)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current

  const imageHeight = containerSize.height * IMAGE_HEIGHT_MULT

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(e.nativeEvent.contentOffset.y)
  }

  // Scroll to the active hold position
  useEffect(() => {
    if (!hasSelection || containerSize.height === 0) return

    const offsetPercent = HOLD_IMAGE_OFFSETS[activeHold]
    const holdCenterY = (50 - offsetPercent) / 100 * imageHeight
    const scrollTo = Math.max(0, holdCenterY - containerSize.height / 2)

    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: scrollTo, animated: true })
    }, 100)
  }, [hasSelection, activeHold, containerSize.height, imageHeight])

  // Fade terminal/aircraft on selection change
  useEffect(() => {
    if (containerSize.height === 0) return

    if (hasSelection) {
      Animated.parallel([
        Animated.timing(terminalOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        Animated.timing(aircraftOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(overlayOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.delay(700),
          Animated.timing(overlayOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(terminalOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(aircraftOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start()
    }
  }, [hasSelection, containerSize.height])

  // Calculate connector line endpoints
  const activeZone = zones.find((z) => z.holdKey === activeHold)
  let lineFromX = 0, lineFromY = 0
  if (activeZone && imageSize.height > 0 && containerSize.width > 0) {
    // Image is 85% width, centered
    const imageLeft = containerSize.width * 0.075
    const zoneCenterX = imageLeft + (activeZone.left + activeZone.width / 2) / 100 * imageSize.width
    const zoneCenterY = (activeZone.top + activeZone.height / 2) / 100 * imageSize.height - scrollY
    lineFromX = zoneCenterX
    lineFromY = zoneCenterY
  }
  // Dock is: right: 12, width: 280, roughly 120px tall, above tab bar
  // Point to the left-center edge of the dock
  const lineToX = containerSize.width - 292
  const lineToY = containerSize.height - 176

  return (
    <View
      className={fullScreen ? "" : "rounded-xl overflow-hidden mb-4"}
      style={fullScreen
        ? { flex: 1, backgroundColor: isDark ? '#1a1a20' : '#e0e4ea' }
        : { height, backgroundColor: isDark ? '#1a1a20' : '#e0e4ea' }
      }
      onLayout={onContainerLayout}
    >
      {/* Terminal background */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: terminalOpacity }}>
        <Image
          source={isDark ? terminalDark : terminalLight}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Scrollable aircraft */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: aircraftOpacity }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          bounces
          scrollEnabled={hasSelection}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View
            style={{
              width: '100%',
              height: imageHeight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{ width: '85%', height: '100%', position: 'relative' }}
              onLayout={onImageLayout}
            >
              <Image
                source={aircraftImage}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />

              {hasSelection && imageSize.width > 0 && (
                <Animated.View
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: overlayOpacity }}
                >
                  {zones.map((zone) => (
                    <CompartmentOverlay
                      key={zone.holdKey}
                      zone={zone}
                      isActive={activeHold === zone.holdKey}
                      onSelect={onSelectHold}
                      accent={accent}
                      containerWidth={imageSize.width}
                      containerHeight={imageSize.height}
                    />
                  ))}
                </Animated.View>
              )}
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Connector line — drawn on top, tracks scroll */}
      {showConnector && hasSelection && lineFromX > 0 && (
        <ConnectorLine
          fromX={lineFromX}
          fromY={lineFromY}
          toX={lineToX}
          toY={lineToY}
          accent={accent}
          visible={hasSelection}
        />
      )}
    </View>
  )
}
