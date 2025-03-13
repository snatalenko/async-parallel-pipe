'use strict';

import { parallelPipe } from '../..';
import { promisify } from 'util';
const delay = promisify(setTimeout);
import { expect } from 'chai';

describe('runInParallel', () => {

	it('processes input generator values in 2 concurrent Promises', async () => {

		const input = ['a', 'b', 'c', 'd', 'e'].values();
		const output: Record<string, number> = {};
		const startTs = Date.now();

		const TASK_DELAY = 10;

		const result = parallelPipe(input, 2, async el => {
			await delay(TASK_DELAY + 1);
			return { el, ts: Date.now() - startTs };
		});

		for await (const { el, ts } of result)
			output[el] = ts;

		const { a, b, c, d, e } = output;

		expect(a).to.be.gte(TASK_DELAY).and.lt(TASK_DELAY * 2);
		expect(b).to.be.gte(TASK_DELAY).and.lt(TASK_DELAY * 2);
		expect(c).to.be.gte(TASK_DELAY * 2).and.lt(TASK_DELAY * 3);
		expect(d).to.be.gte(TASK_DELAY * 2).and.lt(TASK_DELAY * 3);
		expect(e).to.be.gte(TASK_DELAY * 3);
	});

	// eslint-disable-next-line jest/no-disabled-tests
	it.skip('handles 1m input values in 1k concurrent Promises', async function highLoadTest() {

		this.timeout(10000);

		const length = 1000000;
		const input = Array.from({ length }, (v, i) => i + 1);
		const result = parallelPipe(input.values(), 1000, el => el * 2);

		let resultCount = 0;
		let resultLastValue;

		for await (const v of result) {
			resultCount++;
			resultLastValue = v;
		}

		expect(resultCount).to.eq(length);
		expect(resultLastValue).to.eq(length * 2);
	});

	it('produces results in same sequence as input comes in', async () => {

		const input = [1, 2, 3, 4, 5].values();
		const start = Date.now();

		const SECOND_TASK_DELAY = 20;
		const THIRD_TASK_DELAY = 10;

		const result = parallelPipe(input, 2, async el => {
			if (el === 2)
				await delay(SECOND_TASK_DELAY + 1);
			if (el === 3)
				await delay(THIRD_TASK_DELAY + 1);

			return [el, Date.now() - start];
		});

		const sequence: number[] = [];
		const times: number[] = [];

		for await (const el of result) {
			sequence.push(el[0]);
			times.push(el[1]);
		}

		expect(sequence).to.eql([1, 2, 3, 4, 5]);

		// 1st element in produced immediately
		expect(times[0]).to.be.lte(SECOND_TASK_DELAY);

		// 2nd and 3rd occupy the queue for `SECOND_TASK_DELAY` and `THIRD_TASK_DELAY` respectively
		expect(times[1]).to.be.gte(SECOND_TASK_DELAY);

		// 3rd processing time not affected by 2nd element processing delay, since they are processed in parallel
		expect(times[2]).to.be.gte(THIRD_TASK_DELAY).lte(SECOND_TASK_DELAY);

		// once 2nd element is ready, the queue purges 2nd and 3rd elements, enqueues 4th and 5th
		expect(times[3]).to.be.gte(SECOND_TASK_DELAY);
		expect(times[4]).to.be.gte(SECOND_TASK_DELAY);
	});
});
