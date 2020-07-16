const { HTMLElement, TextNode } = require("node-html-parser");
const {
	formatDifference,
	makeUniqueLabelFn,
	makeDifferenceDimensions,
	browserDimension,
	sampleSizeDimension,
	runtimeConfidenceIntervalDimension,
} = require("./tachometer-utils");

const getId = (id) => `tachometer-reporter-action--${id}`;
const getBenchmarkSectionId = (id) => getId(`results-${id}`);
const getSummaryId = (id) => getId(`summary-${id}`);

/**
 * @typedef {(props: any) => import('node-html-parser').HTMLElement} Component
 * @param {string | Component} tag
 * @param {object} attrs
 * @param  {...any} children
 * @returns {import('node-html-parser').HTMLElement}
 */
function h(tag, attrs, ...children) {
	if (typeof tag == "function") {
		return tag({ ...attrs, children });
	}

	let id = null;
	let className = null;
	let attrStr = "";
	for (let key in attrs) {
		if (key == "id") {
			id = attrs[key];
		} else if (key == "class") {
			className = attrs[key];
		} else if (attrs[key] != null) {
			attrStr += `${attrStr ? " " : ""}${key}="${attrs[key]}"`;
		}
	}

	// @ts-ignore
	children = children.flat(Infinity);

	const element = new HTMLElement(tag, { id, class: className }, attrStr);
	element.set_content(
		children.map((c) => {
			if (typeof c == "number" || typeof c == "string") {
				return new TextNode(c.toString());
			} else if (c instanceof HTMLElement) {
				c.parentNode = element;
				return c;
			} else {
				return c;
			}
		})
	);

	return element;
}

/**
 * @typedef ResultsEntryProps
 * @property {string} reportId
 * @property {import('./global').BenchmarkResult[]} benchmarks
 * @property {import('./global').WorkflowRunData} workflowRun
 * @property {import('./global').CommitInfo} commitInfo
 *
 * @param {ResultsEntryProps} props
 */
function ResultsEntry({ reportId, benchmarks, workflowRun, commitInfo }) {
	// Hard code what dimensions are rendered in the main table since GitHub comments
	// have limited horizontal space

	const labelFn = makeUniqueLabelFn(benchmarks);
	const listDimensions = [browserDimension, sampleSizeDimension];

	const sha = <tt>{commitInfo.sha.slice(0, 7)}</tt>;
	const commitHtml = commitInfo.html_url ? (
		<a href={commitInfo.html_url}>{sha}</a>
	) : (
		sha
	);

	/** @type {import("./global").Dimension[]} */
	const tableDimensions = [
		// Custom dimension that combines Tachometer's benchmark & version dimensions
		{
			label: "Version",
			format: labelFn,
		},
		runtimeConfidenceIntervalDimension,
		...makeDifferenceDimensions(labelFn, benchmarks),
	];

	return (
		<div>
			<ul>
				{listDimensions.map((dim) => {
					const uniqueValues = new Set(benchmarks.map((b) => dim.format(b)));
					return (
						<li>
							{dim.label}: {Array.from(uniqueValues).join(", ")}
						</li>
					);
				})}
				<li>Commit: {commitHtml}</li>
				<li>
					Built by: <a href={workflowRun.html_url}>{workflowRun.run_name}</a>
				</li>
			</ul>
			<table>
				<thead>
					<tr>
						{tableDimensions.map((d) => (
							<th>{d.label}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{benchmarks.map((b) => {
						return (
							<tr>
								{tableDimensions.map((d, i) => {
									return <td align="center">{d.format(b)}</td>;
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/**
 * @typedef BenchmarkSectionProps
 * @property {import('./global').Report} report
 * @property {boolean} open
 * @property {JSX.Element | string} children
 *
 * @param {BenchmarkSectionProps} props
 */
function BenchmarkSection({ report, open, children }) {
	return (
		<div id={getBenchmarkSectionId(report.id)}>
			<details open={open ? "open" : null}>
				<summary>
					<strong>{report.title}</strong>
				</summary>
				{children}
			</details>
		</div>
	);
}

/**
 * @typedef SummaryProps
 * @property {string} reportId
 * @property {import('./global').BenchmarkResult[]} benchmarks
 * @property {string} prBenchName
 * @property {string} baseBenchName
 *
 * @param {SummaryProps} props
 */
function Summary({ reportId, benchmarks, prBenchName, baseBenchName }) {
	const baseIndex = benchmarks.findIndex((b) => b.version == baseBenchName);
	const localResults = benchmarks.find((b) => b.version == prBenchName);
	const diff = formatDifference(localResults.differences[baseIndex]);

	return (
		<div id={getSummaryId(reportId)}>
			{"\n\n"}
			{`[${localResults.name}](#${getBenchmarkSectionId(reportId)}): `}
			{`${diff.label} *${diff.relative} (${diff.absolute})*`}
			{"\n\n"}
		</div>
	);
}

/**
 * @param {{ children: Array<JSX.Element | string> }} props
 */
function SummaryList({ children }) {
	// @ts-ignore
	children = children.flat(Infinity);
	return (
		<ul id={getId("summaries")}>
			{children.map((child) => (
				<li>{child}</li>
			))}
		</ul>
	);
}

/**
 * @param {{ title: string; reportId: string; workflowRun: import('./global').WorkflowRunData }} props
 */
function InProgressSummary({ title, reportId, workflowRun }) {
	// TODO: Use current job URL from here instead of workflow run URL:
	// https://api.github.com/repos/andrewiggins/tachometer-reporter-action/actions/runs/171962060/jobs
	return (
		<div id={getSummaryId(reportId)}>
			{"\n\n"}
			{`[${title}](#${getBenchmarkSectionId(reportId)}): `}
			{"\n\n"}
			Running in <a href={workflowRun.html_url}>{workflowRun.run_name}…</a>
		</div>
	);
}

/**
 * @param {{ workflowRun: import('./global').WorkflowRunData }} props
 */
function InProgressResultEntry({ workflowRun }) {
	return (
		<div>
			Running in <a href={workflowRun.html_url}>{workflowRun.run_name}…</a>
		</div>
	);
}

function Icon() {
	// Argh... SVGs get stripped out of markdown so this doesn't work :(
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="octicon"
		>
			<line x1="18" y1="20" x2="18" y2="10" />
			<line x1="12" y1="20" x2="12" y2="4" />
			<line x1="6" y1="20" x2="6" y2="14" />
		</svg>
	);
}

module.exports = {
	h,
	ResultsEntry,
	BenchmarkSection,
	Summary,
	InProgressResultEntry,
	InProgressSummary,
	SummaryList,
};
