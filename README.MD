Async Parallel Pipe
===================

[![NPM Version](https://img.shields.io/npm/v/async-parallel-pipe.svg)](https://www.npmjs.com/package/async-parallel-pipe)
[![Audit](https://github.com/snatalenko/async-parallel-pipe/actions/workflows/audit.yml/badge.svg)](https://github.com/snatalenko/async-parallel-pipe/actions/workflows/audit.yml)
[![Tests](https://github.com/snatalenko/async-parallel-pipe/actions/workflows/tests.yml/badge.svg)](https://github.com/snatalenko/async-parallel-pipe/actions/workflows/tests.yml)
[![Coverage Status](https://coveralls.io/repos/github/snatalenko/async-parallel-pipe/badge.svg?branch=main)](https://coveralls.io/github/snatalenko/async-parallel-pipe?branch=main)
[![NPM Downloads](https://img.shields.io/npm/dm/async-parallel-pipe.svg)](https://www.npmjs.com/package/async-parallel-pipe)

The function pulls input values from async iterable input, runs async action, and returns async iterable output in a same order as input was received.

Here is an example that requests random numbers from random.org with not more than 2 concurrent requests at a time:

```js
const { parallelPipe } = require('async-parallel-pipe');
const fetch = require('node-fetch');

async function getRandomNumber(maxValue) {
	const response = await fetch(`https://www.random.org/integers/?num=1&min=0&max=${maxValue}&col=1&base=10&format=plain&rnd=new`);
	const value = await response.text();
	return value;
}

(async function main() {
	const inputIterable = [1, 2, 3, 4, 5].values();
	const concurrentThreads = 2;

	const outputIterable = parallelPipe(inputIterable, concurrentThreads, getRandomNumber);

	for await (const value of outputIterable)
		console.log(value);
}());
```

Since input and output are generators, multiple parallel executions can be chained together:

```js
const inputIterable = [1, 2, 3, 4, 5].values();
const multipliedIterable = parallelPipe(inputIterable, 3, el => el * 100);
const sumIterable = parallelPipe(multipliedIterable, 3, el => el + 2);

for await (const value of sumIterable)
	console.log(value);
```
