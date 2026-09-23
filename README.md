# Portal B2B Frontend

## Contrato de produção

O frontend é uma SPA estática. Em produção, compile com:

```text
VITE_API_URL=/api/v1
```

O frontend, a API e o WebSocket devem ser publicados na mesma origem. O
balanceador encaminha `/api/*` ao backend e os demais caminhos ao bucket da SPA.
Essa regra preserva cookies HttpOnly e funciona também nos domínios white-label.

As URLs exibidas para configuração de webhooks são convertidas em URLs absolutas
usando o domínio atual do navegador; nenhum domínio de API fica gravado no bundle.
