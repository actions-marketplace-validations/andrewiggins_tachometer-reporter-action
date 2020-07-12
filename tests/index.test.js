const path = require("path");
const { readFileSync } = require("fs");
const { test } = require("uvu");
const assert = require("uvu/assert");
const { buildReport } = require("../lib/index");

const testResultsPath = path.join(__dirname, "test-results.json");
const testResults = JSON.parse(readFileSync(testResultsPath, "utf8"));

const localVersion = "local-framework";
const baseVersion = "base-framework";

test("Initial test", () => {
	const report = buildReport(testResults, localVersion, baseVersion);
	assert.ok(report, "Returns a report");
	console.log(report);
});

test.run();
