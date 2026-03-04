CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  balance BIGINT DEFAULT 0,
  last_login TIMESTAMPTZ,
  metadata JSONB
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT
);
