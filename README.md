# Dominic Generative

Este projeto cria uma camada local para usar modelos de IA com a identidade própria de Dominic Generative, mascarando o provedor real por trás da interface.

## O que foi implementado

- interface local com branding próprio
- backend Node.js para roteamento de chat
- módulos isolados para AirLLM e Hugging Face
- estrutura para integrar modelos locais e datasets reais no futuro

## Arquitetura

- `server.js`: API local que recebe as mensagens e encaminha para providers
- `airllm_backend.py`: módulo preparado para integrar o AirLLM
- `huggingface_backend.py`: módulo preparado para integrar datasets e tokens do Hugging Face
- `backend_service.py`: serviço de orquestração entre os backends

## Como executar

```bash
cd /home/marcos/dominic-generative
npm install
npm run dev
```

A API local fica em:

- http://localhost:5174/api/health

## Integração real com AirLLM

Para ativar o backend do AirLLM, instale o pacote e configure o modelo desejado no módulo `airllm_backend.py`.

Exemplo futuro:

```python
from airllm_backend import AirLLMBackend
backend = AirLLMBackend("Qwen/Qwen3-32B")
backend.configure("Qwen/Qwen3-32B")
```

## Integração real com Hugging Face

Para usar Hugging Face de forma real, configure um token e datasets via `huggingface_backend.py` ou pela interface futura.

Exemplo futuro:

```python
from huggingface_backend import HuggingFaceBackend
backend = HuggingFaceBackend()
backend.configure(api_key="hf_...", datasets=["datasets/jeopardy"])
```

## Próximos passos

1. instalar o AirLLM e conectar de forma real
2. instalar as dependências do Hugging Face e integrar datasets reais
3. adicionar armazenamento persistente para histórico e configurações
4. criar uma camada de RAG com busca em datasets
