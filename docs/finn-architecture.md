# Finn - Assistente IA do App Financeiro

## Arquitetura Recomendada: Dify + Evolution API + Qwen

### Visão Geral

Stack recomendada para o Finn (assistente IA) com suporte a WhatsApp e Web, com memória por usuário e acesso a dados financeiros do backend.

```
                    USUÁRIOS
              ┌─────────┴──────────┐
              ▼                    ▼
         WhatsApp              Web App
              │                    │
    ┌─────────▼──────┐   ┌─────────▼──────────┐
    │ Evolution API  │   │ Dify Web Embed /   │
    │ (Baileys ou    │   │ REST API direta    │
    │  Meta Cloud)   │   │                    │
    └───────┬────────┘   └────────┬────────────┘
            │                     │
            └─────┐   ┌───────────┘
                  ▼   ▼
            ┌───────────────┐
            │    DIFY        │
            │ ┌───────────┐ │
            │ │ LLM: Qwen │ │  <- DashScope API (OpenAI-compatible)
            │ └───────────┘ │
            │ ┌───────────┐ │
            │ │ TOOLS     │ │  <- chamadas HTTP p/ backend financeiro
            │ │ - saldo   │ │
            │ │ - extrato │ │
            │ │ - imposto │ │
            │ └───────────┘ │
            │ ┌───────────┐ │
            │ │ MEMORY    │ │  <- PostgreSQL + Redis (por usuário)
            │ └───────────┘ │
            └───────────────┘
                  │
                  ▼
            ┌───────────────┐
            │ Backend Next.js│
            │ + Supabase    │
            └───────────────┘
```

## 1. Dify

### O que é

Plataforma open-source para desenvolvimento de aplicações LLM. Fornece canvas visual para definir workflows agenticos, integra pipelines RAG e serve como Backend-as-a-Service com APIs.

### Arquitetura (self-hosted Docker)

5 serviços principais + componentes de apoio:

- **API Service** — Backend, execução de workflows, orquestração de agents
- **Web Frontend** — UI em React
- **Worker/Celery** — Processamento de tarefas assíncronas
- **SSRF Proxy** — Segurança para requisições outbound
- **Redis** — Cache e pub/sub de conversas
- **PostgreSQL** — Banco principal + histórico de conversas
- **Vector Store** (Weaviate/Qdrant/etc.) — Base de conhecimento RAG
- **NGINX** — Reverse proxy

### Agentes e Tools

- **Function Calling**: LLM chama ferramentas pré-definidas diretamente
- **ReAct**: Loop Reason + Act para uso de tools em múltiplos passos
- **Built-in Tools**: 50+ (web search, image generation, code execution, etc.)
- **Custom Tools**: Importa OpenAPI/Swagger spec para expor qualquer REST API como tool
- **HTTP Request Node**: Modo workflow para chamadas HTTP arbitrárias com parsing de resposta

### Memória por Usuário

| Camada | Onde | Para quê |
|--------|------|----------|
| Curto prazo | Redis | Contexto da conversa atual (mensagens recentes) |
| Médio prazo | PostgreSQL | Histórico persistente por `conversation_id` + `user` |
| Longo prazo | Knowledge Base (RAG) | Resumos do perfil/transações do usuário |

- Contexto isolado por `user` via parâmetro nas chamadas de API
- Tamanho da janela de configuração configurável (quantas mensagens anteriores considerar)
- Conversations variables (conversation-scoped e globais) em workflows

### Provedor: Qwen via DashScope

Base URL (OpenAI-compatible): `https://dashscope.aliyuncs.com/compatible-mode/v1`

| Modelo | Contexto | Melhor para |
|--------|----------|-------------|
| qwen-turbo | ~8K tokens | Rápido, custo baixo |
| qwen-plus | ~32K tokens | Performance balanceada |
| qwen-max | ~8K tokens | Mais capacidade de raciocínio |
| qwen-long | ~1M tokens | Documentos longos |

## 2. Evolution API

### O que é

API open-source (Apache 2.0) de comunicação via WhatsApp. Começou como wrapper WhatsApp Web (Baileys) e evoluiu para plataforma multi-canal com integrações nativas (Typebot, Chatwoot, Dify, OpenAI).

### Conexões WhatsApp

1. **Baileys**: Gratuito, protocolo WhatsApp Web. Autenticação via QR code. Uso pessoal/small scale (risco ToS).
2. **Meta Cloud API**: Oficial, WhatsApp Business API. Requer conta Business Meta e número registrado.

### Stack Docker

| Serviço | Porta | Propósito |
|---------|-------|-----------|
| evolution-api | 8080 | API principal |
| evolution-manager | 3000 | UI de gerenciamento |
| Redis | 6379 | Queue/cache |
| PostgreSQL 15 | 5432 | Persistência de instâncias |

