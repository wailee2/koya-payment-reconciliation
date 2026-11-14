
const fs = require("fs");

const latestByTransaction = new Map();

const lines = fs
  .readFileSync("payments.jsonl", "utf8")
  .split(/\r?\n/);

for (const line of lines) {
  if (!line.trim()) continue;

  let event;

  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }

  if (!event || typeof event !== "object" || Array.isArray(event)) {
    continue;
  }

  if (
    event.txn_id === undefined ||
    event.txn_id === null ||
    String(event.txn_id).trim() === ""
  ) {
    continue;
  }

  const timestamp = Date.parse(event.ts);
  const txnId = String(event.txn_id);

  const previous = latestByTransaction.get(txnId);

  if (!previous || timestamp >= previous.timestamp) {
    latestByTransaction.set(txnId, {
      event,
      timestamp
    });
  }
}

function amountToKobo(value) {
  const normalized = String(value).replace(/,/g, "").trim();

  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    throw new Error(`Invalid payment amount: ${value}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const naira = BigInt(match[2]);
  const kobo = BigInt((match[3] || "").padEnd(2, "0"));

  return sign * (naira * 100n + kobo);
}

let totalKobo = 0n;
let count = 0;

for (const { event } of latestByTransaction.values()) {
  if (event.status === "success") {
    totalKobo += amountToKobo(event.amount);
    count++;
  }
}

const expected = Number.parseInt(
  fs.readFileSync("expected.txt", "utf8").trim(),
  10
);

if (count !== expected) {
  console.log(
    `Check failed: counted ${count} successful payments, expected ${expected}.`
  );

  console.log(
    "Something in the data isn't being handled the way the README describes."
  );

  process.exitCode = 1;
} else {
  const wholeNaira = totalKobo / 100n;
  const kobo = (totalKobo % 100n).toString().padStart(2, "0");

  const roundedTotal = (totalKobo + 50n) / 100n;

  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Total collected: ₦${wholeNaira}.${kobo}`);
  console.log(`Your code: KOYA-${roundedTotal}`);
}
