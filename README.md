# Thatha Lento — backend API

A real backend for the store: hashed passwords, JWT sessions, and admin-code
checks that happen only on the server (the browser never gets to declare
itself an admin).

## Endpoints

| Method | Path                  | Who               | What                                  |
|--------|-----------------------|-------------------|----------------------------------------|
| POST   | /auth/signup          | anyone            | create a customer account              |
| POST   | /auth/login           | anyone            | customer login → token                 |
| POST   | /admin/login          | anyone            | admin login (email + code) → token     |
| GET    | /products             | anyone            | list catalogue                         |
| POST   | /products             | admin (full)      | post an item                           |
| PATCH  | /products/:id         | admin (full)      | edit price/stock/sizes/colors/special  |
| DELETE | /products/:id         | admin (full)      | delete an item                         |
| POST   | /orders               | customer          | checkout (server re-checks stock/price)|
| GET    | /orders/mine          | customer          | their own order history                |
| GET    | /orders               | admin (full)      | all orders                             |
| PATCH  | /orders/:id/status    | admin (full)      | update order status                    |
| POST   | /bugs                 | customer          | submit a bug report                    |
| GET    | /bugs                 | admin (full/bugs) | view all bug reports                   |
| POST   | /footprints           | customer          | log a viewed product                   |
| GET    | /footprints/mine      | customer          | their browsing history                 |

Every write route re-checks the token server-side — the frontend UI hiding a
button is never the actual security boundary.

## 1. Local setup

```bash
cd thatha-lento-backend
npm install
cp .env.example .env
# then edit .env: set a real JWT_SECRET, and your own admin codes
npm run dev
```

Generate a strong `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API listens on `http://localhost:4000` by default. `GET /health` should
return `{"ok":true}`.

## 2. Wire up the frontend

Replace every `window.storage` call in the React app with a `fetch` to this
API, and store the returned token in memory / an httpOnly cookie (not
`localStorage`, to reduce XSS risk) — e.g.:

```js
const API = "https://api.yourdomain.com";

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { token, user }
}

async function getProducts() {
  const res = await fetch(`${API}/products`);
  return res.json();
}

async function addToOrder(token, items) {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}
```

Admin calls look the same, just against `/admin/login` and with the
returned admin token attached as `Authorization: Bearer <token>`.

## 3. Deploying

1. Push this folder to its own GitHub repo (`.env` is git-ignored — good).
2. Deploy to Render, Railway, or Fly.io:
   - Build command: `npm install`
   - Start command: `npm start`
   - Set `JWT_SECRET`, `ADMIN_FULL_CODE`, `ADMIN_BUGS_ONLY_CODE`, `CORS_ORIGIN`
     as environment variables in the host's dashboard.
3. Once live, you'll have a URL like `https://thatha-lento-api.onrender.com`.
   Set `CORS_ORIGIN` to your deployed frontend's exact URL.
4. Deploy the frontend (Vercel/Netlify/Cloudflare Pages) pointing its `API`
   constant at that live backend URL.
5. Point your domain at the frontend, and a subdomain (e.g. `api.`) at the
   backend, once both are confirmed working.

## Notes on the SQLite database

`better-sqlite3` writes to a single file (`thatha-lento.db`). This is fine
to start and easy to back up (just copy the file), but most hosts that spin
your app down when idle will wipe it — check whether your host offers a
persistent disk, or migrate to a managed Postgres (Render/Railway/Supabase
all offer one) once you're past the prototype stage. The route code would
only need its SQL swapped, not its structure.
