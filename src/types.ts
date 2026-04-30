export interface Item {
  id: number;
  name: string;
  description: string | null;
  price: number;
  created_at: string;
}

export interface CreateItemBody {
  name: string;
  description?: string;
  price: number;
}

export interface UpdateItemBody {
  name?: string;
  description?: string;
  price?: number;
}

export type Bindings = {
  DB: D1Database;
  API_KEY: string;
  ALLOWED_ORIGIN: string;
};
