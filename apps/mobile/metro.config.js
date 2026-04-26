const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Web-only stub for native-only modules. Lets `npx expo start --web` bundle
// without yanking these imports out of every screen file.
const WEB_STUBS = new Set(['react-native-maps', 'react-native/Libraries/Utilities/codegenNativeCommands'])
const stubPath = path.resolve(projectRoot, 'src', 'lib', 'web-stub.js')

// Handle NodeNext-style .js imports that actually point to .ts files
// (workspace packages use .js extensions for Node16 compat but Metro needs .ts)
const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS.has(moduleName)) {
    return { type: 'sourceFile', filePath: stubPath }
  }
  // Only rewrite relative .js imports inside workspace packages
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const caller = context.originModulePath
    if (caller && caller.includes(path.join('packages', '')) && !caller.includes('node_modules')) {
      const tsPath = path.resolve(path.dirname(caller), moduleName.replace(/\.js$/, '.ts'))
      if (fs.existsSync(tsPath)) {
        const tsModule = moduleName.replace(/\.js$/, '.ts')
        if (originalResolveRequest) {
          return originalResolveRequest(context, tsModule, platform)
        }
        return context.resolveRequest(context, tsModule, platform)
      }
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