### Integração com Dify (nativa)

1. Settings da instância > Dify Integration
2. Informar URL e API Key do Dify
3. Quando mensagem chega no WhatsApp → Evolution encaminha para `POST /v1/chat-messages` no Dify
4. Dify processa → devolve resposta → Evolution entrega no WhatsApp

## 3. Fluxo de Dados

### WhatsApp

1. Usuário envia mensagem → WhatsApp servers
2. Evolution API (Baileys) recebe via WebSocket
3. Encaminha para Dify (`POST /v1/chat-messages`)
4. Dify: recupera memória → chama tools (finance APIs) → LLM gera resposta
5. Resposta volta para Evolution API → entrega no WhatsApp

### Web

1. Widget embed do Dify na página ou chamada REST API do frontend
2. Mesma lógica de processamento
3. Usa o mesmo `conversationId` vinculado ao `userId` do Supabase
4. Memória compartilhada entre canais

### Cross-Channel Memory

Mapeia número WhatsApp → `userId` da plataforma. Ambos os canais enviam o mesmo identificador na API do Dify, unificando contexto.

Exemplo:
```json
// Payload que Evolution API envia ao Dify
{
  "inputs": { "user_id": "supabase_user_abc" },
  "query": "Quanto gastei com mercado esse mês?",
  "conversation_id": "supabase_user_abc_whatsapp",
  "user": "supabase_user_abc"
}
```

## 4. Integração com Backend Financeiro

No Dify, cria-se Custom Tools via OpenAPI spec ou HTTP Request nodes. Cada endpoint vira uma "ferramenta" que o Finn pode chamar:

```
GET  /api/saldo?userId=...
GET  /api/transacoes?userId=...&mes=...
POST /api/calcular-imposto
GET  /api/categoria-analytics?userId=...
```

O agente decide quando chamar cada uma baseado na pergunta do usuário.

Ex: "Quanto eu gastei com mercado?" → agente chama `/api/transacoes` com filtro → recebe dados → formata resposta.

## 5. Requisitos de Infra

| Componente | Mínimo | Recomendado |
|---|---|---|
| Dify (5 serviços) | 2 cores, 4 GB RAM | 4 cores, 8 GB |
| Evolution API (4 serviços) | 1 core, 2 GB RAM | 2 cores, 4 GB |
| **Total single server** | **4 cores, 6 GB** | **8 cores, 16 GB** |

**VPS recomendada:** Hetzner CPX41 (8 vCPU, 32 GB) — ~$25-30/mês (sobra para rodar o Next.js também).

## 6. Custos Mensais Estimados

| Item | Custo |
|------|-------|
| VPS | $25-30 |
| Qwen qwen-turbo (~10K conversas) | ~$2-5 |
| Qwen qwen-plus (~10K conversas) | ~$40-80 |
| **Total (turbo)** | **~$30-35/mês** |
| **Total (plus)** | **~$65-110/mês** |

## 7. Setup: Passo a Passo

### Dify

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
# Acessar http://localhost/install para inicializar
```

Configuração no Dify dashboard:
1. Settings > Model Providers > Add Qwen
   - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - API Key: sua chave DashScope
2. Criar Agent App
3. Add Tools: HTTP Request → suas API routes
4. Configurar memória: conversation history size

### Evolution API

```bash
git clone https://github.com/EvolutionAPI/evolution-api.git
cd evolution-api
# Criar .env com POSTGRES_DATABASE, POSTGRES_USERNAME, POSTGRES_PASSWORD
docker compose up -d
# Acessar manager UI: http://localhost:3000
# Criar instância → scan QR → configurar Dify integration
```

### Web Embed

Dify gera um `<script>` pronto para o widget de chat — adicionar no Next.js:

```html
<script src="https://SEU-DIFY-URL/embed.js"
  data-app-id="SEU_APP_ID"
  data-base-url="https://SEU-DIFY-URL"
  data-theme-color="#your-brand-color">
</script>
```

## 8. Dify vs n8n (comparativo)

| Critério | Dify | n8n |
|---|---|---|
| Memória de conversa | Built-in | Tem que construir |
| WhatsApp | Via Evolution API (nativo) | Via webhook manual |
| Web embed | Pronto | Sem |
| Agent com tools | Nativo (ReAct + Function Calling) | Limitado |
| RAG / base de conhecimento | Nativo | Manual |
| Integrações nativas (não-LLM) | ~50 | 400+ |
| Infra | Mais pesado (5 serviços) | Leve (1 serviço) |

**Conclusão:** Para assistente conversacional com memória + WhatsApp + web, Dify é purpose-built. n8n brilha em data pipelines (sync de dados, tarefas agendadas).

**Abordagem híbrida (futuro):** n8n para pipelines de dados em background + Dify para o assistente IA.
