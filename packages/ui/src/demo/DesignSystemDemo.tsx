// SkyHub — Design System Demo
// Renders every primitive for visual verification
import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Building2,
  Plane,
  UserCircle,
  Search,
  Users,
  Clock,
  Calendar,
  Shield,
  Wrench,
  Bell,
  BarChart3,
  Globe,
} from 'lucide-react-native'

import { useTheme } from '../hooks/useTheme'
import { useThemeStore } from '../stores/useThemeStore'
import { accentTint, colors, type StatusKey } from '../theme/colors'

// SkyHub components
import { Card } from '../components/Card'
import { SectionHeader } from '../components/SectionHeader'
import { ListItem } from '../components/ListItem'
import { SearchInput } from '../components/SearchInput'
import { StatusChip } from '../components/StatusChip'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'

// Gluestack primitives
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlHelper,
  FormControlHelperText,
} from '../gluestack/form-control'
import { Input, InputField } from '../gluestack/input'
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectItem,
} from '../gluestack/select'
import { Checkbox, CheckboxIndicator, CheckboxLabel } from '../gluestack/checkbox'
import { RadioGroup, Radio, RadioLabel } from '../gluestack/radio'
import { Switch } from '../gluestack/switch'
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '../gluestack/modal'
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetItemText,
} from '../gluestack/actionsheet'
import {
  Toast,
  ToastTitle,
  ToastDescription,
  useToast,
} from '../gluestack/toast'

const ALL_STATUSES: StatusKey[] = [
  'onTime', 'delayed', 'cancelled', 'departed', 'diverted', 'scheduled',
]

const DEMO_ICONS = [
  { name: 'Aircraft', icon: Plane },
  { name: 'Airport', icon: Building2 },
  { name: 'Crew', icon: Users },
  { name: 'Clock', icon: Clock },
  { name: 'Calendar', icon: Calendar },
  { name: 'Shield', icon: Shield },
  { name: 'Wrench', icon: Wrench },
  { name: 'Bell', icon: Bell },
  { name: 'Charts', icon: BarChart3 },
  { name: 'Globe', icon: Globe },
  { name: 'Search', icon: Search },
  { name: 'Person', icon: UserCircle },
]

