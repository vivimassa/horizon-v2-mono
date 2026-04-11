import '../globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { DisplayProvider } from '@/components/display-provider'

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DisplayProvider>
        <div className="h-screen w-screen overflow-hidden">{children}</div>
      </DisplayProvider>
    </ThemeProvider>
  )
}
