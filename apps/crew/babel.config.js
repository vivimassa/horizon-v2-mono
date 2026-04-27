module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      // WatermelonDB needs the legacy decorator transform (stage-1 spec)
      // because the model classes use `@field`/`@text` decorators on
      // class properties.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  }
}