export function DesignSystemDemo() {
  const { palette, accentColor, isDark } = useTheme()
  const { toggleColorMode, setAccentColor } = useThemeStore()
  const toast = useToast()

  const [searchText, setSearchText] = useState('')
  const [formInput, setFormInput] = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [radioValue, setRadioValue] = useState('opt1')
  const [switchOn, setSwitchOn] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionsheetOpen, setActionsheetOpen] = useState(false)

  const gradientStart = isDark ? '#1a1a1a' : '#ffffff'
  const gradientEnd = isDark ? '#141414' : '#f5f5f5'
  const bgStyle = Platform.select({
    web: { background: `linear-gradient(180deg, ${gradientStart}, ${gradientEnd})` } as any,
    default: { backgroundColor: gradientStart },
  })

  return (
    <SafeAreaView className="flex-1" style={bgStyle} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View>
          <Text className="text-[20px] font-semibold" style={{ color: palette.text }}>
            Design System
          </Text>
          <Text className="text-[12px]" style={{ color: palette.textSecondary }}>
            SkyHub primitives
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={toggleColorMode}
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: palette.card }}
          >
            <Text className="text-[12px] font-semibold" style={{ color: palette.text }}>
              {isDark ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Accent Presets */}
        <SectionHeader title="Accent Color" />
        <Card padding="compact">
          <View className="flex-row flex-wrap gap-2">
            {Object.entries(colors.accentPresets).map(([name, hex]) => (
              <Pressable
                key={name}
                onPress={() => setAccentColor(hex)}
                className="rounded-lg px-3 py-2 items-center"
                style={{
                  backgroundColor: hex === accentColor
                    ? accentTint(hex, 0.15)
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: hex === accentColor ? hex : palette.border,
                }}
              >
                <View className="w-4 h-4 rounded-full mb-1" style={{ backgroundColor: hex }} />
                <Text className="text-[11px] font-semibold" style={{ color: palette.text }}>
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Cards */}
        <SectionHeader title="Cards" />
        <Card>
          <Text className="text-[14px]" style={{ color: palette.text }}>
            Standard card with default padding. Background uses palette.card with shadow elevation.
          </Text>
        </Card>
        <View className="h-2" />
        <Card padding="compact" pressable onPress={() => {}}>
          <Text className="text-[14px]" style={{ color: palette.text }}>
            Compact pressable card. Tap to see scale effect.
          </Text>
        </Card>

        {/* List Items */}
        <SectionHeader title="List Items" />
        <Card padding="compact">
          <ListItem
            title="Airport VVTS"
            subtitle="Ho Chi Minh City"
            leftIcon={Building2}
            showChevron
            onPress={() => {}}
          />
          <ListItem
            title="Aircraft VN-A321"
            subtitle="Airbus A321"
            leftIcon={Plane}
            rightElement={<StatusChip status="onTime" />}
            onPress={() => {}}
          />
          <ListItem
            title="Active Item"
            subtitle="Highlighted with accent tint"
            leftIcon={UserCircle}
            isActive
            isLast
            onPress={() => {}}
          />
        </Card>

        {/* Search */}
        <SectionHeader title="Search" />
        <SearchInput
          placeholder="Search airports..."
          value={searchText}
          onChangeText={setSearchText}
        />

        {/* Status Chips */}
        <SectionHeader title="Status Chips" />
        <Card padding="compact">
          <View className="flex-row flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <StatusChip key={s} status={s} />
            ))}
          </View>
        </Card>

        {/* Buttons */}
        <SectionHeader title="Buttons" />
        <Card>
          <View className="gap-3">
            <Button title="Assign Crew" variant="primary" onPress={() => {}} leftIcon={Users} />
            <Button title="Cancel" variant="secondary" onPress={() => {}} />
            <Button title="View Details" variant="ghost" onPress={() => {}} />
            <Button title="Remove" variant="destructive" onPress={() => {}} />
            <Button title="Loading..." variant="primary" onPress={() => {}} loading />
            <Button title="Disabled" variant="primary" onPress={() => {}} disabled />
          </View>
        </Card>

        {/* Form Controls */}
        <SectionHeader title="Form Controls" subtitle="Gluestack primitives" />
        <Card>
          <View className="gap-4">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText style={{ color: palette.textSecondary }}>
                  Airport Name
                </FormControlLabelText>
              </FormControlLabel>
              <Input
                className="flex-row items-center rounded-[10px] border h-10 px-3"
                style={{ backgroundColor: palette.card, borderColor: palette.border }}
              >
                <InputField
                  className="flex-1 text-sm"
                  style={{ color: palette.text }}
                  placeholder="Enter airport name"
                  placeholderTextColor={palette.textTertiary}
                  value={formInput}
                  onChangeText={setFormInput}
                />
              </Input>
              <FormControlHelper>
                <FormControlHelperText style={{ color: palette.textTertiary }}>
                  Full name of the airport
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText style={{ color: palette.textSecondary }}>
                  Base Airport
                </FormControlLabelText>
              </FormControlLabel>
              <Select selectedValue={selectValue} onValueChange={setSelectValue}>
                <SelectTrigger
                  className="rounded-[10px] border h-10 px-3"
                  style={{ backgroundColor: palette.card, borderColor: palette.border }}
                >
                  <SelectInput
                    placeholder="Select airport"
                    className="flex-1 text-sm"
                    style={{ color: selectValue ? palette.text : palette.textTertiary }}
                  />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent
                    className="rounded-xl"
                    style={{ backgroundColor: palette.card }}
                  >
                    <SelectItem label="SGN - Tan Son Nhat" value="VVTS" />
                    <SelectItem label="HAN - Noi Bai" value="VVNB" />
                    <SelectItem label="DAD - Da Nang" value="VVDN" />
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <View className="flex-row items-center gap-6">
              <Checkbox
                value="notifications"
                isChecked={checkboxChecked}
                onChange={setCheckboxChecked}
              >
                <CheckboxIndicator />
                <CheckboxLabel style={{ color: palette.text }}>Notifications</CheckboxLabel>
              </Checkbox>

              <RadioGroup value={radioValue} onChange={setRadioValue} className="flex-row gap-4">
                <Radio value="opt1">
                  <RadioLabel style={{ color: palette.text }}>VFR</RadioLabel>
                </Radio>
                <Radio value="opt2">
                  <RadioLabel style={{ color: palette.text }}>IFR</RadioLabel>
                </Radio>
              </RadioGroup>

              <Switch
                value={switchOn}
                onValueChange={setSwitchOn}
                trackColor={{ false: palette.border, true: accentColor }}
              />
            </View>
          </View>
        </Card>

        {/* Overlays */}
        <SectionHeader title="Overlays" subtitle="Gluestack modals and sheets" />
        <Card>
          <View className="flex-row gap-3 flex-wrap">
            <Button title="Open Modal" variant="secondary" onPress={() => setModalOpen(true)} />
            <Button title="Action Sheet" variant="secondary" onPress={() => setActionsheetOpen(true)} />
            <Button
              title="Show Toast"
              variant="secondary"
              onPress={() => {
                toast.show({
                  duration: 3000,
                  render: () => (
                    <Toast
                      className="border"
                      style={{ backgroundColor: palette.card, borderColor: palette.border }}
                    >
                      <ToastTitle style={{ color: palette.text }}>Flight Updated</ToastTitle>
                      <ToastDescription style={{ color: palette.textSecondary }}>
                        VJ-123 departure time changed to 14:30 UTC
                      </ToastDescription>
                    </Toast>
                  ),
                })
              }}
            />
          </View>
        </Card>

        {/* Badges & Icons */}
        <SectionHeader title="Badges and Icons" />
        <Card>
          <View className="flex-row gap-2 mb-4">
            <Badge label="12" variant="default" />
            <Badge label="New" variant="accent" />
            <Badge label="0" variant="muted" />
          </View>
          <View className="flex-row flex-wrap gap-4">
            {DEMO_ICONS.map(({ name, icon }) => (
              <View key={name} className="items-center w-14">
                <Icon icon={icon} size="md" />
                <Text
                  className="text-[11px] mt-1 text-center"
                  style={{ color: palette.textSecondary }}
                >
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Empty State */}
        <SectionHeader title="Empty State" />
        <Card>
          <EmptyState
            icon={Search}
            title="No results"
            subtitle="Try adjusting your search"
          />
        </Card>
      </ScrollView>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalBackdrop />
        <ModalContent
          className="rounded-xl border p-0"
          style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
        >
          <ModalHeader className="px-4 pt-4 pb-2">
            <Text className="text-[15px] font-bold" style={{ color: palette.text }}>
              Confirm Assignment
            </Text>
          </ModalHeader>
          <ModalBody className="px-4 py-2">
            <Text className="text-[14px]" style={{ color: palette.textSecondary }}>
              Assign Captain Nguyen to flight VJ-123 SGN-HAN departing 14:30 UTC?
            </Text>
          </ModalBody>
          <ModalFooter className="px-4 pb-4 pt-2 gap-3 justify-end">
            <Button title="Cancel" variant="secondary" onPress={() => setModalOpen(false)} />
            <Button title="Confirm" variant="primary" onPress={() => setModalOpen(false)} />
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Actionsheet */}
      <Actionsheet isOpen={actionsheetOpen} onClose={() => setActionsheetOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent
          className="border-t"
          style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
        >
          <ActionsheetItem onPress={() => {}}>
            <ActionsheetItemText style={{ color: palette.text }}>
              View Flight Details
            </ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => {}}>
            <ActionsheetItemText style={{ color: palette.text }}>
              Edit Crew Assignment
            </ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => {}}>
            <ActionsheetItemText style={{ color: '#dc2626' }}>
              Cancel Flight
            </ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </SafeAreaView>
  )
}
