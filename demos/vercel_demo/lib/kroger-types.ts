export type KrogerStore = {
  id: string;
  name: string;
  address: string;
};

export type KrogerProduct = {
  upc: string;
  description: string;
  brand?: string;
  size?: string;
  price?: number;
};

export type KrogerMatch = {
  query: string;
  quantity: number;
  options: KrogerProduct[];
};
