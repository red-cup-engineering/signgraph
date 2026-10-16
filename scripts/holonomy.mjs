#!/usr/bin/env node
/**
 * SignGraph native JSONL: one bounded engineering operation/receipt per line.
 * No network, files, mutation, remote writes, or ambient selection of an
 * experiment. Operators and agents can pipe explicit geometry and
 * measurements through this installed Engineering capability.
 */
import { once } from "node:events";
import { executeOperation, operations } from "../src/operations.mjs";

const usage = `signgraph-operations / signgraph-holonomy (JSONL on standard input)
Input: {"operation":"signgraph.holonomy.topology","input":{"vertices":[],"edges":[],"faces":[]}}
Operations: ${Object.values(operations).map(op => op.id).join(", ")}
Each input line produces one JSON receipt. Malformed requests emit a
bounded error receipt and cause exit status 1, without hiding later lines.`;

// Enforce the 64-KiB bound while consuming chunks. A line reader that
// buffers the entire line before checking its size is not a work budget.
async function* boundedLines(stream) {
  stream.setEncoding("utf8"); // Decode partial multibyte code points safely.
  let held = "", overBudget = false;
  for await (const chunk of stream) {
    let start = 0;
    while (start < chunk.length) {
      const end = chunk.indexOf("\n", start);
      const part = chunk.slice(start, end === -1 ? chunk.length : end);
      if (!overBudget) {
        if (Buffer.byteLength(held, "utf8") + Buffer.byteLength(part, "utf8") > 65536) {
          held = "";
          overBudget = true;
        } else held += part;
      }
      if (end === -1) break;
      yield { text: held, overBudget };
      held = ""; overBudget = false; start = end + 1;
    }
  }
  if (held.length || overBudget) yield { text: held, overBudget };
}

if (process.argv.includes("--help")) {
  process.stdout.write(usage + "\n");
} else if (process.argv.length !== 2) {
  process.stderr.write(usage + "\n");
  process.exitCode = 2;
} else {
  const write = async receipt => {
    if (!process.stdout.write(JSON.stringify(receipt) + "\n"))
      await once(process.stdout, "drain");
  };
  let index = 0;
  for await (const { text: line, overBudget } of boundedLines(process.stdin)) {
    if (line.length === 0 && !overBudget) continue;
    index += 1;
    if (index > 1024) {
      await write({ ok: false, line: index, error: "signgraph operations batch exceeds 1024 requests" });
      process.exitCode = 1;
      break;
    }
    try {
      if (overBudget)
        throw new RangeError("signgraph operations request exceeds the 64KiB input budget");
      const request = JSON.parse(line);
      if (!request || typeof request !== "object" || Array.isArray(request) ||
          Object.keys(request).some(k => k !== "operation" && k !== "input") ||
          typeof request.operation !== "string")
        throw new TypeError("signgraph operations require {operation, input}");
      await write({
        ok: true, line: index, operation: request.operation,
        receipt: executeOperation(request.operation, request.input),
      });
    } catch (error) {
      process.exitCode = 1;
      await write({
        ok: false, line: index,
        error: error instanceof Error ? error.message : "signgraph operations request refused",
      });
    }
  }
}
