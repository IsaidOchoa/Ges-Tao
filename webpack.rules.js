// webpack.rules.js
module.exports = [
  // Add support for native node modules
  {
    test: /native_modules[/\\].+\.node$/,
    use: 'node-loader',
  },
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  // CORRECCIÓN AQUÍ:
  // Opción A: Elimina la línea que excluye app.html si quieres procesarlo como texto
  // Opción B: Si solo quieres excluir otros HTMLs pero permitir app.html, sé más específico
  
  // CAMBIA ESTO:
  
  {
    test: /\.html$/,
    exclude: [/app\.html$/], // <--- ¡ESTO ESTÁ BLOQUEANDO TU ARCHIVO!
    type: 'asset/source',
  },

  // POR ESTO (Permitir todos los HTMLs como texto/raw):
  
];