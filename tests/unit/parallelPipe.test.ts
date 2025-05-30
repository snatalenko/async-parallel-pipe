import { parallelPipe } from '../../src';

async function* asyncGenerator<T>(arr: T[]): AsyncIterableIterator<T> {
	for (const item of arr)
		yield item;
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

describe('parallelPipe', () => {

	it('processes an async iterable with synchronous tasks', async () => {

		const input = asyncGenerator([1, 2, 3]);
		const action = x => x * 10;
		const limit = 2;
		const results: number[] = [];
		const iterator = parallelPipe(input, limit, action);
		for await (const output of iterator)
			results.push(output);

		expect(results).toEqual([10, 20, 30]);
	});

	it('processes an async iterable with asynchronous tasks', async () => {

		const input = asyncGenerator([1, 2, 3]);
		const action = async (x, i) => {
			await delay(10);
			return x + i;
		};
		const limit = 2;
		const results: number[] = [];
		const iterator = parallelPipe(input, limit, action);
		for await (const output of iterator)
			results.push(output);

		expect(results).toEqual([1, 3, 5]);
	});

	it('handles a mix of synchronous and asynchronous tasks', async () => {

		const input = asyncGenerator([5, 10, 15]);
		const action = (x, i) => {
			if (i % 2 === 0)
				return x - i;

			return delay(10).then(() => x + i);
		};
		const limit = 2;
		const results: number[] = [];
		const iterator = parallelPipe(input, limit, action);
		for await (const output of iterator)
			results.push(output);

		expect(results).toEqual([5, 11, 13]);
	});

	it('propagates errors from tasks', async () => {

		const input = asyncGenerator([1, 2, 3]);
		const action = async x => {
			if (x === 2)
				throw new Error('fail');

			return x;
		};
		const limit = 2;
		const iterator = parallelPipe(input, limit, action);
		let caughtError;
		try {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			for await (const _ of iterator) { /* no-op */ }
		}
		catch (err) {
			caughtError = err;
		}
		expect(caughtError).toBeTruthy();
		expect(caughtError.message).toEqual('fail');
	});

	it('does not exceed the specified parallel limit', async () => {

		const inputValues = [1, 2, 3, 4, 5];
		const input = asyncGenerator(inputValues);
		let running = 0;
		let maxRunning = 0;
		const action = async x => {
			running++;
			if (running > maxRunning)
				maxRunning = running;
			await delay(20);
			running--;
			return x;
		};
		const limit = 2;
		const results: number[] = [];
		const iterator = parallelPipe(input, limit, action);
		for await (const output of iterator)
			results.push(output);

		expect(results).toEqual(inputValues);
		expect(maxRunning).toBeLessThanOrEqual(limit);
	});

	it('returns an AsyncIterableIterator', async () => {
		const input = asyncGenerator([1]);
		const iterator = parallelPipe(input, 2, x => x);
		expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
	});

	it('processes input generator values in 2 concurrent Promises', async () => {

		const input = asyncGenerator(['a', 'b', 'c', 'd', 'e']);
		const output: Record<string, number> = {};
		const startTs = Date.now();
		const TASK_DELAY = 10;

		const iterator = parallelPipe(input, 2, async el => {
			await delay(TASK_DELAY + 1);
			return { el, ts: Date.now() - startTs };
		});

		for await (const { el, ts } of iterator)
			output[el] = ts;

		const { a, b, c, d, e } = output;
		expect(a).toBeGreaterThanOrEqual(TASK_DELAY);
		expect(a).toBeLessThan(TASK_DELAY * 2);

		expect(b).toBeGreaterThanOrEqual(TASK_DELAY);
		expect(b).toBeLessThan(TASK_DELAY * 2);

		expect(c).toBeGreaterThanOrEqual(TASK_DELAY * 2);
		expect(c).toBeLessThan(TASK_DELAY * 3);

		expect(d).toBeGreaterThanOrEqual(TASK_DELAY * 2);
		expect(d).toBeLessThan(TASK_DELAY * 3);

		expect(e).toBeGreaterThanOrEqual(TASK_DELAY * 3);
	});

	it('handles 10k input values in 1k concurrent Promises', async () => {
		const length = 10_000;
		async function* asyncWrapper() {
			for (let i = 1; i <= length; i++)
				yield i;

		}
		const iterator1 = parallelPipe(asyncWrapper(), 1000, el => el * 2);
		const iterator2 = parallelPipe(iterator1, 1000, el => el + 1);

		let resultCount = 0;
		let resultLastValue;
		for await (const v of iterator2) {
			resultCount++;
			resultLastValue = v;
		}
		expect(resultCount).toBe(length);
		expect(resultLastValue).toBe((length * 2) + 1);
	});

	it('produces results in same sequence as input comes in', async () => {

		async function* asyncWrapper(iterable) {
			for (const item of iterable)
				yield item;

		}
		const input = asyncWrapper([1, 2, 3, 4, 5].values());
		const start = Date.now();
		const SECOND_TASK_DELAY = 20;
		const THIRD_TASK_DELAY = 10;

		const iterator: AsyncIterableIterator<[number, number]> = parallelPipe(input, 2, async el => {
			if (el === 2)
				await delay(SECOND_TASK_DELAY + 1);
			if (el === 3)
				await delay(THIRD_TASK_DELAY + 1);

			return [el, Date.now() - start];
		});

		const sequence: number[] = [];
		const times: number[] = [];
		for await (const [el, ts] of iterator) {
			sequence.push(el);
			times.push(ts);
		}
		expect(sequence).toEqual([1, 2, 3, 4, 5]);
		expect(times[0]).toBeLessThanOrEqual(SECOND_TASK_DELAY);
		expect(times[1]).toBeGreaterThanOrEqual(SECOND_TASK_DELAY);
		expect(times[2]).toBeGreaterThanOrEqual(THIRD_TASK_DELAY);
		expect(times[2]).toBeLessThanOrEqual(SECOND_TASK_DELAY);
		expect(times[3]).toBeGreaterThanOrEqual(SECOND_TASK_DELAY);
		expect(times[4]).toBeGreaterThanOrEqual(SECOND_TASK_DELAY);
	});

	it('iterator returns final value along with done: true', async () => {

		async function* generatorWithReturn() {
			yield 'first';
			yield 'second';
			return 'final';
		}
		const iterator = parallelPipe(generatorWithReturn(), 1, async x => x);

		const res1 = await iterator.next();
		expect(res1).toEqual({ value: 'first', done: false });

		const res2 = await iterator.next();
		expect(res2).toEqual({ value: 'second', done: false });

		const res3 = await iterator.next();
		expect(res3).toEqual({ value: 'final', done: true });
	});

	it('returns { value: undefined, done: true } after iterator is done', async () => {

		async function* simpleGen() {
			yield 1;
			yield 2;
		}
		const iterator = parallelPipe(simpleGen(), 1, async x => x);

		const res1 = await iterator.next();
		expect(res1).toEqual({ value: 1, done: false });

		const res2 = await iterator.next();
		expect(res2).toEqual({ value: 2, done: false });

		const res3 = await iterator.next();
		expect(res3).toEqual({ value: undefined, done: true });

		// Subsequent calls after completion
		const res4 = await iterator.next();
		expect(res4).toEqual({ value: undefined, done: true });
	});

	describe('Invalid parameters', () => {

		it('throws error if input is not iterable', () => {
			expect(() => parallelPipe(123 as any, 2, x => x))
				.toThrow('iterableInput must be an Iterable Object');
		});

		it('throws error if concurrentTasksLimit is not a positive number (zero)', () => {
			const validIterable = (async function* () {
				yield 1;
			}());
			expect(() => parallelPipe(validIterable, 0, x => x))
				.toThrow('concurrentTasksLimit argument must be a positive Number');
		});

		it('throws error if concurrentTasksLimit is not a positive number (non-number)', () => {
			const validIterable = (async function* () {
				yield 1;
			}());
			expect(() => parallelPipe(validIterable, '2' as any, x => x))
				.toThrow('concurrentTasksLimit argument must be a positive Number');
		});

		it('throws error if action is not a function', () => {
			const validIterable = (async function* () {
				yield 1;
			}());
			expect(() => parallelPipe(validIterable, 1, {} as any))
				.toThrow('action argument must be a Function');
		});
	});
});
