import { DesignSystemDemo } from '@skyhub/ui/demo'
import { ToastProvider } from '@skyhub/ui'

export default function DesignSystemScreen() {
  return (
    <ToastProvider>
      <DesignSystemDemo />
    </ToastProvider>
  )
}
