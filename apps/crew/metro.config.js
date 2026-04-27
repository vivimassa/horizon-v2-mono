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

// NodeNext .js → .ts rewrite for workspace packages.
const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const caller = context.originModulePath
    if (caller && caller.includes(path.join('packages', '')) && !caller.includes('node_modules')) {
      const tsPath = path.resolve(path.dirname(caller), moduleName.replace(/\.js$/, '.ts'))
      if (fs.existsSync(tsPath)) {
        const tsModule = moduleName.replace(/\.js$/, '.ts')
        if (originalResolveRequest) return originalResolveRequest(context, tsModule, platform)
        return context.resolveRequest(context, tsModule, platform)
      }
    }
  }
  if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform)
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
