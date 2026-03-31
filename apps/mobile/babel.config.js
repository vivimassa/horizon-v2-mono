module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Ensure expo-router babel plugin has correct app root in monorepo
          router: {
            root: './app',
          },
        },
      ],
    ],
  }
}
