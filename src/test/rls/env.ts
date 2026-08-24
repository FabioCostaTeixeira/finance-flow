import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

const required = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Variável ${key} ausente. Copie .env.test.example para .env.test e preencha com as credenciais que "npx supabase status" imprime.`
    );
  }
}
