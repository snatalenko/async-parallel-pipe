/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

export default {
	// The directory where Jest should output its coverage files
	coverageDirectory: 'coverage',

	// Indicates which provider should be used to instrument code for coverage
	coverageProvider: 'v8',

	// A set of global variables that need to be available in all test environments
	globals: {
	},

	// The test environment that will be used for testing
	testEnvironment: 'node',

	// A map from regular expressions to paths to transformers
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				isolatedModules: true
			}
		]
	}
};
