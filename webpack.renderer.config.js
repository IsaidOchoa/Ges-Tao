// webpack.renderer.config.js
const rules = require('./webpack.rules');

// Agregar regla para CSS
rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // ¡IMPORTANTE! No definimos 'entry' ni 'plugins' aquí.
  // Electron Forge los inyecta automáticamente desde forge.config.js
  
  module: {
    rules: rules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};