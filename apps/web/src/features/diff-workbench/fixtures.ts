import type { DiffDocument, ViewerSettings } from "./types";

export const defaultSettings: ViewerSettings = {
  diffStyle: "split",
  overflow: "scroll",
  themeType: "light",
  theme: "pierre-light",
  lineDiffType: "word",
  lineNumbers: true,
  collapsedContextThreshold: 12,
  telemetryOptIn: false
};

const oldContents = `export function formatInvoiceTotal(items) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return "$" + total.toFixed(2);
}

export function sendReceipt(email, total) {
  return fetch("/api/receipt", {
    method: "POST",
    body: JSON.stringify({ email, total })
  });
}
`;

const newContents = `export function formatInvoiceTotal(items, currency = "USD") {
  const total = items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(total);
}

export function sendReceipt(email, total, receiptId) {
  return fetch("/api/receipts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, total, receiptId })
  });
}
`;

export function createInitialDocument(): DiffDocument {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "Invoice formatter review",
    source: {
      kind: "file-pair",
      oldFile: {
        name: "src/billing/invoice.ts",
        contents: oldContents,
        lang: "typescript",
        cacheKey: `old-${oldContents.length}`
      },
      newFile: {
        name: "src/billing/invoice.ts",
        contents: newContents,
        lang: "typescript",
        cacheKey: `new-${newContents.length}`
      }
    },
    settings: defaultSettings,
    annotations: [
      {
        id: crypto.randomUUID(),
        side: "additions",
        lineNumber: 7,
        note: "Check locale handling before sharing this formatter.",
        status: "open",
        createdAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}
