import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, "data");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
}

async function writeJson(name, value) {
  await fs.writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function result(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

const tools = [
  { name: "get_update_status", description: "Confirm which version of the BYU-Idaho Essay Grader is running.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_rubrics", description: "List the locally available grading rubrics.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_submissions", description: "List local essay submissions without exposing their full text.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "prepare_grading", description: "Load one rubric and one submission for grading.", inputSchema: { type: "object", properties: { rubricId: { type: "string" }, submissionId: { type: "string" } }, required: ["rubricId", "submissionId"], additionalProperties: false } },
  { name: "save_grade", description: "Save a grade only after the teacher explicitly approves it.", inputSchema: { type: "object", properties: { submissionId: { type: "string" }, rubricId: { type: "string" }, totalPoints: { type: "number" }, criterionScores: { type: "array" }, feedback: { type: "string" }, approvedByUser: { type: "boolean" } }, required: ["submissionId", "rubricId", "totalPoints", "criterionScores", "feedback", "approvedByUser"], additionalProperties: false } }
];

async function callTool(name, args) {
  if (name === "get_update_status") return result({ plugin: "BYU-Idaho Essay Grader", version: "0.2.0", message: "Update test successful — you are running version 0.2.0." });
  if (name === "list_rubrics") return result(await readJson("rubrics.json"));
  if (name === "list_submissions") {
    const submissions = await readJson("submissions.json");
    return result(submissions.map(({ text, ...summary }) => ({ ...summary, characterCount: text.length })));
  }
  if (name === "prepare_grading") {
    const [rubrics, submissions] = await Promise.all([readJson("rubrics.json"), readJson("submissions.json")]);
    const rubric = rubrics.find((item) => item.id === args.rubricId);
    const submission = submissions.find((item) => item.id === args.submissionId);
    if (!rubric || !submission) throw new Error("The requested rubric or submission was not found locally.");
    return result({ rubric, submission, instruction: "Use only this rubric. Show criterion-level reasoning and a proposed total before saving." });
  }
  if (name === "save_grade") {
    if (args.approvedByUser !== true) throw new Error("Explicit teacher approval is required before saving a grade.");
    const grades = await readJson("grades.json");
    const record = { id: `grade-${Date.now()}`, ...args, savedAt: new Date().toISOString() };
    grades.push(record);
    await writeJson("grades.json", grades);
    return result({ saved: true, grade: record });
  }
  throw new Error(`Unknown tool: ${name}`);
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const separator = buffer.indexOf("\r\n\r\n");
    if (separator < 0) return;
    const header = buffer.subarray(0, separator).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.subarray(separator + 4); continue; }
    const length = Number(match[1]);
    const start = separator + 4;
    if (buffer.length < start + length) return;
    const request = JSON.parse(buffer.subarray(start, start + length).toString("utf8"));
    buffer = buffer.subarray(start + length);
    if (request.id === undefined) continue;
    try {
      let value;
      if (request.method === "initialize") value = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "byui-essay-grader", version: "0.1.0" } };
      else if (request.method === "notifications/initialized") continue;
      else if (request.method === "tools/list") value = { tools };
      else if (request.method === "tools/call") value = await callTool(request.params.name, request.params.arguments ?? {});
      else throw new Error(`Unsupported method: ${request.method}`);
      send({ jsonrpc: "2.0", id: request.id, result: value });
    } catch (error) {
      send({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error.message } });
    }
  }
});
