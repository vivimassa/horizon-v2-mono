// Empty CommonJS stub for native-only modules on web. Reached via
// metro.config.js resolver alias when platform === 'web'. Any property
// access returns a no-op React component that renders null.

const React = require('react')

const NoopComponent = React.forwardRef((_props, _ref) => null)
NoopComponent.displayName = 'WebStub'

const noop = () => undefined

module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === '__esModule') return true
      if (prop === 'default') return NoopComponent
      // Map markers + callouts also expected as components
      if (typeof prop === 'string' && /^[A-Z]/.test(prop)) return NoopComponent
      return noop
    },
  },
)
