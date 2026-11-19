require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function inicializarBanco() {
  const queryUsuarios = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      "senhaHash" VARCHAR(255) NOT NULL
    );
  `;

  const queryProdutos = `
    CREATE TABLE IF NOT EXISTS produtos (
      id VARCHAR(255) NOT NULL,
      "usuarioId" INT NOT NULL REFERENCES usuarios(id),
      nome VARCHAR(255) NOT NULL,
      quantidade INT NOT NULL,
      "dataDeValidade" DATE NOT NULL,
      "fotoUri" TEXT,
      "dataDeCadastro" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, "usuarioId")
    );
  `;

  const client = await pool.connect();
  try {
    await client.query(queryUsuarios);
    await client.query(queryProdutos);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  inicializarBanco,
};
