# Backend — Controle de Validade de Alimentos

API REST em Node.js (Express + PostgreSQL) com autenticação JWT.

## Configuração e execução

1. Instale as dependências:
   ```bash
   cd backend
   npm install
   ```
2. Copie o arquivo de exemplo e preencha as variáveis:
   ```bash
   cp .env.example .env
   ```
   | Variável       | Descrição                                                       |
   | -------------- | --------------------------------------------------------------- |
   | `DATABASE_URL` | String de conexão PostgreSQL (`postgres://usuario:senha@host:5432/banco`) |
   | `JWT_SECRET`   | Segredo usado para assinar os tokens (obrigatório)              |
   | `PORT`         | Porta do servidor (padrão `3000`)                               |
3. Inicie o servidor:
   ```bash
   npm start
   ```
   As tabelas `usuarios` e `produtos` são criadas automaticamente na inicialização.

## Autenticação

As rotas `/produtos` exigem o cabeçalho:

```
Authorization: Bearer <token>
```

O token é obtido em `/auth/registro` ou `/auth/login` e expira em 30 dias. Sem token, com token inválido ou expirado, a resposta é `401` com uma destas mensagens:

| Situação                              | Mensagem               |
| ------------------------------------- | ---------------------- |
| Cabeçalho ausente ou não é `Bearer`   | `Token não informado.` |
| Token malformado ou assinatura errada | `Token inválido.`      |
| Token expirado                        | `Token expirado.`      |

O servidor se recusa a iniciar se `JWT_SECRET` não estiver definido ou estiver vazio. As senhas são gravadas somente como hash bcrypt (custo 12) e nunca aparecem em respostas.

## Formato de erro

Todas as respostas de erro usam:

```json
{ "mensagem": "Descrição do erro." }
```

## Rotas

| Método | Rota               | Auth | Descrição                                   | Sucesso |
| ------ | ------------------ | ---- | ------------------------------------------- | ------- |
| POST   | `/auth/registro`   | Não  | Cria usuário e retorna token                | 201     |
| POST   | `/auth/login`      | Não  | Autentica e retorna token                   | 200     |
| GET    | `/produtos`        | Sim  | Lista os produtos do usuário logado         | 200     |
| GET    | `/produtos/:id`    | Sim  | Retorna um produto do usuário               | 200     |
| POST   | `/produtos`        | Sim  | Cria produto (idempotente por `id`)         | 201/200 |
| PUT    | `/produtos/:id`    | Sim  | Atualiza nome, quantidade, validade e foto  | 200     |
| DELETE | `/produtos/:id`    | Sim  | Remove produto (idempotente)                | 204     |

## Autenticação — detalhes

### POST /auth/registro

Requisição:
```json
{ "nome": "Maria", "email": "maria@email.com", "senha": "123456" }
```
Resposta `201`:
```json
{
  "token": "<jwt>",
  "usuario": { "id": 1, "nome": "Maria", "email": "maria@email.com" }
}
```
- `400`: `{ "mensagem": "Campos obrigatórios não informados: <campos separados por vírgula>." }`, `"E-mail inválido."` (formato `algo@algo.algo`) ou `"A senha deve ter no mínimo 6 caracteres."`.
- `409`: `{ "mensagem": "E-mail já cadastrado." }`.

### POST /auth/login

Requisição:
```json
{ "email": "maria@email.com", "senha": "123456" }
```
Resposta `200`: mesmo formato do registro.
- `401`: `{ "mensagem": "Credenciais inválidas." }` — a mesma resposta para senha errada, e-mail inexistente ou campos ausentes.

## Testes

```bash
cd backend
npm test
```

Os testes (Jest + supertest, em `test/auth.test.js`) não usam banco real: a conexão `pg` é substituída por um armazenamento em memória e o `JWT_SECRET` é definido pelo próprio teste. O bcrypt é o real, com custo 12.

## Produtos — detalhes

Objeto produto:
```json
{
  "id": "a1b2c3",
  "usuarioId": 1,
  "nome": "Leite",
  "quantidade": 2,
  "dataDeValidade": "2026-12-31",
  "fotoUri": "file:///foto.jpg",
  "dataDeCadastro": "2026-11-19T17:00:00.000Z"
}
```
- `dataDeValidade` é sempre texto `YYYY-MM-DD`. O backend **não** valida se a data é passada (regra exclusiva do app).
- `fotoUri` pode ser `null`.

### GET /produtos
`200` com array de produtos do usuário, ordenados por `dataDeValidade`.

### GET /produtos/:id
- `200`: produto.
- `404`: não existe ou pertence a outro usuário.

### POST /produtos

Requisição (`id`, `fotoUri` e `dataDeCadastro` opcionais; se `id` ou `dataDeCadastro` ausentes, o servidor gera):
```json
{
  "id": "a1b2c3",
  "nome": "Leite",
  "quantidade": 2,
  "dataDeValidade": "2026-12-31",
  "fotoUri": null,
  "dataDeCadastro": "2026-11-19T17:00:00.000Z"
}
```
- `201`: produto criado.
- `200`: `id` já existe para o mesmo usuário; retorna o registro existente, sem alterá-lo.
- `400`: faltam `nome`, `quantidade` (inteiro) ou `dataDeValidade`.
- `409`: `id` já pertence a outro usuário.

### PUT /produtos/:id

Atualiza apenas `nome`, `quantidade`, `dataDeValidade` e `fotoUri`; `id`, `usuarioId` e `dataDeCadastro` são mantidos.
```json
{ "nome": "Leite integral", "quantidade": 3, "dataDeValidade": "2027-01-15", "fotoUri": null }
```
- `200`: produto atualizado.
- `400`: dados obrigatórios ausentes ou inválidos.
- `404`: não existe ou pertence a outro usuário.

### DELETE /produtos/:id
`204` sem corpo, sempre — mesmo se o produto não existir ou for de outro usuário.

## Códigos de status

| Código | Significado                                                              |
| ------ | ------------------------------------------------------------------------ |
| 200    | Sucesso (login, consultas, atualização, POST de produto já existente)    |
| 201    | Recurso criado (registro, novo produto)                                  |
| 204    | Remoção concluída, sem corpo                                             |
| 400    | Requisição inválida (campos ausentes, JSON ou data mal formatados)       |
| 401    | Token ausente/inválido ou credenciais inválidas                          |
| 404    | Produto (ou rota) não encontrado                                         |
| 409    | Conflito (e-mail já cadastrado; `id` de produto de outro usuário)        |

Erros inesperados retornam `500` com `{ "mensagem": "Erro interno do servidor." }`.
