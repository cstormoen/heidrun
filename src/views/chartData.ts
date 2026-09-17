import { calculateABV, type Event } from "../domain/models";
import {
	DEFAULT_ANNOTATION_COLOR,
	EVENT_ANNOTATION_CONFIG,
} from "./constants";
import type { ChartAnnotation, ChartDatasetBundle, ChartPoint } from "./types";

export function normalizeSg(sg: number): number {
	return sg > 2 ? sg / 1000 : sg;
}

export function buildFermentationChartData(
	events: Event[],
	startDate?: string,
): ChartDatasetBundle {
	const sgData: ChartPoint[] = [];
	const abvData: ChartPoint[] = [];
	const annotations: ChartAnnotation[] = [];

	if (!startDate) {
		return { sgData, abvData, annotations };
	}

	const startMs = new Date(startDate).getTime();
	if (isNaN(startMs)) {
		return { sgData, abvData, annotations };
	}

	let og: number | null = null;
	const sorted = [...events].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	for (const e of sorted) {
		const eventTime = new Date(e.timestamp).getTime();
		const day = (eventTime - startMs) / (1000 * 60 * 60 * 24);

		if (e.type === "sg_reading") {
			let sg = e.data?.sg;
			if (sg !== undefined && sg !== null && !isNaN(sg)) {
				sg = normalizeSg(sg);
				if (og === null) og = sg;
				sgData.push({ x: day, y: sg });
				const abv = calculateABV(og, sg);
				abvData.push({ x: day, y: Number(abv.toFixed(2)) });
			}
		} else {
			const config = EVENT_ANNOTATION_CONFIG[e.type] || {
				label: e.type,
				color: DEFAULT_ANNOTATION_COLOR,
			};

			annotations.push({
				type: "line",
				xMin: day,
				xMax: day,
				borderColor: config.color,
				borderWidth: 2,
				borderDash: [4, 4],
				label: {
					display: true,
					content: config.label,
					position: "start",
					backgroundColor: config.color,
					color: "white",
					font: { size: 10 },
				},
			});
		}
	}

	return { sgData, abvData, annotations };
}
