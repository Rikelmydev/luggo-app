// GitHub Pages devolve 404.html para rotas que não existem como arquivo.
// Copiar o index.html para lá faz o React Router assumir qualquer rota.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
console.log('404.html criado para as rotas do site')
