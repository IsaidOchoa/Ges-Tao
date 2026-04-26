// webpack.renderer.config.js
const rules = require('./webpack.rules');
const HtmlWebpackPlugin = require('html-webpack-plugin');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // 1. Apuntamos al JS del LOGIN como entrada principal
  entry: './src/renderer/js/app.js', 
  
  module: {
    rules: rules,
  },
  plugins: [
    new HtmlWebpackPlugin({
      // 2. La plantilla base será el login.html (o index.html si lo usas tal cual)
      template: './src/renderer/app.html', 
      // Si usas index.html como login, pon: template: './src/renderer/index.html',
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};