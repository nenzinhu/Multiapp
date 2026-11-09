export type AiProvider = {
  id: string;
  name: string;
  /** Where the API key is created. */
  consoleUrl: string;
  /** Short description of the free offer. */
  freeTier: string;
  /** The provider needs a card to release the free credits. */
  cardRequired?: boolean;
  /** Runs locally: no key and no cost. */
  local?: boolean;
};

/**
 * Starting point of free AI providers. Free quotas change often, so the
 * current limits must be confirmed in the provider console.
 */
export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "google-gemini",
    name: "Google Gemini",
    consoleUrl: "https://aistudio.google.com/apikey",
    freeTier: "Chaves gratuitas no AI Studio, com cota diária de uso.",
  },
  {
    id: "groq",
    name: "Groq",
    consoleUrl: "https://console.groq.com/keys",
    freeTier: "Camada gratuita de inferência rápida para modelos abertos.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    consoleUrl: "https://openrouter.ai/keys",
    freeTier: "Modelos marcados como :free, com API no formato da OpenAI.",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    consoleUrl: "https://cloud.cerebras.ai",
    freeTier: "Camada gratuita para modelos Llama e Qwen.",
  },
  {
    id: "mistral",
    name: "Mistral (La Plateforme)",
    consoleUrl: "https://console.mistral.ai",
    freeTier: "Nível experimental gratuito para testar os modelos.",
  },
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    consoleUrl: "https://dash.cloudflare.com/workers/ai",
    freeTier: "Neurônios gratuitos por dia, direto na sua conta Cloudflare.",
  },
  {
    id: "github-models",
    name: "GitHub Models",
    consoleUrl: "https://github.com/settings/tokens",
    freeTier: "Acesso a vários modelos usando um token do próprio GitHub.",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    consoleUrl: "https://huggingface.co/settings/tokens",
    freeTier: "Créditos mensais do Inference Providers e modelos locais.",
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    consoleUrl: "https://build.nvidia.com",
    freeTier: "Créditos gratuitos para testar a API dos modelos da NVIDIA.",
  },
  {
    id: "sambanova",
    name: "SambaNova",
    consoleUrl: "https://sambanova.ai",
    freeTier: "Camada gratuita de desenvolvimento.",
    cardRequired: true,
  },
  {
    id: "together",
    name: "Together AI",
    consoleUrl: "https://api.together.ai/settings/api-keys",
    freeTier: "Créditos gratuitos para começar a usar os modelos abertos.",
    cardRequired: true,
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    consoleUrl: "https://fireworks.ai/api-keys",
    freeTier: "Créditos iniciais para acessar modelos e inferência rápida.",
    cardRequired: true,
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    consoleUrl: "https://deepinfra.com/dash/api_keys",
    freeTier: "Créditos gratuitos e modelos abertos com API REST.",
    cardRequired: true,
  },
  {
    id: "novita",
    name: "Novita AI",
    consoleUrl: "https://novita.ai/dashboard/key-manager",
    freeTier: "Créditos gratuitos e modelos abertos.",
  },
  {
    id: "eden-ai",
    name: "Eden AI",
    consoleUrl: "https://app.edenai.run/api_key",
    freeTier: "Créditos de teste sobre uma plataforma com vários modelos.",
  },
  {
    id: "openai",
    name: "OpenAI",
    consoleUrl: "https://platform.openai.com/api-keys",
    freeTier: "Créditos de teste para contas novas.",
    cardRequired: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    freeTier: "Créditos de teste ao ativar a API da Claude.",
    cardRequired: true,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    consoleUrl: "https://console.x.ai",
    freeTier: "Créditos gratuitos para começar a usar os modelos Grok.",
    cardRequired: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    consoleUrl: "https://ollama.com",
    freeTier: "Roda modelos no seu computador: sem chave e sem custo.",
    local: true,
  },
  {
    id: "lm-studio",
    name: "LM Studio",
    consoleUrl: "https://lmstudio.ai",
    freeTier: "Modelos locais pelo app de desktop: sem chave e sem custo.",
    local: true,
  },
];

/** Finds a catalog entry by id. */
export function findProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}
