# Finn - Assistente IA

## Estrutura de Arquivos

```
src/
├── app/
│   ├── api/
│   │   └── finn/
│   │       └── route.ts          # API route proxy (validação auth + chamada ao Dify)
├── lib/
│   ├── finn/
│   │   ├── diff-client.ts         # Cliente Dify (mockado, pronto para real)
│   │   └── types.ts               # Tipagens TypeScript
│   │   └── index.ts               # Re-exports
└── components/
    └── finn/
        └── FinnWidget.tsx         # Widget de chat flutuante
```

## Como Funciona (Modo Atual - Mock)

O Finn está **mockado** e funciona de forma totalmente client-side:

1. Usuário digita mensagem no widget
2. `FinnWidget` envia `POST /api/finn` que retorna resposta mockada
3. Respostas são reconhecidas por palavras-chave (saldo, gasto, imposto, etc.)

**O widget aparece automaticamente** em todas as páginas do dashboard (canto inferior direito).

## Quando Conectar ao Dify

1. Rode o Dify (`docker compose up -d` no repo do Dify)
2. Crie um Agent App no Dify com Qwen como modelo
3. Adicione Tools (HTTP Request) apontando para suas APIs financeiras
4. Preencha no `.env.local`:

```
DIFY_API_URL=http://localhost:80
DIFY_API_KEY=app-xxx  # chave gerada no Dify
NEXT_PUBLIC_DIFY_API_URL=http://localhost:80
```

5. No arquivo `src/lib/finn/dify-client.ts`, descomente o bloco `MODO REAL`
6. No arquivo `src/app/api/finn/route.ts`, troque a resposta mock pela chamada Dify

## Tools para Adicionar no Dify (Futuro)

Quando configurar o Dify, crie uma Custom Tool apontando para suas API routes:

```
GET  /api/saldo
GET  /api/transacoes
GET  /api/categoria-analytics
POST /api/calcular-imposto
```

O agente decidirá automaticamente qual tool chamar baseado na pergunta do usuário.
