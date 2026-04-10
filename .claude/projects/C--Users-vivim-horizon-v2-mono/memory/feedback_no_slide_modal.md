---
name: no-slide-modals
description: Never use animationType="slide" on Modal components — always use "fade" for picker/dropdown modals
type: feedback
---

Never use `animationType="slide"` on React Native `<Modal>` components. Always use `animationType="fade"` for flight pickers, dropdown selectors, and similar overlay modals.

**Why:** The slide animation feels intrusive and the dark background sliding up looks bad. Fade is cleaner.

**How to apply:** Any time a `<Modal>` is created in the mobile app, default to `animationType="fade"`.
