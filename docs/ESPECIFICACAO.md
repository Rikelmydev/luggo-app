# Luggo: especificação do site (v1)

Site de aluguel de malas da Luggo, startup fictícia de São Paulo. A versão 1 é só front-end: todas as telas e fluxos funcionam no navegador, com os dados guardados no próprio aparelho, para demonstrar o produto funcionando. A camada de dados é isolada para ser trocada por um backend depois.

## Decisões

| Tema | Decisão |
|---|---|
| Oferta | Só aluguel de malas (sem venda) |
| Tecnologia | React 19 + TypeScript + Vite 7, React Router 7, Motion, ícones Phosphor |
| Dados | `localStorage`, atrás de uma camada `src/services` |
| Pagamento | Pix e cartão pelo Mercado Pago, em modo demonstração. O site nunca coleta número de cartão |
| Publicação | GitHub Pages via GitHub Actions, rotas com `basename` e `404.html` de fallback |
| Visual | Mesma identidade do site de apresentação: azul #2445FF, amarelo #F5D66E, mala laranja 3D, Archivo, etiqueta e cartão de embarque |

## Regras de negócio (valores fictícios em `src/config/business.ts`)

- Diária por tamanho: de bordo R$ 14, média R$ 18, grande R$ 22. Mínimo de 3 diárias.
- Desconto por período: 10% a partir de 7 diárias, 20% a partir de 14.
- Kits com preço próprio por diária.
- Proteção contra danos opcional: R$ 3 por mala por dia.
- Entrega e coleta na capital de São Paulo: R$ 24,90 por pedido. Retirada na loja: grátis.
- Fora da capital: só retirada na loja.
- Cada mala volta, passa 1 dia em higienização e só então fica disponível de novo.
- Ficar mais dias (pedido pelo site antes do fim): diária cheia, sem desconto, se as mesmas malas estiverem livres.
- Atraso sem aviso: diária cheia + 20% por dia.
- Cancelamento grátis até 48 h antes da retirada.

## Páginas

Cliente: início com busca por datas, catálogo com filtros, página da mala com calendário de disponibilidade, reserva (carrinho), pagamento em etapas, pedido confirmado (cartão de embarque com QR e linha do tempo), minhas reservas, perguntas frequentes, como funciona, termos de aluguel, contato, sobre.

Equipe: `/equipe` com PIN de demonstração. Hoje (retiradas, entregas e devoluções), reservas com avanço de status, estoque mala por mala e números (ocupação, receita, aluguéis por mala).

## Status do pedido

`aguardando_pagamento` → `confirmado` → `com_cliente` → `devolvido` → `concluido` (após higienização), além de `cancelado`.

## Fora da v1

Login real, e-mails automáticos, nota fiscal, cobrança real no Mercado Pago (exige um backend para guardar a chave secreta).
