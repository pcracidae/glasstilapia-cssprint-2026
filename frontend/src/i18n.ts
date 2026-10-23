// English and Tagalog labels for the main screens. Anything not listed here
// stays in English for now.

import { store } from "./data";

const tl: Record<string, string> = {
  Today: "Ngayon",
  Transactions: "Transaksyon",
  Contacts: "Kontak",
  Loan: "Utang/Loan",
  "Today's profit": "Kita ngayong araw",
  "Go to Transactions": "Tingnan ang transaksyon",
  "Go to Loan": "Tingnan ang loan",
  "You're owed": "Utang sa iyo",
  "You owe": "Utang mo",
  Latest: "Pinakabago",
  "See all": "Lahat",
  "What's next": "Susunod na gawin",
  "Log today's sales": "Itala ang benta ngayon",
  "New entry": "Bagong tala",
  "Loan readiness": "Kahandaan sa loan",
  "What lenders check": "Tinitingnan ng nagpapautang",
  Customers: "Mga suki",
  Suppliers: "Mga supplier",
};

export function t(s: string): string {
  return store.account()?.language === "tl" ? tl[s] ?? s : s;
}
