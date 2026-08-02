const express = require("express");
const { interpretQuestion, AskDataInterpreterError } = require("../services/askDataInterpreter.service");
const { executeQuerySpec } = require("../services/askDataExecutor.service");
const { formatAnswer } = require("../services/askDataFormatter.service");

const router = express.Router();

const MAX_QUESTION_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map();

function isWithinRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);

  return entry.count <= RATE_LIMIT_MAX;
}

function isValidQuestion(question) {
  return typeof question === "string" && question.trim().length > 0;
}

function isWithinQuestionLimit(question) {
  return question.trim().length <= MAX_QUESTION_LENGTH;
}

function buildSuccessResponse(answer, result, querySpec) {
  return {
    answer,
    query: result.query,
    data: {
      columns: result.columns,
      rows: result.rows,
    },
    interpretedFilters: querySpec,
    coverage: result.coverage,
  };
}

router.post("/", async (req, res) => {
  const ip = req.ip || "unknown";

  if (!isWithinRateLimit(ip)) {
    return res.status(429).json({ message: "Too many requests. Please try again in a minute." });
  }

  const { question, currentFilters, previousQuery } = req.body;

  if (!isValidQuestion(question)) {
    return res.status(400).json({ message: "A question is required." });
  }

  if (!isWithinQuestionLimit(question)) {
    return res.status(400).json({ message: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer.` });
  }

  try {
    const interpretation = await interpretQuestion({
      question: question.trim(),
      currentFilters: currentFilters || null,
      previousQuery: previousQuery || null,
    });

    if (!interpretation.supported) {
      return res.status(422).json({
        message: interpretation.reason || "This question is outside the supported CDMP aggregate queries.",
        supported: false,
      });
    }

    const result = await executeQuerySpec(interpretation.querySpec);
    const answer = formatAnswer(interpretation.querySpec, result.rows);

    res.json(buildSuccessResponse(answer, result, interpretation.querySpec));
  } catch (error) {
    if (error instanceof AskDataInterpreterError) {
      if (error.code === "INVALID_QUESTION") {
        return res.status(400).json({ message: error.message });
      }
      if (error.code === "MALFORMED_MODEL_RESPONSE" || error.code === "INVALID_MODEL_QUERY_SPEC") {
        return res.status(422).json({ message: "The question could not be interpreted safely." });
      }
      return res.status(503).json({ message: "The AI service is temporarily unavailable." });
    }

    console.error("POST /api/ask error:", error.message);
    res.status(500).json({ message: "Failed to process the question." });
  }
});

module.exports = router;