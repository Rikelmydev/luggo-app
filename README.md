# Luggo

Site de aluguel de malas da Luggo, startup de São Paulo: o cliente escolhe a mala, vê na hora o que está livre nas datas da viagem, paga com Pix ou cartão e recebe em casa ou retira na loja. A equipe acompanha tudo num painel próprio.

> Projeto demonstrativo. A Luggo é uma startup fictícia criada como projeto de empreendedorismo. As reservas, as contas e o estoque ficam num banco de dados de verdade (Supabase); só o pagamento é simulado e nenhum valor é cobrado.

![Página inicial: a mala laranja com a etiqueta da Luggo e a busca por datas](docs/telas/inicio.jpg)

## O que dá para fazer

**Cliente**

- Buscar por datas e tamanho, com calendário que mostra os dias esgotados e respeita o mínimo de diárias e o dia de higienização entre aluguéis.
- Ver cada mala com medidas desenhadas em escala, ficha técnica e preço do período já com desconto.
- Montar a reserva com várias malas e kits, ligar a Proteção Luggo e ver o total na hora.
- Pagar em três etapas: dados, entrega ou retirada (com CEP consultado no ViaCEP e área de entrega da capital) e pagamento.
- Pix com QR Code, copia e cola e contagem de 30 minutos; cartão pelo Mercado Pago, inclusive o caso de cartão recusado.
- Acompanhar a reserva num cartão de embarque com QR de retirada e linha do tempo, ficar mais dias (só se as mesmas malas estiverem livres) e cancelar dentro do prazo.

**Equipe** (`/equipe`, com a conta da equipe; sem banco configurado, PIN de demonstração `2026`)

- Todas as reservas feitas no site, de qualquer aparelho, chegando ao vivo.
- Hoje: o que sai, o que volta, o que está atrasado e o que está em higienização, com o código de cada mala física.
- Reservas: busca, filtros por situação e avanço de status.
- Estoque: as 30 malas uma a uma, com situação, próxima saída e manutenção.
- Números: receita por semana, ocupação dos próximos 30 dias e aluguéis por mala.

| | |
|---|---|
| ![Catálogo com filtros e disponibilidade nas datas](docs/telas/catalogo.jpg) | ![Página da mala com calendário e preço do período](docs/telas/mala.jpg) |
| ![Pagamento com Pix](docs/telas/pagamento-pix.jpg) | ![Reserva confirmada em formato de cartão de embarque](docs/telas/reserva-confirmada.jpg) |
| ![Painel da equipe: o dia de hoje](docs/telas/equipe-hoje.jpg) | ![Painel da equipe: números](docs/telas/equipe-numeros.jpg) |

## Como rodar

Precisa do Node.js 20 ou mais novo.

```bash
npm install
npm run dev
```

O site abre em `http://localhost:5173`. Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Testes das regras de negócio (preço, disponibilidade, pedidos, CEP, painel) |
| `npm run build` | Gera o site em `dist/` |
| `npm run preview` | Abre o site gerado |
| `npm run icons` | Regenera os ícones a partir de `scripts/icons.json` |

## Banco de dados (Supabase)

Sem configuração, o site guarda tudo no navegador, como uma demonstração. Para as reservas de todos os clientes chegarem ao painel:

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o arquivo [`supabase/schema.sql`](supabase/schema.sql). Ele cria as tabelas, as regras de acesso e as funções que impedem duas reservas da mesma mala nas mesmas datas.
3. Em **Authentication > Sign In / Providers > Email**, desligue **Confirm email** (o envio de e-mails do Supabase gratuito só atende a própria equipe). Em **URL Configuration**, use o endereço do site como *Site URL* e acrescente `http://localhost:5173/**` nas *Redirect URLs*.
4. Crie a conta da equipe em **Authentication > Users > Add user** e libere o painel para ela no SQL Editor: `insert into public.staff (email) values ('email-da-equipe');`.
5. Copie a *Project URL* e a chave *anon public* (**Project Settings > API**) para um arquivo `.env.local` (veja `.env.example`) e para `.env.production`, usado na publicação.

No primeiro acesso da equipe, o painel cria as 30 malas e os pedidos de exemplo. O botão **Restaurar demonstração** refaz os pedidos de exemplo sem tocar nas reservas do site. O login com Google aparece quando o provedor Google estiver ativado no Supabase e `VITE_LOGIN_GOOGLE=1`.

## Publicar

O workflow `.github/workflows/deploy.yml` roda os testes, gera o site e publica no GitHub Pages a cada push na `main`. No repositório, vá em **Settings > Pages** e escolha **GitHub Actions** como fonte. Na conta gratuita, o repositório precisa ser público.

## Como é feito

- **React 19, TypeScript e Vite**, com rotas do React Router e animações com Motion (carregado de forma enxuta com `LazyMotion`).
- **CSS Modules** com a identidade da Luggo: azul `#2445FF`, amarelo `#F5D66E`, a fonte Archivo e a mala 3D em camadas, que chega rolando na página inicial.
- **Ícones Phosphor** gerados só com os pesos usados, para o site carregar mais rápido.
- **Camada de serviços** (`src/services`) isolada das telas. Com Supabase, as telas leem uma cópia do que cada pessoa pode ver (`storage.ts`), mantida em dia ao vivo por `remote.ts`; o banco confere de novo cada reserva e cada mudança. Sem Supabase, a mesma camada guarda tudo no `localStorage`, que é como os testes rodam.
- **Segurança no banco**: o visitante só enxerga a ocupação das malas, sem dados pessoais; cada cliente vê só as próprias reservas (pela conta ou pela chave guardada no navegador que reservou); a equipe é quem está na tabela `staff`.
- **Acessível**: navegação por teclado (inclusive no calendário), foco visível, textos alternativos, contraste AA, modo escuro e respeito a quem prefere menos movimento.

```
src/
  config/business.ts   preços, prazos, loja e área de entrega (tudo o que a equipe ajusta)
  data/                catálogo, perguntas frequentes e dados de demonstração
  services/            disponibilidade, preço, pedidos, pagamentos, CEP, números do painel e o Supabase
supabase/schema.sql    tabelas, regras de acesso e funções do banco
  state/               reserva em montagem e hooks
  components/          calendário, cartão de embarque, gráficos, modal...
  pages/               telas do cliente e, em admin/, as da equipe
```

## Pagamento de verdade

Nesta versão o Mercado Pago é simulado: o código Pix gerado não pode ser pago e o site nunca pede o número do cartão. Para cobrar de verdade, uma função serverless guarda o Access Token, cria o pagamento Pix ou a preferência do Checkout Pro e recebe o webhook de aprovação. O passo a passo está em `src/services/payments.ts`.

## Créditos

Mala 3D e ilustração: apresentação da equipe Luggo (Enzo, Bianca e Rikelmy). Fonte Archivo (SIL Open Font License). Ícones Phosphor (MIT). CEP pelo [ViaCEP](https://viacep.com.br).
